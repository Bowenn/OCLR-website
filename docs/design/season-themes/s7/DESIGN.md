# S7 — Graphite Arena / 石墨競技場

追蹤：[#198](https://github.com/PhoenixEmik/OCLR-website/issues/198)。

狀態：設計樣本完成，待主辦方審閱；尚未接入正式 appearance。

## 主視覺與視覺主張

來源：[原圖](../../../../public/archive/s7/key-visual.jpg)，1920×1080。使用完整原圖；不改字、不裁切、不合成新角色／背景。

從金屬主視覺保留石墨灰、銀色與競技黃，轉成乾淨的工業感介面。金屬刮痕只留在原圖，資料區使用平整表面；黃色配深色文字，避免白字落在亮黃上。

內容順序：完整主視覺與賽季定位 → 賽程／比分 → 圖池明細 → 獨立表單 specimen → 色票與字體註記。每個區塊只處理一項工作。2px 面板與 2px 控制項圓角，端正的粗細線與等寬比分。亮色為銀白工作面，深色為石墨工作面；兩者都以單一金黃聚焦互動。

互動：hero 輕量淡入、控制項 hover／press 回饋、可鍵盤切換的分頁與明暗控制；不做視差或捲動綁定，避免影響資料閱讀。尊重 `prefers-reduced-motion`。

## Review artifacts

- [可操作樣本](../s7.html)；從完整 checkout 開啟。
- [桌面 Light](desktop-light.webp) / [桌面 Dark](desktop-dark.webp)
- [手機 Light](mobile-light.webp) / [手機 Dark](mobile-dark.webp)
- [Admin 桌面 Light](admin-desktop-light.webp) / [Dark](admin-desktop-dark.webp)
- [Admin 手機 Light](admin-mobile-light.webp) / [Dark](admin-mobile-dark.webp)

## 候選 MainSheet tokens

主視覺中的明亮裝飾色不直接作內文色；互動、文字、控制框與焦點分別定義。錯誤、成功、警告與 mod 顏色仍需繼承既有語意，不能全改為主色。

| Token                   | Light     | Dark      |
| ----------------------- | --------- | --------- |
| `--site-background`     | `#f3f4f2` | `#171c20` |
| `--site-surface`        | `#ffffff` | `#22292f` |
| `--site-raised`         | `#e9ece9` | `#303940` |
| `--site-tint`           | `#f6edc6` | `#443f27` |
| `--site-foreground`     | `#171c20` | `#f3f4f2` |
| `--site-muted`          | `#596164` | `#b6bfc4` |
| `--site-secondary-text` | `#414a50` | `#d7dce0` |
| `--site-accent`         | `#796000` | `#eacb49` |
| `--site-border`         | `#cdd2d0` | `#485158` |
| `--site-control-border` | `#7b8588` | `#88949b` |
| `--site-primary`        | `#eacb49` | `#eacb49` |
| `--site-primary-hover`  | `#f2d969` | `#f2d969` |
| `--site-on-primary`     | `#171c20` | `#171c20` |
| `--site-focus`          | `#796000` | `#eacb49` |
| `--site-selection`      | `#e9d988` | `#5b5128` |
| `--hero-background`     | `#e5e8e5` | `#20272c` |
| `--art-background`      | `#252b30` | `#252b30` |
| `--button-radius`       | `2px`     | `2px`     |
| `--radius-panel`        | `2px`     | `2px`     |

## 後續正式接入驗收（本次未執行）

- [ ] 主辦方審閱本季明暗版與手機樣本，確認方向；正式顯示名稱另經三語 catalog 與中文措辭審閱。
- [ ] 重用現有 MainSheet React 元件及 token，擴充 appearance 白名單、schema、header 選單、Global Admin 全站預設及 edition `defaultAppearance`；未知值安全回退。
- [ ] 保留訪客 → 當前授權／已發佈賽事 → 全站優先序、清除繼承行為、SSR 首屏及獨立 light/dark；不自動把歷史賽事設為此樣式。
- [ ] 公開／登入／Admin／Player／Captain 以及既有三款 appearance 不退化；OBS／presenter 隔離不變；授權、發佈與歷史文字資料不變。
- [ ] 320 / 390 / 768 / 1024 / 1440px，三語、長名稱、明暗、開啟選單、表單、表格、空狀態、焦點及錯誤狀態；無頁面溢出或重疊。
- [ ] 正常文字 ≥ 4.5:1，關鍵控制邊界與焦點 ≥ 3:1，44px 觸控區，鍵盤與 reduced motion；附真實應用截圖。
- [ ] 正式接入批次執行 lint/types、unit/integration、production build、桌面／手機 Playwright、production dependency audit；介面訊息變更執行 i18n extract/test。整合測試只用明確命名的隔離測試 DB，CI 狀態如實回報。

完整來源、預覽操作與設計／正式資料邊界見 [共用說明](../README.md)。

## 本機樣本驗證結果（2026-10-24）

8 組 viewport／明暗組合通過，16 次 overview／Admin Axe AA 掃描無違規；圖片載入、頁面溢出、明暗控制、方向鍵／End 分頁切換、表單預覽及重設皆通過。詳見 [本季報告](verification.json)。樣本 JavaScript 與驗證工具 ESLint 均為 0 errors／0 warnings。這些結果只涵蓋靜態樣本，不證明正式應用程式、部署或三語整合已驗證。
