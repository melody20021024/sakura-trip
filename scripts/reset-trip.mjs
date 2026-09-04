// One-off: reset a trip's cloud row to a clean v3 default template.
//
// Usage: node scripts/reset-trip.mjs <tripKey> --yes
//
// THIS IS DESTRUCTIVE AND HAS NO UNDO. It PATCHes the shared Supabase row for
// <tripKey> with a fresh default trip: every day, flight, expense and place the
// travellers have entered is gone, for everyone, immediately. Since PR #17 the
// script is in version control, so any clone can run it against production with
// the `.env.local` that sits beside it — hence the explicit `--yes`. A bare
// invocation prints what it would overwrite and exits without touching the row.
import { readFileSync } from "node:fs";
import { freshDefault } from "../src/lib/schema.js";

const args = process.argv.slice(2);
const confirmed = args.includes("--yes");
const key = args.find((a) => !a.startsWith("-"));

if (!key) {
  console.error("usage: node scripts/reset-trip.mjs <tripKey> --yes");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter(Boolean).map((l) => {
    const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)];
  })
);
const URL = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY;

if (!URL || !KEY) {
  console.error("missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

// Best-effort read first, so the warning can name what is actually at stake
// rather than describing the damage in the abstract. Wrapped: a network failure
// must still leave the guard below intact — it decides on the flag, never on
// whether this read succeeded.
async function currentRow() {
  try {
    const r = await fetch(
      `${URL}/rest/v1/trips?id=eq.${encodeURIComponent(key)}&select=data,updated_at`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
    );
    if (!r.ok) return null;
    return ((await r.json()) || [])[0] || null;
  } catch {
    return null;
  }
}

const row = await currentRow();
const cur = (row && row.data) || {};
const describe = () => {
  console.error(`trip key:    ${key}`);
  console.error(`supabase:    ${URL}`);
  if (!row) {
    console.error("current row: COULD NOT BE READ (offline, or no such trip key)");
    return;
  }
  console.error(`last write:  ${row.updated_at || "unknown"}`);
  console.error(
    "would erase: "
    + `${(cur.days || []).length} days, `
    + `${(cur.flights || []).length} flights, `
    + `${(cur.food || []).length} food, `
    + `${(cur.expenses || []).length} expenses, `
    + `${(cur.places || []).length} places, `
    + `${(cur.pockets || []).length} pockets`
  );
};

if (!confirmed) {
  console.error("REFUSING TO RESET — this would overwrite shared cloud data with no undo.\n");
  describe();
  console.error("\nRe-run with --yes if that is really what you want:");
  console.error(`  node scripts/reset-trip.mjs ${key} --yes`);
  process.exit(1);
}

console.error("resetting (--yes given):");
describe();

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
