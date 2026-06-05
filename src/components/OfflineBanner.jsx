// C-17: thin amber strip under the header while offline.
export function OfflineBanner({ show, pending = 0 }) {
  if (!show) return null;
  return (
    <div className="bg-amber-100 text-amber-700 text-xs text-center py-1">
      📴 離線中{pending ? `・${pending} 筆待同步` : ""}
    </div>
  );
}
