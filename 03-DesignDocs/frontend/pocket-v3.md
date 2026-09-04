# 前端設計文件 — 櫻旅 v3「口袋地點」

###### tags: `Frontend`, `React`, `PWA`, `offline-first`, `v3`

:::info
功能名稱：v3 口袋地點（截圖／貼上收藏 → AI 解析覆核 → 建議日期 → 寫入行程 → 導航）
版本：**3.2.2**（**2026-09-04 依 PRD v3.11 回寫**；前版 3.2.1 依 PRD v3.10、3.2.0 依 PRD v3.9、3.1.0 依 PRD v3.7 / UI spec v3.1）
最後更新：2026-09-04
作者：程式開發員
:::

> **v3.1.0 同步摘要（上游變更）**
>
> | # | 變更 | 影響章節 |
> |---|---|---|
> | 1 | `/api/parse-post` 改為 **`images[]`（≤3 張）**，前端逐張壓縮、一次送出 | §4.5、§4.6、§5.2、§6 |
> | 2 | **IngestSheet 依平台分流**（S-10 一般 / S-20 IG；S-13 / S-21 失敗分流），新增 `detectPlatform()` 於 `lib/share.js` | §3、§4.4.7、§5.2 |
> | 3 | 新增 **C-29 Toast**（落在 `components/ui.jsx`，不另開檔）與 **C-30 ShotPicker** | §3、§5.3b、§5.3c |
> | 4 | **C-16 ConfirmSheet 加選填 `subtitle`**（預設＝現有硬寫字串，既有 4 個呼叫點不改）| §5.6 |
> | 5 | `PLACE_WARN_BYTES = 800_000`、`pocket.rawText` / `pocket.pending` 皆已進 PRD，疑點結案 | §4.4.6、§5.4、§8 |
> | 6 | **F-78 對 IG 的限制裁定 MVP 不解決**：不做 blob 暫存，只誠實標示（S-06b）| §5.2、§5.4 |
> | 7 | 新增 **T-99**（OCR 參數實測，人工實機）；**T-98 已完成**（結論：截圖為 IG 主路徑）| §7.2 |

> **v3.2.0 同步摘要（2026-09-03 依 PRD v3.9 回寫）**
>
> **T-99 已於 2026-09-02 完成**（PRD §7.5d），本文件 v3.1.0 仍寫著實測前的暫定值。
> §4.6 是 F5「多張截圖管線」的直接實作依據，**這裡的數值錯了會直接做錯**，故整節回寫：
>
> | 常數 | v3.1.0（暫定） | **PRD v3.9（實測定案）** |
> |---|---|---|
> | `OCR_MAX` | 1024 | **1568** |
> | `OCR_QUALITY` | 0.7 | **0.85** |
> | `MAX_SHOT_B64`（每張）| 1_400_000（1.4MB）| **4_000_000（4MB）** |
> | `MAX_SHOTS_B64_TOTAL`（總量）| 4_000_000（4MB）| **10_000_000（10MB）** |
>
> 影響章節：§3（檔案樹註解）、**§4.6**、§7.2（技術難點 10 / 15）、§7.3（T-99 驗收方式）。
> 另：後端新增 `reason: "not_configured"`（缺供應商金鑰），前端沿用「原樣顯示後端 `message`」的既有處理，
> **不需新增分支**（見 [cross-check-v3.md](../cross-check-v3.md) §3）。

> **v3.2.1 同步摘要（2026-09-04 依 PRD v3.10 回寫）**
>
> 上游由 v3.9 進到 **v3.10**（§7.5c 裁定 Q-12 的 `max_tokens` 4096；§7.1／§7.4 裁定 Q-13 的錯誤碼與
> 「限流 ↔ trip 不存在逐字不可區分」）。這兩項都落在後端，前端**沒有任何行為變更**，本次只做兩件事：
>
> | # | 變更 | 影響章節 |
> |---|---|---|
> | 1 | 全文版本引用 v3.9 → **v3.10** | 標頭、§1、§4.6 |
> | 2 | `failReason` 的 union 補上 **`not_configured`** 與新增的 **`upstream_error`**（供應商呼叫失敗，由 `rate_limited` 拆出）。兩者都走既有的「未知 reason **原樣顯示後端 `message`**」分支，**仍然不需新增 UI 分支**；補進型別只是不讓 union 對不上後端契約 | §5.2 |
>
> 本文件為**增修**，不取代 [app-v2.md](app-v2.md) v1.0.0；v2 的元件結構、`useTrip` 資料流、同步引擎規格全數繼續有效。
> 涵蓋範圍＝ **PRD §8 的 MVP（P1–P10）**：F-69～F-78、F-81、F-83。
> **不涵蓋**：Phase 1.5 地圖（F-79／F-80／F-84～F-87）、Phase 2 `share_target`（F-82）。

## 1. 相關連結

- PRD：[../../01-PRD/PRD-v3-pocket-places.md](../../01-PRD/PRD-v3-pocket-places.md)（**v3.11**）
- UI 規範：[../../02-Design/ui-spec-v3-pocket.md](../../02-Design/ui-spec-v3-pocket.md)（**v3.1**：P-06、C-18～**C-30**、S-01～**S-21**、DDR-09～**DDR-32**）
- UI 原型：[../../02-Design/prototype-v3-pocket.html](../../02-Design/prototype-v3-pocket.html)
- 後端 / 資料契約：[../backend/parse-and-schema-v3.md](../backend/parse-and-schema-v3.md)
- v2 前端文件（繼續有效）：[app-v2.md](app-v2.md)
- 交叉比對：[../cross-check-v3.md](../cross-check-v3.md)
- Commit 計畫：[../commits-plan-v3.md](../commits-plan-v3.md)

## 2. 功能概述與目標

- **功能描述**：補上櫻旅唯一的斷點——**輸入端**。使用者把 **Instagram 的截圖**（最多 3 張）或 Threads／小紅書／TikTok／YouTube 的連結與貼文文字丟進來（或走 iOS 捷徑），端點解析成結構化地點，經**人工覆核**後存進口袋；口袋裡的每個地點可一鍵導航，或用**帶「建議」的日期選擇**寫進行程。
- **v3.1 的前提修正**：T-98 實機驗證推翻了「貼文文字是 IG 主路徑」的假設（IG caption 選不起來），
  因此 **IngestSheet 依平台分流**：IG 走截圖（S-20）、其他平台走連結／文字（S-10）。
  分流只改**排版順序、視覺主次與文案**，欄位集合／送出邏輯／覆核／容量檢查完全共用（DDR-26）。
- **技術目標**：
  - 新資料**完全寄生**在既有 `useTrip` / `sync.js` / `merge.js` / Dexie 上，零新增同步機制。
  - 所有「規則」（同名判定、建議日期、反查已加入、容量試算、地點→項目映射）抽成 `src/lib/places.js` 的**純函式**，讓高風險邏輯 100% 可被 vitest 覆蓋。
  - **不碰任何已通過 SA 驗收的核心**：不擴充 `activeField` 保護、不動 `DndContext`、不改 `mergeDays`。
  - `IngestSheet` 是**所有入口的共同終點**（C-18 按鈕、S-01 空狀態按鈕、`?share=` 捷徑、S-06 重新解析），不得為任何入口另開畫面。
- **範圍限制**：MVP 不含地圖檢視、不含座標、不含當日路線、不含 CSV 匯出。`nameJa` 唯讀（DDR-15b）。

---

## 3. 元件結構圖

`(C)` = Container（持有狀態／呼叫 mutator）｜`(P)` = Presentational

```
App.jsx (C)                                   # 🔧 6 tab、?share= 開機處理、onGoTab
│
├── components/
│   ├── Header.jsx (P)                        # 🔧 多收 syncReason / onGoTab
│   │   ├── SyncStatusBadge.jsx (P)           # 🔧 C-12「失敗·看原因」+ aria-expanded
│   │   ├── SyncReasonNote.jsx (P)            # 🆕 C-28
│   │   └── OfflineBanner.jsx (P)             # 沿用（與 C-28 互斥）
│   ├── BottomNav.jsx (P)                     # 🔧 C-05 五格 → 六格（明確 class 對照表）
│   ├── ConfirmSheet.jsx (P)                  # 🔧 C-16 加選填 subtitle prop（Q-06 已裁定）
│   ├── ui.jsx (P)                            # 🔧 加 Toast（C-29）—— 不另開新檔（DDR-29）
│   └── DragHandle.jsx (P)                    # 沿用
│
├── views/
│   ├── trip|money|lists|album (C)            # 完全不動
│   ├── setting/
│   │   ├── SettingView.jsx (C)               # 🔧 插入 ShortcutCard
│   │   └── ShortcutCard.jsx (P)              # 🆕 C-26（F-81）
│   └── places/                               # 🆕 全新資料夾
│       ├── PocketView.jsx (C)                # P-06 外殼 + C-18 IngestBar + C-27 CapacityNotice
│       ├── IngestSheet.jsx (C)               # C-19 依平台分流（S-10/S-20）
│       │                                     #   內含 C-20 ReviewRow (P) 與 C-30 ShotPicker (P)
│       ├── PocketCard.jsx (C)                # C-21
│       ├── PlaceRow.jsx (P)                  # C-22
│       ├── PlaceSheet.jsx (C)                # C-23
│       ├── DayPickerSheet.jsx (C)            # C-24（內含 C-25 DayChip (P)）
│       └── constants.js                      # 僅 re-export trip/constants.js 的 ITEM_TYPES
│
├── hooks/
│   ├── useTrip.js                            # 🔧 6 個新 mutator + syncReason
│   └── useConfirm.js                         # 沿用
│
└── lib/
    ├── schema.js   # 🔧 v5、pockets/places 預設、LIST_FIELDS、容量常數、reason
    ├── merge.js    # 🔧 mergeTrip 兩行 + 未知欄位穿透（F-69）
    ├── migrate.js  # 🔧 F-69 + pockets/places stamp
    ├── places.js   # 🆕 純函式：placeToItem / pocketBytes / dedupeAgainstSaved /
    │               #          suggestDays / daysForPlace / normalizeName / capacityCheck
    ├── share.js    # 🆕 parseShareParams / stripShareParams / shortcutPrefix
    │               #    + detectPlatform（PRD §5.3 §6.2 裁定落位;比對 hostname,禁用 includes）
    ├── image.js    # 🔧 新增 OCR_MAX = 1568 / OCR_QUALITY = 0.85（不動既有 THUMB_* 預設）
    └── api.js      # 🔧 新增 parsePost()（images[] 契約）
```

