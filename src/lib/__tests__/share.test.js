import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { detectPlatform, parseShareParams, stripShareParams, shortcutPrefix } from "../share.js";

// The layout split (S-10 vs S-20) rides entirely on this function, and a wrong
// answer is not cosmetic: a false "instagram" sends the user to the
// screenshot-only path on a site where pasting the text would have worked.
describe("detectPlatform (§4.5)", () => {
  it("一般 IG 連結", () => {
    expect(detectPlatform("https://www.instagram.com/reel/C8xk2/")).toBe("instagram");
  });

  it("沒有 protocol 也判得出來（補 https:// 只為解析，不回寫欄位）", () => {
    expect(detectPlatform("instagram.com/p/abc")).toBe("instagram");
  });

  // 這三個就是禁用 includes 的理由
  it("?ref=instagram.com → other（hostname 是 example.com）", () => {
    expect(detectPlatform("https://example.com/?ref=instagram.com")).toBe("other");
  });

  it("fakeinstagram.com → other（(^|\\.) 錨定，不匹配後綴）", () => {
    expect(detectPlatform("https://fakeinstagram.com/x")).toBe("other");
    expect(detectPlatform("https://notinstagram.com/x")).toBe("other");
  });

  it("instagram.com.evil.test → other", () => {
    expect(detectPlatform("https://www.instagram.com.evil.test/x")).toBe("other");
  });

  it("路徑裡出現 instagram.com 也不算", () => {
    expect(detectPlatform("https://example.com/instagram.com/reel/x")).toBe("other");
  });

  it("純文字 → other（new URL 丟例外）", () => {
    expect(detectPlatform("福岡必吃五家 一蘭…")).toBe("other");
  });

  it("空值 → other", () => {
    expect(detectPlatform("")).toBe("other");
    expect(detectPlatform(null)).toBe("other");
    expect(detectPlatform(undefined)).toBe("other");
    expect(detectPlatform("   ")).toBe("other");
  });

  it("子網域算數", () => {
    expect(detectPlatform("https://www.instagram.com/x")).toBe("instagram");
    expect(detectPlatform("https://m.threads.net/@a/post/1")).toBe("threads");
  });

  it("其餘平台各自判定（與後端 platformOf 同一組字面值）", () => {
    expect(detectPlatform("https://www.threads.com/@a/post/1")).toBe("threads");
    expect(detectPlatform("https://www.xiaohongshu.com/explore/x")).toBe("xiaohongshu");
    expect(detectPlatform("https://xhslink.com/abc")).toBe("xiaohongshu");
    expect(detectPlatform("https://www.tiktok.com/@a/video/1")).toBe("tiktok");
    expect(detectPlatform("https://www.youtube.com/watch?v=x")).toBe("youtube");
    expect(detectPlatform("https://youtu.be/x")).toBe("youtube");
  });

  it("大小寫不敏感", () => {
    expect(detectPlatform("HTTPS://WWW.INSTAGRAM.COM/reel/x")).toBe("instagram");
  });

  it("只有 instagram 之外的平台不會被誤判成 instagram", () => {
    expect(detectPlatform("https://www.youtube.com/instagram.com")).toBe("youtube");
  });
});

describe("parseShareParams (F-83)", () => {
  it("?share= 是連結 → 預填連結欄", () => {
    expect(parseShareParams("?share=https%3A%2F%2Fwww.instagram.com%2Freel%2FC8xk2%2F"))
      .toEqual({ url: "https://www.instagram.com/reel/C8xk2/", text: "" });
  });

  it("?share_text= → 預填貼文文字欄", () => {
    expect(parseShareParams("?share=&share_text=%E4%B8%80%E8%98%AD"))
      .toEqual({ url: "", text: "一蘭" });
  });

  it("兩個都有 → 兩欄都預填", () => {
    const out = parseShareParams("?trip=abc&share=https%3A%2F%2Fthreads.net%2Fp%2F1&share_text=hi");
    expect(out).toEqual({ url: "https://threads.net/p/1", text: "hi" });
  });

  it("?share= 帶的是一段文字而非連結 → 落到文字欄，不塞進連結欄", () => {
    expect(parseShareParams("?share=" + encodeURIComponent("福岡必吃五家 一蘭")))
      .toEqual({ url: "", text: "福岡必吃五家 一蘭" });
  });

  it("沒有任何分享參數 → null（面板照常可開，只是不預填）", () => {
    expect(parseShareParams("?trip=abc")).toBeNull();
    expect(parseShareParams("")).toBeNull();
    expect(parseShareParams()).toBeNull();
  });

  it("參數存在但為空白 → null", () => {
    expect(parseShareParams("?share=&share_text=")).toBeNull();
    expect(parseShareParams("?share=%20%20")).toBeNull();
  });
});

describe("stripShareParams / shortcutPrefix", () => {
  const origWindow = globalThis.window;
  let replaceState;

  beforeEach(() => {
    replaceState = vi.fn();
    globalThis.window = {
      location: { href: "https://sakura.test/?trip=k3f9&share=https%3A%2F%2Fig", origin: "https://sakura.test" },
      history: { replaceState },
    };
  });
  afterEach(() => { globalThis.window = origWindow; });

  it("清掉 share / share_text，保留 trip（T-96）", () => {
    stripShareParams();
    expect(replaceState).toHaveBeenCalledTimes(1);
    const written = String(replaceState.mock.calls[0][2]);
    expect(written).toContain("trip=k3f9");
    expect(written).not.toContain("share");
  });

  it("沒有分享參數時完全不動網址（不製造多餘的 history 寫入）", () => {
    globalThis.window.location.href = "https://sakura.test/?trip=k3f9";
    stripShareParams();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("shortcutPrefix 帶上 trip key 並以 &share= 結尾", () => {
    expect(shortcutPrefix("k3f9x2q")).toBe("https://sakura.test/?trip=k3f9x2q&share=");
  });

  it("shortcutPrefix 對 trip key 做 URL 編碼", () => {
    expect(shortcutPrefix("a b&c")).toBe("https://sakura.test/?trip=a%20b%26c&share=");
  });
});
