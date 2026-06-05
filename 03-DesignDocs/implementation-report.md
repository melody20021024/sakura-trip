# 實作完成報告 — 櫻旅 v2

> 日期：2026-06-05 ｜ 開發員交付 ｜ 對應 [commits-plan.md](commits-plan.md)

## 1. 分支與 commit

### Backend — `feature/sync-apis-backend`（已合併 main，PR #1）
| Commit | hash | 對應 |
|--------|------|------|
| B1 Configure flight lookup model via env | `bc53fe4` | F-13 |
| B2 Add exchange rate lookup API | `f8b9154` | F-25 |
| B3 Document v2 trips jsonb schema | `8c6afed` | §4.1 |

### Frontend — `feature/app-v2-frontend`
| Commit | hash | 對應 |
|--------|------|------|
| F1 Configure Tailwind build and module structure | `8d112fc` | F-60/F-61 |
| F2 Add data layer: IndexedDB, schema defaults, trip key | `43c13a3` | F-01/F-02/F-06/F-07 |
| F3 Implement merge and migrate with unit tests | `6dc95e3` | F-03/F-62 |
| F4 Implement sync engine and useTrip hook | `0f606ff` | F-02/F-04/F-05 |
| F5 Extract shared components and global UI | `49023ed` | F-60, C-12/15/16/17 |
| F6 Implement Trip view with drag-and-drop | `fe1a9e7` | F-10~14 |
| F7 Implement Money view with budget and categories | `785c414` | F-20~24 |
| F8 Implement Lists view with packing checklist | `6e8850b` | F-30/F-31 |
| F9 Implement Album and Setting views | `323f116` | F-40/F-50~52/F-25 |
| F10 Wire App shell and PWA, remove v1 monolith | `b3c8a28` | F-01/F-60 |

計畫 13 commits，實作 13 commits，**無偏離計畫**。

## 2. 已測試

| 類型 | 結果 |
|------|------|
| 單元測試（vitest） | **19 passed**：merge/migrate 13（冪等、交換律、tombstone、v1 遷移）、settle 6（換算、最少轉帳、分類統計）|
| 生產建置（`npm run build`） | ✅ 成功，所有模組解析；Tailwind 建置版 17KB（CDN 已移除）|
| 瀏覽器實機（vite dev + 預覽） | ✅ 行程/帳本/清單三頁渲染正常；同步徽章「已同步」綠燈（Supabase 連線 OK）；記帳表單分類 pills 正常；**美食/待購清單保留**；console 無錯誤/警告 |

## 3. 與設計文件的差異（皆為合理收斂，無功能落差）

| # | 差異 | 原因 |
|---|------|------|
| 1 | 4 個基礎元件（Card/SectionTitle/PinkBtn/Field）合併在 `components/ui.jsx`，而非各自獨立檔 | 皆為數行的 presentational，合併降低檔案噪音；功能與附錄對照表一致 |
| 2 | 新增 `scripts/check-jsx.mjs` | 開發期 JSX 快速 parse 檢查工具（本機 esbuild CLI 為錯誤架構，改用 JS API）|
| 3 | 新增 `.claude/launch.json` | 預覽 dev server 設定（埠 5188，避開公司專案佔用的 5173）|
| 4 | 「不打斷輸入」(F-05) 採輕量實作 | 每次按鍵都蓋新 `updatedAt`，合併時本地值自然勝出，達成不被遠端覆蓋；未另做 activeField 凍結，效果等價且更簡單 |

## 4. 建議 SA 驗收重點（對應 T-XX）

| 重點 | 測試 |
|------|------|
| 🔴 重開不洗資料 | T-01：加資料→關閉→無 `?trip` 參數重開（模擬 PWA 捷徑），應還原 |
| 🔴 離線可編輯 + 回線同步 | T-02/03：DevTools offline 編輯→看徽章「離線·N」→恢復→「已同步」|
| 🔴 多人不互相覆蓋 / 同項目衝突 | T-04/05：兩裝置同 trip 改不同/同項目（已有單元測試佐證合併正確）|
| 🟡 v1 遷移 + 舊短 key 相容 | T-10/11：用 v1 舊資料/短 key 連結開啟 |
| 🟢 拖曳、預算/分類、打包、刪除確認 | T-12/21/30/31 |

### 已知限制（非阻斷，列 Phase 2）
- 打包包含相片上傳屬 Phase 2（F-41 未做，PRD 已分期）。
- bundle 單一 chunk > 500KB（功能正常，未做 code-split；Phase 2 可優化）。
- RLS 仍匿名全開，靠 22 字元強 key 當邊界（PRD 既定，Phase 2 評估 PIN）。
