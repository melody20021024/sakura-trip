import { Wallet } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui.jsx";
import { money } from "../../lib/schema.js";
import { catOf } from "./constants.js";

// C-14: per-category spend bars in JPY (F-24). Pure CSS, no chart lib (DDR-07).
export function CategoryStats({ byCategory }) {
  if (!byCategory.length) return null;
  return (
    <Card>
      <SectionTitle icon={Wallet}>分類統計(換算日幣)</SectionTitle>
      <div className="space-y-2.5 text-xs">
        {byCategory.map((c) => {
          const meta = catOf(c.category);
          const Ico = meta.icon;
          return (
            <div key={c.category}>
              <div className="flex justify-between mb-0.5">
                <span className="flex items-center gap-1"><Ico size={13} /> {meta.label}</span>
                <span className="text-rose-400">{money(c.jpy, "JPY")}・{Math.round(c.pct)}%</span>
              </div>
              <div className="h-2 rounded bg-pink-100">
                <div className={`h-full rounded ${meta.bar}`} style={{ width: `${c.pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
