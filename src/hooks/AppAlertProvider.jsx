import React, { useEffect, useState } from "react";

const AppAlertProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleAlert = (e) => {
      setMessage(e.detail?.message || "");
      setOpen(true);
    };

    window.addEventListener("app-alert", handleAlert);

    return () => {
      window.removeEventListener("app-alert", handleAlert);
    };
  }, []);

  return (
    <>
      {children}

      {open && (
        <div className="fixed inset-0 z-[110000] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-3 text-lg font-bold text-slate-800">Notice</h2>

            <p className="mb-6 text-sm text-slate-600 whitespace-pre-wrap break-words">
              {message}
            </p>

            <div className="flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl bg-yellow-400 px-5 py-2 font-semibold text-slate-900 hover:opacity-90"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AppAlertProvider;
