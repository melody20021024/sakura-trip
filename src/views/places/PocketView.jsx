import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Card, Toast } from "../../components/ui.jsx";
import { liveItems } from "../../lib/merge.js";
import { byteSize, PLACE_WARN_BYTES } from "../../lib/schema.js";
import { IngestSheet } from "./IngestSheet.jsx";
import { PlaceSheet } from "./PlaceSheet.jsx";
import { DayPickerSheet } from "./DayPickerSheet.jsx";
import { PocketCard, MANUAL_POCKET_ID } from "./PocketCard.jsx";

// C-27: capacity. Both thresholds come from named constants — the numbers must
// not be written into a component (UI spec §6.4).
//
// It points at checklist photos first on purpose: 150 places is about 54KB,
// while one compressed photo can be tens of KB. Telling the user to delete
// places would have her clear the pocket and find the space did not come back —
// exactly the dead end F-76 exists to avoid (DDR-17).
function CapacityNotice({ onGoTab }) {
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl p-3 text-xs">
      <div className="font-medium mb-1">快滿了。這份行程的資料剩下不到 10%。</div>
      <div>最占空間的通常是<b>待購清單的相片</b>，其次是舊的口袋地點。</div>
      <button onClick={() => onGoTab("lists")} className="border border-amber-300 rounded-lg px-3 py-1.5 mt-2">
        去清單頁看看
      </button>
    </div>
  );
}

// C-18: a BUTTON, not an input. Putting a real field on the page would give the
// feature a second parse flow and a second failure handler; every entry point
// has to end in C-19 (DDR-10b).
function IngestBar({ onOpen }) {
  return (
    <Card>
      <p className="text-xs text-rose-400 mb-2">
        看到想去的店，把<b>截圖</b>、連結或貼文文字丟進來，我幫你拆成地點、再告訴你排哪一天。
      </p>
      <button
        onClick={onOpen}
        className="w-full bg-rose-400 hover:bg-rose-500 text-white rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-1"
      >
        <Plus size={16} /> 收藏一則貼文
      </button>
    </Card>
  );
}

// S-01. The one thing this release sells is "it tells you which day to put it
// on". The copy may not mention a map, a map overview, linking a Google account
// or syncing a Google list — none of that exists (PRD §4.5). The first line has
// to be the screenshot: on Instagram it is the only path that works, and T-98
// proved pasting the caption is not an option.
function EmptyState({ onOpen, onGoTab }) {
  return (
    <Card className="text-center p-6">
      <div className="text-4xl mb-2">🌸</div>
      <div className="font-bold text-rose-500 mb-2">口袋是空的</div>
      <p className="text-xs text-rose-400 leading-relaxed mb-1">
        滑 IG 看到想去的店，<b className="text-rose-500">截一張有說明文字的圖</b>丟進來。
      </p>
      <p className="text-xs text-rose-400 leading-relaxed mb-1">
        Threads、小紅書、YouTube 則可以直接貼連結或貼文文字。
      </p>
      <p className="text-xs text-rose-400 leading-relaxed mb-4">
        櫻旅會拆成一個個地點，再告訴你這家店<b className="text-rose-500">適合排哪一天</b>。
      </p>
      <button
        onClick={onOpen}
        className="w-full bg-rose-400 hover:bg-rose-500 text-white rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-1"
      >
        <Plus size={16} /> 收藏一則貼文
      </button>
      <button onClick={() => onGoTab("setting")} className="mt-3 text-[11px] text-rose-300 underline">
        設定 iOS 捷徑，從 IG 分享選單直接開櫻旅
      </button>
    </Card>
  );
}

