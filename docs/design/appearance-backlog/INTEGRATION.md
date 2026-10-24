# 共用正式接入清單（未於本次執行）

適用 #235–#240 的後續實作。每款保留自己的視覺規格；本清單定義相同的系統契約。原始 prototype 與 `mainsheet.example.css` 均不代表已完成正式整站 skin。

## 元件與權限

- 延續現有 Next.js／TypeScript／MainSheet 的 CSS 與服務，不建另一套 frontend、通用賽事平台或新的資料流程。編寫程式前讀該版本本地 Next.js docs。
- 普通公開、登入、Admin、Player、Captain 頁共用語意 tokens；只有 OBS／presenter 保持現有 broadcast styling 隔離。風格 A 的名字不能改變此邊界。
- 授權仍 edition-scoped 並在 server 檢查；appearance 不授予權限，也不公開 Captain／Team／roster／draft 或結果。只渲染原本能取得的資料。
- 不從附件輸入虛構 Season 3、日期、報名 41/64、譜面或任何競賽規則。官方名稱使用 osu! Chinese League Rookie (OCLR)。

## 候選 key 與白名單

每款 DESIGN 的 key 是暫定值。正式接入時依當時最新程式核對以下位置，不能只加入 CSS：

| 層            | 既有入口                                                                       | 驗收                                                                                                    |
| ------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 訪客偏好      | `src/lib/preferences.ts`、`appearance-control.tsx`                             | 固定白名單，安全讀取 cookie，未知值回退；選單可容納新增項目。                                           |
| SSR／路由繼承 | `src/app/layout.tsx`、`src/lib/appearance-scope.ts`、`appearance-provider.tsx` | 首屏不閃錯 skin，導航後繼承正確，light/dark 保持獨立。                                                  |
| 三語名稱      | `src/i18n/appearance.ts`、messages                                             | next-intl 字面訊息，zh-Hans／zh-Hant／en，中文實質措辭交主辦方審閱。                                    |
| 全站預設      | `src/lib/site-settings.ts`、site appearance form、`/admin/settings`            | 僅 Global Admin 可改，沿用現有 version／稽核／驗證。                                                    |
| 賽事預設      | 既有 tournament configuration／General settings                                | edition Admin 可選 whitelisted optional `defaultAppearance`，不自動改 edition。                         |
| DB 約束       | `src/db/schema.ts`、新增 Drizzle migration                                     | 同步 `site_settings_appearance` 與 `site_setting_events_appearances`；不得改舊 migration 或清歷史資料。 |
| 渲染          | 既有普通頁 styles／components                                                  | token 與 selector 作用域一致，OBS／presenter 不受影響，所有舊外觀保留。                                 |

增量 migration 需保存舊值與 audit history，允許新值且仍拒絕未知值。測試升級前後 runtime／migration role 行為與 idempotency。不要為單純 CSS 範例建立遷移；本次沒有 migration。

## 偏好優先序

1. 有效訪客 `oclr-appearance` cookie。
2. 當前路由的授權／已發佈賽事 `defaultAppearance`。
3. Global Admin 全站預設。

清除訪客選擇只清除明確偏好，跟隨當前路由預設，不寫入自動偏好 cookie。非賽事頁不繼承上一季；未發佈賽事不能由猜測 URL 洩漏設定。保留 public edition、staff edition、帶 edition context 的 player profile 與 broadcast 路由各自現有行為。外觀與 light/dark／locale cookie 分開。

## 全表面 QA

- 公開首頁、賽事目錄、overview、schedule、mappool、teams／players、rules、個人頁；登入、Admin 設定／各業務表單、Player／Captain workspace。
- 桌面 1024／1440px、平板 768px、手機 320／390px，三語、明暗、長名字與多行譜面 metadata。選單開啟時核對外觀、語言、帳號／控制台幾何，鍵盤順序與關閉焦點。
- primary／secondary、hover／focus／pressed／selected／disabled／loading，error／success／warning、空資料、圖片錯誤、dialog 與表格捲動；保留語意與清楚文字，不用顏色代替資訊。
- 正常文字 ≥4.5:1、large text ≥3:1、控制邊界／focus ≥3:1，44px 觸控區，200% zoom，reduced motion、forced colors；H 額外驗 reduced transparency、無 blur 支援及最差背景對比。
- 裝飾不裁切選單／焦點／資料；模糊與陰影有預算，不逐列套用，不新增動畫 framework。字型先核授權／可用字形，本地打包、少量字重，保留系統回退。

## 批次驗證與交付

- 該主題實作按 issue 分開提交，按主辦方規範完成批次後合併跑驗證，失敗集中修復。
- lint/types、unit/integration、production build、desktop/mobile Playwright、production dependency audit；改訊息時 i18n extract/test。DB fixtures 只用明確命名測試資料庫與 `TEST_DATABASE_URL`，禁止 demo／production。
- 加入首屏 SSR、訪客／賽事／全站優先序、清除／導航、未知值回退、DB 白名單 migration／audit、各角色授權和 OBS 隔離回歸。不要只寫鏡像 CSS 實作的無意義測試。
- 對比改前／改後的真實應用截圖，註明實際跑過的範圍。CI 是權威；pending／failed 不說成 passed。部署與真實 OAuth／主辦流程不由離線樣本推定。
- 同步 remote 與使用者 main，更新 issue 實際 SHA／驗證；只在該款完整接入驗收後關閉。文件完成不代表六款已實作。
