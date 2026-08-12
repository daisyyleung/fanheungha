import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
      DB: undefined,
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server renders the Japanese travel notebook shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]+lang="zh-Hant"/i);
  assert.match(html, /<title>日本旅行手帳<\/title>/i);
  assert.match(html, /日本旅行手帳/);
  assert.match(html, /日本旅程、季節執行李、想買清單、臨出發檢查與下一站筆記/);
  assert.match(html, /id="main-content"/);
  assert.match(html, /role="status"/);
  assert.match(html, /Copyright © 2026 DaisYY Leung\. Licensed under the MIT License\./);
  const previewPattern = new RegExp([
    "codex-preview",
    ["_", "sites-preview"].join(""),
    "Your site is taking shape",
    "Building your site",
  ].join("|"), "i");
  assert.doesNotMatch(html, previewPattern);
});

test("active app files do not import the starter preview", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  const starterPattern = new RegExp([
    ["_", "sites-preview"].join(""),
    "codex-preview",
    "SkeletonPreview",
  ].join("|"));
  assert.doesNotMatch(page, starterPattern);
  assert.doesNotMatch(layout, /codex-preview|Starter Project/);
});
