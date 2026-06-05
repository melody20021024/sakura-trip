// Live exchange rate lookup (F-25).
// Uses open.er-api.com — a free endpoint that needs no API key — so this
// costs nothing and does not consume any Claude budget. On any failure the
// client keeps its manually-entered rate (v1 behaviour), so this never blocks.
export default async function handler(req, res) {
  const from = (req.query.from || "JPY").toUpperCase();
  const to = (req.query.to || "TWD").toUpperCase();
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    const j = await r.json();
    const rate = j && j.rates ? j.rates[to] : undefined;
    if (j.result !== "success" || typeof rate !== "number") {
      return res.status(200).json({ error: "unavailable" });
    }
    res.status(200).json({
      from,
      to,
      rate,
      asOf: j.time_last_update_utc || new Date().toISOString(),
    });
  } catch (e) {
    res.status(200).json({ error: "unavailable" });
  }
}
