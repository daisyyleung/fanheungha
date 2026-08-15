"use client";

import { FormEvent, useState } from "react";
import { requestJson } from "./client-api";

export function PinGate({
  mode,
  onUnlocked,
}: {
  mode: "setup" | "locked";
  onUnlocked: () => void;
}) {
  const [setupSecret, setSetupSecret] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const isSetup = mode === "setup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (isSetup && !/^[0-9a-f]{64}$/i.test(setupSecret)) {
      setError("請輸入部署者提供的 64 位十六進位啟用密碼。");
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError("請輸入 6 位數字 PIN。");
      return;
    }
    if (isSetup && pin !== confirmPin) {
      setError("兩次 PIN 不一致，請再確認一次。");
      return;
    }
    setPending(true);
    try {
      await requestJson(`/api/auth/${isSetup ? "setup" : "unlock"}`, {
        method: "POST",
        body: JSON.stringify(
          isSetup ? { setupSecret, pin, confirmPin } : { pin },
        ),
      });
      setSetupSecret("");
      setPin("");
      setConfirmPin("");
      onUnlocked();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "暫時未能解鎖。",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="gate-card" aria-labelledby="gate-title">
      <div className="eyebrow">{isSetup ? "第一次設定" : "手帳已上鎖"}</div>
      <h1 id="gate-title">
        {isSetup ? "先替旅程留一頁" : "輸入 PIN，繼續準備旅程"}
      </h1>
      <p className="gate-copy">
        {isSetup
          ? "先輸入部署者提供的一次性啟用密碼，再設定專屬的 6 位數 PIN。啟用密碼只在伺服器驗證，PIN 會以加鹽雜湊保存。"
          : "同一個 PIN 可以在不同裝置打開旅程清單。連續 5 次錯誤會暫停 15 分鐘。"}
      </p>
      <form className="pin-form" onSubmit={submit}>
        {isSetup && (
          <>
            <label htmlFor="owner-setup-secret">部署者啟用密碼</label>
            <input
              id="owner-setup-secret"
              type="password"
              value={setupSecret}
              onChange={(event) =>
                setSetupSecret(event.target.value.replace(/[^0-9a-f]/gi, "").slice(0, 64))
              }
              inputMode="text"
              autoComplete="new-password"
              spellCheck={false}
              required
              aria-describedby={error ? "pin-error" : undefined}
            />
          </>
        )}
        <label htmlFor="travel-notebook-pin">{isSetup ? "設定 6 位數 PIN" : "PIN"}</label>
        <input
          id="travel-notebook-pin"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          pattern="[0-9]{6}"
          autoComplete="one-time-code"
          required
          aria-describedby={error ? "pin-error" : undefined}
        />
        {isSetup && (
          <>
            <label htmlFor="travel-notebook-pin-confirm">再輸入一次</label>
            <input
              id="travel-notebook-pin-confirm"
              value={confirmPin}
              onChange={(event) =>
                setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              required
            />
          </>
        )}
        {error && (
          <p id="pin-error" className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "處理中…" : isSetup ? "開始使用手帳" : "解鎖手帳"}
        </button>
      </form>
    </section>
  );
}
