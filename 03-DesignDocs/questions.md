# 待釐清問題 — 櫻旅 v3「口袋地點」

> 依 `_workflow/roles/engineer.md`「何時向上游回報」：以下**已在程式碼中做了選擇，但與 PRD 不一致**，
> 不默默改、不默默留。請技術總監裁定；裁定後由技術總監回寫 PRD，開發員回寫設計文件。
>
> Q-01 ～ Q-11 均已於 PRD v3.5／v3.7 裁定，紀錄留在 [cross-check-v3.md](cross-check-v3.md) §6。<br>
> **Q-12／Q-13 已於 PRD v3.10 裁定**（2026-09-04 補記結果）。**待裁定：Q-14（🔴 上線阻擋）、Q-15。**

---

## Q-12 ✅ **已裁定（PRD v3.10 §7.5c，採納 ①）** — `max_tokens` 2048 與「12 筆地點」的最壞情況不相容

| 項目 | 內容 |
|------|------|
| **對應章節** | PRD §7.5c 末句、§7.3；backend/parse-and-schema-v3.md §6.3 |
| **PRD 現行規定** | 「強制 tool-use 在 `claude-haiku-4-5` 上不受多圖影響；`max_tokens` **維持 2048 即可**（多圖增加的是 input）。」 |
| **問題** | 括號裡的理由正確，但它量的是錯的那一軸。輸出的上界不是圖片張數，而是 §7.3 schema 允許的 **12 筆地點 × (`name` 60 字 + `nameJa` 60 字 + `area` 40 字 + `note` 60 字)**。以繁中／日文計，滿載一筆約 250–400 output tokens，12 筆約 **3–4k**，落在 2048 之上。 |
| **為什麼會靜默失敗** | 被 `max_tokens` 截斷時，Anthropic 仍回一個 `tool_use` block，其 `input` 是個**看起來完整的物件**。`clampPlaces` 照收，端點回 `ok:true`，使用者只會發現「店比貼文裡少」，而 log 裡沒有任何線索。**正是本專案 §7.5c 想避免的那種「使用者以為店掉了」。** |
| **已採取的處置** | 分支 `fix/parse-post-review` 已把 `max_tokens` 改為 **4096**，並在 `stop_reason === "max_tokens"` 時 `console.warn`。輸出 token 只在真的產生時計費，因此餘裕不增加成本；12 筆滿載的實際成本增幅約 USD $0.01 以下／次，仍在 PRD §6.1 每月 $1 的上限內。 |
| **請裁定** | ① **採納**（建議）：PRD §7.5c 末句改為「`max_tokens: 4096`，並檢查 `stop_reason`」。<br>② **維持 2048**：則需在 §7.3 把 `note` 由 60 字下修，或把 `maxItems` 由 12 下修，否則最壞情況仍會被截斷。<br>③ 折衷：維持 2048 但保留 `stop_reason` 警示，接受滿載時截斷。 |
| **成本評估** | ①：0（已實作）。②：需改 schema 並重跑 T-78。③：0，但把已知缺陷留在正式站。 |
| **裁定結果**（2026-09-04 補記）| 技術總監於 **PRD v3.10 §7.5c** 採納 ①：`max_tokens: 4096` + `stop_reason === "max_tokens"` 記 log。實作（`api/parse-post.js`）本就如此。**設計文件 §6.3 的 pseudo-code 直到 2026-09-04 才跟上** —— v3.2.0 回寫時把說明段改對了，卻漏掉同一節那段給人照抄的骨架，於是文件裡 2048 與 4096 並存了一天。 |

---

## Q-13 ✅ **已裁定（PRD v3.10 §7.1／§7.4，採納 ①）** — `reason: "not_configured"` 未列於 PRD §7.1 的錯誤碼清單

| 項目 | 內容 |
|------|------|
| **對應章節** | PRD §7.1 契約的 `reason` 列舉 |
| **問題** | PRD §7.1 列出 `need_text_or_image` / `no_places` / `too_large` / `rate_limited` 四個。實作另有 **`bad_request`**（非 POST、缺 trip；PR #16 起就存在，PRD 未列）與本次新增的 **`not_configured`**（缺供應商金鑰）。 |
| **為什麼需要獨立的 reason** | 缺金鑰若沿用 `rate_limited`，永久性的部署故障會偽裝成暫時性負載——這正是 PR #17 審查抓到的問題型態。前端不需要新分支：`cross-check-v3.md` §3 既有「未知 reason → **原樣顯示，不吞掉**」的規則已涵蓋。 |
| **請裁定** | ① **把 `bad_request` 與 `not_configured` 補進 PRD §7.1 列舉**（建議，純文件動作）。<br>② 要求實作把兩者併入既有四個之一（**不建議**：會重新製造「不同故障長得一樣」的問題）。 |
| **成本評估** | ①：只改 PRD 一處。②：改實作 + 重跑端點測試，且降低可診斷性。 |
| **裁定結果**（2026-09-04 補記）| **PRD v3.10 §7.1** 已把 `bad_request` 與 `not_configured` 補進 `reason` 列舉，**§7.4** 另明訂「限流」與「trip key 不存在」必須逐字不可區分、且金鑰檢查須排在兩者**之後**。後續發現同一個病灶還有一處未清，見 **Q-15**。 |

