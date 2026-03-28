import { useEffect, useState } from "react";

const normalizeHost = (s) =>
  String(s || "")
    .trim()
    .replace(/\/+$/, "");

export default function useApiHost() {
  const [apiHost, setApiHost] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // ✅ EXE: read editable resources/ip.txt via Electron preload
        if (window.appConfig?.getApiHost) {
          const host = await window.appConfig.getApiHost();
          if (!cancelled) setApiHost(normalizeHost(host));
          return;
        }

        // ✅ Browser dev: read from public/ip.txt (served by Vite)
        const res = await fetch("./ip.txt", { cache: "no-store" });
        const txt = await res.text();
        if (!cancelled) setApiHost(normalizeHost(txt));
      } catch (e) {
        // No fallback (you asked “just from ip.txt”)
        // But at least keep it empty so you can detect and show message.
        if (!cancelled) setApiHost("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return apiHost;
}
