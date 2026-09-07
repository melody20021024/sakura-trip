// v3 口袋地點 — every *rule* in the feature, as pure functions.
//
// The UI layer of this feature has no test harness (no jsdom / testing-library,
// deliberately — see 03-DesignDocs/frontend/pocket-v3.md §7.2), so anything that
// decides something lives here instead of inside a component. What is left in
// the components is "did we wire the boolean to the right prop".
//
// Contract: 03-DesignDocs/frontend/pocket-v3.md §4.4
import { byteSize, PLACE_BUDGET_BYTES, PLACE_WARN_BYTES } from "./schema.js";

// Trim → fullwidth to halfwidth → drop all whitespace → lowercase.
// Used for name comparison and city matching; never for display.
export const normalizeName = (s) =>
  String(s ?? "")
    .trim()
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();

// --- F-72 duplicate detection (PRD §4.2) --------------------------------
// Returns one boolean per candidate: "you have saved something by this name".
// It only ever drives a badge and a default-unticked checkbox — nothing here is
// allowed to skip or merge a place on its own (DDR-24).
export function dedupeAgainstSaved(candidates = [], savedPlaces = []) {
  const savedSets = savedPlaces
    .filter((p) => p && !p._deleted) // a deleted place should be savable again
    .map((p) => new Set([normalizeName(p.name), normalizeName(p.nameJa)].filter(Boolean)));
  return candidates.map((c) => {
    const keys = [normalizeName(c?.name), normalizeName(c?.nameJa)].filter(Boolean);
    if (!keys.length) return false;
    // Intersection across both fields on purpose: one post writes the Chinese
    // name, another writes the Japanese one, and they are the same shop.
    // `area` is never part of the key (PRD F-72 rule 4).
    return savedSets.some((s) => keys.some((k) => s.has(k)));
  });
}

// --- F-75 「建議」 day suggestion (PRD §6.3 / T-97) -----------------------
// Hard-coded alias groups. This does not have to be complete or clever: a miss
// costs the user nothing (all days are still listed, in their original order),
// so the cheap version is the right version. First entry of each group is the
// canonical form.
const CITY_ALIASES = [
  ["福岡", "博多", "fukuoka", "hakata"],
  ["那霸", "沖繩", "naha", "okinawa"],
  ["由布院", "湯布院", "yufuin"],
];
const SPLIT = /[\s、,，/／|｜→\-–—・()（）]+/;

const tokensOf = (s) =>
  String(s ?? "").split(SPLIT).map((t) => t.trim()).filter(Boolean);

const canon = (token) => {
  const n = normalizeName(token);
  if (!n) return n;
  for (const group of CITY_ALIASES) {
    if (group.some((x) => normalizeName(x) === n)) return normalizeName(group[0]);
  }
  return n;
};

// Returns a Set of day ids to badge. A Set, not a sorted array, is the point:
// the caller structurally cannot use it to reorder the day list, and reordering
// is exactly what DDR-14 forbids.
export function suggestDays(place, days = []) {
  const out = new Set();
  const area = normalizeName(place?.area);
  if (!area) return out; // rule 4: no area → suggest nothing, block nothing
  const areaTokens = tokensOf(place?.area);
  const areaCanon = new Set(areaTokens.map(canon));

  for (const day of days) {
    if (!day) continue;
    const city = normalizeName(day?.city?.v);
    if (!city) continue; // rule 4: no city → suggest nothing, block nothing
    const cityTokens = tokensOf(day?.city?.v);

    // rule 2: either string contains the other, or a >=2-char token of one
    // appears in the other ("福岡 中洲川端" vs "福岡")
    const hit2 =
      area.includes(city) ||
      city.includes(area) ||
      cityTokens.some((t) => t.length >= 2 && area.includes(normalizeName(t))) ||
      areaTokens.some((t) => t.length >= 2 && city.includes(normalizeName(t)));

    // rule 3: same city after alias folding ("博多" vs "福岡")
    const hit3 = cityTokens.some((t) => areaCanon.has(canon(t)));

    if (hit2 || hit3) out.add(day.id);
  }
  return out; // rule 5: no match → empty set, caller still lists every day
}

// --- 「已加入 D2、D3」 reverse lookup (DDR-23 / T-83) ---------------------
// Place records carry no `usedIn`. The badge is derived from the itinerary on
// every render, so "written into the day" and "badge visible" are the same fact
// and cannot drift apart.
//
// Contract: `days` must already be tombstone-filtered and date-sorted (the same
// expression TripView.jsx uses), so `idx` matches the D(n) the user sees.
export function daysForPlace(placeId, days = []) {
  if (!placeId) return [];
  return days.reduce((acc, day, idx) => {
    const hit = (day?.items || []).some((i) => i && !i._deleted && i.placeId === placeId);
    if (hit) acc.push({ dayId: day.id, idx, date: day.date });
    return acc;
  }, []);
}

// --- place → itinerary item (T-84) --------------------------------------
// `type` IS `category`: same six literals, no translation table, so an item
// added from the pocket is indistinguishable from a hand-typed one — same
// colour block, same icon, same drag-to-reorder.
export const placeToItem = (p) => ({
  title: p?.name || "",
  type: p?.category || "other",
  note: p?.note || "",
  placeId: p?.id || "",
});

// --- F-76 capacity (T-82) ------------------------------------------------
// Size of one pocket plus its places, as it would land in the jsonb. Slightly
// over-counts (the wrapper object's braces and two keys), which is the safe
// direction for a guard.
export const pocketBytes = (pocket, places = []) => byteSize({ pocket, places });

// Base + delta rather than byteSize({...data, places:[...]}): the literal form
// re-serialises the whole trip (up to ~1MB of checklist photo data URLs) on
// every checkbox tick, which visibly stutters on an iPhone. Callers memoise
// `base` against trip.data and only recompute the delta.
export function capacityCheck(data, pocket, places = []) {
  const base = byteSize(data);
  const add = pocketBytes(pocket, places);
  const projected = base + add;
  return {
    ok: projected <= PLACE_BUDGET_BYTES,
    projected,
    budget: PLACE_BUDGET_BYTES,
    warn: base > PLACE_WARN_BYTES,
  };
}

// --- F-78 pocket draft (PRD §4.2 F-78 / §5.5) ----------------------------
// The record IngestSheet writes, built here rather than inline so the one rule
// that is easy to get wrong is testable.
//
// That rule: `rawText` is the raw post text the user pasted, and it exists for
// exactly one job — refilling the sheet when a PENDING pocket is re-parsed
// (F-78 / S-06). The moment a parse succeeds the pocket has places, and the
// text has no reader left. PRD F-78 says so in as many words: 「解析成功後清空
// rawText、pending 設 false」.
//
// Keeping it is not a data-loss bug, it is a budget bug: PRD §5.5 costs a
// pocket at ~194B and F-76's 900KB guard is built on that number. A few
// thousand characters of caption per pocket makes the wall arrive far earlier
// than the model predicts.
export function draftPocketFrom({
  title = "", summary = "", sourceUrl = "", platform = "other",
  rawText = "", pending = false, fallbackTitle = "收藏的貼文",
} = {}) {
  return {
    title: title || fallbackTitle,
    summary,
    sourceUrl,
    platform,
    rawText: pending ? rawText : "",
    pending,
  };
}
