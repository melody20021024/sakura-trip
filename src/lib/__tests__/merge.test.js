import { describe, it, expect } from "vitest";
import { mergeTrip, mergeList, mergeDays, newer, liveItems, collapseDaysByDate, normalizeTrip } from "../merge.js";
import { migrate } from "../migrate.js";
import { scalar, SCHEMA_VERSION } from "../schema.js";

const trip = (over = {}) => ({
  schemaVersion: 2,
  tripName: scalar("A", 100),
  startDate: scalar("2026-06-10", 0),
  endDate: scalar("2026-06-16", 0),
  rate: scalar(0.21, 0),
  budgetJPY: scalar(0, 0),
  travelers: scalar(["我"]),
  flights: [],
  days: [],
  expenses: [],
  food: [],
  shopping: [],
  packing: [],
  albums: [],
  ...over,
});

describe("newer (scalar LWW)", () => {
  it("picks the higher updatedAt", () => {
    expect(newer(scalar("x", 1), scalar("y", 2)).v).toBe("y");
    expect(newer(scalar("x", 5), scalar("y", 2)).v).toBe("x");
  });
  it("breaks ties deterministically regardless of arg order", () => {
    const a = scalar("apple", 7);
    const b = scalar("banana", 7);
    expect(newer(a, b)).toEqual(newer(b, a));
  });
});

describe("mergeList", () => {
  it("unions by id, newer wins", () => {
    const a = [{ id: "1", v: "old", updatedAt: 1 }, { id: "2", v: "keep", updatedAt: 1 }];
    const b = [{ id: "1", v: "new", updatedAt: 2 }];
    const out = mergeList(a, b);
    expect(out.find((x) => x.id === "1").v).toBe("new");
    expect(out.find((x) => x.id === "2").v).toBe("keep");
  });
  it("keeps tombstones; delete after edit wins", () => {
    const edited = [{ id: "1", title: "t", updatedAt: 1 }];
    const deleted = [{ id: "1", _deleted: true, updatedAt: 2 }];
    const out = mergeList(edited, deleted);
    expect(out[0]._deleted).toBe(true);
    expect(liveItems(out)).toHaveLength(0);
  });
  it("edit after delete resurrects (later edit wins)", () => {
    const deleted = [{ id: "1", _deleted: true, updatedAt: 1 }];
    const edited = [{ id: "1", title: "back", updatedAt: 2 }];
    expect(liveItems(mergeList(deleted, edited))).toHaveLength(1);
  });
});

describe("mergeDays (nested items)", () => {
  it("merges items inside the same day", () => {
    const a = [{ id: "d1", updatedAt: 1, items: [{ id: "i1", title: "a", updatedAt: 1 }] }];
    const b = [{ id: "d1", updatedAt: 1, items: [{ id: "i2", title: "b", updatedAt: 1 }] }];
    const out = mergeDays(a, b);
    expect(out).toHaveLength(1);
    expect(out[0].items).toHaveLength(2);
  });

  it("同天兩人改不同欄位 (city vs lodging) 都保留 — 高-1 regression", () => {
    const base = { id: "d1", date: "2026-06-10", city: scalar("", 0), lodging: scalar("", 0), updatedAt: 0, items: [] };
    const editorA = [{ ...base, city: scalar("福岡", 5) }];
    const editorB = [{ ...base, lodging: scalar("博多旅館", 6) }];
    const ab = mergeDays(editorA, editorB);
    const ba = mergeDays(editorB, editorA);
    expect(ab[0].city.v).toBe("福岡");
    expect(ab[0].lodging.v).toBe("博多旅館");
    expect(ba[0].city.v).toBe("福岡"); // order-independent
    expect(ba[0].lodging.v).toBe("博多旅館");
  });

  it("離線回線:本地與遠端各自新增同天項目都保留 — 高-3 merge regression", () => {
    const day = (items) => ({ id: "d1", date: "x", city: scalar("", 0), lodging: scalar("", 0), updatedAt: 1, items });
    const local = [day([{ id: "i1", title: "a", updatedAt: 1 }, { id: "i2", title: "local-offline", updatedAt: 2 }])];
    const remote = [day([{ id: "i1", title: "a", updatedAt: 1 }, { id: "i3", title: "remote", updatedAt: 2 }])];
    const out = mergeDays(local, remote);
    expect(out[0].items.map((i) => i.id).sort()).toEqual(["i1", "i2", "i3"]);
  });
});

