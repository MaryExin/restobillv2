"use client";
import { useEffect } from "react";

const GlobalSync = () => {
  useEffect(() => {
    // Mapping para sa milliseconds
    const freqMapMs = { 
      "1m": 60000, 
      "30m": 1800000, 
      "1h": 3600000, 
      "2h": 7200000 
    };

    const performSilentBackup = async () => {
      try {
        const res = await fetch("http://localhost/api/pos_db_backup_api.php?action=immediate_export");
        const data = await res.json();
        
        if (data.status === "success") {
          const now = new Date().toLocaleTimeString();
          console.log("🛠️ CNC-STA MARIA: Auto-sync successful at " + now);
          
          // I-broadcast ang event para marinig ng Modal
          window.dispatchEvent(new CustomEvent("backup-completed", { 
            detail: { time: now } 
          }));
        }
      } catch (err) {
        console.error("⚠️ Auto-sync failed. Server might be offline.");
      }
    };

    const initSync = async () => {
      try {
        const res = await fetch("http://localhost/api/pos_db_backup_api.php?action=get_settings");
        const data = await res.json();
        
        if (data.status === "success") {
          const intervalMs = freqMapMs[data.frequency] || 3600000;
          console.log(`🚀 Background Sync started. Frequency: ${data.frequency}`);
          
          const timer = setInterval(performSilentBackup, intervalMs);
          return () => clearInterval(timer);
        }
      } catch (e) {
        console.error("Could not initialize sync settings.");
      }
    };

    initSync();
  }, []);

  return null; 
};

export default GlobalSync;