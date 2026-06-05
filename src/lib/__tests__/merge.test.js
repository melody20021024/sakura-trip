import { describe, it, expect } from "vitest";
import { mergeTrip, mergeList, mergeDays, newer, liveItems } from "../merge.js";
import { migrate } from "../migrate.js";
import { scalar, SCHEMA_VERSION } from "../schema.js";

const trip = (over = {}) => ({
  schemaVersion: 2,
  tripName: scalar("A", 100),
  startDate: scalar("2026-06-10", 0),
  endDate: scalar("2026-06-16", 0),
  rate: scalar(0.21, 0),
  budgetJPY: scalar(0, 0),
  travelers: ["我"],
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
    expect(m.days[0].items[0].order).toBe(0);
    expect(m.days[0].items[1].order).toBe(1);
    expect(m.expenses[0].category).toBe("other");
    expect(m.packing).toEqual([]);
    expect(m.budgetJPY).toEqual({ v: 0, updatedAt: 0 });
  });
  it("backs up the raw v1 blob", () => {
    expect(migrate(v1)._v1backup.tripName).toBe("九州之旅");
  });
  it("is idempotent: migrating a v2 doc returns it unchanged", () => {
    const once = migrate(v1);
    expect(migrate(once)).toBe(once);
  });
  it("migrated data merges cleanly with itself", () => {
    const m = migrate(v1);
    const merged = mergeTrip(m, m);
    expect(merged.days[0].items).toHaveLength(2);
    expect(merged.expenses).toHaveLength(1);
  });
});
