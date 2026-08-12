#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PRIVATE_MARKERS = [
  [".", "openai"].join(""),
  ["_", "sites", "-preview"].join(""),
  ["site", "creator"].join("-"),
  ["sites", "vite", "plugin"].join("-"),
  ["chatgpt", "auth"].join("-"),
  ["historical", "trip", "data"].join("-"),
  ["__", "JAPAN", "_MAP_ENV"].join(""),
  ["japan", "_map"].join(""),
  ["loop", "forge"].join(""),
];
const PRIVATE_CONTENT_PATTERN = new RegExp(PRIVATE_MARKERS.map(escapeRegExp).join("|"), "i");
const MACHINE_HOME_PATTERN = new RegExp(["", "Users", "[^/\\s]+", ""].join("/"), "i");
const FAMILY_IDENTITY_PATTERN = new RegExp([
  ["媽媽", "的日本旅記"].join(""),
  ["一家", "人"].join(""),
  ["媽媽", "旅程"].join(""),
].join("|"), "i");

const DIRECT_DEPENDENCY_LICENSES = {
  "drizzle-orm": "Apache-2.0",
  next: "MIT",
  react: "MIT",
  "react-dom": "MIT",
  "react-loading-skeleton": "MIT",
  "@cloudflare/vite-plugin": "MIT",
  "@tailwindcss/postcss": "MIT",
  "@types/node": "MIT",
  "@types/react": "MIT",
  "@types/react-dom": "MIT",
  "@vitejs/plugin-react": "MIT",
  "@vitejs/plugin-rsc": "MIT",
  "drizzle-kit": "MIT",
  eslint: "MIT",
  "eslint-config-next": "MIT",
  "react-server-dom-webpack": "MIT",
  tailwindcss: "MIT",
  typescript: "Apache-2.0",
  vinext: "MIT",
  vite: "MIT",
  wrangler: "MIT OR Apache-2.0",
};

const ALL_CHECKS = [
  "dependency-manifest",
  "source-provenance-truth",
  "privacy",
  "licensing",
  "assets",
  "portable-config",
  "documentation",
  "security",
  "security-policy",
  "empty-d1",
  "archive",
  "packing",
  "migrations",
  "sbom",
  "workflows",
  "release-hardening",
  "sensitive-content",
  "git-history",
];

function fail(message) {
  throw new Error(message);
}

function read(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

function maybeRead(path) {
  const absolute = join(ROOT, path);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
}

function listFiles(directory = ROOT) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".next" || entry.name === ".vinext" || entry.name === ".wrangler") continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(absolute));
    else if (entry.isFile()) result.push(relative(ROOT, absolute));
  }
  return result;
}

