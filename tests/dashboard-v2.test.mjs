import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("dashboard keeps the six top-level views and a neutral travel-notebook theme", async () => {
  const [page, summaries, frame, contracts, atlas, theme, content] = await Promise.all([
    read("app/page.tsx"),
    read("app/components/TripSummaries.tsx"),
    read("app/components/AppFrame.tsx"),
    read("app/components/contracts.ts"),
    read("app/FootprintAtlas.tsx"),
    read("lib/site-theme.ts"),
    read("lib/japan-content.ts"),
  ]);
  const dashboard = `${page}\n${summaries}\n${frame}\n${contracts}`;
  for (const label of ["總覽", "即將出發", "過往旅記", "日本足跡", "日本小知識", "想改善"]) assert.match(dashboard, new RegExp(label));
  assert.doesNotMatch(atlas, /@svg-maps\/japan|MapSVG／SVG Maps Japan|CC BY/);
  assert.match(atlas, /JAPAN_CARTOGRAM_CELLS/);
  assert.match(atlas, /atlas-cartogram-cell--/);
  assert.match(atlas, /REGION_DEFINITIONS/);
  assert.match(atlas, /japan-region/);
  assert.match(theme, /travel-notebook/);
  assert.doesNotMatch(theme, /nextDestination|month|tottori-september|鳥取|九月|砂丘/);
  assert.doesNotMatch(dashboard, /準備鳥取旅程|建立鳥取草稿|鳥取秋日旅程|nextDestination|ACTIVE_SITE_THEME\.month/);
  assert.match(summaries, /onClick=\{\(\) => onNewTrip\(\)\}/);
  assert.match(content, /https:\/\/www\.japan\.travel\/en\/guide\/how-to-best-enjoy-onsen\//);
});

test("v2 source uses D1 APIs and does not add browser storage or hard-delete routes", async () => {
  const componentFiles = [
    "app/page.tsx",
    "app/components/AppFrame.tsx",
    "app/components/PinGate.tsx",
    "app/components/TripForm.tsx",
    "app/components/TripSummaries.tsx",
    "app/components/KnowledgeView.tsx",
    "app/components/ImprovementsView.tsx",
    "app/components/ArchiveManager.tsx",
    "app/components/ItineraryPanel.tsx",
    "app/components/PackingPanel.tsx",
    "app/components/ShoppingPanel.tsx",
    "app/components/FoodPanel.tsx",
    "app/components/LastMinutePanel.tsx",
    "app/components/TripDetail.tsx",
  ];
  const [client, items, improvements, db] = await Promise.all([
    Promise.all(componentFiles.map(read)).then((sources) => sources.join("\n")),
    read("app/api/trips/[tripId]/items/route.ts"),
    read("app/api/improvements/route.ts"),
    read("db/index.ts"),
  ]);
  assert.doesNotMatch(client, /localStorage|sessionStorage/);
  assert.doesNotMatch(items, /DELETE\s+FROM/i);
  assert.doesNotMatch(improvements, /DELETE\s+FROM/i);
  assert.match(db, /day_period/);
  assert.match(db, /improvement_notes/);
});