describe("collapseDaysByDate — 重複天數修復", () => {
  const sampleDay = (id, date) => ({
    id, date, city: scalar("", 0), lodging: scalar("", 0), updatedAt: 0,
    items: [
      { id: id + "-i1", time: "", type: "move", title: "抵達大分機場", note: "", updatedAt: 0 },
      { id: id + "-i2", time: "", type: "spot", title: "金鱗湖", note: "", updatedAt: 0 },
    ],
  });

  it("collapses three same-date sample days into one, de-duping items by content", () => {
    const days = [sampleDay("b", "2026-06-10"), sampleDay("a", "2026-06-10"), sampleDay("c", "2026-06-10")];
    const out = collapseDaysByDate(days);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("a"); // smallest id survives (deterministic)
    expect(out[0].items).toHaveLength(2); // 6 unioned -> 2 by content
  });

  it("keeps distinct dates and is order-independent", () => {
    const days = [sampleDay("x", "2026-06-11"), sampleDay("a", "2026-06-10"), sampleDay("b", "2026-06-10")];
    const out = collapseDaysByDate(days);
    expect(out.map((d) => d.date).sort()).toEqual(["2026-06-10", "2026-06-11"]);
  });

  it("leaves a single day untouched", () => {
    const d = sampleDay("a", "2026-06-10");
    expect(collapseDaysByDate([d])[0]).toBe(d);
  });
});

describe("normalizeTrip — 重複航班/清單修復", () => {
  it("de-dups triplicated sample flights and food by content", () => {
    const fl = (id) => ({ id, label: "去程", flightNo: "", from: "TPE", to: "OIT", dep: "2026-06-10T00:00", arr: "", updatedAt: 0 });
    const food = (id) => ({ id, name: "一蘭拉麵", meta: "福岡", done: false, updatedAt: 0 });
    const t = trip({
      flights: [fl("a"), fl("b"), fl("c")],
      food: [food("x"), food("y")],
    });
    const out = normalizeTrip(t);
    expect(out.flights).toHaveLength(1);
    expect(out.food).toHaveLength(1);
  });
  it("a deleted duplicate does not nuke an identical live flight (prefer live)", () => {
    const t = trip({ flights: [
      { id: "a", label: "去程", flightNo: "", from: "TPE", to: "OIT", dep: "", arr: "", _deleted: true, updatedAt: 0 },
      { id: "b", label: "去程", flightNo: "", from: "TPE", to: "OIT", dep: "", arr: "", updatedAt: 0 },
    ]});
    const out = normalizeTrip(t).flights.filter((f) => !f._deleted);
    expect(out).toHaveLength(1); // the live one survives
  });
  it("keeps genuinely different flights", () => {
    const t = trip({ flights: [
      { id: "a", label: "去程", flightNo: "", from: "TPE", to: "OIT", dep: "", arr: "", updatedAt: 0 },
      { id: "b", label: "回程", flightNo: "", from: "OKA", to: "TPE", dep: "", arr: "", updatedAt: 0 },
    ]});
    expect(normalizeTrip(t).flights).toHaveLength(2);
  });
});

describe("pick tie-break (equal updatedAt) — 中-1", () => {
  it("tombstone wins a tie, order-independent", () => {
    const edit = [{ id: "1", title: "t", updatedAt: 5 }];
    const del = [{ id: "1", _deleted: true, updatedAt: 5 }];
    expect(liveItems(mergeList(edit, del))).toHaveLength(0);
    expect(liveItems(mergeList(del, edit))).toHaveLength(0);
  });
  it("non-deleted tie converges regardless of key construction order", () => {
    const a = [{ id: "1", title: "apple", note: "x", updatedAt: 5 }];
    const b = [{ id: "1", note: "x", title: "banana", updatedAt: 5 }];
    expect(mergeList(a, b)[0].title).toBe(mergeList(b, a)[0].title);
  });
});

