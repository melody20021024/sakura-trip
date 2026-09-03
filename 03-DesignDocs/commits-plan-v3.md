# Commit Plan: 櫻旅 v3「口袋地點」MVP

> 建立時間：2026-09-02 ｜ **修訂：2026-09-02（依 PRD v3.7 / UI spec v3.1 回頭同步）** ｜ 狀態：**待確認**
> 對應：[**PRD v3.7**](../01-PRD/PRD-v3-pocket-places.md) §8 的 P1–P10 ｜ [**UI spec v3.1**](../02-Design/ui-spec-v3-pocket.md)
> 設計文件：[frontend/pocket-v3.md](frontend/pocket-v3.md) v3.1.0｜[backend/parse-and-schema-v3.md](backend/parse-and-schema-v3.md) v3.1.0｜[cross-check-v3.md](cross-check-v3.md)
> 範圍：**僅 MVP**。Phase 1.5 地圖（M1–M8）與 Phase 2 `share_target` 不在本計畫。

## 0. 本次修訂改了什麼（v3.0 → v3.1）

| # | 改動 | 理由 |
|---|---|---|
| 1 | **F6 拆成 F6 + F6b** | 依平台分流（S-10／S-20／S-13／S-21）＋ C-30 ShotPicker ＋ `images[]` 多圖，是一整層獨立的排版與上傳邏輯。硬塞進原 F6 會讓單一 commit 超過 500 行、橫跨五個關注點，違反單一職責 |
| 2 | **F9／F10 移到新分支 `feature/pocket-places-polish`** | 為了 #1 的拆分留出額度。Frontend 原本已達 10 個上限，**不硬塞**；F9（iOS 捷徑）與 F10（同步原因外顯）與口袋核心迴路耦合最低，且 F-77 本來就是修既有問題、不是新功能。此建議在 v3.0 計畫末尾就已列為候選 |
| 3 | **F3** 追加 `detectPlatform`、`api.parsePost` 改 `images[]`、新增 `share.test.js` | PRD v3.7 §5.3／§6.2／§7.5b |
| 4 | **F5** 的 Toast 落點由 `components/Toast.jsx` 改為 **`components/ui.jsx`** | PRD §6.2 裁定 C-29 不另開檔（DDR-29）|
| 5 | **F4** 明確標示會碰到 `ConfirmSheet` 的既有 4 個呼叫點（向下相容、不需改）| Q-06 裁定，避免實作時誤以為要改呼叫端 |
| 6 | **B1** 契約改 `images[]`、三道上限、多圖 content block 組裝 | PRD v3.7 §7.5b |
| 7 | **Phase 0 完全不動** | 三個 commit、單獨分支、單獨上線、升版號閘門，一律維持 |

## 分支規劃

| 階段 | 端 | 分支名稱 | Commits | 上線方式 |
|---|---|---|---|---|
| **Phase 0** | 資料層 | `feature/schema-forward-compat` | **3** | 🔴 **必須單獨上線**，見下方閘門 |
| Phase 1 | Backend | `feature/pocket-parse-backend` | 2 | 可與前端並行開發 |
| Phase 1 | Frontend | `feature/pocket-places-frontend` | **9**（原 10）| 閘門通過後才可合併 |
| Phase 1 | Frontend（收尾）| **`feature/pocket-places-polish`** 🆕 | **2** | 在 frontend 分支合併後才開，見下方說明 |

> **為什麼 Phase 0 不叫 `-backend` / `-frontend`**：它動的是前端 `src/lib/` 的檔案，但性質是**多客戶端共享的資料契約修正**（契約由 [backend/parse-and-schema-v3.md](backend/parse-and-schema-v3.md) §5.1 管轄）。它與 v3 的任何新功能都無關，是一支**必須先單獨上線並等待傳播**的 hotfix，因此獨立命名。

