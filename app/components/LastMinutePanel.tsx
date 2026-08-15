"use client";

import { FormEvent, useState } from "react";
import type { LastMinuteRecord, TripAggregate } from "@/lib/trip-data";
import { requestJson } from "./client-api";
import { MoveButtons, Notice, ProgressBar } from "./SharedUi";
import { swapIds } from "./trip-ui";

function LastMinuteEditor({
  item,
  trip,
  onChange,
  onCancel,
}: {
  item: LastMinuteRecord;
  trip: TripAggregate;
  onChange: (trip: TripAggregate) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/items`,
        {
          method: "PATCH",
          body: JSON.stringify({ kind: "lastMinute", id: item.id, label }),
        },
      );
      onChange(data.trip);
      onCancel();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "未能更新檢查項目。",
      );
    }
  }

  return (
    <form className="card-editor compact-editor" onSubmit={save}>
      <label>
        檢查項目
        <input value={label} onChange={(event) => setLabel(event.target.value)} required />
      </label>
      {error && <Notice message={error} />}
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

export function LastMinutePanel({
  trip,
  onChange,
}: {
  trip: TripAggregate;
  onChange: (trip: TripAggregate) => void;
}) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const done = trip.lastMinute.filter((item) => item.checked).length;

  async function toggle(item: LastMinuteRecord) {
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/items`,
        {
          method: "PATCH",
          body: JSON.stringify({ kind: "lastMinute", id: item.id, checked: !item.checked }),
        },
      );
      onChange(data.trip);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "未能更新最後檢查。");
    }
  }

  async function update(item: LastMinuteRecord, change: Record<string, unknown>) {
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/items`,
        {
          method: "PATCH",
          body: JSON.stringify({ kind: "lastMinute", id: item.id, ...change }),
        },
      );
      onChange(data.trip);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "未能更新最後檢查。");
    }
  }

  async function reorder(order: string[]) {
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/items`,
        {
          method: "PATCH",
          body: JSON.stringify({ kind: "lastMinute", order }),
        },
      );
      onChange(data.trip);
    } catch (reorderError) {
      setError(
        reorderError instanceof Error ? reorderError.message : "未能調整最後檢查次序。",
      );
    }
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!label.trim()) return;
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/items`,
        {
          method: "POST",
          body: JSON.stringify({ kind: "lastMinute", label }),
        },
      );
      onChange(data.trip);
      setLabel("");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "未能加入檢查項目。",
      );
    }
  }

  return (
    <section className="panel-content" aria-labelledby="last-minute-heading">
      <div className="section-heading">
        <div>
          <div className="eyebrow">出門前的最後確認</div>
          <h2 id="last-minute-heading">臨出發</h2>
        </div>
        <span className="section-count">
          {done}/{trip.lastMinute.length}
        </span>
      </div>
      <p className="panel-intro">出發前一天逐項看過，放心把家門鎖上。</p>
      <ProgressBar done={done} total={trip.lastMinute.length} label="最後確認" />
      {error && <Notice message={error} />}
      <div className="last-minute-list">
        {trip.lastMinute.map((item, index) =>
          editingId === item.id ? (
            <LastMinuteEditor
              key={item.id}
              item={item}
              trip={trip}
              onChange={onChange}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div className={`check-row last-minute-row ${item.checked ? "checked" : ""}`} key={item.id}>
              <label>
                <input type="checkbox" checked={item.checked} onChange={() => toggle(item)} />
                <span className="fake-check" aria-hidden="true" />
                <span>{item.label}</span>
                {item.checkedAt && <time dateTime={item.checkedAt}>已確認</time>}
              </label>
              <div className="row-actions">
                <MoveButtons
                  index={index}
                  total={trip.lastMinute.length}
                  label={item.label}
                  onMove={(direction) =>
                    reorder(swapIds(trip.lastMinute.map((entry) => entry.id), index, direction))
                  }
                />
                <button className="text-button" type="button" onClick={() => setEditingId(item.id)}>
                  編輯
                </button>
                <button
                  className="text-button danger-text-button"
                  type="button"
                  onClick={() => update(item, { archived: true })}
                  aria-label={`收起臨出發項目：${item.label}`}
                >
                  收起
                </button>
              </div>
            </div>
          ),
        )}
      </div>
      <form className="add-row-form" onSubmit={add}>
        <label htmlFor="custom-last-minute">加入自訂檢查</label>
        <div className="add-row-controls">
          <input
            id="custom-last-minute"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="例：提醒鄰居收信"
          />
          <button className="secondary-button" type="submit">
            加入
          </button>
        </div>
      </form>
    </section>
  );
}
