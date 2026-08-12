"use client";

import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from "react";
import { FootprintAtlas } from "./FootprintAtlas";
import { PACKING_CATEGORIES, SEASON_LABELS, type Season } from "@/lib/packing-templates";
import type { ArchivedTripAggregate, FoodRecord, ItineraryRecord, LastMinuteRecord, ListSectionRecord, PackingRecord, ShoppingRecord, TripAggregate } from "@/lib/trip-data";
import { CATEGORY_LABELS, DAY_PERIOD_LABELS, DAY_PERIODS, groupItineraryByDate, ITINERARY_CATEGORIES, type DayPeriod, type ItineraryCategory, type TripMode } from "@/lib/trip-log";
import { ACTIVE_SITE_THEME } from "@/lib/site-theme";
import { CUISINE_CATEGORIES, CUSTOMS_AND_RULES, KNOWLEDGE_SOURCES, REGIONAL_SPECIALTIES, type JapanLink } from "@/lib/japan-content";
import type { ImprovementNote } from "@/lib/improvement-data";
import { isoDateInTimeZone, isPastTrip, isUpcomingTrip } from "@/lib/dashboard-logic";

type AuthState = "loading" | "setup" | "locked" | "unlocked" | "error";
type Tab = "packing" | "lastMinute" | "shopping" | "food" | "itinerary";
type AppView = "overview" | "upcoming" | "past" | "map" | "knowledge" | "improvements" | "trip";
type PackingFilter = "all" | "outstanding" | "complete";

const seasonOptions: Array<{ value: Season; label: string; note: string }> = [
  { value: "spring", label: "春日", note: "3–5 月" },
  { value: "summer", label: "夏日", note: "6–8 月" },
  { value: "autumn", label: "秋日", note: "9–11 月" },
  { value: "winter", label: "冬日", note: "12–2 月" },
];

const tabOptions: Array<{ value: Tab; label: string; hint: string }> = [
  { value: "packing", label: "執行李", hint: "按季節清單" },
  { value: "lastMinute", label: "臨出發", hint: "最後確認" },
  { value: "shopping", label: "想買", hint: "連結與數量" },
  { value: "food", label: "想食／飲", hint: "便利店與店舖" },
  { value: "itinerary", label: "行程", hint: "每日節奏" },
];

const navigation: Array<{ value: Exclude<AppView, "trip">; label: string; hint: string }> = [
  { value: "overview", label: "總覽", hint: "今日旅程桌" },
  { value: "upcoming", label: "即將出發", hint: "未來的準備" },
  { value: "past", label: "過往旅記", hint: "走過的日子" },
  { value: "map", label: "日本足跡", hint: "去過與下一站" },
  { value: "knowledge", label: "日本小知識", hint: "吃法與禮儀" },
  { value: "improvements", label: "想改善", hint: "下一次更順" },
];

const dayPeriodOptions = DAY_PERIODS.map((value) => ({ value, label: DAY_PERIOD_LABELS[value] }));

const initialTripForm = {
  title: "",
  destinations: "",
  startDate: "",
  endDate: "",
  season: "" as Season | "",
  mode: "plan" as TripMode,
};

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options?.headers ?? {}) },
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(data.error ?? "暫時未能完成這項操作。");
  return data;
}

function todayIso(): string {
  return isoDateInTimeZone(new Date(), "Asia/Hong_Kong");
}

function inferSeasonForDate(date: string): Season {
  const month = Number(date.slice(5, 7));
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function formatDateRange(start: string, end: string) {
  return `${start.replaceAll("-", "/")} — ${end.replaceAll("-", "/")}`;
}

function Notice({ message, tone = "error" }: { message: string; tone?: "error" | "info" }) {
  return <p className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>{message}</p>;
}

function PinResetForm({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(pin)) { setError("請輸入 6 位數字 PIN。"); return; }
    if (pin !== confirmPin) { setError("兩次 PIN 不一致，請再確認一次。"); return; }
    setPending(true);
    try {
      await requestJson("/api/auth/reset", { method: "POST", body: JSON.stringify({ pin, confirmPin }) });
      setPin("");
      setConfirmPin("");
      onSuccess();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "暫時未能重新設定 PIN。");
    } finally {
      setPending(false);
    }
  }
  return <form className="sidebar-pin-form" onSubmit={submit}><strong>重新設定 PIN</strong><label htmlFor="new-travel-notebook-pin">新 6 位數 PIN</label><input id="new-travel-notebook-pin" type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" autoComplete="new-password" required aria-describedby={error ? "reset-pin-error" : undefined} /><label htmlFor="new-travel-notebook-pin-confirm">再輸入一次</label><input id="new-travel-notebook-pin-confirm" type="password" value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" autoComplete="new-password" required />{error && <p id="reset-pin-error" className="field-error" role="alert">{error}</p>}<div className="sidebar-pin-actions"><button className="secondary-button" type="submit" disabled={pending}>{pending ? "設定中…" : "確認新 PIN"}</button><button className="quiet-button" type="button" onClick={onCancel} disabled={pending}>取消</button></div></form>;
}

function AppFrame({ children, view, onNavigate, onLock }: { children: React.ReactNode; view?: AppView; onNavigate?: (view: AppView) => void; onLock?: () => void }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resetPinOpen, setResetPinOpen] = useState(false);
  const [pinNotice, setPinNotice] = useState("");
  useEffect(() => {
    if (!drawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [drawerOpen]);
  const palette = ACTIVE_SITE_THEME.palette;
  const themeStyle = {
    "--paper": palette.paper,
    "--paper-deep": palette.paperDeep,
    "--card": palette.card,
    "--ink": palette.ink,
    "--ink-soft": palette.inkSoft,
    "--indigo": palette.indigo,
    "--indigo-dark": palette.indigoDark,
    "--persimmon": palette.persimmon,
    "--persimmon-soft": palette.persimmonSoft,
    "--dune": palette.dune,
    "--line": palette.line,
    "--muted": palette.muted,
  } as CSSProperties;
  function navigate(next: AppView) {
    onNavigate?.(next);
    setDrawerOpen(false);
  }
  return (
    <div className="app-frame" data-theme={ACTIVE_SITE_THEME.id} style={themeStyle}>
      <div className="paper-grain" aria-hidden="true" />
      <header className="site-header">
        <a className="brand" href="#main-content" aria-label="日本旅行手帳首頁" onClick={() => navigate("overview")}>
          <span className="brand-seal" aria-hidden="true" />
          <span><strong>日本旅行手帳</strong><small>把下一站寫得剛剛好</small></span>
        </a>
        {onNavigate && <button className="menu-button" type="button" aria-expanded={drawerOpen} aria-controls="site-navigation" onClick={() => setDrawerOpen((open) => !open)}>選單</button>}
      </header>
      {onNavigate && <>
        <div className={`drawer-backdrop ${drawerOpen ? "open" : ""}`} aria-hidden="true" onClick={() => setDrawerOpen(false)} />
        <aside id="site-navigation" className={`site-sidebar ${drawerOpen ? "open" : ""}`} aria-label="主要導覽">
          <div className="sidebar-heading"><span className="eyebrow">日本旅行手帳</span><button className="drawer-close" type="button" onClick={() => setDrawerOpen(false)} aria-label="關閉選單">×</button></div>
          <nav className="sidebar-nav">{navigation.map((item) => <button key={item.value} className={`sidebar-link ${view === item.value ? "active" : ""}`} type="button" aria-current={view === item.value ? "page" : undefined} onClick={() => navigate(item.value)}><span>{item.label}</span><small>{item.hint}</small></button>)}</nav>
          {view === "trip" && <div className="sidebar-trip-note">正在查看一趟旅程<br /><span>旅程內分頁仍會保留</span></div>}
          {onLock && <div className="sidebar-security">{resetPinOpen ? <PinResetForm onCancel={() => setResetPinOpen(false)} onSuccess={() => { setResetPinOpen(false); setPinNotice("PIN 已重新設定，其他裝置需要用新 PIN 重新解鎖。"); }} /> : <button className="sidebar-reset" type="button" onClick={() => { setPinNotice(""); setResetPinOpen(true); }}>重新設定 PIN</button>}{pinNotice && <p className="sidebar-pin-notice" role="status">{pinNotice}</p>}<button className="sidebar-lock" type="button" onClick={onLock}>鎖上旅記</button></div>}
        </aside>
      </>}
      <main id="main-content" className={onNavigate ? "with-sidebar" : undefined}>{children}</main>
      <footer className={`site-footer ${onNavigate ? "with-sidebar-footer" : ""}`}><span>{ACTIVE_SITE_THEME.motif}</span><span className="footer-rule" aria-hidden="true" /><span>資料只在這個手帳裡保存</span></footer>
    </div>
  );
}

function PinGate({ mode, onUnlocked }: { mode: "setup" | "locked"; onUnlocked: () => void }) {
  const [setupSecret, setSetupSecret] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const isSetup = mode === "setup";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (isSetup && !/^[0-9a-f]{64}$/i.test(setupSecret)) { setError("請輸入部署者提供的 64 位十六進位啟用密碼。"); return; }
    if (!/^\d{6}$/.test(pin)) { setError("請輸入 6 位數字 PIN。"); return; }
    if (isSetup && pin !== confirmPin) { setError("兩次 PIN 不一致，請再確認一次。"); return; }
    setPending(true);
    try { await requestJson(`/api/auth/${isSetup ? "setup" : "unlock"}`, { method: "POST", body: JSON.stringify(isSetup ? { setupSecret, pin, confirmPin } : { pin }) }); setSetupSecret(""); setPin(""); setConfirmPin(""); onUnlocked(); }
    catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : "暫時未能解鎖。"); }
    finally { setPending(false); }
  }
  return <section className="gate-card" aria-labelledby="gate-title"><div className="eyebrow">{isSetup ? "第一次設定" : "手帳已上鎖"}</div><h1 id="gate-title">{isSetup ? "先替旅程留一頁" : "輸入 PIN，繼續準備旅程"}</h1><p className="gate-copy">{isSetup ? "先輸入部署者提供的一次性啟用密碼，再設定專屬的 6 位數 PIN。啟用密碼只在伺服器驗證，PIN 會以加鹽雜湊保存。" : "同一個 PIN 可以在不同裝置打開旅程清單。連續 5 次錯誤會暫停 15 分鐘。"}</p><form className="pin-form" onSubmit={submit}>{isSetup && <><label htmlFor="owner-setup-secret">部署者啟用密碼</label><input id="owner-setup-secret" type="password" value={setupSecret} onChange={(event) => setSetupSecret(event.target.value.replace(/[^0-9a-f]/gi, "").slice(0, 64))} inputMode="text" autoComplete="new-password" spellCheck={false} required aria-describedby={error ? "pin-error" : undefined} /></>}<label htmlFor="travel-notebook-pin">{isSetup ? "設定 6 位數 PIN" : "PIN"}</label><input id="travel-notebook-pin" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required aria-describedby={error ? "pin-error" : undefined} />{isSetup && <><label htmlFor="travel-notebook-pin-confirm">再輸入一次</label><input id="travel-notebook-pin-confirm" value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required /></>}{error && <p id="pin-error" className="field-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={pending}>{pending ? "處理中…" : isSetup ? "開始使用手帳" : "解鎖手帳"}</button></form></section>;
}

