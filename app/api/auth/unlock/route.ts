import { ensureSchema, errorResponse, HttpError, jsonResponse, readJson } from "@/db";
import { isPin, unlockPin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (contentType !== "application/json") {
      throw new HttpError(415, "請以 JSON 格式提交 PIN。");
    }
    const requestOrigin = request.headers.get("origin");
    if (!requestOrigin || requestOrigin !== new URL(request.url).origin) {
      throw new HttpError(403, "未能確認呢次解鎖要求。");
    }
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body) || !isPin((body as { pin?: unknown }).pin)) {
      throw new HttpError(400, "PIN 必須是 6 位數字。");
    }
    const d1 = await ensureSchema();
    const result = await unlockPin(d1, (body as { pin: string }).pin);
    return jsonResponse({ state: "unlocked" }, 200, { "set-cookie": result.cookie });
  } catch (error) {
    return errorResponse(error);
  }
}
