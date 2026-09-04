import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ChevronDown, ChevronUp, Link2, Loader2, X } from "lucide-react";
import { Field } from "../../components/ui.jsx";
import { byteSize, PLACE_BUDGET_BYTES, uid } from "../../lib/schema.js";
import { dedupeAgainstSaved, pocketBytes, capacityCheck } from "../../lib/places.js";
import { detectPlatform } from "../../lib/share.js";
import { compressImage, OCR_MAX, OCR_QUALITY } from "../../lib/image.js";
import { parsePost } from "../../lib/api.js";
import { liveItems } from "../../lib/merge.js";
import { ITEM_TYPES, typeOf } from "./constants.js";

// Front-end copies of the endpoint's three image limits. Both sides check:
// the front end so we never send a request that is certain to fail, the back
// end because the front end can be bypassed. The numbers must stay equal
// (api/_parse-lib.js MAX_IMAGES / MAX_IMAGE_B64 / MAX_IMAGES_TOTAL_B64).
export const MAX_SHOTS = 3;
export const MAX_SHOT_B64 = 4_000_000;
export const MAX_SHOTS_B64_TOTAL = 10_000_000;

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

// C-30: the screenshot picker, in two weights.
//
// `emphasis` changes className only — never behaviour. Submitting, validation
// and compression are identical in both modes; the whole reason this is a
// component instead of two inline blocks is that two inline copies would drift
// (DDR-31). In IG mode it keeps the primary look even after files are chosen:
// it is still the main event of this step.
function ShotPicker({ shots, emphasis, busy, disabled, max, onAdd, onRemove, inputRef }) {
  const primary = emphasis === "primary";
  const full = shots.length >= max;
  return (
    <div className={disabled ? "opacity-60 pointer-events-none" : ""}>
      {shots.length > 0 && (
        <p className="text-[11px] text-rose-400 mb-1">
          已選 {shots.length} 張{full ? "・已達上限 3 張" : ""}
        </p>
      )}
      <label
        aria-label="選擇截圖"
        className={
          primary
            ? "min-h-24 bg-rose-50 border-2 border-rose-300 text-rose-600 rounded-2xl py-5 text-sm font-medium flex flex-col items-center justify-center gap-1 cursor-pointer"
            : "h-11 border border-dashed border-pink-200 text-rose-300 rounded-xl text-sm flex items-center justify-center gap-1 cursor-pointer"
        }
      >
        <Camera size={primary ? 24 : 15} />
        <span>{busy ? "處理中…" : primary ? "選一張截圖" : "或選截圖"}</span>
        {primary && !busy && (
          <span className="text-[10px] text-rose-400">caption 分兩三屏就多截幾張，最多 {max} 張</span>
        )}
        {/* Same pattern as ChecklistCard: a hidden native input inside a label.
            No home-grown file picker. */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={busy || full}
          onChange={(e) => { const f = e.target.files; e.target.value = ""; if (f?.length) onAdd(f); }}
        />
      </label>

      {shots.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {shots.map((s, i) => (
            <div key={s.key} className="relative shrink-0">
              <img src={s.dataUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-pink-200" />
              <button
                onClick={() => onRemove(s.key)}
                aria-label={`移除第 ${i + 1} 張截圖`}
                className="absolute -top-2.5 -right-2.5 w-11 h-11 grid place-items-center"
              >
                <span className="w-5 h-5 rounded-full bg-rose-400 text-white grid place-items-center">
                  <X size={11} />
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const emptyRow = () => ({
  key: uid(), checked: true, name: "", nameJa: "", category: "other",
  area: "", note: "", confidence: 1, duplicate: false,
});

// Field order per mode. Switching mode reorders a flex container; it does NOT
// re-render a different tree. iOS Safari dismisses the keyboard when the DOM is
// rebuilt, and an <input type="file"> loses its selected files (UI spec §8).
const ORDER = {
  general: { fail: 0, notice: 1, url: 2, text: 3, shot: 4, src: 5 },
  ig: { fail: 0, notice: 1, shot: 2, url: 3, src: 3, text: 6 },
};

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
  const [shots, setShots] = useState([]);
  const [busyShots, setBusyShots] = useState(false);
  const [shotNote, setShotNote] = useState("");
  const [urlOpen, setUrlOpen] = useState(false); // IG: link expanded back to an editable field
  const [textOpen, setTextOpen] = useState(true);
  const [failReason, setFailReason] = useState("");
  const [failMessage, setFailMessage] = useState("");
  const [collection, setCollection] = useState({ title: "", summary: "" });
  const [via, setVia] = useState("");
  const [rows, setRows] = useState([]);
  const [expandedKey, setExpandedKey] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  const textRef = useRef(null);
  const shotInputRef = useRef(null);
  const shotBlockRef = useRef(null);

  // The layout mode is DERIVED, every render. No useState, no useEffect, no
  // setMode. With a state + effect there is one frame where the link already
  // reads instagram.com and the layout has not caught up, and two sources of
  // truth that can disagree. Being derived also makes reversibility structural
  // (delete the link, next render is back to general) and makes it impossible to
  // hang a focus() on a "mode change" event — there is no such event (DDR-26).
  const mode = detectPlatform(url) === "instagram" ? "ig" : "general";
  const ig = mode === "ig";
  const order = ORDER[mode];

  // Reset on every open, and prefill from whichever entry point opened us.
  useEffect(() => {
    if (!open) return;
    setStep("input");
    setUrl(prefill?.url || "");
    setText(prefill?.text || "");
    setShots([]); setBusyShots(false); setShotNote("");
    setUrlOpen(false);
    setFailReason(""); setFailMessage("");
    setCollection({ title: "", summary: "" }); setVia("");
    setRows([]); setExpandedKey(""); setBlocked(false);
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
  }, [open, prefill]);

  // Collapsing the text field is a per-mode default, not a rule: if the user has
  // already typed something, folding it away reads as "my text disappeared".
  useEffect(() => {
    setTextOpen(mode === "general" ? true : !!text.trim());
    // Only on a mode flip. Deliberately not depending on `text`, or every
    // keystroke would re-open the fold the user just closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // S-13 / S-21. Parsing failed: stay put, keep everything, and move the cursor
  // to the field that can actually rescue this attempt — which is not the same
  // field on every platform. Sending an IG user back to the post-text box pushes
  // her at an action that is impossible there, once per failure (DDR-11).
  useEffect(() => {
    if (!open || !failReason || step !== "input") return;
    const target = ig ? shotInputRef.current : textRef.current;
    const block = ig ? shotBlockRef.current : textRef.current;
    target?.focus();
    block?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [open, failReason, step, ig]);

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

  const hasContent = !!text.trim() || shots.length > 0;
  const canSubmit = !!(url.trim() || hasContent);
  const parsing = step === "parsing";

  const setRow = (key, patch) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // One at a time, not Promise.all: each compressImage builds a canvas and an
  // Image, and decoding three 1568px screenshots at once spikes memory and drops
  // frames on an iPhone. The user cannot tell the difference.
  const addShots = async (fileList) => {
    setShotNote("");
    setBusyShots(true);
    const room = MAX_SHOTS - shots.length;
    const picked = Array.from(fileList).slice(0, room);
    const skippedCount = fileList.length - picked.length;
    const notes = [];
    if (skippedCount > 0) notes.push(`一次最多 ${MAX_SHOTS} 張，只收了前 ${picked.length} 張。`);

    let total = shots.reduce((n, s) => n + s.bytes, 0);
    const added = [];
    for (const f of picked) {
      try {
        const dataUrl = await compressImage(f, { max: OCR_MAX, quality: OCR_QUALITY });
        const bytes = dataUrl.length;
        if (bytes > MAX_SHOT_B64) { notes.push(`「${f.name}」壓完還是太大，換一張。`); continue; }
        if (total + bytes > MAX_SHOTS_B64_TOTAL) { notes.push("幾張截圖加起來太大了，請少選一張。"); continue; }
        total += bytes;
        added.push({ key: uid(), dataUrl, name: f.name, bytes });
      } catch (e) {
        notes.push(e?.message || "這張圖讀不進來，換一張。");
      }
    }
    if (added.length) setShots((cur) => [...cur, ...added]);
    setShotNote(notes.join(" "));
    setBusyShots(false);
  };

  const removeShot = (key) => { setShots((cur) => cur.filter((s) => s.key !== key)); setShotNote(""); };

  // compressImage returns a DATA URL; the contract wants raw base64. Forgetting
  // this line produces no error anywhere — just a model that cannot read the
  // picture, and a user who concludes the feature does not work.
  const toImages = (list) => list.map((s) => ({
    base64: s.dataUrl.slice(s.dataUrl.indexOf(",") + 1),
    mime: "image/jpeg",
  }));

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
      res = await parsePost({
        trip: trip.key, url: url.trim(), text, images: toImages(shots), cityHint,
      });
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
        // shown to a human before it is written, every time — and a screenshot
        // source makes that MORE important, not less: OCR of Japanese shop names
        // misreads more often than pasted text does.
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

  const failCopy = failMessage || FALLBACK_FAIL[mode]?.[failReason] || FALLBACK_FAIL[mode].upstream_error;

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
            {shots.length > 0 && (
              <span className="block"><b>截圖沒辦法離線保存</b>，回到網路後請再選一次。</span>
            )}
          </div>
        )}

        <div className="px-5 pb-3 overflow-y-auto flex-1">
          {/* The input step stays mounted while parsing so the fields keep their
              values and the file input keeps its selection. */}
          <div className={`flex flex-col ${step === "review" ? "hidden" : ""}`}>
            {failReason && (
              <div
                role="alert"
                style={{ order: order.fail }}
                className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-2.5 text-xs mb-3 leading-relaxed"
              >
                {/* The backend's own message wins: only it knows which of the
                    three too_large limits was hit, and a refusal's real cause. */}
                <span>{failCopy}</span>
                <button
                  onClick={() => { setRows([emptyRow()]); setCollection({ title: "", summary: "" }); setVia(""); setBlocked(false); setStep("review"); }}
                  className="underline block mt-1"
                >
                  自己輸入一個地點
                </button>
              </div>
            )}

            {/* The failure bar takes this slot when both would show: two amber
                bars stacked dilute each other, and the failure is the newer news. */}
            {ig && !failReason && (
              <div
                role="status"
                aria-live="polite"
                style={{ order: order.notice }}
                className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-2.5 text-xs mb-3 leading-relaxed"
              >
                <b>Instagram 的內文櫻旅讀不到。</b>連結被登入牆擋住，caption 也沒辦法長按複製。<br />
                <b>請截一張把說明文字展開的圖</b>，我從圖上讀店名。
              </div>
            )}

            <div ref={shotBlockRef} style={{ order: order.shot }} className="mb-3">
              {!ig && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-px flex-1 bg-pink-100" />
                  <span className="text-[11px] text-rose-300">或</span>
                  <span className="h-px flex-1 bg-pink-100" />
                </div>
              )}
              <ShotPicker
                shots={shots}
                emphasis={ig ? "primary" : "secondary"}
                busy={busyShots}
                disabled={parsing}
                max={MAX_SHOTS}
                onAdd={addShots}
                onRemove={removeShot}
                inputRef={shotInputRef}
              />
              {shotNote && <p className="text-[11px] text-amber-700 mt-1">{shotNote}</p>}
              {ig && (
                // "Please take a screenshot" is not enough guidance: people
                // screenshot the food, and a picture of a bowl has no shop name
                // on it, so the parse fails and they conclude the feature is bad.
                <div className="mt-2 text-[11px] text-rose-400 leading-relaxed">
                  <div className="font-medium text-rose-500">要截「有字的那一張」，不是食物特寫。</div>
                  <div>・貼文：先點 caption 的「<b>更多</b>」把整段展開，再截</div>
                  <div>・Reels／影片：截<b>有字幕、或有說明文字</b>的那一秒</div>
                  <div>・只有食物或風景畫面的圖<b>認不出店名</b>，多半會解析失敗</div>
                </div>
              )}
            </div>

            <div style={{ order: order.url }} className={`mb-3 ${ig && !urlOpen ? "hidden" : ""}`}>
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

            {/* DDR-28: on IG the link contributes nothing to parsing, but it is
                the only way back to the original post — collapse it, never drop it. */}
            {ig && !urlOpen && (
              <div style={{ order: order.src }} className="mb-3">
                <div className="flex items-center gap-2 bg-pink-50 border border-pink-100 rounded-xl px-3 py-2">
                  <Link2 size={14} className="shrink-0 text-rose-300" />
                  <span className="flex-1 min-w-0 truncate text-xs text-rose-700">
                    {url.replace(/^https?:\/\//i, "")}
                  </span>
                  <button onClick={() => setUrlOpen(true)} className="shrink-0 text-xs text-purple-500 underline">
                    改連結
                  </button>
                </div>
                <p className="text-[10px] text-rose-300 mt-1">連結會存成來源，之後想回去看原貼文靠它。</p>
              </div>
            )}

            <div style={{ order: order.text }} className="mb-1">
              {ig && (
                <button
                  onClick={() => setTextOpen((v) => !v)}
                  aria-expanded={textOpen}
                  className="text-xs text-purple-500 mb-1"
                >
                  如果你複製得到文字（選填） {textOpen ? "▴" : "▾"}
                </button>
              )}
              <div className={ig && !textOpen ? "hidden" : ""}>
                {!ig && <label className="text-xs text-rose-400 font-medium" htmlFor="ing-text">貼文文字</label>}
                <textarea
                  id="ing-text"
                  ref={textRef}
                  rows={4}
                  value={text}
                  readOnly={parsing}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={ig ? "作者置頂留言、或你自己打的店名也可以" : "長按貼文 → 拷貝，把提到店名的那段貼進來"}
                  className={`w-full bg-pink-50 border border-pink-100 rounded-xl px-3 py-2 text-sm text-rose-900 placeholder-rose-300 mt-1 focus:outline-none focus:ring-2 focus:ring-rose-200 ${parsing ? "opacity-60" : ""}`}
                />
                {!ig && (
                  // Naming the one platform where this does not work is the
                  // point: left vague, the user tries it, fails, blames the app.
                  <p className="text-[11px] text-rose-300 mt-1 leading-relaxed">
                    Threads、小紅書、YouTube 的說明文字通常複製得到，貼過來成功率最高。
                    <b className="text-rose-400">Instagram 複製不了，貼連結我會請你改用截圖。</b>
                  </p>
                )}
              </div>
            </div>

            {parsing && (
              <div style={{ order: 9 }} className="mt-4 space-y-2" aria-busy="true">
                <div className="h-9 rounded-xl bg-pink-100 animate-pulse" />
                <div className="h-9 rounded-xl bg-pink-100 animate-pulse" />
                <div className="h-9 rounded-xl bg-pink-100 animate-pulse" />
              </div>
            )}
          </div>

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
            ig={ig}
            hasContent={hasContent}
            canSubmit={canSubmit}
            count={draftPlaces.length}
            overBudget={overBudget}
            onParse={runParse}
            onPickShot={() => shotInputRef.current?.click()}
            onSaveOffline={saveOffline}
            onCommit={commitReview}
          />
          {/* DDR-27 escape hatch, so a mis-detected host cannot lock anyone out. */}
          {step === "input" && ig && online && (
            <button onClick={runParse} className="w-full text-[11px] text-rose-300 underline mt-2">
              還是先試試這個連結
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Used only when the backend gave us no message of its own (i.e. the request
// never reached it, or a limit was caught here first). The backend's wording
// always wins — it is the only side that knows which limit was hit.
const FALLBACK_FAIL = {
  general: {
    need_text_or_image: "這個連結讀不到內文。請長按貼文 → 拷貝，把寫店名的那段文字貼在下面。",
    no_places: "這段內容裡我找不到具體的店名或景點。再多貼一點文字試試，或直接自己新增。",
    too_large: "這張截圖太大了，換一張或改貼文字。",
    rate_limited: "剛剛解析太多次了，等幾分鐘再試。你貼的內容還留著。",
    bad_request: "這次的內容送不出去，換一種方式再試。",
    not_configured: "解析服務尚未設定,請聯絡管理者。",
    upstream_error: "解析服務暫時不通,等一下再試。你貼的內容還留著。",
  },
  ig: {
    need_text_or_image: "讀不到，IG 一定是這樣。請截一張把說明文字展開的圖（影片就截有字幕的那一幕）再試一次。",
    no_places: "這張圖上我找不到店名，多半是截到食物畫面。把 caption 點「更多」展開後再截一張。",
    too_large: "這張截圖太大了，換一張或改貼文字。",
    rate_limited: "剛剛解析太多次了，等幾分鐘再試。你貼的內容還留著。",
    bad_request: "這次的內容送不出去，換一種方式再試。",
    not_configured: "解析服務尚未設定,請聯絡管理者。",
    upstream_error: "解析服務暫時不通,等一下再試。你貼的內容還留著。",
  },
};

function MainButton({
  step, online, ig, hasContent, canSubmit, count, overBudget,
  onParse, onPickShot, onSaveOffline, onCommit,
}) {
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
  if (ig && !hasContent) {
    // DDR-27: an IG link on its own is a request that fails 100% of the time and
    // still burns one of the endpoint's 20 calls per IP per hour. Designing a
    // button whose only outcome is failure is worse than not offering it: this
    // one opens the file picker instead.
    return <button onClick={onPickShot} className={cls(true)}>選擇截圖</button>;
  }
  return (
    <button onClick={canSubmit ? onParse : undefined} disabled={!canSubmit} aria-disabled={!canSubmit} className={cls(canSubmit)}>
      解析看看
    </button>
  );
}
