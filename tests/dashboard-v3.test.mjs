import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  aggregatePrefectureStatuses,
  aggregateRegionStatuses,
  classifyPrefecture,
  getDefaultRegionId,
  PREFECTURE_DEFINITIONS,
  PREFECTURE_IDS,
  REGION_DEFINITIONS,
  REGION_IDS,
  regionStatusLabel,
  splitPlaces,
} from "../lib/region-map.ts";
import { JAPAN_CARTOGRAM, JAPAN_CARTOGRAM_CELLS } from "../lib/japan-cartogram.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("copy contract keeps 日本旅行手帳 as the only product framing", async () => {
  const [page, layout] = await Promise.all([read("app/page.tsx"), read("app/layout.tsx")]);
  const familyIdentityPattern = new RegExp([
    ["媽媽", "的日本旅記"].join(""),
    ["一家", "人"].join(""),
    ["媽媽", "旅程"].join(""),
  ].join("|"));
  assert.match(page, /日本旅行手帳/);
  assert.match(layout, /title: "日本旅行手帳"/);
  assert.doesNotMatch(`${page}\n${layout}`, familyIdentityPattern);
  assert.doesNotMatch(`${page}\n${layout}`, /資料只會在 D1 保存/);
});

test("knowledge ordering puts regional flavours before cuisine categories", async () => {
  const page = await read("app/page.tsx");
  assert.ok(page.indexOf("旅程沿線的地方味道") < page.indexOf("日本美食分類"));
});

test("trip archive contract uses the safe PATCH flow and sibling controls", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /body: JSON\.stringify\(\{ archived: true \}\)/);
  assert.match(page, /即將出發及準備中的清單/);
  assert.match(page, /D1 紀錄會保留，不會刪除/);
  assert.match(page, /function ArchiveTripButton/);
  assert.match(page, /className="trip-card-actions"/);
  assert.doesNotMatch(page, /<button className="trip-card"/);
  assert.match(page, /allowArchive: boolean/);
  assert.match(page, /else content = [^\n]*<Overview[^\n]*onArchive=\{archiveTrip\}/);
});

test("packing items can be removed through the soft-archive flow", async () => {
  const [page, itemRoute] = await Promise.all([
    read("app/page.tsx"),
    read("app/api/trips/[tripId]/items/route.ts"),
  ]);
  assert.match(page, /async function deleteItem\(item: PackingRecord\)/);
  assert.match(page, /kind: "packing", id: item\.id, archived: true/);
  assert.match(page, /刪除執行李項目/);
  assert.match(page, /D1 紀錄仍會保留/);
  assert.match(itemRoute, /UPDATE trip_packing_items SET archived_at/);
  assert.doesNotMatch(itemRoute, /DELETE\s+FROM/i);
});

test("packing list does not label template items as optional", async () => {
  const page = await read("app/page.tsx");
  assert.doesNotMatch(page, /item\.optional\s*&&\s*<em>可選<\/em>/);
});

test("region map contract exposes exactly eight anchored native radio regions", async () => {
  assert.equal(REGION_IDS.length, 8);
  assert.deepEqual(REGION_DEFINITIONS.map((region) => region.label), ["北海道", "東北", "關東", "中部", "近畿", "中國", "四國", "九州／沖繩"]);
  for (const region of REGION_DEFINITIONS) {
    assert.match(region.id, /^[a-z-]+$/);
    assert.ok(region.anchor.x >= 0 && region.anchor.x <= 100);
    assert.ok(region.anchor.y >= 0 && region.anchor.y <= 100);
  }
  const [page, atlas, css] = await Promise.all([read("app/page.tsx"), read("app/FootprintAtlas.tsx"), read("app/globals.css")]);
  assert.match(page, /FootprintAtlas/);
  assert.equal((atlas.match(/name="japan-region"/g) ?? []).length, 1);
  assert.match(atlas, /atlas-cartogram-cell atlas-cartogram-cell--/);
  assert.match(atlas, /JAPAN_CARTOGRAM_CELLS/);
  assert.match(atlas, /data-prefecture-id/);
  assert.doesNotMatch(`${page}\n${atlas}\n${css}`, /@svg-maps\/japan|MapSVG／SVG Maps Japan|CC BY 4\.0/);
  assert.match(css, /\.atlas-cartogram/);
  assert.match(css, /min-width: 760px/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /\.atlas-cartogram-label \{[^}]*white-space: nowrap/);
  assert.match(css, /\.atlas-prefecture-name \{[^}]*white-space: nowrap/);
  assert.match(css, /\.atlas-cartogram-cell \{[^}]*clip-path: var\(--atlas-cell-clip, none\)/);
  assert.doesNotMatch(css, /\.atlas-prefecture-glyph \{[^}]*clip-path:/);
  assert.match(css, /grid-template-areas:\s*\n\s*"plaque plaque"\s*\n\s*"map map"/);
  assert.match(atlas, /atlas-board/);
  assert.match(atlas, /atlas-callout/);
  assert.match(atlas, /選擇日本地區/);
  assert.match(atlas, /已選地區/);
  assert.doesNotMatch(`${page}\n${atlas}\n${css}`, /selected-region-halo|<Image/);
  assert.doesNotMatch(`${page}\n${atlas}\n${css}`, /PLACE_MARKERS|map-markers|map-marker-label/);
});