**元件 ↔ UI spec 編號 ↔ props 契約總表**

| UI 編號 | 元件 | 類型 | 檔案 | 對應 F-XX |
|---|---|---|---|---|
| C-05 | BottomNav（增修） | P | `components/BottomNav.jsx` | F-73 |
| C-12 | SyncStatusBadge（增修） | P | `components/SyncStatusBadge.jsx` | F-77 |
| C-16 | ConfirmSheet（微增修：選填 `subtitle`） | P | `components/ConfirmSheet.jsx` | F-73（+ S-17）|
| C-18 | IngestBar | P | `views/places/PocketView.jsx` 內 | F-70 |
| C-19 | IngestSheet（**依平台分流**） | C | `views/places/IngestSheet.jsx` | F-70/71/72/78/83 |
| C-20 | ReviewRow | P | `views/places/IngestSheet.jsx` 內 | F-72 |
| C-21 | PocketCard | C | `views/places/PocketCard.jsx` | F-73/78 |
| C-22 | PlaceRow | P | `views/places/PlaceRow.jsx` | F-73/74/75 |
| C-23 | PlaceSheet | C | `views/places/PlaceSheet.jsx` | F-74/75 |
| C-24 | DayPickerSheet | C | `views/places/DayPickerSheet.jsx` | **F-75** |
| C-25 | DayChip | P | `views/places/DayPickerSheet.jsx` 內 | F-75 |
| C-26 | ShortcutCard | P | `views/setting/ShortcutCard.jsx` | F-81 |
| C-27 | CapacityNotice | P | `views/places/PocketView.jsx` 內 | F-76 |
| C-28 | SyncReasonNote | P | `components/SyncReasonNote.jsx` | F-77 |
| **C-29** | **Toast** | P | **`components/ui.jsx`**（不另開新檔，PRD §6.2／DDR-29）| F-72／F-75 的操作回饋 |
| **C-30** | **ShotPicker** | P | `views/places/IngestSheet.jsx` 內（DDR-31）| **F-71（IG 主路徑）** |

---

## 4. 邏輯拆分與資料流

### 4.1 資料流總覽

```
                    ┌── C-18 按鈕 ─┐          detectPlatform(url) → mode: "ig" | "general"
?share= (F-83) ─────┤   S-01 按鈕  ├──→ C-19 IngestSheet ──→ api.parsePost({ …, images[] })
S-06 重新解析 ──────┘              │            │  （排版分流:S-10 / S-20;失敗分流:S-13 / S-21）
                                   │            ├─ 離線 → trip.addPocket({pending:true})
                                   │            └─ ok:true → 覆核(本地 state,零寫入)
                                   │                    │
                                   │      capacityCheck(data, pocket, places)  ← lib/places.js
                                   │                    │ ok
                                   └────────────────────┴→ trip.addPocketWithPlaces()  ← 單次 commit
                                                                    │
                              既有 commit → IndexedDB → 佇列 → sync.pushRemote（完全沿用）
                                                                    │
  P-06 ── PocketCard ── PlaceRow ──┬─ 📍 openMap(name + " " + area)              (F-74)
                                   ├─ ＋ DayPickerSheet ─ suggestDays() ─ trip.addPlaceToDay()  (F-75)
                                   └─ 點整列 → PlaceSheet ─「儲存」→ trip.updatePlace()  (§6.4)
                                        badge ← daysForPlace(placeId, days)      ← 每次 render 反查
```

### 4.2 `useTrip` 新增 mutator（完整簽名）

全部沿用既有 `commit()` 管線（蓋 `updatedAt` → `apply` → `saveTrip(dirty)` → `schedulePush`），**不新增任何同步機制**。

```typescript
interface PocketMutators {
  /** F-72 唯一的寫入點。pocket 與 N 個 place 在【同一次 commit】內寫入。 */
  addPocketWithPlaces(
    pocket: Partial<Pocket>,
    places: Array<Partial<Place>>
  ): { pocketId: string; placeIds: string[] };

  /** F-78 離線暫存 / 手動建立空 pocket。 */
  addPocket(pocket: Partial<Pocket>): string;             // 回傳 pocketId

  /** S-13「自己輸入一個地點」的退路，以及未來手動新增。pocketId 傳 "" 即為 S-07。 */
  addPlaces(places: Array<Partial<Place>>): string[];

  /** C-23 明確「儲存」鈕。patch 只含使用者改過的欄位。 */
  updatePlace(id: string, patch: Partial<Place>): void;

  /** F-78：待解析 pocket 重新解析成功後，把它轉正並補上地點（單次 commit）。 */
  resolvePocket(
    pocketId: string,
    pocket: Partial<Pocket>,
    places: Array<Partial<Place>>
  ): string[];

  /** 精簡 tombstone：{ id, _deleted, updatedAt }（後端文件 §5.3）。 */
  deletePlace(id: string): void;

  /** pocket tombstone + 其下所有 live places 一併 tombstone（單次 commit，後端文件 §5.4）。 */
  deletePocket(pocketId: string): void;

  /** F-75：在【同一次 commit】內把 item 寫進該天，並帶上 placeId。 */
  addPlaceToDay(dayId: string, place: Place): string;      // 回傳新 itemId
}
```

**`addPocketWithPlaces` 的「單次 commit」為什麼是硬性要求**

```js
addPocketWithPlaces: (pocket, places) => {
  const t = now();
  const pocketId = uid();
  const rec = {
    id: pocketId, title: "", sourceUrl: "", platform: "other", summary: "",
    rawText: "", pending: false, createdAt: t, updatedAt: t, ...pocket,
  };
  const recs = places.map((p, i) => ({
    id: uid(), pocketId, name: "", nameJa: "", category: "other", area: "", note: "",
    lat: null, lng: null, geoSource: "", photoUrl: "", order: i, updatedAt: t, ...p,
  }));
  commit({ ...d(), pockets: [...d().pockets, rec], places: [...d().places, ...recs] });
  return { pocketId, placeIds: recs.map((r) => r.id) };
}
```

若拆成兩次 `commit`，`sync.js` 的 600ms debounce 雖然多半會把它們併成一次推送，但**中間會存在一個「有 pocket、沒有 places」的本地狀態**，Realtime 若剛好在此時推來就會被合併出去。一次 commit 讓「這則貼文＋它的地點」在任何時刻都是原子的。同理適用 `resolvePocket` 與 `deletePocket`。

**`addPlaceToDay` 的欄位映射走純函式**

```js
addPlaceToDay: (dayId, place) => {
  const t = now();
  const itemId = uid();
  commit({ ...d(), days: d().days.map((day) => {
    if (day.id !== dayId) return day;
    return { ...day, updatedAt: t, items: [...day.items, {
      id: itemId,
      order: day.items.filter((i) => !i._deleted).length,   // 與既有 addItem 同一算法
      time: "", mapUrl: "",
      ...placeToItem(place),                                 // title / type / note / placeId
      updatedAt: t,
    }] };
  }) });
  return itemId;
}
```

寫入後 `days` 立刻更新 → 同一次 render 內 `daysForPlace(place.id, days)` 就會反查到新的一天 → C-22 的「已加入 D*n*」badge 與行程頁的項目**是同一份資料的兩個視圖**，資料上不可能出現只有其一的中間狀態（T-83）。

### 4.3 `useTrip` 的 F-77 改動

```js
const [syncReason, setSyncReason] = useState("");   // 🆕

// doPush 的 catch 分支
} else {
  setSyncReason(navigator.onLine ? (e?.message || "同步失敗") : "");
  setSyncState(navigator.onLine ? "failed" : "offline");
}
// 成功分支與 retry() 進入時清掉
setSyncReason("");
```

`pushRemote` 在驗證失敗時 `throw new Error(v.reason)`（`sync.js:32`），所以 `e.message` **就是** `validateTrip` 的 `reason` 字串，不需要新增任何傳遞通道。回傳值加上 `syncReason`。

### 4.4 `src/lib/places.js` 純函式規格

#### 4.4.1 `normalizeName(s): string`

```js
// 去頭尾空白 → 全形轉半形 → 移除所有空白字元 → 英文轉小寫
export const normalizeName = (s) =>
  String(s ?? "")
    .trim()
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
```

