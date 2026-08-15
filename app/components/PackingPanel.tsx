"use client";

import { FormEvent, useMemo, useState } from "react";
import { PACKING_CATEGORIES, SEASON_LABELS, type Season } from "@/lib/packing-templates";
import type { PackingRecord, TripAggregate } from "@/lib/trip-data";
import { requestJson } from "./client-api";
import { type PackingFilter } from "./contracts";
import { MoveButtons, Notice, ProgressBar } from "./SharedUi";
import { swapIds } from "./trip-ui";

function PackingEditor({
  item,
  trip,
  onChange,
  onCancel,
}: {
  item: PackingRecord;
  trip: TripAggregate;
  onChange: (trip: TripAggregate) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [category, setCategory] = useState(item.category);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/items`,
        {
          method: "PATCH",
          body: JSON.stringify({ kind: "packing", id: item.id, label, category }),
        },
      );
      onChange(data.trip);
      onCancel();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "未能更新行李項目。",
      );
    }
  }

  return (
    <form className="card-editor compact-editor" onSubmit={save}>
      <label>
        物品名稱
        <input value={label} onChange={(event) => setLabel(event.target.value)} required />
      </label>
      <label>
        分類
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {PACKING_CATEGORIES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
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

export function PackingPanel({
  trip,
  onChange,
}: {
  trip: TripAggregate;
  onChange: (trip: TripAggregate) => void;
}) {
  const [filter, setFilter] = useState<PackingFilter>("all");
  const [customLabel, setCustomLabel] = useState("");
  const [customCategory, setCustomCategory] = useState("其他");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const done = trip.packing.filter((item) => item.checked).length;
  const groups = useMemo(
    () =>
      PACKING_CATEGORIES.map((category) => ({
        category,
        items: trip.packing.filter(
          (item) =>
            item.category === category &&
            (filter === "all" ||
              (filter === "complete" ? item.checked : !item.checked)),
        ),
      })).filter((group) => group.items.length > 0),
    [filter, trip.packing],
  );

  async function toggle(item: PackingRecord) {
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/items`,
        {
          method: "PATCH",
          body: JSON.stringify({ kind: "packing", id: item.id, checked: !item.checked }),
        },
      );
      onChange(data.trip);
    } catch (toggleError) {
      setError(
        toggleError instanceof Error ? toggleError.message : "未能更新行李狀態。",
      );
    }
  }

  async function reorder(category: string, order: string[]) {
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/items`,
        {
          method: "PATCH",
          body: JSON.stringify({ kind: "packing", category, order }),
        },
      );
      onChange(data.trip);
    } catch (reorderError) {
      setError(
        reorderError instanceof Error ? reorderError.message : "未能調整行李項目次序。",
      );
    }
  }

  async function deleteItem(item: PackingRecord) {
    if (!window.confirm(`刪除「${item.label}」？項目會從執行李清單移除，但 D1 紀錄仍會保留。`)) {
      return;
    }
    setError("");
    setDeletingId(item.id);
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/items`,
        {
          method: "PATCH",
          body: JSON.stringify({ kind: "packing", id: item.id, archived: true }),
        },
      );
      onChange(data.trip);
    } catch (deletionError) {
      setError(
        deletionError instanceof Error ? deletionError.message : "未能刪除行李項目。",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function addCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customLabel.trim()) return;
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/items`,
        {
          method: "POST",
          body: JSON.stringify({
            kind: "packing",
            label: customLabel,
            category: customCategory,
          }),
        },
      );
      onChange(data.trip);
      setCustomLabel("");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "未能加入物品。",
      );
    }
  }

  return (
    <section className="panel-content" aria-labelledby="packing-heading">
      <div className="section-heading">
        <div>
          <div className="eyebrow">從參考清單開始</div>
          <h2 id="packing-heading">執行李</h2>
        </div>
        <span className="season-stamp">{SEASON_LABELS[trip.trip.season as Season]}</span>
      </div>
      <ProgressBar done={done} total={trip.packing.length} label="收拾進度" />
      <div className="filter-row" aria-label="執行李篩選">
        {(["all", "outstanding", "complete"] as PackingFilter[]).map((value) => (
          <button
            className={filter === value ? "filter-button active" : "filter-button"}
            type="button"
            key={value}
            onClick={() => setFilter(value)}
          >
            {value === "all" ? "全部" : value === "outstanding" ? "未完成" : "已完成"}
          </button>
        ))}
      </div>
      {error && <Notice message={error} />}
      {filter !== "all" && (
        <p className="small-note">先切換至「全部」後再調整排序，避免漏掉同分類項目。</p>
      )}
      <div className="packing-groups">
        {groups.map((group) => {
          const allCategoryItems = trip.packing.filter(
            (item) => item.category === group.category,
          );
          const ids = allCategoryItems.map((item) => item.id);
          return (
            <div className="packing-group" key={group.category}>
              <h3>
                {group.category}
                <span>{group.items.length}</span>
              </h3>
              {group.items.map((item) => {
                const itemIndex = allCategoryItems.findIndex((entry) => entry.id === item.id);
                return editingId === item.id ? (
                  <PackingEditor
                    item={item}
                    trip={trip}
                    onChange={onChange}
                    onCancel={() => setEditingId(null)}
                    key={item.id}
                  />
                ) : (
                  <div className={`check-row ${item.checked ? "checked" : ""}`} key={item.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggle(item)}
                      />
                      <span className="fake-check" aria-hidden="true" />
                      <span>{item.label}</span>
                    </label>
                    <div className="row-actions">
                      <MoveButtons
                        index={itemIndex}
                        total={allCategoryItems.length}
                        label={item.label}
                        disabled={filter !== "all"}
                        onMove={(direction) =>
                          reorder(group.category, swapIds(ids, itemIndex, direction))
                        }
                      />
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => setEditingId(item.id)}
                        disabled={deletingId === item.id}
                      >
                        編輯
                      </button>
                      <button
                        className="text-button danger-text-button"
                        type="button"
                        onClick={() => deleteItem(item)}
                        disabled={deletingId === item.id}
                        aria-label={`刪除執行李項目：${item.label}`}
                      >
                        {deletingId === item.id ? "刪除中…" : "刪除"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <form className="add-row-form" onSubmit={addCustom}>
        <label htmlFor="custom-packing">加入自訂物品</label>
        <div className="add-row-controls">
          <input
            id="custom-packing"
            value={customLabel}
            onChange={(event) => setCustomLabel(event.target.value)}
            placeholder="例：旅途的茶包"
          />
          <select
            value={customCategory}
            onChange={(event) => setCustomCategory(event.target.value)}
            aria-label="自訂物品分類"
          >
            {PACKING_CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
          <button className="secondary-button" type="submit">
            加入
          </button>
        </div>
      </form>
    </section>
  );
}
