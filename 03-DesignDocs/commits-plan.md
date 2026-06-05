# Commit Plan: 櫻旅 v2（offline-first 共編 + 帳本升級 + 拖曳 + 打包清單）

> 建立時間：2026-06-05 ｜ 狀態：待確認

## 分支規劃

| 端 | 分支名稱 | Commits |
|----|----------|---------|
| Backend | `feature/sync-apis-backend` | 3 |
| Frontend | `feature/app-v2-frontend` | 10 |

> 說明：本專案後端僅 Vercel serverless（`/api`）+ Supabase 資料契約，故 backend 分支精簡；主體重構在 frontend 分支。合併/遷移雖是前端 lib，但其**契約**由 backend 文件管轄，實作 commit 落在 frontend（F3）。

## ⚠️ 跨分支注意事項

> 前後端需同步對齊的關鍵 contract：

- **航班 DTO**：frontend `lib/api.js` 解析 `{from,to,depTime,arrTime}` 必須對齊 backend B1 的回傳格式（沿用 v1，不變）。
- **匯率 DTO**：frontend SettingView 套用 `{from,to,rate,asOf}` 必須對齊 backend B2。frontend F9 依賴 backend B2 完成；若先做前端，先以 mock 回傳開發，B2 完成後驗證。
- **trips jsonb 結構**：backend B3（schema 註解）與 frontend F2/F3 的 `TripData` interface 為同一份（backend §4.2 為準）。
- **建議實作順序**：先 **Backend**（3 個小 commit，解鎖 API 契約）→ 再 **Frontend**。

---

## Backend — `feature/sync-apis-backend`

- [ ] **B1** `Configure flight lookup model via env`
  - **範圍**：`api/flight.js`
  - **說明**：把寫死的 `claude-sonnet-4-20250514` 改為 `process.env.FLIGHT_MODEL`（預設現役模型），其餘沿用。修 PRD F-13 模型過期。

- [ ] **B2** `Add exchange rate lookup API`
  - **範圍**：`api/rate.js`（新增）
  - **前置**：無
  - **說明**：新增 `GET /api/rate?from&to`，呼叫免費匯率 API（無金鑰端點），回傳 `RateDto`；失敗回 `{error:"unavailable"}`。對應 F-25。

- [ ] **B3** `Document v2 trips jsonb schema`
  - **範圍**：`supabase-schema.sql`
  - **前置**：無
  - **說明**：表結構不變，補上 v2 `data` 可合併結構與強 key 的註解說明（不含 DDL 變更，降 migration 風險）。

---

## Frontend — `feature/app-v2-frontend`

- [ ] **F1** `Configure Tailwind build and module structure`
  - **範圍**：`tailwind.config.js`, `postcss.config.js`, `src/index.css`, `index.html`, `src/views/`, `src/components/`, `src/lib/`, `src/hooks/`（建資料夾）
  - **說明**：移除 Tailwind CDN 改建置版（F-61），建立 F-60 目錄骨架。此 commit 後畫面樣式應與 v1 等價。

- [ ] **F2** `Add data layer: IndexedDB, schema defaults, trip key`
  - **範圍**：`src/lib/db.js`, `src/lib/schema.js`, `src/lib/tripKey.js`
  - **前置**：F1
  - **說明**：Dexie 封裝（F-02）；預設值與大小/欄位驗證（F-07）；三段式 key 持久化 + 22 字元強 key（F-01/F-06）。

- [ ] **F3** `Implement merge and migrate with unit tests`
  - **範圍**：`src/lib/merge.js`, `src/lib/migrate.js`, `src/lib/__tests__/merge.test.js`, `vitest.config.js`
  - **前置**：F2
  - **說明**：欄位級 LWW + tombstone 合併、v1→v2 冪等遷移（契約 backend §5.2/5.3），含單元測試（F-03/F-62）。⚠ 高風險邏輯，測試先行。

- [ ] **F4** `Implement sync engine and useTrip hook`
  - **範圍**：`src/lib/sync.js`, `src/lib/api.js`, `src/hooks/useTrip.js`
  - **前置**：F3
  - **說明**：佇列 + debounce upsert + 指數退避重試 + Realtime 合併 + 離線偵測 + 不打斷輸入（F-02/04/05）；api.js 封裝 flight/rate。

- [ ] **F5** `Extract shared components and global UI`
  - **範圍**：`src/components/`（Card, SectionTitle, PinkBtn, Field, Header, BottomNav, SyncStatusBadge, OfflineBanner, DragHandle, ConfirmSheet）, `src/hooks/useConfirm.js`
  - **前置**：F4
  - **說明**：拆出共用元件（F-60）+ 同步徽章 C-12、離線條 C-17、刪除確認 C-16、拖曳把手 C-15。

- [ ] **F6** `Implement Trip view with drag-and-drop`
  - **範圍**：`src/views/trip/`（TripView, FlightCard, DayCard, ItemRow, ItemForm）, 安裝 `@dnd-kit/*`
  - **前置**：F5, （契約）B1
  - **說明**：行程頁（F-10~14）；日內項目拖曳排序 + order 寫入（F-12/DDR-04）；刪除走 ConfirmSheet。

- [ ] **F7** `Implement Money view with budget and categories`
  - **範圍**：`src/views/money/`（MoneyView, BudgetBar, CategoryStats, ExpenseForm）, `src/lib/__tests__/settle.test.js`
  - **前置**：F5
  - **說明**：記帳分類（F-22）、預算進度條（F-23）、分類統計（F-24）；結算演算法抽出 + 單元測試（F-21/F-62）。

- [ ] **F8** `Implement Lists view with packing checklist`
  - **範圍**：`src/views/lists/`（ListsView, ChecklistCard）
  - **前置**：F5
  - **說明**：食/購（F-30 沿用）+ 打包清單第三卡含帶入範本（F-31/DDR-08）。

- [ ] **F9** `Implement Album and Setting views`
  - **範圍**：`src/views/album/AlbumView.jsx`, `src/views/setting/SettingView.jsx`
  - **前置**：F5, （契約）B2
  - **說明**：相簿沿用 v1（F-40）；設定頁加總預算輸入（F-52）+ 查即時匯率按鈕（F-25，依賴 B2）。

- [ ] **F10** `Wire App shell and PWA, remove v1 monolith`
  - **範圍**：`src/App.jsx`（重寫為框架）, `vite.config.js`（manifest start_url）, 移除 v1 巨檔殘留
  - **前置**：F6, F7, F8, F9
  - **說明**：組裝 5 tab + Header（掛 useTrip/syncState）；PWA manifest 對齊 F-01；端到端整合。

---

## 跨分支衝突檢查

| 檢查項目 | 結果 |
|----------|------|
| API endpoint 覆蓋 | ✅ F6→B1、F9→B2，皆有對應後端 commit |
| DTO 型別對齊 | ✅ flight/rate/TripData 已於 cross-check 對齊 |
| 未設計元件 | ✅ F6~F9 皆在 F5（共用元件）之後，無呼叫未實作元件 |
| 循環依賴 | ✅ 依賴為線性 DAG：F1→F2→F3→F4→F5→{F6,F7,F8,F9}→F10 |
| Commit 數量 | ✅ Backend 3、Frontend 10，皆未超過 10 上限 |
