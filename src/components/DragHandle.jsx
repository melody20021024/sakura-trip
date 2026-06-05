import { GripVertical } from "lucide-react";

// C-15: drag handle for sortable rows. listeners/attributes come from
// @dnd-kit's useSortable in the parent. 44px hit area.
export function DragHandle({ listeners, attributes, className = "" }) {
  return (
    <button
      type="button"
      aria-label="拖曳排序"
      className={`text-rose-300 hover:text-rose-400 touch-none cursor-grab active:cursor-grabbing w-6 h-11 -my-1 grid place-items-center shrink-0 ${className}`}
      {...listeners}
      {...attributes}
    >
      <GripVertical size={16} />
    </button>
  );
}
