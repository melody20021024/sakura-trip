import { useState } from "react";
import {
  ChevronDown, ChevronUp, ExternalLink, Instagram, Link as LinkIcon,
  Pin, Trash2, Youtube,
} from "lucide-react";
import { Card } from "../../components/ui.jsx";
import { openUrl } from "../../lib/schema.js";
import { daysForPlace } from "../../lib/places.js";
import { detectPlatform } from "../../lib/share.js";
import { PlaceRow } from "./PlaceRow.jsx";

const PLATFORM_ICON = { instagram: Instagram, youtube: Youtube };

export const MANUAL_POCKET_ID = "__manual__";

// C-21: one saved post, with the places it produced.
export function PocketCard({
  pocket, places, liveDays, defaultOpen, online,
  onReparse, onDeletePocket, onOpenPlace, onAddToTrip,
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const manual = pocket.id === MANUAL_POCKET_ID;

  // S-06 / S-06b: an offline stash waiting to be parsed.
  if (pocket.pending) {
    // On Instagram the honest button is not 「重新解析」. A screenshot cannot be
    // stashed offline (image bytes never enter the trip jsonb), and a screenshot
    // is the only path IG has — so "re-parse" would promise something that
    // cannot happen without the user finding that picture again. We label the
    // limitation; we do not pretend to have solved it (DDR-25).
    const igPending = detectPlatform(pocket.sourceUrl) === "instagram";
    const label = !online ? "回到網路再試" : igPending ? "補一張截圖再解析" : "重新解析";
    const preview = (pocket.rawText || pocket.sourceUrl || "（截圖，未保存）").slice(0, 40);
    return (
      <Card className="border-dashed border-pink-200">
        <div className="font-bold text-rose-400 mb-1">⏳ 待解析</div>
        <div className="text-xs text-rose-300 break-all mb-1">{preview}</div>
        {igPending && (
          <div className="text-[11px] text-rose-300 mb-2">
            來源是 Instagram，離線時存不下截圖，回線後要再選一次圖。
          </div>
        )}
        <button
          onClick={() => onReparse(pocket)}
          disabled={!online}
          className={`w-full text-white rounded-xl py-2 text-sm mt-1 ${online ? "bg-rose-400 hover:bg-rose-500" : "bg-slate-300 cursor-not-allowed"}`}
        >
          {label}
        </button>
      </Card>
    );
  }

  const Ico = manual ? Pin : PLATFORM_ICON[pocket.platform] || LinkIcon;

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Ico size={16} className="text-rose-300 shrink-0" />
        <h3 className="font-bold text-rose-500 flex-1 truncate">{pocket.title}</h3>
        <span className="text-xs text-rose-300 shrink-0">{places.length} 個地點</span>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "收合" : "展開"}
          aria-expanded={open}
          className="text-rose-300 w-9 h-9 grid place-items-center -my-1 shrink-0"
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      {pocket.summary && <p className="text-xs text-rose-400 mt-0.5 mb-2 line-clamp-2">{pocket.summary}</p>}

      {!manual && (
        <div className="flex items-center gap-3 text-[11px] text-rose-300 mb-2">
          {pocket.sourceUrl && (
            <button onClick={() => openUrl(pocket.sourceUrl)} className="underline flex items-center gap-1">
              <ExternalLink size={11} /> 開原貼文
            </button>
          )}
          {/* S-07 has no delete: it is a virtual card, not a record. */}
          <button onClick={() => onDeletePocket(pocket)} className="underline flex items-center gap-1">
            <Trash2 size={11} /> 刪除整則
          </button>
        </div>
      )}

      {open && (
        <div className="space-y-1.5">
          {places.map((p) => (
            <PlaceRow
              key={p.id}
              place={p}
              addedDays={daysForPlace(p.id, liveDays)}
              onOpen={onOpenPlace}
              onAddToTrip={onAddToTrip}
            />
          ))}
          {!places.length && <p className="text-xs text-rose-300">這則收藏底下沒有地點了。</p>}
        </div>
      )}
    </Card>
  );
}
