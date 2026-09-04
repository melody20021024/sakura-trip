import { describe, it, expect } from "vitest";
import {
  normalizeName, dedupeAgainstSaved, suggestDays, daysForPlace,
  placeToItem, pocketBytes, capacityCheck,
} from "../places.js";
import { scalar, freshDefault, PLACE_BUDGET_BYTES, PLACE_WARN_BYTES } from "../schema.js";

const day = (id, city, items = []) => ({ id, date: "2026-06-1" + id.slice(1), city: scalar(city), items });
const item = (id, placeId, over = {}) => ({ id, placeId, title: "x", updatedAt: 1, ...over });

describe("normalizeName", () => {
  it("去頭尾空白、去內部空白", () => {
    expect(normalizeName(" 一蘭拉麵 福岡總本店 ")).toBe("一蘭拉麵福岡總本店");
  });
  it("全形轉半形並轉小寫", () => {
    expect(normalizeName("ＩＣＨＩＲＡＮ")).toBe("ichiran");
  });
  it("全形空白也算空白", () => {
    expect(normalizeName("一蘭　福岡")).toBe("一蘭福岡");
  });
  it("空值一律回空字串", () => {
    expect(normalizeName("")).toBe("");
    expect(normalizeName(null)).toBe("");
    expect(normalizeName(undefined)).toBe("");
  });
});

// T-81 規則層。These booleans only tick/untick a checkbox — nothing here is
// allowed to drop or merge a place.
describe("dedupeAgainstSaved (F-72)", () => {
  const saved = [
    { id: "s1", name: "一蘭拉麵 福岡總本店", nameJa: "一蘭 福岡本社総本店" },
    { id: "s2", name: "BLUE SEAL 國際通店", nameJa: "" },
  ];

  it("同名（含空白差異）判定為已存過", () => {
    expect(dedupeAgainstSaved([{ name: "一蘭拉麵福岡總本店" }], saved)).toEqual([true]);
  });

  it("跨欄位命中也算：候選的 nameJa 對上既有的 name", () => {
    expect(dedupeAgainstSaved([{ name: "別的店", nameJa: "一蘭 福岡本社総本店" }], saved)).toEqual([true]);
  });

  it("全形／大小寫差異不影響判定", () => {
    expect(dedupeAgainstSaved([{ name: "blue seal 國際通店" }], saved)).toEqual([true]);
  });

  it("不比對 area：同名不同區仍算已存過（提示而非自動處理）", () => {
    expect(dedupeAgainstSaved([{ name: "一蘭拉麵 福岡總本店", area: "東京" }], saved)).toEqual([true]);
  });

  it("名稱皆空 → false（不可能與任何東西同名）", () => {
    expect(dedupeAgainstSaved([{ name: "", nameJa: "" }], saved)).toEqual([false]);
  });

  it("既有地點已刪（tombstone）→ false，刪掉的就該能重新存", () => {
    const deleted = [{ id: "s1", name: "一蘭", _deleted: true }];
    expect(dedupeAgainstSaved([{ name: "一蘭" }], deleted)).toEqual([false]);
  });

  it("savedPlaces 為空 → 全 false", () => {
    expect(dedupeAgainstSaved([{ name: "一蘭" }, { name: "小金ちゃん" }], [])).toEqual([false, false]);
  });

  it("回傳長度與順序對應候選清單", () => {
    const out = dedupeAgainstSaved([{ name: "沒存過" }, { name: "一蘭拉麵 福岡總本店" }], saved);
    expect(out).toEqual([false, true]);
  });
});

