# 前後端交叉比對報告 — 櫻旅 v3「口袋地點」

> 建立時間：2026-09-02 ｜ **修訂：2026-09-02（依 PRD v3.7 / UI spec v3.1 回頭同步）** ｜ 狀態：待簽核
> 比對對象：[frontend/pocket-v3.md](frontend/pocket-v3.md) v3.1.0 ↔ [backend/parse-and-schema-v3.md](backend/parse-and-schema-v3.md) v3.1.0 ↔ [**PRD v3.7**](../01-PRD/PRD-v3-pocket-places.md) ↔ [**UI spec v3.1**](../02-Design/ui-spec-v3-pocket.md)
> 範圍：**僅 MVP（PRD §8 的 P1–P10）**。Phase 1.5 地圖（F-79／F-80／F-84～F-87）與 Phase 2 `share_target`（F-82）不列入比對。

## 0. 本次同步的上游變更（v3.0 → v3.1 比對差異）

| # | 上游變更 | 出處 | 對比對結果的影響 |
|---|---|---|---|
| 1 | `/api/parse-post` 契約 `imageBase64` → **`images[]`（≤3 張）** | PRD v3.7 §7.1／§7.5b | §2 DTO、§3 錯誤碼（`too_large` 三種觸發）全部重新對齊 |
| 2 | **IngestSheet 依平台分流**（S-10／S-20、S-13／S-21）| UI spec v3.1 §6.1.0～§6.1.3 | §4 追溯新增 S-20／S-21；後端**不需感知模式**，`reason` 維持單一組 |
| 3 | 新增 **C-29 Toast**（`components/ui.jsx`）、**C-30 ShotPicker** | UI spec v3.1 §4／§12.1 | §4.1 元件反查新增兩列，孤兒元件歸零（原本 Toast 未編號）|
| 4 | **C-16 加選填 `subtitle`** | PRD §6.2／DDR-30 | §4.1 標註為增修元件，向下相容 |
| 5 | `detectPlatform()` 落位 `lib/share.js` | PRD v3.7 §5.3／§6.2 | §2 新增純函式契約列；UI spec §12.3 ⑧ 結案 |
| 6 | `PLACE_WARN_BYTES`、`rawText`／`pending` 進 PRD | PRD v3.5 §5.2／§5.3 | Q-03／Q-04 結案 |
| 7 | **環境變數顧慮撤銷** | PRD v3.7 §7.4 | §6 Q-10 由「需 CEO 處理」改為**無需任何手動設定** |
| 8 | **F-78 對 IG 的限制裁定 MVP 不解決** | PRD v3.7 §4.2 | §4 F-78 追溯改為「誠實標示」，**不得規劃 blob 暫存** |
| 9 | 新增 **T-99**（OCR 參數實測）；**T-98 已完成** | PRD v3.7 §10 | §5 測試對照表新增 T-99、T-98 改為已完成 |

---

## 1. API 覆蓋檢查（無幽靈 / 無孤兒）

| 前端呼叫 | 呼叫點 | 後端是否提供 | 狀態 |
|---|---|---|---|
| `POST /api/parse-post`（**`images[]` 契約**）| `lib/api.js → parsePost()`，由 C-19 IngestSheet 呼叫 | ✅ backend §6.1（新增）| ✅ 對齊 |
| `GET /api/flight` | FlightCard（v2） | ✅ 既有，本版不動 | ✅ 對齊 |
| `GET /api/rate` | SettingView（v2） | ✅ 既有，本版不動 | ✅ 對齊 |
| Supabase `trips` select/upsert + Realtime | `lib/sync.js`（v2） | ✅ 既有，**表結構零變更** | ✅ 對齊 |
| Google Maps 搜尋 URL | `openMap()`（`schema.js:44`） | — 純字串，無後端 | ✅ 非 API |
| YouTube / TikTok oEmbed | **僅後端呼叫** | ✅ backend §6.2 順位 2 | ✅ 前端不直接碰（避免 CORS）|
| Instagram og:meta | **僅後端呼叫，且預期失敗** | ✅ backend §6.2 順位 3 | ✅ 預期行為不是 bug（機房 IP 撞登入牆）|

