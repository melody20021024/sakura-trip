# 前端設計文件 — 櫻旅 v2 App

###### tags: `Frontend`, `React`, `PWA`, `offline-first`

:::info
功能名稱：v2 前端重構（offline-first 同步、拆檔、拖曳、預算統計、打包清單）
版本：1.0.0
最後更新：2026-06-05
作者：程式開發員
:::

## 1. 相關連結

- PRD：[../../01-PRD/PRD.md](../../01-PRD/PRD.md)
- UI 規範：[../../02-Design/ui-spec.md](../../02-Design/ui-spec.md)
- UI 原型：[../../02-Design/prototype.html](../../02-Design/prototype.html)
- 後端 / 資料契約：[../backend/sync-and-apis.md](../backend/sync-and-apis.md)

## 2. 功能概述與目標

- **功能描述**：把 v1 單檔 619 行 App 重構為模組化、offline-first 的共編 PWA，修正重開洗資料/多人覆蓋/離線不可用三大致命問題，並加入拖曳、預算分類統計、打包清單。
- **技術目標**：
  - 資料層與 UI 解耦：所有讀寫經 `useTrip()` hook，UI 不直接碰 Supabase/IndexedDB。
  - 純函式合併/遷移可單元測試（F-62）。
  - 拆檔（F-60）：`views/` + `components/` + `hooks/` + `lib/`。
  - Tailwind 改建置版（F-61）。
- **範圍限制**：相簿照片上傳（Storage）= Phase 2，本版相簿維持 v1 貼連結。

## 3. 元件結構圖

```
App.jsx (C)                              # 框架：tab 狀態、掛 useTrip
│
├── components/
│   ├── Header.jsx (P)
│   │   └── SyncStatusBadge.jsx (P)      # C-12 同步徽章
│   ├── OfflineBanner.jsx (P)            # C-17
│   ├── BottomNav.jsx (P)                # C-05
│   ├── Card / SectionTitle / PinkBtn / Field (P)   # C-01~04 沿用
│   ├── DragHandle.jsx (P)               # C-15
│   └── ConfirmSheet.jsx (P)             # C-16 刪除確認（全域）
│
├── views/
│   ├── trip/
│   │   ├── TripView.jsx (C)             # P-01
│   │   ├── FlightCard.jsx (C)           # C-06
│   │   ├── DayCard.jsx (C)              # C-07（含 dnd 容器）
│   │   ├── ItemRow.jsx (P)              # C-08（可拖曳）
│   │   └── ItemForm.jsx (P)
│   ├── money/
│   │   ├── MoneyView.jsx (C)            # P-02
│   │   ├── BudgetBar.jsx (P)            # C-13
│   │   ├── CategoryStats.jsx (P)        # C-14
│   │   └── ExpenseForm.jsx (P)          # C-10（含分類 pills）
│   ├── lists/
│   │   ├── ListsView.jsx (C)            # P-03（食/購/打包三卡）
│   │   └── ChecklistCard.jsx (C)        # C-09（食/購/打包共用）
│   ├── album/AlbumView.jsx (C)          # P-04 沿用
│   └── setting/SettingView.jsx (C)      # P-05（+ 預算 + 查匯率）
│
├── hooks/
│   └── useTrip.js                       # 單一資料源：load/patch/同步狀態
│
└── lib/
    ├── db.js          # Dexie/IndexedDB 封裝
    ├── sync.js        # 同步引擎：佇列、debounce、Realtime、重試
    ├── merge.js       # 合併純函式（契約見後端文件 §5.2）
    ├── migrate.js     # v1→v2 遷移（契約見後端文件 §5.3）
    ├── tripKey.js     # F-01 key 持久化 + F-06 強 key
    ├── schema.js      # 預設值、驗證、大小檢查 (F-07)
    └── api.js         # /api/flight、/api/rate 呼叫封裝
```

## 4. 邏輯拆分與資料流

### 4.1 Hooks

| Hook | 職責 |
|------|------|
| `useTrip()` | **核心**。回傳 `{ data, patch, syncState, retry }`。內部：掛載時 `db.load → migrate → setState`，背景 `sync.pull → merge`；`patch(path, value)` 蓋 `updatedAt` → 寫 IndexedDB → 入佇列 → 觸發 `sync.push`；訂閱 Realtime → `merge` |
| `useConfirm()` | 全域刪除確認：`confirm(message) → Promise<boolean>`，驅動 ConfirmSheet |

### 4.2 狀態管理

- 不引 Redux/Zustand。單一 `data` 由 `useTrip` 持有，透過 props 下傳（沿用 v1 風格，規模適中）。
- `syncState`: `'synced' | 'syncing' | 'offline' | 'failed'`（驅動 C-12/C-17）。
- `patch` 採 path-based 寫入，確保只動到的欄位蓋 `updatedAt`（合併正確性關鍵）。

### 4.3 同步引擎 `lib/sync.js`

