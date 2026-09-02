import { describe, it, expect, beforeEach } from "vitest";
import {
  platformOf, checkImages, clampPlaces, clampCollection, resolveSource,
  buildImageContent, buildTextContent, ogMeta, rateLimited, _resetRateLimit,
  MAX_IMAGE_B64, MAX_IMAGES_TOTAL_B64, ITEM_TYPE_KEYS,
} from "../_parse-lib.js";

const img = (n = 10, mime = "image/jpeg") => ({ base64: "x".repeat(n), mime });

describe("platformOf", () => {
  it("recognises the platforms we care about", () => {
    expect(platformOf("https://www.instagram.com/reel/C8x/")).toBe("instagram");
    expect(platformOf("https://www.threads.net/@a/post/1")).toBe("threads");
    expect(platformOf("https://www.xiaohongshu.com/explore/1")).toBe("xiaohongshu");
    expect(platformOf("https://vt.tiktok.com/abc/")).toBe("tiktok");
    expect(platformOf("https://youtu.be/abc")).toBe("youtube");
    expect(platformOf("https://example.com/a")).toBe("other");
  });

  it("matches on host segments, not substrings", () => {
    // The bug this guards: `host.includes("instagram.com")` would flip the whole
    // IngestSheet into Instagram mode for an unrelated link.
    expect(platformOf("https://example.com/?ref=instagram.com")).toBe("other");
    expect(platformOf("https://notinstagram.com/x")).toBe("other");
    expect(platformOf("https://instagram.com.evil.test/x")).toBe("other");
  });

  it("survives garbage input", () => {
    expect(platformOf("")).toBe("other");
    expect(platformOf("not a url")).toBe("other");
    expect(platformOf(undefined)).toBe("other");
  });
});

describe("checkImages — 三道上限各自回報", () => {
  it("passes an empty or absent list", () => {
    expect(checkImages(undefined)).toBeNull();
    expect(checkImages([])).toBeNull();
    expect(checkImages([img(), img(), img()])).toBeNull();
  });

  it("rejects more than 3 with a count-specific message, not 『太大』", () => {
    const msg = checkImages([img(), img(), img(), img()]);
    expect(msg).toMatch(/最多 3 張/);
    expect(msg).not.toMatch(/太大/); // 「選超過 3 張」不是「太大」
  });

  it("rejects one oversized image", () => {
    expect(checkImages([img(MAX_IMAGE_B64 + 1)])).toMatch(/有一張截圖太大/);
  });

  it("rejects an oversized total even when each image is fine", () => {
    const each = Math.floor(MAX_IMAGES_TOTAL_B64 / 3) + 10;
    expect(each).toBeLessThanOrEqual(MAX_IMAGE_B64); // 前提:單張都合法
    expect(checkImages([img(each), img(each), img(each)])).toMatch(/加起來太大/);
  });

  it("rejects an empty base64", () => {
    expect(checkImages([{ base64: "", mime: "image/jpeg" }])).toMatch(/空的/);
  });
});

