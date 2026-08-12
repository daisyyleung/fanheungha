import type { AppD1 } from "@/db";
import type { DayPeriod, ItineraryCategory, TripMode } from "@/lib/trip-log";
import { normalizePlaceName } from "@/lib/validation";

export type TripRecord = {
  id: string;
  title: string;
  destinations: string;
  startDate: string;
  endDate: string;
  season: string;
  mode: TripMode;
  createdAt: string;
  updatedAt: string;
};

export type ItineraryRecord = {
  id: string;
  itemDate: string;
  itemTime: string;
  dayPeriod: DayPeriod;
  title: string;
  category: ItineraryCategory;
  location: string;
  note: string;
  sortOrder: number;
};

export type PackingRecord = {
  id: string;
  templateKey: string;
  label: string;
  category: string;
  origin: string;
  sortOrder: number;
  optional: boolean;
  checked: boolean;
  checkedAt: string | null;
};

export type LastMinuteRecord = {
  id: string;
  templateKey: string;
  label: string;
  sortOrder: number;
  checked: boolean;
  checkedAt: string | null;
};

export type ListSectionKind = "shopping" | "food";

export type ListSectionRecord = {
  id: string;
  kind: ListSectionKind;
  name: string;
  normalizedKey: string;
  sortOrder: number;
};

export type ShoppingRecord = {
  id: string;
  name: string;
  link: string;
  quantity: string;
  shop: string;
  note: string;
  purchased: boolean;
  sectionId: string | null;
  sortOrder: number;
};

export type FoodRecord = {
  id: string;
  name: string;
  shop: string;
  link: string;
  note: string;
  tried: boolean;
  sectionId: string | null;
  sortOrder: number;
};

export type TripAggregate = {
  trip: TripRecord;
  itinerary: ItineraryRecord[];
  packing: PackingRecord[];
  lastMinute: LastMinuteRecord[];
  shoppingSections: ListSectionRecord[];
  foodSections: ListSectionRecord[];
  shopping: ShoppingRecord[];
  food: FoodRecord[];
};

export type ArchivedTripAggregate = Pick<TripAggregate, "trip" | "itinerary" | "packing" | "lastMinute" | "shopping" | "food"> & {
  shoppingSections: ListSectionRecord[];
  foodSections: ListSectionRecord[];
};

type TripRow = {
  id: string;
  title: string;
  destinations: string;
  start_date: string;
  end_date: string;
  season: string;
  mode: string;
  created_at: string;
  updated_at: string;
};

