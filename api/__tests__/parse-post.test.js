// Handler-level smoke tests for /api/parse-post.
//
// These cover the paths that never reach a provider, so no network and no API
// key are needed. The point of every case is the same contract: HTTP 200 with
// `ok:false` and a reason the front end can branch on (PRD §7.1).
//
// The module reads env at request time, so each test loads a fresh copy via
// `vi.resetModules()` — that also resets the in-memory rate-limit Map.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mkRes = () => {
  const res = { statusCode: 0, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

const mkReq = (body = {}, method = "POST", ip = "9.9.9.9") => ({
  method,
  body,
  headers: { "x-forwarded-for": ip },
  socket: { remoteAddress: ip },
});

// Fresh module graph → fresh rate-limit state, and the env set just above is
// the env the module sees.
async function loadHandler() {
  vi.resetModules();
  return (await import("../parse-post.js")).default;
}

const call = async (handler, ...args) => {
  const res = mkRes();
  await handler(mkReq(...args), res);
  return res;
};

const img = (n = 10) => ({ base64: "x".repeat(n), mime: "image/jpeg" });
const OK_TRIP = { trip: "abc123", text: "福".repeat(60) };
// 不帶任何內容:階梯必然全滅,所以流程停在 need_text_or_image 之前的那些關卡,
// 不會走到供應商。用來測「關卡本身」時最乾淨。
const BARE_TRIP = { trip: "abc123" };

beforeEach(() => {
  // No Supabase config → tripExists() degrades to "true" and never touches the
  // network (PRD §7.4: a missing env var must not take the feature down).
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  vi.stubEnv("PARSE_PROVIDER", "anthropic");
  // Nothing in these tests may touch the network. If a change ever lets one
  // of these paths reach a provider, this makes it fail loudly instead of
  // quietly taking five seconds and a real API call.
  vi.stubGlobal("fetch", vi.fn(async () => {
    throw new Error("unexpected network call in a smoke test");
  }));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fail-soft transport (PRD §7.1) — 永遠 200", () => {
  it("非 POST → bad_request", async () => {
    const handler = await loadHandler();
    const res = await call(handler, {}, "GET");
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: false, reason: "bad_request" });
    expect(res.body.message).toBeTruthy();
  });

  it("缺 trip → bad_request", async () => {
    const handler = await loadHandler();
    const res = await call(handler, { text: "福".repeat(60) });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: false, reason: "bad_request" });
  });

  it("超過 3 張圖 → too_large,且訊息講的是張數不是大小", async () => {
    const handler = await loadHandler();
    const res = await call(handler, { trip: "abc123", images: [img(), img(), img(), img()] });
    expect(res.statusCode).toBe(200);
    expect(res.body.reason).toBe("too_large");
    expect(res.body.message).toMatch(/最多 3 張/);
    expect(res.body.message).not.toMatch(/太大/);
  });
});

describe("trip 不存在與限流對外完全不可區分（中-2）", () => {
  // 兩者只要有一點不同,這支端點就成了「這個 trip key 存不存在」的探測器。
  async function rateLimitedBody() {
    const handler = await loadHandler();
    let res;
    // BARE_TRIP:限流在階梯之前,額度照樣被吃掉,但不會走到供應商。
    for (let i = 0; i <= 20; i++) res = await call(handler, BARE_TRIP);
    return res;
  }

  async function unknownTripBody() {
    vi.stubEnv("SUPABASE_URL", "https://sb.test");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon");
    // Supabase 回空陣列 = 這個 trip key 不存在。
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [] })));
    const handler = await loadHandler();
    return call(handler, { ...BARE_TRIP, trip: "does-not-exist" });
  }

  it("HTTP 狀態、reason 與 message 逐字相同", async () => {
    const limited = await rateLimitedBody();
    const unknown = await unknownTripBody();
    expect(limited.body.reason).toBe("rate_limited");
    expect(unknown.body.reason).toBe("rate_limited");
    expect(unknown.statusCode).toBe(limited.statusCode);
    expect(unknown.body).toEqual(limited.body);
  });

  it("真正的原因只留在 log", async () => {
    await unknownTripBody();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("unknown trip key")
    );
  });

  it("不存在的 trip key 不會呼叫 LLM（T-79）", async () => {
    const res = await unknownTripBody();
    // fetch 只被 tripExists 用掉一次;provider 呼叫從未發生。
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(res.body.ok).toBe(false);
  });
});