| 輸入 | 輸出 |
|---|---|
| `" 一蘭拉麵 福岡總本店 "` | `一蘭拉麵福岡總本店` |
| `"ＩＣＨＩＲＡＮ"` | `ichiran` |
| `""` / `null` / `undefined` | `""` |

#### 4.4.2 `dedupeAgainstSaved(candidates, savedPlaces): boolean[]`（F-72，PRD 已定義規則）

```js
export function dedupeAgainstSaved(candidates = [], savedPlaces = []) {
  const savedSets = savedPlaces
    .filter((p) => p && !p._deleted)                       // tombstone 不算「已存過」
    .map((p) => new Set([normalizeName(p.name), normalizeName(p.nameJa)].filter(Boolean)));
  return candidates.map((c) => {
    const keys = [normalizeName(c.name), normalizeName(c.nameJa)].filter(Boolean);
    if (!keys.length) return false;
    return savedSets.some((s) => keys.some((k) => s.has(k)));   // 集合有交集即判定
  });
}
```

| PRD F-72 規則 | 實作對應 |
|---|---|
| 1. 正規化（去空白／全半形／小寫）| `normalizeName` |
| 2. 每個地點取 `{name, nameJa}` 集合，空字串不計 | `.filter(Boolean)` |
| 3. 與任一既有地點的集合**有交集**即「已存過」 | `savedSets.some(s => keys.some(k => s.has(k)))` |
| 4. **不比對 `area`** | `area` 從未進入集合 |
| 5. 僅供提示，永不自動略過或合併 | 回傳值只餵給 C-20 的 `defaultChecked` 與 badge |

**邊界案例**

| 情境 | 結果 | 說明 |
|---|---|---|
| 候選 name 空、nameJa 空 | `false` | 不可能與任何東西同名 |
| 候選 `nameJa` 命中既有的 `name`（跨欄位）| `true` | 刻意的：A 貼文寫中文名、B 貼文寫日文名 |
| 既有地點已被刪（tombstone）| `false` | 刪掉了就該能重新存 |
| `savedPlaces` 為空陣列 | 全 `false` | 首次使用 |

#### 4.4.3 `suggestDays(place, days): Set<string>`（F-75／T-97）

```js
// 城市別名（寫死常數即可,可隨行程擴充,不必完美 —— PRD §6.3）
const CITY_ALIASES = [
  ["福岡", "博多", "fukuoka", "hakata"],
  ["那霸", "沖繩", "naha", "okinawa"],
  ["由布院", "湯布院", "yufuin"],
];
const SPLIT = /[\s、,，/／|｜→\-–—・()（）]+/;

export function suggestDays(place, days = []) {
  const out = new Set();
  const area = normalizeName(place?.area);
  if (!area) return out;                                   // 規則 4：area 空 → 不建議、不擋
  const areaTokens = tokensOf(place?.area);
  const areaCanon = new Set(areaTokens.map(canon));

  for (const day of days) {
    const city = normalizeName(day?.city?.v);
    if (!city) continue;                                   // 規則 4：city 空 → 不建議、不擋
    const cityTokens = tokensOf(day?.city?.v);

    // 規則 2：整串互相包含,或任一方的 ≥2 字 token 出現在另一方
    const hit2 =
      area.includes(city) || city.includes(area) ||
      cityTokens.some((t) => t.length >= 2 && area.includes(normalizeName(t))) ||
      areaTokens.some((t) => t.length >= 2 && city.includes(normalizeName(t)));

    // 規則 3：套用別名後命中同一正規化城市
    const hit3 = cityTokens.some((t) => areaCanon.has(canon(t)));

    if (hit2 || hit3) out.add(day.id);
  }
  return out;                                              // 規則 5：零相符就回空集合,呼叫端仍列出所有天
}
```

**T-97 逐條驗證**

| `place.area` | `day.city.v` | 期望 | 命中規則 |
|---|---|---|---|
| `福岡 中洲川端` | `福岡` | ✅ 建議 | 規則 2（`福岡中洲川端`.includes(`福岡`)）|
| `福岡 中洲川端` | `博多` | ✅ 建議 | 規則 3（`博多` 與 `福岡` 同一別名群）|
| `福岡 中洲川端` | `由布院` | ❌ 不建議 | 皆不命中 |
| `福岡 中洲川端` | `""` | ❌ 不建議、不擋 | `continue` |
| `""` | `福岡` | ❌ 不建議、不擋 | early return |
| `那霸 國際通` | `沖繩(自駕)` | ✅ 建議 | `SPLIT` 拆出 `沖繩`/`自駕`，`沖繩`↔`那霸` 同群 |
| `由布院` | `大分・由布院` | ✅ 建議 | `SPLIT` 拆出 `大分`/`由布院` |

**回傳 `Set<dayId>` 而不是排序後的陣列**是硬性設計：呼叫端只能拿它來決定「這個 chip 要不要掛 badge」，**結構上就無法**用它重排順序（DDR-14／T-97）。

#### 4.4.4 `daysForPlace(placeId, days): Array<{ dayId, idx, date }>`（DDR-23／T-83）

```js
export function daysForPlace(placeId, days = []) {
  if (!placeId) return [];
  return days.reduce((acc, day, idx) => {
    const hit = (day.items || []).some((i) => i && !i._deleted && i.placeId === placeId);
    if (hit) acc.push({ dayId: day.id, idx, date: day.date });
    return acc;
  }, []);
}
```

**契約**：`days` 必須是**已過濾 tombstone 且已依 `date` 排序**的陣列，與 `TripView.jsx:12` 完全同一個算法，`idx` 才會等於使用者看到的 D*n* − 1。呼叫端統一用 `PocketView` 算一次 `liveDays` 往下傳，不讓每個 `PlaceRow` 各算各的。

| 邊界 | 結果 |
|---|---|
| `placeId` 為 `""` / `undefined`（手動新增的行程項目）| `[]` |
| 同一 placeId 出現在 D2 與 D3 | `[{idx:1},{idx:2}]` → badge「已加入 D2、D3」（T-83 要求列出全部）|
| 該 item 已被刪除 | 不計入（badge 自動消失）|

#### 4.4.5 `placeToItem(place)`（T-84）

```js
export const placeToItem = (p) => ({
  title: p.name,
  type: p.category,           // === ITEM_TYPE_KEYS,零轉換表
  note: p.note || "",
  placeId: p.id,
});
```

`type` 直接等於 `category`，所以進到行程後的色塊、圖示、地圖鈕行為與手打的項目完全一致，且可用既有拖曳重排（T-84）。

#### 4.4.6 `capacityCheck(data, pocket, places)`（F-76／T-82）

```js
export function capacityCheck(data, pocket, places = []) {
  const base = byteSize(data);                       // 現況大小
  const add = byteSize({ pocket, places });          // 即將新增的量（含 JSON 括號,略為高估 → 保守）
  const projected = base + add;
  return {
    ok: projected <= PLACE_BUDGET_BYTES,
    projected,
    budget: PLACE_BUDGET_BYTES,
    warn: base > PLACE_WARN_BYTES,                   // P-06 常駐預警條
  };
}
```

**為什麼不照 PRD 字面寫成 `byteSize({...data, places:[...]})`**：那個寫法每按一次勾選框就要把整份 trip（可能接近 1MB，含購物清單相片的 data URL）序列化一次，在 iPhone 上會明顯卡頓。拆成「基準值（`useMemo` 綁 `trip.data`，只算一次）＋ 增量」在數值上等價（誤差只有幾個位元組的括號，且方向是**高估**），沿用的仍是 `ChecklistCard.jsx:31` 已驗證的試算模式。

`PLACE_BUDGET_BYTES = 900_000`（擋下）與 `PLACE_WARN_BYTES = 800_000`（黃字預警）**皆由 PRD v3.5 §5.3 正式定義**，
一律以具名常數引用，元件內不得寫死數字（UI spec §6.4 硬性）。

### 4.5 `src/lib/share.js` — `detectPlatform()`（v3.1 新增，PRD §5.3／§6.2 裁定落位）

```js
// 硬性:必須解析 hostname,【禁用】url.includes("instagram.com")。
// 否則 https://example.com/?ref=instagram.com 會被誤判成 IG,把使用者送去截圖死路。
export function detectPlatform(raw) {
  const t = (raw || "").trim();
  if (!t) return "other";
  try {
    // 使用者常貼不帶 protocol 的網址;補 https:// 只是為了讓 URL 解析得動,
    // 【不回寫欄位】—— 送出時仍交給既有 normalizeUrl()（UI spec §6.1.1b 驗證規則末列）
    const h = new URL(/^https?:\/\//i.test(t) ? t : "https://" + t).hostname.toLowerCase();
    if (/(^|\.)instagram\.com$/.test(h))                  return "instagram";
    if (/(^|\.)threads\.(net|com)$/.test(h))              return "threads";
    if (/(^|\.)(xiaohongshu\.com|xhslink\.com)$/.test(h)) return "xiaohongshu";
    if (/(^|\.)tiktok\.com$/.test(h))                     return "tiktok";
    if (/(^|\.)(youtube\.com|youtu\.be)$/.test(h))        return "youtube";
  } catch { /* 使用者只貼了一段文字 → other,不切模式 */ }
  return "other";
}
```