> **為什麼要開第四支 `-polish` 分支（而不是硬塞回 frontend）**
>
> 依 `_workflow/roles/engineer.md`，單一分支上限 **10 個 commit**。v3.1 的分流設計讓 IngestSheet 從
> 「一個面板」變成「一個面板兩種排列 + 一個新元件 + 多圖上傳管線」，**必須拆成兩個 commit**（F6／F6b）。
> 若不動分支結構，Frontend 就會變成 11 個 —— 超標。
>
> 移走的是 **F9（F-81 iOS 捷徑卡片）** 與 **F10（F-77 同步原因外顯）**，理由：
>
> | 判準 | F9 | F10 |
> |---|---|---|
> | 與核心迴路（存 → 解析 → 建議哪一天 → 寫入行程）的耦合 | 低。只在設定頁加一張卡片，不裝捷徑對任何功能零影響（PRD §4.2 F-81 錯誤處理已明載）| 低。修的是 v2 既有的「失敗只有紅徽章」問題，與口袋功能無資料依賴 |
> | 是否新功能 | 是，但屬**入口便利性**，貼上路徑照常可用 | **不是**。F-77 標記為 🔧 修既有問題 |
> | 是否阻擋 SA 驗收核心 | 否。T-96 是人工 iOS 實機項，本來就會晚一輪 | 否。但 **P3 已經讓 `validateTrip` 回傳專屬 reason**，所以在 F10 落地前，版本過舊只會顯示紅徽章 —— 這是 P3 早已載明的預期中間態 |
>
> **MVP 的功能範圍沒有縮小**，F-81／F-83／F-77 全部照做，只是分兩支分支上線。
> `-polish` 分支在 frontend 合併回 `main` 之後才開（F10 需要 F8 建立的 `onGoTab`）。

---

## ⛔ 上線閘門（違反即重現雲端層級資料遺失）

```
P1 → P2 → P3  合併 main → 部署 Vercel
                    │
                    ▼
        【等待所有裝置載入新 bundle】
        驗證：每支手機／電腦重新整理一次，或等待一個完整使用週期
                    │
                    ▼  ← 只有到這裡，F1（SCHEMA_VERSION = 5）才可以合併
        feature/pocket-places-frontend
                    │
                    ▼  ← 合併回 main 之後才開
        feature/pocket-places-polish
```

**理由**：`vite-plugin-pwa` 用 `registerType: "autoUpdate"`，舊 bundle 在使用者重新整理前可能存活數分鐘到數天。在 Phase 0 傳播完成前升版號，仍跑舊 bundle 的裝置會把 `pockets` / `places` 砍掉再推回 Supabase，所有旅伴的口袋地點會被清空且不可復原（PRD §2.2 / §2.4）。

> **此閘門在本次同步中未被修改，也不得因為分支變多而放寬。**

---

## ⚠️ 跨分支注意事項

> 前後端需同步對齊的關鍵 contract：

- **`ParsePostRequest` / `ParsePostOk` DTO**：frontend F3 的 `api.parsePost()` 必須與 backend B1 的 §6.1 逐欄一致。
  **v3.1 變更**：`imageBase64` / `mime` 已移除，改為 `images?: [{ base64, mime }]`（≤3 張）。
- **`images[]` 的三道上限（3 張 / 每張 1.4MB / 總量 4MB）**：前後端**各自都要檢查**，數值必須相同。
  前端檢查是體驗（不送註定失敗的請求）、後端檢查是防護（前端可被繞過）。
- **data URL 前綴**：`compressImage` 回傳 `data:image/jpeg;base64,...`，**前端送出前必須去掉前綴**
  （frontend §4.6 `toImages`）。這一行漏掉會讓後端拿到非法 base64、LLM 直接讀圖失敗，
  而且不會有任何錯誤訊息 —— **B1 的 mock 驗證必須用真的圖跑一次**。
- **`category` enum**：前端 `src/lib/schema.js:20` 的 `ITEM_TYPE_KEYS` 與後端 `api/_parse-lib.js` 的同名常數是同一組 6 個字面值。**serverless 端不 import 前端模組**，因此必須在 `_parse-lib.js` 留註解指回 `src/lib/schema.js:20`。
- **`Platform` enum 有三個抄本**：`detectPlatform`（前端 `lib/share.js`）／`platformOf`（後端）／`Pocket.platform`（型別）。
  三處字面值必須一致；在 `share.js` 留註解指回 backend §4.2。
