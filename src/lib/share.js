// Source / sharing helpers: the iOS shortcut entry (F-81 / F-83) and the
// platform detection that decides which layout the ingest sheet shows.
//
// Contract: 03-DesignDocs/frontend/pocket-v3.md §4.5, PRD §5.3 / §6.2.

// Same six literals as the backend's `platformOf` (api/_parse-lib.js) and
// `Pocket.platform` (03-DesignDocs/backend/parse-and-schema-v3.md §4.2).
// Three copies of this enum exist; they must not drift.
//
// HARD RULE: compare the hostname, anchored. Never url.includes("instagram.com").
// `https://example.com/?ref=instagram.com` would be misread as Instagram and the
// user gets sent down the screenshot-only path for a site where pasting the text
// would have worked — and `https://fakeinstagram.com/x` likewise.
export function detectPlatform(raw) {
  const t = (raw || "").trim();
  if (!t) return "other";
  try {
    // People paste URLs without a scheme. The `https://` is only so `new URL`
    // can read a hostname — we never write it back to the field; submitting
    // still goes through the existing normalizeUrl().
    const h = new URL(/^https?:\/\//i.test(t) ? t : "https://" + t).hostname.toLowerCase();
    if (/(^|\.)instagram\.com$/.test(h)) return "instagram";
    if (/(^|\.)threads\.(net|com)$/.test(h)) return "threads";
    if (/(^|\.)(xiaohongshu\.com|xhslink\.com)$/.test(h)) return "xiaohongshu";
    if (/(^|\.)tiktok\.com$/.test(h)) return "tiktok";
    if (/(^|\.)(youtube\.com|youtu\.be)$/.test(h)) return "youtube";
  } catch {
    /* just a block of pasted text → other, no layout switch */
  }
  return "other";
}

// A value is only put in the link field if it actually parses as a host. The
// shortcut accepts "URL 與文字", so `?share=` can legitimately carry a sentence;
// dropping it, or showing it inside the 貼文連結 box, are both worse than
// routing it to the text field.
const looksLikeUrl = (s) => {
  const t = (s || "").trim();
  if (!t || /\s/.test(t)) return false;
  try {
    const h = new URL(/^https?:\/\//i.test(t) ? t : "https://" + t).hostname;
    return h.includes(".");
  } catch {
    return false;
  }
};

// F-83. Reads ?share= (the shared URL) and ?share_text= (the shared text).
// Returns null when neither is usable, in which case the sheet still opens —
// just without a prefill (PRD §4.2 F-83 error handling).
export function parseShareParams(search = "") {
  let p;
  try {
    p = new URLSearchParams(search);
  } catch {
    return null;
  }
  const shared = (p.get("share") || "").trim();
  let text = (p.get("share_text") || "").trim();
  let url = "";
  if (looksLikeUrl(shared)) url = shared;
  else if (shared && !text) text = shared;
  if (!url && !text) return null;
  return { url, text };
}

// Clear the share params from the address bar. They must not survive: the URL
// is what the user copies to invite a travel companion, and a stale ?share=
// would reopen the ingest sheet on their device too (T-96).
export function stripShareParams() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("share") && !url.searchParams.has("share_text")) return;
    url.searchParams.delete("share");
    url.searchParams.delete("share_text");
    window.history.replaceState({}, "", url);
  } catch {
    /* no history API (SSR/tests) — nothing to clean */
  }
}

// F-81. The string the user pastes into the iOS shortcut, with the shared URL
// appended by the shortcut itself. ?trip= is what guarantees the shortcut opens
// the same trip rather than minting a new one (T-96).
export const shortcutPrefix = (tripKey, origin) =>
  `${origin || (typeof window !== "undefined" ? window.location.origin : "")}` +
  `/?trip=${encodeURIComponent(tripKey || "")}&share=`;