| 契約 | 規格 |
|---|---|
| 回傳型別 | `Platform = "instagram" \| "threads" \| "xiaohongshu" \| "tiktok" \| "youtube" \| "other"`（與後端 `Pocket.platform` 同一組字面值）|
| 純函式 | 無副作用、不碰 DOM、不 fetch → 100% 可 vitest 覆蓋 |
| 兩個用途 | ① C-19 的版面分流（**送出前**就要知道，不能等後端回 `source.platform`）② `pocket.platform` 的前端初值與 C-21 平台圖示來源 |
| 為什麼放 `share.js` 而不是 `places.js` | 與 `parseShareParams` / `shortcutPrefix` 同屬「來源／分享」語意；`places.js` 是「地點規則」語意。**PRD v3.7 §6.2 已明文裁定此落位**（原 UI spec §12.3 ⑧ 待裁定，現已結案）|

**邊界案例（測試須涵蓋）**

| 輸入 | 回傳 | 說明 |
|---|---|---|
| `https://www.instagram.com/reel/C8xk2/` | `instagram` | 一般情況 |
| `instagram.com/p/abc`（無 protocol）| `instagram` | 補 `https://` 後解析 |
| `https://example.com/?ref=instagram.com` | `other` | **禁用 `includes` 的理由**，hostname 是 `example.com` |
| `https://fakeinstagram.com/x` | `other` | `(^\|\.)` 錨定，不匹配後綴 |
| `https://www.instagram.com.evil.tld/x` | `other` | 同上 |
| `"福岡必吃五家 一蘭…"`（純文字）| `other` | `new URL` 丟例外 → catch → `other` |
| `""` / `null` / `undefined` | `other` | early return |

### 4.6 截圖處理管線（F-71 / PRD §7.5b）

```js
import { compressImage, OCR_MAX, OCR_QUALITY } from "../lib/image.js";

export const MAX_SHOTS = 3;
export const MAX_SHOT_B64 = 4_000_000;         // 每張（PRD v3.10 §7.5d;後端 MAX_IMAGE_B64 同值）
export const MAX_SHOTS_B64_TOTAL = 10_000_000; // 總量（後端 MAX_IMAGES_TOTAL_B64 同值）

// 逐張壓縮。compressImage 回傳的是【data URL】,送出前必須去掉前綴。
async function addShots(fileList, current) {
  const room = MAX_SHOTS - current.length;
  const picked = Array.from(fileList).slice(0, room);      // 超出的直接不收,並提示「一次最多 3 張」
  const out = [];
  for (const f of picked) {                                 // 【逐張】,不 Promise.all —— 見下方理由
    const dataUrl = await compressImage(f, { max: OCR_MAX, quality: OCR_QUALITY });
    out.push({ key: uid(), dataUrl, name: f.name, bytes: dataUrl.length });
  }
  return [...current, ...out];
}

// 送出時才轉成契約格式（§5.2）
const toImages = (shots) => shots.map((s) => ({
  base64: s.dataUrl.slice(s.dataUrl.indexOf(",") + 1),      // 去掉 "data:image/jpeg;base64,"
  mime: "image/jpeg",                                       // compressImage 一律輸出 JPEG
}));
```

| 規則 | 規格 |
|---|---|
| `<input>` | `<input type="file" accept="image/*" multiple class="hidden">` 包在 `<label>` 內，沿用 `ChecklistCard.jsx:98` 既有模式，**不自創檔案選擇器** |
| 壓縮參數 | **`OCR_MAX = 1568` / `OCR_QUALITY = 0.85`**（`image.js` 具名常數，T-99 實測定案，PRD §7.5d）。**不動** `THUMB_MAX = 320`／`THUMB_QUALITY = 0.6`（購物清單照舊）。1568 正好是 `claude-haiku-4-5` 所屬 Standard tier 的原生上限：再大會被伺服器端縮一次（等於重採樣兩次，比一次縮到位更糟），再小是白白丟字 |
| 逐張而非 `Promise.all` | `compressImage` 每張都建立一個 canvas 與 `Image`；iPhone 上同時解三張 1568px 圖容易造成記憶體尖峰與掉幀。**逐張處理並顯示「處理中…」**（UI spec C-30 規格），使用者體感差異可忽略 |
| 前端三道上限 | 張數 > 3 → 只收前 N 張並提示；單張 `base64 > 4MB` 或總量 `> 10MB` → **不送出**，直接顯示 `too_large` 文案。**後端仍要各自檢查一次**（前端是體驗、後端是防護）。實務上這兩道幾乎不可達：1568/0.85 的截圖約 155KB、base64 約 207KB，只用掉單張額度的 **5%** |
| **不進 jsonb** | 壓縮後的 dataUrl 只活在 `IngestSheet` 的本地 state 與 request body 裡。**任何情況都不得寫進 `trip.data`**（PRD §5.5 硬性）——這也是 F-78 離線存不下截圖的原因 |
| 移除 | 每張可獨立移除（`aria-label="移除截圖"`，命中區 44px），移除後重算總量 |

---

## 5. 詳細元件定義

> 型別以 TypeScript interface 表達（專案本身是 JSX；此處為契約文件用途，實作時以 JSDoc 對應）。
> 共用型別 `Place` / `Pocket` / `Day` / `DayItem` 定義見 [後端文件 §4.2](../backend/parse-and-schema-v3.md)。

### 5.1 PocketView.jsx（P-06, C）

```typescript
interface Props {
  trip: UseTripReturn;                 // 沿用既有整包下傳慣例
  confirm: (message: string) => Promise<boolean>;
  onGoTab: (tab: TabId) => void;       // S-01「設定 iOS 捷徑」/ C-27「去清單頁」/ S-19「去行程頁」
  initialShare?: { url: string; text: string } | null;   // F-83，來自 App
}
type TabId = "trip" | "money" | "lists" | "album" | "places" | "setting";
```

**內部職責**

| 職責 | 說明 |
|---|---|
| `liveDays` | `liveItems(trip.data.days).sort(by date)` —— 算一次，往下傳給每個 PlaceRow / DayPickerSheet |
| `livePlaces` / `livePockets` | `liveItems(...)`；pockets 依 `createdAt` **新→舊** |
| 分組 | `placesByPocket = groupBy(livePlaces, "pocketId")`；`pocketId === ""` 的收集成 S-07 虛擬卡「📌 自己加的地點」，固定置底 |
| S-01 空狀態 | `!livePockets.length && !livePlaces.length`。**文案硬性（v3.1）**：第一行必須是「滑 IG 看到想去的店，**截一張有說明文字的圖**丟進來」，第二行才講其他平台可以貼連結／文字。**不得**把「貼上貼文文字」寫成 IG 的做法（T-98 已證實做不到）、**不得**暗示裝了捷徑就能自動存下 IG 內容（DDR-32）、**不得**出現「地圖／地圖總覽／連結 Google 帳號／同步我的清單」字樣（PRD §4.5、風險 #15）|
| C-18 IngestBar | **一顆按鈕，不是輸入框**（DDR-10b）。點擊 → `setIngestOpen(true)`。說明文案（v3.1）：「看到想去的店，把**截圖**、連結或貼文文字丟進來，我幫你拆成地點、再告訴你排哪一天。」（**截圖排第一個**）|
| C-27 CapacityNotice | `capacityCheck(...).warn` 為真時常駐 |
| `initialShare` | 非 null 時，首次 render 就以預填內容開啟 C-19（F-83）|

### 5.2 IngestSheet.jsx（C-19, C）

```typescript
interface Props {
  open: boolean;
  onClose: () => void;
  trip: UseTripReturn;
  cityHint: string;                    // 由 PocketView 從 liveDays 的城市組出
  prefill?: { url?: string; text?: string } | null;
  reparseOf?: Pocket | null;           // S-06「重新解析」帶入的待解析 pocket
  onDone: (summary: { count: number }) => void;
}

type IngestStep = "input" | "parsing" | "review";
type IngestMode = "general" | "ig";   // 排版模式;由 url 衍生,【不是】獨立 state

interface IngestState {
  step: IngestStep;
  url: string;
  text: string;
  shots: Shot[];                       // 0..3 張,見 §4.6
  textOpen: boolean;                   // S-20 下貼文文字欄的折疊狀態（見下方「折疊不得藏字」）
  busyShots: boolean;                  // 壓縮中
  // 與後端 §6.5 錯誤碼表同源。not_configured / upstream_error 走「未知 reason 原樣顯示」
  // 的既有分支,不新增 UI;列進 union 只是不讓型別對不上契約。
  failReason: "" | "need_text_or_image" | "no_places" | "too_large" | "rate_limited"
            | "bad_request" | "not_configured" | "upstream_error";
  collection: { title: string; summary: string };
  rows: ReviewRowState[];              // 覆核用的【本地 state】，寫入前 trip.data.places 零變化（T-80）
}

interface Shot {
  key: string;                         // 本地 render key
  dataUrl: string;                     // compressImage 的輸出（含 data: 前綴）
  name: string;                        // 檔名,顯示用
  bytes: number;                       // dataUrl.length,用於三道上限試算
}

interface ReviewRowState {
  key: string;                         // 本地 render key，與 place.id 無關
  checked: boolean;
  name: string; nameJa: string;
  category: ItemType; area: string; note: string;
  confidence: number;
  duplicate: boolean;                  // dedupeAgainstSaved 的結果
}
```