test("atlas callouts cover every prefecture exactly once with status text", async () => {
  const atlas = await read("app/FootprintAtlas.tsx");
  const labels = REGION_DEFINITIONS.flatMap((region) => region.prefectures);
  assert.equal(labels.length, 47);
  assert.equal(new Set(labels).size, 47);
  for (const label of ["北海道", "青森", "東京", "愛知", "大阪", "鳥取", "香川", "沖繩"]) assert.ok(labels.includes(label));
  assert.match(atlas, /aria-pressed=\{selected\}/);
  assert.match(atlas, /atlas-status-marker/);
  assert.match(atlas, /atlas-prefecture-glyph/);
  assert.match(atlas, /atlas-prefecture-name/);
  assert.match(atlas, /prefectureDisplayLabel/);
  assert.match(atlas, /className="atlas-cartogram-label">\{definition\.label\}/);
  assert.match(atlas, /prefectureStatuses\[prefecture\.id\]\.status/);
  assert.match(atlas, /atlas-cartogram-cell--\$\{status\}/);
  assert.match(atlas, /data-status=\{status\}/);
});

test("custom cartogram has exactly 47 normalized cells and independent trip statuses", () => {
  assert.equal(PREFECTURE_IDS.length, 47);
  assert.equal(PREFECTURE_DEFINITIONS.length, 47);
  assert.equal(JAPAN_CARTOGRAM_CELLS.length, 47);
  assert.equal(Object.keys(JAPAN_CARTOGRAM).length, 47);
  assert.deepEqual(
    [...new Set(JAPAN_CARTOGRAM_CELLS.map((cell) => cell.id))].sort(),
    [...PREFECTURE_IDS].sort(),
  );
  for (const cell of JAPAN_CARTOGRAM_CELLS) {
    assert.equal(JAPAN_CARTOGRAM[cell.id], cell);
    assert.ok(cell.x >= 0 && cell.x <= 100);
    assert.ok(cell.y >= 0 && cell.y <= 100);
    assert.ok(cell.width > 0 && cell.width <= 100);
    assert.ok(cell.height > 0 && cell.height <= 100);
    assert.ok(cell.x + cell.width <= 100);
    assert.ok(cell.y + cell.height <= 100);
  }
  assert.deepEqual(JAPAN_CARTOGRAM_CELLS.filter((cell) => cell.clipPath).map((cell) => cell.id), ["hokkaido"]);

  const cellsTouch = (a, b) => {
    const vertical = (a.x + a.width === b.x || b.x + b.width === a.x)
      && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);
    const horizontal = (a.y + a.height === b.y || b.y + b.height === a.y)
      && Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x);
    return vertical || horizontal;
  };
  for (let index = 0; index < JAPAN_CARTOGRAM_CELLS.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < JAPAN_CARTOGRAM_CELLS.length; otherIndex += 1) {
      const a = JAPAN_CARTOGRAM_CELLS[index];
      const b = JAPAN_CARTOGRAM_CELLS[otherIndex];
      const xOverlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const yOverlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      assert.ok(xOverlap <= 0 || yOverlap <= 0, `${a.id} overlaps ${b.id}`);
    }
  }

  const connectedGroups = [
    PREFECTURE_DEFINITIONS.filter((prefecture) => ["tohoku", "kanto", "chubu", "kinki", "chugoku"].includes(prefecture.regionId)).map((prefecture) => prefecture.id),
    PREFECTURE_DEFINITIONS.filter((prefecture) => prefecture.regionId === "shikoku").map((prefecture) => prefecture.id),
    PREFECTURE_DEFINITIONS.filter((prefecture) => prefecture.regionId === "kyushu-okinawa" && prefecture.id !== "okinawa").map((prefecture) => prefecture.id),
  ];
  for (const group of connectedGroups) {
    const seen = new Set([group[0]]);
    const queue = [group[0]];
    while (queue.length > 0) {
      const id = queue.shift();
      for (const candidate of group) {
        if (!seen.has(candidate) && cellsTouch(JAPAN_CARTOGRAM[id], JAPAN_CARTOGRAM[candidate])) {
          seen.add(candidate);
          queue.push(candidate);
        }
      }
    }
    assert.equal(seen.size, group.length, `${group.filter((id) => !seen.has(id)).join(", ")} are disconnected`);
  }
  assert.equal(classifyPrefecture("函館朝市"), "hokkaido");
  assert.equal(classifyPrefecture("奧入瀨溪流"), "aomori");
  assert.equal(classifyPrefecture("銀山溫泉"), "yamagata");
  assert.equal(classifyPrefecture("新宿早餐"), "tokyo");
  assert.equal(classifyPrefecture("倉吉白壁土藏群"), "tottori");

  const trips = [
    { trip: { mode: "plan", startDate: "2001-06-01", endDate: "2001-06-02", destinations: "東京、鎌倉" }, itinerary: [] },
    { trip: { mode: "plan", startDate: "2099-09-20", endDate: "2099-09-30", destinations: "大阪、東京" }, itinerary: [] },
  ];
  const statuses = aggregatePrefectureStatuses(trips, "2099-08-10");
  assert.equal(statuses.tokyo.status, "both");
  assert.equal(statuses.kanagawa.status, "visited");
  assert.equal(statuses.osaka.status, "next");
  assert.equal(statuses.kochi.status, "unrecorded");
});

