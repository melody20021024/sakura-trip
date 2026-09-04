// Pure helpers for /api/parse-post. Kept in its own file so they can be unit
// tested without a running function, and so the handler stays readable.
//
// The `_` prefix is load-bearing: Vercel turns every file under api/ into a
// route, and only `_`-prefixed ones are excluded.
//
// Contract: 03-DesignDocs/backend/parse-and-schema-v3.md §6.2-§6.5
// Limits:   01-PRD/PRD-v3-pocket-places.md §7.4, §7.5b, §7.5d

// Same enum as src/lib/schema.js ITEM_TYPE_KEYS, on purpose: a parsed place
// drops into days[].items[] with no mapping table, and keeps the same colour
// chip in the pocket and in the itinerary.
export const ITEM_TYPE_KEYS = ["spot", "food", "shop", "move", "stay", "other"];
export const PLATFORM_KEYS = [
  "instagram", "threads", "xiaohongshu", "tiktok", "youtube", "other",
];

export const MAX_PLACES = 12;
export const MAX_IMAGES = 3;
// PRD §7.5d: the API itself allows 10MB base64 per image and 32MB per request,
// so these are product limits, not technical ones. A 1568px/q0.85 screenshot is
// ~207KB as base64, so a legitimate request uses ~2% of the per-image budget.
export const MAX_IMAGE_B64 = 4_000_000;
export const MAX_IMAGES_TOTAL_B64 = 10_000_000;
// Below this, text is treated as a hint rather than post content.
export const MIN_TEXT_LEN = 40;
export const FETCH_TIMEOUT_MS = 6000;

export function platformOf(url) {
  let host;
  try {
    host = new URL(String(url)).hostname.toLowerCase();
  } catch {
    return "other";
  }
  // Compare host segments, never `includes()` — "example.com/?ref=instagram.com"
  // must not read as Instagram.
  const is = (d) => host === d || host.endsWith("." + d);
  if (is("instagram.com")) return "instagram";
  if (is("threads.net") || is("threads.com")) return "threads";
  if (is("xiaohongshu.com") || is("xhslink.com")) return "xiaohongshu";
  if (is("tiktok.com")) return "tiktok";
  if (is("youtube.com") || is("youtu.be")) return "youtube";
  return "other";
}

// Returns null when the images are acceptable, otherwise a reason string.
// Order is deliberate and cheapest-first, and all of it runs before we call the
// LLM *or* Supabase — a 10MB body should not get to spend money or a round trip.
export function checkImages(images) {
  if (!images || !images.length) return null;
  if (!Array.isArray(images)) return "圖片格式不正確";
  if (images.length > MAX_IMAGES) return `一次最多 ${MAX_IMAGES} 張截圖`;
  let total = 0;
  for (const img of images) {
    const len = (img && typeof img.base64 === "string" ? img.base64 : "").length;
    if (!len) return "有一張截圖是空的,請重新選擇";
    if (len > MAX_IMAGE_B64) return "有一張截圖太大了,請重新選擇";
    total += len;
  }
  if (total > MAX_IMAGES_TOTAL_B64) return "幾張截圖加起來太大了,請少選一張";
  return null;
}

// Five-rung ladder (PRD v3.8 §7.2). Images win outright: after T-98 proved that
// an Instagram caption cannot be copied as text, a screenshot is the only path
// that carries content on the app's primary platform. Ranking it below og:meta
// meant a lucky-but-useless og hit could cause the uploaded screenshots to be
// ignored entirely. Any text the user typed rides along as extra context
// regardless of length — combining both is strictly better than either.
//
// `deps` lets the tests drive the ladder without network.
export async function resolveSource({ text, url, images }, deps = {}) {
  const t = String(text || "").trim();
  const oembed = deps.fetchOembed || fetchOembed;
  const og = deps.fetchOg || fetchOg;

  if (images && images.length) return { via: "image", images, extraText: t };
  if (t.length >= MIN_TEXT_LEN) return { via: "text", sourceText: t };

  if (url) {
    const platform = platformOf(url);
    if (platform === "youtube" || platform === "tiktok") {
      const got = await oembed(url, platform);
      if (got && got.length >= MIN_TEXT_LEN) return { via: "oembed", sourceText: got };
    }
    // Instagram almost always fails here: a data-centre IP gets the login wall.
    // That is expected, not a bug — it is why the screenshot path exists.
    const got = await og(url);
    if (got && got.length >= MIN_TEXT_LEN) return { via: "og", sourceText: got };
  }

  // Short text alone still beats failing outright.
  if (t) return { via: "text", sourceText: t };
  return null;
}