#### `mode` 是**衍生值**，不是 state（v3.1 核心契約）

```jsx
// ✅ 每次 render 由 url 直接算出。沒有 useState、沒有 useEffect、沒有 setMode。
const mode = detectPlatform(url) === "instagram" ? "ig" : "general";
```

| 問題 | 契約 |
|---|---|
| **何時重算** | 每次 render。`url` 一變（`onChange` / `onPaste` / F-83 預填 / S-06 預填）版面就已經是對的，**不需要事件處理器去「切換模式」** |
| **有沒有 debounce** | **沒有**（UI spec §6.1.0：貼上的當下版面就換好）。`detectPlatform` 是同步純函式，成本可忽略 |
| **可逆性** | 刪掉／改掉 IG 連結 → 下一次 render 自動回 `general`。因為是衍生值，可逆性是**結構上保證**的，不靠任何還原邏輯 |
| **為什麼不能做成 state** | 用 `useState` + `useEffect(() => setMode(...), [url])` 會多一個 render frame，出現「連結已是 IG、版面還是一般模式」的中間畫面；而且模式與 url 可能不同步（兩份真相）。衍生值沒有這個類別的 bug |
| **不得移動焦點** | 換模式時**絕不呼叫 `focus()`**（DDR-26）。使用者手指還在連結欄上，搶焦點會讓她打不完字。**這也是把 `mode` 做成衍生值的附帶好處**：沒有「切換事件」可以掛 `focus()`，想寫錯都難 |
| **DOM 不重建** | 欄位順序用 flex `order` 切換，**不是**條件渲染兩套 JSX（UI spec §8）。iOS Safari 在 DOM 重建時會把鍵盤收起，且已選截圖的 `<input type="file">` 狀態會遺失 |
| **折疊不得藏字** | S-20 下貼文文字欄預設收合，但 `textOpen` 的初值為 `text !== ""` —— **已經有內容就維持展開**。把使用者剛打的字折疊起來，視覺上等同「內容不見了」|
| **播報** | IG 提示條 `role="status" aria-live="polite"`，切換當下播報「Instagram 讀不到內文，已改為截圖優先」。**只播報、不移動焦點** |
| **逃生口** | S-20 保留一行次要文字鈕「還是先試試這個連結」→ 照常 POST（DDR-27），避免誤判把人鎖死 |

#### 兩種模式的差異僅止於此（DDR-26）

| 共用（**不得**因模式而異） | 分流（**只有這四項**） |
|---|---|
| 欄位集合（url / text / shots）、送出邏輯、`parsePost` 契約、S-11 解析中、S-12 覆核、S-14 離線、容量檢查、寫入路徑 | ① 欄位順序（flex `order`）② 視覺主次（C-30 的 `emphasis`）③ 引導文案 ④ 失敗時的焦點目標（S-13 文字欄／S-21 截圖選擇器）|

**狀態機（UI spec §7.1）**

| 轉移 | 觸發 | 副作用 |
|---|---|---|
| `Closed → input` | 四個入口任一 | `prefill` / `reparseOf` 預填；**預填後 `mode` 即為正確值**（衍生值，開啟當下就對，F-83 不需先按錯一次）|
| `input → (離線)` | `!navigator.onLine` | 主按鈕文案改「先存起來」；送出 → `trip.addPocket({ title:"待解析", sourceUrl:url, rawText:text, pending:true })` → 關閉（F-78 / S-14）。**截圖不隨之保存**，橫幅須追加警語「截圖沒辦法離線保存，回到網路後請再選一次」|
| `input(ig) → input(ig)` | 無截圖且無文字時按主按鈕 | 主按鈕文案為「**選擇截圖**」，點擊＝開檔案選擇器，**不打 API**（DDR-27：註定失敗且白吃 IP 限流額度）|
| `input → parsing` | 按「解析看看」／「還是先試試這個連結」 | `api.parsePost({ trip: trip.key, url, text, images: toImages(shots), cityHint })` |
| `parsing → review` | `ok:true` | `rows = places.map(...)`，`checked = confidence >= 0.6 && !duplicate`（T-81）|
| `parsing → input` | `ok:false` | **保留全部輸入（含已選截圖）**、插入訊息條，焦點依模式分流：`general` → `textRef.focus()`（**S-13**）／`ig` → `shotPickerRef.focus()`（**S-21**），並捲到可視範圍（DDR-11）|
| `review → input` | 「‹ 改一下輸入」 | 保留輸入，**回到原本的模式**（衍生值，自動成立）|
| `review → Closed` | 「加入口袋 (N)」 | **唯一的寫入點**：`capacityCheck` 通過才 `addPocketWithPlaces` / `resolvePocket` |

**硬性規則**
1. `review` 狀態下 `trip.data.places` **必須零變化**（T-80）。所有編輯都在 `rows` 這個本地 state 上。
2. 「加入口袋 (N)」的 N＝`rows.filter(r => r.checked).length`；**N = 0 時停用**（DDR-12）。
3. 容量不足時：不寫入、顯示 C-27、主按鈕停用，使用者取消勾選幾筆後可再試（S-12 → Blocked → S-12）。
4. 失敗**不換頁、不清空**；焦點送到「這個平台上真的做得到」的欄位（DDR-11）。
5. **S-11 解析中時 C-30 一併鎖住**（`pointer-events-none`），避免解析途中換圖造成送出內容與畫面不一致。

**主按鈕狀態表（UI spec §6.1.1b 驗證規則）**

| 模式 | url | text | shots | 主按鈕 |
|---|---|---|---|---|
| 任一 | 空 | 空 | 0 | 「解析看看」**停用**（`aria-disabled="true"`）|
| `ig` | 有 | 空 | 0 | 「**選擇截圖**」**啟用**，點擊開檔案選擇器、**不送出** |
| `ig` | 有 | 有／或 shots ≥ 1 | — | 「解析看看」啟用 |
| `general` | 有 | 空 | 0 | 「解析看看」啟用（後端走 oEmbed／og 階梯）|
| `general` | 空 | 有（任何長度）| 0 | 「解析看看」啟用（< 40 字由後端落到其他順位，前端不擋）|
| 任一 | 空 | 空 | ≥ 1 | 「解析看看」啟用（後端順位 4）|

### 5.3 ReviewRow（C-20, P，定義在 IngestSheet.jsx 內）

```typescript
interface ReviewRowProps {
  row: ReviewRowState;
  expanded: boolean;
  onToggleCheck: () => void;
  onToggleExpand: () => void;
  onChange: (patch: Partial<ReviewRowState>) => void;
}
```

| 視覺規則 | 條件 |
|---|---|
| 一般樣式，預設已勾 | `confidence >= 0.6 && !duplicate` |
| `bg-amber-50 border-amber-200` ＋文字「名稱可能不準」，預設未勾 | `confidence < 0.6` |
| `bg-slate-100 text-slate-500` badge「已存過」，預設未勾 | `duplicate` |
| 兩者皆中 | amber 底 ＋ 兩個標記都顯示 |

狀態雙編碼是硬性的（UI spec §9）：底色之外**必附文字**。

> **截圖來源的覆核更重要，不是更不重要**（DDR-24／DDR-25）：多模態讀圖對日文店名的抄錄錯誤率高於純文字，
> 低 `confidence` 的比例會上升。主路徑改成截圖之後，覆核從「保險」變成**必經的校對**，
> 任何簡化覆核的提案（自動勾選、跳過覆核直接寫入）都應被拒絕。

### 5.3b ShotPicker（C-30, P，定義在 IngestSheet.jsx 內）

```typescript
interface ShotPickerProps {
  shots: Shot[];                        // 已選截圖（0..3）
  emphasis: "primary" | "secondary";    // primary = IG 模式（S-20）;secondary = 一般模式（S-10）
  busy: boolean;                        // 壓縮中 → 顯示「處理中…」
  disabled: boolean;                    // S-11 解析中 → pointer-events-none
  max: number;                          // = MAX_SHOTS (3)
  onAdd: (files: FileList) => void;     // 交給 §4.6 的 addShots
  onRemove: (key: string) => void;      // 逐張移除
  inputRef?: React.Ref<HTMLInputElement>;  // S-21 失敗時 focus() 的目標
}
```

| 項目 | 規格 |
|---|---|
| 實作 | `<label>` 包 `<input type="file" accept="image/*" multiple class="hidden">`，沿用 `ChecklistCard.jsx:98` 既有模式 |
| `emphasis="primary"` | 整塊 `min-h-24`（96px）、`bg-rose-50 border-2 border-rose-300 text-rose-600 rounded-2xl`、置中 24px 相機圖示 + 「**選一張截圖**」 |
| `emphasis="secondary"` | 高 44px、`border border-dashed border-pink-200 text-rose-300 rounded-xl`、「📷 或選截圖」 |
| 已選狀態 | 每張 40×40 縮圖 + 右上 ✕（`aria-label="移除截圖"`，命中區 44px）+ 檔名／尺寸 `--t-micro`；上方一行「**已選 N 張**」（N ≥ 1 時顯示，`max` 已滿時追加「已達上限 3 張」）|
| **IG 模式選完仍維持 primary 外觀** | 不縮成小按鈕——它還是這一步的主角（DDR-31）|
| 為什麼要獨立元件 | 同一個選擇器要在兩種模式呈現兩種權重；寫成兩段行內 JSX 必然走樣，且 `emphasis` 只影響 className、不影響行為（DDR-31）|
| 觸控／無障礙 | 兩種外觀皆 ≥ 44px；`aria-label="選擇截圖"`；primary 外觀 `text-rose-600` on `bg-rose-50` ≈ 6.1:1（≥ AA）|
| **不得**做的事 | ① 不得自創檔案選擇器 ② 不得把已選截圖寫進 `trip.data` ③ 不得在 `emphasis` 之外分支行為（送出、驗證、壓縮參數三者兩模式完全相同）|

