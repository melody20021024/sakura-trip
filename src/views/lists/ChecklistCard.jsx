import { useState } from "react";
import { Plus, Check, Trash2, Map as MapIcon, Download, Camera, X } from "lucide-react";
import { Card, SectionTitle, Field, PinkBtn } from "../../components/ui.jsx";
import { liveItems } from "../../lib/merge.js";
import { openMap, byteSize, MAX_JSON_BYTES } from "../../lib/schema.js";
import { compressImage } from "../../lib/image.js";

// C-09: reused for 美食 / 待購 / 打包 (DDR-08). `variant` toggles meta input,
// map button, and the template loader. `withPhoto` adds inline product photos
// (待購清單) so an item can be recognised when shopping later — photos are
// compressed thumbnails stored in the jsonb (see lib/image.js).
export function ChecklistCard({ trip, confirm, field, title, icon, placeholder, sub, variant, template, withPhoto }) {
  const items = liveItems(trip.data[field] || []);
  const mappable = variant !== "packing";
  const [name, setName] = useState("");
  const [meta, setMeta] = useState("");
  const [photo, setPhoto] = useState(""); // pending photo for the item being added
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState(""); // lightbox data URL

  // Compress a picked file to a thumbnail, guarding the 1MB jsonb soft limit.
  // `extra` is the data URL we'd be removing (e.g. replacing an item's photo),
  // so a replace doesn't get blocked by the size of the photo it replaces.
  const toThumb = async (file, extra = "") => {
    setErr("");
    setBusy(true);
    try {
      const url = await compressImage(file);
      const projected = byteSize(trip.data) - extra.length + url.length;
      if (projected > MAX_JSON_BYTES) {
        setErr("相片太多了,空間不足。請先刪幾張舊相片。");
        return null;
      }
      return url;
    } catch (e) {
      setErr(e.message || "相片處理失敗");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    if (!name) return;
    const base = mappable ? { name, meta, done: false } : { name, done: false };
    trip.addCheck(field, withPhoto && photo ? { ...base, photo } : base);
    setName(""); setMeta(""); setPhoto(""); setErr("");
  };
  const loadTemplate = () => {
    const have = new Set(items.map((i) => i.name));
    const fresh = (template || []).filter((n) => !have.has(n));
    if (fresh.length) trip.addManyChecks(field, fresh);
  };
  const del = async (i) => { if (await confirm(`確定刪除「${i.name}」?`)) trip.deleteCheck(field, i.id); };

  const pickNew = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    const url = await toThumb(file);
    if (url) setPhoto(url);
  };
  const pickItem = async (i, e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await toThumb(file, i.photo || "");
    if (url) trip.updateCheck(field, i.id, { photo: url });
  };
  const removeItemPhoto = (i) => trip.updateCheck(field, i.id, { photo: "" });

  const doneCount = items.filter((i) => i.done).length;

  return (
    <Card>
      <SectionTitle icon={icon} right={<span className="text-xs text-rose-300">{doneCount}/{items.length}</span>}>{title}</SectionTitle>
      {variant === "packing" && (
        <button onClick={loadTemplate} className="w-full mb-3 text-sm text-purple-500 border border-purple-200 rounded-xl py-2 flex items-center justify-center gap-1">
          <Download size={15} /> 帶入範本
        </button>
      )}
      <div className="space-y-2 mb-3">
        <Field placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <div className="flex gap-2">
          {mappable && <Field placeholder={sub} value={meta} onChange={(e) => setMeta(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />}
          {withPhoto && (
            photo ? (
              <button onClick={() => setPhoto("")} aria-label="移除相片" className="relative shrink-0 w-10 h-10 rounded-xl overflow-hidden border border-pink-200">
                <img src={photo} alt="" className="w-full h-full object-cover" />
                <span className="absolute inset-0 bg-black/30 text-white grid place-items-center"><X size={14} /></span>
              </button>
            ) : (
              <label aria-label="加相片" className={`shrink-0 w-10 h-10 rounded-xl border border-pink-200 text-rose-300 grid place-items-center cursor-pointer ${busy ? "opacity-50" : ""}`}>
                <Camera size={17} />
                <input type="file" accept="image/*" className="hidden" onChange={pickNew} disabled={busy} />
              </label>
            )
          )}
          <PinkBtn onClick={add} className={`shrink-0 ${mappable || withPhoto ? "" : "flex-1"}`}><Plus size={16} /></PinkBtn>
        </div>
      </div>
      {err && <p className="text-xs text-rose-500 mb-2">{err}</p>}
      <div className="space-y-1.5">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-2 bg-pink-50 rounded-xl p-2.5">
            <button onClick={() => trip.toggleCheck(field, i.id)} aria-label={i.done ? "取消勾選" : "勾選"}
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${i.done ? "bg-rose-400 text-white" : "border-2 border-pink-200"}`}>
              {i.done && <Check size={14} />}
            </button>
            {withPhoto && (
              i.photo ? (
                <button onClick={() => setPreview(i.photo)} aria-label="放大相片" className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-pink-200">
                  <img src={i.photo} alt={i.name} className="w-full h-full object-cover" />
                </button>
              ) : (
                <label aria-label="加相片" className="shrink-0 w-10 h-10 rounded-lg border border-dashed border-pink-200 text-rose-200 grid place-items-center cursor-pointer">
                  <Camera size={15} />
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pickItem(i, e)} disabled={busy} />
                </label>
              )
            )}
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${i.done ? "line-through text-rose-300" : ""}`}>{i.name}</div>
              {i.meta && <div className="text-xs text-rose-400">{i.meta}</div>}
              {withPhoto && i.photo && (
                <button onClick={() => removeItemPhoto(i)} className="text-[11px] text-rose-300 hover:text-rose-500">移除相片</button>
              )}
            </div>
            {mappable && (
              <button onClick={() => openMap(i.name + " " + (i.meta || ""))} aria-label="地圖" className="text-sky-400 hover:text-sky-600 shrink-0 w-9 h-9 grid place-items-center -my-1"><MapIcon size={16} /></button>
            )}
            <button onClick={() => del(i)} aria-label="刪除" className="text-rose-200 hover:text-rose-500 shrink-0 w-9 h-9 grid place-items-center -my-1"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      {preview && (
        <div onClick={() => setPreview("")} className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" role="dialog" aria-label="相片預覽">
          <button onClick={() => setPreview("")} aria-label="關閉" className="absolute top-4 right-4 text-white w-10 h-10 grid place-items-center"><X size={24} /></button>
          <img src={preview} alt="" className="max-w-full max-h-full rounded-xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </Card>
  );
}
