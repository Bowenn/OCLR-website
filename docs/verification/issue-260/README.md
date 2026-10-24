# #260 Staff 多職務新增／編輯

依 user 與 edition scope 分組全部有效角色，新增及編輯均支援多選，沿用既有權限角色而非展示職稱。完整角色集合更新在同一交易及既有 advisory lock 下完成；以預期 grant IDs 拒絕陳舊操作。新增角色預設私人，保留角色的獨立公開狀態、其他屆角色及每項異動稽核。

整合測試覆蓋角色增加／移除、即時權限、跨屆／越權／無效角色拒絕、原子性、並行更新及舊 API 競爭。瀏覽器驗證新增兩角色、編輯替換其中一個、重新載入回填、三種外觀與明暗、桌面／手機及 Axe。

三語字串已 extract 並通過目錄驗證；新增中文職務選擇／確認說明交主辦方審閱，不代表已有措辭核准。

## 批次驗證（2026-10-25）

- `npm run check`、`npm run test:i18n`、production `npm run build` 通過。
- `npm test`：126 個檔案、901 項通過，1 項既有略過。
- 使用獨立 PostgreSQL：`oclr_265_266_260_test`、`oclr_265_266_260_browser_test`；全部為合成資料，未讀取本機 `.env.local`。
- 三個新增 Playwright 情境在 Chrome 桌面及手機皆通過（6/6）。#265、#260 額外逐一覆蓋三種外觀 × 明暗主題及 Axe WCAG A/AA。
- `npm audit --omit=dev --audit-level=low`：0 漏洞。
- 本機驗證不代表 GitHub CI、正式部署或真實 OAuth/API 驗證；CI 狀態見 issue 更新。

## 截圖

- [desktop-after.png](desktop-after.png)
- [mobile-after.png](mobile-after.png)