### 5.3c Toast（C-29, P，定義在 `components/ui.jsx` 內）

```typescript
interface ToastProps {
  message: string;                      // 例「已排進 D2（6/11）」
  actionLabel?: string;                 // 例「去看看」
  onAction?: () => void;                // 例 onGoTab("trip")
  onDismiss: () => void;                // 1.8s 後自動觸發
}
```

| 項目 | 規格 |
|---|---|
| 落位 | **`src/components/ui.jsx`**，與 `Card` / `SectionTitle` / `PinkBtn` / `Field` 同檔，**不另開新檔**（PRD §6.2、DDR-29）|
| 觸發點 | ① F-75 點日期 chip 寫入成功（「已排進 D2（6/11）」＋「去看看」）② F-72 寫入口袋成功（「已加入 5 個地點」）|
| 動畫 | 由下淡入、停 1.8s 後淡出；`prefers-reduced-motion` 下改為純 opacity ≤ 100ms |
| 掛載位置 | App 根層單一實例（比照 `ConfirmSheet` 的既有做法），由 `PocketView` 透過回呼觸發，**不在每個面板各放一個** |
| 無障礙 | `role="status" aria-live="polite"`；**不搶焦點**（它是回饋，不是對話框）|

### 5.4 PocketCard.jsx（C-21, C）

```typescript
interface Props {
  pocket: Pocket | { id: "__manual__"; title: "自己加的地點" };  // S-07 為虛擬 pocket
  places: Place[];
  liveDays: Day[];
  defaultOpen: boolean;                // DDR-22：最新一則預設展開
  online: boolean;                     // S-06 離線時停用「重新解析」
  onReparse: (pocket: Pocket) => void;
  onDeletePocket: (pocketId: string) => void;
  onOpenPlace: (place: Place) => void;
  onAddToTrip: (place: Place) => void;
}
```

| 狀態 | 條件 |
|---|---|
| S-04 收合 / S-05 展開 | 本地 `useState(defaultOpen)` |
| S-06 待解析 | `pocket.pending === true` → `border-dashed` ＋「⏳ 待解析」＋顯示 `rawText \|\| sourceUrl` 前 40 字 ＋主按鈕「**重新解析**」→ 開 C-19，**以 `pocket.rawText` 預填貼文文字欄、以 `pocket.sourceUrl` 預填連結欄**（PRD §5.2）。開啟後 `mode` 由 `detectPlatform(sourceUrl)` 自動算出，IG 直接是 S-20。離線時按鈕停用並顯示「回到網路再試」 |
| **S-06b 待解析且來源是 IG** | `pocket.pending && detectPlatform(pocket.sourceUrl) === "instagram"` → 按鈕文案改為「**補一張截圖再解析**」。<br/>理由：離線存不下截圖（PRD §5.5 硬性），IG 又只有截圖這條路；寫「重新解析」會讓使用者以為按下去就會自己跑完（DDR-25／PRD §4.2 F-78 裁定）。**這是誠實標示限制，不是解決它——本設計不規劃任何 blob 暫存機制** |
| S-07 手動新增 | `pocket.id === "__manual__"` → 無來源連結、**不可刪整張卡**、固定置底 |

### 5.5 PlaceRow.jsx（C-22, P）

```typescript
interface Props {
  place: Place;
  addedDays: Array<{ dayId: string; idx: number; date: string }>;  // daysForPlace() 的結果
  onOpen: (place: Place) => void;        // 點整列 → C-23
  onMap: (place: Place) => void;         // 📍 → openMap(name + " " + area)
  onAddToTrip: (place: Place) => void;   // ＋ → C-24
}
```

- 視覺與 `ItemRow`（C-08）**同源**：`bg-pink-50 rounded-xl p-2.5`、同一組 `ITEM_TYPES[].c` 色塊、圖示鈕命中區同為 `w-8 h-9 -my-1`。
- 店名 `break-words`（**不 truncate**，日文店名長）。
- `addedDays.length > 0` → emerald badge「已加入 D2、D3」（`addedDays.map(d => "D" + (d.idx + 1)).join("、")`）。**仍可再加**（S-09）。
- 地圖鈕**永遠顯示**（不套 `ItemRow` 的 `MAPPABLE` 過濾）——口袋裡每一筆都是使用者想去的地方，`openMap` 是純 URL 不會失敗（F-74）。

### 5.6 PlaceSheet.jsx（C-23, C）

```typescript
interface Props {
  place: Place | null;                  // null = 關閉
  onClose: () => void;
  onSave: (id: string, patch: Partial<Place>) => void;
  onDelete: (id: string) => void;
  onAddToTrip: (place: Place) => void;
  confirm: (message: string, opts?: { subtitle?: string; confirmLabel?: string }) => Promise<boolean>;
}

interface PlaceDraft { name: string; category: ItemType; area: string; note: string; }
```

| 狀態 | 規格 |
|---|---|
| S-15 編輯中 | `draft` 與 `place` 有差異 → 顯示「有未儲存的變更」，「儲存」鈕亮起 |
| S-16 已儲存 | 按鈕短暫變「✓ 已儲存」，180ms 後 `onClose()` |
| S-17 未存離開 | `dirty` 時點 ✕／遮罩 → `confirm("要放棄修改嗎？", { subtitle: "這個地點剛剛改的內容不會存起來。", confirmLabel: "放棄修改" })` |

**C-16 ConfirmSheet 的 `subtitle` 契約（v3.1，PRD §6.2／DDR-30 已裁定）**

```jsx
// components/ConfirmSheet.jsx —— 只加一個【選填】prop,預設值＝現有硬寫字串
export function ConfirmSheet({
  open, message,
  subtitle = "刪除後旅伴端也會一併移除,無法復原",   // 🆕 預設值即原字串 → 向下相容
  confirmLabel = "刪除",
  onCancel, onConfirm,
}) { /* …第 10 行的硬寫字串改成 {subtitle}… */ }
```

```js
// hooks/useConfirm.js —— ask 多收一個選填 opts,透傳給 confirmProps
const ask = useCallback(
  (message, opts = {}) => new Promise((resolve) =>
    setState({ open: true, message, opts, resolve })),
  []
);
// confirmProps 展開 state.opts（subtitle / confirmLabel）
```

| 檢查項 | 結果 |
|---|---|
| 既有 4 個呼叫點需不需要改？ | **不需要，一行都不用改。** 它們呼叫 `ask(message)`，`opts` 預設 `{}`，`subtitle` / `confirmLabel` 落回預設值＝與現在完全相同的畫面 |
| 為什麼不在 PlaceSheet 內自幹一個確認列 | 會多一套視覺語言；而 S-17 的行為與既有刪除確認完全同構（遮罩 + 兩顆鈕），差別只有兩行文案 |
| 硬性 | S-17 **不得**沿用預設 subtitle。「刪除後旅伴端也會一併移除」出現在「放棄修改」情境，會讓使用者以為地點要被刪掉（DDR-30）|

**硬性：不做即時輸入即存。** `draft` 是本地 state，只有按「儲存」才呼叫 `updatePlace`。
理由：`useTrip.js:46` 的 `applyRemote` 只保護 `activeField` 為**頂層 scalar 名**或 `day:<id>:<field>` 兩種格式，地點欄位不在保護範圍內，逐字編輯會被 Realtime 合併蓋掉。沿用 `SettingView.jsx:55` 的 `tripName` 模式，**而不是**去擴充已通過 SA 驗收的同步核心（DDR-15）。

`nameJa` 非空時，在區域欄下方以 `--t-cap` 灰字唯讀顯示（DDR-15b），**不放 input**。

### 5.7 DayPickerSheet.jsx（C-24, C）＋ DayChip（C-25, P）

```typescript
interface DayPickerProps {
  place: Place | null;                  // null = 關閉
  liveDays: Day[];                      // 已過濾 tombstone、已依 date 排序
  onPick: (dayId: string) => void;
  onClose: () => void;
  onGoTrip: () => void;                 // S-19
}

interface DayChipProps {
  day: Day;
  idx: number;                          // D(idx+1)
  itemCount: number;                    // liveItems(day.items).length
  suggested: boolean;                   // suggestDays().has(day.id)
  added: boolean;                       // daysForPlace().some(d => d.dayId === day.id)
  onPick: () => void;
}
```

**四條硬性規則（違反即設計錯誤）**

| # | 規則 | 實作保證 |
|---|---|---|
| 1 | 順序永遠是行程原順序，建議的天**不得**被抽到最上面 | 渲染直接 `liveDays.map(...)`；`suggestDays` 回傳 `Set` 而非陣列，結構上無法拿來排序 |
| 2 | 不自動選、不自動寫入 | 沒有任何 `useEffect` 會呼叫 `onPick` |
| 3 | 零相符時仍列出所有天 | `suggested` 只影響 badge 與底色，不影響 `map` 的來源 |
| 4 | `place.area` 或 `day.city` 為空 → 不標建議也不擋 | `suggestDays` 的規則 4 |