- **幽靈 API（前端要、後端沒做）**：無。
- **孤兒 API（後端做了、前端不用）**：無。
- **本版明確不建立的端點**：`/api/geocode`（F-84/F-86，Phase 1.5）、`api/inbox.js`（截圖走捷徑，Phase 3）。前後端文件皆未引用，無懸空契約。

## 2. 型別 / DTO 對齊檢查

| 契約 | 前端 | 後端 | 狀態 |
|---|---|---|---|
| **`ParsePostRequest { trip, url?, text?, images?, cityHint? }`** | `api.parsePost()` 的參數（frontend §5.2 狀態機 + §4.6 `toImages()`）| backend §6.1 Request DTO | ✅ 逐欄一致（**v3.1 變更**）|
| **`ParseImage { base64, mime }`** | `toImages(shots)` 產生：`base64` 去掉 data URL 前綴、`mime` 固定 `"image/jpeg"` | backend §6.1／§6.3 `buildImageContent` 消費 | ✅ **關鍵對齊點**：`compressImage` 回傳的是 data URL，前端**必須**去前綴，否則後端拿到的不是合法 base64 |
| **`images` 上限（3 / 1.4MB / 4MB）** | frontend §4.6 前端三道檢查（體驗）| backend §6.5 後端三道檢查（防護）| ✅ 數值逐一相同；**兩邊都要做，前端不得取代後端** |
| `ParsePostOk { ok, via, source, collection, places[] }` | `IngestSheet` 由 `places[]` 建出 `ReviewRowState[]` | backend §6.1 Response | ✅ |
| `via: "image"` | 覆核來源列明寫「（從截圖讀出）」 | backend 順位 4 回傳 | ✅ 讓使用者知道這批資料的來源品質 |
| `ParsedPlace { name, nameJa, category, area, note, confidence }` | `ReviewRowState` 同名同型（多一個本地 `checked` / `duplicate`）| backend §6.3 tool schema + §6.4 `clampPlaces` | ✅ |
| `category` enum | `views/places/constants.js` re-export `ITEM_TYPES`（6 個 `v` 值）| tool schema `enum` + `ITEM_TYPE_KEYS`（`schema.js:20`）| ✅ **同一份 enum，零轉換表** |
| **`Platform` enum** | `lib/share.js` 的 `detectPlatform()` 回傳值 | backend §4.2 `Pocket.platform` + `platformOf(url)` | ✅ 同一組 6 個字面值。**前端在送出前判定（決定版面），後端在回應中判定（決定 `source.platform`）；兩者字面值必須一致** |
| `Pocket` / `Place`（jsonb） | `useTrip` mutator 產生的記錄 | backend §4.2 | ✅ 同一份 interface（含 `rawText` / `pending`）|
| `DayItem.placeId` | `placeToItem()` 寫入 | backend §4.2 | ✅ |
| `Scalar<T>` / `Mergeable` | 沿用 v2 | 沿用 v2 §4.2 | ✅ 不變 |
| 合併規則（含未知欄位穿透） | `lib/merge.js` 實作 | backend §5.1.2 契約 | ✅ 契約唯一來源在後端文件 |
| 遷移規則 | `lib/migrate.js` 實作 | backend §5.1.1 契約 | ✅ |
| 容量常數 | `capacityCheck()` 消費 | backend §4.3 定義（PRD v3.5 §5.3 出處）| ✅ |
| OCR 常數 | `lib/image.js` `OCR_MAX` / `OCR_QUALITY` | 後端不消費（純前端壓縮）| ✅ 無跨端契約，但由 **T-99** 驗收 |

**已移除的欄位**：`imageBase64: string` / `mime: string`（v3.0 契約）。此端點尚未上線，**不保留相容分支**；
前後端文件皆已無此欄位（已 grep 確認）。

## 3. 錯誤碼雙向覆蓋

