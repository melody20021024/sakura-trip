# 櫻旅 Sakura Trip — v3「口袋地點」產品需求規格書（PRD 增修）

| 項目 | 內容 |
|------|------|
| 文件版本 | v3.9（增修，不取代 `PRD.md` v2.0）。**v3.9：T-99 實測完成 —— `OCR_MAX` 1024→1568、`OCR_QUALITY` 0.7→0.85、單張上限 1.4MB→4MB**，依據為 Haiku 4.5 屬 Standard tier（原生上限 1568px／1568 視覺 token）。**v3.8：降級階梯改為「有圖必先讀圖」**、補多圖 LLM 組裝規則與兩個靜默失敗陷阱、修好 §4.2 被切斷的表格與 §9 風險 #2 的改版殘留。**v3.7：截圖契約擴充為 `images[]`（上限 3 張）**，並裁定離線 IG 不在 MVP 解決、`detectPlatform` 落位 `lib/share.js`、新增 T-99 OCR 參數驗收。**v3.6：T-98 實機驗證推翻「貼文文字為 IG 主路徑」的假設，截圖升回 IG 主路徑，UI 改為依平台分流**。**v3.5 依設計文件階段回報修正 §2.3 遺漏的 `mergeTrip` 破口（Q-01，阻斷級）**，並補 Q-02~Q-06。v3.4 依 UI 設計階段回報修正 F-76 文案矛盾、補 F-72 同名規則與 F-78 commit 歸屬、修正 T-83 措辭、裁定 `nameJa` 唯讀。v3.2 改為 App 內原生地圖；v3.3 因 CEO 拍板：建議日期進 MVP、iOS 捷徑與貼上同一輪、地圖降為加分（見 §1.6）；v3.3.1 修正三處內部矛盾並補 T-98 |
| 撰寫角色 | 技術總監 |
| 撰寫日期 | 2026-09-01 |
| 前一版 | v2（已上線，SA 第二輪通過，Vercel 部署中）|
| 本版定位 | 補上櫻旅唯一的斷點：**靈感收集 → 知道排哪一天 → 行程**。地圖不是本版賣點 |
| 需求來源 | CEO 提供的示範影片（Aibo App），指定為「當初想做的功能」|
| 狀態 | **CEO 已拍板三項（§1.6）。待確認本版全文後進 UI 設計階段** |

---

## 1. 產品概覽

### 1.1 需求來源與核心洞察

CEO 提供的示範影片流程：

1. 在 IG Reels 滑到想收藏的貼文（例：「曼谷唐人街美食」）
2. 點分享（小飛機）→ 分享選單 → 送進 App
3. App **解析貼文**，抽出貼文提到的**地標清單**（縮圖／店名／類別／評分／儲存數）
4. 點進單一地點 → 店家詳情（地圖、營業時間、照片牆、AI 描述、其他提到這家店的貼文）
5. 所有收藏落在同一張城市地圖上 → 直接導航

**核心洞察**：影片那支 App 解的是「IG 存了一堆收藏，出國時找不到」。但它**沒有行程表** —— 收藏完就停在那裡。

櫻旅有行程表，卻**只能手動打字**建立行程項目（`ItemForm`）。也就是說：

> 影片的 App 有輸入端、沒有輸出端；櫻旅有輸出端、沒有輸入端。

本版要補的就是櫻旅缺的輸入端，並把兩端接起來成一條迴路：

```
社群貼文 → 收藏（貼上／捷徑）→ AI 解析成地點清單 → 建議排哪一天 → 寫入行程 → 單點導航
                                              ↑
                         這一段是櫻旅獨有，Aibo 做不到；也是本版的賣點
```

**不是路線規劃 App。** 「明白該怎麼安排行程和交通」在 MVP 的意思是：這家店該跟「福岡那天」而不是「由布院那天」。真正走路／搭車仍交給 Google 地圖（`openMap()`）。App 內滿城 pin、當日多點路線，降為加分（Phase 1.5）。

### 1.2 v3 價值主張

| # | 主張 | 現況痛點 → v3 解法 |
|---|------|-------------------|
| 1 | **看到就存，不用記** | 現況：滑到好店只能存 IG 收藏夾，出國前要重滑一次 → v3 貼上連結／貼文文字，或 IG 分享選單走 iOS 捷徑 |
| 2 | **存進來就是結構化資料** | 現況：IG 收藏是一堆看不出內容的縮圖 → v3 AI 拆成「店名＋區域＋類別＋為什麼值得去」|
| 3 | **知道排哪一天** | 現況：想排進行程要自己重打、自己判斷哪天在哪個城市 → v3 日期 chip 對上當天城市與地點區域，相符標「建議」|
| 4 | **到現場能導航** | 沿用既有 `openMap()`，零成本、零金鑰、零失敗率。地圖總覽不是本版賣點 |

### 1.3 本版技術取捨（CEO 已拍板）

| 決策項 | 選擇 | 理由與代價 |
|--------|------|-----------|
| 收藏入口 | **連結欄＋截圖＋貼文文字三者並存；IG 走截圖，其他平台走連結／文字**（v3.6，T-98 實測後修正）| iOS Safari PWA **不支援 Web Share Target**。捷徑（F-81）讓分享選單出現「存到櫻旅」，零後端，但只帶得到連結。**T-98 實測：IG caption 無法複製**，故 IG 的唯一內容路徑是截圖 |
| 地點資料補完 | **不接任何需要綁信用卡的 API** | 不用 Google Places。營業時間、評分、照片仍不做 |
| 地圖總覽 | **降為加分，不擋 MVP**（2026-09-01 下午 CEO 拍板）| 自動 geocode 命中率未實測，不得當賣點。MVP 用 `openMap()` 單點導航即可。原生地圖留在 Phase 1.5，見 §1.5、§1.6 |
| 安排行程 | **日期選擇＋區域建議，不做 App 內路線規劃** | 手機 Google 地圖路線上限 3 個中途點，無法撐起「交通規劃」。相符的天標「建議」才是最小可用解 |
| 交付步驟 | 先出 PRD 增修草案 | 依 ai-team 閘門制，確認方向後才進 UI 設計 |

### 1.4 與示範影片的落差（明列，不做的就說不做）

| 影片功能 | v3 | 原因 / 未來路徑 |
|---|---|---|
| 貼文 → 地點清單 | ✅ **核心** | AI 解析（F-70/F-71）。**IG 走截圖**（T-98 實測 caption 不可複製）；Threads／小紅書／YouTube 走連結或貼上文字 |
| iOS 分享選單出現 App | ✅ **捷徑近似**（F-81，與貼上同一輪）| PWA 無法做原生 Share Extension。捷徑讓 IG 分享選單出現「存到櫻旅」|
| 地點 → 導航 | ✅ | 沿用 `openMap()`（`src/lib/schema.js:44`）|
| 地點 → 排進行程，且知道排哪一天 | ✅ **比影片更進一步（本版賣點）** | F-75：日期 chip 對上 `day.city` 與 `place.area`，相符標「建議」|
| 所有地點落在同一張地圖、滿城 pin | ⚪ **加分，Phase 1.5**（F-84 + F-85）| 不擋 MVP。自動定位命中率未實測，UI 不得把它當主路徑 |
| 定位失敗的補救 | ⚪ 加分，Phase 1.5 | F-86「補位置」。若做地圖，這才是座標的真實主路徑 |
| 「我現在附近有哪些收藏」 | ⚪ 加分，Phase 1.5 | F-87 |
| 一天的地點串成一條路線 | ⚪ 加分，Phase 1.5 | F-80。手機上限 3 個中途點，不得包裝成「交通規劃」|
| 營業時間、評分、儲存數 | ❌ 本版不做 | 無免費且對日本店家可靠的資料源 |
| 店家照片牆 | ❌ 本版不做 | 1MB jsonb 上限塞不下；未來走 Supabase Storage（僅存 URL）|
| 「其他提到這家店的貼文」 | ❌ 不做 | 需跨使用者的貼文語料庫，個人 App 無此資料 |

**判斷**：砍掉的是店家資訊牆。核心迴路是「存 → 解析 → **建議哪一天** → 寫入行程 → 單點導航」。滿城 pin 是 Aibo 的高潮，不是櫻旅本版的高潮。

### 1.5 決策紀錄：地圖總覽怎麼做（含兩次否決）

#### 1.5.1 否決一：連結 Google 帳號寫入「我的清單」

CEO 提問：能否讓使用者連結 Google 帳號，用 Google Maps 內建的「我的清單／想去」來補償？

**結論：技術上不可能。**

| 層次 | 理由 |
|------|------|
| **技術** | **Google Maps Platform 沒有任何寫入使用者 saved lists 的 API。**「我的清單」「想去」「已加星號」只能透過 Google Maps 自家 UI 操作，OAuth **拿不到這個權限**（不存在對應 scope）。唯一官方出口是 Google Takeout —— 唯讀、手動 |
| **架構** | 櫻旅核心是「**無登入，傳網址即共編**」。加 Google OAuth 等於每個旅伴各自授權、後端保管 token、開 Cloud 專案、敏感 scope 過同意畫面審查。為一個不存在的 API 破壞核心模型 |
| **產品** | 「我的清單」是**個人**收藏，共編行程要的是**大家都看得到的那一份** |

#### 1.5.2 否決二：匯出 CSV → Google My Maps 匯入（我上一版的提案，已作廢為主方案）

**CEO 回饋（2026-09-01）**：

> 「匯入只能在電腦做這本身就不方便，不符合需求。我是在休閒時滑 IG 看到喜歡的景點跟影片，
> 怎麼可能特地存起來到電腦匯入。」

**這個否決是對的，而且指出了我上一版的判斷錯誤。** 情境分析：

| 時刻 | 場景 | 裝置 | 可容忍的操作成本 |
|------|------|------|-----------------|
| **A 收藏** | 沙發上滑 IG，看到想去的店 | iPhone | 幾秒，不能離開手機 |
| **B 規劃** | 排哪些店可以同一天 | iPhone（偶爾平板）| 幾分鐘，仍在手機 |
| **C 現場** | 人在中洲，想知道附近有沒有存過的店 | iPhone | 幾秒，一定在手機 |

**三個時刻沒有一個發生在電腦前。** `mymaps.google.com` 不支援手機匯入，等於在 A 和 B 之間插入一道
「開電腦」的門檻 —— 而這正是使用者一開始就懶得做、才需要這個 App 的那件事。My Maps 方案把
App 想解決的問題原封不動退還給使用者。**降級為選配功能（F-79），不再是取得地圖的必經路徑。**

#### 1.5.3 採用方案：App 內原生地圖，座標分三層取得，全程手機

既然「有座標」是所有好功能（地圖、附近、距離排序）的共同前提，就正面把它解決掉。三層取得，
逐層降低對自動化的依賴，**每一層都在手機上完成**：

| 層 | 做法 | 覆蓋率 | 成本 |
|----|------|--------|------|
| **① 自動** | 存入時後端 geocode：以 LLM 給的 `nameJa`（日文正式名）+ `area` 查 **Photon**（主）／**Nominatim**（備），結果寫入 Supabase 快取表，命中即有 pin | **未實測，不承諾數字**。公開 Photon 站自述「extensive usage will be throttled」且不保證可用性，屬 demo 等級。命中率由 T-91 實測決定，`nameJa` 是關鍵變因 | **$0**，免金鑰免帳號 |
| **② 半自動補救** | 未定位的地點列在「未定位」區。點「補位置」→ 開 Google Maps 搜尋（**已 100% 可用**）→ 找到店家 → 分享／複製連結 → 回櫻旅貼上 → 後端跟隨轉址、正則抽 `@lat,lng` | 剩餘的大部分，約 10 秒/筆 | **$0** |
| **③ 手動** | 地圖上長按放 pin 微調 | 100% 保底 | **$0** |

