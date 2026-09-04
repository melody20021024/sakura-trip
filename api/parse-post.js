// F-70 / F-71: turn a social post (link, pasted text, or up to 3 screenshots)
// into a structured place list.
//
// Fail-soft like api/flight.js and api/rate.js: this endpoint ALWAYS answers
// HTTP 200 and puts success/failure in `ok`, so src/lib/api.js only ever needs
// res.json() and the UI never has to branch on transport errors.
//
// Contract: 03-DesignDocs/backend/parse-and-schema-v3.md §6
// Limits:   01-PRD/PRD-v3-pocket-places.md §7.4, §7.5b, §7.5d
import Anthropic from "@anthropic-ai/sdk";
import {
  resolveSource, platformOf, checkImages, clampPlaces, clampCollection,
  cityHintLine, buildTextContent, buildImageContent,
  SYSTEM_PROMPT, SAVE_PLACES_TOOL, rateLimited, FETCH_TIMEOUT_MS,
} from "./_parse-lib.js";

// Read at request time, not module load: a serverless instance is reused across
// requests but the tests need to drive this, and `missingProviderKey()` below
// has to observe the *runtime* env — the Anthropic SDK reads the key itself, so
// there is no way to tell from the code whether it is set.
const providerOf = () => process.env.PARSE_PROVIDER || "anthropic";
// One override per provider. `PARSE_MODEL` was shared by both, so switching
// PARSE_PROVIDER to gemini while an old PARSE_MODEL was still set would post
// `claude-haiku-4-5` to Google and fail with an opaque 404. Kept as a fallback
// so a deployment that only sets PARSE_MODEL keeps working.
const MODEL_DEFAULTS = { anthropic: "claude-haiku-4-5", gemini: "gemini-2.0-flash" };
const modelFor = (provider) =>
  (provider === "gemini"
    ? process.env.PARSE_MODEL_GEMINI
    : process.env.PARSE_MODEL_ANTHROPIC)
  || process.env.PARSE_MODEL
  || MODEL_DEFAULTS[provider]
  || MODEL_DEFAULTS.anthropic;

// The env var each provider needs. Checked before we call out, because a
// missing key otherwise throws inside the SDK, lands in the generic catch and
// comes back as `rate_limited`「解析服務暫時不通」 — indistinguishable from a
// network blip or a real 429, and therefore the hardest failure to diagnose.
// (As of 2026-09-03 `ANTHROPIC_API_KEY` is in fact NOT set on Vercel: the
// project only has AERODATABOX_KEY and the VITE_SUPABASE_* pair. The design
// doc's claim that the v2 flight feature already set it confused it with
// AERODATABOX_KEY, which is what api/flight.js actually reads.)
const PROVIDER_KEY_ENV = {
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
};
const missingProviderKey = (provider) => {
  const name = PROVIDER_KEY_ENV[provider] || PROVIDER_KEY_ENV.anthropic;
  return String(process.env[name] || "").trim() ? "" : name;
};

// No-prefix names first so a future rename to the standard ones takes over with
// no code change. The VITE_ pair already exists in the Vercel project settings,
// and dashboard variables are visible to serverless process.env regardless of
// prefix (the prefix only means something to Vite) — see PRD §7.4.
const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const fail = (res, reason, message) => res.status(200).json({ ok: false, reason, message });

// The single response for every "we are not going to parse this for you"
// case that must stay indistinguishable from the outside — currently the IP
// rate limit and an unknown trip key. Callers pass `why` for the log only;
// it never reaches the client.
const RATE_LIMITED_MESSAGE = "剛剛解析太多次了,等一下再試。你貼的內容還留著。";
function throttled(res, why) {
  console.warn(`[parse-post] refused: ${why}`);
  return fail(res, "rate_limited", RATE_LIMITED_MESSAGE);
}

