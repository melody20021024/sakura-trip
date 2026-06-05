// C-12: shows sync state with colour + text (dual-encoded for accessibility).
// Click to retry when failed. Contract: ui-spec §7.
const MAP = {
  synced: { dot: "bg-emerald-400", box: "bg-emerald-50 text-emerald-600", label: "已同步" },
  syncing: { dot: "bg-amber-400", box: "bg-amber-50 text-amber-600", label: "同步中…", pulse: true },
  offline: { dot: "bg-amber-400", box: "bg-amber-50 text-amber-600", label: "離線" },
  failed: { dot: "bg-rose-500", box: "bg-rose-50 text-rose-600", label: "失敗·重試" },
};

export function SyncStatusBadge({ state, pending = 0, onRetry }) {
  const m = MAP[state] || MAP.syncing;
  const label = state === "offline" && pending ? `離線·${pending}` : m.label;
  return (
    <button
      role="status"
      aria-live="polite"
      aria-label={`同步狀態：${label}`}
      onClick={state === "failed" ? onRetry : undefined}
      className={`text-[11px] rounded-full px-2 py-1 flex items-center gap-1 shrink-0 ${m.box}`}
    >
      <span className={`w-2 h-2 rounded-full ${m.dot} ${m.pulse ? "animate-pulse" : ""}`} />
      {label}
    </button>
  );
}
