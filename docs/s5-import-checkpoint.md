# S5 私人匯入檢查點

2026-10-25，對應 [#288](https://github.com/OCLR-dev/OCLR-website/issues/288)。

來源分析見 [S5 整理文件](s5-archive.md)。主辦者授權「開始整理並匯入」；名單以 MainSheet 為準。

## 可重現匯入包

- `python3 scripts/prepare-s5-archive.py` 由已擷取的競賽來源生成 [匯入包](imports/s5-archive.json)。不讀取帳號憑證，不連線或寫入資料庫。
- 12 隊，70 個已匹配 UID 的名單位置、15 個未知 UID 位置，合計 73 選手及 12 教練。保留 12 個 VICE 與最終 Tier，不虛構選秀時序。
- 34 場對局及 29 個影片網址。比分、原始日期／時間存於管理來源附錄；正式 score 與 scheduledAt 為 null。MainSheet 的左右欄不等於已確認 MP 紅藍隊，故不填入要求紅藍隊身分的 match review。
- 四組比賽圖池共 70 slots；另有教練資格賽圖池 7 slots，合計五組／77 slots。資格賽 21 人、147 筆分數。
- 16 個 staff 職務紀錄、65 項管理來源附錄，包含獨立選秀截圖快照、70 項圖池統計、MP 分類、資格賽重算與來源衝突。前24場加總屬 reviewTable，不是正式名次。
- 尚未取得規則原文、S5 時區與異常日期確認、未知 UID／別名確認、正式最終名次或晉級連線；未套用 S6 的規則與時區。

## 操作狀態

已透過瀏覽器完成 [s5 私人歸檔匯入](https://oclr.org/admin/tournaments/s5/archive)，保存 revision 2，status=completed、published=false、applications=0。主辦者已明確同意設為「已完成」並繼續私人匯入。

「已完成」狀態是歷史匯入的必要前提（`src/components/archive-importer.tsx`）。設定確認會停止報名。先前自動審核要求補充明確授權；主辦者已確認，隨後正常完成設定及私人匯入。簡介、賽季標識 5 與完成狀態均已保存。

操作時網址欄位曾意外附加文字，產生 `oclr-s5s5` 空白草稿。已改名為「誤建空白草稿（未使用）」，不含匯入資料且未公開。沒有刪除它，也未以其網址取代正確的 s5 草稿。

## 驗證

- 匯入包通過實際 `historicalArchiveSchema`（含參照、唯一性、Tier 與 source-only 限制）。
- 腳本斷言 70 已知／15 未知名單、34 無正式比分對局、77 圖池 slots。
- 未跑完整應用或資料庫測試：本次只有離線資料轉換與匯入檔，未變更應用程式。
- 重新載入管理頁確認 12 隊／85 位選手與教練／34 未確認對局／5 圖池／77 譜面。
- 透過瀏覽器讀取已保存 JSON，逐欄深度比較整個 archive 與本機匯入包完全一致（僅忽略物件鍵順序）。
- 私人預覽確認 B 隊 Tier 1 Muziyami、C 隊 Tier 1 TaneshimaPopura 與未知 UID 隊長 Azureus；管理附錄可見，概覽預覽沒有來源檢查附錄。
- 34 場比分仍在管理來源附錄，正式結果為 0，沒有核准或公開。規則、時區、日期修正、最終名次等缺項仍保留待核實。