// Cheap gate so a stranger with the URL can't burn the API key. Missing config
// degrades to rate-limiting only: a misconfigured env var must not take the
// whole feature down.
async function tripExists(trip) {
  if (!SB_URL || !SB_KEY) {
    console.warn("[parse-post] Supabase env missing; skipping trip key check, rate limit only");
    return true;
  }
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/trips?id=eq.${encodeURIComponent(trip)}&select=id`,
      {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      }
    );
    if (!r.ok) return true; // Supabase hiccup shouldn't block a real user
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return true;
  }
}

async function callAnthropic(content) {
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: modelFor("anthropic"),
    max_tokens: 2048,
    temperature: 0,
    system: SYSTEM_PROMPT,
    tools: [SAVE_PLACES_TOOL],
    // Forced tool use is what guarantees a parseable shape, so the endpoint
    // never has to repair model prose.
    tool_choice: { type: "tool", name: "save_places" },
    messages: [{ role: "user", content }],
  });
  const block = msg.content.find((b) => b.type === "tool_use");
  return block ? block.input : null;
}

// Gemini's free tier is the escape hatch that takes this feature's marginal
// cost to zero (PRD §3.3). Same signature, so the caller is unaware.
async function callGemini(content) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");
  const model = modelFor("gemini");
  const parts = content.map((b) =>
    b.type === "image"
      ? { inline_data: { mime_type: b.source.media_type, data: b.source.data } }
      : { text: b.text }
  );
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: geminiSchema(),
        },
      }),
    }
  );
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const j = await r.json();
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? JSON.parse(text) : null;
}

// Gemini rejects the JSON-Schema keywords Anthropic accepts, so mirror the
// shape rather than reusing SAVE_PLACES_TOOL.input_schema verbatim.
function geminiSchema() {
  const s = SAVE_PLACES_TOOL.input_schema;
  const strip = (node) => {
    if (!node || typeof node !== "object") return node;
    const { additionalProperties, ...rest } = node;
    if (rest.properties) {
      rest.properties = Object.fromEntries(
        Object.entries(rest.properties).map(([k, v]) => [k, strip(v)])
      );
    }
    if (rest.items) rest.items = strip(rest.items);
    return rest;
  };
  return strip(s);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return fail(res, "bad_request", "只接受 POST");

  const body = typeof req.body === "string" ? safeJson(req.body) : req.body || {};
  const { trip, url = "", text = "", images, cityHint = "" } = body;
  if (!trip || typeof trip !== "string") return fail(res, "bad_request", "缺少行程識別碼");

  // Image limits first: cheapest checks, and a 10MB body should not get to
  // spend an LLM call or even a Supabase round trip.
  const imgErr = checkImages(images);
  if (imgErr) return fail(res, "too_large", imgErr);

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
    || req.socket?.remoteAddress || "";
  if (rateLimited(ip)) return throttled(res, "rate limit");
  // Same reason AND the same message as the rate-limit branch, on purpose.
  // Anything that distinguishes the two turns this endpoint into an oracle for
  // 「這個 22 字元的 trip key 存不存在」 — and PRD §7.4 has the front end always
  // prefer the backend `message`, so a different sentence leaks just as loudly
  // as a different `reason` would. The real cause goes to the log instead.
  if (!(await tripExists(trip))) return throttled(res, `unknown trip key ${trip}`);

  const provider = providerOf();
  const missingKey = missingProviderKey(provider);
  if (missingKey) {
    // Before the provider call, and loud: this is a deployment fault, not a
    // user fault, and it must not hide inside the generic 「暫時不通」 bucket.
    console.error(
      `[parse-post] ${missingKey} is not set; provider "${provider}" cannot be called`
    );
    return fail(res, "not_configured", "解析服務尚未設定金鑰,請聯絡管理者。");
  }

  let ladder;
  try {
    ladder = await resolveSource({ text, url, images });
  } catch (e) {
    console.error("[parse-post] resolveSource", e);
    ladder = null;
  }
  if (!ladder) {
    return fail(
      res, "need_text_or_image",
      "讀不到這則貼文的內容。Instagram 一定是這樣 —— 請截一張把說明文字展開的圖。"
    );
  }

  const hint = cityHintLine(cityHint);
  const content = ladder.via === "image"
    ? buildImageContent(ladder.images, hint, ladder.extraText)
    : buildTextContent(ladder.sourceText, hint);

  let raw;
  try {
    raw = provider === "gemini" ? await callGemini(content) : await callAnthropic(content);
  } catch (e) {
    console.error("[parse-post] provider", provider, e?.message || e);
    return fail(res, "rate_limited", "解析服務暫時不通,等一下再試。你貼的內容還留著。");
  }

  const places = clampPlaces(raw && raw.places);
  if (!places.length) {
    return fail(
      res, "no_places",
      ladder.via === "image"
        ? "這張圖上找不到店名,多半是截到食物畫面了 —— 請截有文字的那一段。"
        : "找不到具體的店名或景點。"
    );
  }

  return res.status(200).json({
    ok: true,
    via: ladder.via,
    source: { platform: platformOf(url), url: String(url || "") },
    collection: clampCollection(raw),
    places,
  });
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
