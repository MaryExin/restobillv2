"use client";
import { useEffect } from "react";
import { normalizePosApiHost } from "../../utils/posRoleFetch";

const backupHeaders = () => {
  const headers = new Headers({ Accept: "application/json" });
  const token = localStorage.getItem("access_token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
};

const GlobalSync = () => {
  useEffect(() => {
    let cancelled = false;
    let backupTimer;
    let retryTimer;

    // Mapping para sa milliseconds
    const freqMapMs = {
      "1m": 60000,
      "30m": 1800000,
      "1h": 3600000,
      "2h": 7200000,
    };

    const performSilentBackup = async () => {
      try {
        const apiBase = normalizePosApiHost(
          localStorage.getItem("apiendpoint") || "http://localhost",
        );
        const res = await fetch(
          `${apiBase}/api/pos_db_backup_api.php?action=scheduled_export`,
          { method: "POST", headers: backupHeaders() },
        );
        const data = await res.json();

        if (data.status === "success") {
          const now = new Date().toLocaleTimeString();
          console.log("🛠️ CNC-STA MARIA: Auto-sync successful at " + now);

          // I-broadcast ang event para marinig ng Modal
          window.dispatchEvent(
            new CustomEvent("backup-completed", {
              detail: { time: now },
            }),
          );
        }
      } catch (err) {
        console.error("⚠️ Auto-sync failed. Server might be offline.");
      }
    };

    const initSync = async () => {
      try {
        const apiBase = normalizePosApiHost(
          localStorage.getItem("apiendpoint") || "http://localhost",
        );
        const res = await fetch(
          `${apiBase}/api/pos_db_backup_api.php?action=get_settings`,
          { headers: backupHeaders() },
        );
        const data = await res.json();

        if (data.status === "success") {
          const intervalMs = freqMapMs[data.frequency] || 3600000;
          console.log(
            `🚀 Background Sync started. Frequency: ${data.frequency}`,
          );

          if (!cancelled) {
            clearInterval(backupTimer);
            backupTimer = setInterval(performSilentBackup, intervalMs);
          }
          return;
        }
      } catch (e) {
        console.error("Could not initialize sync settings.");
      }

      if (!cancelled) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(initSync, 30_000);
      }
    };

    const restartSync = () => {
      clearInterval(backupTimer);
      clearTimeout(retryTimer);
      initSync();
    };

    initSync();
    window.addEventListener("storage", restartSync);

    return () => {
      cancelled = true;
      clearInterval(backupTimer);
      clearTimeout(retryTimer);
      window.removeEventListener("storage", restartSync);
    };
  }, []);

  return null;
};

export default GlobalSync;
