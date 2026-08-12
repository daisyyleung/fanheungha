"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { TripAggregate } from "@/lib/trip-data";
import {
  aggregatePrefectureStatuses,
  aggregateRegionStatuses,
  getDefaultRegionId,
  PREFECTURE_BY_ID,
  PREFECTURE_DEFINITIONS,
  REGION_DEFINITIONS,
  regionStatusLabel,
  type PrefectureId,
  type RegionId,
  type RegionStatus,
} from "@/lib/region-map";
import { isoDateInTimeZone } from "@/lib/dashboard-logic";
import { JAPAN_CARTOGRAM_CELLS, type JapanCartogramCell } from "@/lib/japan-cartogram";

const REGION_TONES: Record<RegionId, string> = {
  hokkaido: "blue",
  tohoku: "mist",
  kanto: "slate",
  chubu: "ochre",
  kinki: "tea",
  chugoku: "rose",
  shikoku: "straw",
  "kyushu-okinawa": "plum",
};

const REGION_AREAS: Record<RegionId, string> = {
  hokkaido: "hokkaido",
  tohoku: "tohoku",
  kanto: "kanto",
  chubu: "chubu",
  kinki: "kinki",
  chugoku: "chugoku",
  shikoku: "shikoku",
  "kyushu-okinawa": "kyushu",
};

const statusMarker: Record<RegionStatus, string> = {
  visited: "●",
  next: "→",
  both: "◎",
  unrecorded: "○",
};

function PrefectureGlyph({ status }: { status: RegionStatus }) {
  return <span className={`atlas-prefecture-glyph status-${status}`} aria-hidden="true" />;
}

function prefectureDisplayLabel(prefectureId: PrefectureId, label: string): string {
  if (prefectureId === "hokkaido") return "北海道";
  if (prefectureId === "tokyo") return "東京都";
  if (prefectureId === "kyoto" || prefectureId === "osaka") return `${label}府`;
  return `${label}縣`;
}

function cartogramCellStyle(cell: JapanCartogramCell): CSSProperties {
  return {
    "--atlas-cell-x": `${cell.x}%`,
    "--atlas-cell-y": `${cell.y}%`,
    "--atlas-cell-width": `${cell.width}%`,
    "--atlas-cell-height": `${cell.height}%`,
    ...(cell.clipPath ? { "--atlas-cell-clip": `polygon(${cell.clipPath})` } : {}),
  } as CSSProperties;
}

function todayIso(): string {
  return isoDateInTimeZone(new Date(), "Asia/Hong_Kong");
}

function MapStatusLegend() {
  return (
    <div className="map-legend" aria-label="足跡狀態">
      <span><i className="legend-dot visited" aria-hidden="true" />已去過</span>
      <span><i className="legend-dot next" aria-hidden="true" />下一站</span>
      <span><i className="legend-dot both" aria-hidden="true" />已去過・下一站</span>
      <span><i className="legend-dot unrecorded" aria-hidden="true" />尚未記錄</span>
    </div>
  );
}

function StatusChip({ status, compact = false }: { status: RegionStatus; compact?: boolean }) {
  return (
    <span className={`atlas-status-chip status-${status}${compact ? " compact" : ""}`}>
      <span className="atlas-status-marker" aria-hidden="true">{statusMarker[status]}</span>
      {regionStatusLabel(status)}
    </span>
  );
}

