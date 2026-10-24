# #265 賽事主頁與規則樣式

歷史統計改為緊湊對齊的五列；當前賽事標題、主視覺與階段區移出額外面板。規則入口位於賽事導航最後，當前規則重用歷史 RulesHandbook，保留原文和 `#rules-N` 錨點。移除主頁組織團隊與相關連結重複區塊。

`tournament-overview-alignment.spec.ts` 驗證當前及 S10 歷史頁、正確屆別規則 URL、錨點、全部外觀及明暗、無水平溢出與 Axe。

## 批次驗證（2026-10-25）

- `npm run check`、`npm run test:i18n`、production `npm run build` 通過。
- `npm test`：126 個檔案、901 項通過，1 項既有略過。
- 使用獨立 PostgreSQL：`oclr_265_266_260_test`、`oclr_265_266_260_browser_test`；全部為合成資料，未讀取本機 `.env.local`。
- 三個新增 Playwright 情境在 Chrome 桌面及手機皆通過（6/6）。#265、#260 額外逐一覆蓋三種外觀 × 明暗主題及 Axe WCAG A/AA。
- `npm audit --omit=dev --audit-level=low`：0 漏洞。
- 本機驗證不代表 GitHub CI、正式部署或真實 OAuth/API 驗證；CI 狀態見 issue 更新。

## 截圖

Before：基準 `6f1488b`。After：本次修改；相同合成資料、Chrome desktop / iPhone 13 viewport。#265 使用 default/dark。

- [desktop-overview-test-after.png](desktop-overview-test-after.png)
- [desktop-overview-test-before.png](desktop-overview-test-before.png)
- [desktop-s10-after.png](desktop-s10-after.png)
- [desktop-s10-before.png](desktop-s10-before.png)
- [mobile-overview-test-after.png](mobile-overview-test-after.png)
- [mobile-overview-test-before.png](mobile-overview-test-before.png)
- [mobile-s10-after.png](mobile-s10-after.png)
- [mobile-s10-before.png](mobile-s10-before.png)
