"use client";

import { FormEvent, useState } from "react";
import { SEASON_LABELS, type Season } from "@/lib/packing-templates";
import type { TripAggregate } from "@/lib/trip-data";
import { requestJson, inferSeasonForDate } from "./client-api";
import { initialTripForm, seasonOptions, type TripFormValues } from "./contracts";
import { Notice } from "./SharedUi";

export function TripForm({
  onCreated,
  onCancel,
  prefill,
}: {
  onCreated: (trip: TripAggregate) => void;
  onCancel: () => void;
  prefill?: Partial<TripFormValues>;
}) {
  const [form, setForm] = useState({ ...initialTripForm, ...prefill });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inferredSeason: Season | null = form.startDate
    ? inferSeasonForDate(form.startDate)
    : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const data = await requestJson<{ trip: TripAggregate }>("/api/trips", {
        method: "POST",
        body: JSON.stringify(form),
      });
      onCreated(data.trip);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "未能建立旅程。",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="form-card" aria-labelledby="new-trip-title">
      <div className="section-heading compact-heading">
        <div>
          <div className="eyebrow">寫下下一站或補回一段記憶</div>
          <h2 id="new-trip-title">新增一趟旅程</h2>
        </div>
        <button className="quiet-button" type="button" onClick={onCancel}>
          先不新增
        </button>
      </div>
      <form className="trip-form" onSubmit={submit}>
        <fieldset className="mode-fieldset">
          <legend>這是</legend>
          <div className="mode-picker">
            <label className={`mode-option ${form.mode === "plan" ? "selected" : ""}`}>
              <input
                type="radio"
                name="mode"
                value="plan"
                checked={form.mode === "plan"}
                onChange={() => setForm({ ...form, mode: "plan" })}
              />
              <span>準備新旅程</span>
              <small>建立季節行李與臨出發清單</small>
            </label>
            <label className={`mode-option ${form.mode === "journal" ? "selected" : ""}`}>
              <input
                type="radio"
                name="mode"
                value="journal"
                checked={form.mode === "journal"}
                onChange={() => setForm({ ...form, mode: "journal" })}
              />
              <span>補寫過往旅記</span>
              <small>只記每天走過的路與小事</small>
            </label>
          </div>
        </fieldset>
        <label>
          旅程名稱
          <input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="例：東京慢慢走"
            required
          />
        </label>
        <label>
          目的地
          <input
            value={form.destinations}
            onChange={(event) => setForm({ ...form, destinations: event.target.value })}
            placeholder="例：東京、鎌倉"
            required
          />
        </label>
        <div className="form-grid two-columns">
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
          <legend>{form.mode === "journal" ? "旅記季節" : "執行李季節"}</legend>
          <div className="season-picker">
            {seasonOptions.map((option) => (
              <label
                key={option.value}
                className={`season-option ${form.season === option.value ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="season"
                  value={option.value}
                  checked={form.season === option.value}
                  onChange={() => setForm({ ...form, season: option.value })}
                />
                <span>{option.label}</span>
                <small>{option.note}</small>
              </label>
            ))}
          </div>
          <p className="form-hint">
            {inferredSeason
              ? `按出發月份推算：${SEASON_LABELS[inferredSeason]}；你也可以手動改選。`
              : "輸入出發日期後，會自動推算季節。"}
          </p>
        </fieldset>
        {error && <Notice message={error} />}
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "正在建立旅程…" : form.mode === "journal" ? "建立過往旅記" : "建立旅程及清單"}
        </button>
      </form>
    </section>
  );
}