| 情境 | 後端回傳 | 前端處理 | UI 狀態 | 狀態 |
|---|---|---|---|---|
| 非 POST / 缺 trip | 200 `{ok:false, reason:"bad_request"}` | 訊息條 + 依模式聚焦 | S-13 / **S-21** | ✅ |
| 五順位全失敗 | 200 `reason:"need_text_or_image"` | S-13「這個連結讀不到內文…」／S-21「讀不到，IG 一定是這樣…請截一張把說明文字展開的圖」 | S-13 / **S-21** | ✅ |
| LLM 回空陣列 | 200 `reason:"no_places"` | S-13「找不到具體的店名或景點…」／S-21「這張圖上找不到店名，多半是截到食物畫面」 | S-13 / **S-21** | ✅ |
| **截圖張數 > 3** | 200 `reason:"too_large"` | 「一次最多 3 張截圖…」 | S-13 / S-21 | ✅ **v3.1 新增**（前端亦擋，只收前 3 張）|
| **單張 base64 > 1.4MB** | 200 `reason:"too_large"` | 「有一張截圖太大了…」 | S-13 / S-21 | ✅（前端壓縮後近乎不可達）|
| **總量 > 4MB** | 200 `reason:"too_large"` | 「這幾張截圖加起來太大了…」 | S-13 / S-21 | ✅ **v3.1 新增** |
| IP 限流 / trip key 不存在 / LLM 例外 | 200 `reason:"rate_limited"` | 「剛剛解析太多次了…你貼的內容還留著」 | S-13 / S-21 | ✅ |
| **網路請求本身失敗（fetch reject）** | — | `try/catch` → 視同 `need_text_or_image` | S-13 / S-21 | ✅ 前端補位，不會白畫面 |
| **只帶 IG 連結（不送出）** | — | 主按鈕改「選擇截圖」＝開檔案選擇器，**不打 API**（DDR-27）| S-20 | ✅ **v3.1 新增**：省下一次註定失敗的請求與一格限流額度 |
| 離線（未送出） | — | 不呼叫端點，直接存待解析 pocket；**截圖不保存**並顯示警語 | S-14 / S-06 / **S-06b** | ✅ |
| 容量超過 900KB | — | 前端擋下，不寫入 | C-27 | ✅ |
| 容量超過 800KB | — | P-06 常駐黃字預警，不擋操作 | C-27 | ✅ |
| 同步驗證失敗（資料過大） | `validateTrip.reason` 經 `pushRemote` throw | `syncReason` → C-28 | C-12 + C-28 | ✅ |
| 同步驗證失敗（**版本過舊**） | `reason:"App 版本過舊,請重新整理頁面"` | C-28 顯示 + ［重新整理］ | C-28 | ✅（Q-02 已裁定）|
| 未知 reason | 任意字串 | **原樣顯示，不吞掉** | C-28 | ✅ |

- **後端有、前端沒處理的錯誤碼**：無。
- **前端處理、後端不會回的錯誤碼**：無。
- **模式分流不新增任何 `reason`**：後端保持平台無感，同一個 `reason` 由前端依 `mode` 決定文案與焦點。這是刻意的——把平台知識放在後端會讓文案改動需要重新部署 function。

## 4. F-XX ↔ UI 元件 ↔ 前端模組 ↔ 後端契約 追溯