**為什麼 Photon 排在 Nominatim 前面**：Photon 是以 Elasticsearch 建在 OSM 上的地名搜尋，
**擅長「用名稱找地點」且容忍拼寫差異**；Nominatim 強在結構化地址解析。我們手上是店名不是地址，
所以 Photon 更合適。兩者皆免費、免金鑰、免註冊，Nominatim 需遵守 1 req/s 與 User-Agent 規範
—— 都在後端呼叫並快取，天然滿足。

**公開 Photon（`photon.komoot.io`）是 demo 服務**，可限流、無 SLA，家庭用量可接受，**不得寫成生產級保證，也不得在 UI 承諾自動定位成功率**。命中率未實測前，座標三層裡真正可靠的是 ② 補位置。

**沒定位到的地點絕不隱藏。** 一律留在清單裡，且地圖按鈕照常可用（`openMap()` 從未失敗過）。
地圖只是加分，不是使用地點的前提。

#### 1.5.4 順手推薦（不寫程式，只放一行 UI 提示）

使用者點「地圖」查看某家店時，Google Maps 已經開著、店家已經找到 —— 此時順手按一下
Google Maps 自己的「儲存」，就能把它放進**她自己的** Google Maps 清單。這是唯一能拿到
**Google 品質座標**又完全零開發的路徑，適合她特別在意的店。UI 上以一行提示帶過即可，
不是我們要做的功能。

### 1.6 決策紀錄：2026-09-01 下午 CEO 拍板（v3.3）

FSD 評估後 CEO 回覆三項，本版以此為準：

| # | 問題 | 拍板 | 寫入規格 |
|---|------|------|---------|
| 1 | MVP 要不要「依區域建議日期」？ | **要** | F-75 升級為聰明日期選擇，見 §4.3、§6.3。這是本版相對 Aibo 的賣點 |
| 2 | iOS 捷徑要不要跟貼上同一輪？ | **要** | F-81 + F-83 從 Phase 2 提前到 Phase 1。F-82（Android `share_target`）仍留 Phase 2 |
| 3 | 地圖要不要從主賣點降成加分？ | **降** | F-84／F-85／F-86／F-87／F-80／F-79 全部 Phase 1.5。MVP 不得把滿城 pin 當主路徑或 onboard 文案 |

連帶修正（評估時一併鎖定，避免實作踩坑）：

- **IG 主路徑是貼文文字，不是截圖。** Reels 畫面常只有食物；店名在 caption／字幕。F-71 改為輔路徑。
- **`usedIn` 一對一改為行程項目帶 `placeId`。** 同一家店可排進多天；「已加入 D2、D3」由反查得出。
- **T-73 原寫「欄位級合併」是錯的。** `mergeList` 是整筆 LWW。places 不另寫 `mergePlaces`。
- **Photon 公開站是 demo**，家庭用量可當加分，不得承諾 50–70% 自動命中。

---

## 2. Phase 0 前置必修 —— 一個會造成雲端資料遺失的既有 bug

> **這是本版最高優先事項，必須在任何新功能之前單獨上線。**

### 2.1 問題

`src/lib/migrate.js:23` 的 `migrate()` 用**白名單**重建 trip 物件：

```js
const normalized = {
  schemaVersion: SCHEMA_VERSION,
  tripName: wrapScalar(raw.tripName, ""),
  /* …固定欄位列表… */
};
return normalized;   // ← raw 上任何未列出的欄位都消失
```

第 14 行只在 `raw.schemaVersion === SCHEMA_VERSION` 時 early-return，**沒有處理「收到比自己新的版本」**。

### 2.2 觸發路徑

本版要把 `SCHEMA_VERSION` 從 4 升到 5。`vite-plugin-pwa` 用 `registerType: "autoUpdate"`，舊 bundle 在使用者重新整理前可能存活數分鐘到數天。屆時：

1. 某支還跑 v4 bundle 的手機，從雲端 pull 到 v5 資料
2. `migrate()` 因 `5 !== 4` 不 early-return → 重建物件 → `pockets` / `places` **被丟棄**，`schemaVersion` 被降回 4
3. `validateTrip()` 檢查 `schemaVersion === 4`，判定**合法**
4. `sync.pushRemote` 把被閹割的資料**推回 Supabase**

→ 所有旅伴的口袋地點被清空，且是雲端層級、不可復原。

### 2.3 修法（**兩處，缺一不可**）

> **2026-09-01 設計文件階段修正**：原本只寫了 `migrate.js`，**漏掉 `merge.js` 的 `mergeTrip`**。
> 只修 `migrate` 完全擋不住資料遺失，因為 `mergeTrip` 也是白名單重建、且觸發頻率高得多。

#### ① `src/lib/migrate.js`

```js
if (raw.schemaVersion > SCHEMA_VERSION) return raw;   // 比我新的資料不要碰
const normalized = {
  ...raw,                              // 未知欄位一律穿透
  schemaVersion: SCHEMA_VERSION,
  /* …既有欄位維持不變… */
};
```

#### ② `src/lib/merge.js` 的 `mergeTrip`（**真正的主要破口**）

`merge.js:166` 的 `mergeTrip` 同樣是白名單重建，而且 **`:170` 硬寫 `schemaVersion: SCHEMA_VERSION`**：

```js
export function mergeTrip(local, remote) {
  return normalizeTrip({
    schemaVersion: SCHEMA_VERSION,   // ← 硬寫，把 v5 資料標記成 v4
    tripName: pick(...), /* …固定欄位列表… */
  });                                 // ← pockets / places 不在列表內,消失
}
```

所以就算 `migrate()` 依 ① 修好、原樣回傳 v5 blob，只要走到 `mergeTrip` 就會被重新閹割。
而 `mergeTrip` 的呼叫點涵蓋**幾乎所有資料路徑**，觸發頻率遠高於 `migrate`：

| 呼叫點 | 時機 |
|--------|------|
| `useTrip.js:79` | `applyRemote` 套用遠端 |
| `useTrip.js:131` | 開啟 App 載入 |
| `useTrip.js:152` | Realtime 推播 |
| `sync.js:43` | **每一次 push 前的 read-merge-write** |

修法：

```js
export function mergeTrip(local, remote) {
  if (!remote) return normalizeTrip(local);
  if (!local) return normalizeTrip(remote);
  return normalizeTrip({
    ...local, ...remote,                     // 未知欄位穿透(remote 較新者勝)
    schemaVersion: Math.max(
      local.schemaVersion || 0, remote.schemaVersion || 0, SCHEMA_VERSION),
    /* …既有的 pick / mergeList 欄位維持不變,覆蓋掉上面的展開… */
  });
}
```

`normalizeTrip`（`merge.js:153`）本身用 `...t` 展開，**不需要改**（已核對）。

#### 這個修法的副作用是刻意的，而且是好的

v4 client 合併到 v5 資料後，本地 `schemaVersion` 變成 5，`validateTrip` 會判定「資料版本不符」
而**拒絕 push**。舊裝置因此退化為**唯讀**，而不是靜默破壞雲端資料。

配合 **Q-02（見 F-77）**：新增專屬 reason「App 版本過舊，請重新整理頁面」並附［重新整理］按鈕，
讓使用者看得懂、按一下就解決。**用「看得見的停止」換掉「看不見的資料毀損」。**

---

第 ① 項的 `...raw` 與第 ② 項的 `...local, ...remote` 讓未來所有新增欄位自動向前相容，
這個 bug 不會再犯第二次。

### 2.4 閘門

> **F-69 上線、且確認所有裝置皆已載入新 bundle 之前，不得升 `SCHEMA_VERSION`。**
> 驗證方式：各裝置重新整理後於設定頁確認版本，或等待一個完整的使用週期。

---

## 3. 技術架構總覽

### 3.1 新增模組

```
使用者
  │  貼上連結 / 選擇截圖
  ▼
PocketView / IngestSheet ──POST──► api/parse-post.js (Vercel serverless)
  │                                    │
  │                                    ├─ 1. text 夠長      → LLM
  │                                    ├─ 2. YouTube/TikTok → 官方 oEmbed → LLM
  │                                    ├─ 3. 其他 URL       → og:meta 抓取 → LLM
  │                                    ├─ 4. images[] (≤3)  → 多模態 LLM
  │                                    └─ 5. 全失敗         → ok:false
  ▼
覆核步驟（F-72，使用者勾選／修改）
  ▼
useTrip.addPocket() / addPlaces()  ──► trip.pockets[] / trip.places[]（jsonb）
  ▼                                         │
既有 sync.js / merge.js / Dexie ◄───────────┘（完全沿用，不新增同步機制）
  ▼
PlaceRow ──「加入行程」──► DayPickerSheet ──► days[].items[]（既有結構，多 `placeId`）
       └──「地圖」──────► openMap()（既有；MVP 的導航就是這一顆）

DayPickerSheet 依 place.area 對 day.city 標「建議」（F-75，零外部 API）

（以下 Phase 1.5，加分，不擋 MVP）
addPlaces() ──背景──► api/geocode.js ──► Photon → Nominatim（皆免金鑰；公開 Photon 為 demo）
                            │                 └─► geo_cache 表（命中與未命中都寫,永不重查）
                            ▼
                     place.lat / lng ──► PocketView 地圖檢視（Leaflet,lazy-load）
                                     └─► 「附近」距離排序（navigator.geolocation）

未定位的地點 ──「補位置」──► openMap() 找店 ──► 複製 Google Maps 連結 ──► 貼回
                                  └─► api/geocode.js?resolve= ──跟隨轉址+正則──► lat/lng

DayCard ───「這天的路線」──► lib/route.js ──► Google Maps 多點路線 URL（純字串組裝）

  ↑ 全部零成本、免金鑰、免綁卡,且每一步都在手機上完成
```

### 3.2 對外依賴

| 依賴 | 用途 | 費用 | 免費替代方案 |
|------|------|------|-------------|
| Anthropic API（`claude-haiku-4-5`）| 貼文／截圖解析 | ~1¢/次；100 次/月 ≈ **USD $1** | **Gemini 2.x Flash 免費層 → $0**（見 §3.3）|
| YouTube / TikTok oEmbed | 影片標題抓取 | **$0**（公開、免金鑰）| — |
| Google Maps 搜尋連結 | 導航 | **$0**（純 URL，無 API）| — |
| Supabase 免費層 jsonb + 一張快取表 | 儲存 | **$0**（沿用既有）| — |
| **Photon**（`photon.komoot.io`）| 地名 → 座標（主）| **$0**，免金鑰免註冊 | Nominatim |
| **Nominatim**（OSM）| 地名 → 座標（備）| **$0**，免金鑰免註冊 | Photon |
| **OSM 圖磚**（`tile.openstreetmap.org`）| 地圖底圖 | **$0**，免金鑰免註冊 | OpenFreeMap（免金鑰免註冊，但需 MapLibre，bundle 較大）|
| Google Maps 連結解析 | 補位置時抽座標 | **$0**（跟隨轉址 + 正則，無 API）| — |
| 付費地圖／店家資料 API | **本版不用**（不綁信用卡）| **$0** | — |