function parseJson(path) {
  try {
    return JSON.parse(read(path));
  } catch (error) {
    fail(`${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertDeepEqual(left, right, label) {
  assert(JSON.stringify(left) === JSON.stringify(right), `${label} differs`);
}

function checkDependencyManifest() {
  const pkg = parseJson("package.json");
  const lock = parseJson("package-lock.json");
  const root = lock.packages?.[""];
  assert(pkg.name === "fanheungha", "package name must be fanheungha");
  assert(pkg.private === false, "public package must not be marked private");
  assert(pkg.scripts?.typecheck === "tsc --noEmit", "typecheck script must be exact");
  assert(root?.name === pkg.name, "lockfile root name must match package name");
  assert(root?.version === pkg.version, "lockfile root version must match package version");
  assertDeepEqual(pkg.dependencies ?? {}, root?.dependencies ?? {}, "runtime dependencies");
  assertDeepEqual(pkg.devDependencies ?? {}, root?.devDependencies ?? {}, "dev dependencies");
  assertDeepEqual(pkg.engines ?? {}, root?.engines ?? {}, "engine requirements");
  for (const name of [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]) {
    assert(lock.packages?.[`node_modules/${name}`], `lockfile is missing direct dependency ${name}`);
  }
}

function checkSourceProvenance() {
  const text = read("SOURCE_PROVENANCE.md");
  for (const pattern of [
    /公開.*(?:Git root|root\/tree|tree)/i,
    /package-lock\.json/i,
    /signed annotated/i,
    /only the git archive is deterministic and byte-for-byte reproducible/i,
    /gzip -n/i,
    /npm sbom/i,
    /SHA256SUMS/i,
    /排除|excluded/i,
    /可重現|reproduc/i,
    /(?:SBOM|npm sbom)[\s\S]{0,180}(?:timestamp|namespace|時間戳|命名空間)/i,
    /(?:separately generated|另行生成|獨立生成)[\s\S]{0,100}SPDX 2\.3/i,
    /SHA256SUMS[\s\S]{0,160}(?:exact release attachments|發佈附件)/i,
    /(?:regenerated|re-generated|重新生成)[\s\S]{0,180}(?:not promised to match|not guaranteed to match|不保證.*相同)/i,
  ]) assert(pattern.test(text), `source provenance is missing ${pattern}`);
  assert(!/\/Users\/|[A-Za-z]:\\|github\.com\//i.test(text), "source provenance must not expose machine/private paths or URLs");
  assert(!/[0-9a-f]{40}/i.test(text), "source provenance must not publish a commit SHA");
  assert(!/(?:不可由外部取得或重現|not externally reproducible|source unavailable|private.*history)/i.test(text), "source provenance must not rely on unavailable source claims");
  assert(!/(?:SBOM|SHA256SUMS)[\s\S]{0,100}(?:deterministic|byte-for-byte reproducible|逐字節可重現)/i.test(text), "source provenance must not promise deterministic SBOM or checksum bytes");
  assert(!/OWNER_SETUP_SECRET\s*[:=]\s*[0-9a-f]{64}/i.test(text), "source provenance must not contain a secret");
}

function checkPrivacy() {
  const forbiddenPaths = [
    [".", "openai"].join(""),
    ["app", ["_", "sites", "-preview"].join("")].join("/"),
    ["app", ["chatgpt", "auth"].join("-") + ".ts"].join("/"),
    ["build", ["sites", "vite", "plugin"].join("-") + ".ts"].join("/"),
    ["lib", ["historical", "trip", "data"].join("-") + ".ts"].join("/"),
    ["tests", ["historical", "trip"].join("-") + ".test.mjs"].join("/"),
    "loop",
    "examples",
    "public/og.png",
    "public/file.svg",
    "public/globe.svg",
    "public/window.svg",
    "public/japan-prefectures-cc0.svg",
  ];
  const files = listFiles();
  for (const path of forbiddenPaths) assert(!existsSync(join(ROOT, path)), `forbidden public path exists: ${path}`);
  const forbiddenContent = [
    MACHINE_HOME_PATTERN,
    PRIVATE_CONTENT_PATTERN,
    /OWNER_SETUP_SECRET\s*[:=]\s*[0-9a-f]{64}/i,
  ];
  for (const path of files) {
    if (/\.(png|jpg|jpeg|gif|ico|woff2?)$/i.test(path)) continue;
    const text = maybeRead(path);
    for (const pattern of forbiddenContent) assert(!pattern.test(text), `private content marker ${pattern} found in ${path}`);
  }
  assert(!files.some((path) => path.startsWith(".git/")), "private Git metadata must not be scanned into the source payload");
}

function checkLicensing() {
  const license = read("LICENSE");
  const notices = read("THIRD_PARTY_NOTICES.md");
  const layout = read("app/layout.tsx");
  assert(/^MIT License/m.test(license), "LICENSE must be MIT");
  assert(/Copyright \(c\) 2026 DaisYY Leung/.test(license), "LICENSE copyright is missing");
  assert(/Licensed under the MIT License\./.test(layout), "root layout must carry the MIT-compatible notice");
  assert(!/All rights reserved/i.test(layout), "root layout must not contradict MIT with All rights reserved");
  for (const [name, licenseName] of Object.entries(DIRECT_DEPENDENCY_LICENSES)) {
    assert(notices.includes(`\`${name}\``), `third-party notice missing ${name}`);
    assert(notices.includes(licenseName), `third-party notice missing license for ${name}`);
  }
}

function checkAssets() {
  const path = join(ROOT, "public/og-tottori.png");
  assert(!existsSync(path), "household OG asset must not be present");
  const layout = read("app/layout.tsx");
  assert(!/og-tottori\.png|openGraph|twitter|socialImage|next\/headers/i.test(layout), "layout must not publish host-derived social image metadata");
  assert(existsSync(join(ROOT, "public/favicon.svg")), "public/favicon.svg is required");
}

