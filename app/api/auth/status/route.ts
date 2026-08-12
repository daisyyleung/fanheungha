import { ensureSchema, errorResponse, jsonResponse } from "@/db";
import { getSettings, readSessionToken, requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const d1 = await ensureSchema();
    const settings = await getSettings(d1);
    if (!settings) return jsonResponse({ state: "setup" });
    try {
      await requireSession(request);
      return jsonResponse({ state: "unlocked" });
    } catch {
      return jsonResponse({ state: "locked", hasSession: Boolean(readSessionToken(request)) });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
