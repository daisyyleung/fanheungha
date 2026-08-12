# fanheungha — 公開專案規則

這個專案是一個以 Cloudflare Worker 與 D1 為資料來源的日本旅行手帳。
所有使用者資料以 D1 為唯一真實來源；不可加入瀏覽器儲存或聲稱支援真正的
離線同步。介面以 Android 觸控為先，每個互動控制至少有 48px 的 CSS 觸控
範圍，並使用自然的繁體中文與溫暖旅行筆記語氣。

## 安全與資料規則

- 初次設定必須先通過伺服器端 `OWNER_SETUP_SECRET`；密碼是 64 個十六進位
  字元（32 bytes），只存於 Worker secret，不可寫入 D1、cookie、回應、紀錄
  或前端 bundle。
- PIN 只以隨機 salt 的 PBKDF2-SHA-256 雜湊保存；session 只保存雜湊後的
  opaque token，cookie 必須是 `Secure; HttpOnly; SameSite=Lax`。
- 保留五次失敗後 15 分鐘的 lockout、PIN 重設與 session 撤銷行為。
- 所有 request body 在伺服器驗證；credential-changing request 必須是
  `application/json` 並通過 same-origin 驗證。跨旅程項目必須拒絕，連結只
  接受 `http:` 或 `https:`。
- 每個 SQL `prepare` 只包含一個 statement。旅程內容只能透過設定
  `archived_at` 收起，不可 hard-delete；active 查詢必須排除 archived rows。
- 新 D1 第一次使用只建立 schema 與索引，不載入任何資料、seed 或示例記錄。

## 範圍

保留旅程、行程、季節執行李、想買、想食、臨出發檢查、改善事項、日本知識與
足跡頁面。照片、照片 AI、真正 offline sync、額外 hosting provider、production
D1 寫入及新的地圖產品功能不在 v1 範圍。

## 驗證

在已安裝 lockfile 指定依賴的乾淨 clone 執行：

```sh
npm run db:generate
npm run typecheck
npm run lint
npm run build
npm test
node scripts/validate-public-repo.mjs --check=all
```

Pull request 的 CI 會執行相同的檢查，但會以
`node scripts/validate-public-repo.mjs --check=all --skip=git-history`
略過只適用於已提交 checkout 的歷史檢查。不可把 secret、production ID、依賴
快取或部署紀錄提交到公開 repository。公開程式碼採用 MIT License；根 layout
的版權聲明必須與 MIT 相容。
