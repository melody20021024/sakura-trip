import { describe, it, expect } from "vitest";
import { computeMoney, toJPY } from "../settle.js";

const ex = (over) => ({ currency: "JPY", category: "other", split: ["A", "B"], paidBy: "A", amount: 0, ...over });

describe("toJPY", () => {
  it("converts TWD at the given rate", () => {
    expect(toJPY({ currency: "TWD", amount: 210 }, 0.21)).toBe(1000);
    expect(toJPY({ currency: "JPY", amount: 1000 }, 0.21)).toBe(1000);
  });
});

describe("computeMoney", () => {
  it("totals per currency and overall JPY", () => {
    const r = computeMoney([ex({ amount: 1000 }), ex({ currency: "TWD", amount: 210 })], ["A", "B"], 0.21);
    expect(r.totalJPY).toBe(1000);
    expect(r.totalTWD).toBe(210);
    expect(r.spentJPY).toBe(2000);
  });

  it("settles a simple two-person split with one transfer", () => {
    // A paid 1000 split A+B -> B owes A 500
    const r = computeMoney([ex({ amount: 1000, paidBy: "A", split: ["A", "B"] })], ["A", "B"], 0.21);
    expect(r.settlements).toHaveLength(1);
    expect(r.settlements[0]).toMatchObject({ from: "B", to: "A" });
    expect(Math.round(r.settlements[0].amt)).toBe(500);
  });

  it("nets out so no one pays themselves and transfers are minimal", () => {
    // A paid 900 (A,B,C), B paid 300 (A,B,C). Each owes 400.
    // A net +500, B net -100, C net -400 -> 2 transfers.
    const r = computeMoney([
      ex({ amount: 900, paidBy: "A", split: ["A", "B", "C"] }),
      ex({ amount: 300, paidBy: "B", split: ["A", "B", "C"] }),
    ], ["A", "B", "C"], 0.21);
    const net = {};
    r.settlements.forEach((s) => { net[s.from] = (net[s.from] || 0) - s.amt; net[s.to] = (net[s.to] || 0) + s.amt; });
    expect(Math.round(net.A)).toBe(500);
    expect(Math.round(net.C)).toBe(-400);
    expect(r.settlements.length).toBeLessThanOrEqual(2);
  });

  it("builds a category breakdown sorted by JPY desc with percentages", () => {
    const r = computeMoney([
      ex({ amount: 3000, category: "stay" }),
      ex({ amount: 1000, category: "eat" }),
    ], ["A", "B"], 0.21);
    expect(r.byCategory[0]).toMatchObject({ category: "stay" });
    expect(Math.round(r.byCategory[0].pct)).toBe(75);
    expect(r.byCategory).toHaveLength(2);
  });

  it("treats unknown categories as other", () => {
    const r = computeMoney([ex({ amount: 500, category: "weird" })], ["A", "B"], 0.21);
    expect(r.byCategory[0].category).toBe("other");
  });
});
