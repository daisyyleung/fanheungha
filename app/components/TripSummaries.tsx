"use client";

import { SEASON_LABELS, type Season } from "@/lib/packing-templates";
import type { TripAggregate } from "@/lib/trip-data";
import { ACTIVE_SITE_THEME } from "@/lib/site-theme";
import { isPastTrip, isUpcomingTrip } from "@/lib/dashboard-logic";
import { formatDateRange, todayIso } from "./client-api";
import { type AppView, type TripFormValues } from "./contracts";
import { ArchiveTripButton } from "./SharedUi";
import type { ArchiveTrip } from "./trip-ui";

export function EmptyState({ onNewTrip }: { onNewTrip: () => void }) {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <span className="empty-seal" aria-hidden="true" />
      <div>
        <div className="eyebrow">第一趟日本旅行</div>
        <h2 id="empty-title">還沒有旅程，先寫下想去的地方</h2>
        <p>可以準備新旅程，也可以把走過的日子補寫成一冊過往旅記。</p>
        <button className="primary-button" type="button" onClick={onNewTrip}>
          新增第一趟旅程
        </button>
      </div>
    </section>
  );
}

export function TripCard({
  trip,
  onOpenTrip,
  onArchive,
  compact = false,
}: {
  trip: TripAggregate;
  onOpenTrip: (id: string) => void;
  onArchive?: ArchiveTrip;
  compact?: boolean;
}) {
  const isJournal = trip.trip.mode === "journal";
  return (
    <article className={`trip-card ${compact ? "trip-card-compact" : ""}`}>
      <div className="trip-card-copy">
        <span className="summary-season">
          {isJournal ? "過往旅記" : SEASON_LABELS[trip.trip.season as Season]}
        </span>
        <strong>{trip.trip.title}</strong>
        <span>{trip.trip.destinations}</span>
        <small>{formatDateRange(trip.trip.startDate, trip.trip.endDate)}</small>
        <em>{trip.itinerary.length} 筆行程</em>
      </div>
      <div className="trip-card-actions">
        <button className="trip-open-button" type="button" onClick={() => onOpenTrip(trip.trip.id)}>
          開啟旅程
        </button>
        {onArchive && !isJournal && <ArchiveTripButton trip={trip} onArchive={onArchive} />}
      </div>
    </article>
  );
}

export function Overview({
  trips,
  onNewTrip,
  onOpenTrip,
  onArchive,
  onNavigate,
}: {
  trips: TripAggregate[];
  onNewTrip: (prefill?: Partial<TripFormValues>) => void;
  onOpenTrip: (id: string) => void;
  onArchive: ArchiveTrip;
  onNavigate: (view: AppView) => void;
}) {
  const today = todayIso();
  const upcoming = trips
    .filter((trip) => isUpcomingTrip(trip, today))
    .sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate));
  const next = upcoming[0];
  const journalCount = trips.filter((trip) => isPastTrip(trip, today)).length;

  return (
    <div className="dashboard-view">
      <section className="welcome-band">
        <div>
          <div className="eyebrow">{ACTIVE_SITE_THEME.label}</div>
          <h1>把旅程寫好，出發就輕一點</h1>
          <p>從季節執行李，到最後一刻的口袋檢查，慢慢準備就好。</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => onNewTrip()}>
          新增旅程
        </button>
      </section>
      <div className="overview-grid">
        <article className="stat-card">
          <span>所有旅程</span>
          <strong>{trips.length}</strong>
          <small>現有旅程與旅記</small>
        </article>
        <article className="stat-card">
          <span>即將出發</span>
          <strong>{upcoming.length}</strong>
          <small>今天或以後的計劃</small>
        </article>
        <article className="stat-card">
          <span>過往旅記</span>
          <strong>{journalCount}</strong>
          <small>留住走過的日子</small>
        </article>
      </div>
      <section className="next-destination">
        <div>
          <span className="eyebrow">{next ? "下一站" : "旅程提示"}</span>
          <h2>{next ? next.trip.destinations : "先寫下你的下一站"}</h2>
          <p>
            {next
              ? formatDateRange(next.trip.startDate, next.trip.endDate)
              : "建立旅程後，日期與目的地會顯示在這裡。"}
          </p>
        </div>
        <button className="primary-button" type="button" onClick={() => onNavigate("map")}>
          看看日本足跡
        </button>
      </section>
      {next ? (
        <section className="overview-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">最近一趟</div>
              <h2>準備中的旅程</h2>
            </div>
            <button className="quiet-button" type="button" onClick={() => onNavigate("upcoming")}>
              查看全部
            </button>
          </div>
          <TripCard trip={next} compact onOpenTrip={onOpenTrip} onArchive={onArchive} />
        </section>
      ) : (
        <section className="cta-card">
          <div>
            <div className="eyebrow">準備下一站</div>
            <h2>開始一趟新旅程</h2>
            <p>先留下目的地、日期與季節，之後再慢慢補上行程。</p>
          </div>
          <button className="primary-button" type="button" onClick={() => onNewTrip()}>
            新增旅程
          </button>
        </section>
      )}
    </div>
  );
}

export function TripListView({
  title,
  eyebrow,
  trips,
  onOpenTrip,
  onArchive,
  allowArchive,
  empty,
}: {
  title: string;
  eyebrow: string;
  trips: TripAggregate[];
  onOpenTrip: (id: string) => void;
  onArchive?: ArchiveTrip;
  allowArchive: boolean;
  empty: string;
}) {
  return (
    <section className="dashboard-view list-view">
      <div className="section-heading page-heading">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
        </div>
        <span className="section-count">{trips.length} 趟</span>
      </div>
      {trips.length === 0 ? (
        <p className="muted-copy">{empty}</p>
      ) : (
        <div className="trip-card-grid">
          {trips.map((trip) => (
            <TripCard
              key={trip.trip.id}
              trip={trip}
              onOpenTrip={onOpenTrip}
              onArchive={allowArchive ? onArchive : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
