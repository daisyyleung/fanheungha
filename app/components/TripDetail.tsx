"use client";

import { useState } from "react";
import { SEASON_LABELS, type Season } from "@/lib/packing-templates";
import type { TripAggregate } from "@/lib/trip-data";
import { requestJson, formatDateRange } from "./client-api";
import { seasonOptions, tabOptions, type Tab } from "./contracts";
import { ArchiveManager } from "./ArchiveManager";
import { FoodPanel } from "./FoodPanel";
import { ItineraryPanel } from "./ItineraryPanel";
import { LastMinutePanel } from "./LastMinutePanel";
import { PackingPanel } from "./PackingPanel";
import { ShoppingPanel } from "./ShoppingPanel";
import { ArchiveTripButton, Notice } from "./SharedUi";
import type { ArchiveTrip } from "./trip-ui";

function TripMetadataEditor({
  trip,
  onChange,
  onCancel,
}: {
  trip: TripAggregate;
  onChange: (trip: TripAggregate) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: trip.trip.title,
    destinations: trip.trip.destinations,
    startDate: trip.trip.startDate,
    endDate: trip.trip.endDate,
    season: trip.trip.season as Season,
  });
  const [error, setError] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const data = await requestJson<TripAggregate>(`/api/trips/${trip.trip.id}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      onChange(data);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "未能更新旅程資料。");
    }
  }

  return (
    <form className="card-editor metadata-editor" onSubmit={save}>
      <div className="form-grid two-columns">
        <label>
          旅程名稱
          <input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            required
          />
        </label>
        <label>
          目的地
          <input
            value={form.destinations}
            onChange={(event) => setForm({ ...form, destinations: event.target.value })}
            required
          />
        </label>
        <label>
          出發日期
          <input
            type="date"
            value={form.startDate}
            onChange={(event) => setForm({ ...form, startDate: event.target.value })}
            required
          />
        </label>
        <label>
          回程日期
          <input
            type="date"
            value={form.endDate}
            onChange={(event) => setForm({ ...form, endDate: event.target.value })}
            required
          />
        </label>
      </div>
      <fieldset className="season-fieldset">
        <legend>季節</legend>
        <div className="season-picker">
          {seasonOptions.map((option) => (
            <label
              key={option.value}
              className={`season-option ${form.season === option.value ? "selected" : ""}`}
            >
              <input
                type="radio"
                name={`season-${trip.trip.id}`}
                value={option.value}
                checked={form.season === option.value}
                onChange={() => setForm({ ...form, season: option.value })}
              />
              <span>{option.label}</span>
              <small>{option.note}</small>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <Notice message={error} />}
      <div className="editor-actions">
        <button className="secondary-button" type="submit">
          儲存旅程資料
        </button>
        <button className="quiet-button" type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}

export function TripDetail({
  trip,
  onChange,
  onArchive,
}: {
  trip: TripAggregate;
  onChange: (trip: TripAggregate) => void;
  onArchive: ArchiveTrip;
}) {
  const [tab, setTab] = useState<Tab>("packing");
  const [editingMetadata, setEditingMetadata] = useState(false);
  const isJournal = trip.trip.mode === "journal";
  const visibleTabs = isJournal
    ? tabOptions.filter((option) => option.value === "itinerary")
    : tabOptions;
  const activeTab: Tab = isJournal ? "itinerary" : tab;

  return (
    <section className="trip-detail">
      <div className="trip-hero">
        <div>
          <span className="season-stamp">
            {isJournal ? "過往旅記" : SEASON_LABELS[trip.trip.season as Season]}
          </span>
          {editingMetadata ? (
            <TripMetadataEditor
              trip={trip}
              onChange={(next) => {
                onChange(next);
                setEditingMetadata(false);
              }}
              onCancel={() => setEditingMetadata(false)}
            />
          ) : (
            <>
              <h1>{trip.trip.title}</h1>
              <p>
                {trip.trip.destinations} <span aria-hidden="true">·</span>{" "}
                {formatDateRange(trip.trip.startDate, trip.trip.endDate)}
              </p>
            </>
          )}
        </div>
        <div className="hero-actions">
          {!editingMetadata && (
            <button className="text-button" type="button" onClick={() => setEditingMetadata(true)}>
              編輯旅程資料
            </button>
          )}
          {!isJournal && <ArchiveTripButton trip={trip} onArchive={onArchive} compact />}
        </div>
      </div>
      <nav className="trip-tabs" aria-label="旅程內容">
        <div className="tab-list">
          {visibleTabs.map((option) => (
            <button
              key={option.value}
              className={activeTab === option.value ? "tab active" : "tab"}
              type="button"
              aria-current={activeTab === option.value ? "page" : undefined}
              onClick={() => setTab(option.value)}
            >
              <span>{isJournal && option.value === "itinerary" ? "旅程 Log" : option.label}</span>
              <small>
                {isJournal && option.value === "itinerary" ? "每天走過的路" : option.hint}
              </small>
            </button>
          ))}
        </div>
      </nav>
      <ArchiveManager trip={trip} onChange={onChange} />
      {activeTab === "packing" && <PackingPanel trip={trip} onChange={onChange} />}
      {activeTab === "lastMinute" && <LastMinutePanel trip={trip} onChange={onChange} />}
      {activeTab === "shopping" && <ShoppingPanel trip={trip} onChange={onChange} />}
      {activeTab === "food" && <FoodPanel trip={trip} onChange={onChange} />}
      {activeTab === "itinerary" && <ItineraryPanel trip={trip} onChange={onChange} />}
    </section>
  );
}
