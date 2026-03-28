import { useEffect, useState } from "react";

const normalizePrinterName = (s) => String(s || "").trim();

export default function useGetDefaultPrinter() {
  const [printerName, setPrinterName] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // ✅ EXE: read editable resources/printer.txt via Electron preload
        if (window.appConfig?.getPrinterName) {
          const name = await window.appConfig.getPrinterName();
          if (!cancelled) setPrinterName(normalizePrinterName(name));
          return;
        }

        // ✅ Browser dev: read from public/printer.txt
        const res = await fetch("./printer.txt", { cache: "no-store" });
        const txt = await res.text();

        if (!cancelled) setPrinterName(normalizePrinterName(txt));
      } catch (e) {
        if (!cancelled) setPrinterName("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return printerName;
}