- **`Pocket` / `Place` jsonb 結構**：frontend F1/F2 產生的記錄以 backend §4.2 為唯一權威（含 `rawText` / `pending`）。
- **`validateTrip.reason` 字串**：P3 定義的「App 版本過舊,請重新整理頁面」是 F10（C-28）的文案分支鍵，兩處必須逐字一致。
- **建議實作順序**：**Phase 0（3 個 commit，先上線 + 等傳播）** → Backend（2 個 commit，解鎖 DTO）→ Frontend（9 個 commit）→ Polish（2 個 commit）。
- **✅ 前提已滿足**：本計畫假設的 Q-01 ～ Q-06 **均已由 PRD v3.5／v3.7 裁定為選項 A**（見 [cross-check-v3.md](cross-check-v3.md) §6）。
  尚未裁定的 Q-07／Q-09／Q-11 皆為 🟡 低且已有暫定處理，**不擋實作**。

---

## Phase 0 — `feature/schema-forward-compat`

> **不升版號、不加任何新欄位、不新增任何 UI。** 這支分支的唯一目的是讓「未來版本的資料」在「今天的 bundle」上活得下來。
> **本次同步完全未動這一段。**

- [ ] **P1** `Preserve unknown fields through schema migration`
  - **範圍**：`src/lib/migrate.js`、`src/lib/__tests__/merge.test.js`
  - **涵蓋**：F-69（上半）
  - **說明**：`migrate()` 對 `raw.schemaVersion > SCHEMA_VERSION` 直接原樣回傳；`normalized` 改以 `...raw` 開頭讓未知欄位穿透。
  - **測試**：**T-70**（含未知欄位的 blob 遷移後欄位零損失）、**T-71**（`> SCHEMA_VERSION` 原樣回傳）、T-72（冪等 + 既有 `days`/`expenses`/`food` 零損失）

- [ ] **P2** `Preserve unknown fields through trip merge`
  - **範圍**：`src/lib/merge.js`、`src/lib/__tests__/merge.test.js`
  - **前置**：P1
  - **涵蓋**：F-69（下半，PRD v3.5 §2.3 ② 已補上）
  - **說明**：`mergeTrip` 加 `KNOWN_TRIP_KEYS` + `passthrough()` 讓未知欄位穿透，並把 `schemaVersion` 由硬寫改為 `Math.max(local, remote, SCHEMA_VERSION)`，不再降版號。
  - **測試**：**T-70**（`mergeTrip(v4local, v5remote)` 後未知欄位仍在、版號不被降回 4）、`mergeTrip(a,a)` 仍冪等、既有 v2 合併測試全數通過

- [ ] **P3** `Report a stale app version as a sync reason`
  - **範圍**：`src/lib/schema.js`、`src/lib/__tests__/schema.test.js`（新增）
  - **前置**：P2
  - **涵蓋**：F-69（收尾）、F-77（前置）
  - **說明**：`validateTrip` 對 `schemaVersion > SCHEMA_VERSION` 回傳專屬 reason「App 版本過舊,請重新整理頁面」（fail-closed：舊 bundle 抱著新版資料時退化為唯讀）。此時 C-28 尚未存在，UI 只會顯示紅徽章，**屬預期中間態**（C-28 在 polish 分支的 F10）。
  - **測試**：T-75（既有 LIST_FIELDS 行為不變）、新增「版號較新 → 專屬 reason」案例

---

## Backend — `feature/pocket-parse-backend`

- [ ] **B1** `Add the post parsing endpoint`
  - **範圍**：`api/parse-post.js`（新增）、`api/_parse-lib.js`（新增）、`api/__tests__/parse-lib.test.js`（新增）、`package.json`（加 `@anthropic-ai/sdk`）
  - **前置**：無
  - **涵蓋**：F-70、**F-71（IG 主路徑）**
  - **說明**：`POST /api/parse-post`。五段降級階梯（text → oEmbed → og → **`images[]`** → 失敗）、
    強制 tool-use（`save_places`，`claude-haiku-4-5`）保證結構化 JSON、`PARSE_PROVIDER` 供應商切換、
    fail-soft **永遠回 200**。
    **v3.1 契約**：`images?: [{ base64, mime }]`，**最多 3 張放進同一個 request、同一次 LLM 呼叫**；
    content block 組裝為「N 個標號 text + N 個 image + 1 個指示 text（放最後）」（backend §6.3）。
    **防護六道**：trip key 存在性檢查（`SUPABASE_URL || VITE_SUPABASE_URL` 讀取鏈，**任一缺失即跳過並記 log**）、
    每 IP 20 次/小時、`slice(0,12)`、**張數 ≤ 3**、**單張 b64 ≤ 1.4MB**、**總量 ≤ 4MB**；全部外部 fetch 6 秒逾時。
  - **測試**：**T-78**（`clampPlaces` 截斷至 12、非法 category 落回 `other`、confidence 夾在 0..1）、
    T-76 的階梯判斷層（`resolveSource` 五個順位）、**三道圖片上限各自回 `too_large`**、
    **`buildImageContent` 的 block 序列與順序**。T-76 的 HTTP 層、T-77、T-79 以 curl 對 preview 部署人工驗收。