describe("mergeTrip", () => {
  it("is idempotent: merge(a,a) deep-equals a (modulo list order)", () => {
    const a = trip({ food: [{ id: "f1", name: "x", updatedAt: 1 }] });
    const m = mergeTrip(a, a);
    expect(m.tripName).toEqual(a.tripName);
    expect(m.food).toHaveLength(1);
  });
  it("converges regardless of merge order (commutative)", () => {
    const a = trip({ tripName: scalar("A", 2), food: [{ id: "f1", name: "old", updatedAt: 1 }] });
    const b = trip({ tripName: scalar("B", 1), food: [{ id: "f1", name: "new", updatedAt: 3 }] });
    const ab = mergeTrip(a, b);
    const ba = mergeTrip(b, a);
    expect(ab.tripName.v).toBe(ba.tripName.v);
    expect(ab.tripName.v).toBe("A"); // updatedAt 2 > 1
    expect(ab.food[0].name).toBe(ba.food[0].name);
    expect(ab.food[0].name).toBe("new"); // updatedAt 3 > 1
  });
  it("re-merge keeps an edit committed during an in-flight push — 高-NEW-1", () => {
    // L1 = what we pushed; pushRemote returned merged(L1, cloud). Meanwhile the
    // user committed item f2 locally (dataRef = L2). doPush must adopt
    // mergeTrip(L2, pushResult), not pushResult alone.
    const L1 = trip({ food: [{ id: "f1", name: "ramen", updatedAt: 1 }] });
    const pushResult = trip({ food: [{ id: "f1", name: "ramen", updatedAt: 1 }, { id: "cloud", name: "from-cloud", updatedAt: 2 }] });
    const L2 = trip({ food: [{ id: "f1", name: "ramen", updatedAt: 1 }, { id: "f2", name: "added-mid-push", updatedAt: 3 }] });
    const adopted = mergeTrip(L2, pushResult);
    expect(adopted.food.map((x) => x.id).sort()).toEqual(["cloud", "f1", "f2"]);
  });

  it("travellers are last-write-wins so removing 我 sticks (v4)", () => {
    const local = trip({ travelers: scalar(["柔", "柔爸"], 5) });   // newer: 我 removed
    const remote = trip({ travelers: scalar(["柔", "柔爸", "我"], 1) }); // older: still has 我
    expect(mergeTrip(local, remote).travelers.v).toEqual(["柔", "柔爸"]);
    expect(mergeTrip(remote, local).travelers.v).toEqual(["柔", "柔爸"]); // order-independent
  });

  it("two editors changing different items both survive", () => {
    const base = trip({ food: [{ id: "f1", name: "ramen", updatedAt: 1 }] });
    const editorA = { ...base, food: [{ id: "f1", name: "ramen", updatedAt: 1 }, { id: "f2", name: "sushi", updatedAt: 2 }] };
    const editorB = { ...base, food: [{ id: "f1", name: "tonkotsu ramen", updatedAt: 3 }] };
    const out = mergeTrip(editorA, editorB);
    expect(out.food.find((x) => x.id === "f1").name).toBe("tonkotsu ramen");
    expect(out.food.find((x) => x.id === "f2").name).toBe("sushi");
  });
});

describe("migrate (v1 -> v2)", () => {
  const v1 = {
    tripName: "九州之旅",
    startDate: "2026-06-10",
    rate: 0.21,
    travelers: ["我", "旅伴"],
    days: [{ id: "d1", date: "2026-06-10", city: "福岡", lodging: "博多",
      items: [{ id: "i1", title: "拉麵", type: "food", note: "" }, { id: "i2", title: "天神", type: "spot" }] }],
    expenses: [{ id: "e1", desc: "晚餐", amount: 3000, currency: "JPY", paidBy: "我", split: ["我"], date: "2026-06-10" }],
    food: [{ id: "f1", name: "一蘭", meta: "", done: false }],
    albums: [],
  };

  it("upgrades scalars and stamps list items", () => {
    const m = migrate(v1);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(m.tripName).toEqual({ v: "九州之旅", updatedAt: 0 });
    expect(m.days[0].updatedAt).toBe(0);
    expect(m.days[0].city).toEqual({ v: "福岡", updatedAt: 0 });
    expect(m.days[0].lodging).toEqual({ v: "博多", updatedAt: 0 });
    expect(m.days[0].items[0].order).toBe(0);
    expect(m.days[0].items[1].order).toBe(1);
    expect(m.expenses[0].category).toBe("other");
    expect(m.travelers).toEqual({ v: ["我", "旅伴"], updatedAt: 0 }); // wrapped to scalar (v4)
    expect(m.packing).toEqual([]);
    expect(m.budgetJPY).toEqual({ v: 0, updatedAt: 0 });
  });
  it("backs up the raw v1 blob", () => {
    expect(migrate(v1)._v1backup.tripName).toBe("九州之旅");
  });
  it("is idempotent: migrating a current-version doc returns it unchanged", () => {
    const once = migrate(v1);
    expect(migrate(once)).toBe(once);
  });
  it("re-normalizes early-v2 data (string city/lodging) to scalars on v2->v3", () => {
    const earlyV2 = {
      schemaVersion: 2,
      tripName: { v: "x", updatedAt: 1 },
      days: [{ id: "d1", date: "x", city: "福岡", lodging: "博多", updatedAt: 1, items: [] }],
      _v1backup: { old: true },
    };
    const m = migrate(earlyV2);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(m.days[0].city).toEqual({ v: "福岡", updatedAt: 0 });
    expect(m.days[0].lodging.v).toBe("博多");
    expect(m._v1backup).toEqual({ old: true }); // preserved, not re-snapshotted
  });
  it("migrated data merges cleanly with itself", () => {
    const m = migrate(v1);
    const merged = mergeTrip(m, m);
    expect(merged.days[0].items).toHaveLength(2);
    expect(merged.expenses).toHaveLength(1);
  });
});

