import { useEffect, useState } from "react";
import { parseIpConfigText } from "../utils/parseIpConfig";

const normalizeHost = (s) =>
  String(s || "")
    .trim()
    .replace(/\/+$/, "");

let cachedApiHost;
let apiHostPromise = null;

const loadApiHost = () => {
  if (cachedApiHost !== undefined) {
    return Promise.resolve(cachedApiHost);
  }

  if (apiHostPromise) return apiHostPromise;

  apiHostPromise = (async () => {
    try {
      // EXE: read editable resources/ip.txt via Electron preload.
      if (window.appConfig?.getApiHost) {
        cachedApiHost = normalizeHost(await window.appConfig.getApiHost());
        return cachedApiHost;
      }

      // Browser dev: read public/ip.txt once per renderer lifetime.
      const res = await fetch("./ip.txt", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load ip.txt (${res.status}).`);

      const txt = await res.text();
      const map = parseIpConfigText(txt);
      cachedApiHost = normalizeHost(map.LOCAL || txt);
    } catch {
      // Cache the empty result too so every hook consumer does not retry.
      cachedApiHost = "";
    }

    return cachedApiHost;
  })().finally(() => {
    apiHostPromise = null;
  });

  return apiHostPromise;
};

export default function useApiHost() {
  const [apiHost, setApiHost] = useState(() => cachedApiHost ?? "");

  useEffect(() => {
    let cancelled = false;

    loadApiHost().then((host) => {
      if (!cancelled) setApiHost(host);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return apiHost;
}
