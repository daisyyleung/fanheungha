"use client";

import { FormEvent, useState } from "react";
import type { ImprovementNote } from "@/lib/improvement-data";
import { requestJson } from "./client-api";
import { Notice } from "./SharedUi";

export function ImprovementsView({
  notes,
  onChange,
}: {
  notes: ImprovementNote[];
  onChange: (notes: ImprovementNote[]) => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    setError("");
    try {
      const data = await requestJson<{ notes: ImprovementNote[] }>("/api/improvements", {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      onChange(data.notes);
      setBody("");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "未能加入改善事項。",
      );
    }
  }

  async function update(note: ImprovementNote, nextBody: string, status: "open" | "done") {
    setError("");
    try {
      const data = await requestJson<{ notes: ImprovementNote[] }>("/api/improvements", {
        method: "PATCH",
        body: JSON.stringify({ id: note.id, body: nextBody, status }),
      });
      onChange(data.notes);
      setEditingId(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "未能更新改善事項。");
    }
  }

  return (
    <section className="dashboard-view improvements-view">
      <div className="page-heading">
        <div className="eyebrow">把經驗留給下一趟</div>
        <h1>想改善</h1>
        <p className="page-intro">記下下次想調整的小事，完成後可以標記為已完成。</p>
      </div>
      <form className="improvement-form" onSubmit={add}>
        <label htmlFor="new-improvement">下一次想改善甚麼？</label>
        <div>
          <textarea
            id="new-improvement"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="例：下次預早訂好行李寄送"
          />
          <button className="primary-button" type="submit">
            加入想改善
          </button>
        </div>
      </form>
      {error && <Notice message={error} />}
      {notes.length === 0 ? (
        <p className="muted-copy">還未有記錄，旅程後寫下一件就好。</p>
      ) : (
        <div className="improvement-list">
          {notes.map((note) =>
            editingId === note.id ? (
              <ImprovementEditor
                key={note.id}
                note={note}
                onSave={(nextBody) => update(note, nextBody, note.status)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <article
                className={`improvement-card ${note.status === "done" ? "done" : ""}`}
                key={note.id}
              >
                <div>
                  <span className="status-pill">
                    {note.status === "done" ? "已完成" : "開放中"}
                  </span>
                  <p>{note.body}</p>
                </div>
                <div className="row-actions">
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => update(note, note.body, note.status === "done" ? "open" : "done")}
                  >
                    {note.status === "done" ? "重新開放" : "標記完成"}
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setEditingId(note.id)}
                  >
                    編輯
                  </button>
                </div>
              </article>
            ),
          )}
        </div>
      )}
    </section>
  );
}

function ImprovementEditor({
  note,
  onSave,
  onCancel,
}: {
  note: ImprovementNote;
  onSave: (body: string) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(note.body);
  return (
    <form
      className="improvement-card editor-card"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(body);
      }}
    >
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={500}
        rows={3}
        required
      />
      <div className="editor-actions">
        <button className="secondary-button" type="submit">
          儲存
        </button>
        <button className="quiet-button" type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}
