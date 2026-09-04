import { CalendarDays } from "lucide-react";
import { liveItems } from "../../lib/merge.js";
import { suggestDays, daysForPlace } from "../../lib/places.js";

// C-25: one full-width row per day. A row carries D(n), the date, the city, the
// item count and up to two badges — five things, which a small pill cannot hold
// at 375px while staying above a 44px touch target (DDR-14b).
function DayChip({ day, idx, itemCount, suggested, added, onPick }) {
  const label = new Date(day.date + "T00:00").toLocaleDateString("zh-TW", {
    month: "long", day: "numeric", weekday: "short",
  });
  const city = day.city?.v || "";
  return (
    <button
      onClick={onPick}
      className={`w-full text-left rounded-xl p-3 flex items-center gap-2 ${
        suggested ? "bg-rose-50 border border-rose-200" : "bg-pink-50 border border-transparent"
      }`}
    >
      <span className="bg-rose-400 text-white text-xs rounded-full w-7 h-7 grid place-items-center shrink-0">
        D{idx + 1}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className={`block text-xs ${city ? "text-rose-400" : "text-rose-300"}`}>
          {city || "未填城市"} · {itemCount ? `已有 ${itemCount} 項` : "還沒有安排"}
        </span>
      </span>
      {/* Both states are double-encoded: a colour plus words. The rose tint on a
          suggested row is never the only signal (UI spec §9). */}
      {added && (
        <span className="text-[11px] rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-600 shrink-0">已加入</span>
      )}
      {suggested && (
        <span className="text-[11px] rounded-full px-2 py-0.5 bg-rose-100 text-rose-600 shrink-0">建議</span>
      )}
    </button>
  );
}

// C-24: pick the day to write this place into (F-75, the point of this release).
//
// Four rules that are not negotiable:
//  1. The order is the itinerary's own order. suggestDays returns a Set, so it
//     is structurally impossible to sort by it (DDR-14).
//  2. Nothing is auto-selected and nothing is auto-written — no effect calls
//     onPick.
//  3. Zero matches still lists every day.
//  4. An empty place.area or day.city suggests nothing and blocks nothing.
export function DayPickerSheet({ place, liveDays = [], onPick, onClose, onGoTrip }) {
  if (!place) return null;

  const suggested = suggestDays(place, liveDays);
  const addedIds = new Set(daysForPlace(place.id, liveDays).map((d) => d.dayId));

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="選擇日期">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl max-w-2xl mx-auto p-5"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <h2 className="font-bold text-rose-500 mb-1">
          把「<span className="break-words">{place.name}</span>」排到哪一天？
        </h2>
        <p className="text-xs text-rose-400 mb-3">
          標了「建議」的是<b>當天正好在這個區域</b>的日子。順序維持行程原本的順序。
        </p>

        {liveDays.length > 0 ? (
          <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: "60vh" }}>
            {liveDays.map((day, idx) => (
              <DayChip
                key={day.id}
                day={day}
                idx={idx}
                itemCount={liveItems(day.items || []).length}
                suggested={suggested.has(day.id)}
                added={addedIds.has(day.id)}
                onPick={() => onPick(day.id)}
              />
            ))}
          </div>
        ) : (
          // S-19. The button only switches tab — this sheet adds no way to
          // create days, that already exists on the itinerary page.
          <div className="text-center py-6">
            <CalendarDays size={30} className="mx-auto text-rose-300 mb-2" />
            <p className="text-xs text-rose-400 mb-3">
              這份行程還沒有日期。<br />先到「行程」頁設好出發／回程，按「產生每日卡片」。
            </p>
            <button onClick={onGoTrip} className="bg-rose-400 hover:bg-rose-500 text-white rounded-xl px-4 py-2 text-sm">
              去行程頁
            </button>
          </div>
        )}

        <button onClick={onClose} className="w-full text-rose-400 text-sm mt-3 py-2">取消</button>
      </div>
    </div>
  );
}
