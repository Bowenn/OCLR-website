# Issue #207 驗證紀錄

2026-10-24（Asia/Taipei）本機批次驗證，基準含 main `275fe82` 的 Developer 唯讀功能。

合成報名資料；測試核對全站與單屆列表中的名稱與 UID 連結均指向正確 osu! UID，保留審核入口。

- `npm run check`：通過。
- `npm test`：111 個檔案通過，817 項通過、1 項原有跳過；使用全新、獨立且明確命名的測試 PostgreSQL。
- `npm run build -- --webpack`：通過。
- 最終受影響的 Chrome 桌面／手機 Playwright：16／16 通過，含 S7–S10、Developer、選手、主辦方與報名流程；S9 全外觀矩陣另於前輪桌面／手機通過。
- 三語目錄檢查、三種外觀及明暗相關回歸均有覆蓋；新增實質中文說明仍交主辦方審閱。
- `npm audit --omit=dev`：0 個漏洞。`db:generate`：無 schema 漂移；新 migration鏈在空測試庫成功套用。
- GitHub CI 狀態另見 PR Checks；本機測試不代表 CI 或正式站部署／OAuth 實測通過。未合併、未部署。

- [desktop.png](desktop.png)
- [mobile.png](mobile.png)
