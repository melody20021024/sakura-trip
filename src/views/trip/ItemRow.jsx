import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Map as MapIcon, Pencil, X } from "lucide-react";
import { DragHandle } from "../../components/DragHandle.jsx";
import { openMap } from "../../lib/schema.js";
import { typeOf, MAPPABLE } from "./constants.js";

// C-08: one sortable itinerary item. Drag via the handle only (so taps on the
// row don't start a drag).
export function ItemRow({ item, city, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const t = typeOf(item.type);
  const Ico = t.icon;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    boxShadow: isDragging ? "0 8px 24px rgba(244,63,94,.25)" : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-start gap-1.5 bg-pink-50 rounded-xl p-2.5 ${isDragging ? "relative z-10" : ""}`}>
      <DragHandle listeners={listeners} attributes={attributes} />
      {/* Tag + time on their own line so the title gets the full width on
          narrow phones (was cramped into ~80px before). */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className={`text-[11px] rounded-md px-1.5 py-0.5 flex items-center gap-1 ${t.c}`}>
            <Ico size={11} /> {t.label}
          </span>
          {item.time && <span className="text-xs text-rose-400">{item.time}</span>}
        </div>
        <div className="text-sm font-medium break-words mt-0.5">{item.title}</div>
        {item.note && <div className="text-xs text-rose-400 break-words">{item.note}</div>}
      </div>
      <div className="flex items-center shrink-0 -my-1">
        {MAPPABLE.has(item.type) && (
          <button onClick={() => openMap(item.title + " " + (city || ""))} aria-label="地圖"
            className="text-sky-400 hover:text-sky-600 w-8 h-9 grid place-items-center"><MapIcon size={15} /></button>
        )}
        <button onClick={() => onEdit(item.id)} aria-label="編輯"
          className="text-rose-300 hover:text-rose-500 w-8 h-9 grid place-items-center"><Pencil size={14} /></button>
        <button onClick={() => onDelete(item)} aria-label="刪除"
          className="text-rose-200 hover:text-rose-500 w-8 h-9 grid place-items-center"><X size={15} /></button>
      </div>
    </div>
  );
}
