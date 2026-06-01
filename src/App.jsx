import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase";
import { Plane, Calendar, Wallet, ListChecks, Image as ImageIcon, Settings, Plus, Trash2, Check, X, MapPin, Utensils, ShoppingBag, ExternalLink, Users, ArrowRight, Train, BedDouble, Sparkles, Map as MapIcon, Wand2, Loader2, Pencil, Copy } from "lucide-react";

const uid = () => Math.random().toString(36).slice(2, 9);

function getTripKey() {
  const url = new URL(window.location.href);
  let k = url.searchParams.get("trip");
  if (!k) {
    k = Math.random().toString(36).slice(2, 10);
    url.searchParams.set("trip", k);
    window.history.replaceState({}, "", url);
  }
  return k;
}

const SAMPLE_DAYS = [
  { id: uid(), date: "2026-06-10", city: "大分・由布院", lodging: "由布院 溫泉旅館", items: [
    { id: uid(), time: "", title: "抵達大分機場", type: "move", note: "去程航班抵達" },
    { id: uid(), time: "", title: "機場巴士 大分機場 → 由布院", type: "move", note: "" },
    { id: uid(), time: "", title: "金鱗湖・湯之坪街道散策", type: "spot", note: "" },
  ]},
  { id: uid(), date: "2026-06-11", city: "由布院 → 福岡", lodging: "福岡 博多", items: [
    { id: uid(), time: "", title: "由布院之森 → 博多", type: "move", note: "觀光列車,建議先劃位" },
    { id: uid(), time: "", title: "天神・博多逛街", type: "spot", note: "" },
  ]},
  { id: uid(), date: "2026-06-12", city: "福岡", lodging: "福岡 博多", items: [
    { id: uid(), time: "", title: "柳川遊船(川下り)", type: "spot", note: "西鐵福岡 → 柳川" },
    { id: uid(), time: "", title: "太宰府天滿宮", type: "spot", note: "" },
    { id: uid(), time: "", title: "屋台晚餐", type: "food", note: "" },
  ]},
  { id: uid(), date: "2026-06-13", city: "福岡 → 沖繩", lodging: "那霸 國際通", items: [
    { id: uid(), time: "", title: "國內線航班 福岡 → 那霸", type: "move", note: "" },
    { id: uid(), time: "", title: "國際通逛街・晚餐", type: "shop", note: "" },
  ]},
  { id: uid(), date: "2026-06-14", city: "沖繩(自駕)", lodging: "沖繩 自駕住宿", items: [
    { id: uid(), time: "", title: "取租車・開始自駕", type: "move", note: "換住宿" },
    { id: uid(), time: "", title: "前往中北部", type: "spot", note: "" },
  ]},
  { id: uid(), date: "2026-06-15", city: "沖繩(自駕)", lodging: "沖繩 自駕住宿", items: [
    { id: uid(), time: "", title: "美麗海水族館等景點", type: "spot", note: "" },
  ]},
  { id: uid(), date: "2026-06-16", city: "沖繩 → 回國", lodging: "", items: [
    { id: uid(), time: "", title: "還車", type: "move", note: "" },
    { id: uid(), time: "", title: "那霸機場 航班回國", type: "move", note: "" },
  ]},
];
const SAMPLE_FLIGHTS = [
  { id: uid(), label: "去程", flightNo: "", from: "TPE", to: "OIT", dep: "2026-06-10T00:00", arr: "", est: false },
  { id: uid(), label: "國內線", flightNo: "", from: "FUK", to: "OKA", dep: "2026-06-13T00:00", arr: "", est: false },
  { id: uid(), label: "回程", flightNo: "", from: "OKA", to: "TPE", dep: "2026-06-16T00:00", arr: "", est: false },
];
const SAMPLE_FOOD = [
  { id: uid(), name: "一蘭拉麵 福岡總本店", meta: "福岡 中洲川端", done: false },
  { id: uid(), name: "柳川 蒸籠鰻魚飯", meta: "柳川", done: false },
  { id: uid(), name: "沖繩牛排館", meta: "那霸 國際通", done: false },
];

const DEFAULT = {
  tripName: "九州・沖繩之旅 🌸",
  startDate: "2026-06-10",
  endDate: "2026-06-16",
  travelers: ["我"],
  rate: 0.21,
  flights: SAMPLE_FLIGHTS,
  days: SAMPLE_DAYS,
  expenses: [],
  food: SAMPLE_FOOD,
  shopping: [],
  albums: [],
};

