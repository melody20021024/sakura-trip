import { Check } from "lucide-react";
import { Field, PinkBtn } from "../../components/ui.jsx";
import { SYM } from "../../lib/schema.js";
import { CATEGORIES } from "./constants.js";

// C-10: add-expense form with category pills (F-22).
export function ExpenseForm({ travelers, value, onChange, onSubmit }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const toggleSplit = (n) =>
    set({ split: value.split.includes(n) ? value.split.filter((x) => x !== n) : [...value.split, n] });

  return (
    <div className="mt-3 space-y-2 bg-pink-50 rounded-xl p-3">
      <Field placeholder="花費項目,例:機票 / 晚餐 燒肉" value={value.desc} onChange={(e) => set({ desc: e.target.value })} />
      <div className="flex gap-2">
        <div className="flex rounded-xl overflow-hidden border border-pink-200 shrink-0">
          {["JPY", "TWD"].map((c) => (
            <button key={c} onClick={() => set({ currency: c })}
              className={`px-3 py-2 text-sm ${value.currency === c ? "bg-rose-400 text-white" : "bg-white text-rose-400"}`}>{SYM[c]}</button>
          ))}
        </div>
        <Field type="number" placeholder="金額" value={value.amount} onChange={(e) => set({ amount: e.target.value })} />
        <select value={value.paidBy} onChange={(e) => set({ paidBy: e.target.value })}
          className="bg-white border border-pink-100 rounded-xl px-2 py-2 text-sm shrink-0">
          {travelers.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <div className="text-xs text-rose-400 mb-1">分類:</div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const on = value.category === c.v;
            const Ico = c.icon;
            return (
              <button key={c.v} onClick={() => set({ category: c.v })}
                className={`text-xs rounded-full px-3 py-1.5 flex items-center gap-1 ${on ? "bg-rose-500 text-white" : "bg-white text-rose-300 border border-dashed border-rose-200"}`}>
                <Ico size={12} /> {c.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div className="text-xs text-rose-400 mb-1">分攤的人(深色=已選):</div>
        <div className="flex flex-wrap gap-1.5">
          {travelers.map((t) => {
            const on = value.split.includes(t);
            return (
              <button key={t} onClick={() => toggleSplit(t)}
                className={`text-xs rounded-full px-3 py-1.5 flex items-center gap-1 transition-colors ${on ? "bg-rose-500 text-white shadow-sm" : "bg-white text-rose-300 border border-dashed border-rose-200"}`}>
                {on && <Check size={12} />} {t}
              </button>
            );
          })}
        </div>
      </div>
      <PinkBtn onClick={onSubmit} className="w-full">記一筆</PinkBtn>
    </div>
  );
}
