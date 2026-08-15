import { ensureSchema, HttpError, newId, nowIso, type AppD1 } from "@/db";
import {
  CLAIM_SETTINGS_SQL,
  FAILED_PIN_ATTEMPT_SQL,
  FAILED_SETUP_ATTEMPT_SQL,
} from "@/lib/auth-policy";

const SESSION_COOKIE = "fanheungha_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;
const ATTEMPT_KEY = "household";
export const SETUP_ATTEMPT_KEY = "owner-setup";
const LOCKOUT_AFTER = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
export const PBKDF2_ITERATIONS = 100_000;
export const OWNER_SETUP_SECRET_PATTERN = /^[0-9a-f]{64}$/i;

type SettingRow = {
  id: string;
  pin_salt: string;
  pin_hash: string;
};

type AttemptRow = {
  id: string;
  failed_count: number;
  locked_until: string | null;
};

export type FailedAttemptResult = {
  failed_count: number;
  locked_until: string | null;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

async function digestHex(bytes: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function derivePinHash(pin: string, salt: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: fromBase64Url(salt) as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return digestHex(bits);
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function runtimeEnv(): { OWNER_SETUP_SECRET?: unknown } | undefined {
  return (globalThis as unknown as { __FANHEUNGHA_ENV?: { OWNER_SETUP_SECRET?: unknown } }).__FANHEUNGHA_ENV;
}

export function isOwnerSetupSecret(value: unknown): value is string {
  return typeof value === "string" && OWNER_SETUP_SECRET_PATTERN.test(value);
}

/** Verify the server-held first-run secret without touching D1 or deriving a PIN. */
export async function verifyOwnerSetupSecret(value: unknown): Promise<void> {
  const configured = runtimeEnv()?.OWNER_SETUP_SECRET;
  if (!isOwnerSetupSecret(configured)) {
    throw new HttpError(503, "尚未設定安全的擁有人啟用密碼。請先完成 Worker 設定。");
  }
  if (!isOwnerSetupSecret(value)) {
    throw new HttpError(403, "啟用密碼不正確，未能建立旅記。");
  }
  const expected = await digestHex(new TextEncoder().encode(configured.toLowerCase()).buffer);
  const supplied = await digestHex(new TextEncoder().encode(value.toLowerCase()).buffer);
  if (!safeEqual(expected, supplied)) {
    throw new HttpError(403, "啟用密碼不正確，未能建立旅記。");
  }
}

export function isPin(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

export function readSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name === SESSION_COOKIE) return valueParts.join("=") || null;
  }
  return null;
}

export async function getSettings(d1: AppD1): Promise<SettingRow | null> {
  const result = await d1.prepare("SELECT id, pin_salt, pin_hash FROM settings WHERE id = ? LIMIT 1").bind("household").all<SettingRow>();
  return result.results[0] ?? null;
}

export async function getAttempt(d1: AppD1, key = ATTEMPT_KEY): Promise<AttemptRow | null> {
  const result = await d1.prepare("SELECT id, failed_count, locked_until FROM auth_attempts WHERE id = ? LIMIT 1").bind(key).all<AttemptRow>();
  return result.results[0] ?? null;
}

function activeLock(attempt: AttemptRow | null, now: number): number {
  const lockedUntil = attempt?.locked_until ? Date.parse(attempt.locked_until) : 0;
  return lockedUntil > now ? lockedUntil : 0;
}

export async function recordSetupFailure(
  d1: AppD1,
  now = Date.now(),
): Promise<FailedAttemptResult | null> {
  const nowIsoValue = new Date(now).toISOString();
  const nextLockedUntil = new Date(now + LOCKOUT_MS).toISOString();
  const result = await d1
    .prepare(FAILED_SETUP_ATTEMPT_SQL)
    .bind(SETUP_ATTEMPT_KEY, nowIsoValue, LOCKOUT_AFTER, nextLockedUntil)
    .all<FailedAttemptResult>();
  return result.results[0] ?? null;
}

async function prepareSession(now = Date.now()): Promise<{
  id: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  cookie: string;
}> {
  const token = toBase64Url(randomBytes(32));
  const tokenHash = await digestHex(new TextEncoder().encode(token).buffer);
  return {
    id: newId(),
    tokenHash,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_MAX_AGE_MS).toISOString(),
    cookie: sessionCookie(token),
  };
}