- [ ] **B2** `Document the version 5 trip schema`
  - **範圍**：`supabase-schema.sql`
  - **前置**：無
  - **涵蓋**：F-73（資料落位說明）
  - **說明**：**表結構零變更，無 DDL**。僅補上 v5 `data` 新增 `pockets[]` / `places[]`（含 `rawText` / `pending`）與 `days[].items[].placeId` 的註解，並註明 `geo_cache` 表屬 Phase 1.5 尚未建立。
  - **測試**：無（純註解）

---

## Frontend — `feature/pocket-places-frontend`（9 commits）

> **F1 在 Phase 0 傳播確認完成前不得合併。**

- [ ] **F1** `Add pockets and places to schema version 5`
  - **範圍**：`src/lib/schema.js`、`src/lib/migrate.js`、`src/lib/merge.js`、`src/lib/__tests__/merge.test.js`、`src/lib/__tests__/schema.test.js`
  - **前置**：Phase 0 全部上線並傳播完成 ⛔
  - **涵蓋**：F-69（升版）、F-73、F-75、F-76
  - **說明**：`SCHEMA_VERSION = 4 → 5`；`DEFAULT.pockets = []` / `DEFAULT.places = []`；`LIST_FIELDS` 加 `"pockets"`, `"places"`；新增 `PLACE_BUDGET_BYTES = 900_000` 與 `PLACE_WARN_BYTES = 800_000`（PRD v3.5 §5.3）；`migrate` 加 `pockets`/`places` 的 `stamp`；`mergeTrip` 加兩行 `mergeList`。**`places`/`pockets` 刻意不進 `normalizeTrip` 的 `dedupeByContent`，並在程式碼留下註解說明理由。** 不加 `place.usedIn`、不擴充 `mergeDays`。
  - **測試**：**T-73**（`places` 是整筆 LWW，**不得**寫成欄位合併）、**T-74**（精簡 tombstone 不復活）、**T-75**（缺 string id → 驗證失敗）、T-72（v4→v5 冪等）

- [ ] **F2** `Add stamped mutators for pockets and places`
  - **範圍**：`src/hooks/useTrip.js`
  - **前置**：F1
  - **涵蓋**：F-72、F-73、F-75、F-78
  - **說明**：`addPocketWithPlaces` / `addPocket` / `addPlaces` / `updatePlace` / `resolvePocket` / `deletePlace`（精簡 tombstone）/ `deletePocket`（連帶 tombstone 其下 places）/ `addPlaceToDay`（單次 commit 寫入 item 並帶 `placeId`）。全部沿用既有 `commit()` 管線，零新增同步機制。
  - **測試**：無獨立單測（hook 需 React 環境）；規則層由 F3 的純函式覆蓋，端到端由 T-83／T-84 人工驗收

- [ ] **F3** `Add the place helpers and parse client`
  - **範圍**：`src/lib/places.js`（新增）、`src/lib/share.js`（新增）、`src/lib/api.js`、`src/lib/image.js`、`src/lib/__tests__/places.test.js`（新增）、**`src/lib/__tests__/share.test.js`（新增）**
  - **前置**：F1
  - **涵蓋**：F-70、F-71、F-72、F-75、F-76、F-81、F-83
  - **說明**：純函式層 `normalizeName` / `dedupeAgainstSaved` / `suggestDays` / `daysForPlace` / `placeToItem` / `capacityCheck`；
    `share.js` 的 `parseShareParams` / `stripShareParams` / `shortcutPrefix` ＋ **`detectPlatform(url)`**
    （PRD v3.7 §5.3／§6.2 裁定落位；**比對 hostname 並以 `(^|\.)…$` 錨定，嚴禁 `includes`**）；
    `api.js` 加 `parsePost()`（**`images[]` 契約**）；`image.js` 加 `OCR_MAX = 1024` / `OCR_QUALITY = 0.7`
    （**不改**既有 `THUMB_MAX = 320`，購物清單照舊）。
  - **測試**：**T-97**（`suggestDays` 七個案例）、T-81 規則層、T-82 試算層、T-83 反查層、T-84 映射層、
    **`detectPlatform` 七個邊界（`?ref=instagram.com` 與 `fakeinstagram.com` 必須回 `other`）**

