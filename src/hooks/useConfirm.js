import { useCallback, useState } from "react";

// Promise-based confirm. `ask(message)` resolves true/false; spread
// `confirmProps` onto a <ConfirmSheet/> rendered once at the app root.
//
// `ask(message, opts)` forwards { subtitle, confirmLabel } to the sheet. Without
// this second argument the new `subtitle` prop would be unreachable: every call
// goes through here, not through the component directly. Omitting `opts` keeps
// the previous behaviour exactly — the sheet falls back to its defaults.
export function useConfirm() {
  const [state, setState] = useState({ open: false, message: "", opts: {}, resolve: null });

  const ask = useCallback(
    (message, opts = {}) => new Promise((resolve) => setState({ open: true, message, opts, resolve })),
    []
  );

  const close = (result) =>
    setState((s) => {
      s.resolve?.(result);
      return { open: false, message: "", opts: {}, resolve: null };
    });

  return {
    ask,
    confirmProps: {
      open: state.open,
      message: state.message,
      // Reset to {} on close, so the next ask() without opts gets the defaults
      // back rather than inheriting the previous sheet's wording.
      ...state.opts,
      onCancel: () => close(false),
      onConfirm: () => close(true),
    },
  };
}
