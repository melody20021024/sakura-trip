import { useState } from "react";
import { Image as ImageIcon, Plus, ExternalLink, Trash2 } from "lucide-react";
import { Card, SectionTitle, Field, PinkBtn } from "../../components/ui.jsx";
import { liveItems } from "../../lib/merge.js";

// P-04. Shared-album links (F-40, carried over from v1). Photo upload is Phase 2.
export function AlbumView({ trip, confirm }) {
  const albums = liveItems(trip.data.albums);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  const add = () => {
    if (!url) return;
    let u = url.trim();
    if (!/^https?:\/\//.test(u)) u = "https://" + u;
    trip.addAlbum({ label: label || "共享相簿", url: u });
    setLabel(""); setUrl("");
  };
  const del = async (a) => { if (await confirm(`確定刪除「${a.label}」?`)) trip.deleteAlbum(a.id); };

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon={ImageIcon}>共享相簿連結</SectionTitle>
        <p className="text-xs text-rose-400 mb-3">貼上 Google 相簿 / iCloud 共享相簿連結,旅伴點開即可一起看。</p>
        <div className="space-y-2">
          <Field placeholder="相簿名稱,例:Day1 由布院" value={label} onChange={(e) => setLabel(e.target.value)} />
          <div className="flex gap-2">
            <Field placeholder="貼上相簿連結" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
            <PinkBtn onClick={add} className="shrink-0"><Plus size={16} /></PinkBtn>
          </div>
        </div>
      </Card>
      {albums.map((a) => (
        <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block">
          <Card className="flex items-center gap-3 hover:bg-pink-50">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-200 to-rose-300 flex items-center justify-center text-white shrink-0"><ImageIcon size={22} /></div>
            <div className="flex-1 min-w-0"><div className="text-sm font-medium">{a.label}</div><div className="text-xs text-rose-300 truncate">{a.url}</div></div>
            <ExternalLink size={16} className="text-rose-300" />
            <button onClick={(ev) => { ev.preventDefault(); del(a); }} aria-label="刪除" className="text-rose-200 hover:text-rose-500"><Trash2 size={16} /></button>
          </Card>
        </a>
      ))}
    </div>
  );
}
