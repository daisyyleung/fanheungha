import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const ORIGIN = "https://fanheungha.test";
const OWNER_SECRET = "0".repeat(64);
const WRONG_SECRET = "1".repeat(64);
const PIN = "123456";

class D1Statement {
  constructor(database, sql, bindings = []) {
    this.database = database;
    this.sql = sql;
    this.bindings = bindings;
  }

  bind(...bindings) {
    return new D1Statement(this.database, this.sql, bindings);
  }

  async all() {
    await this.database.beforeAll?.(this);
    const statement = this.database.sqlite.prepare(this.sql);
    const rows = statement.all(...this.bindings);
    return { results: rows, success: true, meta: { changes: 0 } };
  }

  async run() {
    const result = this.database.sqlite.prepare(this.sql).run(...this.bindings);
    return { results: [], success: true, meta: { changes: Number(result.changes) } };
  }

  executeForBatch() {
    if (/^\s*(?:SELECT|PRAGMA)\b/i.test(this.sql) || /\bRETURNING\b/i.test(this.sql)) {
      const results = this.database.sqlite.prepare(this.sql).all(...this.bindings);
      return { results, success: true, meta: { changes: 0 } };
    }
    const result = this.database.sqlite.prepare(this.sql).run(...this.bindings);
    return { results: [], success: true, meta: { changes: Number(result.changes) } };
  }
}