const SYM = { JPY: "¥", TWD: "NT$" };
const money = (n, c = "JPY") => (SYM[c] || "") + Math.round(Number(n || 0)).toLocaleString();
const openMap = (q) => window.open("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q), "_blank");

export default function App() {
  const tripKey = useMemo(getTripKey, []);
  const clientId = useMemo(() => Math.random().toString(36).slice(2), []);
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("trip");

  useEffect(() => {
    (async () => {
      try {
        const { data: row } = await supabase.from("trips").select("data").eq("id", tripKey).maybeSingle();
        setData(row && row.data && Object.keys(row.data).length ? { ...DEFAULT, ...row.data } : DEFAULT);
      } catch { setData(DEFAULT); }
      setLoaded(true);
    })();
  }, [tripKey]);

  useEffect(() => {
    if (!loaded || !data) return;
    const t = setTimeout(async () => {
      try {
        await supabase.from("trips").upsert({ id: tripKey, data, writer: clientId, updated_at: new Date().toISOString() });
      } catch (e) { console.error("save failed", e); }
    }, 600);
    return () => clearTimeout(t);
  }, [data, loaded, tripKey, clientId]);

  useEffect(() => {
    const ch = supabase
      .channel("trip-" + tripKey)
      .on("postgres_changes", { event: "*", schema: "public", table: "trips", filter: "id=eq." + tripKey }, (payload) => {
        const row = payload.new;
        if (row && row.writer !== clientId && row.data) setData({ ...DEFAULT, ...row.data });
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [tripKey, clientId]);

  if (!data) return <div className="min-h-screen flex items-center justify-center bg-pink-50"><div className="text-rose-400 animate-pulse">🌸 載入中…</div></div>;

  const set = (patch) => setData((d) => ({ ...d, ...patch }));
  const tabs = [
    { id: "trip", label: "行程", icon: Calendar },
    { id: "money", label: "帳本", icon: Wallet },
    { id: "lists", label: "清單", icon: ListChecks },
    { id: "album", label: "相簿", icon: ImageIcon },
    { id: "setting", label: "設定", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-rose-50 to-pink-100 text-rose-900 pb-24">
      <header className="sticky top-0 z-20 bg-white/70 backdrop-blur border-b border-pink-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <span className="text-2xl">🌸</span>
          <h1 className="text-lg font-bold text-rose-500 truncate flex-1">{data.tripName}</h1>
          <span className="text-xs text-rose-300 flex items-center gap-1"><Users size={13} /> {data.travelers.length}</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-4">
        {tab === "trip" && <TripView data={data} set={set} />}
        {tab === "money" && <MoneyView data={data} set={set} />}
        {tab === "lists" && <ListsView data={data} set={set} />}
        {tab === "album" && <AlbumView data={data} set={set} />}
        {tab === "setting" && <SettingView data={data} set={set} />}
      </main>
      <nav className="fixed bottom-0 inset-x-0 z-20 bg-white/90 backdrop-blur border-t border-pink-100">
        <div className="max-w-2xl mx-auto grid grid-cols-5">
          {tabs.map((t) => {
            const Ico = t.icon; const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center gap-0.5 py-2.5 ${active ? "text-rose-500" : "text-rose-300"}`}>
                <Ico size={20} /><span className="text-[11px]">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`bg-white/80 rounded-2xl border border-pink-100 shadow-sm p-4 ${className}`}>{children}</div>;
}
function SectionTitle({ icon: Icon, children, right }) {
  return <div className="flex items-center gap-2 mb-3">{Icon && <Icon size={18} className="text-rose-400" />}<h2 className="font-bold text-rose-500 flex-1">{children}</h2>{right}</div>;
}
function PinkBtn({ children, onClick, className = "" }) {
  return <button onClick={onClick} className={`bg-rose-400 hover:bg-rose-500 text-white rounded-xl px-4 py-2 text-sm font-medium ${className}`}>{children}</button>;
}
function Field(props) {
  return <input {...props} className={`w-full bg-pink-50 border border-pink-100 rounded-xl px-3 py-2 text-sm text-rose-900 placeholder-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200 ${props.className || ""}`} />;
}

const ITEM_TYPES = [
  { v: "spot", label: "景點", icon: MapPin, c: "bg-purple-100 text-purple-600" },
  { v: "food", label: "美食", icon: Utensils, c: "bg-amber-100 text-amber-600" },
  { v: "shop", label: "購物", icon: ShoppingBag, c: "bg-pink-100 text-pink-600" },
  { v: "move", label: "交通", icon: Train, c: "bg-sky-100 text-sky-600" },
  { v: "stay", label: "住宿", icon: BedDouble, c: "bg-rose-100 text-rose-600" },
  { v: "other", label: "其他", icon: Sparkles, c: "bg-gray-100 text-gray-500" },
];

function TripView({ data, set }) {
  const generateDays = () => {
    if (!data.startDate || !data.endDate) return;
    const s = new Date(data.startDate + "T00:00"), e = new Date(data.endDate + "T00:00");
    if (e < s) return;
    const have = new Set(data.days.map((d) => d.date));
    const next = [...data.days];
    for (let t = s.getTime(); t <= e.getTime(); t += 86400000) {
      const ds = new Date(t).toISOString().slice(0, 10);
      if (!have.has(ds)) next.push({ id: uid(), date: ds, city: "", lodging: "", items: [] });
    }
    set({ days: next });
  };
  const sortedDays = [...data.days].sort((a, b) => a.date.localeCompare(b.date));
  const updateDay = (id, patch) => set({ days: data.days.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const delDay = (id) => set({ days: data.days.filter((d) => d.id !== id) });
  const addItem = (dayId, item) => updateDay(dayId, { items: [...data.days.find((d) => d.id === dayId).items, { ...item, id: uid() }] });
  const delItem = (dayId, itemId) => updateDay(dayId, { items: data.days.find((d) => d.id === dayId).items.filter((i) => i.id !== itemId) });
  const editItem = (dayId, itemId, patch) => updateDay(dayId, { items: data.days.find((d) => d.id === dayId).items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) });

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon={Calendar}>旅程日期</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-rose-400">出發<Field type="date" value={data.startDate} onChange={(e) => set({ startDate: e.target.value })} /></label>
          <label className="text-xs text-rose-400">回程<Field type="date" value={data.endDate} onChange={(e) => set({ endDate: e.target.value })} /></label>
        </div>
        <PinkBtn onClick={generateDays} className="w-full mt-3">產生 / 補齊每日卡片</PinkBtn>
        {sortedDays.length > 0 && <p className="text-xs text-rose-300 mt-2 text-center">共 {sortedDays.length} 天</p>}
      </Card>

      <FlightCard data={data} set={set} />

      {sortedDays.map((d, idx) => (
        <DayCard key={d.id} day={d} idx={idx} onUpdate={updateDay} onAdd={addItem} onDelItem={delItem} onEditItem={editItem} onDelDay={delDay} />
      ))}
      {sortedDays.length === 0 && <p className="text-sm text-rose-300 text-center">設定日期後按上方按鈕產生每日行程</p>}
    </div>
  );
}

function FlightCard({ data, set }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ label: "去程", flightNo: "", date: "", from: "", to: "", dep: "", arr: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [editId, setEditId] = useState(null);

  const lookup = async () => {
    if (!f.flightNo || !f.date) { setErr("請先填航班編號與日期"); return; }
    setErr(""); setLoading(true);
    try {
      const res = await fetch(`/api/flight?no=${encodeURIComponent(f.flightNo)}&date=${f.date}`);
      const o = await res.json();
      if (o.error) { setErr("查詢功能未啟用或查無資料,請手動填入"); setLoading(false); return; }
      setF((p) => ({
        ...p,
        from: o.from || p.from, to: o.to || p.to,
        dep: o.depTime ? `${f.date}T${o.depTime}` : p.dep,
        arr: o.arrTime ? `${f.date}T${o.arrTime}` : p.arr,
      }));
      if (!o.depTime && !o.from) setErr("查不到此航班,請手動填入");
    } catch (e) { setErr("查詢失敗,請手動填入"); }
    setLoading(false);
  };

  const add = () => {
    if (!f.from || !f.to) return;
    if (editId) {
      set({ flights: data.flights.map((x) => (x.id === editId ? { ...x, label: f.label, flightNo: f.flightNo, from: f.from, to: f.to, dep: f.dep, arr: f.arr } : x)) });
    } else {
      set({ flights: [...data.flights, { id: uid(), label: f.label, flightNo: f.flightNo, from: f.from, to: f.to, dep: f.dep, arr: f.arr, est: !!(f.dep && f.flightNo) }] });
    }
    setF({ label: "回程", flightNo: "", date: "", from: "", to: "", dep: "", arr: "" });
    setEditId(null); setOpen(false);
  };
  const del = (id) => set({ flights: data.flights.filter((x) => x.id !== id) });
  const startEdit = (fl) => {
    setEditId(fl.id);
    setF({ label: fl.label, flightNo: fl.flightNo || "", date: (fl.dep || "").slice(0, 10), from: fl.from, to: fl.to, dep: fl.dep || "", arr: fl.arr || "" });
    setOpen(true);
  };

  return (
    <Card>
      <SectionTitle icon={Plane} right={<button onClick={() => { setEditId(null); setF({ label: "去程", flightNo: "", date: "", from: "", to: "", dep: "", arr: "" }); setOpen((s) => !s); }} className="text-rose-400"><Plus size={18} /></button>}>航班</SectionTitle>
      {data.flights.length === 0 && !open && <p className="text-sm text-rose-300">尚未加入航班</p>}
      <div className="space-y-2">
        {data.flights.map((fl) => (
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
            <button onClick={() => startEdit(fl)} className="text-rose-300 hover:text-rose-500 shrink-0" title="編輯"><Pencil size={15} /></button>
            <button onClick={() => del(fl.id)} className="text-rose-300 hover:text-rose-500 shrink-0"><Trash2 size={16} /></button>
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
            <PinkBtn onClick={add} className="flex-1">{editId ? "儲存航班" : "加入航班"}</PinkBtn>
            {editId && <button onClick={() => { setEditId(null); setOpen(false); setF({ label: "去程", flightNo: "", date: "", from: "", to: "", dep: "", arr: "" }); }} className="px-4 py-2 text-sm text-rose-400 rounded-xl border border-pink-200">取消</button>}
          </div>
        </div>
      )}
    </Card>
  );
}

function ItemForm({ value, onChange, onSave, onCancel, saveLabel = "加入行程" }) {
  return (
    <div className="space-y-2 bg-white rounded-xl p-3 border border-pink-100">
      <div className="flex gap-2">
        <Field type="time" value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })} className="w-28" />
        <select value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value })} className="flex-1 bg-pink-50 border border-pink-100 rounded-xl px-3 py-2 text-sm">
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

function DayCard({ day, idx, onUpdate, onAdd, onDelItem, onEditItem, onDelDay }) {
  const [open, setOpen] = useState(false);
  const [it, setIt] = useState({ time: "", title: "", type: "spot", note: "" });
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(null);
  const add = () => { if (!it.title) return; onAdd(day.id, it); setIt({ time: "", title: "", type: "spot", note: "" }); setOpen(false); };
  const startEdit = (i) => { setEditId(i.id); setDraft({ time: i.time || "", title: i.title, type: i.type, note: i.note || "" }); };
  const saveEdit = () => { if (!draft.title) return; onEditItem(day.id, editId, draft); setEditId(null); setDraft(null); };
  const items = [...day.items].sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  const dateLabel = new Date(day.date + "T00:00").toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "short" });

  return (
    <Card className="!p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="bg-rose-400 text-white text-xs rounded-full w-7 h-7 flex items-center justify-center shrink-0">D{idx + 1}</span>
        <span className="font-medium text-sm">{dateLabel}</span>
        <span className="flex-1" />
        <button onClick={() => setOpen((s) => !s)} className="text-rose-400"><Plus size={18} /></button>
        <button onClick={() => onDelDay(day.id)} className="text-rose-300 hover:text-rose-500"><Trash2 size={15} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input value={day.city} onChange={(e) => onUpdate(day.id, { city: e.target.value })} placeholder="城市/區域" className="bg-pink-50 border border-pink-100 rounded-lg px-2 py-1.5 text-xs text-rose-700 placeholder-rose-300 focus:outline-none" />
        <div className="flex items-center gap-1 bg-pink-50 border border-pink-100 rounded-lg px-2">
          <BedDouble size={13} className="text-rose-300 shrink-0" />
          <input value={day.lodging} onChange={(e) => onUpdate(day.id, { lodging: e.target.value })} placeholder="今晚住宿" className="bg-transparent py-1.5 text-xs text-rose-700 placeholder-rose-300 focus:outline-none w-full" />
        </div>
      </div>
      <div className="space-y-1.5">
        {items.map((i) => {
          if (editId === i.id) return <ItemForm key={i.id} value={draft} onChange={setDraft} onSave={saveEdit} onCancel={() => { setEditId(null); setDraft(null); }} saveLabel="儲存" />;
          const t = ITEM_TYPES.find((x) => x.v === i.type) || ITEM_TYPES[0];
          const Ico = t.icon;
          const mapable = i.type === "spot" || i.type === "food" || i.type === "shop" || i.type === "stay";
          return (
            <div key={i.id} className="flex items-start gap-2 bg-pink-50 rounded-xl p-2.5">
              <span className={`text-[11px] rounded-md px-1.5 py-0.5 flex items-center gap-1 shrink-0 ${t.c}`}><Ico size={11} /> {t.label}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{i.time && <span className="text-rose-400 mr-1">{i.time}</span>}{i.title}</div>
                {i.note && <div className="text-xs text-rose-400">{i.note}</div>}
              </div>
              {mapable && <button onClick={() => openMap(i.title + " " + (day.city || ""))} className="text-sky-400 hover:text-sky-600 shrink-0" title="地圖"><MapIcon size={15} /></button>}
              <button onClick={() => startEdit(i)} className="text-rose-300 hover:text-rose-500 shrink-0" title="編輯"><Pencil size={14} /></button>
              <button onClick={() => onDelItem(day.id, i.id)} className="text-rose-200 hover:text-rose-500 shrink-0"><X size={15} /></button>
            </div>
          );
        })}
      </div>
      {open && <div className="mt-2"><ItemForm value={it} onChange={setIt} onSave={add} onCancel={() => setOpen(false)} /></div>}
    </Card>
  );
}

function MoneyView({ data, set }) {
  const [open, setOpen] = useState(false);
  const [e, setE] = useState({ desc: "", amount: "", currency: "JPY", paidBy: data.travelers[0] || "", split: [...data.travelers] });
  const rate = data.rate || 0.21;
  const toJPY = (x) => (x.currency === "TWD" ? x.amount / rate : x.amount);

  const add = () => {
    const amt = parseFloat(e.amount);
    if (!e.desc || !amt || e.split.length === 0) return;
    set({ expenses: [...data.expenses, { ...e, amount: amt, id: uid(), date: new Date().toISOString().slice(0, 10) }] });
    setE({ desc: "", amount: "", currency: e.currency, paidBy: data.travelers[0] || "", split: [...data.travelers] });
    setOpen(false);
  };
  const del = (id) => set({ expenses: data.expenses.filter((x) => x.id !== id) });
  const toggleSplit = (n) => setE((p) => ({ ...p, split: p.split.includes(n) ? p.split.filter((x) => x !== n) : [...p.split, n] }));

  const totalJPY = data.expenses.filter((x) => x.currency === "JPY").reduce((s, x) => s + x.amount, 0);
  const totalTWD = data.expenses.filter((x) => x.currency === "TWD").reduce((s, x) => s + x.amount, 0);

  const bal = {}; data.travelers.forEach((t) => (bal[t] = 0));
  data.expenses.forEach((x) => {
    const j = toJPY(x);
    if (bal[x.paidBy] !== undefined) bal[x.paidBy] += j;
    const share = j / x.split.length;
    x.split.forEach((n) => { if (bal[n] !== undefined) bal[n] -= share; });
  });
  const cs = Object.entries(bal).filter(([, v]) => v > 1).map(([n, v]) => ({ n, v }));
  const ds = Object.entries(bal).filter(([, v]) => v < -1).map(([n, v]) => ({ n, v: -v }));
  const settle = []; let ci = 0, di = 0;
  while (ci < cs.length && di < ds.length) {
    const pay = Math.min(cs[ci].v, ds[di].v);
    settle.push({ from: ds[di].n, to: cs[ci].n, amt: pay });
    cs[ci].v -= pay; ds[di].v -= pay;
    if (cs[ci].v < 1) ci++; if (ds[di].v < 1) di++;
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between">
          <div className="grid grid-cols-2 gap-3 flex-1">
            <div><div className="text-xs text-rose-400">日幣花費</div><div className="text-xl font-bold text-rose-500">{money(totalJPY, "JPY")}</div></div>
            <div><div className="text-xs text-rose-400">台幣花費</div><div className="text-xl font-bold text-rose-500">{money(totalTWD, "TWD")}</div></div>
          </div>
          <button onClick={() => setOpen((s) => !s)} className="bg-rose-400 text-white rounded-full w-11 h-11 flex items-center justify-center shrink-0 ml-2"><Plus size={22} /></button>
        </div>
        {open && (
          <div className="mt-3 space-y-2 bg-pink-50 rounded-xl p-3">
            <Field placeholder="花費項目,例:機票 / 晚餐 燒肉" value={e.desc} onChange={(ev) => setE({ ...e, desc: ev.target.value })} />
            <div className="flex gap-2">
              <div className="flex rounded-xl overflow-hidden border border-pink-200 shrink-0">
                {["JPY", "TWD"].map((c) => (
                  <button key={c} onClick={() => setE({ ...e, currency: c })} className={`px-3 py-2 text-sm ${e.currency === c ? "bg-rose-400 text-white" : "bg-white text-rose-400"}`}>{SYM[c]}</button>
                ))}
              </div>
              <Field type="number" placeholder="金額" value={e.amount} onChange={(ev) => setE({ ...e, amount: ev.target.value })} />
              <select value={e.paidBy} onChange={(ev) => setE({ ...e, paidBy: ev.target.value })} className="bg-white border border-pink-100 rounded-xl px-2 py-2 text-sm shrink-0">
                {data.travelers.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs text-rose-400 mb-1">分攤的人(深色=已選):</div>
              <div className="flex flex-wrap gap-1.5">
                {data.travelers.map((t) => {
                  const on = e.split.includes(t);
                  return (
                    <button key={t} onClick={() => toggleSplit(t)} className={`text-xs rounded-full px-3 py-1.5 flex items-center gap-1 transition-colors ${on ? "bg-rose-500 text-white shadow-sm" : "bg-white text-rose-300 border border-dashed border-rose-200"}`}>
                      {on && <Check size={12} />} {t}
                    </button>
                  );
                })}
              </div>
            </div>
            <PinkBtn onClick={add} className="w-full">記一筆</PinkBtn>
          </div>
        )}
      </Card>

      {settle.length > 0 && (
        <Card>
          <SectionTitle icon={ArrowRight}>結算(換算日幣)</SectionTitle>
          <div className="space-y-2">
            {settle.map((s, i) => (
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
        {data.expenses.length === 0 && <p className="text-sm text-rose-300">還沒有花費紀錄</p>}
        <div className="space-y-2">
          {[...data.expenses].reverse().map((x) => (
            <div key={x.id} className="flex items-center gap-3 bg-pink-50 rounded-xl p-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{x.desc}</div>
                <div className="text-xs text-rose-400">{x.paidBy} 付 · 分 {x.split.length} 人 · {x.date}</div>
              </div>
              <div className="text-sm font-bold text-rose-500">{money(x.amount, x.currency)}</div>
              <button onClick={() => del(x.id)} className="text-rose-200 hover:text-rose-500"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ListsView({ data, set }) {
  return (
    <div className="space-y-4">
      <ChecklistCard title="美食清單" icon={Utensils} placeholder="想吃的,例:一蘭拉麵" sub="地點/店名 (用於地圖)" map items={data.food} onChange={(food) => set({ food })} />
      <ChecklistCard title="待購物清單" icon={ShoppingBag} placeholder="想買的,例:白色戀人" sub="店家/品牌 (選填)" map items={data.shopping} onChange={(shopping) => set({ shopping })} />
    </div>
  );
}
function ChecklistCard({ title, icon, placeholder, sub, items, onChange, map }) {
  const [name, setName] = useState(""); const [meta, setMeta] = useState("");
  const add = () => { if (!name) return; onChange([...items, { id: uid(), name, meta, done: false }]); setName(""); setMeta(""); };
  const toggle = (id) => onChange(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const del = (id) => onChange(items.filter((i) => i.id !== id));
  const doneCount = items.filter((i) => i.done).length;
  return (
    <Card>
      <SectionTitle icon={icon} right={<span className="text-xs text-rose-300">{doneCount}/{items.length}</span>}>{title}</SectionTitle>
      <div className="space-y-2 mb-3">
        <Field placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <div className="flex gap-2">
          <Field placeholder={sub} value={meta} onChange={(e) => setMeta(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <PinkBtn onClick={add} className="shrink-0"><Plus size={16} /></PinkBtn>
        </div>
      </div>
      <div className="space-y-1.5">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-2 bg-pink-50 rounded-xl p-2.5">
            <button onClick={() => toggle(i.id)} className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${i.done ? "bg-rose-400 text-white" : "border-2 border-pink-200"}`}>{i.done && <Check size={14} />}</button>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${i.done ? "line-through text-rose-300" : ""}`}>{i.name}</div>
              {i.meta && <div className="text-xs text-rose-400">{i.meta}</div>}
            </div>
            {map && <button onClick={() => openMap(i.name + " " + (i.meta || ""))} className="text-sky-400 hover:text-sky-600 shrink-0" title="地圖"><MapIcon size={16} /></button>}
            <button onClick={() => del(i.id)} className="text-rose-200 hover:text-rose-500 shrink-0"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AlbumView({ data, set }) {
  const [label, setLabel] = useState(""); const [url, setUrl] = useState("");
  const add = () => {
    if (!url) return;
    let u = url.trim(); if (!/^https?:\/\//.test(u)) u = "https://" + u;
    set({ albums: [...data.albums, { id: uid(), label: label || "共享相簿", url: u }] });
    setLabel(""); setUrl("");
  };
  const del = (id) => set({ albums: data.albums.filter((a) => a.id !== id) });
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon={ImageIcon}>共享相簿連結</SectionTitle>
        <p className="text-xs text-rose-400 mb-3">貼上 Google 相簿 / iCloud 共享相簿連結,旅伴點開即可一起看。</p>
        <div className="space-y-2">
          <Field placeholder="相簿名稱,例:Day1 由布院" value={label} onChange={(e) => setLabel(e.target.value)} />
          <div className="flex gap-2">
            <Field placeholder="貼上相簿連結" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
            <PinkBtn onClick={add} className="shrink-0"><Plus size={16} /></PinkBtn>
          </div>
        </div>
      </Card>
      {data.albums.map((a) => (
        <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block">
          <Card className="flex items-center gap-3 hover:bg-pink-50">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-200 to-rose-300 flex items-center justify-center text-white shrink-0"><ImageIcon size={22} /></div>
            <div className="flex-1 min-w-0"><div className="text-sm font-medium">{a.label}</div><div className="text-xs text-rose-300 truncate">{a.url}</div></div>
            <ExternalLink size={16} className="text-rose-300" />
            <button onClick={(ev) => { ev.preventDefault(); del(a.id); }} className="text-rose-200 hover:text-rose-500"><Trash2 size={16} /></button>
          </Card>
        </a>
      ))}
    </div>
  );
}

function SettingView({ data, set }) {
  const [name, setName] = useState(data.tripName);
  const [newT, setNewT] = useState("");
  const [copied, setCopied] = useState(false);
  const addT = () => { const n = newT.trim(); if (!n || data.travelers.includes(n)) return; set({ travelers: [...data.travelers, n] }); setNewT(""); };
  const delT = (n) => { if (data.travelers.length <= 1) return; set({ travelers: data.travelers.filter((t) => t !== n) }); };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
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
      </Card>
      <Card>
        <SectionTitle icon={Settings}>旅程設定</SectionTitle>
        <label className="text-xs text-rose-400">旅程名稱</label>
        <div className="flex gap-2 mt-1"><Field value={name} onChange={(e) => setName(e.target.value)} /><PinkBtn onClick={() => set({ tripName: name })} className="shrink-0">儲存</PinkBtn></div>
        <label className="text-xs text-rose-400 block mt-4">匯率 (1 ¥ = ? NT$)</label>
        <Field type="number" step="0.001" value={data.rate} onChange={(e) => set({ rate: parseFloat(e.target.value) || 0 })} className="mt-1" />
      </Card>
      <Card>
        <SectionTitle icon={Users}>旅伴</SectionTitle>
        <div className="flex gap-2 mb-3"><Field placeholder="新增旅伴名字" value={newT} onChange={(e) => setNewT(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addT()} /><PinkBtn onClick={addT} className="shrink-0"><Plus size={16} /></PinkBtn></div>
        <div className="flex flex-wrap gap-2">
          {data.travelers.map((t) => (
            <span key={t} className="flex items-center gap-1 bg-pink-100 text-rose-600 rounded-full px-3 py-1 text-sm">{t}{data.travelers.length > 1 && <button onClick={() => delT(t)} className="text-rose-400 hover:text-rose-600"><X size={13} /></button>}</span>
          ))}
        </div>
      </Card>
    </div>
  );
}