function EmptyState({ onNewTrip }: { onNewTrip: () => void }) {
  return <section className="empty-state" aria-labelledby="empty-title"><span className="empty-seal" aria-hidden="true" /><div><div className="eyebrow">第一趟日本旅行</div><h2 id="empty-title">還沒有旅程，先寫下想去的地方</h2><p>可以準備新旅程，也可以把走過的日子補寫成一冊過往旅記。</p><button className="primary-button" type="button" onClick={onNewTrip}>新增第一趟旅程</button></div></section>;
}

function TripForm({ onCreated, onCancel, prefill }: { onCreated: (trip: TripAggregate) => void; onCancel: () => void; prefill?: Partial<typeof initialTripForm> }) {
  const [form, setForm] = useState({ ...initialTripForm, ...prefill });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inferredSeason = form.startDate ? inferSeasonForDate(form.startDate) : null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    try { const data = await requestJson<{ trip: TripAggregate }>("/api/trips", { method: "POST", body: JSON.stringify(form) }); onCreated(data.trip); }
    catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : "未能建立旅程。"); }
    finally { setPending(false); }
  }
  return <section className="form-card" aria-labelledby="new-trip-title"><div className="section-heading compact-heading"><div><div className="eyebrow">寫下下一站或補回一段記憶</div><h2 id="new-trip-title">新增一趟旅程</h2></div><button className="quiet-button" type="button" onClick={onCancel}>先不新增</button></div><form className="trip-form" onSubmit={submit}><fieldset className="mode-fieldset"><legend>這是</legend><div className="mode-picker"><label className={`mode-option ${form.mode === "plan" ? "selected" : ""}`}><input type="radio" name="mode" value="plan" checked={form.mode === "plan"} onChange={() => setForm({ ...form, mode: "plan" })} /><span>準備新旅程</span><small>建立季節行李與臨出發清單</small></label><label className={`mode-option ${form.mode === "journal" ? "selected" : ""}`}><input type="radio" name="mode" value="journal" checked={form.mode === "journal"} onChange={() => setForm({ ...form, mode: "journal" })} /><span>補寫過往旅記</span><small>只記每天走過的路與小事</small></label></div></fieldset><label>旅程名稱<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例：東京慢慢走" required /></label><label>目的地<input value={form.destinations} onChange={(event) => setForm({ ...form, destinations: event.target.value })} placeholder="例：東京、鎌倉" required /></label><div className="form-grid two-columns"><label>出發日期<input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required /></label><label>回程日期<input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required /></label></div><fieldset className="season-fieldset"><legend>{form.mode === "journal" ? "旅記季節" : "執行李季節"}</legend><div className="season-picker">{seasonOptions.map((option) => <label key={option.value} className={`season-option ${form.season === option.value ? "selected" : ""}`}><input type="radio" name="season" value={option.value} checked={form.season === option.value} onChange={() => setForm({ ...form, season: option.value })} /><span>{option.label}</span><small>{option.note}</small></label>)}</div><p className="form-hint">{inferredSeason ? `按出發月份推算：${SEASON_LABELS[inferredSeason]}；你也可以手動改選。` : "輸入出發日期後，會自動推算季節。"}</p></fieldset>{error && <Notice message={error} />}<button className="primary-button" type="submit" disabled={pending}>{pending ? "正在建立旅程…" : form.mode === "journal" ? "建立過往旅記" : "建立旅程及清單"}</button></form></section>;
}

function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const percent = Math.round((done / Math.max(total, 1)) * 100);
  return <div className="progress-block"><div className="progress-label"><span>{label}</span><strong>{done} / {total}</strong></div><div className="progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}><span style={{ width: `${percent}%` }} /></div></div>;
}

function MoveButtons({ index, total, onMove, label, disabled = false }: { index: number; total: number; onMove: (direction: "up" | "down") => void; label: string; disabled?: boolean }) {
  return <span className="move-buttons" aria-label={`${label}排序`}><button className="text-button" type="button" onClick={() => onMove("up")} disabled={disabled || index === 0} aria-label={`${label}上移`}>↑</button><button className="text-button" type="button" onClick={() => onMove("down")} disabled={disabled || index === total - 1} aria-label={`${label}下移`}>↓</button></span>;
}

