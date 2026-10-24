# #266 完整選手列表統計

根因：#245 移除選手列表分頁後，快取讀取仍拒絕超過 24 個 ID；頁面捕捉錯誤後使用空 Map，導致 27 人列表全部顯示破折號。

改為驗證及去重後以每批 500 人讀取全部快取。保留 osu! 模式、權威來源、空排名、有效 PP 0、舊有效資料、公開範圍以及每次最多兩人的背景更新限制。

整合測試覆蓋 503 筆跨批次讀取、重複 ID、0 PP、無排名、來源失敗保留快取；瀏覽器驗證完整 27 人列表並重新載入。

## 批次驗證（2026-10-25）

- `npm run check`、`npm run test:i18n`、production `npm run build` 通過。
- `npm test`：126 個檔案、901 項通過，1 項既有略過。
- 使用獨立 PostgreSQL：`oclr_265_266_260_test`、`oclr_265_266_260_browser_test`；全部為合成資料，未讀取本機 `.env.local`。
- 三個新增 Playwright 情境在 Chrome 桌面及手機皆通過（6/6）。#265、#260 額外逐一覆蓋三種外觀 × 明暗主題及 Axe WCAG A/AA。
- `npm audit --omit=dev --audit-level=low`：0 漏洞。
- 本機驗證不代表 GitHub CI、正式部署或真實 OAuth/API 驗證；CI 狀態見 issue 更新。

## 截圖

Before：基準 `6f1488b`。After：本次修改；相同合成資料、Chrome desktop / iPhone 13 viewport。#265 使用 default/dark。

- [desktop-after.png](desktop-after.png)
- [desktop-before.png](desktop-before.png)
- [mobile-after.png](mobile-after.png)
- [mobile-before.png](mobile-before.png)
