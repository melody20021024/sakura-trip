// Create a brand-new clean trip in the cloud with a fresh strong key.
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { freshDefault } from "../src/lib/schema.js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter(Boolean).map((l) => {
    const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)];
  })
);
const URL = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY;

// 22-char strong key, same scheme as src/lib/tripKey.js
const bytes = new Uint8Array(16); webcrypto.getRandomValues(bytes);
const tripKey = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 22);

const res = await fetch(`${URL}/rest/v1/trips`, {
  method: "POST",
  headers: {
    apikey: KEY, Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json", Prefer: "return=minimal",
  },
  body: JSON.stringify({ id: tripKey, data: freshDefault(), writer: "seed", updated_at: new Date().toISOString() }),
});
console.log("HTTP", res.status);
console.log("NEW_URL https://sakura-trip-omega.vercel.app/?trip=" + tripKey);
