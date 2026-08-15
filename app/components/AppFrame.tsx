"use client";

import { FormEvent, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ACTIVE_SITE_THEME } from "@/lib/site-theme";
import type { AppView } from "./contracts";
import { navigation } from "./contracts";
import { requestJson } from "./client-api";

function PinResetForm({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(pin)) {
      setError("請輸入 6 位數字 PIN。");
      return;
    }
    if (pin !== confirmPin) {
      setError("兩次 PIN 不一致，請再確認一次。");
      return;
    }
    setPending(true);
    try {
      await requestJson("/api/auth/reset", {
        method: "POST",
        body: JSON.stringify({ pin, confirmPin }),
      });
      setPin("");
      setConfirmPin("");
      onSuccess();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "暫時未能重新設定 PIN。",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="sidebar-pin-form" onSubmit={submit}>
      <strong>重新設定 PIN</strong>
      <label htmlFor="new-travel-notebook-pin">新 6 位數 PIN</label>
      <input
        id="new-travel-notebook-pin"
        type="password"
        value={pin}
        onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        pattern="[0-9]{6}"
        autoComplete="new-password"
        required
        aria-describedby={error ? "reset-pin-error" : undefined}
      />
      <label htmlFor="new-travel-notebook-pin-confirm">再輸入一次</label>
      <input
        id="new-travel-notebook-pin-confirm"
        type="password"
        value={confirmPin}
        onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        pattern="[0-9]{6}"
        autoComplete="new-password"
        required
      />
      {error && (
        <p id="reset-pin-error" className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="sidebar-pin-actions">
        <button className="secondary-button" type="submit" disabled={pending}>
          {pending ? "設定中…" : "確認新 PIN"}
        </button>
        <button className="quiet-button" type="button" onClick={onCancel} disabled={pending}>
          取消
        </button>
      </div>
    </form>
  );
}

export function AppFrame({
  children,
  view,
  onNavigate,
  onLock,
}: {
  children: ReactNode;
  view?: AppView;
  onNavigate?: (view: AppView) => void;
  onLock?: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resetPinOpen, setResetPinOpen] = useState(false);
  const [pinNotice, setPinNotice] = useState("");

  useEffect(() => {
    if (!drawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
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
        <a
          className="brand"
          href="#main-content"
          aria-label="日本旅行手帳首頁"
          onClick={() => navigate("overview")}
        >
          <span className="brand-seal" aria-hidden="true" />
          <span>
            <strong>日本旅行手帳</strong>
            <small>把下一站寫得剛剛好</small>
          </span>
        </a>
        {onNavigate && (
          <button
            className="menu-button"
            type="button"
            aria-expanded={drawerOpen}
            aria-controls="site-navigation"
            onClick={() => setDrawerOpen((open) => !open)}
          >
            選單
          </button>
        )}
      </header>
      {onNavigate && (
        <>
          <div
            className={`drawer-backdrop ${drawerOpen ? "open" : ""}`}
            aria-hidden="true"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            id="site-navigation"
            className={`site-sidebar ${drawerOpen ? "open" : ""}`}
            aria-label="主要導覽"
          >
            <div className="sidebar-heading">
              <span className="eyebrow">日本旅行手帳</span>
              <button
                className="drawer-close"
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="關閉選單"
              >
                ×
              </button>
            </div>
            <nav className="sidebar-nav">
              {navigation.map((item) => (
                <button
                  key={item.value}
                  className={`sidebar-link ${view === item.value ? "active" : ""}`}
                  type="button"
                  aria-current={view === item.value ? "page" : undefined}
                  onClick={() => navigate(item.value)}
                >
                  <span>{item.label}</span>
                  <small>{item.hint}</small>
                </button>
              ))}
            </nav>
            {view === "trip" && (
              <div className="sidebar-trip-note">
                正在查看一趟旅程
                <br />
                <span>旅程內分頁仍會保留</span>
              </div>
            )}
            {onLock && (
              <div className="sidebar-security">
                {resetPinOpen ? (
                  <PinResetForm
                    onCancel={() => setResetPinOpen(false)}
                    onSuccess={() => {
                      setResetPinOpen(false);
                      setPinNotice("PIN 已重新設定，其他裝置需要用新 PIN 重新解鎖。");
                    }}
                  />
                ) : (
                  <button
                    className="sidebar-reset"
                    type="button"
                    onClick={() => {
                      setPinNotice("");
                      setResetPinOpen(true);
                    }}
                  >
                    重新設定 PIN
                  </button>
                )}
                {pinNotice && (
                  <p className="sidebar-pin-notice" role="status">
                    {pinNotice}
                  </p>
                )}
                <button className="sidebar-lock" type="button" onClick={onLock}>
                  鎖上旅記
                </button>
              </div>
            )}
          </aside>
        </>
      )}
      <main id="main-content" className={onNavigate ? "with-sidebar" : undefined}>
        {children}
      </main>
      <footer className={`site-footer ${onNavigate ? "with-sidebar-footer" : ""}`}>
        <span>{ACTIVE_SITE_THEME.motif}</span>
        <span className="footer-rule" aria-hidden="true" />
        <span>資料只在這個手帳裡保存</span>
      </footer>
    </div>
  );
}
