"use client";

import { useEffect, useMemo, useState } from "react";
import { FootprintAtlas } from "./FootprintAtlas";
import { AppFrame } from "./components/AppFrame";
import { KnowledgeView } from "./components/KnowledgeView";
import { ImprovementsView } from "./components/ImprovementsView";
import { PinGate } from "./components/PinGate";
import { TripDetail } from "./components/TripDetail";
import { TripForm } from "./components/TripForm";
import {
  EmptyState,
  Overview,
  TripListView,
} from "./components/TripSummaries";
import { requestJson, todayIso } from "./components/client-api";
import {
  type AppView,
  type AuthState,
  type TripFormValues,
} from "./components/contracts";
import type { ImprovementNote } from "@/lib/improvement-data";
import type { TripAggregate } from "@/lib/trip-data";
import { isPastTrip, isUpcomingTrip } from "@/lib/dashboard-logic";
import { Notice } from "./components/SharedUi";

function TravelNotebook({ onLock }: { onLock: () => void }) {
  const [trips, setTrips] = useState<TripAggregate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<AppView>("overview");
  const [showNewTrip, setShowNewTrip] = useState(false);
  const [tripPrefill, setTripPrefill] = useState<Partial<TripFormValues>>();
  const [notes, setNotes] = useState<ImprovementNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedTrip = trips.find((item) => item.trip.id === selectedId) ?? null;
  const upcoming = useMemo(() => {
    const today = todayIso();
    return trips
      .filter((trip) => isUpcomingTrip(trip, today))
      .sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate));
  }, [trips]);
  const past = useMemo(() => {
    const today = todayIso();
    return trips
      .filter((trip) => isPastTrip(trip, today))
      .sort((a, b) => b.trip.endDate.localeCompare(a.trip.endDate));
  }, [trips]);

  async function refresh() {
    setError("");
    try {
      const [tripData, noteData] = await Promise.all([
        requestJson<{ trips: TripAggregate[] }>("/api/trips"),
        requestJson<{ notes: ImprovementNote[] }>("/api/improvements"),
      ]);
      setTrips(tripData.trips);
      setNotes(noteData.notes);
      setSelectedId((current) =>
        current && tripData.trips.some((item) => item.trip.id === current)
          ? current
          : null,
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "未能載入旅程。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function openTrip(id: string) {
    setSelectedId(id);
    setView("trip");
  }

  function replaceTrip(next: TripAggregate) {
    setTrips((current) =>
      current.map((item) => (item.trip.id === next.trip.id ? next : item)),
    );
    setSelectedId(next.trip.id);
  }

  function addTrip(trip: TripAggregate) {
    setTrips((current) =>
      [...current, trip].sort(
        (a, b) =>
          b.trip.startDate.localeCompare(a.trip.startDate) ||
          b.trip.createdAt.localeCompare(a.trip.createdAt),
      ),
    );
    setSelectedId(trip.trip.id);
    setShowNewTrip(false);
    setTripPrefill(undefined);
    setView("trip");
  }

  async function archiveTrip(trip: TripAggregate): Promise<boolean> {
    if (
      !window.confirm(
        `收起「${trip.trip.title}」？它會離開即將出發及準備中的清單；D1 紀錄會保留，不會刪除。`,
      )
    ) {
      return false;
    }
    setError("");
    try {
      await requestJson(`/api/trips/${trip.trip.id}`, {
        method: "PATCH",
        body: JSON.stringify({ archived: true }),
      });
      setTrips((current) => current.filter((item) => item.trip.id !== trip.trip.id));
      setSelectedId((current) => (current === trip.trip.id ? null : current));
      if (selectedId === trip.trip.id) setView("overview");
      return true;
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "未能收起旅程。資料沒有刪除。",
      );
      return false;
    }
  }

  function newTrip(prefill?: Partial<TripFormValues>) {
    setTripPrefill(prefill);
    setShowNewTrip(true);
  }

  let content: React.ReactNode = null;
  if (loading) {
    content = (
      <section className="loading-state" role="status">
        正在把旅程卡片放回桌上…
      </section>
    );
  } else if (view === "overview") {
    content = (
      <Overview
        trips={trips}
        onNewTrip={newTrip}
        onOpenTrip={openTrip}
        onArchive={archiveTrip}
        onNavigate={setView}
      />
    );
  } else if (view === "upcoming") {
    content = (
      <TripListView
        title="即將出發"
        eyebrow="把未來排好"
        trips={upcoming}
        onOpenTrip={openTrip}
        onArchive={archiveTrip}
        allowArchive
        empty="暫時沒有今天或以後的計劃，下一站可以從任何地方開始。"
      />
    );
  } else if (view === "past") {
    content = (
      <TripListView
        title="過往旅記"
        eyebrow="把走過的日子留低"
        trips={past}
        onOpenTrip={openTrip}
        allowArchive={false}
        empty="還未有過往旅記。"
      />
    );
  } else if (view === "map") {
    content = <FootprintAtlas trips={trips} />;
  } else if (view === "knowledge") {
    content = <KnowledgeView />;
  } else if (view === "improvements") {
    content = <ImprovementsView notes={notes} onChange={setNotes} />;
  } else if (view === "trip" && selectedTrip) {
    content = (
      <TripDetail trip={selectedTrip} onChange={replaceTrip} onArchive={archiveTrip} />
    );
  } else {
    content =
      trips.length === 0 ? (
        <EmptyState onNewTrip={() => newTrip()} />
      ) : (
        <Overview
          trips={trips}
          onNewTrip={newTrip}
          onOpenTrip={openTrip}
          onArchive={archiveTrip}
          onNavigate={setView}
        />
      );
  }

  return (
    <AppFrame view={view} onNavigate={setView} onLock={onLock}>
      <div className="dashboard-shell">
        {error && <Notice message={error} />}
        {showNewTrip && (
          <TripForm
            key={JSON.stringify(tripPrefill ?? {})}
            prefill={tripPrefill}
            onCreated={addTrip}
            onCancel={() => {
              setShowNewTrip(false);
              setTripPrefill(undefined);
            }}
          />
        )}
        {content}
      </div>
    </AppFrame>
  );
}

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const data = await requestJson<{ state: "setup" | "locked" | "unlocked" }>(
          "/api/auth/status",
        );
        setAuthState(data.state);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "資料庫尚未連接。");
        setAuthState("error");
      }
    })();
  }, []);

  function lock() {
    void requestJson("/api/auth/logout", { method: "POST" })
      .catch(() => undefined)
      .finally(() => setAuthState("locked"));
  }

  if (authState === "loading") {
    return (
      <AppFrame>
        <section className="loading-state first-load" role="status">
          <div className="eyebrow">日本旅行手帳</div>
          <h1>正在整理你的旅程桌</h1>
          <p>稍等一會兒，手帳會先看看目前的行程。</p>
        </section>
      </AppFrame>
    );
  }

  if (authState === "error") {
    return (
      <AppFrame>
        <section className="gate-card">
          <div className="eyebrow">手帳還未接上資料</div>
          <h1>先保留這個位置</h1>
          <p>產品頁面已準備好；請確認資料服務已連接後重新整理。</p>
          {authError && <Notice message={authError} />}
          <button className="primary-button" type="button" onClick={() => window.location.reload()}>
            重新連接
          </button>
        </section>
      </AppFrame>
    );
  }

  if (authState === "setup" || authState === "locked") {
    return (
      <AppFrame>
        <PinGate mode={authState} onUnlocked={() => setAuthState("unlocked")} />
      </AppFrame>
    );
  }

  return <TravelNotebook onLock={lock} />;
}
