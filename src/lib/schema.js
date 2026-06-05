// v2 data shape, defaults, and validation.
// Every mutable scalar is { v, updatedAt } and every list item carries
// { id, updatedAt, _deleted? } so the sync layer can merge field-by-field.
// See 03-DesignDocs/backend/sync-and-apis.md §4.2.

export const SCHEMA_VERSION = 2;

export const uid = () => Math.random().toString(36).slice(2, 9);
export const now = () => Date.now();

// Wrap a raw value as a mergeable scalar. updatedAt defaults to 0 so migrated
// v1 data always loses to any genuine v2 edit.
export const scalar = (v, updatedAt = 0) => ({ v, updatedAt });

// --- pure enums (UI icons live in the view components, not here) ---
export const ITEM_TYPE_KEYS = ["spot", "food", "shop", "move", "stay", "other"];
export const CATEGORY_KEYS = ["eat", "stay", "transport", "shopping", "ticket", "other"];

export const CATEGORY_LABELS = {
  eat: "吃",
  stay: "住宿",
  transport: "交通",
  shopping: "購物",
  ticket: "門票",
  other: "其他",
};

export const PACKING_TEMPLATE = [
  "護照", "錢包 / 現金", "信用卡", "手機充電器", "行動電源",
  "萬國變壓器", "常備藥", "雨具", "換洗衣物", "盥洗用品",
];

export const SYM = { JPY: "¥", TWD: "NT$" };
export const money = (n, c = "JPY") =>
  (SYM[c] || "") + Math.round(Number(n || 0)).toLocaleString();
export const openMap = (q) =>
  window.open(
    "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q),
    "_blank"
  );

// --- v2 default trip (sample九州・沖繩 itinerary, in mergeable shape) ---
// city/lodging are mergeable scalars so concurrent edits to the same day merge
// field-by-field (see merge.js mergeDays).
const sampleDay = (date, city, lodging, items) => ({
  id: uid(),
  date,
  city: scalar(city),
  lodging: scalar(lodging),
  updatedAt: 0,
  items: items.map((it, i) => ({ id: uid(), order: i, time: "", note: "", updatedAt: 0, ...it })),
});

export const DEFAULT = {
  schemaVersion: SCHEMA_VERSION,
  tripName: scalar("九州・沖繩之旅 🌸"),
  startDate: scalar("2026-06-10"),
  endDate: scalar("2026-06-16"),
  rate: scalar(0.21),
  budgetJPY: scalar(0),
  travelers: ["我"],
  flights: [
    { id: uid(), label: "去程", flightNo: "", from: "TPE", to: "OIT", dep: "2026-06-10T00:00", arr: "", est: false, updatedAt: 0 },
    { id: uid(), label: "國內線", flightNo: "", from: "FUK", to: "OKA", dep: "2026-06-13T00:00", arr: "", est: false, updatedAt: 0 },
    { id: uid(), label: "回程", flightNo: "", from: "OKA", to: "TPE", dep: "2026-06-16T00:00", arr: "", est: false, updatedAt: 0 },
  ],
  days: [
    sampleDay("2026-06-10", "大分・由布院", "由布院 溫泉旅館", [
      { title: "抵達大分機場", type: "move", note: "去程航班抵達" },
      { title: "機場巴士 大分機場 → 由布院", type: "move" },
      { title: "金鱗湖・湯之坪街道散策", type: "spot" },
    ]),
    sampleDay("2026-06-11", "由布院 → 福岡", "福岡 博多", [
      { title: "由布院之森 → 博多", type: "move", note: "觀光列車,建議先劃位" },
      { title: "天神・博多逛街", type: "spot" },
    ]),
    sampleDay("2026-06-12", "福岡", "福岡 博多", [
      { title: "柳川遊船(川下り)", type: "spot", note: "西鐵福岡 → 柳川" },
      { title: "太宰府天滿宮", type: "spot" },
      { title: "屋台晚餐", type: "food" },
    ]),
    sampleDay("2026-06-13", "福岡 → 沖繩", "那霸 國際通", [
      { title: "國內線航班 福岡 → 那霸", type: "move" },
      { title: "國際通逛街・晚餐", type: "shop" },
    ]),
    sampleDay("2026-06-14", "沖繩(自駕)", "沖繩 自駕住宿", [
      { title: "取租車・開始自駕", type: "move", note: "換住宿" },
      { title: "前往中北部", type: "spot" },
    ]),
    sampleDay("2026-06-15", "沖繩(自駕)", "沖繩 自駕住宿", [
      { title: "美麗海水族館等景點", type: "spot" },
    ]),
    sampleDay("2026-06-16", "沖繩 → 回國", "", [
      { title: "還車", type: "move" },
      { title: "那霸機場 航班回國", type: "move" },
    ]),
  ],
  expenses: [],
  food: [
    { id: uid(), name: "一蘭拉麵 福岡總本店", meta: "福岡 中洲川端", done: false, updatedAt: 0 },
    { id: uid(), name: "柳川 蒸籠鰻魚飯", meta: "柳川", done: false, updatedAt: 0 },
    { id: uid(), name: "沖繩牛排館", meta: "那霸 國際通", done: false, updatedAt: 0 },
  ],
  shopping: [],
  packing: [],
  albums: [],
};

// Deep clone of DEFAULT so callers never share the sample object.
export const freshDefault = () =>
  (typeof structuredClone === "function"
    ? structuredClone(DEFAULT)
    : JSON.parse(JSON.stringify(DEFAULT)));

// --- validation / size guard (F-07) ---
export const MAX_JSON_BYTES = 1_000_000; // 1MB jsonb soft limit

export function byteSize(data) {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return JSON.stringify(data).length;
  }
}

// Returns { ok, reason }. Cheap structural sanity check before pushing.
export function validateTrip(data) {
  if (!data || typeof data !== "object") return { ok: false, reason: "資料格式錯誤" };
  if (data.schemaVersion !== SCHEMA_VERSION) return { ok: false, reason: "資料版本不符" };
  if (!Array.isArray(data.travelers) || data.travelers.length === 0)
    return { ok: false, reason: "至少需要一位旅伴" };
  if (byteSize(data) > MAX_JSON_BYTES)
    return { ok: false, reason: "資料過大,請精簡(相簿改用連結)" };
  return { ok: true };
}