**互動**：點 chip → `trip.addPlaceToDay(dayId, place)` → 關閉面板 → Toast「已排進 D2（6/11）」＋「去看看」（切到行程頁）→ C-22 的 emerald badge 因反查而自動出現。

**S-19**：`liveDays.length === 0` → 🗓 空狀態 ＋「去行程頁」按鈕（**只切 tab，不新增任何功能**）。

### 5.8 BottomNav.jsx（C-05 增修, P）

```typescript
interface Props { tabs: Tab[]; active: string; onChange: (id: string) => void; }
```

```jsx
// ✅ 明確字面值,Tailwind 掃描得到（PRD 風險 #8 / T-86）
const COLS = { 5: "grid-cols-5", 6: "grid-cols-6" };
// ❌ 嚴禁：`grid-cols-${tabs.length}` —— 建置後會被 purge 掉,六格會塌成一欄
<div className={`max-w-2xl mx-auto ${COLS[tabs.length] || COLS[5]}`}>
```

分頁順序：行程 / 帳本 / 清單 / 相簿 / **口袋** / 設定。「口袋」插在「相簿」與「設定」之間，維持「設定永遠在最右」（DDR-09）。圖示 lucide `Bookmark`，20px，與既有五個同一套。
375px 下每格 62.5px × 約 55px；320px 下 53.3px，皆 ≥ 44px（T-86）。

### 5.9 SyncStatusBadge（C-12 增修）＋ SyncReasonNote（C-28, P）

```typescript
interface SyncStatusBadgeProps {
  state: 'synced' | 'syncing' | 'offline' | 'failed';
  pending: number;
  expanded: boolean;                    // 🆕 aria-expanded
  onToggleReason: () => void;           // 🆕 failed 時改為展開 C-28（不再直接重試）
  onRetry: () => void;
}

interface SyncReasonNoteProps {
  reason: string;                       // validateTrip 的 reason 原文
  onRetry: () => void;
  onDismiss: () => void;
  onGoTab: (tab: TabId) => void;
}
```

`failed` 文案由「失敗·重試」改為「**失敗·看原因**」。C-28 位置與 C-17 OfflineBanner 相同（兩者互斥：`offline` 與 `failed` 不會同時成立）。

| `reason` | C-28 文案 | 動作鈕 |
|---|---|---|
| `資料過大,請精簡(相簿改用連結)` | 「這份行程超過 1MB 上限，先刪一些相片或舊地點」 | ［去清單頁］［重試］ |
| `App 版本過舊,請重新整理頁面` | 原樣顯示 | ［重新整理］（`location.reload()`）|
| `資料格式錯誤…` | 「資料格式有問題，請截圖回報」 | ［重試］ |
| 其他／未知 | **原樣顯示 `reason`，不吞掉** | ［重試］ |

`role="alert"`。

### 5.10 ShortcutCard.jsx（C-26, P）

```typescript
interface Props { tripKey: string; }
```

比照 `SettingView.jsx:41-49` 的分享連結卡：說明 ＋ 唯讀輸入框 ＋ 複製鈕（複製後 1.5s 顯示「已複製」）＋ 折疊的三步驟。放在「分享連結」卡之後、「旅程設定」卡之前。

```js
const prefix = `${window.location.origin}/?trip=${encodeURIComponent(tripKey)}&share=`;
```

**誠實文案是硬性的（DDR-19／DDR-32，v3.1 重寫）**：

| 位置 | 文案 |
|---|---|
| 標題 | 「**iOS 捷徑：從 IG 分享選單直接開櫻旅**」（**不可**寫成「從 IG 直接存」——會被讀成「連內容一起存」）|
| 說明 | 「裝一次之後，在 IG 按分享就會出現『存到櫻旅』，**幫你把連結存成來源、順手打開收藏面板**。**不裝也完全不影響**，照樣可以用貼上的。」 |
| 誠實提示（`bg-amber-50` 淡底，以免被略過）| 「**IG 分享只給得到連結，給不到貼文內容。** 所以按完『存到櫻旅』之後，面板還是會請你**截一張把說明文字展開的圖**——櫻旅是從那張圖上讀店名的。捷徑省掉的是**切 App 和貼連結**，不是解析。」 |

**禁止（v3.1 加嚴）**：
1. 不得寫成「安裝捷徑就能自動抓到所有內容」或任何「一鍵存下 IG 貼文」的暗示。
2. **不得讓「存到櫻旅」五個字單獨出現而不說明它存的是什麼**——它存的是連結，不是內容。
3. 捷徑的價值主張只有兩個，文案只能講這兩個：**不漏掉來源**、**一鍵開啟收藏面板**。
4. **不得**再出現 v3.0 那句「開起來如果解析不到，把寫店名那段文字貼上去就好」——T-98 已證實 IG caption 複製不了，那是一個假出口。

### 5.11 App.jsx 增修（F-83）

```typescript
const TABS = [ …trip, money, lists, album, { id:"places", label:"口袋", icon: Bookmark }, setting ];

// 首次 render 前取出並清掉分享參數（在 resolveTripKey 的 replaceState 之後仍安全,
// 因為那次 replaceState 保留了其餘 query）
const [share] = useState(() => parseShareParams(window.location.search));
useEffect(() => { stripShareParams(); }, []);          // history.replaceState 清掉 ?share= / ?share_text=
const [tab, setTab] = useState(() => (share ? "places" : "trip"));
```

- `?trip=` 由捷徑帶入 → `resolveTripKey` 第一順位勝出，確保開到同一份行程（F-81 細節 1／T-96）。
- 參數格式異常 → 照常開 IngestSheet，只是不預填。
- `stripShareParams()` 後網址列不得殘留 `share`（T-96）。

---

## 6. 技術難點與解決方案

| # | 難點 | 解決方案 |
|---|------|---------|
| 1 | **舊 bundle 清空雲端 `places`／`pockets`** | F-69 修 `migrate.js` **與** `merge.js` 兩處（後端文件 §5.1），單獨分支先上線，確認傳播完成才升版號 |
| 2 | **地點欄位不在 `activeField` 保護範圍** | C-23 用明確「儲存」鈕（DDR-15）。**不擴充** `applyRemote` —— 那會動到已通過 SA 的同步核心 |
| 3 | **跨分頁拖曳結構上不可行** | 每個 `DayCard` 各持一個 `DndContext`（`DayCard.jsx:84`），`onDragEnd`(:33) 假設起訖同天；`App.jsx` 一次只掛一個分頁。改用日期選擇（F-75），完全不碰既有拖曳程式碼 |
| 4 | **Tailwind purge 掉 `grid-cols-6`** | `COLS` 明確字面值對照表，禁止字串內插（§5.8／T-86）|
| 5 | **覆核步驟不得污染 `trip.data`** | 覆核清單是 `IngestSheet` 的本地 state，唯一寫入點是「加入口袋 (N)」（T-80）|
| 6 | **容量試算的效能** | 基準值 `useMemo` 綁 `trip.data` 只算一次，增量另算（§4.4.6），避免每次勾選都序列化 1MB |
| 7 | **`pockets`/`places` 誤入 `dedupeByContent` 會造成永久資料遺失** | `normalizeTrip` 完全不碰這兩個欄位，並在程式碼留下註解說明理由（後端文件 §5.2）|
| 8 | **badge 與行程可能不同步** | 不存 `usedIn`；badge 由 `daysForPlace()` 每次 render 反查，資料上是同一份（DDR-23／T-83）|
| 9 | **解析失敗是常態不是例外**（IG 幾乎必失敗）| 失敗不換頁、不清空；焦點**依平台分流**：一般模式送貼文文字欄（S-13）、IG 模式送 C-30 截圖選擇器（S-21）。依 `reason` × 模式給文案（DDR-11）。**v3.0 一律聚焦文字欄是錯的**——那是把使用者推回一個做不到的動作 |
| 10 | **截圖讀不出日文店名 → 直接決定 IG 能不能用** | `image.js` 新增 **`OCR_MAX = 1568` / `OCR_QUALITY = 0.85`**，**不動**既有 `THUMB_MAX = 320`（購物清單縮圖照舊）。**T-99 已於 2026-09-02 完成**（PRD §7.5d）：1024/0.7 下灰色小字（區域／備註）明顯發糊，1568/0.85 下店名與小字皆銳利。**若日後再調這兩個常數，須重跑同樣的對照並回寫 PRD §7.5d** |
| 11 | **`onGoTab` 需要穿三層** | `App` → `PocketView` → `DayPickerSheet` / `CapacityNotice`。以單一 `onGoTab(tabId)` prop 傳遞，不引入 context（規模不值得）|
| 12 | **模式切換不能重建 DOM** | 欄位順序用 flex `order` 切換而非條件渲染兩套 JSX。iOS Safari 在 DOM 重建時會收起鍵盤，且 `<input type="file">` 的已選檔案狀態會遺失（UI spec §8）。捲動位置須維持在連結欄可見，不得因重排把使用者捲到面板底部 |
| 13 | **`mode` 若做成 state 會出現「連結已是 IG、版面還沒換」的中間畫面** | `mode` 一律是 `detectPlatform(url)` 的**衍生值**，無 `useState`／`useEffect`（§5.2）。可逆性與「不搶焦點」因此是結構上的保證，不靠額外邏輯 |
| 14 | **`?ref=instagram.com` 誤判** | `detectPlatform` **比對 hostname 並以 `(^\|\.)…$` 錨定，禁用 `includes`**（§4.5）。誤判的代價是把使用者送去截圖死路，或反之讓她按一次註定失敗的「解析看看」 |
| 15 | **三張 1568px 圖同時壓縮的記憶體尖峰** | `compressImage` **逐張** await，不用 `Promise.all`；壓縮中顯示「處理中…」且不阻塞面板其他欄位（§4.6）|
| 16 | **`compressImage` 回傳 data URL，契約要純 base64** | 送出前以 `dataUrl.slice(indexOf(",") + 1)` 去前綴、`mime` 固定 `"image/jpeg"`（§4.6 `toImages`）。**這是最容易漏掉的一行**——漏了會讓後端拿到 `data:image/jpeg;base64,...` 當 base64，LLM 直接讀圖失敗 |
| 17 | **只帶 IG 連結時不得送出** | 那次請求 100% 落到 `need_text_or_image`，且白白吃掉每 IP 20 次/小時的額度（DDR-27）。主按鈕改為「選擇截圖」＝開檔案選擇器；要硬送只能按逃生口「還是先試試這個連結」|