function swapIds(ids: string[], index: number, direction: "up" | "down"): string[] {
  const next = [...ids];
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

type ArchiveManagerProps = { trip: TripAggregate; onChange: (trip: TripAggregate) => void };

function ArchiveManager({ trip, onChange }: ArchiveManagerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [archive, setArchive] = useState<ArchivedTripAggregate | null>(null);
  async function refresh() {
    setLoading(true); setError("");
    try {
      const data = await requestJson<{ archived: ArchivedTripAggregate }>(`/api/trips/${trip.trip.id}/items?view=archived`);
      setArchive(data.archived);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "未能載入已收起項目。"); }
    finally { setLoading(false); }
  }
  async function toggleOpen() { const next = !open; setOpen(next); if (next) await refresh(); }
  async function restore(kind: "itinerary" | "packing" | "lastMinute" | "shopping" | "food", id: string) {
    setError("");
    try {
      const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "PATCH", body: JSON.stringify({ kind, id, archived: false }) });
      onChange(data.trip); await refresh();
    } catch (restoreError) { setError(restoreError instanceof Error ? restoreError.message : "未能還原項目。"); }
  }
  async function restoreSection(section: ListSectionRecord) {
    setError("");
    try {
      const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/sections`, { method: "PATCH", body: JSON.stringify({ kind: section.kind, id: section.id, archived: false }) });
      onChange(data.trip); await refresh();
    } catch (restoreError) { setError(restoreError instanceof Error ? restoreError.message : "未能還原店舖分組。"); }
  }
  const sectionRows = archive ? [...archive.shoppingSections, ...archive.foodSections] : [];
  const count = archive ? sectionRows.length + archive.itinerary.length + archive.packing.length + archive.lastMinute.length + archive.shopping.length + archive.food.length : 0;
  return <section className="archive-manager" aria-labelledby="archive-manager-heading"><div className="archive-manager-heading"><div><div className="eyebrow">資料仍然保留</div><h3 id="archive-manager-heading">已收起項目</h3><p>收起只會暫時隱藏；還原店舖分組後，旗下未收起項目會重新顯示。</p></div><button className="secondary-button" type="button" onClick={toggleOpen} aria-expanded={open}>{open ? "收起管理器" : "查看及還原"}</button></div>{open && <div className="archive-manager-body">{loading && <p className="muted-copy" role="status">正在整理已收起項目…</p>}{error && <Notice message={error} />}{!loading && archive && count === 0 && <p className="muted-copy">目前沒有已收起項目。</p>}{!loading && archive && sectionRows.length > 0 && <div className="archive-group"><h4>店舖分組</h4>{sectionRows.map((section) => <div className="archive-row" key={`${section.kind}-${section.id}`}><div><strong>{section.name}</strong><small>還原分組會顯示旗下未收起項目。</small></div><button className="text-button" type="button" onClick={() => restoreSection(section)}>還原分組</button></div>)}</div>}{!loading && archive && (archive.itinerary.length + archive.packing.length + archive.lastMinute.length + archive.shopping.length + archive.food.length > 0) && <div className="archive-group"><h4>個別項目</h4>{([...[...archive.itinerary].map((item) => ({ kind: "itinerary" as const, id: item.id, label: item.title, hint: "行程" })), ...archive.packing.map((item) => ({ kind: "packing" as const, id: item.id, label: item.label, hint: "執行李" })), ...archive.lastMinute.map((item) => ({ kind: "lastMinute" as const, id: item.id, label: item.label, hint: "臨出發" })), ...archive.shopping.map((item) => ({ kind: "shopping" as const, id: item.id, label: item.name, hint: "想買" })), ...archive.food.map((item) => ({ kind: "food" as const, id: item.id, label: item.name, hint: "想食／飲" }))]).map((item) => <div className="archive-row" key={`${item.kind}-${item.id}`}><div><strong>{item.label}</strong><small>{item.hint}{(item.kind === "shopping" || item.kind === "food") ? "；父店舖分組仍收起時，還原後會暫時隱藏" : ""}</small></div><button className="text-button" type="button" onClick={() => restore(item.kind, item.id)}>還原</button></div>)}</div>}</div>}</section>;
}

function ItineraryEditor({ item, trip, onChange, onCancel }: { item: ItineraryRecord; trip: TripAggregate; onChange: (trip: TripAggregate) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ itemDate: item.itemDate, dayPeriod: item.dayPeriod, itemTime: item.itemTime, title: item.title, category: item.category, location: item.location, note: item.note });
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "PATCH", body: JSON.stringify({ kind: "itinerary", id: item.id, ...form }) }); onChange(data.trip); onCancel(); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "未能更新行程。"); } }
  return <form className="card-editor" onSubmit={save}><div className="form-grid four-columns"><label>日期<input type="date" min={trip.trip.startDate} max={trip.trip.endDate} value={form.itemDate} onChange={(event) => setForm({ ...form, itemDate: event.target.value })} required /></label><label>時段<select value={form.dayPeriod} onChange={(event) => setForm({ ...form, dayPeriod: event.target.value as DayPeriod })}>{dayPeriodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>精確時間（可選）<input type="time" value={form.itemTime} onChange={(event) => setForm({ ...form, itemTime: event.target.value })} /></label><label>分類<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ItineraryCategory })}>{ITINERARY_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}</select></label></div><div className="form-grid three-columns"><label>標題<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label>地點<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><label>備註<input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label></div>{error && <Notice message={error} />}<div className="editor-actions"><button className="secondary-button" type="submit">儲存</button><button className="quiet-button" type="button" onClick={onCancel}>取消</button></div></form>;
}

function ItineraryArchiveButton({ item, tripId, onChange, label = "收起" }: { item: ItineraryRecord; tripId: string; onChange: (trip: TripAggregate) => void; label?: string }) {
  const [pending, setPending] = useState(false);
  async function archive() { setPending(true); try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${tripId}/items`, { method: "PATCH", body: JSON.stringify({ kind: "itinerary", id: item.id, archived: true }) }); onChange(data.trip); } finally { setPending(false); } }
  return <button className="text-button" type="button" onClick={archive} disabled={pending} aria-label={`${label}：${item.title}`}>{label}</button>;
}

function ItineraryRow({ item, trip, onChange, showDate = false, index, total, onMove }: { item: ItineraryRecord; trip: TripAggregate; onChange: (trip: TripAggregate) => void; showDate?: boolean; index?: number; total?: number; onMove?: (direction: "up" | "down") => void }) {
  const [editing, setEditing] = useState(false);
  const timeLabel = item.itemTime || DAY_PERIOD_LABELS[item.dayPeriod];
  return <article className="itinerary-row"><time dateTime={item.itemTime ? `${item.itemDate}T${item.itemTime}` : item.itemDate}>{showDate ? item.itemDate.slice(5).replace("-", "/") : timeLabel}{showDate && <small>{timeLabel}</small>}</time><div>{editing ? <ItineraryEditor item={item} trip={trip} onChange={onChange} onCancel={() => setEditing(false)} /> : <><div className="entry-title-line"><span className="category-badge">{CATEGORY_LABELS[item.category]}</span><h3>{item.title}</h3></div>{item.location && <p>{item.location}</p>}{item.note && <small>{item.note}</small>}</>}</div>{!editing && <div className="row-actions">{onMove && index !== undefined && total !== undefined && <MoveButtons index={index} total={total} label={item.title} onMove={onMove} />}<button className="text-button" type="button" onClick={() => setEditing(true)}>編輯</button><ItineraryArchiveButton item={item} tripId={trip.trip.id} onChange={onChange} /></div>}</article>;
}

function WeatherSummary({ item, trip, onChange }: { item: ItineraryRecord; trip: TripAggregate; onChange: (trip: TripAggregate) => void }) {
  const [editing, setEditing] = useState(false);
  return <div className="weather-block">{editing ? <ItineraryEditor item={item} trip={trip} onChange={onChange} onCancel={() => setEditing(false)} /> : <span className="weather-heading"><span>天氣：{item.title}</span><button className="text-button" type="button" onClick={() => setEditing(true)}>編輯天氣</button><ItineraryArchiveButton item={item} tripId={trip.trip.id} onChange={onChange} label="收起天氣" /></span>}</div>;
}

function ItineraryPanel({ trip, onChange }: { trip: TripAggregate; onChange: (trip: TripAggregate) => void }) {
  const [form, setForm] = useState({ itemDate: trip.trip.startDate, itemTime: "", dayPeriod: "allDay" as DayPeriod, title: "", category: "other" as ItineraryCategory, location: "", note: "" });
  const [error, setError] = useState("");
  const days = useMemo(() => groupItineraryByDate(trip.itinerary), [trip.itinerary]);
  const isJournal = trip.trip.mode === "journal";
  async function add(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "POST", body: JSON.stringify({ kind: "itinerary", ...form }) }); onChange(data.trip); setForm({ ...form, title: "", location: "", note: "", itemTime: "" }); } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : "未能加入行程。"); } }
  async function reorder(order: string[], itemDate?: string) { try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "PATCH", body: JSON.stringify({ kind: "itinerary", order, ...(itemDate ? { itemDate } : {}) }) }); onChange(data.trip); } catch (reorderError) { setError(reorderError instanceof Error ? reorderError.message : "未能調整行程次序。"); } }
  return <section className="panel-content" aria-labelledby="itinerary-heading"><div className="section-heading"><div><div className="eyebrow">{isJournal ? "把走過的日子留低" : "留白給每天"}</div><h2 id="itinerary-heading">{isJournal ? "旅程 Log" : "行程"}</h2></div><span className="section-count">{trip.itinerary.length} 筆</span></div>{trip.itinerary.length === 0 ? <p className="muted-copy">還未有安排，先記下第一個想去的地方。</p> : isJournal ? <div className="itinerary-days">{days.map((day) => <section className="itinerary-day" key={day.date}><div className="day-heading"><div><strong>{day.date.slice(5).replace("-", "/")}（週{day.weekday}）</strong>{day.weather && <WeatherSummary item={day.weather} trip={trip} onChange={onChange} />}</div><span>{day.entries.length} 筆</span></div><div className="itinerary-list">{day.entries.map((item, index) => <ItineraryRow key={item.id} item={item} trip={trip} onChange={onChange} index={index} total={day.entries.length} onMove={(direction) => reorder(swapIds(day.entries.map((entry) => entry.id), index, direction), day.date)} />)}</div></section>)}</div> : <div className="itinerary-list">{trip.itinerary.map((item, index) => <ItineraryRow key={item.id} item={item} trip={trip} onChange={onChange} showDate index={index} total={trip.itinerary.length} onMove={(direction) => reorder(swapIds(trip.itinerary.map((entry) => entry.id), index, direction))} />)}</div>}<form className="inline-form itinerary-form" onSubmit={add}><h3>{isJournal ? "加一筆旅記" : "加一個安排"}</h3><div className="form-grid four-columns"><label>日期<input type="date" min={trip.trip.startDate} max={trip.trip.endDate} value={form.itemDate} onChange={(event) => setForm({ ...form, itemDate: event.target.value })} required /></label><label>時段<select value={form.dayPeriod} onChange={(event) => setForm({ ...form, dayPeriod: event.target.value as DayPeriod })}>{dayPeriodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>時間（可選）<input type="time" value={form.itemTime} onChange={(event) => setForm({ ...form, itemTime: event.target.value })} /></label><label>標題<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={isJournal ? "例：在溪邊食早餐" : "例：抵達羽田"} required /></label></div><div className="form-grid three-columns"><label>分類<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ItineraryCategory })}>{ITINERARY_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}</select></label><label>地點<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="例：淺草站" /></label><label>備註<input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="交通、預約號碼…" /></label></div>{error && <Notice message={error} />}<button className="secondary-button" type="submit">{isJournal ? "記低旅記" : "加入行程"}</button></form></section>;
}