**本版新增經常性成本上限：USD $1/月**（且可一鍵歸零）。**全案不需要綁定任何信用卡。**
符合「零成本 → 低成本 → 付費」與「每個付費服務必須有免費替代」原則。

> **OSM 圖磚使用規範**：官方政策要求標註來源、禁止大量下載，且明言不適合高流量應用。
> 櫻旅是家庭規模（個位數使用者）的個人專案，屬政策容許範圍；仍須在地圖角落標註
> `© OpenStreetMap contributors`。若日後使用量成長，改用 OpenFreeMap（同樣免金鑰）。

### 3.3 LLM 選型決策

| 候選 | 優點 | 缺點 | 決定 |
|------|------|------|------|
| **Claude Haiku 4.5** | `ANTHROPIC_API_KEY` 已設在 Vercel（v2 航班功能留下）；強制 tool-use 可**保證 JSON 結構**，端點不必修補模型輸出；繁中貼文→日文地名的場景表現好 | 有邊際成本（極低）| ✅ **預設** |
| Gemini 2.x Flash | 免費層真的 $0；同樣支援多模態與結構化輸出 | 要新開金鑰與額度儀表板 | ✅ **保留為一鍵切換** |

**實作要求**：`api/parse-post.js` 內部抽成 `PROVIDER = process.env.PARSE_PROVIDER || "anthropic"`，包 `callAnthropic()` / `callGemini()` 兩個同介面函式。改一個環境變數即可讓本功能邊際成本歸零。

---

## 4. 功能規格詳述

> 標記：🔧 = 修既有問題；🆕 = 新功能

### 4.1 前置修正

| 編號 | 功能 | 規格 | 錯誤處理 |
|------|------|------|----------|
| **F-69** 🔧 | **遷移相容性修正** | 見 §2.3。`migrate()` 對 `raw.schemaVersion > SCHEMA_VERSION` 直接回傳原物件；`normalized` 以 `...raw` 開頭讓未知欄位穿透 | 無 |

### 4.2 口袋收藏（輸入端）

| 編號 | 功能 | 規格 | 錯誤處理 |
|------|------|------|----------|
| **F-70** 🆕 | **貼上連結／貼文文字收藏** | 口袋頁輸入面板**兩個並列主欄**：① 連結 ② 貼文文字。貼上 IG／Threads／小紅書／TikTok／YouTube 連結，**以及／或**長按複製的 caption。呼叫 `/api/parse-post`。**文案必須誠實且依平台分流**（v3.6）：偵測到 `instagram.com` 連結時，立刻提示「Instagram 讀不到內文，請改用截圖」並把截圖選擇器提到最前面；其他平台才引導貼文字。捷徑（F-81）預填的是連結欄 | 解析失敗**不跳錯誤頁**：維持在輸入面板；IG 聚焦截圖選擇器，其他平台聚焦貼文文字欄 |
| **F-71** 🆕 | **貼上截圖收藏（IG 主路徑）** | 從相簿選擇截圖（`<input type="file" accept="image/*" multiple>`（**注意 `multiple`**），沿用 `ChecklistCard.jsx:98`）。**最多 3 張**，前端逐張壓縮（**`OCR_MAX=1568` / `OCR_QUALITY=0.85`**，見 §7.5d）→ 一次送進同一個 LLM 呼叫（見 §7.5b）。**v3.6：T-98 實測 IG caption 無法複製，故截圖是 IG 唯一可行的內容路徑，UI 上對 IG 必須是首選而非「或選截圖」。** 文案要引導截**展開後的 caption 或影片字幕**，不是只截食物畫面 | 超過張數／單張／總量任一上限 → `reason:"too_large"`，三種觸發**各有文案**（見 §7.4）|
| **F-72** 🆕 | **解析結果覆核** | 解析完成**絕不自動寫入**。呈現可編輯清單：勾選框、店名（可改）、類別（下拉）、區域、備註。`confidence < 0.6` 的列**預設不勾**並標黃；與既有 `places[]` 同名者顯示「已存過」badge 且預設不勾。按「加入口袋 (N)」才寫入 | 全部取消勾選 → 按鈕停用 |
| **F-78** 🆕 | **離線暫存待解析** | `navigator.onLine === false` 時，把原始連結存進 `sourceUrl`、原始貼文文字存進 **`pocket.rawText`**、標記 **`pocket.pending = true`**、`title` 顯示「待解析」；回線後該卡片顯示「重新解析」按鈕，並以 `rawText` + `sourceUrl` 預填重跑解析（UI spec S-06）。**`rawText` / `pending` 兩個欄位是 2026-09-01 補上的** —— 原 §5.2 的 Pocket 沒有任何欄位能存 caption，而 caption 正是本版指定的主路徑，F-78 原本做不出來 | 解析成功後清空 `rawText`、`pending` 設 false |
| **F-81** 🆕 | **iOS 捷徑分享入口** | 使用者一次性安裝捷徑「存到櫻旅」（Shortcuts → 開啟「在分享工作表中顯示」，接受類型：URL／文字）。動作只有兩步：① 組字串 `https://sakura-trip-omega.vercel.app/?trip=<KEY>&share=<URL Encode>` ② `打開 URL`。**零後端**。設定頁新增「iOS 捷徑設定」卡片，帶入目前 trip key 產生完整前綴並提供複製鈕（比照 `SettingView.jsx:41-49`）| 捷徑未安裝不影響任何功能，貼上路徑照常可用 |
| **F-83** 🆕 | **啟動時處理分享參數** | `App.jsx` 開機讀 `?share=` / `?share_text=`，`history.replaceState` 立刻清掉參數（避免留在網址列被當成 trip 的一部分分享出去），然後**預填並開啟 IngestSheet**。IngestSheet 必須設計成「所有入口的共同終點」，不是失敗後的退路 | 參數格式異常 → 照常開 IngestSheet，只是不預填 |

**F-72「同名」判定規則**（`dedupeAgainstSaved()`，2026-09-01 補定義，原本未定義會讓開發員各自發明）：

1. 正規化：去頭尾空白、移除所有空白字元、全形轉半形、英文轉小寫。
2. 每個地點取正規化後的集合 `{name, nameJa}`（空字串不計）。
3. 候選地點與任一既有地點的集合**有交集**即判定「已存過」。跨欄位比對是刻意的 —— 同一家店可能在 A 貼文寫中文名、在 B 貼文寫日文名。
4. **不比對 `area`**：區域寫法太隨意，納入會大幅降低命中。
5. **此判定僅供提示**：只用來顯示 badge 與預設不勾，**永遠不得自動略過或自動合併**。誤判的代價因此只是多一次點擊，而非資料遺失。這也是 §5.4 為何不讓 places 進 `dedupeByContent` 的同一個理由。
> **F-78 對 IG 的限制（2026-09-02 裁定：MVP 不解決）**：截圖不得存進 trip jsonb（§5.5 硬性規定），
> 離線只存得下 `sourceUrl` + `rawText`；離線收藏一則 IG 貼文，回線後**仍需重新截圖**。
> **裁定不在 MVP 解決**，理由：載入一支 IG Reel 本身就需要網路 —— 能滑到貼文就代表有連線，
> 「離線 + IG + 想收藏」近乎不存在的情境。真要解決需用 Dexie 另開 blob 暫存區（新機制、含生命週期與清理），
> 不值得。**維持誠實標示**（離線橫幅警語 + S-06b 按鈕文案「補一張截圖再解析」）即可。

**F-81 兩個必須做對的細節**：

1. **捷徑 URL 一定要帶 `?trip=<KEY>`。** iOS 給已安裝的 PWA 的儲存分區不保證與 Safari 相同，靠 `resolveTripKey` 的 localStorage 第二順位可能默默開到**另一份行程**。帶 key 讓第一順位勝出。`resolveTripKey` 既有邏輯會自動寫回 localStorage 與網址，不需修改。
2. **IG 的分享選單只會給捷徑一個 URL，不會給貼文文字。** 捷徑省掉的是「切換 App + 貼上連結」，不是「解析不到內容」。開 IngestSheet 後若解析失敗，必須聚焦貼文文字欄並提示「請長按貼文複製店名那段文字」。**不得讓使用者以為裝了捷徑就萬能，也不得把截圖寫成 IG 唯一退路。**

> **`nameJa` 在 MVP 為唯讀**（2026-09-01 裁定）：它在 MVP 沒有用途，真正的用途是 Phase 1.5 的 geocode 查詢字串。
> 開放編輯等於多一個要維護的欄位卻沒有回報。若 Phase 1.5 發現它錯誤，F-86「補位置」本來就能直接補正座標，
> 不必回頭修名稱。Phase 1.5 再評估是否開放編輯。

> ### ✅ T-98 實機驗證結果（2026-09-02，CEO 親測）—— **假設被推翻**
>
> **「IG 的 caption 無法長按選取複製，只能『分享連結／複製連結』。」**
>
> 因此對 **Instagram** 而言：
>
> | 路徑 | 可行性 |
> |------|--------|
> | 連結 → 伺服器抓 og:meta | ❌ 機房 IP 撞登入牆（PRD §7.2 早已載明）|
> | 貼文文字 → 使用者複製貼上 | ❌ **實測不可行，caption 選不起來** |
> | **截圖 → 多模態 LLM 讀圖** | ✅ **IG 唯一可行的內容路徑** |
>
> **裁定（v3.6）**：F-71 截圖**升回主路徑**，且對 IG 是唯一路徑。F-70 的貼文文字欄**保留**但降為
> 「可用時才用」—— Threads／小紅書／部落格／YouTube 說明欄的文字通常複製得到，那些平台仍走文字。
> 連結欄也保留：它是來源存證，日後要回看原貼文只能靠它。
>
> **UI 必須改成依平台分流的引導**（UI spec 需回修）：
> - 貼上的是 **instagram.com** 連結 → 立刻顯示「Instagram 讀不到內文，請截圖」並把截圖選擇器提到最前面
> - 其他平台 → 維持先試連結、再請貼文字
>
> **對 F-81 iOS 捷徑的連帶影響**：IG 分享選單只給 URL，所以捷徑存下來的只有連結、沒有內容。
> 捷徑仍有價值（不漏掉來源、一鍵開啟面板），但**文案不得暗示裝了捷徑就能自動解析 IG**。
>
> **建議 CEO 補測一項**（會影響文案，但不擋實作）：這類清單型貼文常把店名放在**作者的置頂留言**，
> 留言區是否可複製？若可，UI 可多一條引導「複製作者留言裡的清單」。
> 另 iOS 的「實況文字」可對截圖直接選取文字 —— 若順手，也是一條乾淨的取字路徑。


### 4.3 口袋瀏覽與使用（輸出端）

