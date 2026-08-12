import { errorResponse, HttpError, jsonResponse, newId, nowIso, readJson } from "@/db";
import { requireSession } from "@/lib/auth";
import { loadImprovementNotes } from "@/lib/improvement-data";
import { improvementStatusField, objectBody, stringField } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { d1 } = await requireSession(request);
    return jsonResponse({ notes: await loadImprovementNotes(d1) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { d1 } = await requireSession(request);
    const body = objectBody(await readJson(request));
    const noteBody = stringField(body.body, "想改善的事", { max: 500 });
    const status = improvementStatusField(body.status);
    const id = newId();
    const now = nowIso();
    await d1.prepare("INSERT INTO improvement_notes (id, body, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").bind(id, noteBody, status, now, now).run();
    const notes = await loadImprovementNotes(d1);
    return jsonResponse({ note: notes.find((note) => note.id === id), notes }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { d1 } = await requireSession(request);
    const body = objectBody(await readJson(request));
    const id = stringField(body.id, "改善事項 ID", { max: 80 });
    const existing = await d1.prepare("SELECT id, body, status FROM improvement_notes WHERE id = ? AND archived_at IS NULL LIMIT 1").bind(id).all<{ id: string; body: string; status: string }>();
    if (!existing.results[0]) throw new HttpError(404, "找不到這項改善事項。");
    if (body.archived === true) {
      await d1.prepare("UPDATE improvement_notes SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL").bind(nowIso(), nowIso(), id).run();
    } else {
      const noteBody = body.body === undefined ? existing.results[0].body : stringField(body.body, "想改善的事", { max: 500 });
      const status = body.status === undefined ? improvementStatusField(existing.results[0].status) : improvementStatusField(body.status);
      await d1.prepare("UPDATE improvement_notes SET body = ?, status = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL").bind(noteBody, status, nowIso(), id).run();
    }
    return jsonResponse({ notes: await loadImprovementNotes(d1) });
  } catch (error) {
    return errorResponse(error);
  }
}
