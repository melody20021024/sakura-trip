import { useEffect, useState } from "react";

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

// C-29: transient confirmation of a write that just happened ("已排進 D2（6/11）")
// with an optional way to go look at it. Lives here rather than in its own file:
// this module is already where the small shared primitives go, and a 25-line
// component does not earn a name of its own in components/ (DDR-29).
//
// It is feedback, not a dialog — role="status", never takes focus. Mount one
// instance at the app root, the way ConfirmSheet is mounted.
export function Toast({ message, actionLabel, onAction, onDismiss }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!message) { setShown(false); return undefined; }
    // Two frames: mount transparent, then transition in. Done with utilities
    // rather than a keyframe so no CSS file or Tailwind config change is needed
    // for one 25-line component.
    const raf = requestAnimationFrame(() => setShown(true));
    // `message` in the deps so a second toast restarts the clock instead of
    // inheriting the remains of the first one's.
    const t = setTimeout(onDismiss, 1800);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); setShown(false); };
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 bottom-24 z-50 bg-rose-500 text-white text-xs rounded-full px-4 py-2 shadow-lg flex items-center gap-2 transition-all duration-200 ease-out motion-reduce:transition-none ${
        shown ? "opacity-100 -translate-x-1/2 translate-y-0" : "opacity-0 -translate-x-1/2 translate-y-2"
      }`}
    >
      <span>{message}</span>
      {actionLabel && onAction && (
        <button onClick={onAction} className="underline shrink-0">{actionLabel}</button>
      )}
    </div>
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
