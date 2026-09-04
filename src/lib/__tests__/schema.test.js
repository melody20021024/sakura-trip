import { describe, it, expect } from "vitest";
import {
  validateTrip, freshDefault, SCHEMA_VERSION, scalar,
  MAX_JSON_BYTES, PLACE_BUDGET_BYTES, PLACE_WARN_BYTES,
} from "../schema.js";

describe("validateTrip", () => {
  it("accepts the default trip", () => {
    expect(validateTrip(freshDefault()).ok).toBe(true);
  });

  it("rejects a non-object", () => {
    expect(validateTrip(null).ok).toBe(false);
    expect(validateTrip("nope").ok).toBe(false);
  });

  it("requires at least one traveller", () => {
    const d = freshDefault();
    d.travelers = scalar([]);
    expect(validateTrip(d)).toEqual({ ok: false, reason: "至少需要一位旅伴" });
  });

  // T-75
  it("rejects list items without a string id", () => {
    const d = freshDefault();
    d.food = [{ name: "一蘭" }]; // no id
    expect(validateTrip(d).ok).toBe(false);
    expect(validateTrip(d).reason).toMatch(/food/);
  });

  it("rejects a list field that is not an array", () => {
    const d = freshDefault();
    d.packing = {};
    expect(validateTrip(d).ok).toBe(false);
    expect(validateTrip(d).reason).toMatch(/packing/);
  });

  // F-69 收尾 / F-77 前置. merge.js keeps the higher schemaVersion so that a
  // stale bundle fails this check instead of pushing a stripped blob. The point
  // of the dedicated reason is that the user can fix it themselves.
  describe("版號比本 bundle 新 → 專屬 reason（F-69）", () => {
    it("回傳可行動的訊息，而不是籠統的『資料版本不符』", () => {
      const d = freshDefault();
      d.schemaVersion = SCHEMA_VERSION + 1;
      expect(validateTrip(d)).toEqual({
        ok: false,
        reason: "App 版本過舊,請重新整理頁面",
      });
    });

    it("版號較舊仍走原本的籠統訊息", () => {
      const d = freshDefault();
      d.schemaVersion = SCHEMA_VERSION - 1;
      expect(validateTrip(d)).toEqual({ ok: false, reason: "資料版本不符" });
    });

    it("版號檢查先於其他檢查，舊 bundle 不會誤報成別的錯", () => {
      const d = freshDefault();
      d.schemaVersion = SCHEMA_VERSION + 1;
      d.travelers = scalar([]); // 也不合法,但版號才是真正的原因
      expect(validateTrip(d).reason).toBe("App 版本過舊,請重新整理頁面");
    });
  });
});

// v5 (F1). pockets / places joined LIST_FIELDS, so validateTrip has to reject an
// id-less entry in them too — mergeList silently drops items without an id, so
// anything that gets past here is data we lose without ever noticing.
describe("v5 pockets / places", () => {
  it("預設 trip 帶有空的 pockets / places", () => {
    const d = freshDefault();
    expect(d.pockets).toEqual([]);
    expect(d.places).toEqual([]);
    expect(d.schemaVersion).toBe(5);
  });

  // T-75
  it("places 缺 string id → 驗證失敗", () => {
    const d = freshDefault();
    d.places = [{ name: "一蘭", pocketId: "" }];
    expect(validateTrip(d).ok).toBe(false);
    expect(validateTrip(d).reason).toMatch(/places/);
  });

  it("pockets 缺 string id → 驗證失敗", () => {
    const d = freshDefault();
    d.pockets = [{ title: "福岡美食" }];
    expect(validateTrip(d).ok).toBe(false);
    expect(validateTrip(d).reason).toMatch(/pockets/);
  });

  it("places 不是陣列 → 驗證失敗", () => {
    const d = freshDefault();
    d.places = {};
    expect(validateTrip(d).reason).toMatch(/places/);
  });

  it("精簡 tombstone 通過驗證（只有 id/_deleted/updatedAt）", () => {
    const d = freshDefault();
    d.places = [{ id: "x1", _deleted: true, updatedAt: 1 }];
    expect(validateTrip(d).ok).toBe(true);
  });

  // UI spec §6.4 硬性:元件一律引用具名常數,所以這兩個值的關係必須被鎖住
  it("容量常數:警告 < 擋下 < jsonb 硬上限", () => {
    expect(PLACE_WARN_BYTES).toBe(800_000);
    expect(PLACE_BUDGET_BYTES).toBe(900_000);
    expect(PLACE_WARN_BYTES).toBeLessThan(PLACE_BUDGET_BYTES);
    expect(PLACE_BUDGET_BYTES).toBeLessThan(MAX_JSON_BYTES);
  });
});
