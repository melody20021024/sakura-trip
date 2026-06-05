# SA 驗收報告（第二輪）
> 驗收日期：2026-06-05 ｜ 專案：櫻旅 Sakura Trip v2 ｜ SA：AI System Analyst
> 方法：獨立 Reviewer agent 複驗第一輪 14 項findings + 新程式回歸檢查 + 第三輪確認回歸修正

## 摘要

| 項目 | 數值 |
|------|------|
| 第一輪問題 | 3 高 / 6 中 / 5 低 |
| 本輪複驗：第一輪高嚴重度 | **3/3 已修** |
| 本輪複驗：第一輪中嚴重度 | 6/6 已修 |
| 修正過程**新引入**問題 | 1 高 + 1 中（已於第三輪修復）|
| 第三輪最終剩餘 | **0 高 / 0 中 / 0 低** |
| 建置 / 測試 | ✅ build 成功；✅ 25/25 測試通過 |
| **整體驗收結論** | **通過** |

---

## 第一輪 findings 複驗

| 編號 | 問題 | 狀態 | 證據 |
|------|------|------|------|
| 高-1 | 同天 city/lodging 合併資料遺失 | ✅ 已修 | `merge.js` mergeDays 逐欄 `pick`；city/lodging 改可合併純量（schema/migrate/DayCard/TripView/useTrip 全鏈一致）；回歸測試 order-independent |
| 高-2 | F-05 編輯中欄位被覆蓋 | ✅ 已修 | `useTrip.applyRemote` 以 `activeField` 保留 focus 欄位，realtime 與 push-adopt 兩路皆走；DayCard/SettingView 已接 onFocus/onBlur |
| 高-3 | 離線回線盲蓋對方寫入 | ✅ 已修 | `sync.pushRemote` 改 read-merge-write + CAS（`.eq('updated_at')`）+ 重試；doPush 採用回傳 merged |
| 中-1 | tie-break 非決定性 | ✅ 已修 | `pick`：tombstone-wins → stable 排序鍵序列化，跨端一致 |
| 中-2 | pending 計數不準 | ✅ 已修 | 改由 seq/pushedSeq 計數器推導 |
| 中-3 | 並發推送 | ✅ 已修 | `pushing`/`pushAgain` 單航班守衛 |
| 中-4 | timer 洩漏 | ✅ 已修 | retryTimer 追蹤清除 + unmount cleanup |
| 中-5 | 無樂觀鎖 | ✅ 已修 | CAS（同高-3）|
| 中-6 | validateTrip 未檢查 item id | ✅ 已修 | `validateTrip` 新增 LIST_FIELDS 陣列 + string id 檢查 |
| 低-1~5 | 命名/模型字串等 | 部分保留 | 低-1（可覆蓋 id）、低-2（flight 模型字串）列技術債，不阻斷 |

---

## 修正過程新引入問題（第二輪發現 → 第三輪已修）

| 編號 | 問題 | 結果 |
|------|------|------|
| 高-NEW-1 | `doPush` 採用 push 快照 `applyRemote(merged)`，會丟棄推送進行中提交的編輯 | ✅ 已修：改 `applyRemote(mergeTrip(dataRef.current, merged))` 對當前本地重併；加回歸測試 |
| 中-NEW-1 | `ItemRow` 收到 city 純量物件 → 地圖查詢變 `[object Object]` | ✅ 已修：`DayCard` 傳 `day.city?.v` |

第三輪獨立複驗：兩者皆 FIXED，且未引入新問題；全 src 掃描無其他把 city/lodging 物件當字串的讀取點；`freshDefault()` 通過 `validateTrip`（新建行程推送路徑無誤判）。

---

## 三層檢查結論

- **第一層 規格對齊**：F-01~62 全實作；T-01~T-31 對應的高風險項（重開/離線/多人/不打斷輸入）經修正後通過。
- **第二層 設計對齊**：合併/同步實作已回到 backend §5.2 契約（id 字典序 tie-break、欄位級合併、樂觀鎖）。
- **第三層 維護性**：sync 引擎單航班、timer 清理、計數正確；validateTrip 強化；25 單元測試涵蓋合併冪等/交換律/tombstone/遷移/同天並發/離線回線/in-flight 編輯/結算。

## 優化建議（非必改）
- bundle 單 chunk 555KB > Vite 500KB 警告 → code-split / manualChunks（Phase 2）。
- 低-1 stamped mutator `{ ...item, id, updatedAt }` 順序、低-2 flight 模型字串 → 技術債。
- `useTrip` 仍無 React 層測試（合併已以純函式覆蓋）；未來可加 hook 測試。

## 驗收結論

**結論：通過**

**理由**：第一輪 3 高 + 6 中全數修復；修正引入的 1 高 1 中已於第三輪修復；最終 0 高 / 0 中 / 0 低，建置與 25 測試全綠。依團隊標準（0 高 + 中 ≤ 3）→ 通過。

**後續行動**：
1. 可合併 PR #2 至 main。
2. Phase 2：相片上傳（Storage）、PIN 保護評估、bundle code-split、低-1/低-2 技術債。
