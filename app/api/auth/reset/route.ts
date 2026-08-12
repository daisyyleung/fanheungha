import { errorResponse, HttpError, jsonResponse, readJson } from "@/db";
import { isPin, requireSession, resetPin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (contentType !== "application/json") {
      throw new HttpError(415, "請以 JSON 格式提交 PIN。");
    }

    const requestOrigin = request.headers.get("origin");
    if (!requestOrigin || requestOrigin !== new URL(request.url).origin) {
      throw new HttpError(403, "未能確認呢次 PIN 設定要求。");
    }

    const body = await readJson(request);
    if (!body || typeof body !== "object") {
      throw new HttpError(400, "請輸入新 PIN 及確認 PIN。");
    }
    const { pin, confirmPin } = body as { pin?: unknown; confirmPin?: unknown };
    if (!isPin(pin) || !isPin(confirmPin)) {
      throw new HttpError(400, "新 PIN 必須是 6 位數字。");
    }
    if (pin !== confirmPin) {
      throw new HttpError(400, "兩次 PIN 不一致，請再確認一次。");
    }

    const { d1, tokenHash } = await requireSession(request);
    const result = await resetPin(d1, tokenHash, pin);
    return jsonResponse({ state: "unlocked" }, 200, { "set-cookie": result.cookie });
  } catch (error) {
    return errorResponse(error);
  }
}