// T-97 — the seven cases from frontend/pocket-v3.md §4.4.3, verbatim.
describe("suggestDays (F-75 / T-97)", () => {
  const days = [
    day("d1", "大分・由布院"),
    day("d2", "福岡"),
    day("d3", "博多"),
    day("d4", ""),
    day("d5", "由布院"),
    day("d6", "沖繩(自駕)"),
  ];

  const ids = (area) => [...suggestDays({ area }, days)];

  it("整串包含：area 福岡 中洲川端 → city 福岡 建議", () => {
    expect(ids("福岡 中洲川端")).toContain("d2");
  });

  it("別名群：area 福岡 中洲川端 → city 博多 建議", () => {
    expect(ids("福岡 中洲川端")).toContain("d3");
  });

  it("不相干：area 福岡 中洲川端 → city 由布院 不建議", () => {
    expect(ids("福岡 中洲川端")).not.toContain("d5");
    expect(ids("福岡 中洲川端")).not.toContain("d1");
  });

  it("city 為空 → 不建議也不擋（其他天照常判定）", () => {
    const out = ids("福岡 中洲川端");
    expect(out).not.toContain("d4");
    expect(out).toContain("d2"); // 沒有因為 d4 而中斷
  });

  it("area 為空 → 回空集合，不建議也不擋", () => {
    expect(suggestDays({ area: "" }, days).size).toBe(0);
    expect(suggestDays({}, days).size).toBe(0);
    expect(suggestDays(null, days).size).toBe(0);
  });

  it("分隔符 + 別名：area 那霸 國際通 → city 沖繩(自駕) 建議", () => {
    expect(ids("那霸 國際通")).toContain("d6");
  });

  it("分隔符：area 由布院 → city 大分・由布院 建議", () => {
    expect(ids("由布院")).toContain("d1");
    expect(ids("由布院")).toContain("d5");
  });

  it("回傳 Set，結構上無法拿來排序（DDR-14）", () => {
    const out = suggestDays({ area: "福岡" }, days);
    expect(out).toBeInstanceOf(Set);
    expect(Array.isArray(out)).toBe(false);
  });

  it("零相符也不丟例外，回空集合（呼叫端仍列出所有天）", () => {
    expect(suggestDays({ area: "北海道 札幌" }, days).size).toBe(0);
  });

  it("days 為空 / 未給 → 空集合", () => {
    expect(suggestDays({ area: "福岡" }, []).size).toBe(0);
    expect(suggestDays({ area: "福岡" }).size).toBe(0);
  });

  // 規則 2 的 token 比對有「≥2 字」門檻,單字 token 不參與 —— 否則
  // 「京 中洲川端」會因為那個「京」命中「東京」。
  it("多 token 中的單字 token 不參與比對", () => {
    expect([...suggestDays({ area: "京 中洲川端" }, [day("dx", "東京")])]).toEqual([]);
  });

  // 整串包含不設門檻（設計文件 §4.4.3 明文）,所以單字 area 仍可命中。
  // 這是刻意的:實務上 area 來自 AI 的「城市／區域」欄,不會只有一個字。
  it("整串包含不受 token 門檻限制：area「福」仍命中 city「福岡」", () => {
    expect([...suggestDays({ area: "福" }, [day("dx", "福岡")])]).toEqual(["dx"]);
  });
});

// T-83 反查層
describe("daysForPlace (DDR-23 / T-83)", () => {
  const days = [
    day("d1", "由布院", [item("i1", "")]),
    day("d2", "福岡", [item("i2", "x1")]),
    day("d3", "博多", [item("i3", "x1"), item("i4", "x2")]),
  ];

  it("同一個 placeId 出現在多天 → 全部列出，順序即行程順序", () => {
    expect(daysForPlace("x1", days)).toEqual([
      { dayId: "d2", idx: 1, date: "2026-06-12" },
      { dayId: "d3", idx: 2, date: "2026-06-13" },
    ]);
  });

  it("idx 是行程順序索引，badge 顯示 D(idx+1)", () => {
    expect(daysForPlace("x2", days).map((d) => "D" + (d.idx + 1))).toEqual(["D3"]);
  });

  it("placeId 為空 → []（手打的行程項目沒有來源地點）", () => {
    expect(daysForPlace("", days)).toEqual([]);
    expect(daysForPlace(undefined, days)).toEqual([]);
  });

  it("該項目已刪 → 不計入，badge 自動消失", () => {
    const gone = [day("d2", "福岡", [item("i2", "x1", { _deleted: true })])];
    expect(daysForPlace("x1", gone)).toEqual([]);
  });

  it("沒有任何一天含這個地點 → []", () => {
    expect(daysForPlace("nope", days)).toEqual([]);
  });

  it("day 沒有 items 欄位也不炸", () => {
    expect(daysForPlace("x1", [{ id: "d9", date: "2026-06-19" }])).toEqual([]);
  });
});

