import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

const createdAt = () => text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);
const updatedAt = () => text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`);
const archivedAt = () => text("archived_at");

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  pinSalt: text("pin_salt").notNull(),
  pinHash: text("pin_hash").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    createdAt: createdAt(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("idx_auth_sessions_token_hash").on(table.tokenHash),
  }),
);

export const authAttempts = sqliteTable("auth_attempts", {
  id: text("id").primaryKey(),
  failedCount: integer("failed_count").notNull().default(0),
  lockedUntil: text("locked_until"),
  updatedAt: updatedAt(),
});

export const trips = sqliteTable(
  "trips",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    destinations: text("destinations").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    season: text("season").notNull(),
    mode: text("mode").notNull().default("plan"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: archivedAt(),
  },
  (table) => ({
    activeStartIdx: index("idx_trips_start_date").on(table.startDate),
  }),
);

export const itineraryItems = sqliteTable(
  "itinerary_items",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id").notNull().references(() => trips.id),
    itemDate: text("item_date").notNull(),
    itemTime: text("item_time").notNull().default(""),
    dayPeriod: text("day_period").notNull().default("allDay"),
    title: text("title").notNull(),
    category: text("category").notNull().default("other"),
    location: text("location").notNull().default(""),
    note: text("note").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: archivedAt(),
  },
  (table) => ({
    tripSortIdx: index("idx_itinerary_trip_sort").on(table.tripId, table.sortOrder),
    activeWeatherDayIdx: uniqueIndex("idx_itinerary_active_weather_day")
      .on(table.tripId, table.itemDate)
      .where(sql`category = 'weather' AND archived_at IS NULL`),
  }),
);

export const improvementNotes = sqliteTable(
  "improvement_notes",
  {
    id: text("id").primaryKey(),
    body: text("body").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: archivedAt(),
  },
  (table) => ({
    activeStatusIdx: index("idx_improvement_notes_status").on(table.status, table.updatedAt),
  }),
);

export const tripPackingItems = sqliteTable(
  "trip_packing_items",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id").notNull().references(() => trips.id),
    templateKey: text("template_key").notNull(),
    label: text("label").notNull(),
    category: text("category").notNull(),
    origin: text("origin").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    optional: integer("optional", { mode: "boolean" }).notNull().default(false),
    checked: integer("checked", { mode: "boolean" }).notNull().default(false),
    checkedAt: text("checked_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: archivedAt(),
  },
  (table) => ({
    tripSortIdx: index("idx_packing_trip_sort").on(table.tripId, table.sortOrder),
  }),
);

export const tripLastMinuteItems = sqliteTable(
  "trip_last_minute_items",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id").notNull().references(() => trips.id),
    templateKey: text("template_key").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    checked: integer("checked", { mode: "boolean" }).notNull().default(false),
    checkedAt: text("checked_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: archivedAt(),
  },
  (table) => ({
    tripSortIdx: index("idx_last_minute_trip_sort").on(table.tripId, table.sortOrder),
  }),
);

export const listSections = sqliteTable(
  "list_sections",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id").notNull().references(() => trips.id),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    normalizedKey: text("normalized_key").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: archivedAt(),
  },
  (table) => ({
    tripKindKeyIdx: uniqueIndex("idx_list_sections_trip_kind_key").on(table.tripId, table.kind, table.normalizedKey),
    activeSortIdx: index("idx_list_sections_trip_kind_sort").on(table.tripId, table.kind, table.archivedAt, table.sortOrder),
  }),
);

export const shoppingItems = sqliteTable(
  "shopping_items",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id").notNull().references(() => trips.id),
    name: text("name").notNull(),
    link: text("link").notNull().default(""),
    quantity: text("quantity").notNull().default("1"),
    shop: text("shop").notNull().default(""),
    note: text("note").notNull().default(""),
    sectionId: text("section_id").references(() => listSections.id),
    sortOrder: integer("sort_order").notNull().default(0),
    purchased: integer("purchased", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: archivedAt(),
  },
  (table) => ({
    tripCreatedIdx: index("idx_shopping_trip_created").on(table.tripId, table.createdAt),
    sectionSortIdx: index("idx_shopping_section_sort").on(table.tripId, table.sectionId, table.sortOrder),
  }),
);

export const foodItems = sqliteTable(
  "food_items",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id").notNull().references(() => trips.id),
    name: text("name").notNull(),
    shop: text("shop").notNull().default(""),
    link: text("link").notNull().default(""),
    note: text("note").notNull().default(""),
    sectionId: text("section_id").references(() => listSections.id),
    sortOrder: integer("sort_order").notNull().default(0),
    tried: integer("tried", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: archivedAt(),
  },
  (table) => ({
    tripCreatedIdx: index("idx_food_trip_created").on(table.tripId, table.createdAt),
    sectionSortIdx: index("idx_food_section_sort").on(table.tripId, table.sectionId, table.sortOrder),
  }),
);