function checkPortableConfig() {
  const vite = read("vite.config.ts");
  const worker = read("worker/index.ts");
  const types = read("lib/cloudflare-types.d.ts");
  const wrangler = read("wrangler.jsonc.example");
  const vars = read(".dev.vars.example");
  assert(!PRIVATE_CONTENT_PATTERN.test(vite) && !/sites\s*\(/i.test(vite), "portable Vite config must not import private hosting plugins");
  assert(vite.includes('binding: "DB"'), "Vite config must bind DB");
  assert(vite.includes("D1_DATABASE_ID"), "Vite config must allow a local D1 placeholder");
  assert(worker.includes("OWNER_SETUP_SECRET"), "Worker environment must include OWNER_SETUP_SECRET");
  assert(worker.includes("__FANHEUNGHA_ENV"), "Worker must expose only the public runtime global");
  assert(!PRIVATE_CONTENT_PATTERN.test(worker), "private runtime global must be removed");
  assert(types.length > 0, "Cloudflare type declarations are required");
  assert(wrangler.includes('"DB"') && wrangler.includes("<YOUR_D1_DATABASE_ID>"), "wrangler example must provide a DB placeholder");
  assert(vars.includes("OWNER_SETUP_SECRET=<64_HEX_OWNER_SETUP_SECRET>"), "dev vars example must be a placeholder");
  assert(!/OWNER_SETUP_SECRET\s*=\s*[0-9a-f]{64}/i.test(`${wrangler}\n${vars}`), "portable examples must not contain a real secret");
}

function checkDocumentation() {
  const readme = read("README.md");
  for (const section of ["Fresh clone", "D1", "部署", "備份", "還原", "更新流程", "Recovery", "疑難排解"]) {
    assert(readme.includes(section), `README is missing section ${section}`);
  }
  assert(readme.includes("openssl rand -hex 32"), "README must document safe owner-secret generation");
  assert(readme.includes("<YOUR_D1_DATABASE_ID>"), "README must use a D1 placeholder");
  assert(readme.includes("<YOUR_PUBLIC_REPOSITORY_URL>"), "README must use a repository placeholder");
  assert(!/OWNER_SETUP_SECRET\s*=\s*[0-9a-f]{64}/i.test(readme), "README must not contain a secret");
  assert(!MACHINE_HOME_PATTERN.test(readme), "README must not contain a machine path");
}

function checkSbom() {
  assert(existsSync(join(ROOT, "SBOM.spdx.json")), "commit-ready SBOM.spdx.json is required");
  const sbom = parseJson("SBOM.spdx.json");
  assert(sbom.spdxVersion === "SPDX-2.3", "committed SBOM must use SPDX 2.3");
  assert(sbom.name === "fanheungha@0.1.0", "committed SBOM must describe the package version");
  assert(Array.isArray(sbom.packages) && sbom.packages.length > 0, "committed SBOM must contain packages");
  const text = read("SBOM.spdx.json");
  for (const pattern of [MACHINE_HOME_PATTERN, PRIVATE_CONTENT_PATTERN, /OWNER_SETUP_SECRET\s*[:=]\s*[0-9a-f]{64}/i, /(?:ghp_|github_pat_|AKIA)[A-Za-z0-9_\-]{16,}/i]) {
    assert(!pattern.test(text), "committed SBOM contains a sensitive marker");
  }
}

function checkWorkflows() {
  const ci = read(".github/workflows/ci.yml");
  const release = read(".github/workflows/release.yml");
  const dependabot = read(".github/dependabot.yml");
  const checkoutPin = "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803";
  const setupPin = "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020";
  for (const [name, workflow] of [["CI", ci], ["release", release]]) {
    assert(workflow.includes(checkoutPin), `${name} must pin checkout by full SHA`);
    assert(workflow.includes(setupPin), `${name} must pin setup-node by full SHA`);
    assert(workflow.includes("node-version: 22.13.0"), `${name} must use Node 22.13.0`);
    assert(workflow.includes("persist-credentials: false"), `${name} must not persist checkout credentials`);
    assert(!/pull_request_target/i.test(workflow), `${name} must not use pull_request_target`);
  }
  assert(/permissions:\s*\n\s+contents:\s*read/.test(ci), "CI must grant contents: read only");
  assert(/push:\s*\n\s+branches:\s*\n\s+- main/.test(ci), "CI must trigger pushes to main");
  assert(/pull_request:\s*\n\s+branches:\s*\n\s+- main/.test(ci), "CI must trigger pull requests to main");
  assert(/npm run db:generate/.test(ci) && /git diff --exit-code -- drizzle/.test(ci), "CI must reject unexpected Drizzle changes");
  for (const command of ["npm ci", "npm run typecheck", "npm run lint", "npm run build", "npm test", "node scripts/validate-public-repo.mjs --check=all", "node scripts/validate-public-repo.mjs --check=all --skip=git-history"]) {
    assert(ci.includes(command), `CI is missing ${command}`);
  }
  assert(/permissions:\s*\n\s+contents:\s*write/.test(release), "release workflow must grant contents: write");
  assert(/GH_TOKEN:\s*\$\{\{ github\.token \}\}/.test(release), "release workflow must use only the GitHub token placeholder");
  assert((release.match(/GH_TOKEN:\s*\$\{\{ github\.token \}\}/g) ?? []).length === 2, "release token must be scoped to the two GitHub API steps");
  assert(/TAG.*VERSION|VERSION.*TAG/s.test(release), "release workflow must compare the tag with package version");
  assert(/\^v\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+/.test(release), "release workflow must enforce v<semver>");
  for (const marker of ["verification.verified", "object.type", "GITHUB_SHA", "VERIFIED_TAG_OBJECT_SHA", "VERIFIED_MAIN_ANCESTRY", "GITHUB_ENV", "refs/remotes/origin/main", "git merge-base --is-ancestor", "npm sbom --sbom-format=spdx --package-lock-only", "git archive", "gzip -n", "sha256sum", "--draft", "gh release create"]) {
    assert(release.includes(marker), `release workflow is missing ${marker}`);
  }
  assert(!/attest/i.test(release), "release workflow must not add attestations");
  assert(/package-ecosystem:\s*npm/.test(dependabot) && /package-ecosystem:\s*github-actions/.test(dependabot), "Dependabot must cover npm and GitHub Actions");
  assert(/interval:\s*weekly/.test(dependabot) && /target-branch:\s*main/.test(dependabot), "Dependabot updates must target main weekly");
  assert(/open-pull-requests-limit:\s*[1-9]/.test(dependabot), "Dependabot must use conservative PR limits");
}

function checkReleaseHardening() {
  const text = read("RELEASING.md");
  for (const phrase of ["signed commit", "signed tag", "package version", "tag", "SHA256SUMS", "SPDX 2.3", "draft", "unsigned history"]) {
    assert(new RegExp(phrase, "i").test(text), `RELEASING.md is missing ${phrase}`);
  }
  assert(!/\/Users\/|[A-Za-z]:\\|@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i.test(text), "RELEASING.md must not contain paths or emails");
  assert(!/OWNER_SETUP_SECRET\s*[:=]\s*[0-9a-f]{64}/i.test(text), "RELEASING.md must not contain a real secret");
  assert(!/(?:ghp_|github_pat_|AKIA|xox[baprs]-|sk-[A-Za-z0-9])[A-Za-z0-9_\-.]{16,}|Bearer\s+[A-Za-z0-9._\-]{20,}/i.test(text), "RELEASING.md must not contain credentials");
}

function checkSensitiveContent() {
  const files = listFiles();
  const patterns = [
    { category: "machine path", pattern: MACHINE_HOME_PATTERN },
    { category: "private runtime marker", pattern: PRIVATE_CONTENT_PATTERN },
    { category: "real owner secret", pattern: /OWNER_SETUP_SECRET\s*[:=]\s*[0-9a-f]{64}/i },
    { category: "credential or token", pattern: /(?:ghp_|github_pat_|AKIA|xox[baprs]-|sk-[A-Za-z0-9])[A-Za-z0-9_\-.]{16,}|Bearer\s+[A-Za-z0-9._\-]{20,}/i },
    { category: "production identifier", pattern: /\b(?:prod|production)[-_](?:d1|db|database|project|worker|app)[-_]?[A-Za-z0-9_-]{4,}\b/i },
    { category: "personal or family marker", pattern: FAMILY_IDENTITY_PATTERN },
  ];
  for (const path of files) {
    if (/\.(png|jpg|jpeg|gif|ico|woff2?)$/i.test(path)) continue;
    const text = maybeRead(path);
    for (const { category, pattern } of patterns) assert(!pattern.test(text), `${category} marker found in ${path}`);
  }
}

function checkSecurity() {
  const auth = read("lib/auth.ts");
  const authPolicy = read("lib/auth-policy.ts");
  const setupRoute = read("app/api/auth/setup/route.ts");
  const unlockRoute = read("app/api/auth/unlock/route.ts");
  const resetRoute = read("app/api/auth/reset/route.ts");
  const logoutRoute = read("app/api/auth/logout/route.ts");
  assert(auth.includes("PBKDF2_ITERATIONS = 100_000"), "PBKDF2 ceiling must remain 100,000");
  assert(auth.includes("OWNER_SETUP_SECRET_PATTERN = /^[0-9a-f]{64}$/i"), "owner secret must be exactly 32 bytes in hex");
  assert(auth.includes("verifyOwnerSetupSecret"), "owner setup secret verification is missing");
  assert(auth.includes("crypto.subtle") && auth.includes("safeEqual"), "owner secret comparison must be digest-based and constant-time");
  assert(setupRoute.includes("application/json") && setupRoute.includes("requestOrigin"), "setup must enforce JSON and same-origin");
  assert(setupRoute.includes("setupSecret") && setupRoute.includes("confirmPin"), "setup must require secret and matching PIN fields");
  assert(setupRoute.indexOf("await verifyOwnerSetupSecret") < setupRoute.indexOf("const d1 = await ensureSchema"), "secret verification must precede D1 access");
  for (const [name, route] of [["unlock", unlockRoute], ["reset", resetRoute]]) {
    assert(route.includes("application/json") && route.includes("requestOrigin"), `${name} must enforce JSON and same-origin`);
  }
  assert(logoutRoute.includes("application/json") && logoutRoute.includes("requestOrigin"), "logout must enforce JSON and same-origin");
  assert(auth.includes("PBKDF2") && auth.includes("pin_salt") && !/INSERT INTO settings[^\n]*pin[^\n]*\?[^\n]*\?[^\n]*plaintext/i.test(auth), "PIN must not be stored as plaintext");
  assert(auth.includes("HttpOnly; Secure; SameSite=Lax"), "session cookie flags must be secure");
  assert(auth.includes("LOCKOUT_AFTER = 5") && auth.includes("LOCKOUT_MS = 15 * 60 * 1000"), "lockout contract changed");
  assert(auth.includes("FAILED_PIN_ATTEMPT_SQL") && auth.includes(".all<FailedAttemptResult>()"), "failed PIN attempts must use the atomic returning statement");
  assert(!auth.includes("nextFailedPinCount"), "unlock must not restore the stale JavaScript read-modify-write counter");
  assert(authPolicy.includes("auth_attempts.failed_count + 1"), "failed PIN SQL must increment the stored database count");
  assert(/WHERE EXISTS \([\s\S]*FROM settings[\s\S]*pin_salt = \?[\s\S]*pin_hash = \?/.test(authPolicy), "failed PIN SQL must guard the settings snapshot");
  assert(/locked_until > excluded\.updated_at[\s\S]*THEN auth_attempts\.locked_until/.test(authPolicy), "failed PIN SQL must preserve an active lock");
  assert(/RETURNING\s+failed_count,\s*locked_until/i.test(authPolicy), "failed PIN SQL must return the atomic result state");
  assert(/INSERT INTO settings[\s\S]*INSERT INTO auth_attempts[\s\S]*INSERT INTO auth_sessions/.test(auth), "owner claim must initialize settings, attempts, and session together");
  assert(/constraint failed|unique constraint/i.test(auth), "concurrent owner claim must map conflicts to a controlled response");
}

function checkSecurityPolicy() {
  const policy = read("SECURITY.md");
  assert(/private vulnerability reporting/i.test(policy), "SECURITY.md must describe private vulnerability reporting");
  assert(/do not (?:open|file) a public issue|不要.*公開/i.test(policy), "SECURITY.md must tell reporters not to disclose exploits publicly");
  assert(/if GitHub private vulnerability reporting is enabled|如果.*啟用/i.test(policy), "SECURITY.md must describe private reporting conditionally");
  assert(/if that option is unavailable[\s\S]{0,240}minimal public issue[\s\S]{0,160}private reporting route/i.test(policy), "SECURITY.md must provide the public fallback route");
  assert(!/private contact channel listed in the repository settings/i.test(policy), "SECURITY.md must not promise a nonexistent private contact channel");
  assert(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(policy), "SECURITY.md must not expose a personal email");
  assert(!/(?:ghp_|github_pat_|AKIA|xox[baprs]-|sk-[A-Za-z0-9])[A-Za-z0-9_.-]{16,}/i.test(policy), "SECURITY.md must not contain credentials");
}

function checkEmptyD1() {
  const db = read("db/index.ts");
  assert(!/historical|seed/i.test(db), "first-use schema helper must not import or call seed data");
  assert(/CREATE TABLE IF NOT EXISTS settings/.test(db) && /CREATE TABLE IF NOT EXISTS trips/.test(db), "schema helper must create core tables");
  assert(/archived_at/.test(db), "schema helper must retain archive columns");
  assert(!/\b(INSERT|UPDATE|DELETE)\b/i.test(db), "schema helper must contain DDL only and never mutate user data");
}

function checkArchive() {
  const paths = ["app/api/trips/route.ts", "app/api/trips/[tripId]/route.ts", "app/api/trips/[tripId]/items/route.ts", "app/api/improvements/route.ts", "lib/trip-data.ts", "lib/improvement-data.ts"];
  const text = paths.map(read).join("\n");
  assert(!/\bDELETE\s+FROM\b/i.test(text), "trip content must never be hard-deleted");
  assert((text.match(/archived_at/g) ?? []).length >= 8, "archive predicates must remain on active reads and writes");
  assert(/archived:\s*true/.test(read("app/api/trips/[tripId]/route.ts")), "trip archive mutation is missing");
}

function checkPacking() {
  const page = read("app/page.tsx");
  const start = page.indexOf("function PackingPanel");
  const end = page.indexOf("function ShoppingEditor", start);
  assert(start >= 0 && end > start, "packing panel is missing");
  const panel = page.slice(start, end);
  assert(!/可選|optional/i.test(panel), "packing panel must not display optional labels");
  assert(/archived:\s*true/.test(panel), "packing removal must use archive behavior");
  assert(read("lib/packing-templates.ts").includes("optional"), "packing data model must retain optional compatibility without rendering it");
}

function checkMigrations() {
  const files = readdirSync(join(ROOT, "drizzle")).filter((name) => name.endsWith(".sql"));
  assert(files.length > 0, "DDL migrations are required");
  assert(files.includes("0005_place_sections.sql"), "place-section migration 0005 is required");
  const placeSections = stripSqlComments(read("drizzle/0005_place_sections.sql"));
  assert(/CREATE TABLE `list_sections`/i.test(placeSections), "migration 0005 must create list_sections");
  assert(/ALTER TABLE `shopping_items` ADD `section_id`/i.test(placeSections), "migration 0005 must add shopping section_id");
  assert(/ALTER TABLE `food_items` ADD `section_id`/i.test(placeSections), "migration 0005 must add food section_id");
  assert(!/(?:^|;)\s*(INSERT|UPDATE|DELETE)\b/i.test(placeSections), "migration 0005 must contain DDL only");
  for (const name of files) {
    const sql = stripSqlComments(read(join("drizzle", name)));
    const normalized = sql.replace(/;\s*$/g, "").trim().replace(/\s+/g, " ");
    if (name === "0001_remarkable_thunderball.sql") {
      assert(normalized === "SELECT 1", `${name} must remain the exact SELECT 1 compatibility no-op`);
      continue;
    }
    const statements = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    assert(statements.length > 0, `${name} does not contain an executable schema statement`);
    for (const statement of statements) {
      assert(!/^(INSERT|UPDATE|DELETE)\b/i.test(statement), `${name} contains data DML`);
      assert(/^(CREATE|ALTER|DROP)\b/i.test(statement), `${name} contains a non-DDL statement`);
    }
  }
}

function stripSqlComments(sql) {
  let output = "";
  let quote = null;
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const next = sql[index + 1];
    if (quote) {
      output += character;
      if (character === quote) {
        if (sql[index + 1] === quote) {
          output += sql[index + 1];
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      output += character;
      continue;
    }
    if (character === "-" && next === "-") {
      output += "  ";
      index += 1;
      while (index + 1 < sql.length && sql[index + 1] !== "\n" && sql[index + 1] !== "\r") index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      output += "  ";
      index += 1;
      while (index + 1 < sql.length && !(sql[index + 1] === "*" && sql[index + 2] === "/")) {
        if (sql[index + 1] === "\n" || sql[index + 1] === "\r") output += sql[index + 1];
        else output += " ";
        index += 1;
      }
      if (index + 2 < sql.length) index += 2;
      continue;
    }
    output += character;
  }
  return output;
}

const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/i;
const SEMVER_TAG_PATTERN = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/**
 * Classify the checkout context without reading the filesystem. A normal main
 * checkout is accepted; a detached checkout is accepted only when every
 * GitHub Actions tag binding has been verified by the release workflow.
 */
function classifyGitContext(context) {
  const reasons = [];
  const branch = context.branch;
  if (branch === "main") return { accepted: true, mode: "attached-main", reasons };
  if (branch !== "HEAD") reasons.push("checkout must be main or detached HEAD");

  const env = context.env ?? {};
  const packageVersion = context.packageVersion ?? "";
  const expectedTag = `v${packageVersion}`;
  const refName = env.GITHUB_REF_NAME ?? "";
  if (env.GITHUB_ACTIONS !== "true") reasons.push("GITHUB_ACTIONS must be true");
  if (env.GITHUB_EVENT_NAME !== "push") reasons.push("GITHUB_EVENT_NAME must be push");
  if (env.GITHUB_REF_TYPE !== "tag") reasons.push("GITHUB_REF_TYPE must be tag");
  if (!SEMVER_TAG_PATTERN.test(refName)) reasons.push("GITHUB_REF_NAME must be a v<semver> tag");
  if (refName !== expectedTag) reasons.push("GITHUB_REF_NAME must equal package vVersion");
  if (env.GITHUB_REF !== `refs/tags/${refName}`) reasons.push("GITHUB_REF must match the exact tag ref");
  if (!FULL_SHA_PATTERN.test(context.headSha ?? "")) reasons.push("HEAD must resolve to a full SHA");
  if (!FULL_SHA_PATTERN.test(env.GITHUB_SHA ?? "") || env.GITHUB_SHA !== context.headSha) reasons.push("GITHUB_SHA must equal HEAD");
  if (context.refExists !== true) reasons.push("the local tag ref must exist");
  if (context.tagType !== "tag") reasons.push("the local ref must be an annotated tag");
  if (!FULL_SHA_PATTERN.test(context.tagObjectSha ?? "")) reasons.push("the local tag-object SHA must be full");
  if (context.tagTargetSha !== context.headSha) reasons.push("the annotated tag target must equal HEAD");
  if (!FULL_SHA_PATTERN.test(env.VERIFIED_TAG_OBJECT_SHA ?? "") || env.VERIFIED_TAG_OBJECT_SHA !== context.tagObjectSha) reasons.push("verified tag-object SHA must bind to the local tag object");
  if (context.mainContainsHead !== true) reasons.push("HEAD must be contained in refs/remotes/origin/main");
  if (env.VERIFIED_MAIN_ANCESTRY !== "true") reasons.push("verified main ancestry marker is required");
  return { accepted: reasons.length === 0, mode: "detached-tag", reasons };
}

function gitOutput(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function checkGitHistory() {
  assert(existsSync(join(ROOT, ".git")), "public Git repository has not been initialized");
  const branch = gitOutput(["rev-parse", "--abbrev-ref", "HEAD"]);
  const headSha = gitOutput(["rev-parse", "HEAD"]);
  const packageVersion = parseJson("package.json").version;
  const refName = process.env.GITHUB_REF_NAME ?? "";
  const localRef = refName ? `refs/tags/${refName}` : "";
  let refExists = false;
  let tagType = "";
  let tagObjectSha = "";
  let tagTargetSha = "";
  if (localRef) {
    try {
      execFileSync("git", ["show-ref", "--verify", "--quiet", localRef], { cwd: ROOT, stdio: "ignore" });
      refExists = true;
      tagType = gitOutput(["cat-file", "-t", localRef]);
      tagObjectSha = gitOutput(["rev-parse", localRef]);
      tagTargetSha = gitOutput(["rev-parse", `${localRef}^{}`]);
    } catch {
      refExists = false;
    }
  }
  let mainContainsHead = false;
  if (branch === "HEAD") {
    try {
      execFileSync("git", ["show-ref", "--verify", "--quiet", "refs/remotes/origin/main"], { cwd: ROOT, stdio: "ignore" });
    } catch {
      fail("refs/remotes/origin/main is required for detached tag validation");
    }
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", headSha, "refs/remotes/origin/main"], { cwd: ROOT, stdio: "ignore" });
      mainContainsHead = true;
    } catch {
      fail("detached tag HEAD is not an ancestor of refs/remotes/origin/main");
    }
  }
  const classification = classifyGitContext({ branch, headSha, packageVersion, env: process.env, refExists, tagType, tagObjectSha, tagTargetSha, mainContainsHead });
  assert(classification.accepted, `invalid Git checkout context: ${classification.reasons.join("; ")}`);
  const roots = gitOutput(["rev-list", "--max-parents=0", "HEAD"]).split(/\n/).filter(Boolean);
  assert(roots.length === 1, "public history must contain exactly one independent root commit");
  const paths = gitOutput(["ls-tree", "-r", "--name-only", "HEAD"]);
  const forbiddenFixturePathPattern = new RegExp(["node_modules", ["loop", "v2"].join("-"), ["\\.", "openai"].join("")].join("|"), "i");
  assert(!forbiddenFixturePathPattern.test(paths), "private evidence and dependencies must not be in public history");
}

const CHECKERS = {
  "dependency-manifest": checkDependencyManifest,
  "source-provenance-truth": checkSourceProvenance,
  privacy: checkPrivacy,
  licensing: checkLicensing,
  assets: checkAssets,
  "portable-config": checkPortableConfig,
  documentation: checkDocumentation,
  security: checkSecurity,
  "security-policy": checkSecurityPolicy,
  "empty-d1": checkEmptyD1,
  archive: checkArchive,
  packing: checkPacking,
  migrations: checkMigrations,
  sbom: checkSbom,
  workflows: checkWorkflows,
  "release-hardening": checkReleaseHardening,
  "sensitive-content": checkSensitiveContent,
  "git-history": checkGitHistory,
};

function selfTest() {
  assert(!PRIVATE_CONTENT_PATTERN.test("fanheungha"), "self-test positive fixture unexpectedly matched");
  assert(PRIVATE_CONTENT_PATTERN.test(["site", "creator"].join("-")), "self-test negative privacy fixture did not match");
  assert(MACHINE_HOME_PATTERN.test(["", "Users", "example", ""].join("/")), "self-test machine-path fixture did not match");
  assert(FAMILY_IDENTITY_PATTERN.test(["一家", "人"].join("")), "self-test family-marker fixture did not match");
  assert(/^[0-9a-f]{64}$/i.test("a".repeat(64)), "self-test owner secret positive fixture failed");
  assert(!/^[0-9a-f]{64}$/i.test("g".repeat(64)), "self-test owner secret negative fixture failed");
  const commentFixture = "-- INSERT INTO trips VALUES ('private seed');\n/* UPDATE trips SET title = 'private'; */\nCREATE TABLE safe (id TEXT);";
  const strippedCommentFixture = stripSqlComments(commentFixture).trim();
  assert(!/^(INSERT|UPDATE|DELETE)\b/im.test(strippedCommentFixture), "self-test comment fixture still looks like DML");
  assert(/^CREATE\s+TABLE\b/im.test(strippedCommentFixture), "self-test comment fixture lost its DDL");
  const misleadingDdlComment = stripSqlComments("-- 0000 creates the final table\nSELECT 1;").replace(/;\s*$/g, "").trim();
  assert(misleadingDdlComment === "SELECT 1", "self-test compatibility no-op normalization failed");
  assert(!/^(CREATE|ALTER|DROP)\b/i.test(misleadingDdlComment), "self-test DDL comment produced a false positive");
  assert(ALL_CHECKS.includes("git-history") && ALL_CHECKS.includes("workflows") && ALL_CHECKS.includes("sbom"), "self-test all-check coverage omitted hardening checks");
  assert(!/[0-9a-f]{40}/i.test("internal source unavailable"), "self-test provenance redaction fixture failed");
  assert(/[0-9a-f]{40}/i.test("a".repeat(40)), "self-test provenance SHA detector fixture failed");
  const positive = { name: "fanheungha", scripts: { typecheck: "tsc --noEmit" } };
  assert(positive.name === "fanheungha" && positive.scripts.typecheck === "tsc --noEmit", "self-test manifest positive fixture failed");
  const negative = { name: "private-project", scripts: { typecheck: "tsc" } };
  assert(negative.name !== "fanheungha" && negative.scripts.typecheck !== "tsc --noEmit", "self-test manifest negative fixture failed");

  const tagSha = "a".repeat(40);
  const validDetached = {
    branch: "HEAD",
    headSha: tagSha,
    packageVersion: "0.1.0",
    refExists: true,
    tagType: "tag",
    tagObjectSha: tagSha,
    tagTargetSha: tagSha,
    mainContainsHead: true,
    env: {
      GITHUB_ACTIONS: "true",
      GITHUB_EVENT_NAME: "push",
      GITHUB_REF_TYPE: "tag",
      GITHUB_REF_NAME: "v0.1.0",
      GITHUB_REF: "refs/tags/v0.1.0",
      GITHUB_SHA: tagSha,
      VERIFIED_TAG_OBJECT_SHA: tagSha,
      VERIFIED_MAIN_ANCESTRY: "true",
    },
  };
  assert(classifyGitContext(validDetached).accepted, "self-test valid detached tag context failed");
  assert(classifyGitContext({ ...validDetached, branch: "main" }).accepted, "self-test attached main context failed");
  for (const [label, variant] of [
    ["ordinary detached", { env: { ...validDetached.env, GITHUB_ACTIONS: "false" } }],
    ["pull request detached", { env: { ...validDetached.env, GITHUB_EVENT_NAME: "pull_request" } }],
    ["version mismatch", { env: { ...validDetached.env, GITHUB_REF_NAME: "v0.2.0", GITHUB_REF: "refs/tags/v0.2.0" } }],
    ["ref mismatch", { env: { ...validDetached.env, GITHUB_REF: "refs/tags/other" } }],
    ["SHA mismatch", { env: { ...validDetached.env, GITHUB_SHA: "b".repeat(40) } }],
    ["lightweight tag", { tagType: "commit" }],
    ["missing local ref", { refExists: false }],
    ["tag target mismatch", { tagTargetSha: "b".repeat(40) }],
    ["verified object mismatch", { env: { ...validDetached.env, VERIFIED_TAG_OBJECT_SHA: "b".repeat(40) } }],
    ["main ancestry mismatch", { mainContainsHead: false }],
    ["missing ancestry marker", { env: { ...validDetached.env, VERIFIED_MAIN_ANCESTRY: "false" } }],
  ]) assert(!classifyGitContext({ ...validDetached, ...variant }).accepted, `self-test ${label} context unexpectedly passed`);
  console.log("self-test: pass (detectors and Git checkout context cases)");
}

function main() {
  const argument = process.argv.slice(2);
  if (argument.includes("--self-test")) {
    assert(argument.length === 1, "--self-test cannot be combined with other arguments");
    selfTest();
    return;
  }
  assert(argument.every((value) => value.startsWith("--check=") || value.startsWith("--skip=")), "unknown argument");
  const checkArguments = argument.filter((value) => value.startsWith("--check="));
  const skipArguments = argument.filter((value) => value.startsWith("--skip="));
  assert(checkArguments.length === 1, "usage: node scripts/validate-public-repo.mjs --check=<name|all> [--skip=<name,...>]");
  assert(skipArguments.length <= 1, "--skip may be provided at most once");
  const checkArgument = checkArguments[0];
  const requested = checkArgument?.slice("--check=".length);
  assert(requested, "usage: node scripts/validate-public-repo.mjs --self-test | --check=<name|all> [--skip=<name,...>]");
  const checks = requested === "all" ? [...ALL_CHECKS] : [requested];
  for (const name of checks) if (!CHECKERS[name]) fail(`unknown check: ${name}`);
  const skipValue = skipArguments[0]?.slice("--skip=".length) ?? "";
  const skipNames = skipValue ? skipValue.split(",") : [];
  if (skipArguments.length > 0) {
    assert(requested === "all", "--skip is supported only with --check=all");
    assert(skipNames.every(Boolean), "--skip must name at least one check");
    assert(new Set(skipNames).size === skipNames.length, "--skip must not contain duplicate checks");
    for (const name of skipNames) if (!CHECKERS[name]) fail(`unknown skipped check: ${name}`);
  }
  const selectedChecks = checks.filter((name) => !skipNames.includes(name));
  assert(selectedChecks.length > 0, "--skip cannot remove every check");
  let passes = 0;
  const failures = [];
  for (const name of selectedChecks) {
    try {
      CHECKERS[name]();
      passes += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      failures.push({ name, message: error instanceof Error ? error.message : String(error) });
      console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log(`${passes} pass / ${failures.length} fail`);
  if (failures.length > 0) process.exitCode = 1;
}

export { classifyGitContext, FULL_SHA_PATTERN, SEMVER_TAG_PATTERN };

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