- [ ] **F4** `Add the place detail sheet`
  - **範圍**：`src/views/places/PlaceSheet.jsx`（新增）、`src/views/places/constants.js`（新增，僅 re-export `ITEM_TYPES`）、`src/components/ConfirmSheet.jsx`（**增修**）、`src/hooks/useConfirm.js`（**增修**）
  - **前置**：F3
  - **涵蓋**：F-74、PRD §6.4、S-17
  - **說明**：C-23。**明確「儲存」鈕，不做即時輸入即存**（不擴充 `activeField` 保護）；`nameJa` 唯讀顯示；S-15/S-16/S-17 三態。
    **C-16 增修**：`ConfirmSheet` 加**選填** `subtitle` prop，**預設值＝現有硬寫的「刪除後旅伴端也會一併移除,無法復原」**；
    `useConfirm.ask(message, opts)` 透傳 `subtitle` / `confirmLabel`。
    ⚠️ **此 commit 會碰到 `ConfirmSheet` 的既有 4 個呼叫點所依賴的元件簽名**——但因為預設值等於原字串，
    **4 個呼叫點一行都不用改**，diff 裡不得出現它們。若 diff 動到了呼叫端，就是做錯了。
  - **測試**：人工（編輯 → 未存離開 → 確認框顯示「這個地點剛剛改的內容不會存起來。」而**不是**刪除警告；
    既有 4 個刪除確認畫面**逐一回歸確認文案未變**）

- [ ] **F5** `Add the suggested day picker`
  - **範圍**：`src/views/places/DayPickerSheet.jsx`（新增，含 C-25 DayChip）、**`src/components/ui.jsx`（增修：加 C-29 Toast）**
  - **前置**：F3
  - **涵蓋**：**F-75（本版賣點）**、F-72 的成功回饋
  - **說明**：C-24/C-25。日期列表**維持行程原順序**（`suggestDays` 回傳 `Set`，結構上無法用來排序）；「建議」只是 badge，不自動選、不自動寫入；零相符仍列出所有天；S-19 無日期時給「去行程頁」（只切 tab）。點 chip → `addPlaceToDay` → **C-29 Toast**「已排進 D2（6/11）」＋「去看看」。
    **C-29 放進 `components/ui.jsx`，不另開新檔**（PRD §6.2／DDR-29）。
  - **測試**：**T-97**（順序不變）、T-83／T-84 端到端人工

- [ ] **F6** `Add the ingest sheet with review step`
  - **範圍**：`src/views/places/IngestSheet.jsx`（新增，含 C-20 ReviewRow）
  - **前置**：F2、F3、（契約）B1
  - **涵蓋**：F-70、F-72、F-78
  - **說明**：C-19 的**骨架與共用段**，**所有入口的共同終點**：四步驟狀態機（輸入／解析中／失敗／覆核）、
    一般模式（**S-10**）版面、覆核步驟全程本地 state 且唯一寫入點是「加入口袋 (N)」、寫入前跑 `capacityCheck`、
    離線時主按鈕改「先存起來」寫入待解析 pocket（`rawText` + `pending`）、失敗**不換頁不清空**並依 `reason` 給文案（**S-13**）。
    **此 commit 不含平台分流與截圖上傳**（在 F6b）。
  - **測試**：**T-80**（覆核期間 `trip.data.places` 零變化）、**T-81**（低信心／已存過預設不勾）、**T-82**（容量擋下）、T-85（離線）—— 皆人工＋ devtools