| 編號 | 功能 | 規格 | 錯誤處理 |
|------|------|------|----------|
| **F-73** 🆕 | **口袋清單** | 新增第六個分頁「口袋」。以**貼文為單位**分組（pocket card），展開後為地點列（place row）。卡片標題顯示 AI 產的貼文主題（例：「福岡三日必吃美食」）、來源平台圖示、原貼文連結 | 空狀態顯示引導文案 |
| **F-74** 🆕 | **地點 → 導航** | 每個地點列一顆地圖鈕，呼叫 `openMap(name + " " + area)`（`src/lib/schema.js:44`），交給 Google Maps 自己解析。與行程項目、美食清單的地圖鈕行為完全一致 | 無（純 URL，不會失敗）|
| **F-75** 🆕 | **加入行程（含建議日期）** | 地點列「加入行程」→ `DayPickerSheet`。每個日期 chip 顯示：D*n*、日期、`day.city`、當天已有幾項。`place.area` 與 `day.city.v` 相符者標「建議」（規則見 §6.3）。點一下即寫入該天 `days[].items[]`，新項目帶 `placeId`。列上 badge 由反查得出，例「已加入 D2、D3」。**同一家店可排進多天。** 寫入須在同一次 commit 完成 | 尚未產生任何天數 → 提示先去行程頁設定日期區間。零相符時仍列出所有天，不擋手動選 |
| **F-76** 🆕 | **口袋容量保護** | 寫入前試算 `byteSize({...data, places:[...]})`，超過 `PLACE_BUDGET_BYTES = 900_000` 即擋下。門檻刻意低於 `MAX_JSON_BYTES = 1_000_000`，讓使用者撞到**可行動的牆**而非靜默同步失敗。沿用 `ChecklistCard.jsx:31` 已驗證的試算模式。**提示文案必須先指向待購清單相片**：「空間快滿了。最占空間的通常是**待購清單的相片**，其次是舊的口袋地點。」—— 依 §5.5，150 個地點僅約 54KB，叫使用者刪地點回收不了空間，那正是本功能要避免的「不可行動的牆」（原文案有此矛盾，2026-09-01 修正）| 超過 → 不寫入，顯示提示，並提供跳到待購清單與口袋的兩個入口 |
| **F-77** 🔧 | **同步失敗原因外顯** | **既有潛在問題**：`validateTrip()` 回傳的 `reason`（如「資料過大」）在 `pushRemote` 拋出後，經 `doPush` 重試 3 次落到 `syncState:"failed"`，UI 只剩一顆紅色徽章、**不顯示原因**。購物清單照片已可能觸發，口袋功能會讓它更常見。需把 `reason` 透過 `useTrip` 傳到 `SyncStatusBadge`。**另新增專屬 reason「App 版本過舊，請重新整理頁面」並附［重新整理］按鈕**（Q-02，2026-09-01 補）：採用 §2.3 ② 的修法後，舊 bundle 的裝置本地資料會帶 `schemaVersion: 5`，`validateTrip` 只會回籠統的「資料版本不符」，使用者不知道該做什麼 | — |

### 4.4 地圖與位置

> 編號說明：F-79／F-80 沿用前一版草案的編號以免混淆；F-84～F-87 為地圖加分項。
> **本節全部是 Phase 1.5，不進 MVP。** 優先順序為 **F-86 → F-87 → F-84 → F-85 → F-80 → F-79**（補位置先於自動定位；附近先於滿城 pin）。
> UI 文案不得把「滿城 pin」當口袋頁的主路徑或空狀態賣點。

| 編號 | 功能 | 規格 | 錯誤處理 |
|------|------|------|----------|
| **F-84** 🆕 | **地點座標補完（自動層）** | 新增 `api/geocode.js`。輸入地點名稱陣列，依序嘗試 ① `nameJa + " " + area` ② `name + " " + area` ③ `nameJa`。供應商順序 Photon → Nominatim，皆為伺服器端呼叫（可控 User-Agent 與節流）。**命中與未命中都寫入 `geo_cache` 表**（鍵為查詢字串的 sha1），永不重複查詢。回傳 `{ query, lat, lng, source, confidence }`。地點存入口袋後**背景執行**，不阻塞 UI | 查無 → `lat/lng` 維持 `null`，`geoSource: ""`，地點照常可用。供應商逾時／失敗 → 靜默略過，可重試 |
| **F-85** 🆕 | **口袋地圖** | 口袋頁「清單／地圖」切換。Leaflet + OSM 圖磚，pin 顏色沿用 `ITEM_TYPES[].c`。點 pin 開該地點的 `PlaceSheet`。地圖下方固定顯示「未定位 (N)」區塊，內含所有沒有座標的地點，**每筆仍有可用的地圖鈕與補位置鈕** | 離線 → 圖磚載不出來，顯示「離線時無法載入地圖」，**清單檢視必須完全可用**。零個地點有座標 → 直接顯示未定位清單，不渲染空地圖 |
| **F-86** 🆕 | **補位置（半自動層）** | 未定位地點的「補位置」按鈕，開一個面板：① 一顆「在 Google 地圖搜尋」直接 `openMap()` ② 一個貼上欄。使用者在 Google Maps 找到店家 → 分享／複製連結 → 貼回來 → 送 `api/geocode.js?resolve=<url>`，後端跟隨轉址（`maps.app.goo.gl` 短網址需 follow redirect）後以 `/@(-?\d+\.\d+),(-?\d+\.\d+)/` 抽座標，寫入 `geoSource: "manual"` | 短網址解析不到座標（部分連結只含地址不含 `@`）→ 明確告知「這個連結沒帶座標，請在 Google 地圖上點該店家後再複製一次連結」，不得只回「失敗」 |
| **F-87** 🆕 | **附近的收藏** | 口袋頁「附近」模式：`navigator.geolocation.getCurrentPosition()` 取得目前位置，把有座標的地點依直線距離排序並顯示「約 350 公尺」。**這是本功能在日本現場最實用的形態**，優先度高於地圖本身 | 使用者拒絕定位權限 → 退回一般清單，不重複索取權限。無任何已定位地點 → 提示先補位置 |
| **F-80** 🆕 | **當日路線** | 每個日期卡片一顆「這天的路線」，把該天項目串成 Google Maps 路線 URL：`https://www.google.com/maps/dir/?api=1&origin=…&destination=…&waypoints=A\|B\|C&travelmode=transit`。起點預設當天住宿（`day.lodging`），無住宿則用第一個項目 | **官方上限：手機瀏覽器 3 個中途點、桌機 9 個。** 超過時只取前 3 個，並在按鈕旁註明「Google 地圖單次路線上限，僅含前 5 站」，**不得靜默截斷** |
| **F-79** 🆕(選配) | **匯出 Google My Maps CSV** | **降級為選配**（理由見 §1.5.2）。用途剩下：分享一張大圖給旅伴、備份、偶爾在電腦上規劃。前端組 CSV `Blob`（含 UTF-8 BOM、逗號引號跳脫），送出以 `navigator.share({files})` 為主、`<a download>` 為輔。**UI 上不得呈現為取得地圖的主要方式**，放在設定或口袋頁的次要選單 | 口袋為空 → 停用 |

**F-84 的實作要點**：`geo_cache` 是**獨立的 Supabase 表**，不是 trip jsonb 的一部分 —— 它是跨行程共用的快取，且不需要合併語意。地點自己的 `lat`/`lng` 才寫回 jsonb。表結構：

```sql
create table geo_cache (
  q_hash   text primary key,   -- sha1(normalized query)
  q        text not null,
  lat      double precision,   -- null = 查過但沒找到,不要再查
  lng      double precision,
  source   text,               -- photon | nominatim | manual
  created_at timestamptz default now()
);
```

**F-85 必須 lazy-load。** Leaflet + 其 CSS 約 42KB gz，而 SA 已指出目前 bundle 是單一 555KB chunk（超過 Vite 500KB 警告線）。地圖以 `React.lazy` + 動態 `import("leaflet")` 切成獨立 chunk，**只在使用者切到地圖檢視時才下載**。這同時處理掉 SA 留下的 code-split 建議。

**Leaflet 的兩個已知地雷**：① 必須 `import "leaflet/dist/leaflet.css"`；② 預設 marker 圖示的 URL 在 Vite 打包後會 404 —— 直接用 `L.divIcon({ html: … })` 渲染 Tailwind 樣式的 pin 繞過，順便免費拿到依類別上色的 pin。

### 4.5 明確排除範圍

> **先澄清兩個容易誤讀的項目**（不是排除項）：
> - **iOS 捷徑（F-81 + F-83）本版 Phase 1 要做**，規格見 §4.2，UI 稿必須包含設定頁的捷徑卡片。
> - PWA manifest `share_target`（F-82）排 Phase 2，本版 UI 稿不需涵蓋。

以下**本版不做**，且不得出現在 UI 稿中：

- 連結 Google 帳號 / 寫入 Google Maps「我的清單」—— **技術上不存在此 API**，理由見 §1.5.1
- **要求使用者到電腦上操作的任何流程** —— 見 §1.5.2。F-79 CSV 匯出保留為選配，但不得成為必經路徑
- 付費地圖／店家 API（Google Places 等）—— 本版不綁任何信用卡
- 營業時間、評分、儲存數、店家照片牆
- 「其他提到這家店的貼文」跨貼文關聯
- **跨分頁拖曳地點到行程**（理由見 §6.3）

---

## 5. 資料模型（SCHEMA_VERSION 5）

### 5.1 儲存位置決策：放在 trip jsonb，不開新表

| 方案 | 評估 |
|------|------|
| **✅ trip jsonb 新增兩個 list** | 整個功能都是文字。兩個 id-keyed list 直接吃現有 `mergeList`，**免費繼承** tombstone／Realtime／IndexedDB 離線持久化／CAS 推送重試。改動面：`schema.js`、`merge.js`、`migrate.js` 各數行 |
| ❌ 開新 Supabase 表 | 為了約 40KB 字串，要多一個 Dexie store、多一條 Realtime 頻道、多一套 CAS 迴圈、多一套合併邏輯。不成比例 |

### 5.2 新增結構

```js
// trip.pockets[] —— 一則收藏的貼文（collection）
{
  id: "z9y8x7w",
  title: "福岡三日必吃美食",          // AI 產，15 字內
  sourceUrl: "https://www.instagram.com/reel/…",
  platform: "instagram",              // instagram|threads|xiaohongshu|tiktok|youtube|other
  summary: "在地人推薦的中洲屋台與拉麵",  // AI 產，30 字內
  rawText: "",                        // 原始貼文文字(F-78 待解析、S-06 重新解析預填)
  pending: false,                     // true = 待解析,回線後可重試(F-78)
  createdAt: 1756700000000,
  updatedAt: 1756700000000,
  _deleted: true                      // optional tombstone
}

// trip.places[] —— 一個抽出的地點
{
  id: "a1b2c3d",
  pocketId: "z9y8x7w",                // "" 表示手動新增、無來源貼文
  name: "一蘭拉麵 福岡總本店",           // 貼文原文用字
  nameJa: "一蘭 福岡本社総本店",         // AI 推的日文正式名，推不出來為 ""
  category: "food",                   // === ITEM_TYPE_KEYS
  area: "福岡 中洲川端",
  note: "24小時營業,豚骨拉麵名店,建議避開用餐尖峰",   // 60 字內
  lat: 33.5934, lng: 130.4017,        // null 表示尚未定位;地點照常可用
  geoSource: "photon",                // "" | photon | nominatim | manual
  order: 0,
  updatedAt: 1756700000000,
  _deleted: true
}

// days[].items[] 新增選填欄（既有欄位不變）
{
  id: "i7",
  title: "一蘭拉麵 福岡總本店",
  type: "food",
  placeId: "a1b2c3d",                 // 從口袋加入時寫入;手動新增的行程項目為 ""
  /* time, note, mapUrl, order, updatedAt …既有欄位 */
}
```

