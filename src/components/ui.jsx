// Presentational primitives (C-01~04), extracted verbatim from v1 so the look
// is unchanged.
export function Card({ children, className = "" }) {
  return (
    <div className={`bg-white/80 rounded-2xl border border-pink-100 shadow-sm p-4 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ icon: Icon, children, right }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon size={18} className="text-rose-400" />}
      <h2 className="font-bold text-rose-500 flex-1">{children}</h2>
      {right}
    </div>
  );
}

export function PinkBtn({ children, onClick, className = "", ...rest }) {
  return (
    <button
      onClick={onClick}
      className={`bg-rose-400 hover:bg-rose-500 text-white rounded-xl px-4 py-2 text-sm font-medium ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Field(props) {
  return (
    <input
      {...props}
      className={`w-full bg-pink-50 border border-pink-100 rounded-xl px-3 py-2 text-sm text-rose-900 placeholder-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200 ${props.className || ""}`}
    />
  );
}
