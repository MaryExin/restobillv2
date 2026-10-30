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
    let restartTimer;
    let settingsController;
    let backupController;
    let backupInProgress = false;

    // Mapping para sa milliseconds
    const freqMapMs = {
      "1m": 60000,
      "30m": 1800000,
      "1h": 3600000,
      "2h": 7200000,
    };

    const performSilentBackup = async () => {
      // A slow export must finish before another scheduled export can start.
      if (cancelled || backupInProgress) return;
      backupInProgress = true;
      backupController = new AbortController();

      try {
        const apiBase = normalizePosApiHost(
          localStorage.getItem("apiendpoint") || "http://localhost",
        );
        const res = await fetch(
          `${apiBase}/api/pos_db_backup_api.php?action=scheduled_export`,
          {
            method: "POST",
            headers: backupHeaders(),
            signal: backupController.signal,
          },
        );
        const data = await res.json();

        if (!cancelled && data.status === "success") {
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
        if (!cancelled && err.name !== "AbortError") {
          console.error("⚠️ Auto-sync failed. Server might be offline.");
        }
      } finally {
        backupInProgress = false;
        backupController = null;
      }
    };

    const initSync = async () => {
      if (cancelled) return;
      settingsController?.abort();
      const controller = new AbortController();
      settingsController = controller;

      try {
        const apiBase = normalizePosApiHost(
          localStorage.getItem("apiendpoint") || "http://localhost",
        );
        const res = await fetch(
          `${apiBase}/api/pos_db_backup_api.php?action=get_settings`,
          { headers: backupHeaders(), signal: controller.signal },
        );
        const data = await res.json();
        if (cancelled || controller.signal.aborted) return;

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
        if (cancelled || controller.signal.aborted) return;
        console.error("Could not initialize sync settings.");
      }

      if (!cancelled) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(initSync, 30_000);
      }
    };

    const restartSync = (event) => {
      // Unrelated preferences and cashier data must not reset the backup timer.
      // Synthetic storage events (without a key) still refresh authentication.
      if (
        event.key != null &&
        event.key !== "apiendpoint" &&
        event.key !== "access_token"
      ) {
        return;
      }
      clearInterval(backupTimer);
      clearTimeout(retryTimer);
      clearTimeout(restartTimer);
      settingsController?.abort();
      restartTimer = setTimeout(initSync, 150);
    };

    initSync();
    window.addEventListener("storage", restartSync);

    return () => {
      cancelled = true;
      clearInterval(backupTimer);
      clearTimeout(retryTimer);
      clearTimeout(restartTimer);
      settingsController?.abort();
      backupController?.abort();
      window.removeEventListener("storage", restartSync);
    };
  }, []);

  return null;
};

export default GlobalSync;