// P-06. Owns the sheets and the one derived list every child needs.
export function PocketView({ trip, confirm, onGoTab, initialShare }) {
  const [ingest, setIngest] = useState(null); // { prefill, reparseOf } | null
  const [placeOpen, setPlaceOpen] = useState(null);
  const [dayPickFor, setDayPickFor] = useState(null);
  const [toast, setToast] = useState(null);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  // F-83: a shortcut launch opens the sheet already filled in. Once only —
  // closing it must not immediately reopen it.
  const [shareUsed, setShareUsed] = useState(false);
  useEffect(() => {
    if (initialShare && !shareUsed) {
      setShareUsed(true);
      setIngest({ prefill: initialShare, reparseOf: null });
    }
  }, [initialShare, shareUsed]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const data = trip.data;

  // Computed once here and handed down, rather than each PlaceRow deriving its
  // own: the contract for daysForPlace is "tombstone-filtered and date-sorted",
  // the same expression TripView uses, so D(n) matches what the user sees.
  const liveDays = useMemo(
    () => liveItems(data.days).sort((a, b) => a.date.localeCompare(b.date)),
    [data.days]
  );
  const livePlaces = useMemo(() => liveItems(data.places || []), [data.places]);
  const livePockets = useMemo(
    () => liveItems(data.pockets || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [data.pockets]
  );

  // Only the base size matters for the standing warning; the projected size of a
  // pending write is checked inside the ingest sheet.
  const warn = useMemo(() => byteSize(data) > PLACE_WARN_BYTES, [data]);

  const cityHint = useMemo(
    () => [...new Set(liveDays.map((d) => d.city?.v).filter(Boolean))].join(","),
    [liveDays]
  );

  const byPocket = useMemo(() => {
    const m = new Map();
    for (const p of livePlaces) {
      const k = p.pocketId || "";
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(p);
    }
    for (const list of m.values()) list.sort((a, b) => (a.order || 0) - (b.order || 0));
    return m;
  }, [livePlaces]);

  const manualPlaces = byPocket.get("") || [];
  const empty = !livePockets.length && !livePlaces.length;

  const openIngest = (prefill = null, reparseOf = null) => setIngest({ prefill, reparseOf });

  // Stable identities: Toast restarts its 1.8s timer whenever these change, so
  // an inline arrow would keep the toast on screen forever.
  const dismissToast = useCallback(() => setToast(null), []);
  const goTrip = useCallback(() => { setToast(null); onGoTab("trip"); }, [onGoTab]);

  const deletePocket = async (pocket) => {
    const n = (byPocket.get(pocket.id) || []).length;
    const ok = await confirm(`確定要刪除「${pocket.title}」整則收藏嗎？`, {
      subtitle: `底下的 ${n} 個地點也會一起刪掉,旅伴端同樣會移除。`,
    });
    if (ok) trip.deletePocket(pocket.id);
  };

  const pickDay = (dayId) => {
    const place = dayPickFor;
    trip.addPlaceToDay(dayId, place);
    setDayPickFor(null);
    const idx = liveDays.findIndex((d) => d.id === dayId);
    const day = liveDays[idx];
    const label = day
      ? new Date(day.date + "T00:00").toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" })
      : "";
    setToast({ message: `已排進 D${idx + 1}${label ? `（${label}）` : ""}`, actionLabel: "去看看" });
  };

  return (
    <div className="space-y-4">
      {warn && <CapacityNotice onGoTab={onGoTab} />}

      {empty ? (
        <EmptyState onOpen={() => openIngest()} onGoTab={onGoTab} />
      ) : (
        <>
          <IngestBar onOpen={() => openIngest()} />
          {livePockets.map((pocket, i) => (
            <PocketCard
              key={pocket.id}
              pocket={pocket}
              places={byPocket.get(pocket.id) || []}
              liveDays={liveDays}
              // DDR-22: the one just saved is the only one she cares about now.
              defaultOpen={i === 0}
              online={online}
              onReparse={(pk) => openIngest({ url: pk.sourceUrl || "", text: pk.rawText || "" }, pk)}
              onDeletePocket={deletePocket}
              onOpenPlace={setPlaceOpen}
              onAddToTrip={setDayPickFor}
            />
          ))}
          {/* S-07: places with no source post, pinned to the bottom. */}
          {manualPlaces.length > 0 && (
            <PocketCard
              pocket={{ id: MANUAL_POCKET_ID, title: "📌 自己加的地點", summary: "", platform: "other" }}
              places={manualPlaces}
              liveDays={liveDays}
              defaultOpen
              online={online}
              onReparse={() => {}}
              onDeletePocket={() => {}}
              onOpenPlace={setPlaceOpen}
              onAddToTrip={setDayPickFor}
            />
          )}
        </>
      )}

      {/* 96px so the bottom nav never covers the last card. */}
      <div className="h-24" />

      <IngestSheet
        open={!!ingest}
        onClose={() => setIngest(null)}
        trip={trip}
        cityHint={cityHint}
        prefill={ingest?.prefill}
        reparseOf={ingest?.reparseOf}
        onDone={({ count, pending }) =>
          setToast({ message: pending ? "已存成「待解析」，回到網路再解析" : `已加入 ${count} 個地點` })
        }
      />

      <PlaceSheet
        place={placeOpen}
        onClose={() => setPlaceOpen(null)}
        onSave={(id, patch) => trip.updatePlace(id, patch)}
        onDelete={(id) => trip.deletePlace(id)}
        onAddToTrip={(p) => { setPlaceOpen(null); setDayPickFor(p); }}
        confirm={confirm}
      />

      <DayPickerSheet
        place={dayPickFor}
        liveDays={liveDays}
        onPick={pickDay}
        onClose={() => setDayPickFor(null)}
        onGoTrip={() => { setDayPickFor(null); onGoTab("trip"); }}
      />

      {/* One instance for the whole feature — not one per sheet (DDR-29). */}
      <Toast
        message={toast?.message}
        actionLabel={toast?.actionLabel}
        onAction={toast?.actionLabel ? goTrip : undefined}
        onDismiss={dismissToast}
      />
    </div>
  );
}
