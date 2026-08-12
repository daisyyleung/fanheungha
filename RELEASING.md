# Release checklist

公開 release 由 `main` 上的 annotated、signed tag 觸發；workflow 只會建立 draft，
發布前必須由維護者逐項審閱附件與檢查結果。

## 發布前

- 先在乾淨 checkout 執行 `npm ci`、`npm run db:generate`、typecheck、lint、build、
  tests 及 `node scripts/validate-public-repo.mjs --check=all`。
- 確認 package version 與 tag 完全一致：`package.json` 的 `version` 為
  `0.1.0` 時，tag 必須是 `v0.1.0`；tag 必須符合 `v<semver>`。
- 以簽署設定建立 signed commit，再建立 signed annotated tag。GitHub API
  必須顯示 tag object、`verification.verified == true`，而 tag target 必須等於
  workflow 的 `GITHUB_SHA`；lightweight 或 unsigned tag 會被拒絕。release workflow
  會把已驗證的 tag-object SHA 傳給 validator，避免只依賴 tag 名稱。
- 不要改寫既有 history；如需修正，建立新的 signed commit 與 tag。

## Draft 審閱

Workflow 只把 `git archive` 搭配 `gzip -n` 的 tar.gz 視為 deterministic、
byte-for-byte reproducible。

Only the git archive is deterministic and byte-for-byte reproducible.
同一個 signed tag/tree 可重現相同 archive bytes。
`npm sbom` 另行生成 SPDX 2.3 `SBOM.spdx.json` dependency inventory；其
generation-specific `creationInfo.created` timestamp 與 `documentNamespace` 可能
改變，因此重新生成的 SBOM/checksum bytes 不保證相同。`SHA256SUMS` 驗證的是該
draft 實際發布的 exact release attachments，不是重新生成 SBOM 或 checksum bytes
的可重現性承諾。在 draft release 頁面下載附件後，以本機工具驗證：

```sh
sha256sum --check SHA256SUMS
node -e 'const x=require("./SBOM.spdx.json"); if(x.spdxVersion!=="SPDX-2.3") process.exit(1)'
```

檢查 archive 只包含公開 Git tree、SBOM 沒有機密資料，版本與 tag 一致，且 draft
沒有非預期附件；確認無誤後才按 GitHub 的 Publish release。若 checksum、SBOM、
簽署驗證或 package/tag 比對失敗，保持 draft 並修正來源，不要手動替換附件。

Pull request 會執行完整建置、測試與內容檢查；只有 push 到 `main` 或已驗證的
release tag 才執行需要本地 Git history 的檢查。`SOURCE_PROVENANCE.md` 列出任何
人可從公開 root/tree、lockfile 及 signed tag 重跑建置、重現 deterministic
archive，以及驗證該次 SBOM／checksum attachments 的命令。

## 既有 release 與回復

已發布的 tag、archive、checksum 與 SBOM 是不可變的審計輸入；不要刪除或覆寫既有
release 來掩蓋 unsigned history。需要回復時，建立新的 signed release，並在 draft
notes 說明變更原因與受影響的版本。
