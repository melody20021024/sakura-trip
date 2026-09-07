import { useEffect, useState } from "react";
import { Map as MapIcon, Plus, X } from "lucide-react";
import { Field } from "../../components/ui.jsx";
import { openMap } from "../../lib/schema.js";
import { ITEM_TYPES, typeOf } from "./constants.js";

// C-23: place detail / edit sheet (S-15 ~ S-17).
//
// HARD RULE — no save-as-you-type. useTrip's applyRemote only protects an
// activeField that is a top-level scalar name or "day:<id>:<field>"; place
// fields are outside that, so a per-keystroke commit would be overwritten by any
// realtime merge that lands mid-edit. This follows SettingView's tripName
// pattern (explicit save button) rather than widening the sync core, which has
// already passed SA review (DDR-15).
export function PlaceSheet({ place, onClose, onSave, onDelete, onAddToTrip, confirm }) {
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(false);

  // Reload the draft whenever a different place is opened.
  useEffect(() => {
    setSaved(false);
    setDraft(
      place
        ? { name: place.name || "", category: place.category || "other", area: place.area || "", note: place.note || "" }
        : null
    );
  }, [place]);

  if (!place || !draft) return null;

  const t = typeOf(draft.category);
  const Ico = t.icon;
  const dirty =
    draft.name !== (place.name || "") ||
    draft.category !== (place.category || "other") ||
    draft.area !== (place.area || "") ||
    draft.note !== (place.note || "");

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  // S-17. The subtitle must be the "you will lose your edit" one, not the
  // inherited delete warning.
  const tryClose = async () => {
    if (!dirty) { onClose(); return; }
    const ok = await confirm("要放棄修改嗎？", {
      subtitle: "這個地點剛剛改的內容不會存起來。",
      confirmLabel: "放棄修改",
    });
    if (ok) onClose();
  };

  // S-16: brief confirmation, then close, so the user sees that it landed.
  const save = () => {
    onSave(place.id, { ...draft });
    setSaved(true);
    setTimeout(onClose, 180);
  };

  const del = async () => {
    if (await confirm(`確定刪除「${place.name}」?`)) {
      onDelete(place.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="地點詳情">
      <div className="absolute inset-0 bg-black/30" onClick={tryClose} />
      <div
        className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl max-w-2xl mx-auto p-5 overflow-y-auto"
        style={{ maxHeight: "90vh", paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-[11px] rounded-md px-1.5 py-0.5 flex items-center gap-1 shrink-0 ${t.c}`}>
            <Ico size={11} /> {t.label}
          </span>
          <h2 className="font-bold text-rose-500 flex-1 truncate">{place.name}</h2>
          <button onClick={tryClose} aria-label="關閉" className="text-rose-300 w-11 h-11 grid place-items-center -mr-2">
            <X size={18} />
          </button>
        </div>

        <label className="text-xs text-rose-400" htmlFor="ps-name">店名</label>
        <Field id="ps-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} className="mt-1 mb-3" />

        <label className="text-xs text-rose-400" htmlFor="ps-cat">類別</label>
        <select
          id="ps-cat"
          value={draft.category}
          onChange={(e) => set({ category: e.target.value })}
          className="w-full bg-pink-50 border border-pink-100 rounded-xl px-3 py-2 text-sm text-rose-900 mt-1 mb-3 focus:outline-none focus:ring-2 focus:ring-rose-200"
        >
          {ITEM_TYPES.map((it) => <option key={it.v} value={it.v}>{it.label}</option>)}
        </select>

        <label className="text-xs text-rose-400" htmlFor="ps-area">區域</label>
        <Field id="ps-area" value={draft.area} onChange={(e) => set({ area: e.target.value })}
          placeholder="城市／區域，例：福岡 中洲川端" className="mt-1" />
        {/* nameJa is read-only in the MVP: without the map it has no immediate
            value to the user, and its real payoff is geocode hit rate in Phase
            1.5 (DDR-15b). */}
        {place.nameJa && <p className="text-[11px] text-rose-300 mt-1">日文名：{place.nameJa}</p>}

        <label className="text-xs text-rose-400 block mt-3" htmlFor="ps-note">備註</label>
        <textarea
          id="ps-note"
          rows={3}
          value={draft.note}
          onChange={(e) => set({ note: e.target.value })}
          className="w-full bg-pink-50 border border-pink-100 rounded-xl px-3 py-2 text-sm text-rose-900 placeholder-rose-300 mt-1 mb-3 focus:outline-none focus:ring-2 focus:ring-rose-200"
        />

        <div className="flex gap-2 mb-2">
          <button
            onClick={() => openMap(`${draft.name} ${draft.area}`.trim())}
            className="flex-1 border border-pink-200 text-sky-500 rounded-xl py-2 text-sm flex items-center justify-center gap-1"
          >
            <MapIcon size={15} /> 在地圖搜尋
          </button>
          <button
            onClick={() => onAddToTrip(place)}
            className="flex-1 border border-pink-200 text-rose-400 rounded-xl py-2 text-sm flex items-center justify-center gap-1"
          >
            <Plus size={15} /> 加入行程
          </button>
        </div>
        {/* Say plainly that the two lists do not talk to each other. Leaving it
            vague makes the user read a limitation as a bug (DDR-19). */}
        <p className="text-[11px] text-rose-300 leading-relaxed mb-4">
          在 Google 地圖上按它自己的「儲存」，可以放進<b>你自己的</b> Google 清單。櫻旅讀不到那份清單，兩邊不會互通。
        </p>

        {dirty && !saved && <div className="text-[11px] text-amber-600 mb-1">有未儲存的變更</div>}
        <button
          onClick={save}
          className="w-full bg-rose-400 hover:bg-rose-500 text-white rounded-xl py-2.5 text-sm font-medium"
        >
          {saved ? "✓ 已儲存" : "儲存"}
        </button>
        <button onClick={del} className="w-full text-rose-400 text-xs mt-3 py-2">刪除這個地點</button>
      </div>
    </div>
  );
}
