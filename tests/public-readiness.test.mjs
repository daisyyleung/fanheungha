import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("empty D1 starts schema-only with no user seed import or DML", async () => {
  const db = await read("db/index.ts");
  assert.doesNotMatch(db, /historical|seed/i);
  assert.match(db, /CREATE TABLE IF NOT EXISTS settings/);
  assert.match(db, /CREATE TABLE IF NOT EXISTS trips/);
  assert.match(db, /archived_at/);
  assert.doesNotMatch(db, /INSERT INTO\s+(trips|itinerary_items|improvement_notes|trip_packing_items|trip_last_minute_items|shopping_items|food_items)/i);
  for (const name of ["0000_wise_thor.sql", "0001_remarkable_thunderball.sql", "0002_wakeful_namora.sql", "0003_unknown_psynapse.sql", "0004_stale_patriot.sql"]) {
    const sql = await read(`drizzle/${name}`);
    const executableSql = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\r\n]*/g, "");
    assert.doesNotMatch(executableSql, /(?:^|;)\s*(INSERT|UPDATE|DELETE)\b/im, `${name} must remain schema-only with no data DML`);
  }
});

test("owner bootstrap requires a one-time secret before PIN work and D1 access", async () => {
  const [route, auth, policy, gate] = await Promise.all([
    read("app/api/auth/setup/route.ts"),
    read("lib/auth.ts"),
    read("lib/auth-policy.ts"),
    read("app/components/PinGate.tsx"),
  ]);
  assert.match(route, /application\/json/);
  assert.match(route, /requestOrigin !== new URL\(request\.url\)\.origin/);
  assert.match(route, /setupSecret/);
  assert.match(route, /confirmPin/);
  assert.ok(route.indexOf("await verifyOwnerSetupSecret") < route.indexOf("const d1 = await ensureSchema"));
  assert.match(auth, /OWNER_SETUP_SECRET_PATTERN = \/\^\[0-9a-f\]\{64\}\$\/i/);
  assert.match(auth, /crypto\.subtle/);
  assert.match(auth, /safeEqual/);
  assert.match(auth, /constraint failed|unique constraint/i);
  assert.match(`${auth}\n${policy}`, /INSERT INTO settings/);
  assert.match(auth, /INSERT INTO auth_attempts/);
  assert.match(auth, /INSERT INTO auth_sessions/);
  assert.doesNotMatch(route, /jsonResponse\(\{[^}]*setupSecret/);
  assert.match(gate, /owner-setup-secret/);
  assert.match(gate, /type="password"/);
  assert.match(gate, /64 位十六進位啟用密碼/);
  assert.doesNotMatch(`${route}\n${auth}\n${gate}`, /localStorage|sessionStorage/);
});

test("dependency manifest and public identity are internally consistent", async () => {
  const [pkgText, lockText] = await Promise.all([read("package.json"), read("package-lock.json")]);
  const pkg = JSON.parse(pkgText);
  const lock = JSON.parse(lockText);
  assert.equal(pkg.name, "fanheungha");
  assert.equal(pkg.private, false);
  assert.equal(pkg.scripts.typecheck, "tsc --noEmit");
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.packages[""].name, pkg.name);
  assert.deepEqual(pkg.dependencies, lock.packages[""].dependencies);
  assert.deepEqual(pkg.devDependencies, lock.packages[""].devDependencies);
  assert.equal(pkg.dependencies["@svg-maps/japan"], undefined);
  assert.equal(lock.packages["node_modules/@svg-maps/japan"], undefined);
});