| 職責 | 規格 |
|------|------|
| push | debounce 600ms upsert；上推前 `merge(local, 最後已知 remote)` + 驗證大小 |
| 重試 | 失敗指數退避（1s/2s/4s，上限 3）；連 3 次 → `syncState='failed'` 露出重試鈕 |
| pull | 載入時拉一次；Realtime 推來時 merge（`writer !== clientId` 才套用）|
| 不打斷輸入 | 合併時若某欄位正被 focus（`activeField`），延後套用該欄位（F-05）|
| 離線 | `navigator.onLine=false` → 不 push、`syncState='offline'`；`online` 事件 → 補推佇列 |

## 5. 詳細元件定義

### 5.1 SyncStatusBadge.jsx（C-12, P）

- **類型**：Presentational
- **職責**：只負責把 `syncState` 顯示成徽章 + 點擊重試。

```typescript
interface Props {
  state: 'synced' | 'syncing' | 'offline' | 'failed';
  pendingCount: number;          // 離線時顯示 N
  onRetry: () => void;
}
```

### 5.2 ItemRow.jsx（C-08, P）

- **職責**：單一行程項目的閱讀/拖曳呈現；編輯切換交回 DayCard。
- **主要依賴**：DragHandle、@dnd-kit `useSortable`。

```typescript
interface Props {
  item: { id: string; time: string; title: string; type: ItemType; note: string; order: number };
  city: string;                  // 供地圖查詢字串
  recentlyRemoteUpdated?: boolean; // F-03 高亮 3 秒
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;  // 觸發 ConfirmSheet
}
```

### 5.3 DayCard.jsx（C-07, C）

- **職責**：一天的容器；持有日內項目的 dnd `SortableContext`，處理拖放 `onReorder`。

```typescript
interface Props {
  day: Day; idx: number;
  onUpdateDay: (id: string, patch: Partial<Day>) => void;
  onReorder: (dayId: string, orderedItemIds: string[]) => void;  // F-12
  onAddItem / onEditItem / onDeleteItem / onDeleteDay: ...;
}
interface Emits { reorder: (dayId: string, ids: string[]) => void; }
```

### 5.4 BudgetBar.jsx（C-13, P）

```typescript
interface Props {
  spentJPY: number;   // 全部換算 JPY
  budgetJPY: number;  // 0 = 未設 → 不渲染
}
// 內部：pct = spent/budget；色階 ≤80 emerald / ≤100 amber / >100 rose + 顯示超支額
```

### 5.5 CategoryStats.jsx（C-14, P）

```typescript
interface Props {
  byCategory: Array<{ category: Category; jpy: number; pct: number }>; // 已排序、已換算
}
// 純 CSS 橫條（DDR-07），各類用對應色
```

### 5.6 ExpenseForm.jsx（C-10, P）

```typescript
interface Props {
  travelers: string[];
  value: ExpenseDraft;            // 含 category
  onChange: (v: ExpenseDraft) => void;
  onSubmit: () => void;
}
interface ExpenseDraft { desc: string; amount: string; currency: 'JPY'|'TWD'; paidBy: string; split: string[]; category: Category; }
```

### 5.7 ChecklistCard.jsx（C-09, C）— 食/購/打包共用（DDR-08）

```typescript
interface Props {
  title: string; icon: ReactNode;
  items: ChecklistItem[];
  variant: 'food' | 'shopping' | 'packing';  // packing: 無 meta、無地圖、顯示「帶入範本」
  template?: string[];                        // packing 用：範本項目
  onChange: (items: ChecklistItem[]) => void;
}
```

### 5.8 ConfirmSheet.jsx（C-16, P）

```typescript
interface Props { open: boolean; message: string; onCancel: () => void; onConfirm: () => void; }
```

## 6. 技術難點與解決方案

| 難點 | 解決方案 |
|------|----------|
| **重開洗資料（F-01）** | `lib/tripKey.js`：①URL `?trip` → ②`localStorage['sakura.lastTrip']` → ③`crypto.getRandomValues` 產 22 字元。任一情況都寫回 URL + localStorage。PWA manifest `start_url` 仍 `/`，靠 localStorage 還原。無痕模式退化並提示 |
| **多人覆蓋（F-03）** | 不再整份 upsert；改 `merge(local, remote)` 後 upsert，欄位級 LWW + tombstone（契約見後端 §5.2），純函式單元測試覆蓋 |
| **離線可用（F-02）** | IndexedDB（Dexie）為本地真實來源，先寫本地秒回 UI，連線時補推。`navigator.onLine` + `online/offline` 事件驅動 syncState |
| **打字被覆蓋（F-05）** | sync 合併時讀 `activeField`（目前 focus 的欄位 path），該欄位延後到 blur 才套用 remote 值 |
| **拖曳 vs time 排序（DDR-04）** | 該日一旦有手動 `order`，渲染改 `sort(by order)`；time 僅顯示。`onReorder` 重算連續 order 並各蓋 updatedAt |
| **遷移風險（高風險）** | `migrate` 冪等 + 備份 `_v1backup`；單元測試對 v1 真實資料樣本驗證；舊短 key 相容 |
