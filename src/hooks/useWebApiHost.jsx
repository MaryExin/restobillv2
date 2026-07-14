import { useEffect, useState } from "react";
import { parseIpConfigText } from "../utils/parseIpConfig";

const normalizeHost = (s) =>
  String(s || "")
    .trim()
    .replace(/\/+$/, "");

export default function useWebApiHost() {
  const [webApiHost, setWebApiHost] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // ✅ EXE: read editable resources/ip.txt (WEB line) via Electron preload
        if (window.appConfig?.getWebApiHost) {
          const host = await window.appConfig.getWebApiHost();
          if (!cancelled) setWebApiHost(normalizeHost(host));
          return;
        }

        // ✅ Browser dev: read from public/ip.txt (served by Vite)
        const res = await fetch("./ip.txt", { cache: "no-store" });
        const txt = await res.text();
        const map = parseIpConfigText(txt);
        if (!cancelled) setWebApiHost(normalizeHost(map.WEB));
      } catch (e) {
        if (!cancelled) setWebApiHost("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return webApiHost;
}
