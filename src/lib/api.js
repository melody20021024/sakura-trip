// Serverless API client (backend B1/B2). Both calls fail soft: the caller
// always has a manual fallback, so a failed lookup never blocks the user.

export async function lookupFlight(no, date) {
  const res = await fetch(`/api/flight?no=${encodeURIComponent(no)}&date=${encodeURIComponent(date)}`);
  return res.json(); // { from,to,depTime,arrTime } or { error }
}

export async function lookupRate(from = "JPY", to = "TWD") {
  const res = await fetch(`/api/rate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  return res.json(); // { from,to,rate,asOf } or { error }
}

// F-70/F-71. Turn a post (link / pasted text / up to 3 screenshots) into places.
// The endpoint always answers HTTP 200 and reports failure in the body, so the
// only thing that can throw here is the network itself.
//
// `images` is the v3.1 contract: [{ base64, mime }], at most 3, base64 WITHOUT
// the `data:image/jpeg;base64,` prefix — compressImage() returns a data URL and
// the caller has to strip it (see IngestSheet toImages). Getting that wrong
// produces no error at all, just a model that cannot read the picture.
// Contract: 03-DesignDocs/backend/parse-and-schema-v3.md §6.1
export async function parsePost({ trip, url = "", text = "", images = [], cityHint = "" }) {
  const res = await fetch("/api/parse-post", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ trip, url, text, images, cityHint }),
  });
  return res.json(); // { ok:true, via, source, collection, places } | { ok:false, reason, message }
}
