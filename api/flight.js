// Flight schedule lookup via AeroDataBox (free, no Claude cost).
//
// Get a FREE key (~600 units/month) at https://apimarket.aerodatabox.com/ and
// set AERODATABOX_KEY in the environment (Vercel → Settings → Env Variables).
// Returns { from, to, depTime, arrTime } (empty strings when unknown). Fails
// soft so the user can always fill the flight in manually.
const BASE = "https://prod.api.market/api/v1/aedbx/aerodatabox";

// scheduledTime.local looks like "2026-06-10 10:00+09:00" — pull out HH:MM.
const hhmm = (dt) => {
  if (!dt || !dt.local) return "";
  const m = dt.local.match(/\d{4}-\d{2}-\d{2}[ T](\d{2}:\d{2})/);
  return m ? m[1] : "";
};

const empty = { from: "", to: "", depTime: "", arrTime: "" };

export default async function handler(req, res) {
  const { no, date } = req.query;
  if (!no || !date) return res.status(400).json({ error: "missing params" });
  if (!process.env.AERODATABOX_KEY)
    return res.status(200).json({ error: "no key" });
  try {
    const flightNo = String(no).replace(/\s+/g, "").toUpperCase();
    const url = `${BASE}/flights/number/${encodeURIComponent(flightNo)}/${encodeURIComponent(date)}?withLocation=false&withAircraftImage=false`;
    const r = await fetch(url, {
      headers: { "x-magicapi-key": process.env.AERODATABOX_KEY, accept: "application/json" },
    });
    // 204/404 = no scheduled flight for that number/date -> let user fill manually.
    if (r.status === 204 || r.status === 404) return res.status(200).json(empty);
    if (!r.ok) return res.status(200).json(empty);

    const j = await r.json();
    const f = Array.isArray(j) ? j[0] : j;
    if (!f || !f.departure) return res.status(200).json(empty);

    res.status(200).json({
      from: f.departure?.airport?.iata || "",
      to: f.arrival?.airport?.iata || "",
      depTime: hhmm(f.departure?.scheduledTime),
      arrTime: hhmm(f.arrival?.scheduledTime),
    });
  } catch (e) {
    res.status(500).json({ error: "lookup failed" });
  }
}
