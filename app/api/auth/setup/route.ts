import { ensureSchema, errorResponse, HttpError, jsonResponse, readJson } from "@/db";
import { isOwnerSetupSecret, isPin, setupPin, verifyOwnerSetupSecret } from "@/lib/auth";

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
    if (!isOwnerSetupSecret(setupSecret)) throw new HttpError(403, "啟用密碼不正確，未能建立旅記。");
    await verifyOwnerSetupSecret(setupSecret);
    if (!isPin(pin) || !isPin(confirmPin)) throw new HttpError(400, "PIN 必須是 6 位數字。");
    if (pin !== confirmPin) throw new HttpError(400, "兩次 PIN 不一致，請再確認一次。");
    const d1 = await ensureSchema();
    const result = await setupPin(d1, pin);
    return jsonResponse({ state: "unlocked" }, 201, { "set-cookie": result.cookie });
  } catch (error) {
    return errorResponse(error);
  }
}
