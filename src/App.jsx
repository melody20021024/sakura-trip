import { useState } from "react";
import { Calendar, Wallet, ListChecks, Image as ImageIcon, Settings } from "lucide-react";
import { useTrip } from "./hooks/useTrip.js";
import { useConfirm } from "./hooks/useConfirm.js";
import { Header } from "./components/Header.jsx";
import { BottomNav } from "./components/BottomNav.jsx";
import { ConfirmSheet } from "./components/ConfirmSheet.jsx";
import { TripView } from "./views/trip/TripView.jsx";
import { MoneyView } from "./views/money/MoneyView.jsx";
import { ListsView } from "./views/lists/ListsView.jsx";
import { AlbumView } from "./views/album/AlbumView.jsx";
import { SettingView } from "./views/setting/SettingView.jsx";

const TABS = [
  { id: "trip", label: "行程", icon: Calendar },
  { id: "money", label: "帳本", icon: Wallet },
  { id: "lists", label: "清單", icon: ListChecks },
  { id: "album", label: "相簿", icon: ImageIcon },
  { id: "setting", label: "設定", icon: Settings },
];

// App shell: owns the active tab and wires the single useTrip source into the
// five views. All persistence/sync lives in useTrip (F-02/03/04).
export default function App() {
  const trip = useTrip();
  const { ask, confirmProps } = useConfirm();
  const [tab, setTab] = useState("trip");

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
        {tab === "setting" && <SettingView trip={trip} />}
      </main>
      <BottomNav tabs={TABS} active={tab} onChange={setTab} />
      <ConfirmSheet {...confirmProps} />
    </div>
  );
}