describe("resolveSource — 五個順位 (T-76 判斷層)", () => {
  const noNet = { fetchOembed: async () => "", fetchOg: async () => "" };
  const long = "福".repeat(60);

  it("順位 1:有圖必先讀圖,即使同時有長文字", async () => {
    // PRD v3.8 §7.2. 原本 images 排在 og 之下,會讓上傳的截圖被整個跳過。
    const out = await resolveSource({ text: long, images: [img()] }, noNet);
    expect(out.via).toBe("image");
    expect(out.images).toHaveLength(1);
  });

  it("順位 1:短文字也一併帶進圖片呼叫當補充脈絡", async () => {
    const out = await resolveSource({ text: "一蘭 中洲店", images: [img()] }, noNet);
    expect(out.via).toBe("image");
    expect(out.extraText).toBe("一蘭 中洲店");
  });

  it("順位 2:沒有圖但文字夠長 → text", async () => {
    const out = await resolveSource({ text: long }, noNet);
    expect(out).toEqual({ via: "text", sourceText: long });
  });

  it("順位 3:YouTube 走 oEmbed", async () => {
    const out = await resolveSource(
      { url: "https://youtu.be/abc" },
      { fetchOembed: async () => long, fetchOg: async () => "" }
    );
    expect(out.via).toBe("oembed");
  });

  it("順位 3:oEmbed 內容太短 → 繼續往下走 og", async () => {
    const out = await resolveSource(
      { url: "https://youtu.be/abc" },
      { fetchOembed: async () => "短", fetchOg: async () => long }
    );
    expect(out.via).toBe("og");
  });

  it("順位 4:一般連結走 og", async () => {
    const out = await resolveSource(
      { url: "https://www.threads.net/@a/post/1" },
      { fetchOembed: async () => "", fetchOg: async () => long }
    );
    expect(out.via).toBe("og");
  });

  it("IG 連結 + og 抓不到 + 沒有截圖 → null（預期行為,不是 bug）", async () => {
    const out = await resolveSource(
      { url: "https://www.instagram.com/reel/C8x/" },
      noNet
    );
    expect(out).toBeNull();
  });

  it("保底:短文字獨自存在時仍送 LLM,總比直接失敗好", async () => {
    const out = await resolveSource({ text: "一蘭 中洲店" }, noNet);
    expect(out).toEqual({ via: "text", sourceText: "一蘭 中洲店" });
  });

  it("順位 5:什麼都沒有 → null", async () => {
    expect(await resolveSource({}, noNet)).toBeNull();
  });
});

describe("buildImageContent — block 序列與順序", () => {
  const blocks = buildImageContent([img(), img(), img()], "城市:福岡", "補充文字");

  it("每張圖前有標號 text block,共 3 text + 3 image + 1 指示", () => {
    expect(blocks).toHaveLength(7);
    expect(blocks.map((b) => b.type)).toEqual(
      ["text", "image", "text", "image", "text", "image", "text"]
    );
    expect(blocks[0].text).toBe("第 1 張截圖(共 3 張):");
    expect(blocks[2].text).toBe("第 2 張截圖(共 3 張):");
    expect(blocks[4].text).toBe("第 3 張截圖(共 3 張):");
  });

  it("指示文字在【最後】,而且明寫『同一則貼文』與『只回一次』", () => {
    const last = blocks[blocks.length - 1];
    expect(last.type).toBe("text");
    expect(last.text).toMatch(/同一則社群貼文/);
    expect(last.text).toMatch(/只產生一組/);
    expect(last.text).toMatch(/只回一次/);
    expect(last.text).toMatch(/補充文字/);
  });

  it("image block 是 base64 source,media_type 有防呆預設", () => {
    expect(blocks[1].source.type).toBe("base64");
    expect(blocks[1].source.media_type).toBe("image/jpeg");
    const noMime = buildImageContent([{ base64: "x" }], "");
    expect(noMime[1].source.media_type).toBe("image/jpeg");
  });

  it("單張時標號仍為『第 1 張(共 1 張)』,不特例", () => {
    const one = buildImageContent([img()], "");
    expect(one).toHaveLength(3);
    expect(one[0].text).toBe("第 1 張截圖(共 1 張):");
  });

  it("沒有補充文字時不留空欄位", () => {
    const b = buildImageContent([img()], "");
    expect(b[2].text).not.toMatch(/使用者另外補充/);
  });
});

describe("buildTextContent", () => {
  it("把 cityHint 與貼文內容組成單一 text block", () => {
    const b = buildTextContent("內容", "城市:福岡");
    expect(b).toHaveLength(1);
    expect(b[0].text).toMatch(/城市:福岡/);
    expect(b[0].text).toMatch(/內容/);
  });
});

