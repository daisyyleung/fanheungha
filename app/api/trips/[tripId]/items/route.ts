import { errorResponse, HttpError, jsonResponse, newId, nowIso, readJson } from "@/db";
import { requireSession } from "@/lib/auth";
import { loadArchivedTrip, loadTrip, type ListSectionKind } from "@/lib/trip-data";
import { PACKING_CATEGORIES } from "@/lib/packing-templates";
import { booleanField, dateField, dateWithinRange, dayPeriodField, itineraryCategoryField, normalizePlaceName, objectBody, placeNameField, safeLink, stringField, timeField } from "@/lib/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ tripId: string }> };
type ItemKind = "itinerary" | "packing" | "lastMinute" | "shopping" | "food";

function itemKind(value: unknown): ItemKind {
  if (value === "itinerary" || value === "packing" || value === "lastMinute" || value === "shopping" || value === "food") return value;
  throw new HttpError(400, "項目類型不正確。");
}

function isPlaceKind(kind: ItemKind): kind is "shopping" | "food" {
  return kind === "shopping" || kind === "food";
}

function tableFor(kind: ItemKind): string {
  return kind === "itinerary" ? "itinerary_items" : kind === "packing" ? "trip_packing_items" : kind === "lastMinute" ? "trip_last_minute_items" : `${kind}_items`;
}

type PlaceSectionRow = { id: string; archived_at: string | null; normalized_key: string; name: string };

async function resolvePlaceSection(d1: D1Database, tripId: string, kind: ListSectionKind, shop: string, now: string, allowArchived = false): Promise<{ id: string; sortOrder: number }> {
  const { displayName, normalizedKey } = placeNameField(shop);
  const existing = await d1.prepare("SELECT id, archived_at, normalized_key, name FROM list_sections WHERE trip_id = ? AND kind = ? AND normalized_key = ? LIMIT 1").bind(tripId, kind, normalizedKey).all<PlaceSectionRow>();
  const row = existing.results[0];
  if (row?.archived_at && !allowArchived) throw new HttpError(409, `「${row.name}」已收起，請先在已收起項目還原店舖分組。`);
  if (row) {
    const order = await d1.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM list_sections WHERE trip_id = ? AND kind = ?").bind(tripId, kind).all<{ next_order: number }>();
    return { id: row.id, sortOrder: Number(order.results[0]?.next_order ?? 0) };
  }
  const nextOrder = await d1.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM list_sections WHERE trip_id = ? AND kind = ?").bind(tripId, kind).all<{ next_order: number }>();
  const id = newId();
  try {
    await d1.prepare("INSERT INTO list_sections (id, trip_id, kind, name, normalized_key, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id, tripId, kind, displayName, normalizedKey, Number(nextOrder.results[0]?.next_order ?? 0), now, now).run();
  } catch (error) {
    if (!/UNIQUE constraint failed: list_sections/i.test(error instanceof Error ? error.message : String(error))) throw error;
    const concurrent = await d1.prepare("SELECT id, archived_at FROM list_sections WHERE trip_id = ? AND kind = ? AND normalized_key = ? LIMIT 1").bind(tripId, kind, normalizedKey).all<{ id: string; archived_at: string | null }>();
    if (concurrent.results[0]?.archived_at && !allowArchived) throw new HttpError(409, "這個店舖分組已收起，請先還原後再加入。");
    if (!concurrent.results[0]) throw error;
    return { id: concurrent.results[0].id, sortOrder: Number(nextOrder.results[0]?.next_order ?? 0) };
  }
  return { id, sortOrder: Number(nextOrder.results[0]?.next_order ?? 0) };
}

async function nextItemOrder(d1: D1Database, table: string, tripId: string, sectionId?: string): Promise<number> {
  const result = sectionId
    ? await d1.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM ${table} WHERE trip_id = ? AND section_id = ?`).bind(tripId, sectionId).all<{ next_order: number }>()
    : await d1.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM ${table} WHERE trip_id = ?`).bind(tripId).all<{ next_order: number }>();
  return Number(result.results[0]?.next_order ?? 0);
}

