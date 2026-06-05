import { Users } from "lucide-react";
import { SyncStatusBadge } from "./SyncStatusBadge.jsx";
import { OfflineBanner } from "./OfflineBanner.jsx";

// Sticky app header (C-12 lives here per DDR-02). Safe-area aware.
export function Header({ tripName, travelerCount, syncState, pending, onRetry }) {
  return (
    <header
      className="sticky top-0 z-20 bg-white/70 backdrop-blur border-b border-pink-100"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
        <span className="text-2xl">🌸</span>
        <h1 className="text-lg font-bold text-rose-500 truncate flex-1">{tripName}</h1>
        <SyncStatusBadge state={syncState} pending={pending} onRetry={onRetry} />
        <span className="text-xs text-rose-300 flex items-center gap-1">
          <Users size={13} /> {travelerCount}
        </span>
      </div>
      <OfflineBanner show={syncState === "offline"} pending={pending} />
    </header>
  );
}
