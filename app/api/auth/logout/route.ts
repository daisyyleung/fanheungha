import { errorResponse, HttpError, jsonResponse } from "@/db";
import { clearSessionCookie, requireSession, revokeSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (contentType !== "application/json") {
      throw new HttpError(415, "請以 JSON 格式提交鎖上要求。");
    }
    const requestOrigin = request.headers.get("origin");
    if (!requestOrigin || requestOrigin !== new URL(request.url).origin) {
      throw new HttpError(403, "未能確認呢次鎖上旅記要求。");
    }
    const { d1, tokenHash } = await requireSession(request);
    await revokeSession(d1, tokenHash);
    return jsonResponse({ state: "locked" }, 200, { "set-cookie": clearSessionCookie() });
  } catch (error) {
    return errorResponse(error);
  }
}