function PackingEditor({ item, trip, onChange, onCancel }: { item: PackingRecord; trip: TripAggregate; onChange: (trip: TripAggregate) => void; onCancel: () => void }) {
  const [label, setLabel] = useState(item.label); const [category, setCategory] = useState(item.category); const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "PATCH", body: JSON.stringify({ kind: "packing", id: item.id, label, category }) }); onChange(data.trip); onCancel(); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "未能更新行李項目。"); } }
  return <form className="card-editor compact-editor" onSubmit={save}><label>物品名稱<input value={label} onChange={(event) => setLabel(event.target.value)} required /></label><label>分類<select value={category} onChange={(event) => setCategory(event.target.value)}>{PACKING_CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></label>{error && <Notice message={error} />}<div className="editor-actions"><button className="secondary-button" type="submit">儲存</button><button className="quiet-button" type="button" onClick={onCancel}>取消</button></div></form>;
}

function PackingPanel({ trip, onChange }: { trip: TripAggregate; onChange: (trip: TripAggregate) => void }) {
  const [filter, setFilter] = useState<PackingFilter>("all"); const [customLabel, setCustomLabel] = useState(""); const [customCategory, setCustomCategory] = useState("其他"); const [error, setError] = useState(""); const [editingId, setEditingId] = useState<string | null>(null); const [deletingId, setDeletingId] = useState<string | null>(null);
  const done = trip.packing.filter((item) => item.checked).length;
  const groups = useMemo(() => PACKING_CATEGORIES.map((category) => ({ category, items: trip.packing.filter((item) => item.category === category && (filter === "all" || (filter === "complete" ? item.checked : !item.checked))) })).filter((group) => group.items.length > 0), [filter, trip.packing]);
  async function toggle(item: PackingRecord) { try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "PATCH", body: JSON.stringify({ kind: "packing", id: item.id, checked: !item.checked }) }); onChange(data.trip); } catch (toggleError) { setError(toggleError instanceof Error ? toggleError.message : "未能更新行李狀態。"); } }
  async function reorder(category: string, order: string[]) { try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "PATCH", body: JSON.stringify({ kind: "packing", category, order }) }); onChange(data.trip); } catch (reorderError) { setError(reorderError instanceof Error ? reorderError.message : "未能調整行李項目次序。"); } }
  async function deleteItem(item: PackingRecord) { if (!window.confirm(`刪除「${item.label}」？項目會從執行李清單移除，但 D1 紀錄仍會保留。`)) return; setError(""); setDeletingId(item.id); try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "PATCH", body: JSON.stringify({ kind: "packing", id: item.id, archived: true }) }); onChange(data.trip); } catch (deletionError) { setError(deletionError instanceof Error ? deletionError.message : "未能刪除行李項目。"); } finally { setDeletingId(null); } }
  async function addCustom(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!customLabel.trim()) return; try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "POST", body: JSON.stringify({ kind: "packing", label: customLabel, category: customCategory }) }); onChange(data.trip); setCustomLabel(""); } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : "未能加入物品。"); } }
  return <section className="panel-content" aria-labelledby="packing-heading"><div className="section-heading"><div><div className="eyebrow">從參考清單開始</div><h2 id="packing-heading">執行李</h2></div><span className="season-stamp">{SEASON_LABELS[trip.trip.season as Season]}</span></div><ProgressBar done={done} total={trip.packing.length} label="收拾進度" /><div className="filter-row" aria-label="執行李篩選">{(["all", "outstanding", "complete"] as PackingFilter[]).map((value) => <button className={filter === value ? "filter-button active" : "filter-button"} type="button" key={value} onClick={() => setFilter(value)}>{value === "all" ? "全部" : value === "outstanding" ? "未完成" : "已完成"}</button>)}</div>{error && <Notice message={error} />}{filter !== "all" && <p className="small-note">先切換至「全部」後再調整排序，避免漏掉同分類項目。</p>}<div className="packing-groups">{groups.map((group) => { const allCategoryItems = trip.packing.filter((item) => item.category === group.category); const ids = allCategoryItems.map((item) => item.id); return <div className="packing-group" key={group.category}><h3>{group.category}<span>{group.items.length}</span></h3>{group.items.map((item) => { const itemIndex = allCategoryItems.findIndex((entry) => entry.id === item.id); return editingId === item.id ? <PackingEditor item={item} trip={trip} onChange={onChange} onCancel={() => setEditingId(null)} key={item.id} /> : <div className={`check-row ${item.checked ? "checked" : ""}`} key={item.id}><label><input type="checkbox" checked={item.checked} onChange={() => toggle(item)} /><span className="fake-check" aria-hidden="true" /><span>{item.label}</span></label><div className="row-actions"><MoveButtons index={itemIndex} total={allCategoryItems.length} label={item.label} disabled={filter !== "all"} onMove={(direction) => reorder(group.category, swapIds(ids, itemIndex, direction))} /><button className="text-button" type="button" onClick={() => setEditingId(item.id)} disabled={deletingId === item.id}>編輯</button><button className="text-button danger-text-button" type="button" onClick={() => deleteItem(item)} disabled={deletingId === item.id} aria-label={`刪除執行李項目：${item.label}`}>{deletingId === item.id ? "刪除中…" : "刪除"}</button></div></div>; })}</div>; })}</div><form className="add-row-form" onSubmit={addCustom}><label htmlFor="custom-packing">加入自訂物品</label><div className="add-row-controls"><input id="custom-packing" value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} placeholder="例：旅途的茶包" /><select value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} aria-label="自訂物品分類">{PACKING_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select><button className="secondary-button" type="submit">加入</button></div></form></section>;
}

function ShoppingEditor({ item, trip, onChange, onCancel }: { item: ShoppingRecord; trip: TripAggregate; onChange: (trip: TripAggregate) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: item.name, link: item.link, quantity: item.quantity, shop: item.shop, note: item.note }); const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "PATCH", body: JSON.stringify({ kind: "shopping", id: item.id, ...form }) }); onChange(data.trip); onCancel(); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "未能更新想買項目。"); } }
  return <form className="card-editor" onSubmit={save}><div className="form-grid two-columns"><label>物品名稱<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label>安全連結（可選）<input type="url" value={form.link} onChange={(event) => setForm({ ...form, link: event.target.value })} /></label></div><div className="form-grid three-columns"><label>數量<input value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label><label>店舖<input value={form.shop} onChange={(event) => setForm({ ...form, shop: event.target.value })} /></label><label>備註<input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label></div>{error && <Notice message={error} />}<div className="editor-actions"><button className="secondary-button" type="submit">儲存</button><button className="quiet-button" type="button" onClick={onCancel}>取消</button></div></form>;
}

