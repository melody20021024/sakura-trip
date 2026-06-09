import { useState } from "react";
import { Plus, Check, Trash2, Map as MapIcon, Download } from "lucide-react";
import { Card, SectionTitle, Field, PinkBtn } from "../../components/ui.jsx";
import { liveItems } from "../../lib/merge.js";
import { openMap, openUrl } from "../../lib/schema.js";

// C-09: reused for 美食 / 待購 / 打包 (DDR-08). `variant` toggles meta input,
// map button, and the template loader.
export function ChecklistCard({ trip, confirm, field, title, icon, placeholder, sub, variant, template }) {
  const items = liveItems(trip.data[field] || []);
  const mappable = variant !== "packing";
  const [name, setName] = useState("");
  const [meta, setMeta] = useState("");
  const [mapUrl, setMapUrl] = useState("");

  const add = () => {
    if (!name) return;
    trip.addCheck(field, mappable ? { name, meta, mapUrl, done: false } : { name, done: false });
    setName(""); setMeta(""); setMapUrl("");
  };
  const loadTemplate = () => {
    const have = new Set(items.map((i) => i.name));
    const fresh = (template || []).filter((n) => !have.has(n));
    if (fresh.length) trip.addManyChecks(field, fresh);
  };
  const del = async (i) => { if (await confirm(`確定刪除「${i.name}」?`)) trip.deleteCheck(field, i.id); };

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
        {mappable && <Field placeholder={sub} value={meta} onChange={(e) => setMeta(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />}
        <div className="flex gap-2">
          {mappable && <Field placeholder="地圖連結 (選填;留空則用名稱搜尋)" value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />}
          <PinkBtn onClick={add} className={`shrink-0 ${mappable ? "" : "flex-1"}`}><Plus size={16} /></PinkBtn>
        </div>
      </div>
      <div className="space-y-1.5">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-2 bg-pink-50 rounded-xl p-2.5">
            <button onClick={() => trip.toggleCheck(field, i.id)} aria-label={i.done ? "取消勾選" : "勾選"}
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${i.done ? "bg-rose-400 text-white" : "border-2 border-pink-200"}`}>
              {i.done && <Check size={14} />}
            </button>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${i.done ? "line-through text-rose-300" : ""}`}>{i.name}</div>
              {i.meta && <div className="text-xs text-rose-400">{i.meta}</div>}
            </div>
            {(mappable || i.mapUrl) && (
              <button onClick={() => (i.mapUrl ? openUrl(i.mapUrl) : openMap(i.name + " " + (i.meta || "")))}
                aria-label="地圖" title={i.mapUrl ? "開啟地圖連結" : "在 Google 地圖搜尋"}
                className="text-sky-400 hover:text-sky-600 shrink-0 w-9 h-9 grid place-items-center -my-1"><MapIcon size={16} /></button>
            )}
            <button onClick={() => del(i)} aria-label="刪除" className="text-rose-200 hover:text-rose-500 shrink-0 w-9 h-9 grid place-items-center -my-1"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}
