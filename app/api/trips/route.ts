import {
  errorResponse,
  HttpError,
  jsonResponse,
  newId,
  nowIso,
  readJson,
} from "@/db";
import { requireSession } from "@/lib/auth";
import { LAST_MINUTE_TEMPLATE, SEASONAL_PACKING_TEMPLATES } from "@/lib/packing-templates";
import { loadTrips } from "@/lib/trip-data";
import { dateField, modeField, objectBody, seasonField, stringField } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { d1 } = await requireSession(request);
    return jsonResponse({ trips: await loadTrips(d1) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { d1 } = await requireSession(request);
    const body = objectBody(await readJson(request));
    const title = stringField(body.title, "旅程名稱", { max: 120 });
    const destinations = stringField(body.destinations, "目的地", { max: 300 });
    const startDate = dateField(body.startDate, "出發日期");
    const endDate = dateField(body.endDate, "回程日期");
    if (endDate < startDate) throw new HttpError(400, "回程日期不能早於出發日期。");
    const season = seasonField(body.season, startDate);
    const mode = modeField(body.mode);
    const tripId = newId();
    const now = nowIso();
    const statements = [
      d1.prepare("INSERT INTO trips (id, title, destinations, start_date, end_date, season, mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(tripId, title, destinations, startDate, endDate, season, mode, now, now),
      ...(mode === "plan" ? SEASONAL_PACKING_TEMPLATES[season].map((item) =>
        d1.prepare("INSERT INTO trip_packing_items (id, trip_id, template_key, label, category, origin, sort_order, optional, checked, checked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)").bind(newId(), tripId, item.key, item.label, item.category, item.origin, item.sortOrder, item.optional ? 1 : 0, now, now),
      ) : []),
      ...(mode === "plan" ? LAST_MINUTE_TEMPLATE.map((item, index) =>
        d1.prepare("INSERT INTO trip_last_minute_items (id, trip_id, template_key, label, sort_order, checked, checked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)").bind(newId(), tripId, item.key, item.label, index, now, now),
      ) : []),
    ];
    await d1.batch(statements);
    const { loadTrip } = await import("@/lib/trip-data");
    const trip = await loadTrip(d1, tripId);
    return jsonResponse({ trip }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
