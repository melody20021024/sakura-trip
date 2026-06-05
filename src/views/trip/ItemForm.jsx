import { Field, PinkBtn } from "../../components/ui.jsx";
import { ITEM_TYPES } from "./constants.js";

// Add/edit form for a single itinerary item (presentational).
export function ItemForm({ value, onChange, onSave, onCancel, saveLabel = "加入行程" }) {
  return (
    <div className="space-y-2 bg-white rounded-xl p-3 border border-pink-100">
      <div className="flex gap-2">
        <Field type="time" value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })} className="w-28" />
        <select
          value={value.type}
          onChange={(e) => onChange({ ...value, type: e.target.value })}
          className="flex-1 bg-pink-50 border border-pink-100 rounded-xl px-3 py-2 text-sm"
        >
          {ITEM_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
        </select>
      </div>
      <Field placeholder="名稱,例:淺草寺 / 一蘭拉麵" value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} />
      <Field placeholder="備註 (選填)" value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} />
      <div className="flex gap-2">
        <PinkBtn onClick={onSave} className="flex-1">{saveLabel}</PinkBtn>
        {onCancel && <button onClick={onCancel} className="px-4 py-2 text-sm text-rose-400 rounded-xl border border-pink-200">取消</button>}
      </div>
    </div>
  );
}