function mapTrip(row: TripRow): TripRecord {
  return {
    id: row.id,
    title: row.title,
    destinations: row.destinations,
    startDate: row.start_date,
    endDate: row.end_date,
    season: row.season,
    mode: row.mode === "journal" ? "journal" : "plan",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItinerary(row: Record<string, string | number>): ItineraryRecord {
  return {
    id: String(row.id),
    itemDate: String(row.item_date),
    itemTime: String(row.item_time ?? ""),
    dayPeriod: (row.day_period === "morning" || row.day_period === "afternoon" || row.day_period === "evening" ? row.day_period : "allDay") as DayPeriod,
    title: String(row.title),
    category: (row.category === "weather" || row.category === "transport" || row.category === "stay" || row.category === "meal" || row.category === "sightseeing" || row.category === "shopping" || row.category === "logistics" || row.category === "highlight" ? row.category : "other") as ItineraryCategory,
    location: String(row.location ?? ""),
    note: String(row.note ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapPacking(row: Record<string, string | number>): PackingRecord {
  return {
    id: String(row.id),
    templateKey: String(row.template_key),
    label: String(row.label),
    category: String(row.category),
    origin: String(row.origin),
    sortOrder: Number(row.sort_order ?? 0),
    optional: Boolean(Number(row.optional ?? 0)),
    checked: Boolean(Number(row.checked ?? 0)),
    checkedAt: row.checked_at ? String(row.checked_at) : null,
  };
}

function mapLastMinute(row: Record<string, string | number>): LastMinuteRecord {
  return {
    id: String(row.id),
    templateKey: String(row.template_key),
    label: String(row.label),
    sortOrder: Number(row.sort_order ?? 0),
    checked: Boolean(Number(row.checked ?? 0)),
    checkedAt: row.checked_at ? String(row.checked_at) : null,
  };
}

function mapSection(row: Record<string, string | number>): ListSectionRecord {
  return {
    id: String(row.id),
    kind: row.kind === "food" ? "food" : "shopping",
    name: String(row.name),
    normalizedKey: String(row.normalized_key),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapShopping(row: Record<string, string | number>): ShoppingRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    link: String(row.link ?? ""),
    quantity: String(row.quantity ?? "1"),
    shop: String(row.shop ?? ""),
    note: String(row.note ?? ""),
    purchased: Boolean(Number(row.purchased ?? 0)),
    sectionId: row.section_id ? String(row.section_id) : null,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapFood(row: Record<string, string | number>): FoodRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    shop: String(row.shop ?? ""),
    link: String(row.link ?? ""),
    note: String(row.note ?? ""),
    tried: Boolean(Number(row.tried ?? 0)),
    sectionId: row.section_id ? String(row.section_id) : null,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function attachLegacySections<T extends ShoppingRecord | FoodRecord>(
  kind: ListSectionKind,
  sections: ListSectionRecord[],
  items: T[],
): ListSectionRecord[] {
  const legacySections = new Map<string, ListSectionRecord>();
  for (const item of items) {
    if (item.sectionId) continue;
    const normalizedKey = normalizePlaceName(item.shop);
    const sectionId = `legacy:${kind}:${normalizedKey}`;
    item.sectionId = sectionId;
    if (!legacySections.has(sectionId)) {
      legacySections.set(sectionId, {
        id: sectionId,
        kind,
        name: `${item.shop.trim() || "店舖待定"}（待整理）`,
        normalizedKey,
        sortOrder: sections.length + legacySections.size,
      });
    }
  }
  return [...sections, ...legacySections.values()];
}

async function loadTripBase(d1: AppD1, tripId: string, archived: boolean): Promise<ArchivedTripAggregate | null> {
  const tripResult = await d1.prepare("SELECT id, title, destinations, start_date, end_date, season, mode, created_at, updated_at FROM trips WHERE id = ? AND archived_at IS NULL LIMIT 1").bind(tripId).all<TripRow>();
  const row = tripResult.results[0];
  if (!row) return null;

  const itemWhere = archived ? "archived_at IS NOT NULL" : "archived_at IS NULL";
  const sectionWhere = archived ? "archived_at IS NOT NULL" : "archived_at IS NULL";

  const [itinerary, packing, lastMinute, shoppingSections, foodSections, shopping, food] = await Promise.all([
    d1.prepare(`SELECT id, item_date, item_time, day_period, title, category, location, note, sort_order FROM itinerary_items WHERE trip_id = ? AND ${itemWhere} ORDER BY sort_order, item_date, item_time, id`).bind(tripId).all(),
    d1.prepare(`SELECT id, template_key, label, category, origin, sort_order, optional, checked, checked_at FROM trip_packing_items WHERE trip_id = ? AND ${itemWhere} ORDER BY sort_order, id`).bind(tripId).all(),
    d1.prepare(`SELECT id, template_key, label, sort_order, checked, checked_at FROM trip_last_minute_items WHERE trip_id = ? AND ${itemWhere} ORDER BY sort_order, id`).bind(tripId).all(),
    d1.prepare(`SELECT id, kind, name, normalized_key, sort_order FROM list_sections WHERE trip_id = ? AND kind = 'shopping' AND ${sectionWhere} ORDER BY sort_order, id`).bind(tripId).all(),
    d1.prepare(`SELECT id, kind, name, normalized_key, sort_order FROM list_sections WHERE trip_id = ? AND kind = 'food' AND ${sectionWhere} ORDER BY sort_order, id`).bind(tripId).all(),
    d1.prepare(`SELECT s.id, s.name, s.link, s.quantity, s.shop, s.note, s.purchased, s.section_id, s.sort_order FROM shopping_items s LEFT JOIN list_sections section ON section.id = s.section_id WHERE s.trip_id = ? AND s.${itemWhere} ${archived ? "" : "AND (s.section_id IS NULL OR section.archived_at IS NULL)"} ORDER BY COALESCE(section.sort_order, 2147483647), s.sort_order, s.created_at, s.id`).bind(tripId).all(),
    d1.prepare(`SELECT f.id, f.name, f.shop, f.link, f.note, f.tried, f.section_id, f.sort_order FROM food_items f LEFT JOIN list_sections section ON section.id = f.section_id WHERE f.trip_id = ? AND f.${itemWhere} ${archived ? "" : "AND (f.section_id IS NULL OR section.archived_at IS NULL)"} ORDER BY COALESCE(section.sort_order, 2147483647), f.sort_order, f.created_at, f.id`).bind(tripId).all(),
  ]);

  const mappedShoppingSections = (shoppingSections.results as Record<string, string | number>[]).map(mapSection);
  const mappedFoodSections = (foodSections.results as Record<string, string | number>[]).map(mapSection);
  const mappedShopping = (shopping.results as Record<string, string | number>[]).map(mapShopping);
  const mappedFood = (food.results as Record<string, string | number>[]).map(mapFood);

  return {
    trip: mapTrip(row),
    itinerary: (itinerary.results as Record<string, string | number>[]).map(mapItinerary),
    packing: (packing.results as Record<string, string | number>[]).map(mapPacking),
    lastMinute: (lastMinute.results as Record<string, string | number>[]).map(mapLastMinute),
    shoppingSections: archived ? mappedShoppingSections : attachLegacySections("shopping", mappedShoppingSections, mappedShopping),
    foodSections: archived ? mappedFoodSections : attachLegacySections("food", mappedFoodSections, mappedFood),
    shopping: mappedShopping,
    food: mappedFood,
  };
}

export async function loadTrip(d1: AppD1, tripId: string): Promise<TripAggregate | null> {
  return loadTripBase(d1, tripId, false) as Promise<TripAggregate | null>;
}

export async function loadArchivedTrip(d1: AppD1, tripId: string): Promise<ArchivedTripAggregate | null> {
  return loadTripBase(d1, tripId, true);
}

export async function loadTrips(d1: AppD1): Promise<TripAggregate[]> {
  const result = await d1.prepare("SELECT id, title, destinations, start_date, end_date, season, mode, created_at, updated_at FROM trips WHERE archived_at IS NULL ORDER BY start_date DESC, created_at DESC, id DESC").all<TripRow>();
  const aggregates = await Promise.all(result.results.map((row: TripRow) => loadTrip(d1, row.id)));
  return aggregates.filter((aggregate: TripAggregate | null): aggregate is TripAggregate => Boolean(aggregate));
}