| PRD | 功能 | UI 元件 / 狀態 | 前端模組 | 後端契約 | Commit | 狀態 |
|---|---|---|---|---|---|---|
| **F-69** | 遷移相容性修正 | —（無 UI）| `lib/migrate.js`、**`lib/merge.js`**、`lib/schema.js` | backend §5.1 | P1／P2／P3 | ✅ Q-01 已裁定 |
| **F-70** | 貼上連結／貼文文字（**其他平台主路徑**）| C-18、C-19 **S-10**、§6.1.0 平台判定 | `IngestSheet`、**`lib/share.js` `detectPlatform`**、`lib/api.js` | `/api/parse-post` §6.1、階梯 §6.2 順位 1–3 | B1、F3、F6、**F6b** | ✅ |
| **F-71** | **截圖（IG 主路徑）** | C-19 **S-20** + **C-30 ShotPicker（primary）** + **S-21** 失敗聚焦 | `IngestSheet`、`lib/image.js` OCR 常數、§4.6 截圖管線 | 順位 4（多模態，`images[]`）§6.2／§6.3 | B1、F3、**F6b** | ✅ **v3.1 由輔路徑升為主路徑** |
| **F-72** | 解析結果覆核 | C-19 S-12 + C-20 + **C-29 Toast** | `IngestSheet` 本地 state、`dedupeAgainstSaved()` | —（純前端）| F5、F6 | ✅ |
| **F-73** | 口袋清單 | P-06、C-21、C-22、C-05 | `PocketView`、`PocketCard`、`PlaceRow` | `pockets[]` / `places[]` §4.2 | F1、F7、F8 | ✅ |
| **F-74** | 地點 → 導航 | C-22 📍、C-23 地圖鈕 | `openMap()`（既有 `schema.js:44`）| — 純 URL | F4、F7 | ✅ |
| **F-75** | 加入行程（含建議日期） | C-24、C-25、**C-29 Toast** | `DayPickerSheet`、`suggestDays()`、`daysForPlace()`、`addPlaceToDay()` | `DayItem.placeId` §4.2 | F1、F2、F3、F5 | ✅ |
| **F-76** | 口袋容量保護 | C-27（900KB 擋／800KB 預警）| `capacityCheck()` | `PLACE_BUDGET_BYTES` / `PLACE_WARN_BYTES` §4.3 | F1、F6、F7 | ✅ Q-04 已裁定 |
| **F-77** | 同步失敗原因外顯 | C-12 增修、C-28 | `useTrip.syncReason`、`SyncReasonNote` | `validateTrip.reason` §4.4 | P3、**F10（polish 分支）** | ✅ |
| **F-78** | 離線暫存待解析 | C-19 S-14、C-21 **S-06 / S-06b** | `addPocket({pending:true})`、`resolvePocket()` | `Pocket.rawText/pending` §4.2 | F2、F6 | ✅ Q-03 已裁定；**IG 限制維持誠實標示，不做 blob 暫存** |
| **F-81** | iOS 捷徑分享入口 | C-26（P-05），**文案降溫 DDR-32** | `ShortcutCard`、`lib/share.js` | — 零後端 | **F9（polish 分支）** | ✅ Q-05 已裁定 |
| **F-83** | 啟動時處理分享參數 | C-19 由 `?share=` 開啟，**開啟當下即正確模式** | `App.jsx`、`parseShareParams()` / `stripShareParams()` | — | F8 | ✅ |

**每個 F-XX 都有歸屬 ✅；沒有孤兒元件 ✅。**

### 4.1 UI 元件 ↔ 檔案 反向檢查（有無孤兒元件）

| UI 編號 | 檔案 | 有無對應 F-XX | 狀態 |
|---|---|---|---|
| C-18 IngestBar | `PocketView.jsx` 內 | F-70 | ✅ |
| C-19 IngestSheet（分流）| `IngestSheet.jsx` | F-70/71/72/78/83 | ✅ |
| C-20 ReviewRow | `IngestSheet.jsx` 內 | F-72 | ✅ |
| C-21 PocketCard | `PocketCard.jsx` | F-73/78 | ✅ |
| C-22 PlaceRow | `PlaceRow.jsx` | F-73/74/75 | ✅ |
| C-23 PlaceSheet | `PlaceSheet.jsx` | F-74/75 + PRD §6.4 | ✅ |
| C-24 DayPickerSheet | `DayPickerSheet.jsx` | F-75 | ✅ |
| C-25 DayChip | `DayPickerSheet.jsx` 內 | F-75 | ✅ |
| C-26 ShortcutCard | `views/setting/ShortcutCard.jsx` | F-81 | ✅ |
| C-27 CapacityNotice | `PocketView.jsx` 內 | F-76 | ✅ |
| C-28 SyncReasonNote | `components/SyncReasonNote.jsx` | F-77 | ✅ |
| **C-29 Toast**（v3.1）| **`components/ui.jsx`**（不另開檔）| F-72／F-75 的操作回饋 | ✅ **原「未編號」已結案** |
| **C-30 ShotPicker**（v3.1）| `IngestSheet.jsx` 內 | **F-71** | ✅ |
| C-05 / C-12 / C-16（增修）| 既有檔案 | F-73 / F-77 / F-73＋S-17 | ✅ **C-16 為向下相容增修，既有 4 個呼叫點不改** |
| PRD §6.2 列出但**本版不做** | `MapView` / `LocateSheet` / `NearbyList` / `ExportSheet` / `lib/geo.js` / `lib/csv.js` / `lib/route.js` | F-79/80/84～87（Phase 1.5）| ✅ 已明確排除，不是孤兒 |

### 4.2 UI 狀態編號 ↔ 實作反查（v3.1 新增）

