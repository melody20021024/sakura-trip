// One-off: reset a trip's cloud row to a clean v3 default template.
// Usage: node scripts/reset-trip.mjs <tripKey>
import { readFileSync } from "node:fs";
import { freshDefault } from "../src/lib/schema.js";

const key = process.argv[2];
if (!key) { console.error("missing trip key"); process.exit(1); }

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter(Boolean).map((l) => {
    const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)];
  })
);
const URL = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY;

const data = freshDefault();
const res = await fetch(`${URL}/rest/v1/trips?id=eq.${encodeURIComponent(key)}`, {
  method: "PATCH",
  headers: {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify({ data, writer: "reset", updated_at: new Date().toISOString() }),
});
const out = await res.json();
const d = out[0]?.data || {};
console.log("HTTP", res.status);
console.log("days:", (d.days || []).length, "| flights:", (d.flights || []).length, "| food:", (d.food || []).length);
console.log("dates:", (d.days || []).map((x) => x.date));
