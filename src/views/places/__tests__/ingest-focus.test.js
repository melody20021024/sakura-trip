import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// S-21（UI spec §6.1.3 / DDR-11）：IG 解析失敗後焦點必須落在 C-30 截圖選擇器，
// 不是貼文文字欄。整個 v3.6 改版的理由就是 T-98 證明 IG 的 caption 複製不到 ——
// 失敗後把使用者推回文字欄，等於把她推向一個做不到的動作。
//
// 這裡守的是「焦點目標是不是一個真的能拿到焦點的元素」。原本的實作 focus() 在
// className="hidden"（display:none）的 <input type="file"> 上：瀏覽器**不報錯、
// 也不給焦點**，所以 S-21 在 IG 這條主路徑上等於沒做，而且從程式碼上完全看不出來。
//
// 本專案未安裝 jsdom / @testing-library（設計文件 §7.2），元件層採用與
// bottom-nav.test.js 相同的原始碼靜態驗證：規則寫在程式碼結構裡，就能在
// 程式碼結構上守住。實際的 document.activeElement 驗證見 PR #25 的實測紀錄。
const SRC = readFileSync(new URL("../IngestSheet.jsx", import.meta.url), "utf8");
// 註解要剝掉：本檔的註解逐字寫著被禁止的寫法，要抓的是程式碼不是散文。
// 區塊註解只認「前面是空白或 {」的 /*，否則 accept="image/*" 裡的 /* 會被當成
// 註解開頭，把後面整段程式碼吃掉（第一版就踩到了）。
const CODE = SRC.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1").replace(/^\s*\/\/.*$/gm, "");

// 取出含有某個 prop 的那個 JSX 開標籤
const tagWith = (code, tag, needle) => {
  const re = new RegExp(`<${tag}\\b[^>]*>`, "g");
  return [...code.matchAll(re)].map((m) => m[0]).find((t) => t.includes(needle)) || "";
};

describe("S-21 解析失敗焦點（IngestSheet）", () => {
  it("C-30 的 file input 仍是 className=\"hidden\" —— 前提成立才有這條規則", () => {
    const input = tagWith(CODE, "input", "ref={inputRef}");
    expect(input).not.toBe("");
    expect(input).toContain('className="hidden"');
  });

  it("display:none 的 file input 絕不可以是 focus() 的目標", () => {
    // 它只能被 .click()（MainButton 的「選一張截圖」走這條），不能被 focus()
    expect(CODE).not.toMatch(/shotInputRef\.current[\s\S]{0,80}?\.focus\s*\(/);
    expect(CODE).not.toMatch(/ig\s*\?\s*shotInputRef/);
  });

  it("IG 模式的焦點目標是 C-30 可見的 label（shotFocusRef）", () => {
    expect(CODE).toMatch(/ig\s*\?\s*shotFocusRef\.current\s*:\s*textRef\.current/);
    expect(CODE).toMatch(/focusRef=\{shotFocusRef\}/);
  });

  it("該 label 帶 tabIndex={-1}，否則 <label> 本身也拿不到程式化焦點", () => {
    const label = tagWith(CODE, "label", "ref={focusRef}");
    expect(label).not.toBe("");
    expect(label).toMatch(/tabIndex=\{-1\}/);
  });

  it("一般模式（S-13）維持聚焦貼文文字欄，沒有被一起改掉", () => {
    const textarea = tagWith(CODE, "textarea", "ref={textRef}");
    expect(textarea).toContain('id="ing-text"');
    expect(CODE).toMatch(/:\s*textRef\.current/);
  });
});