function AtlasCallout({
  regionId,
  selected,
  status,
  prefectureStatuses,
  onSelect,
}: {
  regionId: RegionId;
  selected: boolean;
  status: RegionStatus;
  prefectureStatuses: ReturnType<typeof aggregatePrefectureStatuses>;
  onSelect: (regionId: RegionId) => void;
}) {
  const region = REGION_DEFINITIONS.find((candidate) => candidate.id === regionId);
  if (!region) return null;
  const tone = REGION_TONES[regionId];
  const area = REGION_AREAS[regionId];
  const prefectures = PREFECTURE_DEFINITIONS.filter((prefecture) => prefecture.regionId === regionId);

  return (
    <aside className={`atlas-callout atlas-callout--${area} atlas-callout--tone-${tone} ${selected ? "selected" : ""}`} aria-labelledby={`atlas-callout-${regionId}`}>
      <button
        className="atlas-callout-button"
        type="button"
        aria-pressed={selected}
        aria-describedby={`atlas-callout-status-${regionId}`}
        onClick={() => onSelect(regionId)}
      >
        <span id={`atlas-callout-${regionId}`} className="atlas-callout-pill">{region.label}</span>
      </button>
      <span id={`atlas-callout-status-${regionId}`} className="atlas-callout-status">
        <StatusChip status={status} compact />
      </span>
      <ul className="atlas-prefecture-list">
        {prefectures.map((prefecture) => {
          const prefectureStatus = prefectureStatuses[prefecture.id].status;
          return (
            <li className={`atlas-prefecture-item status-${prefectureStatus}`} key={prefecture.id}>
              <PrefectureGlyph status={prefectureStatus} />
              <span className="atlas-prefecture-name">{prefectureDisplayLabel(prefecture.id, prefecture.label)}</span>
              <span className="visually-hidden">：{regionStatusLabel(prefectureStatus)}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function AtlasMap({
  activeSelectedId,
  prefectureStatuses,
}: {
  activeSelectedId: RegionId;
  prefectureStatuses: ReturnType<typeof aggregatePrefectureStatuses>;
}) {
  return (
    <figure className="atlas-map-frame">
      <div className="atlas-map-label" aria-hidden="true">47 都道府縣</div>
      <div className="atlas-map-scroll" tabIndex={0} role="region" aria-label="日本 47 都道府縣方塊地圖，可左右滑動">
        <div className="atlas-cartogram" role="list" aria-labelledby="japan-map-title" aria-describedby="japan-map-description">
          <h2 id="japan-map-title" className="visually-hidden">日本 47 都道府縣足跡地圖</h2>
          <p id="japan-map-description" className="visually-hidden">以八大地區色調排列的方塊地圖。已去過的縣會亮起，下一站以柿紅色外框標示，同時已去過及下一站以雙重外框標示，尚未記錄的縣會淡出。</p>
          {JAPAN_CARTOGRAM_CELLS.map((cell) => {
            const prefectureId = cell.id;
            const definition = PREFECTURE_BY_ID[prefectureId];
            const status = prefectureStatuses[prefectureId].status;
            const tone = REGION_TONES[definition.regionId];
            return (
              <div
                key={cell.id}
                className={`atlas-cartogram-cell atlas-cartogram-cell--${status} atlas-cartogram-cell--tone-${tone}${definition.regionId === activeSelectedId ? " atlas-cartogram-cell--selected-region" : ""}`}
                style={cartogramCellStyle(cell)}
                data-layout-id={cell.id}
                data-prefecture-id={prefectureId}
                data-region-id={definition.regionId}
                data-status={status}
                role="listitem"
                aria-label={`${definition.label}：${regionStatusLabel(status)}`}
              >
                <span className="atlas-cartogram-label">{definition.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="atlas-map-hint" aria-hidden="true">手機上左右滑動查看完整方塊地圖</p>
    </figure>
  );
}

export function FootprintAtlas({ trips }: { trips: TripAggregate[] }) {
  const statuses = useMemo(() => aggregateRegionStatuses(trips, todayIso()), [trips]);
  const prefectureStatuses = useMemo(() => aggregatePrefectureStatuses(trips, todayIso()), [trips]);
  const defaultId = getDefaultRegionId(statuses);
  const [selectedId, setSelectedId] = useState<RegionId | null>(null);
  const activeSelectedId = selectedId ?? defaultId;
  const selected = statuses[activeSelectedId] ?? statuses.hokkaido;

  function selectRegion(regionId: RegionId) {
    setSelectedId(regionId);
  }

  return (
    <section className="dashboard-view map-view footprint-atlas-view" aria-labelledby="footprint-atlas-title">
      <div className="section-heading page-heading">
        <div>
          <div className="eyebrow">一眼看見去過的地方</div>
          <h1 id="footprint-atlas-title">日本足跡</h1>
          <p className="page-intro">去過的縣會亮起；按一下地區牌，就能查看完整的都道府縣清單與旅程足跡。</p>
        </div>
        <MapStatusLegend />
      </div>

      <div className="atlas-board" aria-label="日本八大地區圖鑑">
        <div className="atlas-plaque" aria-label="日本全圖手帳牌">
          <span className="atlas-plaque-kicker">TRAVEL NOTEBOOK</span>
          <strong><span>日本</span><span>全圖</span></strong>
          <span className="atlas-plaque-note">47 PREFECTURES · 8 REGIONS</span>
        </div>
        <AtlasMap activeSelectedId={activeSelectedId} prefectureStatuses={prefectureStatuses} />
        {REGION_DEFINITIONS.map((region) => (
          <AtlasCallout
            key={region.id}
            regionId={region.id}
            selected={activeSelectedId === region.id}
            status={statuses[region.id].status}
            prefectureStatuses={prefectureStatuses}
            onSelect={selectRegion}
          />
        ))}
      </div>

      <div className="atlas-detail-grid">
        <fieldset className="region-selector atlas-region-selector">
          <legend>選擇日本地區</legend>
          <p className="atlas-selector-intro">牌面與下方原生選項會同步目前選擇。</p>
          <div className="region-radio-grid">
            {REGION_DEFINITIONS.map((region) => {
              const summary = statuses[region.id];
              const selectedRegion = activeSelectedId === region.id;
              return (
                <label className={`region-option ${selectedRegion ? "selected" : ""}`} key={region.id}>
                  <input
                    type="radio"
                    name="japan-region"
                    value={region.id}
                    checked={selectedRegion}
                    onChange={() => selectRegion(region.id)}
                  />
                  <span className="region-option-copy">
                    <strong>{region.label}</strong>
                    <small>{region.description}</small>
                  </span>
                  <StatusChip status={summary.status} compact />
                </label>
              );
            })}
          </div>
        </fieldset>

        <aside className="place-list atlas-selected-region" aria-live="polite" aria-labelledby="selected-region-heading">
          <div className="selected-region-heading">
            <div>
              <span className="eyebrow">已選地區</span>
              <h2 id="selected-region-heading">{selected.label}</h2>
            </div>
            <StatusChip status={selected.status} />
          </div>
          <p className="selected-region-copy">{selected.description}</p>
          {selected.destinations.length === 0 ? (
            <div className="region-empty">
              <strong>尚未記錄這個地區</strong>
              <p>在旅程目的地或行程中寫下地點後，這裡會自動整理足跡。</p>
            </div>
          ) : (
            <div className="place-destination-list">
              <h3>目的地</h3>
              {selected.destinations.map((place) => (
                <div className="place-status" key={place.label}>
                  <strong>{place.label}</strong>
                  <StatusChip status={place.status} compact />
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
