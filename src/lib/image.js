// Inline-photo support for checklists (待購清單). Photos are downscaled and
// JPEG-compressed to a small thumbnail so they can live inside the trip jsonb
// and sync across devices without blowing the 1MB soft limit (see schema.js).
//
// A 320px / q0.6 JPEG thumbnail is typically ~15–30KB as a data URL — enough to
// recognise a product later, cheap enough to keep dozens of them.

export const THUMB_MAX = 320; // longest edge, px
export const THUMB_QUALITY = 0.6; // JPEG quality 0..1

// v3 F-71: screenshots sent to /api/parse-post for OCR. A completely different
// job from the checklist thumbnail above, so it gets its own pair of constants
// and the 320/0.6 defaults are left untouched.
//
// 1568 is the native ceiling of the Standard vision tier `claude-haiku-4-5`
// belongs to — send anything larger and the server downsamples it again, i.e.
// two resamples instead of one, which makes small Japanese text worse, not
// better. T-99 (PRD §7.5d, measured 2026-09-02) compared 1024/0.7 against
// 1568/0.85 on real IG screenshots: at 1024/0.7 the grey small text (area,
// note) was visibly mushy. Output is ~784x1568, ~155KB, ~207KB as base64.
// Changing either number means re-running that comparison and writing the
// result back to PRD §7.5d.
export const OCR_MAX = 1568;
export const OCR_QUALITY = 0.85;

// Compress an image File/Blob to a JPEG data URL (downscaled to `max` px on the
// longest edge). Resolves to a string; rejects on non-images / decode errors.
export function compressImage(file, { max = THUMB_MAX, quality = THUMB_QUALITY } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !(file.type || "").startsWith("image/")) {
      reject(new Error("請選擇圖片檔"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("圖片讀取失敗"));
    };
    img.src = url;
  });
}