**`category` 直接沿用 `ITEM_TYPE_KEYS`**（`src/lib/schema.js:20`：`spot`／`food`／`shop`／`move`／`stay`／`other`）。這不是巧合而是刻意設計：地點丟進 `days[].items[]` 不需要任何轉換表，色塊與圖示也和行程裡完全一致 —— 視覺上就是「同一個東西被搬過去」，而不是被複製成另一種東西。

**不存 `place.usedIn`。** 「已加入哪幾天」由 `days[].items[].placeId` 反查。好處：同一家店可排多天、兩人排到不同天不會互蓋、`mergeList` 整筆 LWW 不會弄丟「加入行程」狀態（行程項目走既有 `mergeDays`）。

**`placeId` 是普通字串欄位**，掛在 item 上，吃既有 `mergeList`（item 整筆 LWW）。不要為它擴充 `mergeDays`。

### 5.3 需修改的既有檔案

| 檔案 | 修改 |
|------|------|
| `src/lib/schema.js` | `SCHEMA_VERSION = 5`；`DEFAULT.pockets = []`、`DEFAULT.places = []`；`LIST_FIELDS`(:143) 加入 `"pockets"`, `"places"`；item 可帶 `placeId`；新增 `PLACE_BUDGET_BYTES = 900_000` 與 **`PLACE_WARN_BYTES = 800_000`**（80 萬先黃字預警、90 萬才擋，Q-04 補；UI spec §6.4 已用到但 PRD 原本未定義） |
| `src/lib/merge.js` | `mergeTrip` 加兩行：`pockets: mergeList(local.pockets, remote.pockets)`、`places: mergeList(local.places, remote.places)` |
| `src/lib/migrate.js` | F-69 修正 + `pockets: (raw.pockets ?? []).map(stamp)`、`places: (raw.places ?? []).map(stamp)` |
| `src/hooks/useTrip.js` | 新 mutators：`addPocket` / `addPlaces` / `updatePlace` / `deletePlace` / `deletePocket` / `addPlaceToDay`；F-77 的 `reason` 外顯 |
| `src/lib/image.js` | 新增 **`OCR_MAX = 1568`**、**`OCR_QUALITY = 0.85`**（T-99 實測結果，見 §7.5d）（既有 `compressImage` 已收 `{max, quality}`，僅加常數與改呼叫端）|
| `supabase-schema.sql` | Phase 1.5：新增 `geo_cache` 表 |
| `vite.config.js` | Phase 1.5：地圖 chunk 的 `manualChunks` |

### 5.4 兩個刻意偏離既有慣例的設計（實作時須留註解說明）

**① `places` 不進 `normalizeTrip` 的 `dedupeByContent`**

內容去重在**每次 merge 都會跑**，誤判即造成永久資料遺失。兩家不同分店的一蘭，若 `area` 寫得潦草就會被靜默合併掉。重複偵測應該放在 F-72 覆核步驟 —— 讓人看得到、可以否決。這與 `flights` / `food` 的處理方式不同，是刻意的。

**② `places` 使用精簡 tombstone**

`useTrip` 的通用 `listDelete`(:187) 會把整筆記錄攤平再加 `_deleted`，約 377B 且永久保留。口袋地點是**高汰換率**資料（存 30 個、留 8 個），`deletePlace` 改為只寫 `{ id, _deleted: true, updatedAt: now() }` ≈ 58B，**省 6.5 倍**。這在 `pick()` 之下是安全的（回傳較新的整個物件）。

### 5.5 容量評估

| 項目 | 實測 |
|------|------|
| DEFAULT trip | 4,126 B |
| 一筆完整 place | 361 B |
| 一筆完整 pocket | 194 B |
| 精簡 tombstone | 58 B |
| 完整 tombstone（若用通用 listDelete）| 377 B |

實際使用 50–150 個地點 ≈ 18–54 KB，距離 1MB 極寬鬆。真正的容量壓力來自**既有的購物清單照片**（data URL 存在 jsonb 內），這也是 F-76 與 F-77 存在的理由。

**硬性規定：`photoUrl` 只能存字串 URL，任何情況下都不得把圖片 bytes 寫進 trip jsonb。**

---

## 6. UI/UX 設計規範（交付 UI/UX 設計師）

### 6.1 新增第六個分頁「口袋」

不塞進「清單」底下。口袋是獨立收件匣；**賣點是收進來之後知道排哪一天**，不是地圖。

**技術注意**：`src/components/BottomNav.jsx:8` 寫死 `grid-cols-5`。**Tailwind 會 purge 掉樣板字串產生的 class**，必須用明確對照表（例 `{ 5: "grid-cols-5", 6: "grid-cols-6" }`），不可用字串內插。375px 寬下六格各約 62px，仍超過 44px 觸控目標；圖示 20px + 標籤 11px 排得下。

### 6.2 元件清單（沿用既有命名慣例）

| 檔案 | 角色 | 參考既有元件 |
|------|------|-------------|
| `src/views/places/PocketView.jsx` | P-06 外殼：貼上輸入列 + 貼文卡片列表 + 空狀態 | `ListsView.jsx` |
| `src/views/places/IngestSheet.jsx` | **連結欄與貼文文字欄並列主路徑** + 截圖（輔）+ 解析中 + **覆核步驟**。捷徑預填同一面板 | — |
| `src/views/places/PocketCard.jsx` | 一則貼文收藏，可展開／收合 | `ChecklistCard.jsx` |
| `src/views/places/PlaceRow.jsx` | 一個地點列：類別色塊 + 名稱 + 區域 + 地圖鈕 + 加入行程鈕 | `ItemRow.jsx` |
| `src/views/places/PlaceSheet.jsx` | 地點詳情 bottom sheet | `ConfirmSheet.jsx` 的遮罩模式 |
| `src/views/places/DayPickerSheet.jsx` | 「加入行程」選日期 chips：**城市、已有幾項、「建議」badge** | — |
| `src/views/places/constants.js` | **僅 re-export** `src/views/trip/constants.js` 的 `ITEM_TYPES` | — |
| `src/views/places/MapView.jsx` | F-85 地圖檢視 + 未定位區塊。**必須 `React.lazy` 動態載入** | — |
| `src/views/places/LocateSheet.jsx` | F-86 補位置：Google 地圖搜尋鈕 + 連結貼上欄 | `ConfirmSheet.jsx` |
| `src/views/places/NearbyList.jsx` | F-87 附近的收藏，依距離排序 | `PlaceRow.jsx` |
| `src/views/places/ExportSheet.jsx` | F-79 CSV 匯出（**選配，放次要選單**）| `ConfirmSheet.jsx` |
| `src/lib/places.js` | `placeToItem()`、`pocketBytes()`、`dedupeAgainstSaved()`、`suggestDays(place, days)`、`daysForPlace(placeId, days)` | — |
| `src/lib/geo.js` | `haversine()`、`formatDistance()`、`parseMapsUrl()` | — |
| `src/lib/csv.js` | `placesToCsv()`（含 UTF-8 BOM、逗號/引號跳脫）| — |
| `src/lib/route.js` | `dayRouteUrl(day, items)`，含 3 中途點截斷與 `truncated` 旗標（Phase 1.5）| — |
| `src/lib/schema.js` | 另新增 **`PLATFORM_KEYS`** 純枚舉（`instagram`／`threads`／`xiaohongshu`／`tiktok`／`youtube`／`other`）。此檔本來就是純枚舉的家（`ITEM_TYPE_KEYS` 在此），前端 `detectPlatform` 與後端 `platformOf` **一律 import 它，不各自抄一份**；若 Vercel function 無法 import `src/`，才退回各自定義並互留註解指向對方 | — |
| `src/lib/share.js` | `parseShareParams()`、`shortcutPrefix(tripKey)`（F-81／F-83）、**`detectPlatform(url)`**（2026-09-02 裁定落位：UI 必須在**送出前**就知道換哪種版面，不能等後端回 `source.platform`；**比對 hostname，禁用 `includes`**，以免 `?ref=instagram.com` 誤判）| — |
| `src/components/ui.jsx` | **加一個 `Toast`（C-29）**，不另開新檔 —— 此檔本來就是 Card／SectionTitle／PinkBtn／Field 這類小元件的集散地，專案現無任何 toast（Q-05 裁定）| — |
| `src/components/ConfirmSheet.jsx` | **加選填 `subtitle` prop**，預設值為現有的「刪除後旅伴端也會一併移除,無法復原」→ 向下相容，既有 4 個呼叫點不用改。S-17「要放棄修改嗎？」才不會跳出不相干的刪除警告（Q-06，已核對 `ConfirmSheet.jsx:10` 確實硬寫）| — |

**類別色塊不得自訂新配色**，必須 re-export 行程頁的 `ITEM_TYPES`，讓同一個地點在口袋與在行程中長得一模一樣。

### 6.3 「加入行程」用選日期，不用拖曳 —— 設計稿不得畫成拖曳

跨分頁拖曳目前**結構上不可行**：

- 每個 `DayCard` 各自持有一個 `DndContext`（`DayCard.jsx:84`），其 `onDragEnd`(:33) 假設起訖點同在一天（`arrayMove(ids, ids.indexOf(active.id), …)`）。外部拖入的地點在 `ids` 裡沒有索引。
- `App.jsx` 一次只掛載一個分頁，口袋頁與行程頁不會同時存在於 DOM。

真要做，得把 `DndContext` 從 `DayCard` 上提到 `TripView`、每個 `DayCard` 包 `useDroppable`、`onDragEnd` 分流 —— 那是**改動已上線且運作正常的排序程式碼**，屬於獨立的後續分支，不進本版。

替代方案（F-75）：一顆「加入行程」→ 日期 chips → 點一下完成。一次點擊、iPhone 觸控友善、完全沿用 `days[].items[]`、不碰任何既有拖曳程式碼。地點進到某一天之後，本來就能用現有拖曳重排。

**日期 chip 必備資訊（設計稿不得省略「建議」）**：

| 元素 | 來源 | 備註 |
|------|------|------|
| D*n* + 日期 | `day.date` | 維持行程頁既有順序，**不要**把建議天抽到最上面 |
| 城市 | `day.city.v` | 空則顯示「未填城市」 |
| 已有 N 項 | 當天 live items 數 | 讓使用者看到那天已經多滿 |
| 「建議」badge | `suggestDays()` | 僅標示，不自動選、不自動寫入 |
| 「已加入」 | `daysForPlace()` | 該天已有相同 `placeId` 的 item 時顯示；仍可再加（想去兩次）|

**`suggestDays(place, days)` 規則**（純字串，零 API）：

1. 正規化：去空白、轉小寫。城市別名表（寫死常數即可）：`福岡↔博多↔fukuoka`、`那霸↔沖繩↔naha↔okinawa`、`由布院↔湯布院↔yufuin`。可隨行程擴充，不必完美。
2. `place.area` 包含 `day.city`、或 `day.city` 包含 `place.area` 的任一 token（≥2 字）→ 建議。
3. 套用別名後兩邊命中同一正規化城市 → 建議。
4. `place.area` 或 `day.city` 為空 → 不建議、不擋。
5. 零相符時仍列出所有天。**不得因為沒建議就改成自動選第一天。**

這一步就是「明白該怎麼安排行程」的 MVP 解。真正走路／搭車仍是 chip 點完之後，在行程列上按既有地圖鈕。

### 6.4 地點編輯用明確「儲存」鈕，不做即時輸入即存

