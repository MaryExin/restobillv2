import { lazy, Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Load a dialog only when requested, then preserve its form state across closes.
export default function lazyDialog(load, openProp = "isOpen") {
  const Dialog = lazy(load);

  return function LazyDialog(props) {
    const open = Boolean(props[openProp]);
    const [hasOpened, setHasOpened] = useState(open);

    useEffect(() => {
      if (open) setHasOpened(true);
    }, [open]);

    if (!open && !hasOpened) return null;

    return (
      <Suspense
        fallback={
          open
            ? createPortal(
                <div className="fixed inset-0 z-[300000] flex items-center justify-center bg-black/40 p-4">
                  <div
                    className="rounded-2xl p-6 font-[Poppins-Regular] shadow-xl"
                    style={{
                      backgroundColor: "var(--color-darkPrimary, #fff)",
                      color: "var(--color-lighter, #111827)",
                    }}
                  >
                    <p role="status" aria-live="polite">
                      Loading…
                    </p>
                    {props.onClose && (
                      <button
                        type="button"
                        onClick={props.onClose}
                        className="mt-4 rounded-lg px-4 py-2 font-[Poppins-Medium] text-white"
                        style={{
                          backgroundColor: "var(--color-brandPrimary, #2563eb)",
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>,
                document.body,
              )
            : null
        }
      >
        <Dialog {...props} />
      </Suspense>
    );
  };
}
