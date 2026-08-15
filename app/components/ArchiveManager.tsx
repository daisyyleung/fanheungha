"use client";

import { useState } from "react";
import type { ArchivedTripAggregate, ListSectionRecord, TripAggregate } from "@/lib/trip-data";
import { requestJson } from "./client-api";
import { Notice } from "./SharedUi";

type ArchiveManagerProps = {
  trip: TripAggregate;
  onChange: (trip: TripAggregate) => void;
};

export function ArchiveManager({ trip, onChange }: ArchiveManagerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [archive, setArchive] = useState<ArchivedTripAggregate | null>(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await requestJson<{ archived: ArchivedTripAggregate }>(
        `/api/trips/${trip.trip.id}/items?view=archived`,
      );
      setArchive(data.archived);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "未能載入已收起項目。");
    } finally {
      setLoading(false);
    }
  }

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) await refresh();
  }

  async function restore(
    kind: "itinerary" | "packing" | "lastMinute" | "shopping" | "food",
    id: string,
  ) {
    setError("");
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/items`,
        {
          method: "PATCH",
          body: JSON.stringify({ kind, id, archived: false }),
        },
      );
      onChange(data.trip);
      await refresh();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "未能還原項目。");
    }
  }

  async function restoreSection(section: ListSectionRecord) {
    setError("");
    try {
      const data = await requestJson<{ trip: TripAggregate }>(
        `/api/trips/${trip.trip.id}/sections`,
        {
          method: "PATCH",
          body: JSON.stringify({ kind: section.kind, id: section.id, archived: false }),
        },
      );
      onChange(data.trip);
      await refresh();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "未能還原店舖分組。");
    }
  }

  const sectionRows = archive ? [...archive.shoppingSections, ...archive.foodSections] : [];
  const count = archive
    ? sectionRows.length +
      archive.itinerary.length +
      archive.packing.length +
      archive.lastMinute.length +
      archive.shopping.length +
      archive.food.length
    : 0;

  return (
    <section className="archive-manager" aria-labelledby="archive-manager-heading">
      <div className="archive-manager-heading">
        <div>
          <div className="eyebrow">資料仍然保留</div>
          <h3 id="archive-manager-heading">已收起項目</h3>
          <p>收起只會暫時隱藏；還原店舖分組後，旗下未收起項目會重新顯示。</p>
        </div>
        <button className="secondary-button" type="button" onClick={toggleOpen} aria-expanded={open}>
          {open ? "收起管理器" : "查看及還原"}
        </button>
      </div>
      {open && (
        <div className="archive-manager-body">
          {loading && (
            <p className="muted-copy" role="status">
              正在整理已收起項目…
            </p>
          )}
          {error && <Notice message={error} />}
          {!loading && archive && count === 0 && (
            <p className="muted-copy">目前沒有已收起項目。</p>
          )}
          {!loading && archive && sectionRows.length > 0 && (
            <div className="archive-group">
              <h4>店舖分組</h4>
              {sectionRows.map((section) => (
                <div className="archive-row" key={`${section.kind}-${section.id}`}>
                  <div>
                    <strong>{section.name}</strong>
                    <small>還原分組會顯示旗下未收起項目。</small>
                  </div>
                  <button className="text-button" type="button" onClick={() => restoreSection(section)}>
                    還原分組
                  </button>
                </div>
              ))}
            </div>
          )}
          {!loading && archive &&
            archive.itinerary.length +
              archive.packing.length +
              archive.lastMinute.length +
              archive.shopping.length +
              archive.food.length >
              0 && (
                <div className="archive-group">
                  <h4>個別項目</h4>
                  {[
                    ...archive.itinerary.map((item) => ({
                      kind: "itinerary" as const,
                      id: item.id,
                      label: item.title,
                      hint: "行程",
                    })),
                    ...archive.packing.map((item) => ({
                      kind: "packing" as const,
                      id: item.id,
                      label: item.label,
                      hint: "執行李",
                    })),
                    ...archive.lastMinute.map((item) => ({
                      kind: "lastMinute" as const,
                      id: item.id,
                      label: item.label,
                      hint: "臨出發",
                    })),
                    ...archive.shopping.map((item) => ({
                      kind: "shopping" as const,
                      id: item.id,
                      label: item.name,
                      hint: "想買",
                    })),
                    ...archive.food.map((item) => ({
                      kind: "food" as const,
                      id: item.id,
                      label: item.name,
                      hint: "想食／飲",
                    })),
                  ].map((item) => (
                    <div className="archive-row" key={`${item.kind}-${item.id}`}>
                      <div>
                        <strong>{item.label}</strong>
                        <small>
                          {item.hint}
                          {(item.kind === "shopping" || item.kind === "food") &&
                            "；父店舖分組仍收起時，還原後會暫時隱藏"}
                        </small>
                      </div>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => restore(item.kind, item.id)}
                      >
                        還原
                      </button>
                    </div>
                  ))}
                </div>
              )}
        </div>
      )}
    </section>
  );
}
