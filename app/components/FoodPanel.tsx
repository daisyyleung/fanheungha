"use client";

import { FormEvent, useState } from "react";
import type { FoodRecord, ListSectionRecord, TripAggregate } from "@/lib/trip-data";
import { requestJson } from "./client-api";
import { MoveButtons, Notice } from "./SharedUi";
import { swapIds } from "./trip-ui";

function FoodEditor({
  item,
  trip,
  onChange,
  onCancel,
}: {
  item: FoodRecord;
  trip: TripAggregate;
  onChange: (trip: TripAggregate) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: item.name,
    shop: item.shop,
    link: item.link,
    note: item.note,
  });
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/items`,
        {
          method: "PATCH",
          body: JSON.stringify({ kind: "food", id: item.id, ...form }),
        },
      );
      onChange(data.trip);
      onCancel();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "未能更新想食／飲項目。",
      );
    }
  }

  return (
    <form className="card-editor" onSubmit={save}>
      <div className="form-grid two-columns">
        <label>
          食物／飲品名稱
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
        </label>
        <label>
          便利店／店舖（可選）
          <input
            value={form.shop}
            onChange={(event) => setForm({ ...form, shop: event.target.value })}
            placeholder="例：7-Eleven"
          />
        </label>
        <label>
          安全連結（可選）
          <input
            type="url"
            value={form.link}
            onChange={(event) => setForm({ ...form, link: event.target.value })}
            placeholder="https://…"
          />
        </label>
        <label>
          備註（可選）
          <input
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        </label>
      </div>
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

export function FoodPanel({
  trip,
  onChange,
}: {
  trip: TripAggregate;
  onChange: (trip: TripAggregate) => void;
}) {
  const [form, setForm] = useState({ name: "", shop: "", link: "", note: "" });
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const tried = trip.food.filter((item) => item.tried).length;

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/items`,
        {
          method: "POST",
          body: JSON.stringify({ kind: "food", ...form }),
        },
      );
      onChange(data.trip);
      setForm({ name: "", shop: "", link: "", note: "" });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "未能加入想食／飲清單。",
      );
    }
  }

  async function update(item: FoodRecord, change: Record<string, unknown>) {
    setError("");
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/items`,
        {
          method: "PATCH",
          body: JSON.stringify({ kind: "food", id: item.id, ...change }),
        },
      );
      onChange(data.trip);
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "未能更新想食／飲項目。",
      );
    }
  }

  async function reorderSection(order: string[]) {
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/sections`,
        {
          method: "PATCH",
          body: JSON.stringify({ kind: "food", order }),
        },
      );
      onChange(data.trip);
    } catch (reorderError) {
      setError(
        reorderError instanceof Error ? reorderError.message : "未能調整店舖分組次序。",
      );
    }
  }

  async function reorderItems(sectionId: string, order: string[]) {
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/items`,
        {
          method: "PATCH",
          body: JSON.stringify({ kind: "food", sectionId, order }),
        },
      );
      onChange(data.trip);
    } catch (reorderError) {
      setError(
        reorderError instanceof Error ? reorderError.message : "未能調整想食／飲項目次序。",
      );
    }
  }

  async function archiveSection(section: ListSectionRecord) {
    if (!window.confirm(`收起「${section.name}」？旗下項目會暫時隱藏，但資料可以在已收起項目還原。`)) {
      return;
    }
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/sections`,
        {
          method: "PATCH",
          body: JSON.stringify({ kind: "food", id: section.id, archived: true }),
        },
      );
      onChange(data.trip);
    } catch (archiveError) {
      setError(
        archiveError instanceof Error ? archiveError.message : "未能收起店舖分組。",
      );
    }
  }

  function renderSection(section: ListSectionRecord, sections: ListSectionRecord[]) {
    const items = trip.food.filter((item) => item.sectionId === section.id);
    const ids = items.map((item) => item.id);
    const isLegacySection = section.id.startsWith("legacy:");
    const reorderableSections = sections.filter((value) => !value.id.startsWith("legacy:"));
    const reorderableIndex = reorderableSections.findIndex((value) => value.id === section.id);
    return (
      <section className="place-section" key={section.id}>
        <div className="place-section-heading">
          <div>
            <h3>{section.name}</h3>
            <span>{items.length} 件</span>
          </div>
          {!isLegacySection && (
            <div className="row-actions">
              <MoveButtons
                index={reorderableIndex}
                total={reorderableSections.length}
                label={section.name}
                onMove={(direction) =>
                  reorderSection(swapIds(reorderableSections.map((value) => value.id), reorderableIndex, direction))
                }
              />
              <button
                className="text-button danger-text-button"
                type="button"
                onClick={() => archiveSection(section)}
              >
                收起
              </button>
            </div>
          )}
        </div>
        {isLegacySection && (
          <p className="muted-copy">舊有項目仍然完整顯示；編輯或勾選後會安全加入店舖分組。</p>
        )}
        {items.length === 0 ? (
          <p className="muted-copy">這個分組暫時沒有項目。</p>
        ) : (
          <div className="food-list">
            {items.map((item, itemIndex) =>
              editingId === item.id ? (
                <FoodEditor
                  key={item.id}
                  item={item}
                  trip={trip}
                  onChange={onChange}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <article className={`food-row ${item.tried ? "tried" : ""}`} key={item.id}>
                  <label className="food-check">
                    <input
                      type="checkbox"
                      checked={item.tried}
                      onChange={() => update(item, { tried: !item.tried })}
                    />
                    <span className="fake-check" aria-hidden="true" />
                    <span>{item.name}</span>
                  </label>
                  <span className="food-meta">{item.shop || "店舖待定"}</span>
                  {item.link && (
                    <a href={item.link} target="_blank" rel="noreferrer">
                      開啟連結
                    </a>
                  )}
                  <div className="row-actions">
                    {!isLegacySection && (
                      <MoveButtons
                        index={itemIndex}
                        total={items.length}
                        label={item.name}
                        onMove={(direction) =>
                          reorderItems(section.id, swapIds(ids, itemIndex, direction))
                        }
                      />
                    )}
                    <button className="text-button" type="button" onClick={() => setEditingId(item.id)}>
                      編輯
                    </button>
                    <button
                      className="text-button danger-text-button"
                      type="button"
                      onClick={() => update(item, { archived: true })}
                      aria-label={`收起想食／飲項目：${item.name}`}
                    >
                      收起
                    </button>
                  </div>
                  {item.note && <small>{item.note}</small>}
                </article>
              ),
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="panel-content" aria-labelledby="food-heading">
      <div className="section-heading">
        <div>
          <div className="eyebrow">先記低旅途想試的味道</div>
          <h2 id="food-heading">想食／飲</h2>
        </div>
        <span className="section-count">
          {tried}/{trip.food.length} 已食
        </span>
      </div>
      {error && <Notice message={error} />}
      {trip.foodSections.length === 0 ? (
        <p className="muted-copy">還沒有想試的食物。便利店、店舖和連結都可以之後再補。</p>
      ) : (
        <div className="place-sections">
          {trip.foodSections.map((section) => renderSection(section, trip.foodSections))}
        </div>
      )}
      <form className="inline-form food-form" onSubmit={add}>
        <h3>加入想食／飲</h3>
        <div className="form-grid two-columns">
          <label>
            食物／飲品名稱
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="例：明太子飯糰"
              required
            />
          </label>
          <label>
            便利店／店舖（可選）
            <input
              value={form.shop}
              onChange={(event) => setForm({ ...form, shop: event.target.value })}
              placeholder="例：7-Eleven"
            />
          </label>
          <label>
            安全連結（可選）
            <input
              type="url"
              value={form.link}
              onChange={(event) => setForm({ ...form, link: event.target.value })}
              placeholder="https://…"
            />
          </label>
          <label>
            備註（可選）
            <input
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </label>
        </div>
        {error && <Notice message={error} />}
        <button className="secondary-button" type="submit">
          加入清單
        </button>
      </form>
    </section>
  );
}
