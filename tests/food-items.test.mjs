import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("想食／飲 uses additive place sections and a soft-archive contract", async () => {
  const [schema, db, tripData, route, sectionsRoute, migration, journal, snapshot] = await Promise.all([
    read("db/schema.ts"),
    read("db/index.ts"),
    read("lib/trip-data.ts"),
    read("app/api/trips/[tripId]/items/route.ts"),
    read("app/api/trips/[tripId]/sections/route.ts"),
    read("drizzle/0005_place_sections.sql"),
    read("drizzle/meta/_journal.json"),
    read("drizzle/meta/0005_snapshot.json"),
  ]);
  for (const source of [schema, db]) {
    assert.match(source, /food_items/);
    assert.match(source, /idx_food_trip_created/);
    for (const column of ["name", "shop", "link", "note", "tried", "archived_at", "section_id", "sort_order"]) assert.match(source, new RegExp(column));
    assert.match(source, /list_sections/);
  }
  assert.match(tripData, /food: FoodRecord\[\]/);
  assert.match(tripData, /foodSections/);
  assert.match(tripData, /COALESCE\(section\.sort_order/);
  assert.match(tripData, /attachLegacySections/);
  assert.match(tripData, /legacy:\$\{kind\}:/);
  assert.match(route, /value === "food"/);
  assert.match(route, /UPDATE food_items SET archived_at/);
  assert.match(route, /id = \? AND trip_id = \? AND archived_at IS NULL/);
  assert.match(route, /resolvePlaceSection/);
  assert.match(route, /!row\.results\[0\]\.section_id/);
  assert.match(route, /archived === false/);
  assert.match(route, /orderValue/);
  assert.match(route, /category <> 'weather'/);
  assert.match(sectionsRoute, /archived_at/);
  assert.match(sectionsRoute, /分組排序清單必須完整/);
  assert.match(migration, /CREATE TABLE `list_sections`/);
  assert.match(migration, /ALTER TABLE `shopping_items` ADD `section_id`/);
  assert.match(migration, /ALTER TABLE `food_items` ADD `section_id`/);
  assert.equal(JSON.parse(journal).entries.at(-1)?.tag, "0005_place_sections");
  const snapshotJson = JSON.parse(snapshot);
  assert.equal(snapshotJson.prevId, "3cfbb0fe-ef20-4db7-8f92-97e39393744b");
  assert.ok(snapshotJson.tables.list_sections);
  assert.ok(snapshotJson.tables.shopping_items.columns.section_id);
  assert.ok(snapshotJson.tables.food_items.columns.section_id);
  assert.doesNotMatch(`${route}\n${sectionsRoute}\n${migration}`, /DELETE\s+FROM|DROP\s+TABLE/i);
});

test("想食／飲 validates its required name, optional shop and http links", async () => {
  const [route, validation] = await Promise.all([
    read("app/api/trips/[tripId]/items/route.ts"),
    read("lib/validation.ts"),
  ]);
  assert.match(route, /stringField\(body\.name, "食物／飲品名稱", \{ max: 160 \}\)/);
  assert.match(route, /"便利店／店舖", \{ max: 120, required: false \}/);
  assert.match(route, /safeLink\(body\.link, "想食／飲連結"\)/);
  assert.match(route, /booleanField\(body\.tried, "已食狀態"\)/);
  assert.match(route, /請提供要更新的內容/);
  assert.match(validation, /url\.protocol !== "http:" && url\.protocol !== "https:"/);
});

test("plan tabs follow the requested order and journals remain itinerary-only", async () => {
  const page = await read("app/page.tsx");
  const start = page.indexOf("const tabOptions");
  const end = page.indexOf("const navigation", start);
  const options = page.slice(start, end);
  const labels = ["執行李", "臨出發", "想買", "想食／飲", "行程"];
  let cursor = -1;
  for (const label of labels) {
    const next = options.indexOf(`label: "${label}"`);
    assert.ok(next > cursor, `${label} should follow the requested tab order`);
    cursor = next;
  }
  assert.match(page, /useState<Tab>\("packing"\)/);
  assert.match(page, /isJournal \? tabOptions\.filter\(\(option\) => option\.value === "itinerary"\)/);
  assert.match(page, /function FoodPanel/);
  assert.match(page, /便利店／店舖（可選）/);
  assert.match(page, /ArchiveManager/);
  assert.match(page, /MoveButtons/);
  assert.match(page, /kind: "food"/);
});
