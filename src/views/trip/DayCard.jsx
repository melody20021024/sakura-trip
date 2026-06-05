import { useState } from "react";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Trash2, BedDouble } from "lucide-react";
import { Card } from "../../components/ui.jsx";
import { liveItems } from "../../lib/merge.js";
import { ItemRow } from "./ItemRow.jsx";
import { ItemForm } from "./ItemForm.jsx";

// C-07: a single day. Owns the dnd context for its items (F-12).
export function DayCard({ day, idx, trip, confirm }) {
  const [open, setOpen] = useState(false);
  const [it, setIt] = useState({ time: "", title: "", type: "spot", note: "" });
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const items = liveItems(day.items).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const ids = items.map((i) => i.id);
  const dateLabel = new Date(day.date + "T00:00").toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "short" });

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id));
    trip.reorderItems(day.id, next);
  };

  const addItem = () => { if (!it.title) return; trip.addItem(day.id, it); setIt({ time: "", title: "", type: "spot", note: "" }); setOpen(false); };
  const startEdit = (id) => { const i = items.find((x) => x.id === id); setEditId(id); setDraft({ time: i.time || "", title: i.title, type: i.type, note: i.note || "" }); };
  const saveEdit = () => { if (!draft.title) return; trip.updateItem(day.id, editId, draft); setEditId(null); setDraft(null); };
  const delItem = async (item) => { if (await confirm(`確定刪除「${item.title}」?`)) trip.deleteItem(day.id, item.id); };
  const delDay = async () => { if (await confirm(`確定刪除 ${dateLabel} 一整天?`)) trip.deleteDay(day.id); };

  return (
    <Card className="!p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="bg-rose-400 text-white text-xs rounded-full w-7 h-7 flex items-center justify-center shrink-0">D{idx + 1}</span>
        <span className="font-medium text-sm">{dateLabel}</span>
        <span className="flex-1" />
        <button onClick={() => setOpen((s) => !s)} aria-label="新增項目" className="text-rose-400 w-9 h-9 grid place-items-center -my-1"><Plus size={18} /></button>
        <button onClick={delDay} aria-label="刪除這天" className="text-rose-300 hover:text-rose-500 w-9 h-9 grid place-items-center -my-1"><Trash2 size={15} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input value={day.city?.v || ""} onChange={(e) => trip.setDayField(day.id, "city", e.target.value)} placeholder="城市/區域"
          onFocus={() => trip.focusField(`day:${day.id}:city`)} onBlur={trip.blurField}
          className="bg-pink-50 border border-pink-100 rounded-lg px-2 py-1.5 text-xs text-rose-700 placeholder-rose-300 focus:outline-none" />
        <div className="flex items-center gap-1 bg-pink-50 border border-pink-100 rounded-lg px-2">
          <BedDouble size={13} className="text-rose-300 shrink-0" />
          <input value={day.lodging?.v || ""} onChange={(e) => trip.setDayField(day.id, "lodging", e.target.value)} placeholder="今晚住宿"
            onFocus={() => trip.focusField(`day:${day.id}:lodging`)} onBlur={trip.blurField}
            className="bg-transparent py-1.5 text-xs text-rose-700 placeholder-rose-300 focus:outline-none w-full" />
        </div>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {items.map((i) =>
              editId === i.id ? (
                <ItemForm key={i.id} value={draft} onChange={setDraft} onSave={saveEdit} onCancel={() => { setEditId(null); setDraft(null); }} saveLabel="儲存" />
              ) : (
                <ItemRow key={i.id} item={i} city={day.city} onEdit={startEdit} onDelete={delItem} />
              )
            )}
          </div>
        </SortableContext>
      </DndContext>
      {open && <div className="mt-2"><ItemForm value={it} onChange={setIt} onSave={addItem} onCancel={() => setOpen(false)} /></div>}
    </Card>
  );
}