test("privacy, provenance, licensing, and portable config contracts are present", async () => {
  const [provenance, layout, license, notices, worker, vite, wrangler, vars] = await Promise.all([
    read("SOURCE_PROVENANCE.md"),
    read("app/layout.tsx"),
    read("LICENSE"),
    read("THIRD_PARTY_NOTICES.md"),
    read("worker/index.ts"),
    read("vite.config.ts"),
    read("wrangler.jsonc.example"),
    read(".dev.vars.example"),
  ]);
  assert.match(provenance, /公開 Git root\/tree/);
  assert.match(provenance, /package-lock\.json/);
  assert.match(provenance, /signed annotated/);
  assert.match(provenance, /Only the git archive is deterministic and byte-for-byte reproducible/);
  assert.match(provenance, /creationInfo\.created/);
  assert.match(provenance, /documentNamespace/);
  assert.match(provenance, /另行生成的 SPDX 2\.3/);
  assert.match(provenance, /exact release attachments/);
  assert.match(provenance, /重新生成的 SBOM bytes 不保證/);
  assert.doesNotMatch(provenance, /SBOM[\s\S]{0,100}(?:deterministic|byte-for-byte reproducible)/i);
  assert.match(provenance, /git archive/);
  assert.match(provenance, /SHA256SUMS/);
  assert.match(provenance, /可重現/);
  assert.doesNotMatch(provenance, /[0-9a-f]{40}/i);
  assert.doesNotMatch(provenance, /\/Users\/|github\.com\//i);
  assert.match(license, /MIT License/);
  assert.match(layout, /Licensed under the MIT License/);
  assert.doesNotMatch(layout, /All rights reserved/);
  assert.doesNotMatch(notices, /@svg-maps\/japan|CC-BY-4\.0/);
  assert.match(worker, /OWNER_SETUP_SECRET/);
  assert.match(worker, /__FANHEUNGHA_ENV/);
  const privateHostingPattern = new RegExp(
    `${["\\.", "openai"].join("")}|sites\\s*\\(`,
    "i",
  );
  assert.doesNotMatch(vite, privateHostingPattern);
  assert.match(vite, /binding: "DB"/);
  assert.match(wrangler, /<YOUR_D1_DATABASE_ID>/);
  assert.match(vars, /OWNER_SETUP_SECRET=<64_HEX_OWNER_SETUP_SECRET>/);
});

test("release automation is pinned, read-only in CI, and draft-only for signed tags", async () => {
  const [ci, release, docs, sbom] = await Promise.all([
    read(".github/workflows/ci.yml"),
    read(".github/workflows/release.yml"),
    read("RELEASING.md"),
    read("SBOM.spdx.json"),
  ]);
  for (const workflow of [ci, release]) {
    assert.match(workflow, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
    assert.match(workflow, /actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/);
    assert.match(workflow, /node-version: 22\.13\.0/);
    assert.match(workflow, /persist-credentials: false/);
    assert.doesNotMatch(workflow, /pull_request_target/);
  }
  assert.match(ci, /contents:\s*read/);
  assert.doesNotMatch(ci, /contents:\s*write/);
  assert.match(ci, /push:\s*\n\s+branches:\s*\n\s+- main/);
  assert.match(ci, /pull_request:\s*\n\s+branches:\s*\n\s+- main/);
  assert.match(ci, /--check=all --skip=git-history/);
  assert.match(release, /contents:\s*write/);
  assert.equal(release.match(/GH_TOKEN:\s*\$\{\{ github\.token \}\}/g)?.length, 2);
  assert.match(release, /verification\.verified/);
  assert.match(release, /GITHUB_SHA/);
  assert.match(release, /VERIFIED_TAG_OBJECT_SHA/);
  assert.match(release, /VERIFIED_MAIN_ANCESTRY/);
  assert.match(release, /refs\/remotes\/origin\/main/);
  assert.match(release, /git merge-base --is-ancestor/);
  assert.match(release, /npm sbom --sbom-format=spdx --package-lock-only/);
  assert.match(release, /SHA256SUMS/);
  assert.match(release, /--draft/);
  assert.match(docs, /signed commit/i);
  assert.match(docs, /signed tag/i);
  assert.match(docs, /unsigned history/i);
  assert.match(docs, /only[\s\S]*git archive[\s\S]*deterministic/i);
  assert.match(docs, /creationInfo\.created/);
  assert.match(docs, /exact release attachments/);
  assert.doesNotMatch(docs, /SBOM[\s\S]{0,100}(?:deterministic|byte-for-byte reproducible)/i);
  assert.match(sbom, /"spdxVersion":\s*"SPDX-2\.3"/);
});

test("archive and packing UI invariants remain scoped", async () => {
  const [routes, panel, tripData] = await Promise.all([
    Promise.all([
      read("app/api/trips/route.ts"),
      read("app/api/trips/[tripId]/route.ts"),
      read("app/api/trips/[tripId]/items/route.ts"),
      read("app/api/improvements/route.ts"),
    ]),
    read("app/components/PackingPanel.tsx"),
    read("lib/trip-data.ts"),
  ]);
  const routeText = routes.join("\n");
  assert.doesNotMatch(routeText, /\bDELETE\s+FROM\b/i);
  assert.match(routeText, /archived_at/);
  assert.match(panel, /export function PackingPanel/);
  assert.doesNotMatch(panel, /可選|optional/i);
  assert.match(panel, /archived:\s*true/);
  assert.match(tripData, /archived_at IS NULL/);
});

test("metadata stays generic and the private OG asset is absent", async () => {
  const layout = await read("app/layout.tsx");
  assert.match(layout, /title: "日本旅行手帳"/);
  assert.match(layout, /description: "日本旅程、季節執行李/);
  assert.match(layout, /\/favicon\.svg/);
  assert.doesNotMatch(layout, /headers\(|og-tottori\.png|openGraph|twitter|socialImage/);
  await assert.rejects(access(new URL("../public/og-tottori.png", import.meta.url)));
});

test("security policy and dependency automation are public-safe", async () => {
  const [security, dependabot] = await Promise.all([read("SECURITY.md"), read(".github/dependabot.yml")]);
  assert.match(security, /private vulnerability reporting/i);
  assert.match(security, /do not open a public issue/i);
  assert.match(security, /if GitHub private vulnerability reporting is enabled/i);
  assert.match(security, /If that option is unavailable[\s\S]{0,200}minimal public issue[\s\S]{0,120}private reporting route/i);
  assert.match(security, /Do not include exploit or\s+reproduction details/i);
  assert.doesNotMatch(security, /private contact channel listed in the repository settings/i);
  assert.doesNotMatch(security, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(dependabot, /package-ecosystem: github-actions/);
  assert.match(dependabot, /interval: weekly/);
  assert.match(dependabot, /target-branch: main/);
});