function ShoppingPanel({ trip, onChange }: { trip: TripAggregate; onChange: (trip: TripAggregate) => void }) {
  const [form, setForm] = useState({ name: "", link: "", quantity: "1", shop: "", note: "" }); const [error, setError] = useState(""); const [editingId, setEditingId] = useState<string | null>(null);
  async function add(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "POST", body: JSON.stringify({ kind: "shopping", ...form }) }); onChange(data.trip); setForm({ name: "", link: "", quantity: "1", shop: "", note: "" }); } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : "未能加入想買清單。"); } }
  async function update(item: ShoppingRecord, change: Record<string, unknown>) { try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "PATCH", body: JSON.stringify({ kind: "shopping", id: item.id, ...change }) }); onChange(data.trip); } catch (updateError) { setError(updateError instanceof Error ? updateError.message : "未能更新想買項目。"); } }
  async function reorderSection(order: string[]) { try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/sections`, { method: "PATCH", body: JSON.stringify({ kind: "shopping", order }) }); onChange(data.trip); } catch (reorderError) { setError(reorderError instanceof Error ? reorderError.message : "未能調整店舖分組次序。"); } }
  async function reorderItems(sectionId: string, order: string[]) { try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "PATCH", body: JSON.stringify({ kind: "shopping", sectionId, order }) }); onChange(data.trip); } catch (reorderError) { setError(reorderError instanceof Error ? reorderError.message : "未能調整想買項目次序。"); } }
  async function archiveSection(section: ListSectionRecord) { if (!window.confirm(`收起「${section.name}」？旗下項目會暫時隱藏，但資料可以在已收起項目還原。`)) return; try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/sections`, { method: "PATCH", body: JSON.stringify({ kind: "shopping", id: section.id, archived: true }) }); onChange(data.trip); } catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : "未能收起店舖分組。"); } }
  const renderSection = (section: ListSectionRecord, _sectionIndex: number, sections: ListSectionRecord[]) => {
    const items = trip.shopping.filter((item) => item.sectionId === section.id);
    const ids = items.map((item) => item.id);
    const isLegacySection = section.id.startsWith("legacy:");
    const reorderableSections = sections.filter((value) => !value.id.startsWith("legacy:"));
    const reorderableIndex = reorderableSections.findIndex((value) => value.id === section.id);
    return <section className="place-section" key={section.id}><div className="place-section-heading"><div><h3>{section.name}</h3><span>{items.length} 件</span></div>{!isLegacySection && <div className="row-actions"><MoveButtons index={reorderableIndex} total={reorderableSections.length} label={section.name} onMove={(direction) => reorderSection(swapIds(reorderableSections.map((value) => value.id), reorderableIndex, direction))} /><button className="text-button danger-text-button" type="button" onClick={() => archiveSection(section)}>收起</button></div>}</div>{isLegacySection && <p className="muted-copy">舊有項目仍然完整顯示；編輯或勾選後會安全加入店舖分組。</p>}{items.length === 0 ? <p className="muted-copy">這個分組暫時沒有項目。</p> : <div className="shopping-list">{items.map((item, itemIndex) => editingId === item.id ? <ShoppingEditor key={item.id} item={item} trip={trip} onChange={onChange} onCancel={() => setEditingId(null)} /> : <article className={`shopping-row ${item.purchased ? "purchased" : ""}`} key={item.id}><label className="shopping-check"><input type="checkbox" checked={item.purchased} onChange={() => update(item, { purchased: !item.purchased })} /><span className="fake-check" aria-hidden="true" /><span>{item.name}</span></label><span className="shopping-meta">{item.quantity}</span>{item.link && <a href={item.link} target="_blank" rel="noreferrer">開啟連結</a>}<div className="row-actions">{!isLegacySection && <MoveButtons index={itemIndex} total={items.length} label={item.name} onMove={(direction) => reorderItems(section.id, swapIds(ids, itemIndex, direction))} />}<button className="text-button" type="button" onClick={() => setEditingId(item.id)}>編輯</button><button className="text-button danger-text-button" type="button" onClick={() => update(item, { archived: true })} aria-label={`收起想買項目：${item.name}`}>收起</button></div>{item.note && <small>{item.note}</small>}</article>)}</div>}</section>;
  };
  return <section className="panel-content" aria-labelledby="shopping-heading"><div className="section-heading"><div><div className="eyebrow">把想買的先放一邊</div><h2 id="shopping-heading">想買</h2></div><span className="section-count">{trip.shopping.length} 件</span></div>{error && <Notice message={error} />}{trip.shoppingSections.length === 0 ? <p className="muted-copy">還沒有想買的東西。加上安全連結，出發前再慢慢決定。</p> : <div className="place-sections">{trip.shoppingSections.map((section, index) => renderSection(section, index, trip.shoppingSections))}</div>}<form className="inline-form shopping-form" onSubmit={add}><h3>加入想買</h3><div className="form-grid two-columns"><label>物品名稱<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label>安全連結（可選）<input type="url" value={form.link} onChange={(event) => setForm({ ...form, link: event.target.value })} placeholder="https://…" /></label></div><div className="form-grid three-columns"><label>數量<input value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label><label>店舖<input value={form.shop} onChange={(event) => setForm({ ...form, shop: event.target.value })} /></label><label>備註<input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label></div>{error && <Notice message={error} />}<button className="secondary-button" type="submit">加入清單</button></form></section>;
}

function FoodEditor({ item, trip, onChange, onCancel }: { item: FoodRecord; trip: TripAggregate; onChange: (trip: TripAggregate) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: item.name, shop: item.shop, link: item.link, note: item.note });
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "PATCH", body: JSON.stringify({ kind: "food", id: item.id, ...form }) }); onChange(data.trip); onCancel(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "未能更新想食／飲項目。"); }
  }
  return <form className="card-editor" onSubmit={save}><div className="form-grid two-columns"><label>食物／飲品名稱<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label>便利店／店舖（可選）<input value={form.shop} onChange={(event) => setForm({ ...form, shop: event.target.value })} placeholder="例：7-Eleven" /></label><label>安全連結（可選）<input type="url" value={form.link} onChange={(event) => setForm({ ...form, link: event.target.value })} placeholder="https://…" /></label><label>備註（可選）<input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label></div>{error && <Notice message={error} />}<div className="editor-actions"><button className="secondary-button" type="submit">儲存</button><button className="quiet-button" type="button" onClick={onCancel}>取消</button></div></form>;
}

function FoodPanel({ trip, onChange }: { trip: TripAggregate; onChange: (trip: TripAggregate) => void }) {
  const [form, setForm] = useState({ name: "", shop: "", link: "", note: "" }); const [error, setError] = useState(""); const [editingId, setEditingId] = useState<string | null>(null);
  const tried = trip.food.filter((item) => item.tried).length;
  async function add(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "POST", body: JSON.stringify({ kind: "food", ...form }) }); onChange(data.trip); setForm({ name: "", shop: "", link: "", note: "" }); } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : "未能加入想食／飲清單。"); } }
  async function update(item: FoodRecord, change: Record<string, unknown>) { setError(""); try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "PATCH", body: JSON.stringify({ kind: "food", id: item.id, ...change }) }); onChange(data.trip); } catch (updateError) { setError(updateError instanceof Error ? updateError.message : "未能更新想食／飲項目。"); } }
  async function reorderSection(order: string[]) { try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/sections`, { method: "PATCH", body: JSON.stringify({ kind: "food", order }) }); onChange(data.trip); } catch (reorderError) { setError(reorderError instanceof Error ? reorderError.message : "未能調整店舖分組次序。"); } }
  async function reorderItems(sectionId: string, order: string[]) { try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "PATCH", body: JSON.stringify({ kind: "food", sectionId, order }) }); onChange(data.trip); } catch (reorderError) { setError(reorderError instanceof Error ? reorderError.message : "未能調整想食／飲項目次序。"); } }
  async function archiveSection(section: ListSectionRecord) { if (!window.confirm(`收起「${section.name}」？旗下項目會暫時隱藏，但資料可以在已收起項目還原。`)) return; try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/sections`, { method: "PATCH", body: JSON.stringify({ kind: "food", id: section.id, archived: true }) }); onChange(data.trip); } catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : "未能收起店舖分組。"); } }
  const renderSection = (section: ListSectionRecord, _sectionIndex: number, sections: ListSectionRecord[]) => {
    const items = trip.food.filter((item) => item.sectionId === section.id);
    const ids = items.map((item) => item.id);
    const isLegacySection = section.id.startsWith("legacy:");
    const reorderableSections = sections.filter((value) => !value.id.startsWith("legacy:"));
    const reorderableIndex = reorderableSections.findIndex((value) => value.id === section.id);
    return <section className="place-section" key={section.id}><div className="place-section-heading"><div><h3>{section.name}</h3><span>{items.length} 件</span></div>{!isLegacySection && <div className="row-actions"><MoveButtons index={reorderableIndex} total={reorderableSections.length} label={section.name} onMove={(direction) => reorderSection(swapIds(reorderableSections.map((value) => value.id), reorderableIndex, direction))} /><button className="text-button danger-text-button" type="button" onClick={() => archiveSection(section)}>收起</button></div>}</div>{isLegacySection && <p className="muted-copy">舊有項目仍然完整顯示；編輯或勾選後會安全加入店舖分組。</p>}{items.length === 0 ? <p className="muted-copy">這個分組暫時沒有項目。</p> : <div className="food-list">{items.map((item, itemIndex) => editingId === item.id ? <FoodEditor key={item.id} item={item} trip={trip} onChange={onChange} onCancel={() => setEditingId(null)} /> : <article className={`food-row ${item.tried ? "tried" : ""}`} key={item.id}><label className="food-check"><input type="checkbox" checked={item.tried} onChange={() => update(item, { tried: !item.tried })} /><span className="fake-check" aria-hidden="true" /><span>{item.name}</span></label><span className="food-meta">{item.shop || "店舖待定"}</span>{item.link && <a href={item.link} target="_blank" rel="noreferrer">開啟連結</a>}<div className="row-actions">{!isLegacySection && <MoveButtons index={itemIndex} total={items.length} label={item.name} onMove={(direction) => reorderItems(section.id, swapIds(ids, itemIndex, direction))} />}<button className="text-button" type="button" onClick={() => setEditingId(item.id)}>編輯</button><button className="text-button danger-text-button" type="button" onClick={() => update(item, { archived: true })} aria-label={`收起想食／飲項目：${item.name}`}>收起</button></div>{item.note && <small>{item.note}</small>}</article>)}</div>}</section>;
  };
  return <section className="panel-content" aria-labelledby="food-heading"><div className="section-heading"><div><div className="eyebrow">先記低旅途想試的味道</div><h2 id="food-heading">想食／飲</h2></div><span className="section-count">{tried}/{trip.food.length} 已食</span></div>{error && <Notice message={error} />}{trip.foodSections.length === 0 ? <p className="muted-copy">還沒有想試的食物。便利店、店舖和連結都可以之後再補。</p> : <div className="place-sections">{trip.foodSections.map((section, index) => renderSection(section, index, trip.foodSections))}</div>}<form className="inline-form food-form" onSubmit={add}><h3>加入想食／飲</h3><div className="form-grid two-columns"><label>食物／飲品名稱<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例：明太子飯糰" required /></label><label>便利店／店舖（可選）<input value={form.shop} onChange={(event) => setForm({ ...form, shop: event.target.value })} placeholder="例：7-Eleven" /></label><label>安全連結（可選）<input type="url" value={form.link} onChange={(event) => setForm({ ...form, link: event.target.value })} placeholder="https://…" /></label><label>備註（可選）<input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label></div>{error && <Notice message={error} />}<button className="secondary-button" type="submit">加入清單</button></form></section>;
}