class TestD1 {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
  }

  prepare(sql) {
    return new D1Statement(this, sql);
  }

  async batch(statements) {
    await this.beforeBatch?.(statements);
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => statement.executeForBatch());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `setup-${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

function executionContext() {
  return { waitUntil() {}, passThroughOnException() {} };
}

function environment(db, ownerSecret = OWNER_SECRET) {
  return {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    DB: db,
    OWNER_SETUP_SECRET: ownerSecret,
  };
}

async function postSetupRequest(worker, env, body, headers = {}) {
  return worker.fetch(
    new Request(`${ORIGIN}/api/auth/setup`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    env,
    executionContext(),
  );
}

async function postSetup(worker, env, setupSecret) {
  return postSetupRequest(worker, env, { setupSecret, pin: PIN, confirmPin: PIN });
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test("setup configuration failure is returned before D1 access", async () => {
  const worker = await loadWorker();
  const unavailableDb = {
    prepare() {
      throw new Error("D1 must not be touched while OWNER_SETUP_SECRET is unavailable");
    },
  };
  const response = await postSetup(worker, environment(unavailableDb, ""), OWNER_SECRET);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), null);
});

test("setup validation rejects malformed transport and secret inputs without consuming attempts", async () => {
  const worker = await loadWorker();
  const db = new TestD1();
  const env = environment(db);

  const wrongContentType = await postSetupRequest(
    worker,
    env,
    JSON.stringify({ setupSecret: WRONG_SECRET, pin: PIN, confirmPin: PIN }),
    { "content-type": "text/plain" },
  );
  assert.equal(wrongContentType.status, 415);

  const wrongOrigin = await postSetupRequest(
    worker,
    env,
    { setupSecret: WRONG_SECRET, pin: PIN, confirmPin: PIN },
    { origin: "https://wrong-origin.test" },
  );
  assert.equal(wrongOrigin.status, 403);

  const malformedSecret = await postSetup(worker, env, "not-a-64-character-hex-secret");
  const malformedPayload = await malformedSecret.json();
  assert.equal(malformedSecret.status, 403);
  assert.equal(malformedPayload.details, undefined);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM auth_attempts").get().count, 0);

  const firstWellFormedMismatch = await postSetup(worker, env, WRONG_SECRET);
  const mismatchPayload = await firstWellFormedMismatch.json();
  assert.equal(firstWellFormedMismatch.status, 403);
  assert.equal(mismatchPayload.details.remainingAttempts, 4);
});

test("setup route locks on the fifth well-formed mismatch and exposes Retry-After", async () => {
  const worker = await loadWorker();
  const db = new TestD1();
  const env = environment(db);

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await postSetup(worker, env, WRONG_SECRET);
    const payload = await response.json();
    assert.equal(response.status, 403);
    assert.equal(payload.details.remainingAttempts, 5 - attempt);
    assert.equal(response.headers.get("retry-after"), null);
  }

  const fifth = await postSetup(worker, env, WRONG_SECRET);
  const fifthPayload = await fifth.json();
  assert.equal(fifth.status, 429);
  assert.match(fifth.headers.get("retry-after") ?? "", /^\d+$/);
  assert.equal(Number(fifth.headers.get("retry-after")), fifthPayload.details.retryAfterSeconds);

  const correctWhileLocked = await postSetup(worker, env, OWNER_SECRET);
  assert.equal(correctWhileLocked.status, 429);
  assert.match(correctWhileLocked.headers.get("retry-after") ?? "", /^\d+$/);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM settings").get().count, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get().count, 0);

  db.sqlite
    .prepare("UPDATE auth_attempts SET locked_until = ?, updated_at = ? WHERE id = ?")
    .run("2000-01-01T00:00:00.000Z", "2000-01-01T00:00:00.000Z", "owner-setup");
  const afterExpiry = await postSetup(worker, env, WRONG_SECRET);
  const afterExpiryPayload = await afterExpiry.json();
  assert.equal(afterExpiry.status, 403);
  assert.equal(afterExpiryPayload.details.remainingAttempts, 4);

  const successfulClaim = await postSetup(worker, env, OWNER_SECRET);
  assert.equal(successfulClaim.status, 201);
  assert.match(successfulClaim.headers.get("set-cookie") ?? "", /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM settings").get().count, 1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get().count, 1);
  assert.equal(
    db.sqlite
      .prepare("SELECT failed_count FROM auth_attempts WHERE id = ?")
      .get("owner-setup").failed_count,
    0,
  );

  const postClaimRetry = await postSetup(worker, env, OWNER_SECRET);
  assert.equal(postClaimRetry.status, 409);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM settings").get().count, 1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get().count, 1);
});

test("the fifth mismatch and the correct owner claim cannot both win", async () => {
  const worker = await loadWorker();
  const db = new TestD1();
  const env = environment(db);

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    assert.equal((await postSetup(worker, env, WRONG_SECRET)).status, 403);
  }

  const claimAtBatch = deferred();
  const releaseClaim = deferred();
  db.beforeBatch = async (statements) => {
    if (!statements[0]?.sql.includes("INSERT INTO settings")) return;
    claimAtBatch.resolve();
    await releaseClaim.promise;
  };

  const correctClaim = postSetup(worker, env, OWNER_SECRET);
  await claimAtBatch.promise;
  const fifthMismatch = await postSetup(worker, env, WRONG_SECRET);
  assert.equal(fifthMismatch.status, 429);
  releaseClaim.resolve();

  const blockedClaim = await correctClaim;
  assert.equal(blockedClaim.status, 429);
  assert.match(blockedClaim.headers.get("retry-after") ?? "", /^\d+$/);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM settings").get().count, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get().count, 0);
});

test("a winning owner claim prevents a paused fifth mismatch from creating a lock", async () => {
  const worker = await loadWorker();
  const db = new TestD1();
  const env = environment(db);

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    assert.equal((await postSetup(worker, env, WRONG_SECRET)).status, 403);
  }

  const failureAtWrite = deferred();
  const releaseFailure = deferred();
  db.beforeAll = async (statement) => {
    if (!statement.sql.includes("RETURNING failed_count, locked_until")) return;
    failureAtWrite.resolve();
    await releaseFailure.promise;
  };

  const fifthMismatch = postSetup(worker, env, WRONG_SECRET);
  await failureAtWrite.promise;
  const winningClaim = await postSetup(worker, env, OWNER_SECRET);
  assert.equal(winningClaim.status, 201);
  releaseFailure.resolve();

  const lateMismatch = await fifthMismatch;
  assert.equal(lateMismatch.status, 403);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM settings").get().count, 1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get().count, 1);
  const setupAttempt = db.sqlite
    .prepare("SELECT failed_count, locked_until FROM auth_attempts WHERE id = ?")
    .get("owner-setup");
  assert.deepEqual({ ...setupAttempt }, { failed_count: 0, locked_until: null });
});