async function reorderItems(d1: D1Database, tripId: string, kind: ItemKind, orderValue: unknown, body: Record<string, unknown>, now: string): Promise<void> {
  if (!Array.isArray(orderValue) || orderValue.length === 0 || orderValue.length > 500) throw new HttpError(400, "排序清單格式不正確。");
  const order = orderValue.map((value) => stringField(value, "項目 ID", { max: 80 }));
  if (new Set(order).size !== order.length) throw new HttpError(400, "排序清單不能有重複項目。");
  const table = tableFor(kind);
  let query = `SELECT id${kind === "packing" ? ", category" : kind === "shopping" || kind === "food" ? ", section_id" : kind === "itinerary" ? ", item_date" : ""} FROM ${table} WHERE trip_id = ? AND archived_at IS NULL`;
  const binds: unknown[] = [tripId];
  if (isPlaceKind(kind)) {
    const sectionId = stringField(body.sectionId, "分組 ID", { max: 80 });
    query += " AND section_id = ?";
    binds.push(sectionId);
    const section = await d1.prepare("SELECT id FROM list_sections WHERE id = ? AND trip_id = ? AND kind = ? AND archived_at IS NULL LIMIT 1").bind(sectionId, tripId, kind).all();
    if (!section.results[0]) throw new HttpError(404, "找不到這個店舖分組。");
  } else if (kind === "packing") {
    const category = stringField(body.category, "分類", { max: 40 });
    query += " AND category = ?";
    binds.push(category);
  } else if (kind === "itinerary" && body.itemDate !== undefined) {
    const itemDate = dateField(body.itemDate, "行程日期");
    query += " AND item_date = ? AND category <> 'weather'";
    binds.push(itemDate);
  }
  const siblingsResult = await d1.prepare(query).bind(...binds).all<{ id: string }>();
  const siblings = siblingsResult.results.map((row) => row.id);
  if (siblings.length !== order.length || siblings.some((id) => !order.includes(id))) {
    throw new HttpError(400, "排序清單必須完整包含同一組的所有未收起項目。");
  }
  await d1.batch(order.map((id, index) => d1.prepare(`UPDATE ${table} SET sort_order = ?, updated_at = ? WHERE id = ? AND trip_id = ? AND archived_at IS NULL`).bind(index, now, id, tripId)));
}

function ensureJournalItemAllowed(mode: "plan" | "journal", kind: ItemKind): void {
  if (mode === "journal" && kind !== "itinerary") {
    throw new HttpError(400, "過往旅記只支援新增旅程 Log，不會建立準備清單。");
  }
}

function itemErrorResponse(error: unknown): Response {
  if (error instanceof Error && /idx_itinerary_active_weather_day|UNIQUE constraint failed: itinerary_items/i.test(error.message)) {
    return errorResponse(new HttpError(409, "這天已經有天氣紀錄；每一天只保留一項天氣。"));
  }
  return errorResponse(error);
}