- [ ] **F6b** `Add platform aware layout and multi screenshot ingest`
  - **範圍**：`src/views/places/IngestSheet.jsx`（含 **C-30 ShotPicker**）
  - **前置**：F6
  - **涵蓋**：**F-71（IG 主路徑）**、F-70（分流引導）
  - **說明**：v3.1 的核心。四件事：
    ① **依平台分流**：`mode = detectPlatform(url) === "instagram" ? "ig" : "general"`，
      **衍生值，不得做成 state**；欄位順序用 flex **`order`** 切換，**不重建 DOM、不移動焦點、可逆、留逃生口**（DDR-26）。
    ② **C-30 ShotPicker**：`emphasis="primary" | "secondary"` 兩種外觀、`multiple`、顯示已選張數、可逐張移除。
    ③ **多張截圖管線**：逐張 `compressImage({max: OCR_MAX, quality: OCR_QUALITY})`、前端三道上限、
      送出前去掉 data URL 前綴組成 `images[]`（**≤3 張放進同一個 request**）。
    ④ **失敗分流**：`general` → 聚焦貼文文字欄（S-13）／`ig` → 聚焦 C-30（**S-21**）；
      IG 且無截圖無文字時主按鈕為「選擇截圖」＝開檔案選擇器、**不打 API**（DDR-27）。
    S-11／S-12／S-14／容量檢查**完全沿用 F6 的實作，不得複製第二套**。
  - **測試**：人工（貼 IG 連結 → 版面即時換成 S-20 且**焦點不動**；貼 `?ref=instagram.com` → **維持一般模式**；
    選 3 張 → 顯示「已選 3 張」且可逐張移除；解析失敗 → IG 聚焦截圖區而非文字欄）。
    **實作完成後必須跑 T-99**（真實 IG 截圖實測 OCR 參數），結論回寫 PRD §7.5。

- [ ] **F7** `Add the Pocket view with pocket cards`
  - **範圍**：`src/views/places/PocketView.jsx`（新增，含 C-18 IngestBar、C-27 CapacityNotice）、`src/views/places/PocketCard.jsx`（新增）、`src/views/places/PlaceRow.jsx`（新增）
  - **前置**：F4、F5、F6b
  - **涵蓋**：F-73、F-74、F-76、F-78
  - **說明**：P-06 外殼。C-18 是**按鈕不是輸入框**（DDR-10b），說明文案**截圖排第一**；貼文卡依 `createdAt` 新→舊，最新一則預設展開（DDR-22）；`pocketId === ""` 的地點收成 S-07「📌 自己加的地點」固定置底；
    **S-06 待解析卡**（`border-dashed` + 「重新解析」，以 `rawText` + `sourceUrl` 預填）與 **S-06b**（來源是 IG → 按鈕文案改「補一張截圖再解析」）；
    C-27 在 > `PLACE_WARN_BYTES` 時常駐預警、> `PLACE_BUDGET_BYTES` 時擋下（**引用常數，不寫死數字**）。
    `liveDays` 在此算一次往下傳。PlaceRow 視覺與 `ItemRow` 同源，地圖鈕永遠顯示。
  - **測試**：人工（S-01 空狀態文案**第一行是截圖**、不得出現「地圖／Google 清單」字樣；IG 來源的待解析卡顯示 S-06b 文案；badge「已加入 D2、D3」正確）

- [ ] **F8** `Add the Pocket tab to the app shell`
  - **範圍**：`src/App.jsx`、`src/components/BottomNav.jsx`
  - **前置**：F7
  - **涵蓋**：F-73、**F-83**
  - **說明**：六格 BottomNav，「口袋」插在「相簿」與「設定」之間（DDR-09），用 `COLS = {5:"grid-cols-5",6:"grid-cols-6"}` **明確字面值**（嚴禁字串內插）；`App` 開機讀 `?share=` / `?share_text=`，`history.replaceState` 立刻清掉參數，然後以預填內容切到口袋頁並開啟 C-19（**因 `mode` 是衍生值，IG 連結開啟當下就是 S-20，不會先給錯版面**）；`onGoTab` 往下傳給 PocketView。
  - **測試**：**T-86**（`npm run build && grep "grid-cols-6" dist/assets/*.css`，建議寫進 CI；375px 下每格 ≥ 44px）、T-96（人工，iOS 實機）

---

