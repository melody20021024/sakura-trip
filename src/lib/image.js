// Inline-photo support for checklists (待購清單). Photos are downscaled and
// JPEG-compressed to a small thumbnail so they can live inside the trip jsonb
// and sync across devices without blowing the 1MB soft limit (see schema.js).
//
// A 320px / q0.6 JPEG thumbnail is typically ~15–30KB as a data URL — enough to
// recognise a product later, cheap enough to keep dozens of them.

export const THUMB_MAX = 320; // longest edge, px
export const THUMB_QUALITY = 0.6; // JPEG quality 0..1

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
