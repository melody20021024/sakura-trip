import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// T-86. This is a build-time failure that looks fine in dev: Tailwind scans the
// source for literal class names, so `grid-cols-${tabs.length}` produces a class
// that exists at runtime and not in the stylesheet. The six-column bar then
// collapses into one column — in production only.
//
// Asserted two ways: the source must keep the literals (this always runs), and
// the built CSS must contain grid-cols-6 (only when dist/ exists, so the suite
// does not depend on build order).
const SRC = readFileSync(new URL("../BottomNav.jsx", import.meta.url), "utf8");
// Comments stripped: the file documents the forbidden pattern by name, and the
// point is to catch it in code, not in prose.
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("BottomNav column classes (T-86)", () => {
  it("使用明確字面值 grid-cols-5 / grid-cols-6", () => {
    expect(CODE).toContain('"grid-cols-5"');
    expect(CODE).toContain('"grid-cols-6"');
  });

  it("嚴禁字串內插產生 class（Tailwind 掃不到，建置後會被 purge）", () => {
    expect(CODE).not.toMatch(/grid-cols-\$\{/);
  });

  it("建置後的 CSS 含 grid-cols-6（有 dist/ 時才檢查）", () => {
    const dir = join(process.cwd(), "dist", "assets");
    if (!existsSync(dir)) return; // 尚未 build,略過
    const css = readdirSync(dir).filter((f) => f.endsWith(".css"));
    if (!css.length) return;
    const all = css.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
    expect(all).toContain("grid-cols-6");
  });
});
