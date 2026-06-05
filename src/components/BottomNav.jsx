// C-05: fixed bottom tab bar. Each target is >=44px tall. Safe-area aware.
export function BottomNav({ tabs, active, onChange }) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-20 bg-white/90 backdrop-blur border-t border-pink-100"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-2xl mx-auto grid grid-cols-5">
        {tabs.map((t) => {
          const Ico = t.icon;
          const on = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              aria-label={t.label}
              aria-current={on ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2.5 ${on ? "text-rose-500" : "text-rose-300"}`}
            >
              <Ico size={20} />
              <span className="text-[11px]">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
