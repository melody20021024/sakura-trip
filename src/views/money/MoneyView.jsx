import { useState } from "react";
import { Plus, Wallet, ArrowRight, Trash2 } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui.jsx";
import { money } from "../../lib/schema.js";
import { liveItems } from "../../lib/merge.js";
import { computeMoney } from "../../lib/settle.js";
import { catOf } from "./constants.js";
import { BudgetBar } from "./BudgetBar.jsx";
import { CategoryStats } from "./CategoryStats.jsx";
import { ExpenseForm } from "./ExpenseForm.jsx";

// P-02. Totals + budget + categories + settlement + detail.
export function MoneyView({ trip, confirm }) {
  const travelers = trip.data.travelers;
  const rate = trip.data.rate.v || 0.21;
  const budgetJPY = trip.data.budgetJPY?.v || 0;
  const expenses = liveItems(trip.data.expenses);

  const [open, setOpen] = useState(false);
  const blank = { desc: "", amount: "", currency: "JPY", paidBy: travelers[0] || "", category: "other", split: [...travelers] };
  const [e, setE] = useState(blank);

  const { totalJPY, totalTWD, spentJPY, settlements, byCategory } = computeMoney(expenses, travelers, rate);

  const add = () => {
    const amt = parseFloat(e.amount);
    if (!e.desc || !amt || e.split.length === 0) return;
    trip.addExpense({ desc: e.desc, amount: amt, currency: e.currency, paidBy: e.paidBy, category: e.category, split: e.split, date: new Date().toISOString().slice(0, 10) });
    setE({ ...blank, currency: e.currency, paidBy: travelers[0] || "" });
    setOpen(false);
  };
  const del = async (x) => { if (await confirm(`確定刪除「${x.desc}」?`)) trip.deleteExpense(x.id); };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between">
          <div className="grid grid-cols-2 gap-3 flex-1">
            <div><div className="text-xs text-rose-400">日幣花費</div><div className="text-xl font-bold text-rose-500">{money(totalJPY, "JPY")}</div></div>
            <div><div className="text-xs text-rose-400">台幣花費</div><div className="text-xl font-bold text-rose-500">{money(totalTWD, "TWD")}</div></div>
          </div>
          <button onClick={() => setOpen((s) => !s)} aria-label="記一筆" className="bg-rose-400 text-white rounded-full w-11 h-11 flex items-center justify-center shrink-0 ml-2"><Plus size={22} /></button>
        </div>
        <BudgetBar spentJPY={spentJPY} budgetJPY={budgetJPY} />
        {open && <ExpenseForm travelers={travelers} value={e} onChange={setE} onSubmit={add} />}
      </Card>

      <CategoryStats byCategory={byCategory} />

      {settlements.length > 0 && (
        <Card>
          <SectionTitle icon={ArrowRight}>結算(換算日幣)</SectionTitle>
          <div className="space-y-2">
            {settlements.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm bg-pink-50 rounded-xl p-2.5">
                <span className="font-medium text-rose-600">{s.from}</span><ArrowRight size={14} className="text-rose-300" /><span className="font-medium text-rose-600">{s.to}</span>
                <span className="ml-auto font-bold text-rose-500">{money(s.amt, "JPY")}</span>
                <span className="text-xs text-rose-300">≈{money(s.amt * rate, "TWD")}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle icon={Wallet}>明細</SectionTitle>
        {expenses.length === 0 && <p className="text-sm text-rose-300">還沒有花費紀錄</p>}
        <div className="space-y-2">
          {[...expenses].reverse().map((x) => {
            const c = catOf(x.category);
            return (
              <div key={x.id} className="flex items-center gap-3 bg-pink-50 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    {x.desc}
                    <span className={`text-[10px] rounded px-1 ${c.chip}`}>{c.label}</span>
                  </div>
                  <div className="text-xs text-rose-400">{x.paidBy} 付 · 分 {x.split.length} 人 · {x.date}</div>
                </div>
                <div className="text-sm font-bold text-rose-500">{money(x.amount, x.currency)}</div>
                <button onClick={() => del(x)} aria-label="刪除" className="text-rose-200 hover:text-rose-500"><Trash2 size={16} /></button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
