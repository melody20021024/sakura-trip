import { describe, it, expect } from "vitest";
import { toBase64Images, OCR_MAX, OCR_QUALITY, THUMB_MAX, THUMB_QUALITY } from "../image.js";

// PRD §7.5a 陷阱 1：compressImage 給的是 data URL，契約要純 base64。
// 漏掉去前綴這一行不會有任何錯誤 —— 請求照送、後端照收，只是 LLM 讀不出圖，
// 使用者看到的是「AI 認不出我的截圖」。全案最容易靜默失敗的一行，之前零覆蓋。
const shot = (dataUrl) => ({ key: "k", dataUrl, name: "s.jpg", bytes: dataUrl.length });
const PAYLOAD = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==";

describe("toBase64Images — data URL 去前綴（PRD §7.5a 陷阱 1）", () => {
  it("去掉 data:image/jpeg;base64, 前綴，只留裸 base64", () => {
    expect(toBase64Images([shot(`data:image/jpeg;base64,${PAYLOAD}`)])).toEqual([
      { base64: PAYLOAD, mime: "image/jpeg" },
    ]);
  });

  it("送出的字串絕不能還帶著 data: 開頭或逗號", () => {
    const [out] = toBase64Images([shot(`data:image/jpeg;base64,${PAYLOAD}`)]);
    expect(out.base64.startsWith("data:")).toBe(false);
    expect(out.base64).not.toContain(",");
  });

  it("mime 固定 image/jpeg —— compressImage 一律輸出 JPEG", () => {
    const out = toBase64Images([shot("data:image/png;base64,iVBORw0KGgo=")]);
    expect(out[0].mime).toBe("image/jpeg");
  });

  it("多張維持順序，一對一對應", () => {
    const out = toBase64Images([
      shot("data:image/jpeg;base64,AAA"),
      shot("data:image/jpeg;base64,BBB"),
      shot("data:image/jpeg;base64,CCC"),
    ]);
    expect(out.map((o) => o.base64)).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("沒有截圖時回空陣列（契約允許 images 為空）", () => {
    expect(toBase64Images([])).toEqual([]);
    expect(toBase64Images()).toEqual([]);
  });

  it("已經是裸 base64（無逗號）時原樣送出，不吃掉第一個字元", () => {
    expect(toBase64Images([shot(PAYLOAD)])[0].base64).toBe(PAYLOAD);
  });
});

describe("image.js 常數（T-99 定案值，PRD §7.5d）", () => {
  it("OCR 用 1568 / 0.85", () => {
    expect([OCR_MAX, OCR_QUALITY]).toEqual([1568, 0.85]);
  });
  it("購物清單縮圖的 320 / 0.6 未被 v3 動到", () => {
    expect([THUMB_MAX, THUMB_QUALITY]).toEqual([320, 0.6]);
  });
});
