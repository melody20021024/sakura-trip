import { Calendar } from "lucide-react";
import { Card, SectionTitle, Field, PinkBtn } from "../../components/ui.jsx";
import { liveItems } from "../../lib/merge.js";
import { uid, now, scalar } from "../../lib/schema.js";
import { FlightCard } from "./FlightCard.jsx";
import { DayCard } from "./DayCard.jsx";

// P-01. Date range -> generate day cards, flights, then the day list.
export function TripView({ trip, confirm }) {
  const startDate = trip.data.startDate.v;
  const endDate = trip.data.endDate.v;
  const days = liveItems(trip.data.days).sort((a, b) => a.date.localeCompare(b.date));

  const generateDays = () => {
    if (!startDate || !endDate) return;
    const s = new Date(startDate + "T00:00"), e = new Date(endDate + "T00:00");
    if (e < s) return;
    const have = new Set(days.map((d) => d.date));
    const next = [];
    for (let t = s.getTime(); t <= e.getTime(); t += 86400000) {
      const ds = new Date(t).toISOString().slice(0, 10);
      if (!have.has(ds)) next.push({ id: uid(), date: ds, city: scalar("", now()), lodging: scalar("", now()), items: [], updatedAt: now() });
    }
    if (next.length) trip.addDays(next);
  };

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon={Calendar}>旅程日期</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-rose-400">出發<Field type="date" value={startDate} onChange={(e) => trip.setField("startDate", e.target.value)} /></label>
          <label className="text-xs text-rose-400">回程<Field type="date" value={endDate} onChange={(e) => trip.setField("endDate", e.target.value)} /></label>
        </div>
        <PinkBtn onClick={generateDays} className="w-full mt-3">產生 / 補齊每日卡片</PinkBtn>
        {days.length > 0 && <p className="text-xs text-rose-300 mt-2 text-center">共 {days.length} 天</p>}
      </Card>

      <FlightCard trip={trip} confirm={confirm} />

      {days.map((d, idx) => (
        <DayCard key={d.id} day={d} idx={idx} trip={trip} confirm={confirm} />
      ))}
      {days.length === 0 && <p className="text-sm text-rose-300 text-center">設定日期後按上方按鈕產生每日行程</p>}
    </div>
  );
}
