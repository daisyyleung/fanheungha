"use client";

import { useState } from "react";
import type { TripAggregate } from "@/lib/trip-data";

export function Notice({ message, tone = "error" }: { message: string; tone?: "error" | "info" }) {
  return (
    <p className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      {message}
    </p>
  );
}

export function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const percent = Math.round((done / Math.max(total, 1)) * 100);
  return (
    <div className="progress-block">
      <div className="progress-label">
        <span>{label}</span>
        <strong>
          {done} / {total}
        </strong>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function MoveButtons({
  index,
  total,
  onMove,
  label,
  disabled = false,
}: {
  index: number;
  total: number;
  onMove: (direction: "up" | "down") => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <span className="move-buttons" aria-label={`${label}排序`}>
      <button
        className="text-button"
        type="button"
        onClick={() => onMove("up")}
        disabled={disabled || index === 0}
        aria-label={`${label}上移`}
      >
        ↑
      </button>
      <button
        className="text-button"
        type="button"
        onClick={() => onMove("down")}
        disabled={disabled || index === total - 1}
        aria-label={`${label}下移`}
      >
        ↓
      </button>
    </span>
  );
}

export function ArchiveTripButton({
  trip,
  onArchive,
  compact = false,
}: {
  trip: TripAggregate;
  onArchive: (trip: TripAggregate) => Promise<boolean>;
  compact?: boolean;
}) {
  const [pending, setPending] = useState(false);

  async function handleArchive() {
    setPending(true);
    try {
      await onArchive(trip);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      className={`archive-button ${compact ? "compact" : ""}`}
      type="button"
      onClick={handleArchive}
      disabled={pending}
      aria-label={`收起旅程：${trip.trip.title}`}
    >
      {pending ? "處理中…" : "收起旅程"}
    </button>
  );
}
