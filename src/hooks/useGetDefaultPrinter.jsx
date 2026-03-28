import { useEffect, useState } from "react";

const normalizePrinterName = (s) => String(s || "").trim();

export default function useGetDefaultPrinter() {
  const [printerName, setPrinterName] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Electron / EXE: read from main process
        if (window.appConfig?.getDefaultPrinterName) {
          const name = await window.appConfig.getDefaultPrinterName();
          console.log("Printer from Electron preload:", name);

          if (!cancelled) {
            setPrinterName(normalizePrinterName(name));
          }
          return;
        }

        // Browser / Vite dev fallback: read public/printer.txt
        const res = await fetch("./printer.txt", { cache: "no-store" });
        const txt = await res.text();

        console.log("Printer from fetch ./printer.txt:", txt);

        if (!cancelled) {
          setPrinterName(normalizePrinterName(txt));
        }
      } catch (error) {
        console.error("Failed to load default printer:", error);
        if (!cancelled) {
          setPrinterName("");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return printerName;
}
