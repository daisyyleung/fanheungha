import { ensureSchema, errorResponse, HttpError, jsonResponse, readJson } from "@/db";
import {
  getAttempt,
  type FailedAttemptResult,
  isOwnerSetupSecret,
  isPin,
  recordSetupFailure,
  SETUP_ATTEMPT_KEY,
  setupPin,
  verifyOwnerSetupSecret,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (contentType !== "application/json") {
      throw new HttpError(415, "請以 JSON 格式提交啟用資料。");
    }
    const requestOrigin = request.headers.get("origin");
    if (!requestOrigin || requestOrigin !== new URL(request.url).origin) {
      throw new HttpError(403, "未能確認呢次旅記啟用要求。");
    }
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpError(400, "請輸入啟用密碼及兩次相同的 PIN。");
    }
    const unexpectedKeys = Object.keys(body).filter((key) => !["setupSecret", "pin", "confirmPin"].includes(key));
    if (unexpectedKeys.length > 0) throw new HttpError(400, "啟用資料欄位不正確。");
    const { setupSecret, pin, confirmPin } = body as { setupSecret?: unknown; pin?: unknown; confirmPin?: unknown };
    const setupSecretWellFormed = isOwnerSetupSecret(setupSecret);
    let secretMismatch = false;
    try {
      await verifyOwnerSetupSecret(setupSecret);
    } catch (error) {
      if (error instanceof HttpError && error.status === 403) {
        secretMismatch = true;
      } else {
        throw error;
      }
    }
    const d1 = await ensureSchema();
    const now = Date.now();
    const setupAttempt = await getAttempt(d1, SETUP_ATTEMPT_KEY);
    const lockedUntil = setupAttempt?.locked_until ? Date.parse(setupAttempt.locked_until) : 0;
    if (lockedUntil > now) {
      throw new HttpError(429, "啟用嘗試次數已達上限，請稍後再試。", {
        retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000),
      });
    }
    if (secretMismatch) {
      let failure: FailedAttemptResult | null = null;
      if (setupSecretWellFormed) {
        failure = await recordSetupFailure(d1, now);
        if (failure?.locked_until) {
          const failureLockedUntil = Date.parse(failure.locked_until);
          if (failureLockedUntil > now) {
            throw new HttpError(429, "啟用嘗試次數已達上限，請稍後再試。", {
              retryAfterSeconds: Math.ceil((failureLockedUntil - now) / 1000),
            });
          }
        }
      }
      throw new HttpError(
        403,
        "啟用密碼不正確，未能建立旅記。",
        setupSecretWellFormed
          ? { remainingAttempts: Math.max(0, 5 - (failure?.failed_count ?? 1)) }
          : undefined,
      );
    }
    if (!isPin(pin) || !isPin(confirmPin)) throw new HttpError(400, "PIN 必須是 6 位數字。");
    if (pin !== confirmPin) throw new HttpError(400, "兩次 PIN 不一致，請再確認一次。");
    const result = await setupPin(d1, pin);
    return jsonResponse({ state: "unlocked" }, 201, { "set-cookie": result.cookie });
  } catch (error) {
    return errorResponse(error);
  }
}
