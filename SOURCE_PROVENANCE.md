# Source provenance

本文件說明公開版本如何由公開 Git root/tree 重現。公開 repository 的目前
`main` tree、`package.json`、`package-lock.json` 與每個公開的 signed annotated
tag 是可核對的 source of truth；不需要任何未公開的 repository、路徑、提交
識別碼或部署資料。

## 可重現的公開輸入

1. 從公開 repository clone 完整 Git history，並以 `main` 或一個 signed
   annotated release tag checkout。
2. 以 `package-lock.json` 驗證 Node.js 與 npm 依賴，執行 `npm ci`。
3. 在相同 tree 執行 `npm run db:generate`、`npm run lint`、`npm run build`、
   `npm test` 及 `node scripts/validate-public-repo.mjs --check=all`。
4. 對 release tag 產生 release artifacts。只有 `git archive` 搭配 `gzip -n` 的
   archive 是 deterministic、byte-for-byte reproducible；相同 signed tag/tree
   可以重現完全相同的 archive bytes。建置、lint、測試與 validator 也能由外部
   重新執行，但不把其他工具輸出宣稱為 byte-for-byte 相同。

   Only the git archive is deterministic and byte-for-byte reproducible:

   ```sh
   VERSION="$(node -p "require('./package.json').version")"
   git archive --format=tar --prefix="fanheungha-${VERSION}/" "v${VERSION}" | gzip -n > "fanheungha-${VERSION}.tar.gz"
   npm sbom --sbom-format=spdx --package-lock-only > SBOM.spdx.json
   sha256sum "fanheungha-${VERSION}.tar.gz" SBOM.spdx.json | LC_ALL=C sort > SHA256SUMS
   ```

   `npm sbom` 產生的是另行生成的 SPDX 2.3 dependency inventory，可能包含
   generation-specific fields，例如 `creationInfo.created` timestamp 與
   `documentNamespace`。因此重新生成的 SBOM bytes 不保證與 release attachment
   相同；包含該 SBOM 的新 `SHA256SUMS` 也不保證逐 bytes 相同。`SHA256SUMS` 只
   驗證該 draft 實際發布的 exact release attachments，不承諾重新生成 SBOM 或
   checksum bytes 會得到相同 hash。

   下載 draft release 的附件後，`sha256sum --check SHA256SUMS` 可獨立驗證該次
   發布的 archive 與 SBOM，並可用 SPDX 2.3 parser inspect SBOM 內容。

## 公開化選擇與排除

公開 tree 只包含可由本 repository checkout 的應用程式、schema migrations、
lockfile、測試、文件與工作流程。初始化時刻意排除未追蹤檔案、依賴快取、建置
輸出、部署設定、真實 database identifier、secret、使用者資料、私人素材與
未經審核的歷史證據；這些項目不屬於公開 source tree，也不會出現在 release
archive 或 SBOM。

公開版本保留日本地理與知識資料，並將首頁主題、空白狀態與新旅程表單保持為
中性的旅行手帳預設。D1 以 schema-first 方式初始化，不會載入 seed 或示例
資料；公開文件與 validator 會檢查上述邊界。

任何人都可以只使用公開 root/tree、lockfile、signed tag 與上述命令重跑公開
建置及重現 deterministic archive；公開 SBOM 與 `SHA256SUMS` 則用於審閱及驗證
該次 release attachments，不宣稱重新生成後會逐 bytes 相同。若公開 tag、
checksum 或 SBOM 與 tree 不一致，應停止審閱並回報，而不是以替代檔案繞過驗證。
