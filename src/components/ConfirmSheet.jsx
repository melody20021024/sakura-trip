// C-16: bottom-sheet delete confirmation (DDR-06). Driven by useConfirm.
export function ConfirmSheet({ open, message, confirmLabel = "刪除", onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl p-5 max-w-2xl mx-auto"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}>
        <div className="text-center font-medium mb-1 text-rose-900">{message}</div>
        <div className="text-center text-xs text-rose-400 mb-4">刪除後旅伴端也會一併移除,無法復原</div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 border border-pink-200 text-rose-400 rounded-xl py-2.5">取消</button>
          <button onClick={onConfirm} className="flex-1 bg-rose-500 text-white rounded-xl py-2.5">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