function LastMinuteEditor({ item, trip, onChange, onCancel }: { item: LastMinuteRecord; trip: TripAggregate; onChange: (trip: TripAggregate) => void; onCancel: () => void }) {
  const [label, setLabel] = useState(item.label); const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "PATCH", body: JSON.stringify({ kind: "lastMinute", id: item.id, label }) }); onChange(data.trip); onCancel(); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "未能更新檢查項目。"); } }
  return <form className="card-editor compact-editor" onSubmit={save}><label>檢查項目<input value={label} onChange={(event) => setLabel(event.target.value)} required /></label>{error && <Notice message={error} />}<div className="editor-actions"><button className="secondary-button" type="submit">儲存</button><button className="quiet-button" type="button" onClick={onCancel}>取消</button></div></form>;
}

function LastMinutePanel({ trip, onChange }: { trip: TripAggregate; onChange: (trip: TripAggregate) => void }) {
  const [label, setLabel] = useState(""); const [error, setError] = useState(""); const [editingId, setEditingId] = useState<string | null>(null); const done = trip.lastMinute.filter((item) => item.checked).length;
  async function toggle(item: LastMinuteRecord) { try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "PATCH", body: JSON.stringify({ kind: "lastMinute", id: item.id, checked: !item.checked }) }); onChange(data.trip); } catch (toggleError) { setError(toggleError instanceof Error ? toggleError.message : "未能更新最後檢查。"); } }
  async function update(item: LastMinuteRecord, change: Record<string, unknown>) { try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "PATCH", body: JSON.stringify({ kind: "lastMinute", id: item.id, ...change }) }); onChange(data.trip); } catch (updateError) { setError(updateError instanceof Error ? updateError.message : "未能更新最後檢查。"); } }
  async function reorder(order: string[]) { try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "PATCH", body: JSON.stringify({ kind: "lastMinute", order }) }); onChange(data.trip); } catch (reorderError) { setError(reorderError instanceof Error ? reorderError.message : "未能調整最後檢查次序。"); } }
  async function add(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!label.trim()) return; try { const data = await requestJson<{ trip: TripAggregate }>(`/api/trips/${trip.trip.id}/items`, { method: "POST", body: JSON.stringify({ kind: "lastMinute", label }) }); onChange(data.trip); setLabel(""); } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : "未能加入檢查項目。"); } }
  return <section className="panel-content" aria-labelledby="last-minute-heading"><div className="section-heading"><div><div className="eyebrow">出門前的最後確認</div><h2 id="last-minute-heading">臨出發</h2></div><span className="section-count">{done}/{trip.lastMinute.length}</span></div><p className="panel-intro">出發前一天逐項看過，放心把家門鎖上。</p><ProgressBar done={done} total={trip.lastMinute.length} label="最後確認" />{error && <Notice message={error} />}<div className="last-minute-list">{trip.lastMinute.map((item, index) => editingId === item.id ? <LastMinuteEditor key={item.id} item={item} trip={trip} onChange={onChange} onCancel={() => setEditingId(null)} /> : <div className={`check-row last-minute-row ${item.checked ? "checked" : ""}`} key={item.id}><label><input type="checkbox" checked={item.checked} onChange={() => toggle(item)} /><span className="fake-check" aria-hidden="true" /><span>{item.label}</span>{item.checkedAt && <time dateTime={item.checkedAt}>已確認</time>}</label><div className="row-actions"><MoveButtons index={index} total={trip.lastMinute.length} label={item.label} onMove={(direction) => reorder(swapIds(trip.lastMinute.map((entry) => entry.id), index, direction))} /><button className="text-button" type="button" onClick={() => setEditingId(item.id)}>編輯</button><button className="text-button danger-text-button" type="button" onClick={() => update(item, { archived: true })} aria-label={`收起臨出發項目：${item.label}`}>收起</button></div></div>)}</div><form className="add-row-form" onSubmit={add}><label htmlFor="custom-last-minute">加入自訂檢查</label><div className="add-row-controls"><input id="custom-last-minute" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="例：提醒鄰居收信" /><button className="secondary-button" type="submit">加入</button></div></form></section>;
}

function TripMetadataEditor({ trip, onChange, onCancel }: { trip: TripAggregate; onChange: (trip: TripAggregate) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ title: trip.trip.title, destinations: trip.trip.destinations, startDate: trip.trip.startDate, endDate: trip.trip.endDate, season: trip.trip.season as Season }); const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); try { const data = await requestJson<TripAggregate>(`/api/trips/${trip.trip.id}`, { method: "PATCH", body: JSON.stringify(form) }); onChange(data); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "未能更新旅程資料。"); } }
  return <form className="card-editor metadata-editor" onSubmit={save}><div className="form-grid two-columns"><label>旅程名稱<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label>目的地<input value={form.destinations} onChange={(event) => setForm({ ...form, destinations: event.target.value })} required /></label><label>出發日期<input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required /></label><label>回程日期<input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required /></label></div><fieldset className="season-fieldset"><legend>季節</legend><div className="season-picker">{seasonOptions.map((option) => <label key={option.value} className={`season-option ${form.season === option.value ? "selected" : ""}`}><input type="radio" name={`season-${trip.trip.id}`} value={option.value} checked={form.season === option.value} onChange={() => setForm({ ...form, season: option.value })} /><span>{option.label}</span><small>{option.note}</small></label>)}</div></fieldset>{error && <Notice message={error} />}<div className="editor-actions"><button className="secondary-button" type="submit">儲存旅程資料</button><button className="quiet-button" type="button" onClick={onCancel}>取消</button></div></form>;
}

type ArchiveTrip = (trip: TripAggregate) => Promise<boolean>;

function ArchiveTripButton({ trip, onArchive, compact = false }: { trip: TripAggregate; onArchive: ArchiveTrip; compact?: boolean }) {
  const [pending, setPending] = useState(false);
  async function handleArchive() {
    setPending(true);
    try { await onArchive(trip); } finally { setPending(false); }
  }
  return <button className={`archive-button ${compact ? "compact" : ""}`} type="button" onClick={handleArchive} disabled={pending} aria-label={`收起旅程：${trip.trip.title}`}>{pending ? "處理中…" : "收起旅程"}</button>;
}

