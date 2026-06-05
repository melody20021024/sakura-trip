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