| 狀態 | 實作落點 | 狀態 |
|---|---|---|
| S-10 一般模式輸入 | `IngestSheet` `mode === "general"` 的 flex `order` 排列 | ✅ |
| **S-20 Instagram 模式輸入** | `IngestSheet` `mode === "ig"`；`mode` 為 `detectPlatform(url)` 的**衍生值** | ✅ |
| S-11 解析中 | 兩模式共用（C-30 一併鎖住）| ✅ |
| S-12 覆核 | 兩模式共用 | ✅ |
| **S-13 一般模式失敗** | 焦點 → 貼文文字欄 | ✅ |
| **S-21 Instagram 模式失敗** | 焦點 → C-30（`inputRef`）| ✅ |
| S-14 離線 | 兩模式共用；**IG 追加截圖警語** | ✅ |
| S-06 / **S-06b** 待解析 | `PocketCard`，S-06b 由 `detectPlatform(pocket.sourceUrl)` 判定 | ✅ |
| S-15/16/17 PlaceSheet 三態 | S-17 帶 `subtitle` | ✅ |
| S-18/19 DayPicker | 不變 | ✅ |
| S-01～S-09 | 不變（S-01 文案依 v3.1 改） | ✅ |

## 5. T-XX 測試規則 ↔ 實作歸屬（MVP 範圍）

| T-XX | 覆蓋方式 | 落點 | 狀態 |
|---|---|---|---|
| **T-70** v5 資料餵 v4 不掉欄位 | Vitest | `merge.test.js`（**須同時測 `migrate` 與 `mergeTrip` 兩條路徑**）| ✅ 硬性條件 |
| **T-71** `> SCHEMA_VERSION` 原樣回傳 | Vitest | `merge.test.js` | ✅ 硬性條件 |
| T-72 v4→v5 冪等、既有資料零損失 | Vitest | `merge.test.js` | ✅ |
| T-73 `places` 是**整筆 LWW** | Vitest | `merge.test.js`（**不得**寫成欄位合併）| ✅ |
| T-74 精簡 tombstone 存活 | Vitest | `merge.test.js` | ✅ |
| T-75 缺 string `id` → 驗證失敗 | Vitest | `schema.test.js` | ✅ |
| T-76 五個降級分支可達 | Vitest（純函式層）＋ 人工（HTTP 層）| `parse-lib.test.js` ＋ curl | ⚠️ 部分人工 |
| T-77 `need_text_or_image` | 人工 curl | preview 部署 | ⚠️ 人工 |
| T-78 超過 12 個被截斷 | Vitest | `parse-lib.test.js`（`clampPlaces`）| ✅ |
| T-79 不存在的 trip key 不呼叫 LLM | 人工 curl | preview 部署 | ⚠️ 人工 |
| T-80 覆核前 `places` 零變化 | 人工（devtools）| — | ⚠️ 人工 |
| T-81 低信心／已存過預設不勾 | Vitest（`dedupeAgainstSaved`）＋ 人工（渲染層）| `places.test.js` | ⚠️ 部分人工 |
| T-82 容量試算擋下 | Vitest（`capacityCheck`）＋ 人工（按鈕停用）| `places.test.js` | ⚠️ 部分人工 |
| **T-83** `placeId` 正確 + badge 即時反查 | Vitest（`daysForPlace` / `placeToItem`）＋ 人工（端到端）| `places.test.js` | ✅ 硬性條件 |
| T-84 `type === category` 且可拖曳重排 | Vitest（映射）＋ 人工（拖曳）| `places.test.js` | ⚠️ 部分人工 |
| T-85 離線待解析 → 回線重解 | 人工（devtools 切離線）| — | ⚠️ 人工。**IG 來源須驗 S-06b 文案「補一張截圖再解析」** |
| T-86 六格 ≥44px 且 `grid-cols-6` 在建置後 CSS | 半自動：`grep dist/assets/*.css` ＋ 人工量測 | 建議加進 CI | ⚠️ 部分人工 |
| T-96 捷徑 URL 帶 `?trip=`、`share=` 不殘留 | 人工（iOS 實機）| — | ⚠️ 人工 |
| T-97 `suggestDays` 規則 | Vitest | `places.test.js`（7 個案例）| ✅ |
| **T-98** IG 主路徑實機驗證 | **人工實機（非 Vitest）** | — | ✅ **已於 2026-09-02 完成**；結論已回寫 PRD v3.6／UI v3.1／設計文件 v3.1.0。SA 只需查核 UI 是否照結論分流 |
| **T-99** OCR 參數實測（v3.1 新增）| **人工實機（非 Vitest）**：需真實 IG 截圖與人眼判讀日文 | frontend §7.2 | ⏳ **實作後必做**。讀不出 → 調高 `OCR_MAX`；撞 1.4MB → 調低 `OCR_QUALITY`；**結論須回寫 PRD §7.5** |
| （新增，支撐 S-20/S-21）| `detectPlatform` 邊界 | Vitest `share.test.js` | ✅ **`?ref=instagram.com` 必須回 `other`** |
| （新增，支撐 `images[]`）| 三道上限各回 `too_large`、`buildImageContent` block 序列 | Vitest `parse-lib.test.js` | ✅ |
| T-87～T-95 | **Phase 1.5，不列入 MVP 驗收** | — | ➖ 排除 |

