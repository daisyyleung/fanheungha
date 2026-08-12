import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { FAILED_PIN_ATTEMPT_SQL } from "../lib/auth-policy.ts";

const SETTINGS_ID = "household";
const PIN_SALT = "test-salt";
const PIN_HASH = "test-hash";
const FIRST_FAILURE_AT = "2026-08-12T00:00:00.000Z";
const LOCKED_UNTIL = "2026-08-12T00:15:00.000Z";

function createDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE settings (
      id TEXT PRIMARY KEY NOT NULL,
      pin_salt TEXT NOT NULL,
      pin_hash TEXT NOT NULL
    );
    CREATE TABLE auth_attempts (
      id TEXT PRIMARY KEY NOT NULL,
      failed_count INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      updated_at TEXT NOT NULL
    );
    INSERT INTO settings (id, pin_salt, pin_hash)
    VALUES ('${SETTINGS_ID}', '${PIN_SALT}', '${PIN_HASH}');
  `);
  return db;
}

function recordFailedAttempt(db, nowIso, lockUntilIso = LOCKED_UNTIL, salt = PIN_SALT, hash = PIN_HASH) {
  return db
    .prepare(FAILED_PIN_ATTEMPT_SQL)
    .all(SETTINGS_ID, nowIso, SETTINGS_ID, salt, hash, 5, lockUntilIso);
}

test("the production failure SQL accumulates and locks on the fifth attempt", () => {
  const db = createDatabase();
  for (let count = 1; count <= 4; count += 1) {
    const [row] = recordFailedAttempt(db, FIRST_FAILURE_AT);
    assert.equal(row.failed_count, count);
    assert.equal(row.locked_until, null);
  }

  const [fifth] = recordFailedAttempt(db, FIRST_FAILURE_AT);
  assert.deepEqual({ ...fifth }, { failed_count: 5, locked_until: LOCKED_UNTIL });
});

test("an active lock is preserved and an expired lock starts at one", () => {
  const db = createDatabase();
  recordFailedAttempt(db, FIRST_FAILURE_AT);
  recordFailedAttempt(db, FIRST_FAILURE_AT);
  recordFailedAttempt(db, FIRST_FAILURE_AT);
  recordFailedAttempt(db, FIRST_FAILURE_AT);
  const [fifth] = recordFailedAttempt(db, FIRST_FAILURE_AT);

  const [sixth] = recordFailedAttempt(db, "2026-08-12T00:01:00.000Z", "2026-08-12T00:16:00.000Z");
  assert.deepEqual({ ...sixth }, { ...fifth });

  const [afterExpiry] = recordFailedAttempt(db, LOCKED_UNTIL, "2026-08-12T00:30:00.000Z");
  assert.deepEqual({ ...afterExpiry }, { failed_count: 1, locked_until: null });
});

test("a stale settings snapshot returns no row and leaves the attempt unchanged", () => {
  const db = createDatabase();
  const [first] = recordFailedAttempt(db, FIRST_FAILURE_AT);
  const stale = recordFailedAttempt(db, "2026-08-12T00:01:00.000Z", "2026-08-12T00:16:00.000Z", PIN_SALT, "stale-hash");
  assert.equal(stale.length, 0);
  const current = db.prepare("SELECT failed_count, locked_until FROM auth_attempts WHERE id = ?").all(SETTINGS_ID);
  assert.deepEqual(current[0], first);
});

test("PIN hashing stays within the deployed runtime PBKDF2 limit", async () => {
  const source = await readFile(new URL("../lib/auth.ts", import.meta.url), "utf8");
  const match = source.match(/PBKDF2_ITERATIONS\s*=\s*([\d_]+)/);
  assert.ok(match, "PBKDF2 iteration constant should be declared");
  assert.ok(Number(match[1].replaceAll("_", "")) <= 100_000);
});