---

## 7. 測試計畫

### 7.1 Vitest 可覆蓋（純函式，新增／擴充測試檔）

| 測試檔 | 覆蓋的 T-XX | 重點案例 |
|---|---|---|
| `src/lib/__tests__/merge.test.js`（擴充）| **T-70**、**T-71**、T-72、**T-73**、T-74 | v5 blob 餵 v4 邏輯欄位零損失；`> SCHEMA_VERSION` 原樣回傳；連跑兩次遷移結果相同；`places` 是**整筆 LWW**（兩端改不同欄位 → 較新者整筆勝，**不得**寫成欄位合併）；精簡 tombstone 不復活 |
| `src/lib/__tests__/schema.test.js`（新增）| T-75 | `pockets`/`places` 缺 string `id` → `validateTrip` 失敗；`schemaVersion > 5` → reason 為「App 版本過舊」 |
| `src/lib/__tests__/places.test.js`（新增）| **T-97**、T-81（規則層）、T-82（試算層）、T-83（反查層）、T-84（映射層）| `suggestDays` 的 7 個案例（§4.4.3）；`dedupeAgainstSaved` 的 4 個邊界（§4.4.2）；`daysForPlace` 多天／空 placeId；`capacityCheck` 構造接近 900KB 的 trip；`placeToItem` 的 `type === category` |
| **`src/lib/__tests__/share.test.js`（新增，v3.1）** | — （支撐 S-20／S-21 分流的正確性）| **`detectPlatform` 的 7 個邊界（§4.5）**，其中 `?ref=instagram.com` 與 `fakeinstagram.com` 必須回 `other`；`parseShareParams` / `stripShareParams` 的參數解析與清除 |
| `api/__tests__/parse-lib.test.js`（新增）| **T-78**、T-76（階梯判斷層）| `clampPlaces` 超過 12 筆被截斷、非法 category 落回 `other`、confidence 夾在 0..1；`resolveSource` 五個順位各自可達；**`images[]` 的三道上限（張數／單張／總量）各自回 `too_large`**；**`buildImageContent` 產出的 block 序列**（N 個標號 text + N 個 image + 1 個指示 text，且指示文字在最後）|

### 7.2 只能人工驗收（本專案未安裝 jsdom / @testing-library/react）

| T-XX | 為什麼不能自動化 | 人工驗收步驟 |
|---|---|---|
| T-76／T-77／T-79（端點實際 HTTP 行為）| 需要真的打 Vercel function 與 Supabase | 用 `curl` 對 preview 部署打五種輸入，斷言一律 200 且 `ok:false` 分支正確；不存在的 trip key 不得產生 LLM 帳單 |
| T-80／T-81（UI 層斷言）| 需要元件測試環境 | 覆核步驟開著時，於 devtools 檢查 `trip.data.places` 長度不變；低 confidence／已存過兩列預設未勾 |
| T-82（UI 擋下）| 同上 | 用 `simCapacity` 情境（原型有）驗證按鈕停用且無寫入 |
| T-85（離線）| 需要真實 online/offline 事件 | devtools 切離線 → 貼連結 → 產生「待解析」卡 → 回線 → 重新解析成功 |
| T-86（建置產物）| 需要 build | `npm run build && grep -c "grid-cols-6" dist/assets/*.css`（**可寫成 CI 檢查，建議做**）＋ 375px 實測每格 ≥ 44px |
| **T-96**（捷徑 URL）| 需要 iOS 實機 | 裝捷徑 → IG 分享 → 確認開到同一份行程、網址列無 `share=` 殘留 |
| **T-98**（IG 主路徑實機驗證）| **本質上是人工實機**（PRD 明列為驗收關鍵項）| ✅ **已於 2026-09-02 由 CEO 完成**：結論為 IG caption 無法選取複製，**截圖升為 IG 主路徑**，已回寫 PRD v3.6／UI spec v3.1／本文件 v3.1.0。SA 驗收時只需確認 UI 是否已依此結論分流（S-20／S-21 是否存在且正確） |
| **T-99**（OCR 參數實測）| **本質上是人工實機**（需真實 IG 截圖與人眼判讀日文）| **✅ 已於 2026-09-02 完成，結論見 PRD §7.5d：`OCR_MAX = 1568` / `OCR_QUALITY = 0.85`。** 端點接起來後仍須用實際回傳結果複驗一次——T-99 的判讀者是 Opus 而非 `claude-haiku-4-5`，Haiku 對細小文字較弱（這正是選 1568 而非 1024、把餘裕留給較弱模型的理由）。複驗方式：3 則真實日本旅遊 IG 貼文各截 1～3 張（含展開的 caption 與影片字幕）送 `/api/parse-post`，看 ① 日文店名是否正確讀出 ② 每張 base64 ≤ 4MB、總量 ≤ 10MB（實測約 207KB／張，不可能撞到）。**若需再調參，須重跑對照並回寫 PRD §7.5d** |

> **T-98／T-99 都不是 Vitest 能覆蓋的項目**：前者需要 iPhone 上的 IG App 與真人手指，後者需要真實截圖與人眼判讀日文小字。
> 兩者皆列為**人工實機驗收**，且 T-99 的結論可能回頭改常數——實作時把 `OCR_MAX` / `OCR_QUALITY` 集中在 `src/lib/image.js`，調參只需改一處。

> **建議（非本階段決定）**：若要把 T-80/T-81/T-82 自動化，需加 `jsdom` + `@testing-library/react` 兩個 devDependency。本設計刻意**不**加，改把所有判定規則抽成純函式（`dedupeAgainstSaved` / `capacityCheck`），讓風險最高的邏輯已被覆蓋；UI 層只剩「有沒有把布林值接對」。若 CEO 希望補上元件測試，這是一條獨立的後續分支。

---

## 8. 設計過程中發現的 PRD／UI spec 疑點（Q-01 ～ Q-09）

> 完整清單、建議選項、裁定結果與成本評估見 [../cross-check-v3.md](../cross-check-v3.md) §6。**本文件未自行改設計、未默默補洞。**

| # | 摘要 | 狀態 |
|---|---|---|
| Q-01 🔴 | `merge.js` 的 `mergeTrip` 也有 F-69 的資料遺失 bug，PRD §2 原本只寫 `migrate.js` | ✅ **已裁定**（PRD v3.5 §2.3 補上第 ② 處）|
| Q-02 | `validateTrip` 對「比自己新的資料」的處理未定義 | ✅ **已裁定**（PRD v3.5 §4.2 F-77 新增專屬 reason「App 版本過舊」）|
| Q-03 | `pocket.rawText` / `pocket.pending` 未定義，F-78 做不出來 | ✅ **已裁定**（PRD v3.5 §5.2 納入）|
| Q-04 | `PLACE_WARN_BYTES = 800_000` 只出現在 UI spec | ✅ **已裁定**（PRD v3.5 §5.3 具名定義）|
| Q-05 | Toast 與 `lib/share.js` 未列入元件／檔案清單 | ✅ **已裁定**（Toast = **C-29** 放 `components/ui.jsx`；`lib/share.js` 已列入 PRD §6.2，並追加 `detectPlatform`）|
| Q-06 | C-16 用於 S-17「放棄修改」時副標文案錯誤 | ✅ **已裁定**（PRD §6.2：加選填 `subtitle`，預設＝原字串）|
| **Q-07** 🟡 | **降級階梯順位 3.5 與 4 的優先關係未定義**（`text` 短又有截圖時走哪一條）| ⏳ **未裁定**，本設計採用暫定規則並明確標示（見 backend §6.2） |
| **Q-08** 🟡 | **`?share_text=` 帶進來的文字若來自 IG，實際上不存在**（IG 分享只給 URL）| ⏳ **未裁定**，不影響實作（照常預填即可）|
| **Q-09** 🟡 | **F-72 覆核步驟沒有「重新選截圖再解析」的入口** | ⏳ **未裁定**，本設計沿用既有的「‹ 改一下輸入」回到 S-20 |