const withTimeout = () => AbortSignal.timeout(FETCH_TIMEOUT_MS);

export async function fetchOembed(url, platform) {
  const ep = platform === "youtube"
    ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`
    : `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  try {
    const r = await fetch(ep, { signal: withTimeout() });
    if (!r.ok) return "";
    const j = await r.json();
    return [j.title, j.author_name].filter(Boolean).join("\n");
  } catch {
    return "";
  }
}

// Pull one og: meta tag out of raw HTML. Attribute order varies between sites,
// so try content-after-property and content-before-property.
export function ogMeta(html, prop) {
  const p = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    `<meta[^>]+(?:property|name)=["']${p}["'][^>]*\\scontent=["']([^"']*)["']`,
    `<meta[^>]+content=["']([^"']*)["'][^>]*\\s(?:property|name)=["']${p}["']`,
  ];
  for (const src of patterns) {
    const m = html.match(new RegExp(src, "i"));
    if (m && m[1]) return decodeEntities(m[1]);
  }
  return "";
}
function decodeEntities(s) {
  return String(s)
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export async function fetchOg(url) {
  try {
    const r = await fetch(url, {
      signal: withTimeout(),
      redirect: "follow",
      headers: {
        // A browser-ish UA gets us past some of the softer walls. Instagram's
        // is not one of them.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "accept-language": "zh-TW,zh;q=0.9,ja;q=0.8,en;q=0.7",
      },
    });
    if (!r.ok) return "";
    const html = (await r.text()).slice(0, 400_000);
    return [ogMeta(html, "og:title"), ogMeta(html, "og:description")]
      .filter(Boolean).join("\n").trim();
  } catch {
    return "";
  }
}

export const cityHintLine = (cityHint) => {
  const h = String(cityHint || "").trim();
  return h
    ? `這趟行程會去的城市:${h}。可以用來補 area,但不要把地點硬塞進這些城市。`
    : "";
};

export function buildTextContent(sourceText, hintLine) {
  return [{ type: "text", text: `${hintLine}\n\n以下是貼文內容:\n${sourceText}`.trim() }];
}

// Numbered label before each image, instruction after all of them.
//
// Both parts matter. The content array carries no numbering of its own, so
// without labels the model cannot refer to "the second screenshot" and tends to
// blend the images together. And consecutive screenshots of one caption always
// overlap by a line or two — if the instruction does not say "one post", the
// model returns three titles and duplicate places, and those duplicates get
// flagged 「已存過」 in the review step and pre-unchecked, so the user concludes
// the shops went missing.
export function buildImageContent(images, hintLine, extraText = "") {
  const blocks = [];
  images.forEach((img, i) => {
    blocks.push({ type: "text", text: `第 ${i + 1} 張截圖(共 ${images.length} 張):` });
    blocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mime || "image/jpeg",
        data: img.base64,
      },
    });
  });
  blocks.push({
    type: "text",
    text: (
      `${hintLine}\n\n` +
      `以上 ${images.length} 張截圖是【同一則社群貼文】的連續畫面` +
      `(例如 caption 的上下半段、或影片字幕),不是 ${images.length} 則不同的貼文。` +
      `請把它們合起來看,整則貼文只產生一組 title / summary,` +
      `並列出其中提到的店名或景點;同一家店在多張圖裡出現時只回一次。` +
      (extraText ? `\n\n使用者另外補充的文字:\n${extraText}` : "")
    ).trim(),
  });
  return blocks;
}

