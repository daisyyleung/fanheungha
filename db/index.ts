import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type AppD1 = D1Database;

const createTableStatements = [
  `CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY NOT NULL,
    pin_salt TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    revoked_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS auth_attempts (
    id TEXT PRIMARY KEY NOT NULL,
    failed_count INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    destinations TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    season TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'plan',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS itinerary_items (
    id TEXT PRIMARY KEY NOT NULL,
    trip_id TEXT NOT NULL REFERENCES trips(id),
    item_date TEXT NOT NULL,
    item_time TEXT NOT NULL DEFAULT '',
    day_period TEXT NOT NULL DEFAULT 'allDay',
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    location TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS improvement_notes (
    id TEXT PRIMARY KEY NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS trip_packing_items (
    id TEXT PRIMARY KEY NOT NULL,
    trip_id TEXT NOT NULL REFERENCES trips(id),
    template_key TEXT NOT NULL,
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    origin TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    optional INTEGER NOT NULL DEFAULT 0,
    checked INTEGER NOT NULL DEFAULT 0,
    checked_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS trip_last_minute_items (
    id TEXT PRIMARY KEY NOT NULL,
    trip_id TEXT NOT NULL REFERENCES trips(id),
    template_key TEXT NOT NULL,
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    checked INTEGER NOT NULL DEFAULT 0,
    checked_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS list_sections (
    id TEXT PRIMARY KEY NOT NULL,
    trip_id TEXT NOT NULL REFERENCES trips(id),
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    normalized_key TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS shopping_items (
    id TEXT PRIMARY KEY NOT NULL,
    trip_id TEXT NOT NULL REFERENCES trips(id),
    name TEXT NOT NULL,
    link TEXT NOT NULL DEFAULT '',
    quantity TEXT NOT NULL DEFAULT '1',
    shop TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    section_id TEXT REFERENCES list_sections(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    purchased INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS food_items (
    id TEXT PRIMARY KEY NOT NULL,
    trip_id TEXT NOT NULL REFERENCES trips(id),
    name TEXT NOT NULL,
    shop TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    section_id TEXT REFERENCES list_sections(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    tried INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TEXT
  )`,
];

const indexStatements = [
  "CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash)",
  "CREATE INDEX IF NOT EXISTS idx_trips_start_date ON trips(start_date)",
  "CREATE INDEX IF NOT EXISTS idx_itinerary_trip_sort ON itinerary_items(trip_id, sort_order)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_itinerary_active_weather_day ON itinerary_items(trip_id, item_date) WHERE category = 'weather' AND archived_at IS NULL",
  "CREATE INDEX IF NOT EXISTS idx_improvement_notes_status ON improvement_notes(status, updated_at)",
  "CREATE INDEX IF NOT EXISTS idx_packing_trip_sort ON trip_packing_items(trip_id, sort_order)",
  "CREATE INDEX IF NOT EXISTS idx_last_minute_trip_sort ON trip_last_minute_items(trip_id, sort_order)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_list_sections_trip_kind_key ON list_sections(trip_id, kind, normalized_key)",
  "CREATE INDEX IF NOT EXISTS idx_list_sections_trip_kind_sort ON list_sections(trip_id, kind, archived_at, sort_order)",
  "CREATE INDEX IF NOT EXISTS idx_shopping_trip_created ON shopping_items(trip_id, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_shopping_section_sort ON shopping_items(trip_id, section_id, sort_order)",
  "CREATE INDEX IF NOT EXISTS idx_food_trip_created ON food_items(trip_id, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_food_section_sort ON food_items(trip_id, section_id, sort_order)",
];

type SchemaColumn = { name: string };

let schemaReadyFor: AppD1 | null = null;
let schemaReadyPromise: Promise<void> | null = null;

export function getD1(): AppD1 {
  const binding = (globalThis as unknown as { __FANHEUNGHA_ENV?: { DB?: AppD1 } }).__FANHEUNGHA_ENV?.DB;
  if (!binding) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable. Add the DB binding from wrangler.jsonc.example.");
  }
  return binding;
}

export async function ensureSchema(): Promise<AppD1> {
  const binding = getD1();
  if (schemaReadyFor === binding) return binding;
  if (!schemaReadyPromise || schemaReadyFor !== binding) {
    schemaReadyPromise = (async () => {
      await binding.batch(createTableStatements.map((statement) => binding.prepare(statement)));

      const [tripColumns, itineraryColumns, shoppingColumns, foodColumns] = await Promise.all([
        binding.prepare("PRAGMA table_info(trips)").all<{ name: string }>(),
        binding.prepare("PRAGMA table_info(itinerary_items)").all<{ name: string }>(),
        binding.prepare("PRAGMA table_info(shopping_items)").all<SchemaColumn>(),
        binding.prepare("PRAGMA table_info(food_items)").all<SchemaColumn>(),
      ]);
      const tripColumnNames = new Set(tripColumns.results.map((column) => column.name));
      const itineraryColumnNames = new Set(itineraryColumns.results.map((column) => column.name));
      const shoppingColumnNames = new Set(shoppingColumns.results.map((column) => column.name));
      const foodColumnNames = new Set(foodColumns.results.map((column) => column.name));
      const upgrades: string[] = [];
      if (!tripColumnNames.has("mode")) {
        upgrades.push("ALTER TABLE trips ADD COLUMN mode TEXT NOT NULL DEFAULT 'plan'");
      }
      if (!itineraryColumnNames.has("category")) {
        upgrades.push("ALTER TABLE itinerary_items ADD COLUMN category TEXT NOT NULL DEFAULT 'other'");
      }
      if (!itineraryColumnNames.has("day_period")) {
        upgrades.push("ALTER TABLE itinerary_items ADD COLUMN day_period TEXT NOT NULL DEFAULT 'allDay'");
      }
      if (!shoppingColumnNames.has("section_id")) {
        upgrades.push("ALTER TABLE shopping_items ADD COLUMN section_id TEXT REFERENCES list_sections(id)");
      }
      if (!shoppingColumnNames.has("sort_order")) {
        upgrades.push("ALTER TABLE shopping_items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
      }
      if (!foodColumnNames.has("section_id")) {
        upgrades.push("ALTER TABLE food_items ADD COLUMN section_id TEXT REFERENCES list_sections(id)");
      }
      if (!foodColumnNames.has("sort_order")) {
        upgrades.push("ALTER TABLE food_items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
      }
      if (upgrades.length > 0) {
        await binding.batch(upgrades.map((statement) => binding.prepare(statement)));
      }

      await binding.batch(indexStatements.map((statement) => binding.prepare(statement)));
      schemaReadyFor = binding;
    })();
  }
  await schemaReadyPromise;
  return binding;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return globalThis.crypto.randomUUID();
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "請提供有效的 JSON 內容");
  }
}

export class HttpError extends Error {
  status: number;
  details?: Record<string, unknown>;

  constructor(status: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function jsonResponse(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    const retryAfterSeconds = error.details?.retryAfterSeconds;
    const headers =
      error.status === 429 &&
      typeof retryAfterSeconds === "number" &&
      Number.isFinite(retryAfterSeconds) &&
      retryAfterSeconds > 0
        ? { "retry-after": String(Math.ceil(retryAfterSeconds)) }
        : undefined;
    return jsonResponse(
      { error: error.message, ...(error.details ? { details: error.details } : {}) },
      error.status,
      headers,
    );
  }
  console.error(error);
  return jsonResponse({ error: "暫時未能完成這項操作，請稍後再試。" }, 500);
}
