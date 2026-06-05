// Quick parse-check for JSX/JS files using esbuild's transform (no bundling).
// Usage: node scripts/check-jsx.mjs <files...>
import { transform } from "esbuild";
import { readFile } from "node:fs/promises";

const files = process.argv.slice(2);
let bad = 0;
for (const f of files) {
  try {
    const loader = f.endsWith(".jsx") ? "jsx" : "js";
    await transform(await readFile(f, "utf8"), { loader, jsx: "automatic" });
    console.log("ok:", f);
  } catch (e) {
    bad++;
    console.log("FAIL:", f, "\n", e.message);
  }
}
process.exit(bad ? 1 : 0);
