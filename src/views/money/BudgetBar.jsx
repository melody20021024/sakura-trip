import { money } from "../../lib/schema.js";

// C-13: spent-vs-budget progress (F-23). Hidden when no budget is set (DDR-03).
export function BudgetBar({ spentJPY, budgetJPY }) {
  if (!budgetJPY || budgetJPY <= 0) return null;
  const pct = (spentJPY / budgetJPY) * 100;
  const over = spentJPY > budgetJPY;
  const color = over ? "bg-rose-500" : pct >= 80 ? "bg-amber-400" : "bg-emerald-400";
  const note = over ? `超支 ${money(spentJPY - budgetJPY, "JPY")}` : pct >= 80 ? "已用 80% 以上,注意控管" : "";
  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-rose-400">已花 {money(spentJPY, "JPY")} / 預算 {money(budgetJPY, "JPY")}</span>
        <span className={over ? "text-rose-500 font-medium" : "text-rose-400 font-medium"}>{Math.round(pct)}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-pink-100 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {note && <p className={`text-[11px] mt-1 ${over ? "text-rose-500" : "text-amber-600"}`}>{note}</p>}
    </div>
  );
}
