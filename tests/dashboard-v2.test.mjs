import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("dashboard keeps the six top-level views and a neutral travel-notebook theme", async () => {
  const [page, atlas, theme, content] = await Promise.all([read("app/page.tsx"), read("app/FootprintAtlas.tsx"), read("lib/site-theme.ts"), read("lib/japan-content.ts")]);
  for (const label of ["總覽", "即將出發", "過往旅記", "日本足跡", "日本小知識", "想改善"]) assert.match(page, new RegExp(label));
  assert.doesNotMatch(atlas, /@svg-maps\/japan|MapSVG／SVG Maps Japan|CC BY/);
  assert.match(atlas, /JAPAN_CARTOGRAM_CELLS/);
  assert.match(atlas, /atlas-cartogram-cell--/);
  assert.match(atlas, /REGION_DEFINITIONS/);
  assert.match(atlas, /japan-region/);
  assert.match(theme, /travel-notebook/);
  assert.doesNotMatch(theme, /nextDestination|month|tottori-september|鳥取|九月|砂丘/);
  assert.doesNotMatch(page, /準備鳥取旅程|建立鳥取草稿|鳥取秋日旅程|nextDestination|ACTIVE_SITE_THEME\.month/);
  assert.match(page, /onClick=\{\(\) => onNewTrip\(\)\}/);
  assert.match(content, /https:\/\/www\.japan\.travel\/en\/guide\/how-to-best-enjoy-onsen\//);
});

test("v2 source uses D1 APIs and does not add browser storage or hard-delete routes", async () => {
  const [page, items, improvements, db] = await Promise.all([read("app/page.tsx"), read("app/api/trips/[tripId]/items/route.ts"), read("app/api/improvements/route.ts"), read("db/index.ts")]);
  assert.doesNotMatch(page, /localStorage|sessionStorage/);
  assert.doesNotMatch(items, /DELETE\s+FROM/i);
  assert.doesNotMatch(improvements, /DELETE\s+FROM/i);
  assert.match(db, /day_period/);
  assert.match(db, /improvement_notes/);
});
