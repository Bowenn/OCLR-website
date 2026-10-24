# S9 — Glacier Blue / 冰晶鈷藍

追蹤：[#196](https://github.com/PhoenixEmik/OCLR-website/issues/196)。

狀態：設計樣本完成，待主辦方審閱；尚未接入正式 appearance。

## 主視覺與視覺主張

來源：[原圖](../../../../public/archive/s9/thumbnail.png)，1920×1080。使用完整原圖；不改字、不裁切、不合成新角色／背景。

以冬季主視覺的冰藍與鈷藍建立冷冽、清楚的閱讀介面。白色冰層般的留白、細邊框與短藍線回應冰晶；高飽和紋理留在原圖，資料區不疊加紋理。

內容順序：完整主視覺與賽季定位 → 賽程／比分 → 圖池明細 → 獨立表單 specimen → 色票與字體註記。每個區塊只處理一項工作。4px 面板與 4px 控制項圓角，細線分隔、緊實的水平節奏。深色使用午夜海軍藍與亮冰藍，不將整頁染成高亮純藍。

互動：hero 輕量淡入、控制項 hover／press 回饋、可鍵盤切換的分頁與明暗控制；不做視差或捲動綁定，避免影響資料閱讀。尊重 `prefers-reduced-motion`。

## Review artifacts

- [可操作樣本](../s9.html)；從完整 checkout 開啟。
- [桌面 Light](desktop-light.webp) / [桌面 Dark](desktop-dark.webp)
- [手機 Light](mobile-light.webp) / [手機 Dark](mobile-dark.webp)
- [Admin 桌面 Light](admin-desktop-light.webp) / [Dark](admin-desktop-dark.webp)
- [Admin 手機 Light](admin-mobile-light.webp) / [Dark](admin-mobile-dark.webp)

## 候選 MainSheet tokens

主視覺中的明亮裝飾色不直接作內文色；互動、文字、控制框與焦點分別定義。錯誤、成功、警告與 mod 顏色仍需繼承既有語意，不能全改為主色。

| Token                   | Light     | Dark      |
| ----------------------- | --------- | --------- |
| `--site-background`     | `#f4f9fe` | `#0d182c` |
| `--site-surface`        | `#ffffff` | `#14223b` |
| `--site-raised`         | `#edf5ff` | `#1d3151` |
| `--site-tint`           | `#e4efff` | `#203c64` |
| `--site-foreground`     | `#102c50` | `#eaf6ff` |
| `--site-muted`          | `#506781` | `#abc3de` |
| `--site-secondary-text` | `#304e75` | `#cfdef1` |
| `--site-accent`         | `#1748d5` | `#88dfff` |
| `--site-border`         | `#ccdced` | `#304869` |
| `--site-control-border` | `#6c86a8` | `#6a8db7` |
| `--site-primary`        | `#1748d5` | `#88dfff` |
| `--site-primary-hover`  | `#1038b2` | `#afeaff` |
| `--site-on-primary`     | `#ffffff` | `#102c50` |
| `--site-focus`          | `#1748d5` | `#88dfff` |
| `--site-selection`      | `#c5ddff` | `#2a4c7b` |
| `--hero-background`     | `#eaf6ff` | `#10213b` |
| `--art-background`      | `#183baf` | `#183baf` |
| `--button-radius`       | `4px`     | `4px`     |
| `--radius-panel`        | `4px`     | `4px`     |

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