function TripDetail({ trip, onChange, onArchive }: { trip: TripAggregate; onChange: (trip: TripAggregate) => void; onArchive: ArchiveTrip }) {
  const [tab, setTab] = useState<Tab>("packing"); const [editingMetadata, setEditingMetadata] = useState(false); const isJournal = trip.trip.mode === "journal"; const visibleTabs = isJournal ? tabOptions.filter((option) => option.value === "itinerary") : tabOptions; const activeTab: Tab = isJournal ? "itinerary" : tab;
  return <section className="trip-detail"><div className="trip-hero"><div><span className="season-stamp">{isJournal ? "過往旅記" : SEASON_LABELS[trip.trip.season as Season]}</span>{editingMetadata ? <TripMetadataEditor trip={trip} onChange={(next) => { onChange(next); setEditingMetadata(false); }} onCancel={() => setEditingMetadata(false)} /> : <><h1>{trip.trip.title}</h1><p>{trip.trip.destinations} <span aria-hidden="true">·</span> {formatDateRange(trip.trip.startDate, trip.trip.endDate)}</p></>}</div><div className="hero-actions">{!editingMetadata && <button className="text-button" type="button" onClick={() => setEditingMetadata(true)}>編輯旅程資料</button>}{!isJournal && <ArchiveTripButton trip={trip} onArchive={onArchive} compact />}</div></div><nav className="trip-tabs" aria-label="旅程內容"><div className="tab-list">{visibleTabs.map((option) => <button key={option.value} className={activeTab === option.value ? "tab active" : "tab"} type="button" aria-current={activeTab === option.value ? "page" : undefined} onClick={() => setTab(option.value)}><span>{isJournal && option.value === "itinerary" ? "旅程 Log" : option.label}</span><small>{isJournal && option.value === "itinerary" ? "每天走過的路" : option.hint}</small></button>)}</div></nav><ArchiveManager trip={trip} onChange={onChange} />{activeTab === "packing" && <PackingPanel trip={trip} onChange={onChange} />}{activeTab === "lastMinute" && <LastMinutePanel trip={trip} onChange={onChange} />}{activeTab === "shopping" && <ShoppingPanel trip={trip} onChange={onChange} />}{activeTab === "food" && <FoodPanel trip={trip} onChange={onChange} />}{activeTab === "itinerary" && <ItineraryPanel trip={trip} onChange={onChange} />}</section>;
}

function TripCard({ trip, onOpenTrip, onArchive, compact = false }: { trip: TripAggregate; onOpenTrip: (id: string) => void; onArchive?: ArchiveTrip; compact?: boolean }) {
  const isJournal = trip.trip.mode === "journal";
  return <article className={`trip-card ${compact ? "trip-card-compact" : ""}`}><div className="trip-card-copy"><span className="summary-season">{isJournal ? "過往旅記" : SEASON_LABELS[trip.trip.season as Season]}</span><strong>{trip.trip.title}</strong><span>{trip.trip.destinations}</span><small>{formatDateRange(trip.trip.startDate, trip.trip.endDate)}</small><em>{trip.itinerary.length} 筆行程</em></div><div className="trip-card-actions"><button className="trip-open-button" type="button" onClick={() => onOpenTrip(trip.trip.id)}>開啟旅程</button>{onArchive && !isJournal && <ArchiveTripButton trip={trip} onArchive={onArchive} />}</div></article>;
}

function Overview({ trips, onNewTrip, onOpenTrip, onArchive, onNavigate }: { trips: TripAggregate[]; onNewTrip: (prefill?: Partial<typeof initialTripForm>) => void; onOpenTrip: (id: string) => void; onArchive: ArchiveTrip; onNavigate: (view: AppView) => void }) {
  const today = todayIso(); const upcoming = trips.filter((trip) => isUpcomingTrip(trip, today)).sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate)); const next = upcoming[0]; const journalCount = trips.filter((trip) => isPastTrip(trip, today)).length;
  return <div className="dashboard-view"><section className="welcome-band"><div><div className="eyebrow">{ACTIVE_SITE_THEME.label}</div><h1>把旅程寫好，出發就輕一點</h1><p>從季節執行李，到最後一刻的口袋檢查，慢慢準備就好。</p></div><button className="secondary-button" type="button" onClick={() => onNewTrip()}>新增旅程</button></section><div className="overview-grid"><article className="stat-card"><span>所有旅程</span><strong>{trips.length}</strong><small>現有旅程與旅記</small></article><article className="stat-card"><span>即將出發</span><strong>{upcoming.length}</strong><small>今天或以後的計劃</small></article><article className="stat-card"><span>過往旅記</span><strong>{journalCount}</strong><small>留住走過的日子</small></article></div><section className="next-destination"><div><span className="eyebrow">{next ? "下一站" : "旅程提示"}</span><h2>{next ? next.trip.destinations : "先寫下你的下一站"}</h2><p>{next ? formatDateRange(next.trip.startDate, next.trip.endDate) : "建立旅程後，日期與目的地會顯示在這裡。"}</p></div><button className="primary-button" type="button" onClick={() => onNavigate("map")}>看看日本足跡</button></section>{next ? <section className="overview-section"><div className="section-heading"><div><div className="eyebrow">最近一趟</div><h2>準備中的旅程</h2></div><button className="quiet-button" type="button" onClick={() => onNavigate("upcoming")}>查看全部</button></div><TripCard trip={next} compact onOpenTrip={onOpenTrip} onArchive={onArchive} /></section> : <section className="cta-card"><div><div className="eyebrow">準備下一站</div><h2>開始一趟新旅程</h2><p>先留下目的地、日期與季節，之後再慢慢補上行程。</p></div><button className="primary-button" type="button" onClick={() => onNewTrip()}>新增旅程</button></section>}</div>;
}

function TripListView({ title, eyebrow, trips, onOpenTrip, onArchive, allowArchive, empty }: { title: string; eyebrow: string; trips: TripAggregate[]; onOpenTrip: (id: string) => void; onArchive?: ArchiveTrip; allowArchive: boolean; empty: string }) {
  return <section className="dashboard-view list-view"><div className="section-heading page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div><span className="section-count">{trips.length} 趟</span></div>{trips.length === 0 ? <p className="muted-copy">{empty}</p> : <div className="trip-card-grid">{trips.map((trip) => <TripCard key={trip.trip.id} trip={trip} onOpenTrip={onOpenTrip} onArchive={allowArchive ? onArchive : undefined} />)}</div>}</section>;
}

function LinkList({ links }: { links: JapanLink[] }) { return <ul className="source-list">{links.map((source) => <li key={source.href}><a href={source.href} target="_blank" rel="noreferrer">{source.label}</a></li>)}</ul>; }

function KnowledgeView() {
  return <section className="dashboard-view knowledge-view"><div className="page-heading"><div className="eyebrow">下次旅行前，先知道一點</div><h1>日本小知識</h1><p className="page-intro">把走過的地方、想吃的味道與日常禮儀，放在同一頁慢慢看。</p></div><div className="knowledge-grid"><article className="knowledge-card wide"><h2>旅程沿線的地方味道</h2><div className="regional-grid">{REGIONAL_SPECIALTIES.map((item) => <div key={item.place}><strong>{item.place}</strong><span>{item.foods.join("、")}</span><a href={item.source.href} target="_blank" rel="noreferrer">{item.source.label}</a></div>)}</div></article><article className="knowledge-card wide"><h2>日本美食分類</h2><div className="cuisine-grid">{CUISINE_CATEGORIES.map((item) => <div key={item.name}><strong>{item.name}</strong><span>{item.examples}</span></div>)}</div><LinkList links={KNOWLEDGE_SOURCES.slice(0, 2)} /></article>{CUSTOMS_AND_RULES.map((item) => <article className="knowledge-card" key={item.title}><h2>{item.title}</h2><p>{item.body}</p><a href={item.source.href} target="_blank" rel="noreferrer">{item.source.label}</a></article>)}<article className="knowledge-card"><h2>再出發前的官方資料</h2><LinkList links={KNOWLEDGE_SOURCES.slice(2)} /></article></div></section>;
}

