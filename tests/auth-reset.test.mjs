import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("PIN reset rotates credentials and sessions in one guarded four-statement batch", async () => {
  const auth = await read("lib/auth.ts");
  const start = auth.indexOf("export async function resetPin");
  const end = auth.indexOf("export async function revokeSession", start);
  const reset = auth.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.equal((reset.match(/d1\.prepare\(/g) ?? []).length, 4);
  assert.match(reset, /UPDATE settings/);
  assert.match(reset, /pin_salt = \?/);
  assert.match(reset, /token_hash = \?/);
  assert.match(reset, /failed_count = 0/);
  assert.match(reset, /UPDATE auth_sessions/);
  assert.match(reset, /revoked_at/);
  assert.match(reset, /INSERT INTO auth_sessions/);
  assert.match(reset, /results\[0\]\.meta\?\.changes/);
  assert.match(reset, /results\[3\]\.meta\?\.changes/);
  assert.match(reset, /throw new HttpError\(401/);
  assert.match(auth, /HttpOnly; Secure; SameSite=Lax/);
});

test("reset endpoint and sidebar enforce the private six-digit confirmation flow", async () => {
  const [route, auth, frame, shared] = await Promise.all([
    read("app/api/auth/reset/route.ts"),
    read("lib/auth.ts"),
    read("app/components/AppFrame.tsx"),
    read("app/components/SharedUi.tsx"),
  ]);
  assert.match(route, /contentType !== "application\/json"/);
  assert.match(route, /requestOrigin !== new URL\(request\.url\)\.origin/);
  assert.match(route, /requireSession\(request\)/);
  assert.match(route, /pin !== confirmPin/);
  assert.match(auth, /AND pin_salt = \?/);
  assert.match(auth, /INSERT INTO auth_sessions[\s\S]*WHERE EXISTS/);
  assert.match(frame, /重新設定 PIN/);
  assert.match(frame, /autoComplete="new-password"/);
  assert.match(frame + shared, /其他裝置需要用新 PIN 重新解鎖/);
  assert.doesNotMatch(`${route}\n${auth}\n${frame}\n${shared}`, /localStorage|sessionStorage/);
});