## Frontend 收尾 — `feature/pocket-places-polish`（2 commits）

> **在 `feature/pocket-places-frontend` 合併回 `main` 之後才開**（F10 需要 F8 建立的 `onGoTab`）。
> 這兩個 commit **不縮減 MVP 範圍**，F-81 / F-77 照做，只是換一支分支上線。

- [ ] **F9** `Add the iOS shortcut card to settings`
  - **範圍**：`src/views/setting/ShortcutCard.jsx`（新增）、`src/views/setting/SettingView.jsx`
  - **前置**：F3（已在 main）
  - **涵蓋**：**F-81**
  - **說明**：C-26。比照分享連結卡（唯讀欄 + 複製鈕 + 折疊三步驟），放在「分享連結」卡之後、「旅程設定」卡之前。前綴為 `{origin}/?trip={KEY}&share=`（**`?trip=` 不可省**，否則 PWA 儲存分區可能開到另一份行程）。
    **文案降溫為硬性（DDR-32，v3.1）**：標題為「iOS 捷徑：從 IG 分享選單直接開櫻旅」；價值主張只能講**不漏掉來源**與**一鍵開啟收藏面板**；
    必須明寫「IG 分享只給得到連結，給不到貼文內容……面板還是會請你截一張把說明文字展開的圖」。
    **嚴禁**出現「一鍵存下 IG 貼文」的暗示，也**不得**再寫 v3.0 那句「解析不到就把文字貼上去」（T-98 已證實做不到）。
  - **測試**：**T-96**（人工，iOS 實機：捷徑產生的 URL 開啟後是同一份行程、網址列無 `share=` 殘留）

- [ ] **F10** `Surface sync failure reasons in the header`
  - **範圍**：`src/hooks/useTrip.js`、`src/components/SyncStatusBadge.jsx`、`src/components/SyncReasonNote.jsx`（新增）、`src/components/Header.jsx`、`src/App.jsx`
  - **前置**：F8（已在 main）
  - **涵蓋**：**F-77**
  - **說明**：`useTrip` 新增 `syncReason`（來源即 `pushRemote` 拋出的 `validateTrip.reason`，`e.message` 直接可用，不需新通道）；C-12 文案改「失敗·看原因」、點擊改為展開；C-28 沿用 OfflineBanner 的位置與樣式（兩者互斥），`role="alert"`，依 reason 給文案與動作鈕（含 P3 定義的「App 版本過舊」→［重新整理］），**未知 reason 原樣顯示不吞掉**。
  - **測試**：人工（構造超過 1MB 的 trip → 徽章顯示「失敗·看原因」→ 展開顯示「這份行程超過 1MB 上限…」；
    以舊 bundle 開 v5 資料 → 顯示「App 版本過舊」＋［重新整理］可用）

---

## 跨分支衝突檢查

| 檢查項目 | 結果 |
|---|---|
| API endpoint 覆蓋 | ✅ 前端唯一新增的呼叫 `parsePost()`（F3/F6/F6b）對應後端 B1；無幽靈、無孤兒（cross-check §1）|
| DTO 型別對齊 | ✅ `ParsePostRequest`（**含 `images[]`**）/ `ParsePostOk` / `ParsedPlace` / `category` enum / `Platform` enum 已於 cross-check §2 逐欄對齊 |
| 未設計元件 | ✅ 依賴皆為後向：F4/F5/F6 →（F6b 疊在 F6 上）→ F7（組裝）→ F8（掛進 shell）。任何 commit 都不呼叫尚未實作的元件 |
| 循環依賴 | ✅ 線性 DAG：`P1→P2→P3` ⇒ `F1→F2→F3→{F4,F5,F6→F6b}→F7→F8` ⇒ `{F9,F10}`；`B1`、`B2` 獨立 |
| **Commit 數量** | ✅ Phase 0：3；Backend：2；Frontend：**9（上限 10，留 1 個餘裕）**；Polish：2 |
| 版號閘門 | ⛔ 已明列：Phase 0 上線 + 傳播確認完成，才可合併 F1 |
| 分支歸位 | ✅ 四支分支驗收後都必須 merge 回 `main`，不得長期漂流 |
| **F6b 是否可獨立 review** | ✅ F6 交付「能用的一般模式面板」、F6b 疊上「分流 + 截圖」。兩者都是可讀的 diff，且 F6b 的 diff 幾乎全是新增（`order` class、ShotPicker、`toImages`），不會把 F6 的邏輯改得面目全非 |