describe("clampPlaces (T-78)", () => {
  const mk = (i) => ({
    name: `店${i}`, nameJa: `店${i}`, category: "food",
    area: "福岡", note: "好吃", confidence: 0.9,
  });

  it("截斷至 12 筆", () => {
    expect(clampPlaces(Array.from({ length: 30 }, (_, i) => mk(i)))).toHaveLength(12);
  });

  it("非法 category 落回 other，合法的保留", () => {
    expect(clampPlaces([{ ...mk(1), category: "restaurant" }])[0].category).toBe("other");
    expect(clampPlaces([{ ...mk(1), category: undefined }])[0].category).toBe("other");
    for (const c of ITEM_TYPE_KEYS) {
      expect(clampPlaces([{ ...mk(1), category: c }])[0].category).toBe(c);
    }
  });

  it("confidence 夾在 0..1，非數字給 0.5", () => {
    expect(clampPlaces([{ ...mk(1), confidence: 5 }])[0].confidence).toBe(1);
    expect(clampPlaces([{ ...mk(1), confidence: -3 }])[0].confidence).toBe(0);
    expect(clampPlaces([{ ...mk(1), confidence: "高" }])[0].confidence).toBe(0.5);
    expect(clampPlaces([{ ...mk(1), confidence: undefined }])[0].confidence).toBe(0.5);
  });

  it("丟掉沒有名字的項目", () => {
    expect(clampPlaces([mk(1), { ...mk(2), name: "  " }, null, { name: 5 }])).toHaveLength(1);
  });

  it("非陣列輸入回空陣列", () => {
    expect(clampPlaces(undefined)).toEqual([]);
    expect(clampPlaces("nope")).toEqual([]);
  });

  it("欄位長度截斷,不讓模型灌爆 jsonb", () => {
    const p = clampPlaces([{ ...mk(1), name: "あ".repeat(200), note: "の".repeat(200) }])[0];
    expect(p.name).toHaveLength(60);
    expect(p.note).toHaveLength(60);
  });
});

describe("clampCollection", () => {
  it("空標題有可用的預設", () => {
    expect(clampCollection({}).title).toBe("收藏的貼文");
    expect(clampCollection(null).title).toBe("收藏的貼文");
  });
  it("截斷過長標題", () => {
    expect(clampCollection({ title: "福".repeat(80) }).title).toHaveLength(30);
  });
});

describe("ogMeta", () => {
  it("抓得到 content 在 property 之後的寫法", () => {
    const html = `<meta property="og:title" content="福岡美食">`;
    expect(ogMeta(html, "og:title")).toBe("福岡美食");
  });
  it("也抓得到 content 在 property 之前的寫法", () => {
    const html = `<meta content="福岡美食" property="og:title">`;
    expect(ogMeta(html, "og:title")).toBe("福岡美食");
  });
  it("解開 HTML entity", () => {
    expect(ogMeta(`<meta property="og:title" content="a &amp; b">`, "og:title")).toBe("a & b");
  });
  it("找不到回空字串", () => {
    expect(ogMeta("<html></html>", "og:title")).toBe("");
  });
});

describe("rateLimited", () => {
  beforeEach(() => _resetRateLimit());

  it("同 IP 超過上限即擋下", () => {
    const now = Date.now();
    for (let i = 0; i < 20; i++) expect(rateLimited("1.1.1.1", now)).toBe(false);
    expect(rateLimited("1.1.1.1", now)).toBe(true);
  });

  it("不同 IP 各自計數", () => {
    const now = Date.now();
    for (let i = 0; i < 20; i++) rateLimited("1.1.1.1", now);
    expect(rateLimited("2.2.2.2", now)).toBe(false);
  });

  it("視窗滑掉之後放行", () => {
    const now = Date.now();
    for (let i = 0; i < 20; i++) rateLimited("1.1.1.1", now);
    expect(rateLimited("1.1.1.1", now + 3600_001)).toBe(false);
  });
});
