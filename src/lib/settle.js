// Pure money math, extracted from v1 so it can be unit-tested (F-21/F-62).
// All amounts settle in JPY; TWD is converted at `rate` (1 JPY = rate TWD).
import { CATEGORY_KEYS } from "./schema.js";

export const toJPY = (x, rate) => (x.currency === "TWD" ? x.amount / rate : x.amount);

export function computeMoney(expenses, travelers, rate) {
  const r = rate || 0.21;

  const totalJPY = expenses.filter((x) => x.currency === "JPY").reduce((s, x) => s + x.amount, 0);
  const totalTWD = expenses.filter((x) => x.currency === "TWD").reduce((s, x) => s + x.amount, 0);
  const spentJPY = expenses.reduce((s, x) => s + toJPY(x, r), 0);

  // balances: + = others owe this person, - = this person owes
  const bal = {};
  travelers.forEach((t) => (bal[t] = 0));
  expenses.forEach((x) => {
    const j = toJPY(x, r);
    if (bal[x.paidBy] !== undefined) bal[x.paidBy] += j;
    const members = x.split && x.split.length ? x.split : travelers;
    const share = j / members.length;
    members.forEach((n) => { if (bal[n] !== undefined) bal[n] -= share; });
  });

  // minimal transfers: greedily match biggest creditor with biggest debtor
  const creditors = Object.entries(bal).filter(([, v]) => v > 1).map(([n, v]) => ({ n, v }));
  const debtors = Object.entries(bal).filter(([, v]) => v < -1).map(([n, v]) => ({ n, v: -v }));
  const settlements = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const pay = Math.min(creditors[ci].v, debtors[di].v);
    settlements.push({ from: debtors[di].n, to: creditors[ci].n, amt: pay });
    creditors[ci].v -= pay; debtors[di].v -= pay;
    if (creditors[ci].v < 1) ci++;
    if (debtors[di].v < 1) di++;
  }

  // category breakdown in JPY
  const catJPY = {};
  CATEGORY_KEYS.forEach((c) => (catJPY[c] = 0));
  expenses.forEach((x) => {
    const c = catJPY[x.category] !== undefined ? x.category : "other";
    catJPY[c] += toJPY(x, r);
  });
  const byCategory = CATEGORY_KEYS
    .map((category) => ({ category, jpy: catJPY[category], pct: spentJPY > 0 ? (catJPY[category] / spentJPY) * 100 : 0 }))
    .filter((c) => c.jpy > 0)
    .sort((a, b) => b.jpy - a.jpy);

  return { totalJPY, totalTWD, spentJPY, balances: bal, settlements, byCategory };
}