async function ensureTrip(request: Request, tripId: string) {
  const { d1 } = await requireSession(request);
  const trip = await loadTrip(d1, tripId);
  if (!trip) throw new HttpError(404, "找不到這趟旅程。");
  return { d1, trip };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { d1 } = await requireSession(request);
    const { tripId } = await context.params;
    const view = new URL(request.url).searchParams.get("view");
    if (view === "archived") {
      const archived = await loadArchivedTrip(d1, tripId);
      if (!archived) throw new HttpError(404, "找不到這趟旅程。");
      return jsonResponse({ archived });
    }
    const trip = await loadTrip(d1, tripId);
    if (!trip) throw new HttpError(404, "找不到這趟旅程。");
    return jsonResponse(trip);
  } catch (error) {
    return itemErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { tripId } = await context.params;
    const { d1, trip } = await ensureTrip(request, tripId);
    const body = objectBody(await readJson(request));
    const kind = itemKind(body.kind);
    ensureJournalItemAllowed(trip.trip.mode, kind);
    const id = newId();
    const now = nowIso();

    if (kind === "itinerary") {
      const itemDate = dateWithinRange(dateField(body.itemDate, "行程日期"), trip.trip.startDate, trip.trip.endDate, "行程日期");
      const itemTime = timeField(body.itemTime, "時間");
      const dayPeriod = dayPeriodField(body.dayPeriod);
      const title = stringField(body.title, "行程標題", { max: 160 });
      const category = itineraryCategoryField(body.category);
      const location = stringField(body.location, "地點", { max: 180, required: false });
      const note = stringField(body.note, "備註", { max: 500, required: false });
      if (category === "weather") {
        const existingWeather = await d1.prepare("SELECT id FROM itinerary_items WHERE trip_id = ? AND item_date = ? AND category = 'weather' AND archived_at IS NULL LIMIT 1").bind(tripId, itemDate).all();
        if (existingWeather.results[0]) throw new HttpError(409, "這天已經有天氣紀錄；每一天只保留一項天氣。");
      }
      await d1.prepare("INSERT INTO itinerary_items (id, trip_id, item_date, item_time, day_period, title, category, location, note, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, tripId, itemDate, itemTime, dayPeriod, title, category, location, note, trip.itinerary.length, now, now).run();
    } else if (kind === "packing") {
      const label = stringField(body.label, "物品名稱", { max: 160 });
      const category = stringField(body.category ?? "其他", "分類", { max: 40 });
      if (!PACKING_CATEGORIES.includes(category as (typeof PACKING_CATEGORIES)[number])) throw new HttpError(400, "分類選項不正確。");
      await d1.prepare("INSERT INTO trip_packing_items (id, trip_id, template_key, label, category, origin, sort_order, optional, checked, checked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'custom', ?, 0, 0, NULL, ?, ?)").bind(id, tripId, `custom-${id}`, label, category, trip.packing.length, now, now).run();
    } else if (kind === "lastMinute") {
      const label = stringField(body.label, "檢查項目", { max: 200 });
      await d1.prepare("INSERT INTO trip_last_minute_items (id, trip_id, template_key, label, sort_order, checked, checked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)").bind(id, tripId, `custom-${id}`, label, trip.lastMinute.length, now, now).run();
    } else if (kind === "shopping") {
      const name = stringField(body.name, "想買物品", { max: 160 });
      const link = safeLink(body.link);
      const quantity = stringField(body.quantity ?? "1", "數量", { max: 40 });
      const shop = stringField(body.shop, "店舖", { max: 120, required: false });
      const note = stringField(body.note, "備註", { max: 500, required: false });
      const section = await resolvePlaceSection(d1, tripId, "shopping", shop, now);
      const sortOrder = await nextItemOrder(d1, "shopping_items", tripId, section.id);
      await d1.prepare("INSERT INTO shopping_items (id, trip_id, name, link, quantity, shop, note, section_id, sort_order, purchased, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)").bind(id, tripId, name, link, quantity, shop, note, section.id, sortOrder, now, now).run();
    } else {
      const name = stringField(body.name, "食物／飲品名稱", { max: 160 });
      const shop = stringField(body.shop, "便利店／店舖", { max: 120, required: false });
      const link = safeLink(body.link, "想食／飲連結");
      const note = stringField(body.note, "備註", { max: 500, required: false });
      const section = await resolvePlaceSection(d1, tripId, "food", shop, now);
      const sortOrder = await nextItemOrder(d1, "food_items", tripId, section.id);
      await d1.prepare("INSERT INTO food_items (id, trip_id, name, shop, link, note, section_id, sort_order, tried, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)").bind(id, tripId, name, shop, link, note, section.id, sortOrder, now, now).run();
    }

    return jsonResponse({ trip: await loadTrip(d1, tripId) }, 201);
  } catch (error) {
    return itemErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { tripId } = await context.params;
    const { d1, trip } = await ensureTrip(request, tripId);
    const body = objectBody(await readJson(request));
    const kind = itemKind(body.kind);
    ensureJournalItemAllowed(trip.trip.mode, kind);
    if (body.order !== undefined) {
      await reorderItems(d1, tripId, kind, body.order, body, nowIso());
      return jsonResponse({ trip: await loadTrip(d1, tripId) });
    }
    const id = stringField(body.id, "項目 ID", { max: 80 });
    const now = nowIso();

    if (kind === "itinerary") {
      const row = await d1.prepare("SELECT id, item_date, category, archived_at FROM itinerary_items WHERE id = ? AND trip_id = ? LIMIT 1").bind(id, tripId).all<{ id: string; item_date: string; category: string; archived_at: string | null }>();
      if (!row.results[0]) throw new HttpError(404, "找不到這個行程項目。");
      if (body.archived === true) {
        await d1.prepare("UPDATE itinerary_items SET archived_at = ?, updated_at = ? WHERE id = ? AND trip_id = ?").bind(now, now, id, tripId).run();
      } else if (body.archived === false) {
        if (!row.results[0].archived_at) throw new HttpError(409, "這個行程項目尚未收起。");
        await d1.prepare("UPDATE itinerary_items SET archived_at = NULL, updated_at = ? WHERE id = ? AND trip_id = ? AND archived_at IS NOT NULL").bind(now, id, tripId).run();
      } else {
        if (row.results[0].archived_at) throw new HttpError(409, "這個行程項目已收起，請先還原後再編輯。");
        const itemDate = body.itemDate === undefined ? undefined : dateWithinRange(dateField(body.itemDate, "行程日期"), trip.trip.startDate, trip.trip.endDate, "行程日期");
        const itemTime = body.itemTime === undefined ? undefined : timeField(body.itemTime, "時間");
        const dayPeriod = body.dayPeriod === undefined ? undefined : dayPeriodField(body.dayPeriod);
        const title = body.title === undefined ? undefined : stringField(body.title, "行程標題", { max: 160 });
        const category = body.category === undefined ? undefined : itineraryCategoryField(body.category);
        const location = body.location === undefined ? undefined : stringField(body.location, "地點", { max: 180, required: false });
        const note = body.note === undefined ? undefined : stringField(body.note, "備註", { max: 500, required: false });
        const nextDate = itemDate ?? row.results[0].item_date;
        const nextCategory = category ?? row.results[0].category;
        if (nextCategory === "weather" && (nextDate !== row.results[0].item_date || row.results[0].category !== "weather")) {
          const existingWeather = await d1.prepare("SELECT id FROM itinerary_items WHERE trip_id = ? AND item_date = ? AND category = 'weather' AND archived_at IS NULL AND id <> ? LIMIT 1").bind(tripId, nextDate, id).all();
          if (existingWeather.results[0]) throw new HttpError(409, "這天已經有天氣紀錄；每一天只保留一項天氣。");
        }
        await d1.prepare("UPDATE itinerary_items SET item_date = COALESCE(?, item_date), item_time = COALESCE(?, item_time), day_period = COALESCE(?, day_period), title = COALESCE(?, title), category = COALESCE(?, category), location = COALESCE(?, location), note = COALESCE(?, note), updated_at = ? WHERE id = ? AND trip_id = ? AND archived_at IS NULL").bind(itemDate ?? null, itemTime ?? null, dayPeriod ?? null, title ?? null, category ?? null, location ?? null, note ?? null, now, id, tripId).run();
      }
    } else if (kind === "packing") {
      const row = await d1.prepare("SELECT id, archived_at FROM trip_packing_items WHERE id = ? AND trip_id = ? LIMIT 1").bind(id, tripId).all<{ id: string; archived_at: string | null }>();
      if (!row.results[0]) throw new HttpError(404, "找不到這個執行李項目。");
      if (body.archived === true) {
        await d1.prepare("UPDATE trip_packing_items SET archived_at = ?, updated_at = ? WHERE id = ? AND trip_id = ?").bind(now, now, id, tripId).run();
      } else if (body.archived === false) {
        if (!row.results[0].archived_at) throw new HttpError(409, "這個執行李項目尚未收起。");
        await d1.prepare("UPDATE trip_packing_items SET archived_at = NULL, updated_at = ? WHERE id = ? AND trip_id = ? AND archived_at IS NOT NULL").bind(now, id, tripId).run();
      } else {
        if (row.results[0].archived_at) throw new HttpError(409, "這個執行李項目已收起，請先還原後再編輯。");
        const checked = body.checked === undefined ? undefined : booleanField(body.checked, "完成狀態");
        const label = body.label === undefined ? undefined : stringField(body.label, "物品名稱", { max: 160 });
        const category = body.category === undefined ? undefined : stringField(body.category, "分類", { max: 40 });
        if (category !== undefined && !PACKING_CATEGORIES.includes(category as (typeof PACKING_CATEGORIES)[number])) throw new HttpError(400, "分類選項不正確。");
        await d1.prepare("UPDATE trip_packing_items SET checked = COALESCE(?, checked), checked_at = CASE WHEN ? = 1 THEN ? ELSE NULL END, label = COALESCE(?, label), category = COALESCE(?, category), updated_at = ? WHERE id = ? AND trip_id = ? AND archived_at IS NULL").bind(checked === undefined ? null : checked ? 1 : 0, checked === undefined ? 0 : checked ? 1 : 0, now, label ?? null, category ?? null, now, id, tripId).run();
      }
    } else if (kind === "lastMinute") {
      const row = await d1.prepare("SELECT id, archived_at FROM trip_last_minute_items WHERE id = ? AND trip_id = ? LIMIT 1").bind(id, tripId).all<{ id: string; archived_at: string | null }>();
      if (!row.results[0]) throw new HttpError(404, "找不到這個臨出發項目。");
      if (body.archived === true) {
        await d1.prepare("UPDATE trip_last_minute_items SET archived_at = ?, updated_at = ? WHERE id = ? AND trip_id = ?").bind(now, now, id, tripId).run();
      } else if (body.archived === false) {
        if (!row.results[0].archived_at) throw new HttpError(409, "這個臨出發項目尚未收起。");
        await d1.prepare("UPDATE trip_last_minute_items SET archived_at = NULL, updated_at = ? WHERE id = ? AND trip_id = ? AND archived_at IS NOT NULL").bind(now, id, tripId).run();
      } else {
        if (row.results[0].archived_at) throw new HttpError(409, "這個臨出發項目已收起，請先還原後再編輯。");
        const checked = body.checked === undefined ? undefined : booleanField(body.checked, "完成狀態");
        const label = body.label === undefined ? undefined : stringField(body.label, "檢查項目", { max: 200 });
        if (checked === undefined && label === undefined) throw new HttpError(400, "請提供要更新的內容。");
        await d1.prepare("UPDATE trip_last_minute_items SET checked = COALESCE(?, checked), checked_at = CASE WHEN ? IS NULL THEN checked_at WHEN ? = 1 THEN ? ELSE NULL END, label = COALESCE(?, label), updated_at = ? WHERE id = ? AND trip_id = ? AND archived_at IS NULL").bind(checked === undefined ? null : checked ? 1 : 0, checked === undefined ? null : checked ? 1 : 0, checked === undefined ? null : checked ? 1 : 0, now, label ?? null, now, id, tripId).run();
      }
    } else if (kind === "shopping") {
      const row = await d1.prepare("SELECT id, section_id, shop, archived_at FROM shopping_items WHERE id = ? AND trip_id = ? LIMIT 1").bind(id, tripId).all<{ id: string; section_id: string | null; shop: string; archived_at: string | null }>();
      if (!row.results[0]) throw new HttpError(404, "找不到這個想買項目。");
      if (body.archived === true) {
        await d1.prepare("UPDATE shopping_items SET archived_at = ?, updated_at = ? WHERE id = ? AND trip_id = ?").bind(now, now, id, tripId).run();
      } else if (body.archived === false) {
        if (!row.results[0].archived_at) throw new HttpError(409, "這個想買項目尚未收起。");
        await d1.prepare("UPDATE shopping_items SET archived_at = NULL, updated_at = ? WHERE id = ? AND trip_id = ? AND archived_at IS NOT NULL").bind(now, id, tripId).run();
      } else {
        if (row.results[0].archived_at) throw new HttpError(409, "這個想買項目已收起，請先還原後再編輯。");
        const name = body.name === undefined ? undefined : stringField(body.name, "想買物品", { max: 160 });
        const link = body.link === undefined ? undefined : safeLink(body.link);
        const quantity = body.quantity === undefined ? undefined : stringField(body.quantity, "數量", { max: 40 });
        const shop = body.shop === undefined ? undefined : stringField(body.shop, "店舖", { max: 120, required: false });
        const note = body.note === undefined ? undefined : stringField(body.note, "備註", { max: 500, required: false });
        const purchased = body.purchased === undefined ? undefined : booleanField(body.purchased, "購買狀態");
        const nextShop = shop === undefined ? row.results[0].shop : shop;
        const currentNormalized = normalizePlaceName(row.results[0].shop);
        const nextNormalized = normalizePlaceName(nextShop);
        const nextSection = !row.results[0].section_id || (shop !== undefined && nextNormalized !== currentNormalized) ? await resolvePlaceSection(d1, tripId, "shopping", nextShop, now) : null;
        const nextSortOrder = nextSection ? await nextItemOrder(d1, "shopping_items", tripId, nextSection.id) : null;
        await d1.prepare("UPDATE shopping_items SET name = COALESCE(?, name), link = COALESCE(?, link), quantity = COALESCE(?, quantity), shop = COALESCE(?, shop), note = COALESCE(?, note), section_id = COALESCE(?, section_id), sort_order = COALESCE(?, sort_order), purchased = COALESCE(?, purchased), updated_at = ? WHERE id = ? AND trip_id = ? AND archived_at IS NULL").bind(name ?? null, link ?? null, quantity ?? null, shop ?? null, note ?? null, nextSection?.id ?? null, nextSortOrder, purchased === undefined ? null : purchased ? 1 : 0, now, id, tripId).run();
      }
    } else {
      const row = await d1.prepare("SELECT id, section_id, shop, archived_at FROM food_items WHERE id = ? AND trip_id = ? LIMIT 1").bind(id, tripId).all<{ id: string; section_id: string | null; shop: string; archived_at: string | null }>();
      if (!row.results[0]) throw new HttpError(404, "找不到這個想食／飲項目。");
      if (body.archived === true) {
        await d1.prepare("UPDATE food_items SET archived_at = ?, updated_at = ? WHERE id = ? AND trip_id = ? AND archived_at IS NULL").bind(now, now, id, tripId).run();
      } else if (body.archived === false) {
        if (!row.results[0].archived_at) throw new HttpError(409, "這個想食／飲項目尚未收起。");
        await d1.prepare("UPDATE food_items SET archived_at = NULL, updated_at = ? WHERE id = ? AND trip_id = ? AND archived_at IS NOT NULL").bind(now, id, tripId).run();
      } else {
        if (row.results[0].archived_at) throw new HttpError(409, "這個想食／飲項目已收起，請先還原後再編輯。");
        const name = body.name === undefined ? undefined : stringField(body.name, "食物／飲品名稱", { max: 160 });
        const shop = body.shop === undefined ? undefined : stringField(body.shop, "便利店／店舖", { max: 120, required: false });
        const link = body.link === undefined ? undefined : safeLink(body.link, "想食／飲連結");
        const note = body.note === undefined ? undefined : stringField(body.note, "備註", { max: 500, required: false });
        const tried = body.tried === undefined ? undefined : booleanField(body.tried, "已食狀態");
        if (name === undefined && shop === undefined && link === undefined && note === undefined && tried === undefined) {
          throw new HttpError(400, "請提供要更新的內容。");
        }
        const currentNormalized = normalizePlaceName(row.results[0].shop);
        const nextNormalized = shop === undefined ? currentNormalized : normalizePlaceName(shop);
        const nextSection = !row.results[0].section_id || (shop !== undefined && nextNormalized !== currentNormalized) ? await resolvePlaceSection(d1, tripId, "food", shop ?? row.results[0].shop, now) : null;
        const nextSortOrder = nextSection ? await nextItemOrder(d1, "food_items", tripId, nextSection.id) : null;
        await d1.prepare("UPDATE food_items SET name = COALESCE(?, name), shop = COALESCE(?, shop), link = COALESCE(?, link), note = COALESCE(?, note), section_id = COALESCE(?, section_id), sort_order = COALESCE(?, sort_order), tried = COALESCE(?, tried), updated_at = ? WHERE id = ? AND trip_id = ? AND archived_at IS NULL").bind(name ?? null, shop ?? null, link ?? null, note ?? null, nextSection?.id ?? null, nextSortOrder, tried === undefined ? null : tried ? 1 : 0, now, id, tripId).run();
      }
    }

    return jsonResponse({ trip: await loadTrip(d1, tripId) });
  } catch (error) {
    return itemErrorResponse(error);
  }
}
