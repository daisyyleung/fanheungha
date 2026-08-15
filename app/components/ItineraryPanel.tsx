"use client";

import { FormEvent, useMemo, useState } from "react";
import type { ItineraryRecord, TripAggregate } from "@/lib/trip-data";
import {
  CATEGORY_LABELS,
  DAY_PERIOD_LABELS,
  DAY_PERIODS,
  groupItineraryByDate,
  ITINERARY_CATEGORIES,
  type DayPeriod,
  type ItineraryCategory,
} from "@/lib/trip-log";
import { requestJson } from "./client-api";
import { MoveButtons } from "./SharedUi";
import { Notice } from "./SharedUi";
import { swapIds } from "./trip-ui";

const dayPeriodOptions = DAY_PERIODS.map((value) => ({
  value,
  label: DAY_PERIOD_LABELS[value],
}));

function ItineraryEditor({
  item,
  trip,
  onChange,
  onCancel,
}: {
  item: ItineraryRecord;
  trip: TripAggregate;
  onChange: (trip: TripAggregate) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    itemDate: item.itemDate,
    dayPeriod: item.dayPeriod,
    itemTime: item.itemTime,
    title: item.title,
    category: item.category,
    location: item.location,
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
          body: JSON.stringify({ kind: "itinerary", id: item.id, ...form }),
        },
      );
      onChange(data.trip);
      onCancel();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "未能更新行程。");
    }
  }

  return (
    <form className="card-editor" onSubmit={save}>
      <div className="form-grid four-columns">
        <label>
          日期
          <input
            type="date"
            min={trip.trip.startDate}
            max={trip.trip.endDate}
            value={form.itemDate}
            onChange={(event) => setForm({ ...form, itemDate: event.target.value })}
            required
          />
        </label>
        <label>
          時段
          <select
            value={form.dayPeriod}
            onChange={(event) =>
              setForm({ ...form, dayPeriod: event.target.value as DayPeriod })
            }
          >
            {dayPeriodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          精確時間（可選）
          <input
            type="time"
            value={form.itemTime}
            onChange={(event) => setForm({ ...form, itemTime: event.target.value })}
          />
        </label>
        <label>
          分類
          <select
            value={form.category}
            onChange={(event) =>
              setForm({ ...form, category: event.target.value as ItineraryCategory })
            }
          >
            {ITINERARY_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-grid three-columns">
        <label>
          標題
          <input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            required
          />
        </label>
        <label>
          地點
          <input
            value={form.location}
            onChange={(event) => setForm({ ...form, location: event.target.value })}
          />
        </label>
        <label>
          備註
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

function ItineraryArchiveButton({
  item,
  tripId,
  onChange,
  label = "收起",
}: {
  item: ItineraryRecord;
  tripId: string;
  onChange: (trip: TripAggregate) => void;
  label?: string;
}) {
  const [pending, setPending] = useState(false);

  async function archive() {
    setPending(true);
    try {
      const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${tripId}/items`, {
        method: "PATCH",
        body: JSON.stringify({ kind: "itinerary", id: item.id, archived: true }),
      });
      onChange(data.trip);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      className="text-button"
      type="button"
      onClick={archive}
      disabled={pending}
      aria-label={`${label}：${item.title}`}
    >
      {label}
    </button>
  );
}

function ItineraryRow({
  item,
  trip,
  onChange,
  showDate = false,
  index,
  total,
  onMove,
}: {
  item: ItineraryRecord;
  trip: TripAggregate;
  onChange: (trip: TripAggregate) => void;
  showDate?: boolean;
  index?: number;
  total?: number;
  onMove?: (direction: "up" | "down") => void;
}) {
  const [editing, setEditing] = useState(false);
  const timeLabel = item.itemTime || DAY_PERIOD_LABELS[item.dayPeriod];

  return (
    <article className="itinerary-row">
      <time dateTime={item.itemTime ? `${item.itemDate}T${item.itemTime}` : item.itemDate}>
        {showDate ? item.itemDate.slice(5).replace("-", "/") : timeLabel}
        {showDate && <small>{timeLabel}</small>}
      </time>
      <div>
        {editing ? (
          <ItineraryEditor
            item={item}
            trip={trip}
            onChange={onChange}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <div className="entry-title-line">
              <span className="category-badge">{CATEGORY_LABELS[item.category]}</span>
              <h3>{item.title}</h3>
            </div>
            {item.location && <p>{item.location}</p>}
            {item.note && <small>{item.note}</small>}
          </>
        )}
      </div>
      {!editing && (
        <div className="row-actions">
          {onMove && index !== undefined && total !== undefined && (
            <MoveButtons
              index={index}
              total={total}
              label={item.title}
              onMove={onMove}
            />
          )}
          <button className="text-button" type="button" onClick={() => setEditing(true)}>
            編輯
          </button>
          <ItineraryArchiveButton item={item} tripId={trip.trip.id} onChange={onChange} />
        </div>
      )}
    </article>
  );
}

function WeatherSummary({
  item,
  trip,
  onChange,
}: {
  item: ItineraryRecord;
  trip: TripAggregate;
  onChange: (trip: TripAggregate) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="weather-block">
      {editing ? (
        <ItineraryEditor
          item={item}
          trip={trip}
          onChange={onChange}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <span className="weather-heading">
          <span>天氣：{item.title}</span>
          <button className="text-button" type="button" onClick={() => setEditing(true)}>
            編輯天氣
          </button>
          <ItineraryArchiveButton
            item={item}
            tripId={trip.trip.id}
            onChange={onChange}
            label="收起天氣"
          />
        </span>
      )}
    </div>
  );
}

export function ItineraryPanel({
  trip,
  onChange,
}: {
  trip: TripAggregate;
  onChange: (trip: TripAggregate) => void;
}) {
  const [form, setForm] = useState({
    itemDate: trip.trip.startDate,
    itemTime: "",
    dayPeriod: "allDay" as DayPeriod,
    title: "",
    category: "other" as ItineraryCategory,
    location: "",
    note: "",
  });
  const [error, setError] = useState("");
  const days = useMemo(() => groupItineraryByDate(trip.itinerary), [trip.itinerary]);
  const isJournal = trip.trip.mode === "journal";

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/items`,
        {
          method: "POST",
          body: JSON.stringify({ kind: "itinerary", ...form }),
        },
      );
      onChange(data.trip);
      setForm({ ...form, title: "", location: "", note: "", itemTime: "" });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "未能加入行程。");
    }
  }

  async function reorder(order: string[], itemDate?: string) {
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/items`,
        {
          method: "PATCH",
          body: JSON.stringify({ kind: "itinerary", order, ...(itemDate ? { itemDate } : {}) }),
        },
      );
      onChange(data.trip);
    } catch (reorderError) {
      setError(
        reorderError instanceof Error ? reorderError.message : "未能調整行程次序。",
      );
    }
  }

  return (
    <section className="panel-content" aria-labelledby="itinerary-heading">
      <div className="section-heading">
        <div>
          <div className="eyebrow">{isJournal ? "把走過的日子留低" : "留白給每天"}</div>
          <h2 id="itinerary-heading">{isJournal ? "旅程 Log" : "行程"}</h2>
        </div>
        <span className="section-count">{trip.itinerary.length} 筆</span>
      </div>
      {trip.itinerary.length === 0 ? (
        <p className="muted-copy">還未有安排，先記下第一個想去的地方。</p>
      ) : isJournal ? (
        <div className="itinerary-days">
          {days.map((day) => (
            <section className="itinerary-day" key={day.date}>
              <div className="day-heading">
                <div>
                  <strong>
                    {day.date.slice(5).replace("-", "/")}（週{day.weekday}）
                  </strong>
                  {day.weather && <WeatherSummary item={day.weather} trip={trip} onChange={onChange} />}
                </div>
                <span>{day.entries.length} 筆</span>
              </div>
              <div className="itinerary-list">
                {day.entries.map((item, index) => (
                  <ItineraryRow
                    key={item.id}
                    item={item}
                    trip={trip}
                    onChange={onChange}
                    index={index}
                    total={day.entries.length}
                    onMove={(direction) =>
                      reorder(
                        swapIds(
                          day.entries.map((entry) => entry.id),
                          index,
                          direction,
                        ),
                        day.date,
                      )
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="itinerary-list">
          {trip.itinerary.map((item, index) => (
            <ItineraryRow
              key={item.id}
              item={item}
              trip={trip}
              onChange={onChange}
              showDate
              index={index}
              total={trip.itinerary.length}
              onMove={(direction) =>
                reorder(
                  swapIds(
                    trip.itinerary.map((entry) => entry.id),
                    index,
                    direction,
                  ),
                )
              }
            />
          ))}
        </div>
      )}
      <form className="inline-form itinerary-form" onSubmit={add}>
        <h3>{isJournal ? "加一筆旅記" : "加一個安排"}</h3>
        <div className="form-grid four-columns">
          <label>
            日期
            <input
              type="date"
              min={trip.trip.startDate}
              max={trip.trip.endDate}
              value={form.itemDate}
              onChange={(event) => setForm({ ...form, itemDate: event.target.value })}
              required
            />
          </label>
          <label>
            時段
            <select
              value={form.dayPeriod}
              onChange={(event) =>
                setForm({ ...form, dayPeriod: event.target.value as DayPeriod })
              }
            >
              {dayPeriodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            時間（可選）
            <input
              type="time"
              value={form.itemTime}
              onChange={(event) => setForm({ ...form, itemTime: event.target.value })}
            />
          </label>
          <label>
            標題
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder={isJournal ? "例：在溪邊食早餐" : "例：抵達羽田"}
              required
            />
          </label>
        </div>
        <div className="form-grid three-columns">
          <label>
            分類
            <select
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value as ItineraryCategory })
              }
            >
              {ITINERARY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </label>
          <label>
            地點
            <input
              value={form.location}
              onChange={(event) => setForm({ ...form, location: event.target.value })}
              placeholder="例：淺草站"
            />
          </label>
          <label>
            備註
            <input
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              placeholder="交通、預約號碼…"
            />
          </label>
        </div>
        {error && <Notice message={error} />}
        <button className="secondary-button" type="submit">
          {isJournal ? "記低旅記" : "加入行程"}
        </button>
      </form>
    </section>
  );
}
