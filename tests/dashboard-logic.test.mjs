import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildVisitedText,
  getPlaceStatus,
  isoDateInTimeZone,
  isPastTrip,
  isUpcomingTrip,
} from "../lib/dashboard-logic.ts";

const trip = (mode, endDate, destinations, words = []) => ({
  trip: { mode, endDate, destinations },
  itinerary: words.map((title) => ({ title, location: "", note: "" })),
});

test("Hong Kong calendar date, not UTC date, drives dashboard grouping", () => {
  const nearMidnight = new Date("2001-08-09T16:30:00.000Z");
  assert.equal(isoDateInTimeZone(nearMidnight, "Asia/Hong_Kong"), "2001-08-10");
  assert.equal(isPastTrip(trip("plan", "2001-08-09", "東京"), "2001-08-10"), true);
  assert.equal(isUpcomingTrip(trip("plan", "2001-08-10", "大阪"), "2001-08-10"), true);
});

test("only past trips and journals contribute to visited-place detection", () => {
  const trips = [
    trip("plan", "2099-09-30", "東京"),
    trip("journal", "2001-11-05", "青森", ["奧入瀨溪流"]),
  ];
  const visited = buildVisitedText(trips, "2099-08-10");
  assert.doesNotMatch(visited, /東京/);
  assert.match(visited, /青森/);
  assert.equal(getPlaceStatus("東京", ["東京"], visited, "大阪"), "unrecorded");
  assert.equal(getPlaceStatus("大阪", ["大阪"], visited, "大阪"), "next");
  assert.equal(getPlaceStatus("青森", ["青森"], visited, "大阪"), "visited");
});

test("a return visit can be shown as both visited and next", () => {
  assert.equal(getPlaceStatus("大阪", ["大阪"], "大阪", "大阪"), "visited-next");
});

test("date edits are guarded and journal weather exposes its editor", async () => {
  const [route, page, css] = await Promise.all([
    readFile(new URL("../app/api/trips/[tripId]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(route, /item_date < \? OR item_date > \?/);
  assert.match(route, /新日期範圍會排除已寫好的行程/);
  assert.match(page, /function WeatherSummary/);
  assert.match(page, /編輯天氣/);
  assert.doesNotMatch(css, /min-height:\s*(36|40|42)px/);
});
