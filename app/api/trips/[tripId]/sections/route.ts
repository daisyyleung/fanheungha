import { errorResponse, HttpError, jsonResponse, nowIso, readJson } from "@/db";
import { requireSession } from "@/lib/auth";
import { loadTrip } from "@/lib/trip-data";
import { booleanField, objectBody, stringField } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ tripId: string }> };
type SectionKind = "shopping" | "food";

function sectionKind(value: unknown): SectionKind {
  if (value === "shopping" || value === "food") return value;
  throw new HttpError(400, "分組類型不正確。");
}

async function ensureTrip(request: Request, tripId: string) {
  const { d1 } = await requireSession(request);
  const trip = await loadTrip(d1, tripId);
  if (!trip) throw new HttpError(404, "找不到這趟旅程。");
  return { d1, trip };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { d1 } = await ensureTrip(request, (await context.params).tripId);
    const { tripId } = await context.params;
    const kind = sectionKind(new URL(request.url).searchParams.get("kind") ?? "shopping");
    const view = new URL(request.url).searchParams.get("view");
    const archivedClause = view === "archived" ? "archived_at IS NOT NULL" : "archived_at IS NULL";
    const sections = await d1.prepare(`SELECT id, kind, name, normalized_key, sort_order, archived_at FROM list_sections WHERE trip_id = ? AND kind = ? AND ${archivedClause} ORDER BY sort_order, id`).bind(tripId, kind).all();
    return jsonResponse({ sections: sections.results });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { tripId } = await context.params;
    const { d1 } = await ensureTrip(request, tripId);
    const body = objectBody(await readJson(request));
    const kind = sectionKind(body.kind);
    const now = nowIso();

    if (body.order !== undefined) {
      if (!Array.isArray(body.order) || body.order.length > 200 || body.order.length === 0) throw new HttpError(400, "分組排序清單格式不正確。");
      const order = body.order.map((value) => stringField(value, "分組 ID", { max: 80 }));
      if (new Set(order).size !== order.length) throw new HttpError(400, "分組排序清單不能有重複項目。");
      const siblingsResult = await d1.prepare("SELECT id FROM list_sections WHERE trip_id = ? AND kind = ? AND archived_at IS NULL").bind(tripId, kind).all<{ id: string }>();
      const siblings = siblingsResult.results.map((row) => row.id);
      if (siblings.length !== order.length || siblings.some((id) => !order.includes(id))) throw new HttpError(400, "分組排序清單必須完整包含所有未收起分組。");
      await d1.batch(order.map((id, index) => d1.prepare("UPDATE list_sections SET sort_order = ?, updated_at = ? WHERE id = ? AND trip_id = ? AND kind = ? AND archived_at IS NULL").bind(index, now, id, tripId, kind)));
      return jsonResponse({ trip: await loadTrip(d1, tripId) });
    }

    const id = stringField(body.id, "分組 ID", { max: 80 });
    const section = await d1.prepare("SELECT id, archived_at FROM list_sections WHERE id = ? AND trip_id = ? AND kind = ? LIMIT 1").bind(id, tripId, kind).all<{ id: string; archived_at: string | null }>();
    if (!section.results[0]) throw new HttpError(404, "找不到這個店舖分組。");
    if (typeof body.archived !== "boolean") throw new HttpError(400, "請提供分組的收起或還原狀態。");
    const archived = booleanField(body.archived, "分組狀態");
    if (archived) {
      await d1.prepare("UPDATE list_sections SET archived_at = ?, updated_at = ? WHERE id = ? AND trip_id = ? AND kind = ? AND archived_at IS NULL").bind(now, now, id, tripId, kind).run();
    } else {
      await d1.prepare("UPDATE list_sections SET archived_at = NULL, updated_at = ? WHERE id = ? AND trip_id = ? AND kind = ? AND archived_at IS NOT NULL").bind(now, id, tripId, kind).run();
    }
    return jsonResponse({ trip: await loadTrip(d1, tripId) });
  } catch (error) {
    return errorResponse(error);
  }
}
