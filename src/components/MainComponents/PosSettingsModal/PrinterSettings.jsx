"use client";
import React, { useState, useEffect } from 'react';
import { FiPrinter, FiCheckCircle, FiLoader } from 'react-icons/fi';
import useApiHost from '../../../hooks/useApiHost';
import ModalSuccessNavToSelf from "../../Modals/ModalSuccessNavToSelf";

const ROWS = [
  { id: "new-transaction", label: "New Transaction", readKey: "printEscpos" },
  { id: "billing",         label: "Billing",         readKey: "printEscposBilling" },
  { id: "payment",         label: "Payment",         readKey: "printReceipt" },
  { id: "pos-reading",     label: "POS Reading",     readKey: "printEscposXzReading" },
  { id: "sales-per-item",  label: "Sales Per Item",  readKey: "printEscposSalesPerProduct" },
];

const defaultState = () =>
  Object.fromEntries(ROWS.map(r => [r.id, { name: "", type: "Bluetooth" }]));

const PrinterSettings = ({ isDark, accent = "#3b82f6" }) => {
  const apiHost = useApiHost();
  const [ports, setPorts] = useState(defaultState());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const bluetoothPorts = Array.from({ length: 10 }, (_, i) => `COM${i + 1}`);

  const fetchPrinters = async () => {
    try {
      setIsLoading(true);
      if (window.electronAPI?.readPrinterConfig) {
        const data = await window.electronAPI.readPrinterConfig();
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          setPorts(prev => {
            const next = { ...prev };
            ROWS.forEach(row => {
              const val = data[row.readKey];
              if (val) {
                next[row.id] = {
                name: val.replace("bt:", ""),
                type: (val.startsWith("bt:") || val.startsWith("COM")) ? "Bluetooth" : "LAN",
                };
              }
            });
            return next;
          });
        }
      }
    } catch (err) {
      console.error("Fetch printers error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPrinters(); }, []);

  const updatePort = (id, field, value) => {
    setPorts(prev => ({
      ...prev,
      [id]: field === "type"
        ? { ...prev[id], [field]: value, name: "" }
        : { ...prev[id], [field]: value },
    }));
  };

  const handleTestPrint = async (id) => {
    const p = ports[id];
    if (!p.name) {
      alert("Please select a COM Port or enter an IP before testing.");
      return;
    }
    try {
      if (window.electronAPI?.testPrinterConnection) {
        const res = await window.electronAPI.testPrinterConnection({
          printerName: p.name,
          printerType: p.type,
          content: "\x1b\x40\x1b\x61\x01\x0aHELLO FROM LIGHTEM POS\x0aTEST PRINT SUCCESSFUL\x0aPort: " + p.name + "\x0a\x0a\x0a\x0a\x1d\x56\x42\x00"
        });
        alert(res.success ? "Test print sent successfully to " + p.name : "Test print failed: " + res.message);
      } else {
        alert("This feature is only available in the Desktop App.");
      }
    } catch (err) {
      console.error("Test print error:", err);
      alert("Could not perform test print. Please check hardware connection.");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (window.electronAPI?.savePrinterConfig) {
        const p = ports;
        const configPayload = {};
        const fmt = (obj) => (obj.type === "Bluetooth" && obj.name) ? `bt:${obj.name}` : obj.name;

        if (p["new-transaction"].name) configPayload["printEscpos"] = fmt(p["new-transaction"]);
        if (p["billing"].name) {
          configPayload["printEscposDiscount"] = fmt(p["billing"]);
          configPayload["printEscposBilling"] = fmt(p["billing"]);
        }
        if (p["payment"].name) {
          configPayload["printEscpospospaymentreceipt"] = fmt(p["payment"]);
          configPayload["printReceipt"] = fmt(p["payment"]);
        }
        if (p["pos-reading"].name) configPayload["printEscposXzReading"] = fmt(p["pos-reading"]);
        if (p["sales-per-item"].name) configPayload["printEscposSalesPerProduct"] = fmt(p["sales-per-item"]);

        const res = await window.electronAPI.savePrinterConfig(configPayload);
        if (!res.success) throw new Error(res.message || "Save failed");

        await fetchPrinters();
        setIsSuccessModalOpen(true);
      } else {
        alert("This feature is only available in the Desktop App.");
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Error saving configuration: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const theme = {
    panel: isDark ? "bg-slate-900/40 border-white/5" : "bg-white border-slate-200 shadow-sm",
    panelSoft: isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200",
    input: isDark ? "bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-500" : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400",
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-slate-400" : "text-slate-500",
    textSoft: isDark ? "text-slate-500" : "text-slate-400",
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {isSuccessModalOpen && (
        <ModalSuccessNavToSelf
          header="Configuration Saved"
          message="Printer settings have been updated successfully."
          button="OK"
          setIsModalOpen={setIsSuccessModalOpen}
        />
      )}

      <div className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 lg:p-10 ${theme.panel}`}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-40px] right-[-40px] h-40 w-40 rounded-full blur-3xl opacity-20" style={{ backgroundColor: accent }} />
        </div>
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.24em] uppercase border border-current/10 bg-white/5">
            <FiPrinter size={12} style={{ color: accent }} />
            <span style={{ color: accent }}>Hardware Configuration</span>
          </div>
          <h2 className={`mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase ${theme.textPrimary}`}>
            Printer <span style={{ color: accent }}>Selection</span>
          </h2>
          <p className={`mt-3 text-sm max-w-2xl ${theme.textMuted}`}>
            Map specific document types to their dedicated hardware.
          </p>
        </div>
      </div>
      
      <div className={`rounded-[28px] border overflow-hidden ${theme.panel}`}>
        {isLoading ? (
          <div className={`p-20 text-center ${theme.textSoft} flex flex-col items-center gap-4`}>
            <FiLoader size={40} className="text-blue-500 animate-spin" />
            <p className="text-[11px] font-black uppercase tracking-widest">Fetching hardware profiles...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b ${isDark ? "border-white/5 bg-white/[0.02]" : "border-slate-100 bg-slate-50/50"}`}>
                  <th className={`p-6 text-[10px] font-black uppercase tracking-widest ${theme.textSoft}`}>Document Type</th>
                  <th className={`p-6 text-[10px] font-black uppercase tracking-widest ${theme.textSoft}`}>Printer Port</th>
                  <th className={`p-6 text-[10px] font-black uppercase tracking-widest ${theme.textSoft}`}>Connection Type</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? "divide-white/5" : "divide-slate-100"}`}>
                {ROWS.map(row => {
                  const p = ports[row.id];
                  return (
                    <tr key={row.id} className={`${isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50/50"} transition-colors`}>
                      <td className="p-6">
                        <span className={`text-sm font-black ${theme.textPrimary}`}>{row.label}</span>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2">
                          {p.type === "Bluetooth" ? (
                            <select
                              value={p.name}
                              onChange={e => updatePort(row.id, "name", e.target.value)}
                              className={`flex-1 px-4 py-3 rounded-xl border text-sm font-bold outline-none transition-all ${theme.input}`}
                            >
                              <option value="" disabled>Select Port</option>
                              {bluetoothPorts.map(port => (
                                <option key={port} value={port}>{port}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              placeholder="e.g. 192.168.1.100"
                              value={p.name}
                              onChange={e => updatePort(row.id, "name", e.target.value)}
                              className={`flex-1 px-4 py-3 rounded-xl border text-sm font-bold outline-none transition-all focus:ring-2 ${theme.input}`}
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => handleTestPrint(row.id)}
                            className="p-3 text-blue-500 transition-colors rounded-xl bg-blue-500/10 hover:bg-blue-500 hover:text-white"
                            title="Send Hello Test"
                          >
                            <FiPrinter size={16} />
                          </button>
                        </div>
                      </td>
                      <td className="p-6">
                        <select
                          value={p.type}
                          onChange={e => updatePort(row.id, "type", e.target.value)}
                          className={`w-full px-4 py-3 rounded-xl border text-sm font-bold outline-none cursor-pointer ${theme.input}`}
                        >
                          <option value="LAN">🌐 LAN / WiFi Network</option>
                          <option value="Bluetooth">📱 Bluetooth</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>         
        )}
      </div>
      <div className="flex justify-end gap-4 mt-6">
        <button
          onClick={() => fetchPrinters()}
          disabled={isSaving}
          className={`px-8 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] border ${theme.panelSoft} ${theme.textPrimary} disabled:opacity-50`}
        >
          Discard
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="px-10 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl transition-all active:scale-95"
          style={{ backgroundColor: accent, color: isDark ? "#0f172a" : "#ffffff" }}
        >
          <div className="flex items-center gap-2">
            {isSaving ? <FiLoader className="animate-spin" /> : <FiCheckCircle size={16} />}
            {isSaving ? "Saving..." : "Save Configuration"}
          </div>
        </button>
      </div>
    </div>
  );
};

export default PrinterSettings;