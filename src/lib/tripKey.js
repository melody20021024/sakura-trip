// Trip key resolution + persistence (F-01, F-06).
//
// v1 bug: when the URL had no ?trip param, getTripKey() minted a brand-new
// random key on every open, so reopening (or launching the PWA from the home
// screen, whose start_url has no param) silently created an empty trip and
// "wiped" the user's data. v2 fixes this with a 3-stage resolution:
//
//   1. URL ?trip            → use it
//   2. localStorage lastKey → restore the last trip
//   3. generate a strong key
//
// In every case we write the resolved key back to both the URL and
// localStorage, so the next open is stable.

const LS_KEY = "sakura.lastTrip";

// 22-char (~128-bit) key from crypto, base36. Replaces v1's 8-char Math.random
// key, which was short enough to scan/guess (F-06).
function strongKey() {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 22);
  } catch {
    // No crypto (very old env): fall back to the v1 approach.
    return Math.random().toString(36).slice(2, 10);
  }
}

function readLS() {
  try {
    return window.localStorage.getItem(LS_KEY) || null;
  } catch {
    return null; // private mode / blocked storage
  }
}

function writeLS(key) {
  try {
    window.localStorage.setItem(LS_KEY, key);
    return true;
  } catch {
    return false;
  }
}

// Resolve the active trip key and persist it to URL + localStorage.
// Returns { key, lsAvailable } — lsAvailable=false means reopening without the
// link may need the URL again, which the UI can warn about.
export function resolveTripKey() {
  const url = new URL(window.location.href);
  let key = url.searchParams.get("trip");
  let fromUrl = !!key;

  if (!key) key = readLS();
  if (!key) key = strongKey();

  // Always reflect the key in the URL so sharing/copying works.
  if (!fromUrl || url.searchParams.get("trip") !== key) {
    url.searchParams.set("trip", key);
    window.history.replaceState({}, "", url);
  }
  const lsAvailable = writeLS(key);
  return { key, lsAvailable };
}
