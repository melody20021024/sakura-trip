import { useState } from "react";
import { Plane, Plus, Trash2, ArrowRight, Wand2, Loader2, Pencil } from "lucide-react";
import { Card, SectionTitle, Field, PinkBtn } from "../../components/ui.jsx";
import { liveItems } from "../../lib/merge.js";
import { lookupFlight } from "../../lib/api.js";

const blank = { label: "去程", flightNo: "", date: "", from: "", to: "", dep: "", arr: "" };

// C-06: flight list + AI time lookup (F-13).
export function FlightCard({ trip, confirm }) {
  const flights = liveItems(trip.data.flights);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [editId, setEditId] = useState(null);

  const lookup = async () => {
    if (!f.flightNo || !f.date) { setErr("請先填航班編號與日期"); return; }
    setErr(""); setLoading(true);
    try {
      const o = await lookupFlight(f.flightNo, f.date);
      if (o.error) { setErr("查詢功能未啟用或查無資料,請手動填入"); setLoading(false); return; }
      setF((p) => ({
        ...p,
        from: o.from || p.from, to: o.to || p.to,
        dep: o.depTime ? `${f.date}T${o.depTime}` : p.dep,
        arr: o.arrTime ? `${f.date}T${o.arrTime}` : p.arr,
      }));
      if (!o.depTime && !o.from) setErr("查不到此航班,請手動填入");
    } catch { setErr("查詢失敗,請手動填入"); }
    setLoading(false);
  };

  const save = () => {
    if (!f.from || !f.to) return;
    if (editId) {
      trip.updateFlight(editId, { label: f.label, flightNo: f.flightNo, from: f.from, to: f.to, dep: f.dep, arr: f.arr });
    } else {
      trip.addFlight({ label: f.label, flightNo: f.flightNo, from: f.from, to: f.to, dep: f.dep, arr: f.arr, est: !!(f.dep && f.flightNo) });
    }
    setF(blank); setEditId(null); setOpen(false);
  };
  const del = async (fl) => { if (await confirm(`確定刪除航班 ${fl.from} → ${fl.to}?`)) trip.deleteFlight(fl.id); };
  const startEdit = (fl) => {
    setEditId(fl.id);
    setF({ label: fl.label, flightNo: fl.flightNo || "", date: (fl.dep || "").slice(0, 10), from: fl.from, to: fl.to, dep: fl.dep || "", arr: fl.arr || "" });
    setOpen(true);
  };
  const toggleAdd = () => { setEditId(null); setF(blank); setOpen((s) => !s); };

  return (
    <Card>
      <SectionTitle icon={Plane} right={<button onClick={toggleAdd} aria-label="新增航班" className="text-rose-400"><Plus size={18} /></button>}>航班</SectionTitle>
      {flights.length === 0 && !open && <p className="text-sm text-rose-300">尚未加入航班</p>}
      <div className="space-y-2">
        {flights.map((fl) => (
          <div key={fl.id} className="flex items-center gap-3 bg-pink-50 rounded-xl p-3">
            <span className="text-xs bg-rose-200 text-rose-700 rounded-full px-2 py-0.5 shrink-0">{fl.label}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium flex items-center gap-1 flex-wrap">
                {fl.from} <ArrowRight size={13} className="text-rose-300" /> {fl.to}
                {fl.flightNo && <span className="text-xs text-rose-400">{fl.flightNo}</span>}
                {fl.est && <span className="text-[10px] bg-amber-100 text-amber-600 rounded px-1">估·待確認</span>}
              </div>
              <div className="text-xs text-rose-400">{fl.dep && `起飛 ${fl.dep.replace("T", " ")}`} {fl.arr && `· 抵達 ${fl.arr.replace("T", " ")}`}</div>
            </div>
            <button onClick={() => startEdit(fl)} aria-label="編輯" className="text-rose-300 hover:text-rose-500 shrink-0"><Pencil size={15} /></button>
            <button onClick={() => del(fl)} aria-label="刪除" className="text-rose-300 hover:text-rose-500 shrink-0"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      {open && (
        <div className="mt-3 space-y-2 bg-pink-50/70 rounded-xl p-3">
          <div className="grid grid-cols-2 gap-2">
            <select value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} className="bg-white border border-pink-100 rounded-xl px-3 py-2 text-sm">
              <option>去程</option><option>回程</option><option>國內線</option><option>轉機</option>
            </select>
            <Field placeholder="航班編號 例 NH813" value={f.flightNo} onChange={(e) => setF({ ...f, flightNo: e.target.value })} />
          </div>
          <div className="flex gap-2 items-end">
            <label className="text-xs text-rose-400 flex-1">日期<Field type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
            <button onClick={lookup} disabled={loading} className="shrink-0 bg-purple-400 hover:bg-purple-500 text-white rounded-xl px-3 py-2 text-sm font-medium flex items-center gap-1">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} AI 查詢時間
            </button>
          </div>
          {err && <p className="text-xs text-amber-600">{err}</p>}
          <p className="text-[11px] text-rose-300">AI 查詢為估算,起降時刻請務必向航空公司核對。</p>
          <div className="grid grid-cols-2 gap-2">
            <Field placeholder="出發 TPE" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
            <Field placeholder="抵達 NRT" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-rose-400">起飛<Field type="datetime-local" value={f.dep} onChange={(e) => setF({ ...f, dep: e.target.value })} /></label>
            <label className="text-xs text-rose-400">抵達<Field type="datetime-local" value={f.arr} onChange={(e) => setF({ ...f, arr: e.target.value })} /></label>
          </div>
          <div className="flex gap-2">
            <PinkBtn onClick={save} className="flex-1">{editId ? "儲存航班" : "加入航班"}</PinkBtn>
            {editId && <button onClick={() => { setEditId(null); setOpen(false); setF(blank); }} className="px-4 py-2 text-sm text-rose-400 rounded-xl border border-pink-200">取消</button>}
          </div>
        </div>
      )}
    </Card>
  );
}