`useTrip.js:46` 的 `applyRemote` 只保護 `activeField` 為「頂層 scalar 名」或 `day:<id>:<field>` 格式的欄位。地點名稱不在保護範圍內，即時編輯會被 Realtime 合併蓋掉。

沿用 `SettingView.jsx:55` 的 `tripName` 模式（明確儲存鈕）規避，**而不是**去擴充 `activeField` 保護邏輯 —— 後者會動到已通過 SA 驗收的同步核心。

---

## 7. Serverless 端點規格

### 7.1 `/api/parse-post` 契約

沿用 `api/flight.js` 的 fail-soft 風格：**永遠回 200**，以 `ok` 欄位表達成功與否，讓 `src/lib/api.js` 保持簡單。

```
POST /api/parse-post
{ trip, url?, text?, images?: [{ base64, mime }], cityHint? }   // images 最多 3 張

200 { ok: true,
      via: "text" | "oembed" | "og" | "image",
      source: { platform, url },
      collection: { title, summary },
      places: [ { name, nameJa, category, area, note, confidence } ] }

200 { ok: false,
      reason: "need_text_or_image" | "no_places" | "too_large" | "rate_limited",
      message: "<給使用者看的繁中訊息>" }
```

`cityHint` 取自該趟行程各天的城市，協助 AI 補 `area`。

### 7.2 降級階梯

| 順位 | 條件 | 動作 | `via` |
|------|------|------|-------|
| **1** | **`images[]` 非空** | **多模態 LLM 讀圖，多張放進同一個 request、同一次呼叫**。若使用者同時填了 `text`（**任何長度**），一併附進同一次呼叫當作補充脈絡 | `image` |
| 2 | `text` 長度 ≥ 40 | 直接餵 LLM | `text` |
| 3 | YouTube / TikTok URL | 官方 oEmbed（公開、免金鑰、可靠）取 title + author → LLM | `oembed` |
| 4 | 其他 URL | 伺服器 fetch，正則取 `og:title` / `og:description`。Threads、小紅書常成功；**Instagram 幾乎必失敗**（機房 IP 撞登入牆）。description < 40 字視為失敗 | `og` |
| 5 | 皆失敗 | `ok:false, reason:"need_text_or_image"` | — |

> **順位 1 是 2026-09-02 的修正。** 原本 `images[]` 排在第 4、在 og:meta 之下 —— 那是「截圖只是輔路徑」
> 時代的排序。T-98 之後截圖成為 IG 唯一可行的內容路徑，若還排在後面，會出現兩種錯誤：
> ① 使用者上傳了截圖卻因為 og 僥倖回了一段無關文字而**完全不看圖**；
> ② 使用者只打了「一蘭 中洲店」這種 < 40 字的短提示 + 3 張截圖，短文字構不成順位 2、圖又排在後面。
> **新規則單純且不會再錯：有圖就一定讀圖，文字（不論長短）併進同一次呼叫當補充。**

**第 5 順位的 UI 處理是整個功能體驗的關鍵**：不跳錯誤頁、不清空使用者輸入，保留 URL 並依平台聚焦（IG → 截圖選擇器；其他 → 貼文文字欄）。

### 7.3 結構化輸出

強制 tool-use（`tool_choice: {type:"tool", name:"save_places"}`），schema：

```
title      string   貼文主題,繁中,15 字內
summary    string   一句話重點,30 字內
places[]   maxItems 12
  name       string  店名/景點名,貼文原文用字
  nameJa     string  日文正式名稱;推不出來給空字串
  category   enum    spot|food|shop|move|stay|other   ← 同 ITEM_TYPE_KEYS
  area       string  城市/區域,例:福岡 中洲川端
  note       string  為什麼值得去,60 字內繁中
  confidence number  0-1,名稱抄錄正確的把握
```

系統提示重點：只抽真實存在、可在地圖上找到的店家或景點；忽略人名、標籤、廣告詞、其他城市；純風景照無具體地點則回空陣列；**名稱照貼文原文抄，不要翻譯或補字**。`temperature: 0`。

### 7.4 端點防護（無登入的 LLM 端點會被燒錢）

| 措施 | 說明 |
|------|------|
| trip key 存在性檢查 | 以 anon key 查 `trips` 表是否有該 id，擋掉隨機打點。**需要 serverless 端的環境變數 `SUPABASE_URL` / `SUPABASE_ANON_KEY`** —— 已在 git 的 `.env.production` 用 `VITE_` 前綴，Vite 只在**建置期**注入，function runtime 的 `process.env` 讀不到。**2026-09-02 實地查證 Vercel 後台後撤銷此顧慮**：`VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY` **早已存在於 Vercel 專案設定**（Production and Preview 於 Jun 1 建立，另有 Development 兩份）。Vercel 後台的環境變數對 serverless function 的 `process.env` 一律可見，`VITE_` 前綴只對 Vite 有意義（決定注入前端 bundle 的白名單），Vercel 不依前綴過濾 —— 同專案的 `AERODATABOX_KEY` 即為現成佐證（`api/flight.js` 用 `process.env.AERODATABOX_KEY` 讀取）。

**結論：不需要新增任何環境變數，無需任何手動設定。** 實作時依序讀取：

```js
const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
```

無前綴的名稱排在前面，日後若有人改用標準命名可無縫接手。**兩者任一缺失即跳過 trip key 檢查、只保留 IP 限流並在 log 留警告**，不得因缺變數而讓端點整個失效 |
| 每 IP 滑動視窗限流 | 記憶體 `Map`，如 20 次/小時。冷啟動會重置，防護力弱但免費且有摩擦力 |
| 地點數上限 | schema `maxItems: 12` + 回傳後 `slice(0, 12)` |
| 圖片大小上限 | **每張** base64 ≤ 4MB、**總量 ≤ 10MB**、**張數 ≤ 3**。**三道上限前後端都要做** —— 前端擋是為了不送註定失敗的請求、也不浪費每 IP 的額度；後端擋是防護（前端可繞過），且**必須排在 LLM 呼叫與 Supabase 查詢之前**，4MB 的 body 不該先去打 Supabase |
| `too_large` 訊息 | 三種觸發要有**各自的文案**（「最多 3 張」／「這張截圖太大」／「幾張加起來太大」）。「選超過 3 張」不是「太大」。前端一律優先顯示後端回傳的 `message`，不得自寫一句通用文案蓋掉 |

### 7.5 截圖壓縮參數

`src/lib/image.js` 目前壓到 **320px / q0.6**（給購物清單縮圖用），這個尺寸**讀不出 Reels 截圖上的日文店名**。新增第二組常數 **`OCR_MAX = 1568`** / **`OCR_QUALITY = 0.85`**（T-99 實測定案，見 §7.5d），**不修改既有預設值**（購物清單仍用 320px / q0.6）。

### 7.5a 兩個會靜默失敗的實作陷阱（2026-09-02 補，已核對程式碼）

| # | 陷阱 | 事實 | 後果 |
|---|------|------|------|
| 1 | **`compressImage()` 回傳的是 data URL，不是純 base64** | `src/lib/image.js` 結尾為 `resolve(canvas.toDataURL("image/jpeg", quality))`，字串帶 `data:image/jpeg;base64,` 前綴 | 契約要的是純 base64。**漏掉去前綴那一行不會拋任何錯**，只會讓 LLM 讀圖失敗、回空清單，看起來像「AI 讀不懂」。前端 `toImages()` 必須明確 strip |
| 2 | **`useConfirm.ask(message)` 不收 options** | `src/hooks/useConfirm.js` 的 `ask` 只接 `message`，`confirmProps` 也只傳 `message` | C-16 的 `subtitle` 傳不進去。**改 `ConfirmSheet` 的同時必須一起改 `useConfirm`**，否則 S-17「要放棄修改嗎？」底下仍會出現刪除警告 |

---

### 7.5d T-99 OCR 參數實測結果（2026-09-02，**已完成**）

依 Anthropic 官方 vision 文件（已查證）：

| 事實 | 值 |
|------|-----|
| 視覺 token 公式 | `⌈寬/28⌉ × ⌈高/28⌉`（28×28 patch）|
| `claude-haiku-4-5` 所屬 tier | **Standard**（高解析 tier 僅 Claude 4.7 之後的模型）|
| Standard tier 上限 | **最長邊 1568px、視覺 token 1568**。超過任一項會被**伺服器端自動縮小** |
| 單張圖大小上限 | **10MB** base64（Claude API 直連；Bedrock／Vertex 才是 5MB）|
| 單次請求大小上限 | 32MB |
| 每次請求圖片張數 | 200K context 模型 100 張（我們限 3 張是產品決定，不是技術限制）|
| 官方多圖建議 | **每張圖前加一個短文字標籤（`Image 1:`、`Image 2:`）** —— 與 §7.5c 的組裝規則一致 |
| 官方品質警告 | 「heavy JPEG compression can make text difficult to read」、「your image might be resized… this might make text less legible」|

**實測**：以 390pt 寬、含 5 家日文店名的 IG 貼文版型渲染成 3x（2340×4680）後，套 `compressImage` 的縮放邏輯：

| 設定 | 輸出像素 | 視覺 token | 3 張成本 | 日文店名可讀性 |
|------|---------|-----------|---------|--------------|
| `OCR_MAX=1024` / q0.7（原設定）| 512×1024 | 703 | ≈USD $0.002 | 店名可讀，**灰色小字（區域／備註）明顯發糊** |
| `OCR_MAX=1568` / q0.85（**採用**）| 784×1568 | 1568 | ≈USD $0.005 | **店名與小字皆銳利** |
| 原圖不縮 | 2340×4680 | 3822 | — | 超過上限，**會被伺服器端再縮一次**（雙重重採樣，反而更糟）|

**裁定：`OCR_MAX = 1568`、`OCR_QUALITY = 0.85`。**

三個理由：

1. **1568 正好是 Haiku 4.5 的原生上限。** 再大會被伺服器端縮一次（等於重採樣兩次，比一次縮到位更糟）；再小是白白丟字。
2. **檔案大小完全不是瓶頸。** 1568/q0.85 是 155KB、base64 約 207KB —— 只用掉單張 10MB 額度的 **2%**。原本設 1.4MB 的每張上限是我算錯了（誤記為 5MB 且過度保守），一併放寬。
3. **官方明文警告過度 JPEG 壓縮會讓文字難讀**，而我們沒有任何省空間的理由。

**連帶修正**：每張上限 1.4MB → **4MB** base64、總量 4MB → **10MB**（皆遠低於 API 的 10MB/張與 32MB/請求）。

> **本測試的限制（誠實記錄）**：判讀者是 Opus，不是 Haiku 4.5。Haiku 對細小文字較弱，所以「Opus 讀得出來」不等於「Haiku 讀得出來」。
> 這是選 1568 而非 1024 的另一個理由 —— 把餘裕留給較弱的模型。真正的驗證要等端點接起來後用實際回傳結果比對。

---

### 7.5b 多張截圖（`images[]`，2026-09-02 裁定）

**問題**：原契約 `imageBase64` 是單數。但清單型 IG 貼文（「福岡必吃 5 家」—— 正是本專案的起始範例）
caption 展開後常超過一屏，**一張截圖裝不下全部店名**。只收單張，IG 這個主平台的主路徑等於半殘。

**裁定：擴充為 `images[]`，上限 3 張。**