**每個 MVP 的 T-XX 都有對應實作與驗收方式 ✅。** 三個硬性條件（T-70／T-71／T-83）全部有 Vitest 覆蓋。
**T-98 與 T-99 皆為人工實機驗收項，不得寫成 Vitest 案例充數。**

## 6. 疑點清單與裁定狀態（Q-01 ～ Q-11）

> 依 `_workflow/roles/engineer.md`「何時向上游回報」，以下**未自行改設計、未默默補洞**。
> **Q-01 ～ Q-06 已由 PRD v3.5／v3.7 裁定**，保留紀錄與出處；**Q-07 ～ Q-11 為本次同步新浮現，尚未裁定**。

### ✅ 已裁定（Q-01 ～ Q-06）

| # | 嚴重度 | 問題 | 裁定結果 | 出處 |
|---|---|---|---|---|
| **Q-01** | 🔴 高 | `merge.js` 的 `mergeTrip` 也是白名單重建（`:170` 硬寫 `schemaVersion`），只修 `migrate.js` 擋不住雲端層級資料遺失，且 `mergeTrip` 觸發頻率遠高於 `migrate` | **採選項 A**：F-69 同時修兩個檔案，`mergeTrip` 加未知欄位穿透 + `schemaVersion` 取 `Math.max` | **PRD v3.5 §2.3 ②**（含呼叫點頻率表與修法程式碼）|
| **Q-02** | 🟠 中 | `validateTrip` 對「比自己新的資料」行為未定義，舊 bundle 只會顯示看不懂的紅徽章 | **採選項 A**：新增專屬 reason「App 版本過舊，請重新整理頁面」+［重新整理］按鈕；舊裝置 fail-closed 退化為唯讀 | **PRD v3.5 §4.2 F-77**、§2.3 |
| **Q-03** | 🟠 中 | `Pocket` 缺 `rawText` / `pending`，F-78 做不出來（`sourceUrl` 存不了 caption；用 `title` 當旗標不可靠）| **採選項 A**：兩個欄位納入 `Pocket`，F-78 與 S-06 的預填來源＝`rawText` + `sourceUrl` | **PRD v3.5 §5.2**、§4.2 F-78 |
| **Q-04** | 🟡 低 | `PLACE_WARN_BYTES = 800_000` 只出現在 UI spec | **採選項 A**：`schema.js` 具名定義，80 萬黃字預警、90 萬才擋 | **PRD v3.5 §5.3** |
| **Q-05** | 🟡 低 | Toast 未編號、`lib/share.js` 未列入檔案清單 | Toast ＝ **C-29**，放 **`components/ui.jsx`**（不另開檔）；`lib/share.js` 列入 PRD §6.2，並追加 `detectPlatform` | **PRD v3.5／v3.7 §6.2**、UI spec v3.1 §4／§12.1、DDR-29 |
| **Q-06** | 🟡 低 | C-16 硬寫的刪除副標出現在 S-17「放棄修改」情境 | **採選項 A**：加**選填** `subtitle`，預設值＝現有硬寫字串 → 既有 4 個呼叫點一行都不用改 | **PRD v3.5 §6.2**、DDR-30 |

### ⏳ 未裁定（Q-07 ～ Q-11，本次同步新浮現）

#### Q-07 🟡 低 — 降級階梯順位 3.5 與順位 4 的優先關係未定義