test("region map truth derives visited, next, both, and empty from active aggregates", () => {
  const trips = [
    { trip: { mode: "plan", endDate: "2001-06-02", destinations: "東京、鎌倉" }, itinerary: [{ title: "東京站", location: "", note: "" }] },
    { trip: { mode: "journal", endDate: "2001-11-05", destinations: "青森、奧入瀨" }, itinerary: [{ title: "函館山", location: "函館", note: "" }] },
    { trip: { mode: "plan", endDate: "2099-09-30", startDate: "2099-09-20", destinations: "大阪、東京" }, itinerary: [] },
  ];
  const statuses = aggregateRegionStatuses(trips, "2099-08-10");
  assert.equal(statuses.kanto.status, "both");
  assert.equal(statuses.kinki.status, "next");
  assert.equal(statuses.tohoku.status, "visited");
  assert.equal(statuses.hokkaido.status, "visited");
  assert.equal(statuses.shikoku.status, "unrecorded");
  assert.equal(getDefaultRegionId(statuses), "kanto");
  assert.equal(regionStatusLabel("both"), "已去過・下一站");
  assert.deepEqual(splitPlaces("東京、鎌倉 / 鳥取"), ["東京", "鎌倉", "鳥取"]);
});

test("layout contract protects mobile targets, drawer scroll, and connector containment", async () => {
  const css = await read("app/globals.css");
  assert.match(css, /body \{[^}]*font-size: 15px/);
  assert.match(css, /height: 100dvh/);
  assert.match(css, /\.map-connector/);
  assert.match(css, /min-height: 48px/);
  assert.doesNotMatch(css, /(?:body|app-frame)[^{]*\{[^}]*overflow:\s*hidden/);
});

test("CJK canary keeps warm copy and natural wrapping hooks", async () => {
  const [page, atlas, css] = await Promise.all([read("app/page.tsx"), read("app/FootprintAtlas.tsx"), read("app/globals.css")]);
  for (const label of ["即將出發", "過往旅記", "日本足跡", "日本小知識", "想改善", "想食／飲", "已收起項目"]) assert.match(page, new RegExp(label));
  assert.match(atlas, /尚未記錄/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /\.region-option-copy small[^}]*white-space: nowrap/);
  assert.match(css, /\.region-option-copy small[^}]*text-overflow: ellipsis/);
  assert.match(css, /\.region-option-copy small[^}]*white-space: normal/);
  assert.match(css, /\.move-buttons \.text-button[^}]*min-width: 48px/);
  assert.match(css, /body \{ font-size: 15px; \}/);
});

test("D1 and deletion safety keeps browser storage and hard deletes out", async () => {
  const [page, tripRoute, itemRoute, improvementRoute] = await Promise.all([
    read("app/page.tsx"),
    read("app/api/trips/[tripId]/route.ts"),
    read("app/api/trips/[tripId]/items/route.ts"),
    read("app/api/improvements/route.ts"),
  ]);
  assert.doesNotMatch(page, /localStorage|sessionStorage|DELETE\s+FROM/i);
  assert.match(tripRoute, /UPDATE trips SET archived_at/);
  assert.doesNotMatch(`${tripRoute}\n${itemRoute}\n${improvementRoute}`, /DELETE\s+FROM/i);
});