| 項目 | 規格 |
|------|------|
| 前端 | `<input type="file" accept="image/*" multiple>`；逐張 `compressImage({max: OCR_MAX, quality: OCR_QUALITY})`，即 **1568 / 0.85**（見 §7.5d）|
| 送出 | 3 張放進**同一個** request、**同一次** LLM 呼叫（同一則貼文的上下文不該被切開）|
| 上限 | 每張 base64 ≤ **4MB**、總量 ≤ **10MB**、張數 ≤ 3（API 實際允許 10MB/張、32MB/請求，見 §7.5d）|
| 成本 | 784×1568 = **1568 視覺 tokens/張**，3 張約 4.7k ≈ **USD $0.005**（Haiku $1/MTok），仍在預算內 |
| UI | 顯示已選張數（「已選 2 張」）並可逐張移除；**不得**讓使用者以為要一張一張分次收藏 |

**理由**：本專案的動機範例就是列 5 家店的貼文。收單張會讓最典型的案例失敗，而擴充成本極低。

---

### 7.5c 多圖的 LLM 組裝規則（2026-09-02 補，**不可省略**）

單純把 3 個 image block 疊起來送，模型會傾向當成 3 則獨立內容，回出多組 `title` 或重複地點。
而連續截圖**必然重疊**（caption 上下半段會有重複行），重複的地點列又會被 `dedupeAgainstSaved()`
標成「已存過」→ 預設不勾 → **使用者以為店掉了**。因此組裝必須：

1. 每張圖前放一個 text block 標明「**第 N 張截圖（共 M 張）**」
2. **指示文字放在所有圖片之後**（不是之前）
3. 指示中明寫：「這是**同一則貼文**的連續畫面，只產生**一組** `title` / `summary`，**同一家店只回一次**」
4. 使用者填的 `text` 併在指示之前，標明為「使用者補充」

強制 tool-use 在 `claude-haiku-4-5` 上不受多圖影響；`max_tokens` 維持 2048 即可（多圖增加的是 input）。

---

### 7.6 `/api/geocode` 契約（F-84 / F-86）

```
POST /api/geocode
{ trip, queries: [ { id, nameJa, name, area } ] }        // 批次,自動層
{ trip, id, resolve: "https://maps.app.goo.gl/xxxx" }    // 單筆,補位置層

200 { ok:true, results:[ { id, lat, lng, source, query } ] }   // 查無者 lat/lng 為 null
200 { ok:false, reason:"no_coords_in_url" | "rate_limited", message }
```

**自動層**（batch）處理順序：

1. 對每個查詢字串算 `sha1`，先查 `geo_cache`。**命中就直接用，包含「查過但沒找到」的空結果** —— 這是避免重複打外部服務最重要的一環。
2. 未快取者，依序試 `nameJa + " " + area` → `name + " " + area` → `nameJa`。
3. 供應商順序 **Photon → Nominatim**。Nominatim 需帶可辨識的 `User-Agent` 並遵守 **1 req/s**；伺服器端序列化處理天然滿足。加 `countrycodes=jp` / `lang=ja` 提高日本命中率。
4. 結果（含 null）一律寫回 `geo_cache`。

**補位置層**（`resolve`）：`fetch` 該 URL 並跟隨轉址（`maps.app.goo.gl` 短網址必須 follow redirect），對最終 URL 套 `/@(-?\d+\.\d+),(-?\d+\.\d+)/` 抽座標。**部分 Google Maps 連結只含地址不含 `@` 座標**，此時回 `reason:"no_coords_in_url"` 並給出可行動的指引，不得只說失敗。

**防護**：沿用 `/api/parse-post` 的 trip key 存在性檢查與每 IP 限流；批次上限 20 筆。

---

## 8. 開發分期與 commits 規劃

### Phase 0（單獨上線）

| # | Commit | 範圍 |
|---|--------|------|
| P1 | `Preserve unknown fields through schema migration` | `src/lib/migrate.js` + 回歸測試。**不升版號**，上線後等傳播完成 |

### Phase 1 — 分支 `feature/pocket-places-core`

| # | Commit | 範圍 |
|---|--------|------|
| P2 | `Add pockets and places to schema version 5` | `schema.js` / `migrate.js` / `merge.js` + 測試。item 可帶 `placeId`；**不**加 `place.usedIn` |
| P3 | `Add stamped mutators for pockets and places` | `useTrip.js`（含精簡 tombstone、`addPlaceToDay` 寫入 item.placeId）|
| P4 | `Add post parsing endpoint` | `api/parse-post.js` + `src/lib/api.js` |
| P5 | `Add screenshot preset to image compression` | `src/lib/image.js` |
| P6 | `Add Pocket view with paste ingest` | `src/views/places/*` + `src/lib/places.js`，含 F-72 覆核、F-76 試算、**F-78 離線暫存待解析**（原漏列，2026-09-01 補）。**連結與貼文文字並列主欄** |
| P7 | `Add Pocket tab to app shell` | `App.jsx` / `BottomNav.jsx` |
| P8 | `Add place detail sheet and suggested day picker` | `PlaceSheet.jsx` / `DayPickerSheet.jsx` + `suggestDays()` |
| P9 | `Add iOS shortcut share entry` | F-81 設定頁捷徑卡片 + F-83 `?share=` 開機處理。IngestSheet 為共同終點 |
| P10 | `Surface sync validation errors in the header` | F-77 |

**P2–P10 即為可上線 MVP**（9 個 commit，符合上限）：貼上連結／文字或走捷徑 → 結構化地點 → **建議哪一天** → 寫入行程 → `openMap()`。不含地圖、不含當日路線。

### Phase 1.5 — 分支 `feature/pocket-places-map`（加分，不擋 MVP）

> 2026-09-01 下午 CEO 拍板：地圖從主賣點**降為加分**。獨立分支是因為 geocode／圖磚有自己的失敗模式，混進核心迴路會拖慢「靈感進行程」上線，也讓 SA 難以切分驗收。
>
> **自動定位不是賣點。** 若做這一支，座標的真實主路徑是 F-86 補位置。

| # | Commit | 範圍 |
|---|--------|------|
| M1 | `Add geocoding endpoint with result cache` | `api/geocode.js`、`supabase-schema.sql` 的 `geo_cache` 表、Photon→Nominatim 階梯 |
| M2 | `Geocode saved places in the background` | `useTrip.js` 背景補座標 + `src/lib/geo.js` |
| M3 | `Add map view to the Pocket tab` | `MapView.jsx`（`React.lazy`）、Leaflet 依賴、`divIcon` 分類色 pin、未定位區塊 |
| M4 | `Add manual location fallback` | `LocateSheet.jsx` + `api/geocode.js` 的 `resolve` 分支 |
| M5 | `Add nearby places sorted by distance` | `NearbyList.jsx`、`navigator.geolocation`、`haversine()` |
| M6 | `Add day route links to day cards` | F-80：`src/lib/route.js` + `DayCard.jsx`（含 3 中途點截斷提示）。**不得包裝成交通規劃** |
| M7 | `Export saved places as a My Maps CSV` | F-79（選配，次要選單）|
| M8 | `Split the map bundle into its own chunk` | `vite.config.js` `manualChunks` |

**M4→M5 比滿城 pin 更接近現場使用。** M6／M7 是加值。

### Phase 2 — 分支 `feature/pocket-places-share`（Android／桌機）

> iOS 捷徑（F-81／F-83）已在 Phase 1，規格見 §4.2。本階段只補 Chromium 的 `share_target`。

| 編號 | 功能 | 規格 |
|------|------|------|
| **F-82** 🆕 | **PWA share_target（Android／桌機 Chrome）** | Phase 2。`vite.config.js` 的 manifest 加 `share_target: { action:"/", method:"GET", params:{ title:"share_title", text:"share_text", url:"share" } }`。**僅 GET**；POST + `files` 需改用 `injectManifest` 手寫 service worker，不划算 |

**圖片走捷徑（Phase 3 再評估）**：URL 參數帶不動圖片。需要 `api/inbox.js` + 一張 `place_inbox` 暫存表，捷徑改用 `取得 URL 內容` POST base64。在那之前，「截圖存相簿 → 開櫻旅 → 從相簿選」只多兩下點擊，先不做。

### Phase 3（更遠，僅記錄方向）

地圖長按手動放 pin（座標第三層）；截圖走 iOS 捷徑（需 `api/inbox.js` + `place_inbox` 表）；
Supabase Storage 存地點照片；tombstone 90 天壓縮。

---

## 9. 技術風險與對策

| # | 風險 | 嚴重度 | 對策 |
|---|------|--------|------|
| 1 | 舊版 client 清空雲端 `places`/`pockets`（**已於規劃階段實證**）| 🔴 高 | F-69 單獨先上線 + `...raw` 穿透 + `> SCHEMA_VERSION` early-return |
| 2 | IG 連結抓不到內文，caption 也複製不了（T-98 實證）| 🟠 中 | **IG 主路徑是截圖**（F-71，v3.6 修正；此列原寫「主路徑是貼文文字」為改版殘留）。截圖引導必須具體到「展開後的 caption 或字幕」。F-72 強制覆核、低 confidence 預設不勾、**絕不自動寫入**。失敗依平台分流聚焦（IG→截圖選擇器 / 其他→文字欄），不得跳錯誤頁 |
| 3 | 無登入 LLM 端點被濫用燒錢 | 🟠 中 | trip key 檢查、IP 限流、地點數／圖片大小上限、可一鍵切 Gemini 免費層 |
| 4 | 1MB jsonb 上限與既有購物清單照片共用 | 🟠 中 | F-76 900KB 預先試算、精簡 tombstone、絕不存圖片 bytes、F-77 讓牆有說明 |
| 5 | Tombstone 無限增長（58B/筆，從不壓縮）| 🟡 低 | 先用精簡 tombstone；500 次刪除約 29KB 可接受。真的痛再做 90 天壓縮（需接受長期離線裝置的復活風險）|
| 6 | 沒有座標 = 沒有地圖總覽，與示範影片有落差 | 🟡 低 | **CEO 已拍板：地圖降為加分。** MVP 不依賴座標。`lat`/`lng`/`geoSource` 仍預留 |
| 7 | 離線時無法解析 | 🟡 低 | F-78 存成「待解析」pocket，回線重試 |
| 8 | `grid-cols-6` 被 Tailwind purge | 🟡 低 | 明確 class 對照表，禁用字串內插 |
| 9 | **OSM 對日本中小型店家覆蓋不足；公開 Photon 是 demo** | 🟠 中 | 僅影響 Phase 1.5。不承諾自動命中率。若做地圖，補位置（F-86）才是座標主路徑。T-91 實測 < 40% 就把補位置提到更顯眼 |
| 10 | Google Maps 分享連結不一定含 `@lat,lng` 座標 | 🟠 中 | 部分連結只帶地址。F-86 必須給出可行動指引（「請在地圖上點該店家後再複製一次」），不得只回失敗。必要時第三層手動放 pin 保底 |
| 11 | OSM 圖磚使用政策：不適合高流量應用 | 🟡 低 | 櫻旅為家庭規模，屬容許範圍；必須標註 `© OpenStreetMap contributors`。用量成長就改 OpenFreeMap（同樣免金鑰）|
| 12 | Leaflet 讓已達 555KB 的 bundle 更大 | 🟡 低 | `React.lazy` + 動態 `import`，地圖切成獨立 chunk，只在切到地圖檢視時下載。順帶處理 SA 留下的 code-split 建議 |
| 13 | 離線時圖磚載不出來 | 🟡 低 | 明確顯示「離線時無法載入地圖」，**清單與「附近」的距離排序仍完全可用**（座標已存在本地）。不做圖磚的 runtime cache（快取會無上限成長）|
| 14 | Google Maps 路線 URL 手機上限 3 個中途點 | 🟡 低 | F-80 明文截斷並在 UI 標示「僅含前 5 站」，不得靜默丟棄 |
| 15 | 使用者誤以為可以連結 Google 帳號同步「我的清單」 | 🟡 低 | §1.5.1 已載明無此 API；UI 不得出現任何暗示可同步 Google 收藏的文案 |
| 16 | F-79 CSV 送不出 iPhone | 🟢 極低 | 已降為選配，不影響主路徑。`navigator.canShare({files})` 探測，退路是可全選複製的文字框 |

