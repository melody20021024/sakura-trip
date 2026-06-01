export default async function handler(req, res) {
  const { no, date } = req.query;
  if (!no || !date) return res.status(400).json({ error: "missing params" });
  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(200).json({ error: "no key" });
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `查詢航班 ${no} 在 ${date} 的定期時刻表。只回傳 JSON,不要任何其他文字,格式:{"from":"出發機場IATA","to":"抵達機場IATA","depTime":"HH:MM","arrTime":"HH:MM"}。查不到的欄位留空字串。`,
          },
        ],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });
    const j = await r.json();
    const text = (j.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    const m = text.match(/\{[\s\S]*\}/);
    res.status(200).json(JSON.parse(m ? m[0] : "{}"));
  } catch (e) {
    res.status(500).json({ error: "lookup failed" });
  }
}
