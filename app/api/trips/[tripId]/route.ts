import { errorResponse, HttpError, jsonResponse, nowIso, readJson } from "@/db";
import { requireSession } from "@/lib/auth";
import { loadTrip } from "@/lib/trip-data";
import { dateField, objectBody, seasonField, stringField } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ tripId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { d1 } = await requireSession(request);
    const { tripId } = await context.params;
    const trip = await loadTrip(d1, tripId);
    if (!trip) throw new HttpError(404, "找不到這趟旅程。");
    return jsonResponse(trip);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { d1 } = await requireSession(request);
    const { tripId } = await context.params;
    const existing = await loadTrip(d1, tripId);
    if (!existing) throw new HttpError(404, "找不到這趟旅程。");
    const body = objectBody(await readJson(request));
    if (body.archived === true) {
      await d1.prepare("UPDATE trips SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL").bind(nowIso(), nowIso(), tripId).run();
      return jsonResponse({ archived: true });
    }
    if (body.mode !== undefined) throw new HttpError(400, "旅程模式建立後不能更改。");
    const title = body.title === undefined ? existing.trip.title : stringField(body.title, "旅程名稱", { max: 120 });
    const destinations = body.destinations === undefined ? existing.trip.destinations : stringField(body.destinations, "目的地", { max: 300 });
    const startDate = body.startDate === undefined ? existing.trip.startDate : dateField(body.startDate, "出發日期");
    const endDate = body.endDate === undefined ? existing.trip.endDate : dateField(body.endDate, "回程日期");
    if (endDate < startDate) throw new HttpError(400, "回程日期不能早於出發日期。");
    const season = seasonField(body.season === undefined ? existing.trip.season : body.season, startDate);
    const outsideRange = await d1.prepare("SELECT id FROM itinerary_items WHERE trip_id = ? AND archived_at IS NULL AND (item_date < ? OR item_date > ?) LIMIT 1").bind(tripId, startDate, endDate).all();
    if (outsideRange.results[0]) {
      throw new HttpError(409, "新日期範圍會排除已寫好的行程；請先調整那些行程日期。");
    }
    await d1.prepare("UPDATE trips SET title = ?, destinations = ?, start_date = ?, end_date = ?, season = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL").bind(title, destinations, startDate, endDate, season, nowIso(), tripId).run();
    const trip = await loadTrip(d1, tripId);
    return jsonResponse(trip);
  } catch (error) {
    return errorResponse(error);
  }
}