// Second line of defence behind the tool schema's maxItems — the model
// occasionally overshoots, and a bad `category` would break the place → item
// hand-off silently.
export function clampPlaces(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((p) => p && typeof p.name === "string" && p.name.trim())
    .slice(0, MAX_PLACES)
    .map((p) => ({
      name: String(p.name).trim().slice(0, 60),
      nameJa: String(p.nameJa || "").trim().slice(0, 60),
      category: ITEM_TYPE_KEYS.includes(p.category) ? p.category : "other",
      area: String(p.area || "").trim().slice(0, 40),
      note: String(p.note || "").trim().slice(0, 60),
      confidence: Number.isFinite(+p.confidence)
        ? Math.min(1, Math.max(0, +p.confidence))
        : 0.5,
    }));
}

// 15/30, not 30/60. Same numbers as PRD §5.2 (pocket.title / pocket.summary),
// PRD §7.3, backend design §5.5 — and as SAVE_PLACES_TOOL below, which already
// tells the model 「15 字內」/「30 字內」. Clamping at twice the documented
// length let an over-long title through the one place that was supposed to
// enforce it, and the pocket card is laid out for 15 characters.
export const MAX_TITLE_LEN = 15;
export const MAX_SUMMARY_LEN = 30;
export const clampCollection = (raw) => ({
  title:
    String((raw && raw.title) || "").trim().slice(0, MAX_TITLE_LEN)
    || "收藏的貼文",
  summary: String((raw && raw.summary) || "").trim().slice(0, MAX_SUMMARY_LEN),
});

export const SYSTEM_PROMPT = [
  "你是日本旅遊行程助理。從社群貼文(文字或截圖)中抽出「可以去的地點」。",
  "規則:",
  "1. 只抽真實存在、能在地圖上找到的店家或景點。",
  "2. 忽略人名、hashtag、廣告詞,以及與這趟行程無關的其他城市。",
  "3. 純風景照或沒有具體地點時,回傳空的 places 陣列,不要硬編。",
  "4. 名稱照貼文原文抄,不要翻譯、不要補字。nameJa 推不出來就給空字串。",
  "5. 讀截圖時只抄畫面上看得見的字。看不清的字寧可降低 confidence,也不要猜補",
  "   —— confidence 是使用者覆核時預設不勾的依據,猜補會讓那道防線失效。",
  "6. 只透過 save_places 工具回覆。",
].join("\n");

export const SAVE_PLACES_TOOL = {
  name: "save_places",
  description: "把貼文中提到的、真實存在且能在地圖上找到的店家或景點記錄下來。",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "summary", "places"],
    properties: {
      title: { type: "string", description: "貼文主題,繁體中文,15 字內" },
      summary: { type: "string", description: "一句話重點,繁體中文,30 字內" },
      places: {
        type: "array",
        maxItems: MAX_PLACES,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "nameJa", "category", "area", "note", "confidence"],
          properties: {
            name: { type: "string", description: "店名/景點名,照貼文原文抄" },
            nameJa: { type: "string", description: "日文正式名稱;推不出來給空字串" },
            category: { type: "string", enum: ITEM_TYPE_KEYS },
            area: { type: "string", description: "城市/區域,例:福岡 中洲川端" },
            note: { type: "string", description: "為什麼值得去,60 字內繁體中文" },
            confidence: { type: "number", description: "0-1,名稱抄錄正確的把握" },
          },
        },
      },
    },
  },
};

// Sliding-window, per-IP, in memory. Reset by every cold start, so this is
// friction rather than security — accepted in PRD §7.4; the next step if it is
// ever actually abused is a Supabase counter table.
const hits = new Map();
export function rateLimited(ip, now = Date.now(), limit = 20, windowMs = 3600_000) {
  const key = ip || "unknown";
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}
export const _resetRateLimit = () => hits.clear();
