import { useCallback, useState } from "react";

// Promise-based confirm. `ask(message)` resolves true/false; spread
// `confirmProps` onto a <ConfirmSheet/> rendered once at the app root.
export function useConfirm() {
  const [state, setState] = useState({ open: false, message: "", resolve: null });

  const ask = useCallback(
    (message) => new Promise((resolve) => setState({ open: true, message, resolve })),
    []
  );

  const close = (result) =>
    setState((s) => {
      s.resolve?.(result);
      return { open: false, message: "", resolve: null };
    });

  return {
    ask,
    confirmProps: {
      open: state.open,
      message: state.message,
      onCancel: () => close(false),
      onConfirm: () => close(true),
    },
  };
}