function ImprovementsView({ notes, onChange }: { notes: ImprovementNote[]; onChange: (notes: ImprovementNote[]) => void }) {
  const [body, setBody] = useState(""); const [error, setError] = useState(""); const [editingId, setEditingId] = useState<string | null>(null);
  async function add(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!body.trim()) return; setError(""); try { const data = await requestJson<{ notes: ImprovementNote[] }>("/api/improvements", { method: "POST", body: JSON.stringify({ body }) }); onChange(data.notes); setBody(""); } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : "未能加入改善事項。"); } }
  async function update(note: ImprovementNote, nextBody: string, status: "open" | "done") { setError(""); try { const data = await requestJson<{ notes: ImprovementNote[] }>("/api/improvements", { method: "PATCH", body: JSON.stringify({ id: note.id, body: nextBody, status }) }); onChange(data.notes); setEditingId(null); } catch (updateError) { setError(updateError instanceof Error ? updateError.message : "未能更新改善事項。"); } }
  return <section className="dashboard-view improvements-view"><div className="page-heading"><div className="eyebrow">把經驗留給下一趟</div><h1>想改善</h1><p className="page-intro">記下下次想調整的小事，完成後可以標記為已完成。</p></div><form className="improvement-form" onSubmit={add}><label htmlFor="new-improvement">下一次想改善甚麼？</label><div><textarea id="new-improvement" value={body} onChange={(event) => setBody(event.target.value)} maxLength={500} rows={3} placeholder="例：下次預早訂好行李寄送" /><button className="primary-button" type="submit">加入想改善</button></div></form>{error && <Notice message={error} />}{notes.length === 0 ? <p className="muted-copy">還未有記錄，旅程後寫下一件就好。</p> : <div className="improvement-list">{notes.map((note) => editingId === note.id ? <ImprovementEditor key={note.id} note={note} onSave={(nextBody) => update(note, nextBody, note.status)} onCancel={() => setEditingId(null)} /> : <article className={`improvement-card ${note.status === "done" ? "done" : ""}`} key={note.id}><div><span className="status-pill">{note.status === "done" ? "已完成" : "開放中"}</span><p>{note.body}</p></div><div className="row-actions"><button className="text-button" type="button" onClick={() => update(note, note.body, note.status === "done" ? "open" : "done")}>{note.status === "done" ? "重新開放" : "標記完成"}</button><button className="text-button" type="button" onClick={() => setEditingId(note.id)}>編輯</button></div></article>)}</div>}</section>;
}

function ImprovementEditor({ note, onSave, onCancel }: { note: ImprovementNote; onSave: (body: string) => void; onCancel: () => void }) { const [body, setBody] = useState(note.body); return <form className="improvement-card editor-card" onSubmit={(event) => { event.preventDefault(); onSave(body); }}><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={500} rows={3} required /><div className="editor-actions"><button className="secondary-button" type="submit">儲存</button><button className="quiet-button" type="button" onClick={onCancel}>取消</button></div></form>; }

function TravelNotebook({ onLock }: { onLock: () => void }) {
  const [trips, setTrips] = useState<TripAggregate[]>([]); const [selectedId, setSelectedId] = useState<string | null>(null); const [view, setView] = useState<AppView>("overview"); const [showNewTrip, setShowNewTrip] = useState(false); const [tripPrefill, setTripPrefill] = useState<Partial<typeof initialTripForm>>(); const [notes, setNotes] = useState<ImprovementNote[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const selectedTrip = trips.find((item) => item.trip.id === selectedId) ?? null;
  const upcoming = useMemo(() => { const today = todayIso(); return trips.filter((trip) => isUpcomingTrip(trip, today)).sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate)); }, [trips]);
  const past = useMemo(() => { const today = todayIso(); return trips.filter((trip) => isPastTrip(trip, today)).sort((a, b) => b.trip.endDate.localeCompare(a.trip.endDate)); }, [trips]);
  async function refresh() { setError(""); try { const [tripData, noteData] = await Promise.all([requestJson<{ trips: TripAggregate[] }>("/api/trips"), requestJson<{ notes: ImprovementNote[] }>("/api/improvements")]); setTrips(tripData.trips); setNotes(noteData.notes); setSelectedId((current) => current && tripData.trips.some((item) => item.trip.id === current) ? current : null); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "未能載入旅程。"); } finally { setLoading(false); } }
  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(timer); }, []);
  function openTrip(id: string) { setSelectedId(id); setView("trip"); }
  function replaceTrip(next: TripAggregate) { setTrips((current) => current.map((item) => item.trip.id === next.trip.id ? next : item)); setSelectedId(next.trip.id); }
  function addTrip(trip: TripAggregate) { setTrips((current) => [...current, trip].sort((a, b) => b.trip.startDate.localeCompare(a.trip.startDate) || b.trip.createdAt.localeCompare(a.trip.createdAt))); setSelectedId(trip.trip.id); setShowNewTrip(false); setTripPrefill(undefined); setView("trip"); }
  async function archiveTrip(trip: TripAggregate): Promise<boolean> {
    if (!window.confirm(`收起「${trip.trip.title}」？它會離開即將出發及準備中的清單；D1 紀錄會保留，不會刪除。`)) return false;
    setError("");
    try {
      await requestJson(`/api/trips/${trip.trip.id}`, { method: "PATCH", body: JSON.stringify({ archived: true }) });
      setTrips((current) => current.filter((item) => item.trip.id !== trip.trip.id));
      setSelectedId((current) => current === trip.trip.id ? null : current);
      if (selectedId === trip.trip.id) setView("overview");
      return true;
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "未能收起旅程。資料沒有刪除。");
      return false;
    }
  }
  function newTrip(prefill?: Partial<typeof initialTripForm>) { setTripPrefill(prefill); setShowNewTrip(true); }
  let content: React.ReactNode = null;
  if (loading) content = <section className="loading-state" role="status">正在把旅程卡片放回桌上…</section>;
  else if (view === "overview") content = <Overview trips={trips} onNewTrip={newTrip} onOpenTrip={openTrip} onArchive={archiveTrip} onNavigate={setView} />;
  else if (view === "upcoming") content = <TripListView title="即將出發" eyebrow="把未來排好" trips={upcoming} onOpenTrip={openTrip} onArchive={archiveTrip} allowArchive empty="暫時沒有今天或以後的計劃，下一站可以從任何地方開始。" />;
  else if (view === "past") content = <TripListView title="過往旅記" eyebrow="把走過的日子留低" trips={past} onOpenTrip={openTrip} allowArchive={false} empty="還未有過往旅記。" />;
  else if (view === "map") content = <FootprintAtlas trips={trips} />;
  else if (view === "knowledge") content = <KnowledgeView />;
  else if (view === "improvements") content = <ImprovementsView notes={notes} onChange={setNotes} />;
  else if (view === "trip" && selectedTrip) content = <TripDetail trip={selectedTrip} onChange={replaceTrip} onArchive={archiveTrip} />;
  else content = trips.length === 0 ? <EmptyState onNewTrip={() => newTrip()} /> : <Overview trips={trips} onNewTrip={newTrip} onOpenTrip={openTrip} onArchive={archiveTrip} onNavigate={setView} />;
  return <AppFrame view={view} onNavigate={setView} onLock={onLock}><div className="dashboard-shell">{error && <Notice message={error} />}{showNewTrip && <TripForm key={JSON.stringify(tripPrefill ?? {})} prefill={tripPrefill} onCreated={addTrip} onCancel={() => { setShowNewTrip(false); setTripPrefill(undefined); }} />}{content}</div></AppFrame>;
}

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>("loading"); const [authError, setAuthError] = useState("");
  useEffect(() => { void (async () => { try { const data = await requestJson<{ state: "setup" | "locked" | "unlocked" }>("/api/auth/status"); setAuthState(data.state); } catch (error) { setAuthError(error instanceof Error ? error.message : "資料庫尚未連接。"); setAuthState("error"); } })(); }, []);
  function lock() { void requestJson("/api/auth/logout", { method: "POST" }).catch(() => undefined).finally(() => setAuthState("locked")); }
  if (authState === "loading") return <AppFrame><section className="loading-state first-load" role="status"><div className="eyebrow">日本旅行手帳</div><h1>正在整理你的旅程桌</h1><p>稍等一會兒，手帳會先看看目前的行程。</p></section></AppFrame>;
  if (authState === "error") return <AppFrame><section className="gate-card"><div className="eyebrow">手帳還未接上資料</div><h1>先保留這個位置</h1><p>產品頁面已準備好；請確認資料服務已連接後重新整理。</p>{authError && <Notice message={authError} />}<button className="primary-button" type="button" onClick={() => window.location.reload()}>重新連接</button></section></AppFrame>;
  if (authState === "setup" || authState === "locked") return <AppFrame><PinGate mode={authState} onUnlocked={() => setAuthState("unlocked")} /></AppFrame>;
  return <TravelNotebook onLock={lock} />;
}