### 關於 commit 額度的說明

- **Frontend 從 10 降到 9**，多出的 1 個額度是刻意保留的：F6b 是本版最容易在實作中膨脹的 commit
  （分流 + 新元件 + 上傳管線），若實作中發現 C-30 需要獨立成一個 commit，還有空間。
- **仍然建議的合併候選**（若又超標）：`F4 + F5`（兩者都是「對單一 place 操作的底部面板」，可併成 `Add the place sheets`）。
- **不建議**再把 F9／F10 塞回 frontend —— 那正是本次要解決的問題。

**任一情況都必須先回寫本計畫再動手，不得默默追加 commit。**

### 與 PRD §8 的對照

| PRD | 本計畫 | 差異說明 |
|---|---|---|
| P1 `Preserve unknown fields through schema migration` | **P1 + P2 + P3** | PRD v3.5 §2.3 已補上 `merge.js` 的第二處破口（原 Q-01），故拆成三個 commit |
| P2 `Add pockets and places to schema version 5` | F1 | 一致 |
| P3 `Add stamped mutators…` | F2 | 一致 |
| P4 `Add post parsing endpoint` | B1 | 一致（PRD 把 `src/lib/api.js` 併在 P4；本計畫依「前後端分離分支」規範把它移到前端 F3）|
| P5 `Add screenshot preset to image compression` | 併入 F3 | 只有兩個常數，單獨成 commit 不合比例；併入同屬「ingest 支援層」的 F3 |
| P6 `Add Pocket view with paste ingest` | **F6 + F6b + F7** | PRD 的 P6 一個 commit 涵蓋 5 個新檔案 + F-70/71/72/76/78，違反單一職責。**v3.1 又追加了平台分流、C-30、多圖上傳**，故拆成「收藏面板骨架」「分流 + 多圖截圖」「口袋頁外殼」三個 |
| P7 `Add Pocket tab to app shell` | F8（+ F-83）| PRD 的 P9 含 F-83；本計畫把 `?share=` 併入 F8（同一個檔案 `App.jsx`）|
| P8 `Add place detail sheet and suggested day picker` | **F4 + F5** | 拆成兩個 commit；C-29 Toast 併入 F5 |
| P9 `Add iOS shortcut share entry` | **F9（移至 polish 分支）** | 僅 F-81；F-83 已移至 F8。移出理由見「為什麼要開第四支分支」|
| P10 `Surface sync validation errors in the header` | **F10（移至 polish 分支）** | 一致，僅換分支 |

---

## 規劃完成後摘要

```
## Commit Plan 規劃完成（v3.1 同步後）

📁 計畫檔案：03-DesignDocs/commits-plan-v3.md

### 分支
- Phase 0：feature/schema-forward-compat（3 commits）⛔ 必須單獨上線並等待傳播
- Backend：feature/pocket-parse-backend（2 commits）
- Frontend：feature/pocket-places-frontend（9 commits）
- Frontend 收尾：feature/pocket-places-polish（2 commits，frontend 合併後才開）

### Phase 0 Commits 預覽
P1 → P2 → P3

### Backend Commits 預覽
B1 → B2

### Frontend Commits 預覽
F1 → F2 → F3 → {F4, F5, F6 → F6b} → F7 → F8
Polish：F9、F10

### ⚠️ 注意事項
1. ⛔ F1 升版號前，Phase 0 必須已上線且確認所有裝置載入新 bundle。
2. F6b 的 data URL 前綴那一行漏掉不會報錯，B1 的驗證必須用真的圖跑一次。
3. F6b 完成後必須跑 T-99（真實 IG 截圖實測 OCR 參數），結論回寫 PRD §7.5。
4. F4 動到 ConfirmSheet，但既有 4 個呼叫點一行都不該改；diff 動到呼叫端就是做錯了。
5. 待裁定 Q-07 / Q-09 / Q-11 皆為低嚴重度，已有暫定處理，不擋實作。

---
請確認計畫後回覆「開始實作」，並指定先做 Phase 0 / 後端 / 前端。
```
