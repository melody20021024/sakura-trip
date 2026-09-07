import { useCallback, useEffect, useState } from "react";
import { Calendar, Wallet, ListChecks, Image as ImageIcon, Bookmark, Settings } from "lucide-react";
import { useTrip } from "./hooks/useTrip.js";
import { useConfirm } from "./hooks/useConfirm.js";
import { Header } from "./components/Header.jsx";
import { BottomNav } from "./components/BottomNav.jsx";
import { ConfirmSheet } from "./components/ConfirmSheet.jsx";
import { parseShareParams, stripShareParams } from "./lib/share.js";
import { TripView } from "./views/trip/TripView.jsx";
import { MoneyView } from "./views/money/MoneyView.jsx";
import { ListsView } from "./views/lists/ListsView.jsx";
import { AlbumView } from "./views/album/AlbumView.jsx";
import { PocketView } from "./views/places/PocketView.jsx";
import { SettingView } from "./views/setting/SettingView.jsx";

// 「口袋」 sits between 相簿 and 設定: the pocket is its own inbox with a
// lifecycle nothing like the checklists', and keeping 設定 in the rightmost slot
// preserves the muscle memory of the four tabs people already use (DDR-09).
const TABS = [
  { id: "trip", label: "行程", icon: Calendar },
  { id: "money", label: "帳本", icon: Wallet },
  { id: "lists", label: "清單", icon: ListChecks },
  { id: "album", label: "相簿", icon: ImageIcon },
  { id: "places", label: "口袋", icon: Bookmark },
  { id: "setting", label: "設定", icon: Settings },
];

// App shell: owns the active tab and wires the single useTrip source into the
// six views. All persistence/sync lives in useTrip (F-02/03/04).
export default function App() {
  const trip = useTrip();
  const { ask, confirmProps } = useConfirm();

  // F-83. Read before the first paint, so the ingest sheet opens already in the
  // right layout — the shortcut's link is usually an IG one, and deriving the
  // mode from it means the user never sees the wrong arrangement first.
  const [share, setShare] = useState(() => parseShareParams(window.location.search));
  const [tab, setTab] = useState(() => (share ? "places" : "trip"));

  // "Already used" has to live at the SAME level as the share itself. PocketView
  // is unmounted every time the user leaves the 口袋 tab, so a flag kept down
  // there resets on every return and reopens the sheet with a stale prefill —
  // once per mount instead of once per launch. Clearing it here is once, for
  // good: App outlives every tab switch.
  const consumeShare = useCallback(() => setShare(null), []);

  // Strip the params immediately. The address bar is what gets copied to invite
  // a travel companion; a leftover ?share= would pop the sheet open on their
  // device too (T-96). resolveTripKey's own replaceState keeps other params, so
  // running after it is safe.
  useEffect(() => { stripShareParams(); }, []);

  if (!trip.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <div className="text-rose-400 animate-pulse">🌸 載入中…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-rose-50 to-pink-100 text-rose-900 pb-24">
      <Header
        tripName={trip.data.tripName.v}
        travelerCount={(trip.data.travelers.v || []).length}
        syncState={trip.syncState}
        pending={trip.pending}
        onRetry={trip.retry}
      />
      <main className="max-w-2xl mx-auto px-4 py-4">
        {tab === "trip" && <TripView trip={trip} confirm={ask} />}
        {tab === "money" && <MoneyView trip={trip} confirm={ask} />}
        {tab === "lists" && <ListsView trip={trip} confirm={ask} />}
        {tab === "album" && <AlbumView trip={trip} confirm={ask} />}
        {tab === "places" && (
          <PocketView
            trip={trip}
            confirm={ask}
            onGoTab={setTab}
            initialShare={share}
            onShareConsumed={consumeShare}
          />
        )}
        {tab === "setting" && <SettingView trip={trip} />}
      </main>
      <BottomNav tabs={TABS} active={tab} onChange={setTab} />
      <ConfirmSheet {...confirmProps} />
    </div>
  );
}
