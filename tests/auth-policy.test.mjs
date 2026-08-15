import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  CLAIM_SETTINGS_SQL,
  FAILED_PIN_ATTEMPT_SQL,
  FAILED_SETUP_ATTEMPT_SQL,
} from "../lib/auth-policy.ts";

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

function createSetupDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE settings (
      id TEXT PRIMARY KEY NOT NULL,
      pin_salt TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE auth_attempts (
      id TEXT PRIMARY KEY NOT NULL,
      failed_count INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      updated_at TEXT NOT NULL
    );
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

function recordSetupFailure(db, nowIso, lockUntilIso = LOCKED_UNTIL) {
  return db
    .prepare(FAILED_SETUP_ATTEMPT_SQL)
    .all("owner-setup", nowIso, 5, lockUntilIso);
}

test("setup failures accumulate independently and lock on the fifth attempt", () => {
  const db = createSetupDatabase();
  for (let count = 1; count <= 4; count += 1) {
    const [row] = recordSetupFailure(db, FIRST_FAILURE_AT);
    assert.deepEqual({ ...row }, { failed_count: count, locked_until: null });
  }
  const [fifth] = recordSetupFailure(db, FIRST_FAILURE_AT);
  assert.deepEqual({ ...fifth }, { failed_count: 5, locked_until: LOCKED_UNTIL });
});

test("setup lock preserves active windows and restarts after expiry", () => {
  const db = createSetupDatabase();
  for (let count = 0; count < 5; count += 1) recordSetupFailure(db, FIRST_FAILURE_AT);
  const [active] = recordSetupFailure(db, "2026-08-12T00:01:00.000Z", "2026-08-12T00:16:00.000Z");
  assert.deepEqual({ ...active }, { failed_count: 5, locked_until: LOCKED_UNTIL });
  const [afterExpiry] = recordSetupFailure(db, LOCKED_UNTIL, "2026-08-12T00:30:00.000Z");
  assert.deepEqual({ ...afterExpiry }, { failed_count: 1, locked_until: null });
});

test("setup failure is a no-op after household settings are claimed", () => {
  const db = createSetupDatabase();
  db.prepare("INSERT INTO settings (id, pin_salt, pin_hash) VALUES (?, ?, ?)").run("household", "salt", "hash");
  const result = recordSetupFailure(db, FIRST_FAILURE_AT);
  assert.equal(result.length, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM auth_attempts").get().count, 0);
});

function claimSettings(db, nowIso, lockKey = "owner-setup") {
  return db
    .prepare(CLAIM_SETTINGS_SQL)
    .run("household", "salt", "hash", nowIso, nowIso, "household", lockKey, nowIso);
}

test("guarded settings claim respects the active setup lock", () => {
  const db = createSetupDatabase();
  db.prepare("INSERT INTO auth_attempts (id, failed_count, locked_until, updated_at) VALUES (?, ?, ?, ?)").run(
    "owner-setup",
    5,
    LOCKED_UNTIL,
    FIRST_FAILURE_AT,
  );
  assert.equal(claimSettings(db, FIRST_FAILURE_AT).changes, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM settings").get().count, 0);
  assert.equal(claimSettings(db, LOCKED_UNTIL).changes, 1);
});

test("PIN and setup attempts use independent rows", () => {
  const db = createSetupDatabase();
  db.prepare("INSERT INTO settings (id, pin_salt, pin_hash) VALUES (?, ?, ?)").run("household", PIN_SALT, PIN_HASH);
  const [pin] = recordFailedAttempt(db, FIRST_FAILURE_AT);
  assert.equal(pin.failed_count, 1);
  const setupDb = createSetupDatabase();
  const [setup] = recordSetupFailure(setupDb, FIRST_FAILURE_AT);
  assert.equal(setup.failed_count, 1);
  assert.equal(setupDb.prepare("SELECT failed_count FROM auth_attempts WHERE id = ?").get("owner-setup").failed_count, 1);
});

test("PIN hashing stays within the deployed runtime PBKDF2 limit", async () => {
  const source = await readFile(new URL("../lib/auth.ts", import.meta.url), "utf8");
  const match = source.match(/PBKDF2_ITERATIONS\s*=\s*([\d_]+)/);
  assert.ok(match, "PBKDF2 iteration constant should be declared");
  assert.ok(Number(match[1].replaceAll("_", "")) <= 100_000);
});