// T-84 映射層
describe("placeToItem (T-84)", () => {
  it("type 直接等於 category，零轉換表", () => {
    const p = { id: "x1", name: "一蘭", category: "food", note: "24 小時", area: "福岡" };
    expect(placeToItem(p)).toEqual({ title: "一蘭", type: "food", note: "24 小時", placeId: "x1" });
  });

  it("不帶 area / nameJa 進行程（行程項目沒有這兩個欄位）", () => {
    const out = placeToItem({ id: "x1", name: "一蘭", category: "food", area: "福岡", nameJa: "一蘭" });
    expect(out).not.toHaveProperty("area");
    expect(out).not.toHaveProperty("nameJa");
  });

  it("缺欄位時給安全預設", () => {
    expect(placeToItem({})).toEqual({ title: "", type: "other", note: "", placeId: "" });
  });
});

// T-82 試算層
describe("capacityCheck / pocketBytes (F-76 / T-82)", () => {
  const pocket = { id: "p1", title: "福岡三日必吃美食", summary: "中洲屋台與拉麵", sourceUrl: "", platform: "instagram", rawText: "", pending: false, createdAt: 1, updatedAt: 1 };
  const places = [
    { id: "x1", pocketId: "p1", name: "一蘭拉麵 福岡總本店", nameJa: "一蘭 福岡本社総本店", category: "food", area: "福岡 中洲川端", note: "24 小時營業", lat: null, lng: null, geoSource: "", photoUrl: "", order: 0, updatedAt: 1 },
  ];

  it("pocketBytes 隨內容成長，且比實際欄位總和略高（保守高估）", () => {
    const one = pocketBytes(pocket, places);
    const three = pocketBytes(pocket, [...places, ...places, ...places]);
    expect(one).toBeGreaterThan(0);
    expect(three).toBeGreaterThan(one);
  });

  it("空 trip 一定通過，且不觸發預警", () => {
    const out = capacityCheck(freshDefault(), pocket, places);
    expect(out.ok).toBe(true);
    expect(out.warn).toBe(false);
    expect(out.budget).toBe(PLACE_BUDGET_BYTES);
  });

  it("接近上限的 trip → 擋下寫入（ok:false）", () => {
    const big = { ...freshDefault(), _bulk: "x".repeat(PLACE_BUDGET_BYTES) };
    const out = capacityCheck(big, pocket, places);
    expect(out.ok).toBe(false);
    expect(out.projected).toBeGreaterThan(PLACE_BUDGET_BYTES);
  });

  it("超過警告門檻但仍在預算內 → warn 為真、ok 仍為真", () => {
    const mid = { ...freshDefault(), _bulk: "x".repeat(PLACE_WARN_BYTES + 1_000) };
    const out = capacityCheck(mid, pocket, places);
    expect(out.warn).toBe(true);
    expect(out.ok).toBe(true);
  });

  it("取消勾選幾筆後可以再試（places 少了就通過）", () => {
    const heavy = Array.from({ length: 40 }, (_, i) => ({ ...places[0], id: "x" + i }));
    const base = { ...freshDefault(), _bulk: "x".repeat(PLACE_BUDGET_BYTES - 5_000) };
    expect(capacityCheck(base, pocket, heavy).ok).toBe(false);
    expect(capacityCheck(base, pocket, places).ok).toBe(true);
  });
});