---

## 10. SA 測試規則

### 資料層（最高優先）

| 編號 | 測試規則 |
|------|---------|
| **T-70** | **v5 資料餵給 v4 邏輯不得掉欄位** —— 建構含 `pockets`/`places` 的 v5 blob，以修正後的 `migrate()` 處理，斷言未知欄位完整保留（F-69 回歸測試）|
| **T-71** | `migrate()` 對 `schemaVersion > SCHEMA_VERSION` 直接回傳原物件，不做任何改寫 |
| **T-72** | v4 → v5 遷移冪等：連續執行兩次結果相同；既有 `days`/`expenses`/`food` 等資料零損失 |
| **T-73** | `mergeList` 對 `places` 是**整筆 LWW**（不是欄位級）。兩端同時改同一地點的不同欄位，較新的 `updatedAt` 整筆勝出。測試須鎖定此語意，不得誤寫成欄位合併 |
| **T-74** | 精簡 tombstone 存活：A 端刪除地點、B 端離線編輯同一地點後回線，刪除必須維持（不得復活）|
| **T-75** | `validateTrip` 對 `pockets`/`places` 中缺少 string `id` 的項目回傳失敗 |

### 端點與解析

| 編號 | 測試規則 |
|------|---------|
| **T-76** | `/api/parse-post` 五個降級分支各自可達，且失敗一律回 200 + `ok:false` |
| **T-77** | 缺 `text` 與 `images` 且 URL 抓不到內容 → `reason:"need_text_or_image"` |
| **T-78** | 超過 12 個地點的回應被截斷至 12 個 |
| **T-79** | 不存在的 trip key → 拒絕呼叫 LLM |

### UI 與整合

| 編號 | 測試規則 |
|------|---------|
| **T-80** | F-72 覆核步驟未按確認前，`trip.data.places` 不得有任何變化 |
| **T-81** | `confidence < 0.6` 的列預設未勾選；同名既有地點顯示「已存過」且預設未勾選 |
| **T-82** | F-76 容量試算：構造接近 900KB 的 trip，新增地點被擋下且未寫入 |
| **T-83** | F-75 加入行程後，新 `days[].items[]` 帶正確 `placeId`；口袋列的「已加入 D*n*」badge 由 `daysForPlace(placeId, days)` **即時反查**得出，不另存狀態、因此不存在不一致的中間狀態（2026-09-01 修正措辭，原寫法殘留已廢棄的 `usedIn` 設計）。同一 `placeId` 可出現在多天，badge 須列出全部 |
| **T-84** | 加入行程後的項目，其 `type` 與原地點 `category` 相同，且可用既有拖曳重排 |
| **T-85** | 離線時貼上連結 → 產生「待解析」pocket；回線後可重新解析 |
| **T-86** | 六格 BottomNav 在 375px 寬下每格 ≥ 44px 觸控目標，且 `grid-cols-6` 確實出現在建置後的 CSS 中 |
| **T-96** | F-81 捷徑產生的 URL 帶 `?trip=`，開啟後載入的是同一份行程；`?share=` 在 `replaceState` 後不再留在網址列 |
| **T-97** | `suggestDays`：`area: "福岡 中洲川端"` 對 `city: "福岡"` 與 `city: "博多"` 標建議；對 `city: "由布院"` 不標；城市為空不標也不擋。順序維持行程原順序 |
| **T-99** | ✅ **已於 2026-09-02 完成（見 §7.5d）**：實測後 `OCR_MAX` 由 1024 改為 **1568**、`OCR_QUALITY` 由 0.7 改為 **0.85**。實作時若再調整這兩個常數，須重跑同樣的對照並回寫 §7.5d |
| **T-98** | **主路徑實機驗證（驗收關鍵項）**：在 iPhone 實機上，從 IG Reels 取得「店名那段文字」到貼進櫻旅為止全程可完成，並記錄實際步數。若 caption 無法順利選取複製，須把 F-71 截圖升回並列主路徑並回寫本 PRD |

### 地圖加分（僅 Phase 1.5 驗收，不列入 MVP）

| 編號 | 測試規則 |
|------|---------|
| **T-87** | F-84 `geo_cache` 命中時不得再打外部供應商；**「查過但沒找到」的空結果同樣要命中快取**（防重複查詢）|
| **T-88** | F-84 查詢字串依 `nameJa + area` → `name + area` → `nameJa` 的順序嘗試；`nameJa` 為空時跳過第一與第三順位 |
| **T-89** | F-85 未定位地點**不得從清單中消失**；未定位區塊的地圖鈕與補位置鈕皆可用；零個地點有座標時不渲染空地圖 |
| **T-90** | F-86 `maps.app.goo.gl` 短網址能跟隨轉址並抽出座標；不含 `@` 的連結回 `no_coords_in_url` 並顯示可行動指引 |
| **T-91** | **（僅 Phase 1.5）** 取 5 則真實日本旅遊 IG 貼文跑 geocode，記錄自動定位命中率。低於 40% 須把「補位置」提到更顯眼。**不列 MVP 通過條件** |
| **T-92** | F-87 使用者拒絕定位權限時退回一般清單，不重複索取；距離計算以 haversine 驗證已知兩點誤差 < 1% |
| **T-93** | F-85 地圖為獨立 chunk：建置產物中 Leaflet **不在主 bundle 內**，且未切到地圖檢視時不會下載 |
| **T-94** | 離線狀態下地圖顯示離線訊息，但清單與「附近」距離排序仍可運作 |
| **T-95** | F-80 當某天超過 5 個可導航項目時，URL 只含 3 個中途點，且 UI 顯示截斷提示 |

### 驗收標準（沿用團隊標準）

| 結論 | 條件 |
|------|------|
| 通過 | 0 高嚴重度且中嚴重度 ≤ 3 |
| 有條件通過 | 0 高嚴重度且中嚴重度 4–10 |
| 不通過 | 任一高嚴重度，或中嚴重度 > 10 |

> **額外硬性條件**：T-70、T-71、T-83 任一失敗即直接判定不通過（資料遺失類）。T-87～T-95 僅在 Phase 1.5 驗收。
> **T-98 若失敗，不判定不通過，但必須回寫 PRD 調整主／輔路徑後才進 UI 修訂**。

---

## 附錄 A：規劃階段已實證的技術主張

| 主張 | 佐證 |
|------|------|
| `migrate()` 白名單重建會丟未知欄位 | `src/lib/migrate.js:12-48`，第 14 行僅比對相等、第 23 行起為固定欄位列表 |
| `BottomNav` 寫死五格 | `src/components/BottomNav.jsx:8` `grid-cols-5` |
| `openMap()` 可零成本導航 | `src/lib/schema.js:44`，`ItemRow.jsx` 與 `ChecklistCard.jsx` 已在使用 |
| `ITEM_TYPE_KEYS` 可直接當地點 category | `src/lib/schema.js:20` |
| `validateTrip` 的 1MB 上限與 `LIST_FIELDS` 機制 | `src/lib/schema.js:131`, `:143`, `:151-157` |
| `activeField` 保護範圍不含任意欄位 | `src/hooks/useTrip.js:46` |
| 每個 `DayCard` 各自持有 `DndContext` | `src/views/trip/DayCard.jsx:84`，`onDragEnd` 於 :33 |
| iOS Safari PWA 不支援 Web Share Target | MDN `share_target` 標示 Limited availability，Chromium-only |
| Google Places API 免費額度 | 2025-03 起改為每 SKU 分級免費額度（Essentials 10,000／Pro 5,000／Enterprise 1,000 次/月），且**仍須啟用帳單** |
| **Google 無寫入 saved lists 的 API** | Google Maps 官方說明與開發者社群一致：「我的清單／想去」僅能透過 Maps UI 操作，無 API；唯一官方出口是 Google Takeout（唯讀、手動）|
| **Maps URL 不支援多個任意圖釘** | 官方 Maps URLs 文件：無任何 action 可在一張地圖上放置多個任意標記；`map` action 依設計不顯示標記 |
| **Maps 路線 URL 中途點上限** | 官方 Maps URLs 文件明訂：中途點數量依開啟平台而異，**手機瀏覽器最多 3 個**，其他情況最多 9 個 |
| **Google My Maps 匯入規格** | 支援 CSV／TSV／XLSX／Google 試算表／KML／KMZ／GPX；單一圖層上限 2,000 個項目、單張地圖 10 個圖層／10,000 個地點；超過 2,000 列會**靜默截斷**。**匯入功能文件僅涵蓋電腦版** `mymaps.google.com` —— 這是 §1.5.2 否決它當主方案的直接原因 |
| **Photon 適合用名稱找地點** | Photon 是建在 OSM 上的 Elasticsearch 地名搜尋，擅長 search-as-you-type 與容錯拼寫，可搜尋 POI（餐廳、咖啡店）；Nominatim 強在結構化地址解析。我們手上是店名不是地址 |
| **Photon／Nominatim 皆免金鑰免註冊** | 兩者都是免費公開服務。Nominatim 須遵守 1 req/s 與可辨識 User-Agent 規範 |
| **Google Maps 短網址可伺服器端解析座標** | `maps.app.goo.gl` 為轉址網址，跟隨轉址後以 `/@(-?\d+\.\d+),(-?\d+\.\d+)/` 可抽出座標。**但部分連結只解析到地址、不含座標**，需有降級指引 |
| **OSM 圖磚免金鑰但有使用政策** | `tile.openstreetmap.org` 無需註冊或 API key，但官方政策禁止大量下載、不適合高流量應用，須標註來源。小型／業餘專案在容許範圍。免金鑰替代：OpenFreeMap（無註冊、無用量上限，惟為向量圖磚需 MapLibre）|

## 附錄 B：本版不做但已預留的升級路徑

| 未來功能 | 已預留的鉤子 |
|---------|-------------|
| 更準確的座標來源 | `geo_cache.source` 已記錄供應商；未來若願意綁卡，加 `GOOGLE_PLACES_KEY` 即可在 `api/geocode.js` 中優先使用 Places，快取層與前端完全不需改動 |
| 地點照片 | `place.photoUrl`（字串 URL）已預留，走 Supabase Storage |
| 切換免費 LLM | `PARSE_PROVIDER` 環境變數 |
| 接 Google Places | `GOOGLE_PLACES_KEY` 環境變數存在時才啟用，缺少時自動降級 |
| iOS 捷徑入口 | **Phase 1 要做**（F-81／F-83）。`?share=` 處理集中在 `App.jsx`，IngestSheet 為所有入口共同終點 |
| Android `share_target` | F-82，Phase 2 |
| 截圖走捷徑 | 需 `api/inbox.js` + `place_inbox` 表，Phase 3 再評估 |