---

## Q-14 🔴 `ANTHROPIC_API_KEY` 在 Vercel 上不存在 —— 這是上線阻擋項

| 項目 | 內容 |
|------|------|
| **對應章節** | PRD §7.4；backend/parse-and-schema-v3.md §6.1 環境變數表 |
| **事實** | 2026-09-03 查 Vercel 專案環境變數頁：只有 **`AERODATABOX_KEY`** 與 **`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`**。**沒有 `ANTHROPIC_API_KEY`，也沒有 `GEMINI_API_KEY`。** |
| **錯誤是怎麼進來的** | 設計文件 v3.1.0 的環境變數表寫「`ANTHROPIC_API_KEY` — v2 航班功能已設在 Vercel」，**把它和 `AERODATABOX_KEY` 搞混了**（`api/flight.js` 讀的是後者）。PRD §7.4「不需要新增任何環境變數」的結論**只對 Supabase 那一組成立**，被連帶誤讀成對供應商金鑰也成立。已回寫設計文件 §6.1／§7。 |
| **影響** | 目前部署上 `/api/parse-post` **必定失敗**。修正前它回 `rate_limited`「解析服務暫時不通」，看起來像暫時性問題；修正後回 `not_configured` 並在 log 點名變數。 |
| **需要 CEO 動手（repo 裡查不到、也無法從程式碼滿足）** | 在 Vercel 專案設定新增 **`ANTHROPIC_API_KEY`**（Production + Preview），或設 `PARSE_PROVIDER=gemini` 並新增 **`GEMINI_API_KEY`**（免費層，PRD §3.3 的零成本路徑）。<br>**這是 F-70／F-71 的上線前置條件**，不是可延後項。 |

---

## Q-15 🟡 `upstream_error` 未列於 PRD §7.1 的錯誤碼清單

| 項目 | 內容 |
|------|------|
| **對應章節** | PRD §7.1 契約的 `reason` 列舉；§7.4；backend/parse-and-schema-v3.md §6.5 |
| **問題** | Q-13 把「缺金鑰」從 `rate_limited` 拆出去之後，`rate_limited` **仍然一碼三用**：真的限流、trip key 不存在、**供應商呼叫失敗**（`catch`）。而且它配的是**兩句不同的文案** —— 前兩者「剛剛解析太多次了…」、第三者「解析服務暫時不通…」。同一個 reason 兩種語意兩句話，正是 Q-13 開單時要根除的型態。 |
| **已採取的處置** | 分支 `fix/doc-sync-and-error-codes` 已新增 **`reason: "upstream_error"`**，訊息沿用既有的「解析服務暫時不通,等一下再試。你貼的內容還留著。」。 |
| **為什麼只拆這一種** | 供應商呼叫發生在 **trip 檢查之後**（`api/parse-post.js`：限流 → `tripExists()` → 金鑰 → 供應商），不論 trip key 存不存在都到不了這個 `catch`，因此拆出來**不洩漏 trip key 存在性**。「限流」與「trip 不存在」兩者則是 PRD §7.4 的硬性要求，**必須繼續逐字不可區分**，不得比照辦理 —— 回歸測試（`parse-post.test.js`「trip 不存在與限流對外完全不可區分」）仍以 `toEqual` 斷言兩者的整個回應物件相等。 |
| **前端影響** | 無。`cross-check-v3.md` §3 既有「未知 reason → **原樣顯示，不吞掉**」的規則已涵蓋，不需新增分支；前端設計文件的 `failReason` union 已補上此值（純型別對齊）。 |
| **請裁定** | ① **把 `upstream_error` 補進 PRD §7.1 列舉**（建議，純文件動作，與 Q-13 ① 同型）。<br>② 要求實作退回沿用 `rate_limited`（**不建議**：會把剛拆開的一碼多用重新黏回去，且「等一下再試」對一個掛掉的上游是對的、對限流也是對的、對不存在的 trip key 是錯的）。 |
| **成本評估** | ①：只改 PRD 一處。②：改實作 + 刪兩個測試，且降低可診斷性。 |
| **備註** | 開發員**不修改 `01-PRD/`**，故此處只記錄，等技術總監回寫 PRD。 |
