import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import { Field } from "../../components/ui.jsx";
import { byteSize, PLACE_BUDGET_BYTES, uid } from "../../lib/schema.js";
import { dedupeAgainstSaved, pocketBytes, capacityCheck } from "../../lib/places.js";
import { detectPlatform } from "../../lib/share.js";
import { parsePost } from "../../lib/api.js";
import { liveItems } from "../../lib/merge.js";
import { ITEM_TYPES, typeOf } from "./constants.js";

// C-20: one candidate place in the review step.
//
// Collapsed by default — twelve rows of four editable fields is a wall. The two
// warning states are double-encoded: colour AND words, never colour alone
// (UI spec §9).
function ReviewRow({ row, expanded, onToggleCheck, onToggleExpand, onChange }) {
  const t = typeOf(row.category);
  const Ico = t.icon;
  return (
    <li
      className={`rounded-xl p-2.5 border ${
        row.confidence < 0.6 ? "bg-amber-50 border-amber-200" : "bg-pink-50 border-transparent"
      }`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={row.checked}
          onChange={onToggleCheck}
          aria-label={`選取 ${row.name}`}
          className="shrink-0 w-6 h-6 accent-rose-400 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className={`text-[11px] rounded-md px-1.5 py-0.5 flex items-center gap-1 ${t.c}`}>
              <Ico size={11} /> {t.label}
            </span>
            {row.confidence < 0.6 && (
              <span className="text-[11px] text-amber-700 font-medium">名稱可能不準</span>
            )}
            {row.duplicate && (
              <span className="text-[11px] rounded-full px-2 py-0.5 bg-slate-100 text-slate-500">已存過</span>
            )}
          </div>
          <div className="text-sm font-medium break-words mt-0.5">{row.name}</div>
          {row.area && <div className="text-xs text-rose-400">{row.area}</div>}

          {expanded && (
            <div className="mt-2 space-y-1.5">
              <input
                value={row.name}
                onChange={(e) => onChange({ name: e.target.value })}
                aria-label="店名"
                className="w-full bg-white border border-pink-100 rounded-lg px-2 py-1.5 text-xs"
              />
              <select
                value={row.category}
                onChange={(e) => onChange({ category: e.target.value })}
                aria-label="類別"
                className="w-full bg-white border border-pink-100 rounded-lg px-2 py-1.5 text-xs"
              >
                {ITEM_TYPES.map((it) => <option key={it.v} value={it.v}>{it.label}</option>)}
              </select>
              <input
                value={row.area}
                onChange={(e) => onChange({ area: e.target.value })}
                placeholder="城市／區域，例：福岡 中洲川端"
                aria-label="區域"
                className="w-full bg-white border border-pink-100 rounded-lg px-2 py-1.5 text-xs"
              />
              <input
                value={row.note}
                onChange={(e) => onChange({ note: e.target.value })}
                placeholder="備註"
                aria-label="備註"
                className="w-full bg-white border border-pink-100 rounded-lg px-2 py-1.5 text-xs"
              />
            </div>
          )}
        </div>
        <button
          onClick={onToggleExpand}
          aria-label={expanded ? "收合編輯" : "展開編輯"}
          aria-expanded={expanded}
          className="text-rose-300 w-9 h-9 grid place-items-center shrink-0 -my-1"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
    </li>
  );
}

const emptyRow = () => ({
  key: uid(), checked: true, name: "", nameJa: "", category: "other",
  area: "", note: "", confidence: 1, duplicate: false,
});

// C-19: the ingest sheet. Every entry point (the C-18 button, the S-01 empty
// state, a ?share= shortcut launch, S-06 re-parse) ends up here — no entry point
// gets a screen of its own, or we would end up maintaining two parse calls, two
// failure handlers and two review steps.
//
// Steps: input → parsing → review. The review list is LOCAL state; trip.data.places
// does not change by a single byte until 「加入口袋 (N)」 is pressed (T-80).
export function IngestSheet({ open, onClose, trip, cityHint = "", prefill, reparseOf, onDone }) {
  const [step, setStep] = useState("input");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [failReason, setFailReason] = useState("");
  const [failMessage, setFailMessage] = useState("");
  const [collection, setCollection] = useState({ title: "", summary: "" });
  const [via, setVia] = useState("");
  const [rows, setRows] = useState([]);
  const [expandedKey, setExpandedKey] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  const textRef = useRef(null);

  // Reset on every open, and prefill from whichever entry point opened us.
  useEffect(() => {
    if (!open) return;
    setStep("input");
    setUrl(prefill?.url || "");
    setText(prefill?.text || "");
    setFailReason(""); setFailMessage("");
    setCollection({ title: "", summary: "" }); setVia("");
    setRows([]); setExpandedKey(""); setBlocked(false);
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
  }, [open, prefill]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // S-13. Parsing failed: stay put, keep everything, and move the cursor to the
  // field that can actually rescue this attempt. Failure is the normal case
  // here, not the exception, so this path gets the same care as the happy one.
  useEffect(() => {
    if (!open || !failReason || step !== "input") return;
    textRef.current?.focus();
    textRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [open, failReason, step]);

  // Base size is memoised against trip.data: the review step performs no writes,
  // so this is computed once and every checkbox tick only re-serialises the
  // handful of records being added, not the whole (up to 1MB) trip.
  const baseBytes = useMemo(() => (trip.data ? byteSize(trip.data) : 0), [trip.data]);

  if (!open) return null;

  const savedPlaces = liveItems(trip.data?.places || []);
  const checkedRows = rows.filter((r) => r.checked);
  const draftPocket = {
    title: collection.title || "收藏的貼文",
    summary: collection.summary,
    sourceUrl: url.trim(),
    platform: detectPlatform(url),
    rawText: text,
    pending: false,
  };
  const draftPlaces = checkedRows.map((r) => ({
    name: r.name, nameJa: r.nameJa, category: r.category, area: r.area, note: r.note,
  }));
  const overBudget = baseBytes + pocketBytes(draftPocket, draftPlaces) > PLACE_BUDGET_BYTES;

  const hasContent = !!text.trim();
  const canSubmit = !!(url.trim() || hasContent);

  const setRow = (key, patch) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // S-14. Offline we can only keep what is text: image bytes must never enter
  // the trip jsonb (PRD §5.5), so a screenshot cannot be stashed.
  const saveOffline = () => {
    trip.addPocket({
      title: "待解析",
      sourceUrl: url.trim(),
      platform: detectPlatform(url),
      rawText: text,
      pending: true,
    });
    onDone?.({ count: 0, pending: true });
    onClose();
  };

  const runParse = async () => {
    setStep("parsing");
    setFailReason(""); setFailMessage("");
    let res;
    try {
      res = await parsePost({ trip: trip.key, url: url.trim(), text, images: [], cityHint });
    } catch {
      // The endpoint itself always answers 200, so reaching here means the
      // request never got there. No backend message exists to prefer.
      res = { ok: false, reason: "upstream_error", message: "連不上解析服務,等一下再試。你貼的內容還留著。" };
    }
    if (!res || !res.ok) {
      setFailReason(res?.reason || "upstream_error");
      setFailMessage(res?.message || "");
      setStep("input");
      return;
    }
    const dup = dedupeAgainstSaved(res.places, savedPlaces);
    setVia(res.via || "");
    setCollection({ title: res.collection?.title || "", summary: res.collection?.summary || "" });
    setRows(
      res.places.map((p, i) => ({
        key: uid(),
        // T-81: low confidence or already saved starts unticked. AI output is
        // shown to a human before it is written, every time.
        checked: p.confidence >= 0.6 && !dup[i],
        name: p.name, nameJa: p.nameJa || "", category: p.category || "other",
        area: p.area || "", note: p.note || "",
        confidence: p.confidence, duplicate: dup[i],
      }))
    );
    setExpandedKey("");
    setBlocked(false);
    setStep("review");
  };

  // The only write path out of this sheet.
  const commitReview = () => {
    if (!draftPlaces.length) return;
    const cap = capacityCheck(trip.data, draftPocket, draftPlaces);
    if (!cap.ok) { setBlocked(true); return; }
    if (reparseOf) trip.resolvePocket(reparseOf.id, draftPocket, draftPlaces);
    else trip.addPocketWithPlaces(draftPocket, draftPlaces);
    onDone?.({ count: draftPlaces.length });
    onClose();
  };

  // S-13: failure keeps the user where they are with everything they typed, and
  // puts the cursor on the field that can actually rescue the attempt.
  const failNote = failReason && (
    <div
      role="alert"
      className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-2.5 text-xs mb-3 leading-relaxed"
    >
      {/* Always show the backend's own message first: it is the only thing that
          knows which of the three too_large limits was hit, and whether a
          refusal was the rate limit or a missing key. */}
      <span>{failMessage || FALLBACK_FAIL[failReason] || FALLBACK_FAIL.upstream_error}</span>
      <button
        onClick={() => { setRows([emptyRow()]); setCollection({ title: "", summary: "" }); setVia(""); setBlocked(false); setStep("review"); }}
        className="underline block mt-1"
      >
        自己輸入一個地點
      </button>
    </div>
  );

  const parsing = step === "parsing";

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="收藏一則貼文">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl max-w-2xl mx-auto flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        <div className="flex items-center gap-2 px-5 pt-4 pb-2 shrink-0">
          {step === "review" && (
            <button onClick={() => setStep("input")} className="text-rose-400 text-sm">‹ 改一下輸入</button>
          )}
          <h2 className="font-bold text-rose-500 flex-1">
            {step === "review" ? "確認要存哪幾個" : "收藏一則貼文"}
          </h2>
          <button onClick={onClose} aria-label="關閉" className="text-rose-300 w-11 h-11 grid place-items-center -mr-2">
            <X size={18} />
          </button>
        </div>

        {!online && (
          <div className="bg-amber-100 text-amber-700 text-xs px-5 py-2 shrink-0 leading-relaxed">
            📴 現在離線，先幫你存起來，回到網路再解析。
          </div>
        )}

        <div className="px-5 pb-3 overflow-y-auto flex-1">
          {step !== "review" && (
            <div className="flex flex-col">
              {failNote}

              <div className="mb-3">
                <label className="text-xs text-rose-400 font-medium" htmlFor="ing-url">貼文連結</label>
                <Field
                  id="ing-url"
                  inputMode="url"
                  value={url}
                  readOnly={parsing}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="貼上 IG／Threads／小紅書／TikTok／YouTube 連結"
                  className={`mt-1 ${parsing ? "opacity-60" : ""}`}
                />
              </div>

              <div className="mb-1">
                <label className="text-xs text-rose-400 font-medium" htmlFor="ing-text">貼文文字</label>
                <textarea
                  id="ing-text"
                  ref={textRef}
                  rows={4}
                  value={text}
                  readOnly={parsing}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="長按貼文 → 拷貝，把提到店名的那段貼進來"
                  className={`w-full bg-pink-50 border border-pink-100 rounded-xl px-3 py-2 text-sm text-rose-900 placeholder-rose-300 mt-1 focus:outline-none focus:ring-2 focus:ring-rose-200 ${parsing ? "opacity-60" : ""}`}
                />
                {/* Naming the one platform where this does not work is the point:
                    left vague, the user tries it, fails, and blames the app. */}
                <p className="text-[11px] text-rose-300 mt-1 leading-relaxed">
                  Threads、小紅書、YouTube 的說明文字通常複製得到，貼過來成功率最高。
                  <b className="text-rose-400">Instagram 複製不了，貼連結我會請你改用截圖。</b>
                </p>
              </div>

              {parsing && (
                <div className="mt-4 space-y-2" aria-busy="true">
                  <div className="h-9 rounded-xl bg-pink-100 animate-pulse" />
                  <div className="h-9 rounded-xl bg-pink-100 animate-pulse" />
                  <div className="h-9 rounded-xl bg-pink-100 animate-pulse" />
                </div>
              )}
            </div>
          )}

          {step === "review" && (
            <>
              {(via || url) && (
                <div className="text-[11px] text-rose-300 mb-2 truncate">
                  來源：{url.replace(/^https?:\/\//i, "") || "截圖"}
                  {via && (
                    <span className="text-rose-200">
                      {via === "image" ? "（從截圖讀出）" : `（via ${via}）`}
                    </span>
                  )}
                </div>
              )}
              <label className="text-xs text-rose-400 font-medium" htmlFor="ing-title">貼文主題</label>
              <Field
                id="ing-title"
                value={collection.title}
                onChange={(e) => setCollection((c) => ({ ...c, title: e.target.value }))}
                placeholder="收藏的貼文"
                className="mt-1 mb-1"
              />
              {collection.summary && <p className="text-[11px] text-rose-300 mb-3">{collection.summary}</p>}

              <ul role="list" className="space-y-1.5">
                {rows.map((r) => (
                  <ReviewRow
                    key={r.key}
                    row={r}
                    expanded={expandedKey === r.key}
                    onToggleCheck={() => setRow(r.key, { checked: !r.checked })}
                    onToggleExpand={() => setExpandedKey((k) => (k === r.key ? "" : r.key))}
                    onChange={(patch) => setRow(r.key, patch)}
                  />
                ))}
              </ul>
              <p className="text-[11px] text-rose-300 mt-3">未勾選的不會存進來。低信心與已存過的預設不勾。</p>
            </>
          )}
        </div>

        <div
          className="px-5 pt-2 shrink-0 border-t border-pink-50 bg-white"
          style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
        >
          {step === "review" && (blocked || overBudget) && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-xl p-2.5 text-xs mb-2">
              空間不夠了，這批存不進去。先取消勾選幾筆，或去清單頁刪些相片。
            </div>
          )}
          <MainButton
            step={step}
            online={online}
            canSubmit={canSubmit}
            count={draftPlaces.length}
            overBudget={overBudget}
            onParse={runParse}
            onSaveOffline={saveOffline}
            onCommit={commitReview}
          />
        </div>
      </div>
    </div>
  );
}

// Used only when the backend gave us no message of its own (i.e. the request
// never reached it). The backend's wording always wins — it is the only side
// that knows which limit was hit.
const FALLBACK_FAIL = {
  need_text_or_image: "這個連結讀不到內文。請長按貼文 → 拷貝，把寫店名的那段文字貼在下面。",
  no_places: "這段內容裡我找不到具體的店名或景點。再多貼一點文字試試，或直接自己新增。",
  too_large: "這張截圖太大了，換一張或改貼文字。",
  rate_limited: "剛剛解析太多次了，等幾分鐘再試。你貼的內容還留著。",
  bad_request: "這次的內容送不出去，換一種方式再試。",
  not_configured: "解析服務尚未設定,請聯絡管理者。",
  upstream_error: "解析服務暫時不通,等一下再試。你貼的內容還留著。",
};

function MainButton({ step, online, canSubmit, count, overBudget, onParse, onSaveOffline, onCommit }) {
  const base = "w-full rounded-xl py-2.5 text-sm font-medium text-white ";
  const cls = (on) => base + (on ? "bg-rose-400 hover:bg-rose-500" : "bg-slate-300 cursor-not-allowed");

  if (step === "parsing") {
    return (
      <button disabled className={base + "bg-rose-400 opacity-70 flex items-center justify-center gap-2"}>
        <Loader2 size={16} className="animate-spin" /> 解析中…
      </button>
    );
  }
  if (step === "review") {
    // DDR-12: the count is on the button, so the user knows how many will be
    // written before pressing it. Zero is disabled.
    const on = count > 0 && !overBudget;
    return (
      <button onClick={on ? onCommit : undefined} disabled={!on} aria-disabled={!on} className={cls(on)}>
        加入口袋 ({count})
      </button>
    );
  }
  if (!online) {
    // Not 「解析看看」: offline we are not going to parse anything, and promising
    // otherwise is a promise we break two seconds later.
    return (
      <button onClick={canSubmit ? onSaveOffline : undefined} disabled={!canSubmit} aria-disabled={!canSubmit} className={cls(canSubmit)}>
        先存起來
      </button>
    );
  }
  return (
    <button onClick={canSubmit ? onParse : undefined} disabled={!canSubmit} aria-disabled={!canSubmit} className={cls(canSubmit)}>
      解析看看
    </button>
  );
}