export async function createSession(d1: AppD1): Promise<{ cookie: string }> {
  const session = await prepareSession();
  await d1
    .prepare("INSERT INTO auth_sessions (id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(session.id, session.tokenHash, session.createdAt, session.expiresAt)
    .run();
  return { cookie: session.cookie };
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export async function requireSession(request: Request): Promise<{ d1: AppD1; tokenHash: string }> {
  const d1 = await ensureSchema();
  const token = readSessionToken(request);
  if (!token) throw new HttpError(401, "請先解鎖旅記。");
  const tokenHash = await digestHex(new TextEncoder().encode(token).buffer);
  const result = await d1
    .prepare("SELECT id FROM auth_sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ? LIMIT 1")
    .bind(tokenHash, nowIso())
    .all<{ id: string }>();
  if (!result.results[0]) throw new HttpError(401, "登入已過期，請重新解鎖旅記。");
  return { d1, tokenHash };
}

export async function setupPin(d1: AppD1, pin: string): Promise<{ cookie: string }> {
  const salt = toBase64Url(randomBytes(16));
  const hash = await derivePinHash(pin, salt);
  const session = await prepareSession();
  const createdAt = nowIso();
  const lockCheckAt = Date.now();
  try {
    const results = await d1.batch([
      d1.prepare(CLAIM_SETTINGS_SQL).bind(
        ATTEMPT_KEY,
        salt,
        hash,
        createdAt,
        createdAt,
        ATTEMPT_KEY,
        SETUP_ATTEMPT_KEY,
        createdAt,
      ),
      d1.prepare(`
        INSERT INTO auth_attempts (id, failed_count, locked_until, updated_at)
        SELECT ?, 0, NULL, ?
        WHERE EXISTS (
          SELECT 1 FROM settings
          WHERE id = ? AND pin_salt = ? AND pin_hash = ?
        )
        ON CONFLICT(id) DO UPDATE SET
          failed_count = 0,
          locked_until = NULL,
          updated_at = excluded.updated_at
      `).bind(ATTEMPT_KEY, createdAt, ATTEMPT_KEY, salt, hash),
      d1.prepare(`
        INSERT INTO auth_attempts (id, failed_count, locked_until, updated_at)
        SELECT ?, 0, NULL, ?
        WHERE EXISTS (
          SELECT 1 FROM settings
          WHERE id = ? AND pin_salt = ? AND pin_hash = ?
        )
        ON CONFLICT(id) DO UPDATE SET
          failed_count = 0,
          locked_until = NULL,
          updated_at = excluded.updated_at
      `).bind(SETUP_ATTEMPT_KEY, createdAt, ATTEMPT_KEY, salt, hash),
      d1.prepare(`
        INSERT INTO auth_sessions (id, token_hash, created_at, expires_at)
        SELECT ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM settings
          WHERE id = ? AND pin_salt = ? AND pin_hash = ?
        )
      `).bind(session.id, session.tokenHash, session.createdAt, session.expiresAt, ATTEMPT_KEY, salt, hash),
    ]);
    if ((results[0]?.meta?.changes ?? 0) !== 1 || (results[3]?.meta?.changes ?? 0) !== 1) {
      const existing = await getSettings(d1);
      if (existing) throw new HttpError(409, "旅記 PIN 已經設定，請輸入 PIN 解鎖。");
      const setupLock = activeLock(await getAttempt(d1, SETUP_ATTEMPT_KEY), lockCheckAt);
      if (setupLock > lockCheckAt) {
        throw new HttpError(429, "啟用嘗試次數已達上限，請稍後再試。", {
          retryAfterSeconds: Math.ceil((setupLock - lockCheckAt) / 1000),
        });
      }
      throw new HttpError(409, "未能建立旅記，請稍後再試。");
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Error && /constraint failed|unique constraint|already exists/i.test(error.message)) {
      throw new HttpError(409, "旅記 PIN 已經設定，請輸入 PIN 解鎖。");
    }
    throw error;
  }
  return { cookie: session.cookie };
}

export async function unlockPin(d1: AppD1, pin: string): Promise<{ cookie: string }> {
  const settings = await getSettings(d1);
  if (!settings) throw new HttpError(409, "請先建立 PIN。");
  const attempt = await getAttempt(d1);
  const now = Date.now();
  const lockedUntil = activeLock(attempt, now);
  if (lockedUntil > now) {
    throw new HttpError(429, "PIN 嘗試次數已達上限，請稍後再試。", {
      retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000),
    });
  }

  const hash = await derivePinHash(pin, settings.pin_salt);
  if (!safeEqual(hash, settings.pin_hash)) {
    const nowIsoValue = new Date(now).toISOString();
    const nextLockedUntil = new Date(now + LOCKOUT_MS).toISOString();
    const failureResult = await d1
      .prepare(FAILED_PIN_ATTEMPT_SQL)
      .bind(
        ATTEMPT_KEY,
        nowIsoValue,
        ATTEMPT_KEY,
        settings.pin_salt,
        settings.pin_hash,
        LOCKOUT_AFTER,
        nextLockedUntil,
      )
      .all<FailedAttemptResult>();
    const failedAttempt = failureResult.results[0];
    if (!failedAttempt) {
      throw new HttpError(401, "PIN 已經更新，請用新 PIN 重新解鎖旅記。");
    }
    const returnedLockedUntil = failedAttempt.locked_until ? Date.parse(failedAttempt.locked_until) : 0;
    if (returnedLockedUntil > now) {
      throw new HttpError(429, "PIN 嘗試次數已達上限，請 15 分鐘後再試。", {
        retryAfterSeconds: Math.ceil((returnedLockedUntil - now) / 1000),
      });
    }
    throw new HttpError(401, "PIN 不正確，請再試一次。", {
      remainingAttempts: LOCKOUT_AFTER - failedAttempt.failed_count,
    });
  }

  const session = await prepareSession(now);
  const results = await d1.batch([
    d1.prepare(`
      INSERT INTO auth_attempts (id, failed_count, locked_until, updated_at)
      SELECT ?, 0, NULL, ?
      WHERE EXISTS (SELECT 1 FROM settings WHERE id = ? AND pin_salt = ? AND pin_hash = ?)
      ON CONFLICT(id) DO UPDATE SET
        failed_count = 0,
        locked_until = NULL,
        updated_at = excluded.updated_at
    `).bind(ATTEMPT_KEY, nowIso(), ATTEMPT_KEY, settings.pin_salt, settings.pin_hash),
    d1.prepare(`
      INSERT INTO auth_sessions (id, token_hash, created_at, expires_at)
      SELECT ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM settings WHERE id = ? AND pin_salt = ? AND pin_hash = ?)
    `).bind(session.id, session.tokenHash, session.createdAt, session.expiresAt, ATTEMPT_KEY, settings.pin_salt, settings.pin_hash),
  ]);
  if ((results[1].meta?.changes ?? 0) !== 1) {
    throw new HttpError(401, "PIN 已經更新，請用新 PIN 重新解鎖旅記。");
  }
  return { cookie: session.cookie };
}

/** Rotate the shared PIN and invalidate every older browser session atomically. */
export async function resetPin(d1: AppD1, currentTokenHash: string, pin: string): Promise<{ cookie: string }> {
  const currentSettings = await getSettings(d1);
  if (!currentSettings) throw new HttpError(409, "請先建立 PIN。");

  const salt = toBase64Url(randomBytes(16));
  const hash = await derivePinHash(pin, salt);
  const session = await prepareSession();
  const updatedAt = nowIso();
  const results = await d1.batch([
    d1.prepare(`
      UPDATE settings
      SET pin_salt = ?, pin_hash = ?, updated_at = ?
      WHERE id = ?
        AND pin_salt = ?
        AND pin_hash = ?
        AND EXISTS (
          SELECT 1 FROM auth_sessions
          WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?
        )
    `).bind(salt, hash, updatedAt, ATTEMPT_KEY, currentSettings.pin_salt, currentSettings.pin_hash, currentTokenHash, updatedAt),
    d1.prepare(`
      INSERT INTO auth_attempts (id, failed_count, locked_until, updated_at)
      SELECT ?, 0, NULL, ?
      WHERE EXISTS (SELECT 1 FROM settings WHERE id = ? AND pin_salt = ? AND pin_hash = ?)
      ON CONFLICT(id) DO UPDATE SET
        failed_count = 0,
        locked_until = NULL,
        updated_at = excluded.updated_at
    `).bind(ATTEMPT_KEY, updatedAt, ATTEMPT_KEY, salt, hash),
    d1.prepare(`
      UPDATE auth_sessions
      SET revoked_at = ?
      WHERE revoked_at IS NULL
        AND EXISTS (SELECT 1 FROM settings WHERE id = ? AND pin_salt = ? AND pin_hash = ?)
    `).bind(updatedAt, ATTEMPT_KEY, salt, hash),
    d1.prepare(`
      INSERT INTO auth_sessions (id, token_hash, created_at, expires_at)
      SELECT ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM settings WHERE id = ? AND pin_salt = ? AND pin_hash = ?)
    `).bind(session.id, session.tokenHash, session.createdAt, session.expiresAt, ATTEMPT_KEY, salt, hash),
  ]);

  if ((results[0].meta?.changes ?? 0) !== 1 || (results[3].meta?.changes ?? 0) !== 1) {
    throw new HttpError(401, "登入狀態已改變，請重新解鎖後再設定 PIN。");
  }
  return { cookie: session.cookie };
}

export async function revokeSession(d1: AppD1, tokenHash: string): Promise<void> {
  await d1.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").bind(nowIso(), tokenHash).run();
}