| 項目 | 內容 |
|---|---|
| 對應章節 | PRD §7.2（階梯表）vs §7.5b（`images[]`）|
| 問題描述 | 階梯規則是「`text` ≥ 40 字 → 順位 1」「其他 URL → 順位 3」「`images[]` → 順位 4」。但 **S-20 的貼文文字欄是選填**，使用者很可能只打了「一蘭 中洲店」這種**短文字**外加 3 張截圖。此時走原本的順位 3.5（以短文字送 LLM）會**完全不看截圖**，而截圖才是 IG 上唯一有內容的東西 |
| 本設計的暫定處理 | backend §6.2：`text` < 40 字且順位 3 也空、但有截圖時，**改走順位 4，並把短文字附在指示 text block 裡**（`extraText`）。這樣兩邊的資訊都不丟 |
| 建議選項 | **A（本設計採用）** 短文字併入順位 4 的 text block。成本：3 行，**極低**。<br>**B** 維持原階梯（短文字優先），截圖被忽略。成本：0，但 IG 上等於使用者多打幾個字反而讓功能變差。<br>**C** 兩者都送（先文字後圖各一次呼叫）。成本：雙倍 token，且違反 §7.5b「同一則貼文不該切開」 |
| 需要裁定的原因 | 這改動的是 PRD §7.2 明列的階梯順序，屬上游規格 |

#### Q-08 🟡 低 — `?share_text=` 對 Instagram 實際上永遠是空的

| 項目 | 內容 |
|---|---|
| 對應章節 | PRD §4.2 F-83 vs §4.2 F-81 細節 2 |
| 問題描述 | F-83 要求 `App.jsx` 讀 `?share=` / `?share_text=` 並預填。但 PRD 自己載明「IG 的分享選單只會給捷徑一個 URL，不會給貼文文字」——所以 `?share_text=` 對 IG **結構上不可能有值**。它仍對 Threads／備忘錄等分享來源有意義 |
| 本設計的處理 | 照常支援 `?share_text=`（成本為零，且其他來源用得到），**但捷徑設定卡片的三步驟文案不得暗示它會帶內容**（DDR-32 已涵蓋）。不影響實作 |
| 需要裁定的原因 | 純文件一致性，**不擋實作**。列在此處只是避免日後有人看到 `?share_text=` 就以為 IG 也會帶文字 |

#### Q-09 🟡 低 — 覆核步驟（S-12）沒有「換一張截圖再解析」的直接入口

| 項目 | 內容 |
|---|---|
| 對應章節 | UI spec §6.1.4（S-12）|
| 問題描述 | 截圖成為主路徑後，最典型的失敗不是「解析失敗」而是「**解析成功但只讀到 2 家店，因為第 3 張沒截到**」。S-12 目前只有「‹ 改一下輸入」回到輸入步驟，使用者要自己意會到「回去補一張圖」 |
| 本設計的處理 | 沿用既有的「‹ 改一下輸入」（回原模式、保留已選截圖，補圖後重新送出）。**未自創新按鈕。** |
| 建議選項 | **A（本設計採用）** 維持現狀，零成本。<br>**B** 在 S-12 底部加一行提示「少了幾家店？回去補一張截圖」。成本：一行文案，**極低**，但屬 UI spec 未定義的新增文案，需 UI/UX 裁定 |

#### Q-10 ✅ 已解除 — serverless 環境變數（原標記「需 CEO 處理」）

