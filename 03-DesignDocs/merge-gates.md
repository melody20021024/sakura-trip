# 合併閘門清單（程式審查員必讀）

> 每一支分支合併回 `main` **之前**，程式審查員必須逐條走過本檔。
> `main` 已連 Vercel，**合併即自動部署到正式站** —— 合併不是內部動作，是對外發布。

## 閘門分類

| 類型 | 定義 | 審查員的處理 |
|------|------|-------------|
| **可檢查** | 條件能從 repo／git／建置產物讀出 | 自己驗證，通過即可合併 |
| **不可檢查** | 條件存在於現實世界，repo 裡沒有這個資訊 | **不得自行假定成立**；查下方確認紀錄，沒有紀錄就停下來問 CEO |

---

## G-01 🔴 Schema 版號閘門（v3 口袋地點）

**規則**：任何會把 `SCHEMA_VERSION` 從 4 改為 5 的分支（`feature/pocket-places-frontend` 的 F1），
必須在下列**全部**條件成立後才可合併。

| # | 條件 | 類型 | 怎麼檢查 |
|---|------|------|---------|
| a | 兩處修正的**程式碼**已在 `main` | **可檢查** | **查程式碼，不查 commit 訊息**（squash 合併會把訊息收合，原本寫的兩條 grep 實測命中 0 筆 —— 2026-09-03 由程式審查員指出並修正）：<br>`git show main:src/lib/merge.js \| grep -c KNOWN_TRIP_KEYS` → 應 ≥ 1<br>`git show main:src/lib/migrate.js \| grep -c '\.\.\.raw'` → 應 ≥ 1<br>`git show main:src/lib/schema.js \| grep -c '版本過舊'` → 應 ≥ 1 |
| b | 該修正已實際部署到正式站 | **可檢查** | `git log main -1 --format=%ci -- src/lib/merge.js` 取得該檔最後一次進 main 的時間；Vercel 上對應 deployment 為 Ready |
| c | **所有裝置（CEO 本人 + 旅伴）皆已重新整理、載入含該修正的新 bundle** | ⚠ **不可檢查** | repo 裡沒有這個資訊。見下方「確認紀錄」 |

**為什麼**：`vite-plugin-pwa` 用 `registerType: "autoUpdate"`，舊 bundle 在使用者重新整理前可能存活數分鐘到數天。
在條件 c 成立前升版號，會重現 PRD §2.2 的**雲端層級、不可復原**資料遺失。

**條件 c 的確認紀錄**（由 CEO 填寫，審查員只讀不寫）：

```
狀態：未確認
確認日期：
確認方式：
```

> 審查員注意：上方狀態為「未確認」時，**不得合併任何升版號的分支**。
> 這不是保守，是資訊不存在 —— 你無法從程式碼觀測到旅伴的手機有沒有重新整理。
> 授權合併不等於授權猜測。

**不受 G-01 限制的分支**（可自由合併）：

- `feature/schema-forward-compat` 本身
- `feature/pocket-parse-backend`（只新增 `api/`，不碰 `src/lib/schema.js`）
- 任何不改動 `SCHEMA_VERSION` 的分支

**審查員的快速判定**（2026-09-03 修正）：不要 grep diff —— `validateTrip` 只是**比較** `SCHEMA_VERSION`
也會命中，PR #15 就誤觸發過。改為直接比對**常數的值**有沒有變：

```sh
git show main:src/lib/schema.js      | grep -E '^export const SCHEMA_VERSION'
git show <branch>:src/lib/schema.js  | grep -E '^export const SCHEMA_VERSION'
```

兩行不同才套用 G-01。相同就不套用，不論 diff 裡出現多少次 `SCHEMA_VERSION`。

---

## G-02 🟠 資料層改動需附回歸測試

**規則**：任何改動 `src/lib/merge.js`、`migrate.js`、`schema.js`、`sync.js`、`hooks/useTrip.js` 的分支，
必須附帶對應的回歸測試，且測試必須**實際被執行**。

| 類型 | 怎麼檢查 |
|------|---------|
| 可檢查 | `npx vitest run` 的輸出中，測試檔案數與測試數是否涵蓋新增的檔案。**特別注意 `vitest.config.js` 的 `include` 範圍** —— 沒涵蓋到的目錄，測試會被靜默跳過卻顯示全綠 |

**背景**：v2 的 SA 驗收留下的教訓 —— 單元測試全綠是假信心，要測「同天並發欄位」「離線回線」「in-flight 編輯」。

---

## G-03 🟡 前端 bundle 大小

**規則**：任何新增 `dependencies` 的分支，必須確認前端 bundle 沒有意外增長。

| 類型 | 怎麼檢查 |
|------|---------|
| 可檢查 | `npm run build`，比對 `precache N entries (X KiB)`。基準：**569.99 KiB**（2026-09-02，加入 `@anthropic-ai/sdk` 之前）。serverless-only 的套件不應讓這個數字變大 |

SA 已指出 bundle 是單一 chunk 且超過 Vite 500KB 警告線；code-split 排在 Phase 1.5 的 M8。

---

## 修改本檔的規則

- **程式審查員只讀不寫。**
- 新增閘門由技術總監在 PRD 定案後寫入。
- 確認紀錄由 CEO 填寫。
