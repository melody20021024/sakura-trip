import { useState } from "react";
import { Users, Settings, Copy, Plus, X, Wand2, Loader2 } from "lucide-react";
import { Card, SectionTitle, Field, PinkBtn } from "../../components/ui.jsx";
import { lookupRate } from "../../lib/api.js";

// P-05. Share link, trip settings (name / budget / rate + live lookup), travelers.
export function SettingView({ trip }) {
  const { data } = trip;
  const travelers = data.travelers.v || [];
  const [name, setName] = useState(data.tripName.v);
  const [newT, setNewT] = useState("");
  const [copied, setCopied] = useState(false);
  const [rateMsg, setRateMsg] = useState("");
  const [rateLoading, setRateLoading] = useState(false);

  const addT = () => {
    const n = newT.trim();
    if (!n || travelers.includes(n)) return;
    trip.setTravelers([...travelers, n]);
    setNewT("");
  };
  const delT = (n) => {
    if (travelers.length <= 1) return;
    trip.setTravelers(travelers.filter((t) => t !== n));
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  const fetchRate = async () => {
    setRateMsg(""); setRateLoading(true);
    try {
      const o = await lookupRate("JPY", "TWD");
      if (o.error || typeof o.rate !== "number") { setRateMsg("查詢失敗,請手動填入"); }
      else { trip.setField("rate", Number(o.rate.toFixed(4))); setRateMsg(`已套用 ${o.rate.toFixed(4)}`); }
    } catch { setRateMsg("查詢失敗,請手動填入"); }
    setRateLoading(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon={Users}>分享連結</SectionTitle>
        <p className="text-xs text-rose-400 mb-2">把這個網址傳給旅伴,他們打開就能看到並一起編輯這份行程。</p>
        <div className="flex gap-2">
          <input readOnly value={typeof window !== "undefined" ? window.location.href : ""} className="flex-1 bg-pink-50 border border-pink-100 rounded-xl px-3 py-2 text-xs text-rose-700" />
          <PinkBtn onClick={copyLink} className="shrink-0 flex items-center gap-1"><Copy size={14} /> {copied ? "已複製" : "複製"}</PinkBtn>
        </div>
        {!trip.lsAvailable && <p className="text-[11px] text-amber-600 mt-2">此瀏覽器無法記住行程,重開時可能需要重新貼上連結。</p>}
      </Card>

      <Card>
        <SectionTitle icon={Settings}>旅程設定</SectionTitle>
        <label className="text-xs text-rose-400">旅程名稱</label>
        <div className="flex gap-2 mt-1">
          <Field value={name} onChange={(e) => setName(e.target.value)} />
          <PinkBtn onClick={() => trip.setField("tripName", name)} className="shrink-0">儲存</PinkBtn>
        </div>

        <label className="text-xs text-rose-400 block mt-4">總預算 (日幣,0 = 不設)</label>
        <Field type="number" value={data.budgetJPY?.v ?? 0} onChange={(e) => trip.setField("budgetJPY", parseFloat(e.target.value) || 0)}
          onFocus={() => trip.focusField("budgetJPY")} onBlur={trip.blurField} className="mt-1" />

        <label className="text-xs text-rose-400 block mt-4">匯率 (1 ¥ = ? NT$)</label>
        <div className="flex gap-2 mt-1">
          <Field type="number" step="0.001" value={data.rate.v} onChange={(e) => trip.setField("rate", parseFloat(e.target.value) || 0)}
            onFocus={() => trip.focusField("rate")} onBlur={trip.blurField} />
          <button onClick={fetchRate} disabled={rateLoading} className="shrink-0 bg-purple-400 hover:bg-purple-500 text-white rounded-xl px-3 py-2 text-sm font-medium flex items-center gap-1">
            {rateLoading ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} 查即時匯率
          </button>
        </div>
        {rateMsg && <p className="text-[11px] text-rose-400 mt-1">{rateMsg}</p>}
      </Card>

      <Card>
        <SectionTitle icon={Users}>旅伴</SectionTitle>
        <div className="flex gap-2 mb-3">
          <Field placeholder="新增旅伴名字" value={newT} onChange={(e) => setNewT(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addT()} />
          <PinkBtn onClick={addT} className="shrink-0"><Plus size={16} /></PinkBtn>
        </div>
        <div className="flex flex-wrap gap-2">
          {travelers.map((t) => (
            <span key={t} className="flex items-center gap-1 bg-pink-100 text-rose-600 rounded-full px-3 py-1 text-sm">
              {t}{travelers.length > 1 && <button onClick={() => delT(t)} aria-label={`移除 ${t}`} className="text-rose-400 hover:text-rose-600"><X size={13} /></button>}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
