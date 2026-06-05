# 前後端交叉比對報告 — 櫻旅 v2

> 建立時間：2026-06-05 ｜ 比對對象：[frontend/app-v2.md](frontend/app-v2.md) ↔ [backend/sync-and-apis.md](backend/sync-and-apis.md) ↔ [PRD](../01-PRD/PRD.md)

## 1. API 覆蓋檢查（無幽靈 / 無孤兒）

| 前端呼叫（lib/api.js） | 後端是否提供 | 狀態 |
|----------------------|-------------|------|
| `GET /api/flight?no&date` | ✅ backend §6.1（沿用 v1，更新模型字串）| ✅ 對齊 |
| `GET /api/rate?from&to` | ✅ backend §6.2（新增）| ✅ 對齊 |
| Supabase `trips` select/upsert + Realtime | ✅ backend §4.1 | ✅ 對齊 |

- **幽靈 API（前端要、後端無）**：無。
- **孤兒 API（後端有、前端不用）**：無。

## 2. 型別 / DTO 對齊檢查

| 契約 | 前端 | 後端 | 狀態 |
|------|------|------|------|
| `FlightLookupDto {from,to,depTime,arrTime}` | api.js 解析 | §6.1 | ✅ |
| `RateDto {from,to,rate,asOf}` | SettingView 套 `rate` | §6.2 | ✅ |
| `TripData`（v2 jsonb 結構）| frontend §所有 view | backend §4.2 | ✅ 同一份 interface |
| `Scalar<T>` / `Mergeable` | lib/merge 消費 | backend §4.2 定義 | ✅ |
| 合併規則 | lib/merge.js 實作 | backend §5.2 契約 | ✅ 契約唯一來源在後端文件 |
| 遷移規則 | lib/migrate.js 實作 | backend §5.3 契約 | ✅ |

## 3. 錯誤碼雙向覆蓋

| 情境 | 後端回傳 | 前端處理 | 狀態 |
|------|----------|----------|------|
| 航班缺參數 | 400 MISSING_PARAMS | lookup 前已擋（必填）| ✅ |
| 航班無金鑰 | 200 `{error:"no key"}` | 提示手動填 | ✅ |
| 航班查詢失敗 | 500 `{error:"lookup failed"}` | fallback 手動填 | ✅ |
| 匯率上游失敗 | 200 `{error:"unavailable"}` | 維持手動匯率 | ✅ |
| 同步上推失敗 | Supabase error | syncState=failed + 重試鈕（F-04）| ✅ |
| jsonb 超限 | 前端先擋（F-07）| 提示精簡、不上推 | ✅ |

## 4. 功能 ↔ 元件 ↔ 契約 追溯

| PRD | UI 元件 | 前端模組 | 後端契約 | 狀態 |
|-----|---------|----------|----------|------|
| F-01 key 持久化 | — | lib/tripKey.js | — | ✅ |
| F-02 offline-first | C-17 | lib/db.js, sync.js | trips 表 | ✅ |
| F-03 欄位級合併 | F-03 高亮 | lib/merge.js | §5.2 | ✅ |
| F-04 同步狀態 | C-12 | useTrip.syncState | — | ✅ |
| F-05 不打斷輸入 | — | sync.activeField | — | ✅ |
| F-06 強 key | — | lib/tripKey.js | §4.1 註 | ✅ |
| F-07 寫入驗證 | — | lib/schema.js | §7 | ✅ |
| F-12 拖曳排序 | C-15, C-07/08 | DayCard onReorder | DayItem.order §4.2 | ✅ |
| F-13 航班 | C-06 | api.js | §6.1 | ✅ |
| F-22 分類 | C-10 | ExpenseForm | Expense.category §4.2 | ✅ |
| F-23 預算 | C-13 | BudgetBar | budgetJPY §4.2 | ✅ |
| F-24 分類統計 | C-14 | CategoryStats | — (前端聚合) | ✅ |
| F-25 即時匯率 | rateBtn | api.js | §6.2 | ✅ |
| F-31 打包清單 | C-09 packing | ChecklistCard | packing[] §4.2 | ✅ |
| F-60 拆檔 | 附錄 | views/components/lib | — | ✅ |
| F-61 Tailwind 建置 | — | 建置設定 | — | ✅ |
| F-62 測試 | — | merge/migrate/結算 test | — | ✅ |

## 5. 發現的問題與調整

| # | 問題 | 結論 |
|---|------|------|
| 1 | F-24 分類統計無對應後端 API | **非問題**：統計為前端對 `expenses` 即時聚合，無需後端。已標註。 |
| 2 | 合併/遷移邏輯「執行在前端」卻寫在後端文件 | **刻意**：它是多客戶端共用契約，集中於後端文件管轄、前端 lib 實作，cross-check 已對齊。 |
| 3 | RLS 仍全開 | **已知接受**：PRD 決策維持匿名 + 強 key；Phase 2 再評估加固。非本版阻斷項。 |

## 6. 結論

✅ **無幽靈 API、無孤兒 API、型別與錯誤碼前後端雙向對齊、PRD 功能全數可追溯。**
設計文件階段交叉比對通過，建議簽核後進入 commits 規劃。