// F-69 上半。The failure this guards against is cloud-level and unrecoverable:
// a device still running an older bundle pulls a newer blob, migrate() rebuilds
// it from a field whitelist, the unknown fields vanish, validateTrip says the
// result is fine, and pushRemote writes the stripped copy back for everyone.
describe("migrate — 未知欄位向前相容 (F-69, T-70/T-71/T-72)", () => {
  it("T-71: 版號比自己新 → 原樣回傳，不重建、不降版號", () => {
    const future = {
      schemaVersion: SCHEMA_VERSION + 1,
      tripName: scalar("未來", 5),
      travelers: scalar(["柔"]),
      days: [],
      pockets: [{ id: "p1", title: "福岡美食", updatedAt: 9 }],
      places: [{ id: "x1", name: "一蘭", updatedAt: 9 }],
    };
    const out = migrate(future);
    expect(out).toBe(future); // 同一個物件,連複製都沒做
    expect(out.schemaVersion).toBe(SCHEMA_VERSION + 1);
    expect(out.pockets).toHaveLength(1);
    expect(out.places).toHaveLength(1);
  });

  it("T-70: 舊版資料帶著未知欄位遷移 → 欄位零損失", () => {
    const oldWithFuture = {
      // 沒有 schemaVersion(v1),但帶著未來版本才有的欄位
      tripName: "九州",
      travelers: ["柔"],
      places: [{ id: "x1", name: "一蘭 福岡總本店", updatedAt: 3 }],
      pockets: [{ id: "p1", title: "福岡美食", updatedAt: 3 }],
      somethingNobodyKnowsYet: { deep: [1, 2, 3] },
    };
    const m = migrate(oldWithFuture);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(m.places).toEqual(oldWithFuture.places);
    expect(m.pockets).toEqual(oldWithFuture.pockets);
    expect(m.somethingNobodyKnowsYet).toEqual({ deep: [1, 2, 3] });
    expect(m.tripName).toEqual({ v: "九州", updatedAt: 0 }); // 既有遷移行為不變
  });

  it("T-70: mergeTrip 不得丟掉未知欄位，也不得降版號（F-69 下半，真正的主要破口）", () => {
    // mergeTrip 的呼叫點涵蓋 useTrip 載入/Realtime/applyRemote 與 sync.pushRemote,
    // 觸發頻率遠高於 migrate — 只修 migrate 完全擋不住資料遺失。
    const v4local = trip({ schemaVersion: SCHEMA_VERSION });
    const v5remote = trip({
      schemaVersion: SCHEMA_VERSION + 1,
      tripName: scalar("B", 200),
      pockets: [{ id: "p1", title: "福岡美食", updatedAt: 9 }],
      places: [{ id: "x1", name: "一蘭 福岡總本店", updatedAt: 9 }],
    });

    const merged = mergeTrip(v4local, v5remote);
    expect(merged.pockets).toHaveLength(1);
    expect(merged.places[0].name).toBe("一蘭 福岡總本店");
    expect(merged.schemaVersion).toBe(SCHEMA_VERSION + 1); // 不得被降回本版
    expect(merged.tripName.v).toBe("B"); // 既有欄位級 LWW 不變

    // 方向對調也要成立（本地已有新欄位、遠端還沒）
    const other = mergeTrip(v5remote, v4local);
    expect(other.places).toHaveLength(1);
    expect(other.schemaVersion).toBe(SCHEMA_VERSION + 1);
  });

  it("mergeTrip 帶未知欄位時仍冪等", () => {
    const t = trip({
      schemaVersion: SCHEMA_VERSION,
      places: [{ id: "x1", name: "一蘭", updatedAt: 1 }],
    });
    const once = mergeTrip(t, t);
    expect(mergeTrip(once, once)).toEqual(once);
    expect(once.places).toHaveLength(1);
  });

  it("T-72: 帶未知欄位仍然冪等，且既有清單零損失", () => {
    const once = migrate({
      tripName: "九州",
      travelers: ["柔"],
      days: [{ id: "d1", date: "2026-06-10", city: "福岡", lodging: "博多",
        items: [{ id: "i1", title: "拉麵", type: "food" }, { id: "i2", title: "天神", type: "spot" }] }],
      expenses: [{ id: "e1", desc: "晚餐", amount: 3000, currency: "JPY", paidBy: "柔", split: ["柔"] }],
      food: [{ id: "f1", name: "一蘭", meta: "", done: false }],
      places: [{ id: "x1", name: "一蘭", updatedAt: 1 }],
    });
    expect(migrate(once)).toBe(once); // 已是現行版號 → 原樣回傳
    expect(once.days[0].items).toHaveLength(2);
    expect(once.expenses).toHaveLength(1);
    expect(once.food).toHaveLength(1);
    expect(once.places).toHaveLength(1);
  });
});
