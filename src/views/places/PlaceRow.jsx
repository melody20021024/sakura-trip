import { Map as MapIcon, Plus } from "lucide-react";
import { openMap } from "../../lib/schema.js";
import { typeOf } from "./constants.js";

// C-22: one saved place. Visually the same object as ItemRow (C-08) — same
// bg-pink-50 rounded-xl p-2.5, same category tag, same 32x36 icon hit areas — so
// adding it to a day reads as "this moved across", not "a different thing was
// created" (DDR-16).
export function PlaceRow({ place, addedDays = [], onOpen, onMap, onAddToTrip }) {
  const t = typeOf(place.category);
  const Ico = t.icon;
  return (
    <div className="flex items-start gap-1.5 bg-pink-50 rounded-xl p-2.5">
      <button onClick={() => onOpen(place)} className="flex-1 min-w-0 text-left">
        <span className="flex items-center gap-1 flex-wrap">
          <span className={`text-[11px] rounded-md px-1.5 py-0.5 flex items-center gap-1 ${t.c}`}>
            <Ico size={11} /> {t.label}
          </span>
        </span>
        {/* break-words, not truncate: Japanese shop names are long and the tail
            is often the part that identifies the branch. */}
        <span className="block text-sm font-medium break-words mt-0.5">{place.name}</span>
        {(place.area || addedDays.length > 0) && (
          <span className="block text-xs text-rose-400">
            {place.area}
            {place.area && addedDays.length > 0 && " · "}
            {addedDays.length > 0 && (
              // Derived from the itinerary every render (daysForPlace), never
              // stored on the place — so it cannot disagree with what is
              // actually in the days (DDR-23). Adding it again is still allowed:
              // one shop can be on two days.
              <span className="rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-600">
                已加入 {addedDays.map((d) => "D" + (d.idx + 1)).join("、")}
              </span>
            )}
          </span>
        )}
        {place.note && <span className="block text-xs text-rose-400 break-words">{place.note}</span>}
      </button>
      <div className="flex items-center shrink-0 -my-1">
        {/* Always shown, unlike ItemRow's MAPPABLE filter: everything in the
            pocket is somewhere the user wants to go, and openMap is a plain URL
            that cannot fail. */}
        <button
          onClick={() => (onMap ? onMap(place) : openMap(`${place.name} ${place.area || ""}`.trim()))}
          aria-label="地圖"
          title="在 Google 地圖搜尋"
          className="text-sky-400 hover:text-sky-600 w-8 h-9 grid place-items-center"
        >
          <MapIcon size={15} />
        </button>
        <button
          onClick={() => onAddToTrip(place)}
          aria-label="加入行程"
          title="加入行程"
          className="text-rose-400 hover:text-rose-500 w-8 h-9 grid place-items-center"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