| 項目 | 內容 |
|---|---|
| 對應章節 | PRD v3.7 §7.4 |
| 原本的問題 | v3.0 的 backend §6.1／§7 標記「`VITE_` 前綴是建置期變數，serverless runtime 讀不到，**需 CEO 到 Vercel 後台新增 `SUPABASE_URL` / `SUPABASE_ANON_KEY`**」 |
| **裁定結果** | **顧慮撤銷，無需任何手動設定。** 2026-09-02 實地查證 Vercel 後台：`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 早已存在（Production and Preview，Jun 1 建立），且 Vercel 後台環境變數對 serverless `process.env` 一律可見（`VITE_` 前綴只對 Vite 有意義；同專案 `AERODATABOX_KEY` 即現成佐證）|
| 實作要求 | 讀取鏈 `process.env.SUPABASE_URL \|\| process.env.VITE_SUPABASE_URL`（KEY 同理）；**兩者任一缺失即跳過 trip key 檢查、只留 IP 限流並記 log**，不得因缺變數讓端點整個失效（backend §6.1／§6.5／§7）|
| 對 CEO 的行動項 | **無。** 本條已從「待處理」移除 |

#### Q-11 🟡 低 — 前端三道圖片上限的文案與後端不完全等價

| 項目 | 內容 |
|---|---|
| 對應章節 | PRD §7.4／§7.5b vs UI spec §6.1.3 `too_large` 文案 |
| 問題描述 | UI spec 只給了一句 `too_large` 文案「這張截圖太大了，換一張或改貼文字」，那是**單張時代**的措辭。改成 3 張後有三種觸發（張數／單張／總量），一句話蓋不住——尤其「張數超過」根本不是「太大」的問題 |
| 本設計的處理 | 後端回三種不同 `message`（backend §5.5），前端**優先顯示後端回的 `message`**，`reason` 只用來決定樣式與焦點。前端自己擋下的情況（選超過 3 張）另給「一次最多 3 張截圖」提示 |
| 需要裁定的原因 | 「前端顯示後端 `message` 而非自己的對照表」與 UI spec §6.1.3 的文案表寫法略有出入。**建議 UI/UX 補三條文案，或確認採用後端 `message`** |

## 7. 跨分支 / 順序性風險

| # | 風險 | 處理 |
|---|---|---|
| 1 | **升版號的閘門** | `feature/schema-forward-compat`（P1–P3）必須**單獨上線並確認全裝置傳播完成**，才可合併 `feature/pocket-places-frontend` 的 F1。這是 PRD §2.4 的硬性閘門，寫進 commit 計畫。**本次同步未動此閘門** |
| 2 | 前端 F6/F6b（IngestSheet）依賴後端 B1（`/api/parse-post`） | 若先做前端，以固定 mock 回應開發；B1 完成後以真實 preview 部署驗證 DTO。**`images[]` 的 mock 必須用真的 3 張圖跑一次**，否則 data URL 前綴那一行漏了不會被發現 |
| 3 | `ITEM_TYPE_KEYS` 是前後端共用 enum，卻分別寫在 `schema.js` 與 `api/_parse-lib.js` | 兩處都是 6 個字面值。**實作時必須在 `_parse-lib.js` 留註解指回 `src/lib/schema.js:20`**；serverless 端不 import 前端模組 |
| 4 | **`Platform` enum 有第三個抄本** | `detectPlatform`（前端 `lib/share.js`）、`platformOf`（後端）、`Pocket.platform`（型別）。三處字面值必須一致。**實作時在 `share.js` 留註解指回 backend §4.2**；前端不得 import serverless 模組 |
| 5 | 未設計元件的呼叫 | F4／F5／F6／F6b 皆在 F3（`lib/places.js` + `lib/share.js`）之後；F7 組裝、F8 掛進 shell。無前向呼叫 |
| 6 | 循環依賴 | 依賴為線性 DAG，見 commits-plan-v3 §跨分支衝突檢查 |
| 7 | **T-99 可能回頭改常數** | `OCR_MAX` / `OCR_QUALITY` 若實測後需調整，只需改 `src/lib/image.js` 一處，但**必須回寫 PRD §7.5**，不得只改程式碼 |

## 8. 結論

✅ **無幽靈 API、無孤兒 API、無孤兒元件**（C-29／C-30 已編號歸位）；
✅ **DTO 與錯誤碼前後端雙向對齊**，`images[]` 的三道上限前後端數值一致；
✅ **MVP 的每個 F-XX 與 T-XX 都可追溯到實作與驗收方式**，T-98／T-99 明列為人工實機；
✅ **原 Q-01 ～ Q-06 全部已由 PRD v3.5／v3.7 裁定**，包含原本的阻斷級 Q-01；
✅ **原「需 CEO 處理」的環境變數問題（Q-10）已解除**，實作零手動設定。

⏳ **待裁定：Q-07（階梯順位 3.5 vs 4）、Q-09（S-12 補圖入口）、Q-11（`too_large` 三種文案）** —— 三者皆為 🟡 低，
**不擋實作**：本設計已寫出暫定處理並明確標示為暫定。Q-08 純屬文件一致性提醒，無行動項。
