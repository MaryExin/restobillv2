"use client";
import React, { useState, useEffect } from 'react';
import { FiPrinter, FiCheckCircle, FiLoader, FiSearch, FiX } from 'react-icons/fi';
import useApiHost from '../../../hooks/useApiHost';
import ModalSuccessNavToSelf from "../../Modals/ModalSuccessNavToSelf";

const OTHER_ROWS = [
  { id: "duplicate",      label: "Duplicate Order", readKey: "printEscposDuplicate" },
  { id: "billing",        label: "Billing",          readKey: "printEscposBilling" },
  { id: "payment",        label: "Payment",           readKey: "printReceipt" },
  { id: "pos-reading",    label: "POS Reading",       readKey: "printEscposXzReading" },
  { id: "sales-per-item", label: "Sales Per Item",    readKey: "printEscposSalesPerProduct" },
  { id: "qr-code",        label: "QR Code Print",     readKey: "printEscPosQr" },
];

const defaultOtherPorts = () =>
  Object.fromEntries(OTHER_ROWS.map((r) => [r.id, { name: "", type: "Bluetooth" }]));

const BT_PORTS = Array.from({ length: 10 }, (_, i) => `COM${i + 1}`);

const PrinterSettings = ({ isDark, accent = "#3b82f6" }) => {
  const apiHost = useApiHost();

  const [ports, setPorts] = useState(defaultOtherPorts());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // New-transaction category routing state
  const [btName, setBtName] = useState("");
  const [lanName, setLanName] = useState("");
  const [usbNewTxName, setUsbNewTxName] = useState("");
  // { "BEVERAGES": "bt" | "lan" | "usb" | "" }
  const [categoryRoutes, setCategoryRoutes] = useState({});
  const [categoryOptions, setCategoryOptions] = useState([]);

  // System printer list (for USB dropdown)
  const [systemPrinters, setSystemPrinters] = useState([]);

  // Scan state: { [key]: { loading, results, open } }
  const [scanState, setScanState] = useState({});

  // QR label / language settings (mirrors printer.txt qr_* keys)
  const [qrLanguage, setQrLanguage] = useState("escpos");
  const [qrSize, setQrSize] = useState(8);
  const [qrLabelWidth, setQrLabelWidth] = useState(60);
  const [qrLabelHeight, setQrLabelHeight] = useState(40);
  const [qrGapMm, setQrGapMm] = useState(2);
  const [qrX, setQrX] = useState(250);
  const [qrY, setQrY] = useState(70);
  const [qrTextX, setQrTextX] = useState(15);
  const [qrTextY, setQrTextY] = useState(1);

  // ── fetch categories from backend ──────────────────────────────────
  useEffect(() => {
    if (!apiHost) return;
    fetch(`${apiHost}/api/category_list.php`)
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json)) {
          setCategoryOptions(
            json.map((row) => String(row.item_category || "").trim()).filter(Boolean),
          );
        }
      })
      .catch((err) => console.error("Failed to fetch categories:", err));
  }, [apiHost]);

  // ── fetch printer config ───────────────────────────────────────────
  const fetchPrinters = async () => {
    try {
      setIsLoading(true);

      if (window.electronAPI?.readPrinterConfig) {
        const data = await window.electronAPI.readPrinterConfig();
        if (data && typeof data === "object") {
          setPorts((prev) => {
            const next = { ...prev };
            OTHER_ROWS.forEach((row) => {
              const val = data[row.readKey];
              if (val) {
                let type = "LAN";
                let name = val;
                if (val.startsWith("bt:"))       { type = "Bluetooth"; name = val.slice(3); }
                else if (val.startsWith("COM"))   { type = "Bluetooth"; }
                else if (val.startsWith("windows:")) { type = "USB"; name = val.slice(8); }
                else if (val.startsWith("usb:"))  { type = "USB"; name = ""; }
                next[row.id] = { name, type };
              }
            });
            return next;
          });

          // Hydrate QR-specific settings
          if (data["qr_language"]) setQrLanguage(data["qr_language"]);
          if (data["qr_size"] !== undefined) setQrSize(Number(data["qr_size"]) || 8);
          if (data["qr_label_width_mm"] !== undefined) setQrLabelWidth(Number(data["qr_label_width_mm"]) || 60);
          if (data["qr_label_height_mm"] !== undefined) setQrLabelHeight(Number(data["qr_label_height_mm"]) || 40);
          if (data["qr_gap_mm"] !== undefined) setQrGapMm(Number(data["qr_gap_mm"]) || 2);
          if (data["qr_x"] !== undefined) setQrX(Number(data["qr_x"]) || 250);
          if (data["qr_y"] !== undefined) setQrY(Number(data["qr_y"]) || 70);
          if (data["qr_text_x"] !== undefined) setQrTextX(Number(data["qr_text_x"]) || 15);
          if (data["qr_text_y"] !== undefined) setQrTextY(Number(data["qr_text_y"]) || 1);
        }
      }

      if (window.electronAPI?.readPrinterCategories) {
        const catConfig = await window.electronAPI.readPrinterCategories();
        const bt  = catConfig?.newTransaction?.bluetooth || {};
        const lan = catConfig?.newTransaction?.lan       || {};
        const usb = catConfig?.newTransaction?.usb       || {};

        setBtName(bt.connection ? bt.connection.replace("bt:", "") : "");
        setLanName(lan.connection || "");
        setUsbNewTxName(usb.connection ? usb.connection.replace("windows:", "") : "");

        const routes = {};
        (Array.isArray(bt.categories)  ? bt.categories  : []).forEach(
          (c) => { routes[String(c).toUpperCase().trim()] = "bt"; },
        );
        (Array.isArray(lan.categories) ? lan.categories : []).forEach(
          (c) => { routes[String(c).toUpperCase().trim()] = "lan"; },
        );
        (Array.isArray(usb.categories) ? usb.categories : []).forEach(
          (c) => { routes[String(c).toUpperCase().trim()] = "usb"; },
        );
        setCategoryRoutes(routes);
      }

      if (window.electronAPI?.getPrinters) {
        const list = await window.electronAPI.getPrinters();
        setSystemPrinters(Array.isArray(list) ? list.map((p) => p.name || p.displayName).filter(Boolean) : []);
      }
    } catch (err) {
      console.error("Fetch printers error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPrinters(); }, []);

  // ── helpers ────────────────────────────────────────────────────────
  const updatePort = (id, field, value) =>
    setPorts((prev) => ({
      ...prev,
      [id]:
        field === "type"
          ? { ...prev[id], [field]: value, name: "" }
          : { ...prev[id], [field]: value },
    }));

  const setRoute = (category, slot) =>
    setCategoryRoutes((prev) => ({ ...prev, [category]: slot }));

  const handleTestPrint = async (printerName, printerType) => {
    if (!printerName) {
      alert("Please configure the port/IP before testing.");
      return;
    }
    try {
      if (window.electronAPI?.testPrinterConnection) {
        const res = await window.electronAPI.testPrinterConnection({
          printerName,
          printerType,
          content:
            "\x1b\x40\x1b\x61\x01\x0aHELLO FROM LIGHTEM POS\x0aTEST PRINT SUCCESSFUL\x0aPort: " +
            printerName +
            "\x0a\x0a\x0a\x0a\x1d\x56\x42\x00",
        });
        alert(
          res.success
            ? `Test print sent to ${printerName}`
            : `Test failed: ${res.message}`,
        );
      } else {
        alert("Only available in the Desktop App.");
      }
    } catch (err) {
      alert("Could not perform test print.");
    }
  };

  // ── scan ───────────────────────────────────────────────────────────
  const closeScan = (key) =>
    setScanState((prev) => ({ ...prev, [key]: { ...prev[key], open: false } }));

  const handleScan = async (key, type) => {
    setScanState((prev) => ({ ...prev, [key]: { loading: true, results: [], open: false } }));
    try {
      let results = [];
      if (type === "Bluetooth") {
        results = (await window.electronAPI?.scanComPorts?.()) || [];
      } else if (type === "LAN") {
        results = (await window.electronAPI?.scanLanPrinters?.()) || [];
      } else if (type === "USB") {
        const list = (await window.electronAPI?.getPrinters?.()) || [];
        results = list.map((p) => p.name || p.displayName).filter(Boolean);
        setSystemPrinters(results);
      }
      setScanState((prev) => ({ ...prev, [key]: { loading: false, results, open: true } }));
    } catch {
      setScanState((prev) => ({ ...prev, [key]: { loading: false, results: [], open: true } }));
    }
  };

  // ── save ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const fmt = (obj) => {
        if (obj.type === "Bluetooth" && obj.name) return `bt:${obj.name}`;
        if (obj.type === "USB" && obj.name) return `windows:${obj.name}`;
        if (obj.type === "USB") return "usb:auto";
        return obj.name;
      };

      if (window.electronAPI?.savePrinterConfig) {
        const p = ports;
        const cfg = {};
        if (p["duplicate"].name || p["duplicate"].type === "USB")
          cfg["printEscposDuplicate"] = fmt(p["duplicate"]);
        if (p["billing"].name) {
          cfg["printEscposDiscount"] = fmt(p["billing"]);
          cfg["printEscposBilling"] = fmt(p["billing"]);
        }
        if (p["payment"].name) {
          cfg["printEscpospospaymentreceipt"] = fmt(p["payment"]);
          cfg["printReceipt"] = fmt(p["payment"]);
        }
        if (p["pos-reading"].name)
          cfg["printEscposXzReading"] = fmt(p["pos-reading"]);
        if (p["sales-per-item"].name)
          cfg["printEscposSalesPerProduct"] = fmt(p["sales-per-item"]);
        if (p["qr-code"].name || p["qr-code"].type === "USB")
          cfg["printEscPosQr"] = fmt(p["qr-code"]);

        cfg["qr_language"] = qrLanguage;
        cfg["qr_size"] = String(qrSize);
        if (qrLanguage === "tspl") {
          cfg["qr_label_width_mm"] = String(qrLabelWidth);
          cfg["qr_label_height_mm"] = String(qrLabelHeight);
          cfg["qr_gap_mm"] = String(qrGapMm);
          cfg["qr_x"] = String(qrX);
          cfg["qr_y"] = String(qrY);
          cfg["qr_text_x"] = String(qrTextX);
          cfg["qr_text_y"] = String(qrTextY);
        }

        const res = await window.electronAPI.savePrinterConfig(cfg);
        if (!res.success) throw new Error(res.message || "Save failed");
      }

      if (window.electronAPI?.savePrinterCategories) {
        const btCategories = Object.entries(categoryRoutes)
          .filter(([, v]) => v === "bt")
          .map(([k]) => k);
        const lanCategories = Object.entries(categoryRoutes)
          .filter(([, v]) => v === "lan")
          .map(([k]) => k);
        const usbCategories = Object.entries(categoryRoutes)
          .filter(([, v]) => v === "usb")
          .map(([k]) => k);

        const payload = {
          newTransaction: {
            bluetooth: {
              connection: btName ? `bt:${btName}` : "",
              categories: btCategories,
            },
            lan: {
              connection: lanName || "",
              categories: lanCategories,
            },
            usb: {
              connection: usbNewTxName ? `windows:${usbNewTxName}` : "",
              categories: usbCategories,
            },
          },
        };

        const res = await window.electronAPI.savePrinterCategories(payload);
        if (!res.success) throw new Error(res.message || "Save categories failed");
      }

      await fetchPrinters();
      setIsSuccessModalOpen(true);
    } catch (err) {
      console.error("Save error:", err);
      alert("Error saving: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── theme ──────────────────────────────────────────────────────────
  const th = {
    panel:    isDark ? "bg-slate-900/40 border-white/5"            : "bg-white border-slate-200 shadow-sm",
    panelSoft:isDark ? "bg-slate-950/50 border-slate-800"          : "bg-slate-50 border-slate-200",
    input:    isDark ? "bg-slate-950/70 border-slate-800 text-white placeholder:text-slate-500"
                     : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400",
    primary:  isDark ? "text-white"      : "text-slate-900",
    muted:    isDark ? "text-slate-400"  : "text-slate-500",
    soft:     isDark ? "text-slate-500"  : "text-slate-400",
    divider:  isDark ? "divide-white/5"  : "divide-slate-100",
    border:   isDark ? "border-white/5"  : "border-slate-200",
    thead:    isDark ? "border-white/5 bg-white/[0.02]" : "border-slate-100 bg-slate-50/50",
    row:      isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50/50",
  };

  const RadioBtn = ({ checked, onClick, color }) => (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center w-5 h-5 transition-all border-2 rounded-full"
      style={{
        borderColor: checked ? color : isDark ? "#475569" : "#cbd5e1",
        backgroundColor: checked ? color : "transparent",
      }}
    >
      {checked && <span className="block w-2 h-2 bg-white rounded-full" />}
    </button>
  );

  // ── scan button + results dropdown ────────────────────────────────
  const ScanBtn = ({ scanKey, type, onSelect }) => {
    const st = scanState[scanKey] || {};
    return (
      <div className="relative">
        <button
          type="button"
          title={`Search ${type} devices`}
          onClick={() =>
            st.open ? closeScan(scanKey) : handleScan(scanKey, type)
          }
          className="p-2.5 rounded-xl transition-colors"
          style={
            st.open
              ? { backgroundColor: isDark ? "#1e293b" : "#f1f5f9", color: isDark ? "#94a3b8" : "#64748b" }
              : { backgroundColor: isDark ? "#0f172a" : "#f8fafc", color: isDark ? "#64748b" : "#94a3b8" }
          }
        >
          {st.loading ? (
            <FiLoader size={15} className="animate-spin" />
          ) : (
            <FiSearch size={15} />
          )}
        </button>

        {st.open && (
          <div
            className={`absolute right-0 top-full mt-1 z-50 min-w-[180px] max-h-48 overflow-y-auto rounded-xl border shadow-xl ${th.panel}`}
          >
            <div className={`flex items-center justify-between px-3 py-2 border-b ${th.border}`}>
              <span className={`text-[10px] font-black uppercase tracking-widest ${th.soft}`}>
                {type === "Bluetooth" ? "COM Ports" : type === "LAN" ? "Network Printers" : "USB Printers"}
              </span>
              <button
                type="button"
                onClick={() => closeScan(scanKey)}
                className={`${th.soft} hover:opacity-70`}
              >
                <FiX size={12} />
              </button>
            </div>
            {st.results.length === 0 ? (
              <p className={`px-3 py-3 text-xs ${th.muted}`}>No devices found</p>
            ) : (
              st.results.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { onSelect(r); closeScan(scanKey); }}
                  className={`w-full text-left px-3 py-2 text-sm font-bold ${th.primary} ${th.row} transition-colors`}
                >
                  {r}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  // ── render ─────────────────────────────────────────────────────────
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

      {/* Page header */}
      <div className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 lg:p-10 ${th.panel}`}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-40px] right-[-40px] h-40 w-40 rounded-full blur-3xl opacity-20"
               style={{ backgroundColor: accent }} />
        </div>
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.24em] uppercase border border-current/10 bg-white/5">
            <FiPrinter size={12} style={{ color: accent }} />
            <span style={{ color: accent }}>Hardware Configuration</span>
          </div>
          <h2 className={`mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase ${th.primary}`}>
            Printer <span style={{ color: accent }}>Selection</span>
          </h2>
          <p className={`mt-3 text-sm max-w-2xl ${th.muted}`}>
            Map document types and item categories to their dedicated hardware.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className={`rounded-[28px] border p-20 text-center ${th.panel} ${th.soft} flex flex-col items-center gap-4`}>
          <FiLoader size={40} className="text-blue-500 animate-spin" />
          <p className="text-[11px] font-black uppercase tracking-widest">Fetching hardware profiles...</p>
        </div>
      ) : (
        <>
          {/* ── NEW TRANSACTION CARD ─────────────────────────────── */}
          <div className={`rounded-[28px] border overflow-hidden ${th.panel}`}>
            <div className={`px-6 py-4 border-b ${th.border} ${isDark ? "bg-white/[0.03]" : "bg-slate-50"}`}>
              <p className={`text-[10px] font-black uppercase tracking-widest ${th.soft}`}>New Transaction</p>
              <p className={`text-base font-black mt-0.5 ${th.primary}`}>Category-Based Printer Routing</p>
            </div>

            <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
              {/* Bluetooth slot */}
              <div className={`rounded-2xl border p-5 space-y-4 ${th.panelSoft}`}>
                <div className="flex items-center gap-2">
                  <span className="text-base">📱</span>
                  <span className={`text-sm font-black ${th.primary}`}>Bluetooth Printer</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={btName}
                    onChange={(e) => setBtName(e.target.value)}
                    className={`flex-1 px-3 py-2.5 rounded-xl border text-sm font-bold outline-none ${th.input}`}
                  >
                    <option value="" disabled>Select COM Port</option>
                    {BT_PORTS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <ScanBtn
                    scanKey="nt-bt"
                    type="Bluetooth"
                    onSelect={(v) => setBtName(v)}
                  />
                  <button
                    type="button"
                    onClick={() => handleTestPrint(btName, "Bluetooth")}
                    className="p-2.5 text-blue-500 rounded-xl bg-blue-500/10 hover:bg-blue-500 hover:text-white transition-colors"
                    title="Test Bluetooth Printer"
                  >
                    <FiPrinter size={15} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${th.soft}`}>
                    Routed categories
                  </p>
                  {categoryOptions.length > 0 && (() => {
                    const allBt = categoryOptions.every((c) => categoryRoutes[c] === "bt");
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          const next = {};
                          categoryOptions.forEach((c) => { next[c] = allBt ? "" : "bt"; });
                          setCategoryRoutes((prev) => ({ ...prev, ...next }));
                        }}
                        className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border transition-all"
                        style={
                          allBt
                            ? { backgroundColor: accent, borderColor: accent, color: isDark ? "#0f172a" : "#fff" }
                            : { borderColor: isDark ? "#334155" : "#e2e8f0", color: isDark ? "#94a3b8" : "#64748b" }
                        }
                      >
                        {allBt ? "✓ All" : "Select All"}
                      </button>
                    );
                  })()}
                </div>
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.length === 0 && (
                    <span className={`text-xs ${th.muted}`}>No categories found</span>
                  )}
                  {categoryOptions.map((cat) => {
                    const checked = categoryRoutes[cat] === "bt";
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setRoute(cat, checked ? "" : "bt")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black border transition-all"
                        style={
                          checked
                            ? { backgroundColor: accent, borderColor: accent, color: isDark ? "#0f172a" : "#fff" }
                            : { borderColor: isDark ? "#334155" : "#e2e8f0", color: isDark ? "#94a3b8" : "#64748b" }
                        }
                      >
                        {checked ? "✓" : "+"} {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* LAN slot */}
              <div className={`rounded-2xl border p-5 space-y-4 ${th.panelSoft}`}>
                <div className="flex items-center gap-2">
                  <span className="text-base">🌐</span>
                  <span className={`text-sm font-black ${th.primary}`}>LAN / WiFi Printer</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 192.168.100.83"
                    value={lanName}
                    onChange={(e) => setLanName(e.target.value)}
                    className={`flex-1 px-3 py-2.5 rounded-xl border text-sm font-bold outline-none ${th.input}`}
                  />
                  <ScanBtn
                    scanKey="nt-lan"
                    type="LAN"
                    onSelect={(v) => setLanName(v)}
                  />
                  <button
                    type="button"
                    onClick={() => handleTestPrint(lanName, "LAN")}
                    className="p-2.5 text-blue-500 rounded-xl bg-blue-500/10 hover:bg-blue-500 hover:text-white transition-colors"
                    title="Test LAN Printer"
                  >
                    <FiPrinter size={15} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${th.soft}`}>
                    Routed categories
                  </p>
                  {categoryOptions.length > 0 && (() => {
                    const allLan = categoryOptions.every((c) => categoryRoutes[c] === "lan");
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          const next = {};
                          categoryOptions.forEach((c) => { next[c] = allLan ? "" : "lan"; });
                          setCategoryRoutes((prev) => ({ ...prev, ...next }));
                        }}
                        className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border transition-all"
                        style={
                          allLan
                            ? { backgroundColor: "#10b981", borderColor: "#10b981", color: "#fff" }
                            : { borderColor: isDark ? "#334155" : "#e2e8f0", color: isDark ? "#94a3b8" : "#64748b" }
                        }
                      >
                        {allLan ? "✓ All" : "Select All"}
                      </button>
                    );
                  })()}
                </div>
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.length === 0 && (
                    <span className={`text-xs ${th.muted}`}>No categories found</span>
                  )}
                  {categoryOptions.map((cat) => {
                    const checked = categoryRoutes[cat] === "lan";
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setRoute(cat, checked ? "" : "lan")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black border transition-all"
                        style={
                          checked
                            ? { backgroundColor: "#10b981", borderColor: "#10b981", color: "#fff" }
                            : { borderColor: isDark ? "#334155" : "#e2e8f0", color: isDark ? "#94a3b8" : "#64748b" }
                        }
                      >
                        {checked ? "✓" : "+"} {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* USB slot */}
              <div className={`rounded-2xl border p-5 space-y-4 ${th.panelSoft}`}>
                <div className="flex items-center gap-2">
                  <span className="text-base">🖨️</span>
                  <span className={`text-sm font-black ${th.primary}`}>USB ESC/POS Printer</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={usbNewTxName}
                    onChange={(e) => setUsbNewTxName(e.target.value)}
                    className={`flex-1 px-3 py-2.5 rounded-xl border text-sm font-bold outline-none ${th.input}`}
                  >
                    <option value="" disabled>Select Printer</option>
                    {systemPrinters.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <ScanBtn
                    scanKey="nt-usb"
                    type="USB"
                    onSelect={(v) => setUsbNewTxName(v)}
                  />
                  <button
                    type="button"
                    onClick={() => handleTestPrint(usbNewTxName, "USB")}
                    className="p-2.5 text-blue-500 rounded-xl bg-blue-500/10 hover:bg-blue-500 hover:text-white transition-colors"
                    title="Test USB Printer"
                  >
                    <FiPrinter size={15} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${th.soft}`}>
                    Routed categories
                  </p>
                  {categoryOptions.length > 0 && (() => {
                    const allUsb = categoryOptions.every((c) => categoryRoutes[c] === "usb");
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          const next = {};
                          categoryOptions.forEach((c) => { next[c] = allUsb ? "" : "usb"; });
                          setCategoryRoutes((prev) => ({ ...prev, ...next }));
                        }}
                        className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border transition-all"
                        style={
                          allUsb
                            ? { backgroundColor: "#f59e0b", borderColor: "#f59e0b", color: "#fff" }
                            : { borderColor: isDark ? "#334155" : "#e2e8f0", color: isDark ? "#94a3b8" : "#64748b" }
                        }
                      >
                        {allUsb ? "✓ All" : "Select All"}
                      </button>
                    );
                  })()}
                </div>
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.length === 0 && (
                    <span className={`text-xs ${th.muted}`}>No categories found</span>
                  )}
                  {categoryOptions.map((cat) => {
                    const checked = categoryRoutes[cat] === "usb";
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setRoute(cat, checked ? "" : "usb")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black border transition-all"
                        style={
                          checked
                            ? { backgroundColor: "#f59e0b", borderColor: "#f59e0b", color: "#fff" }
                            : { borderColor: isDark ? "#334155" : "#e2e8f0", color: isDark ? "#94a3b8" : "#64748b" }
                        }
                      >
                        {checked ? "✓" : "+"} {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Category routing summary table */}
            {categoryOptions.length > 0 && (
              <div className={`border-t ${th.border}`}>
                <table className="w-full text-left">
                  <thead>
                    <tr className={`border-b ${th.thead}`}>
                      <th className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest ${th.soft}`}>Category</th>
                      <th className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest ${th.soft}`}>Bluetooth</th>
                      <th className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest ${th.soft}`}>LAN</th>
                      <th className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest ${th.soft}`}>USB</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${th.divider}`}>
                    {categoryOptions.map((cat) => {
                      const route = categoryRoutes[cat] || "";
                      return (
                        <tr key={cat} className={`${th.row} transition-colors`}>
                          <td className={`px-6 py-3 text-sm font-black ${th.primary}`}>{cat}</td>
                          <td className="px-6 py-3">
                            <RadioBtn
                              checked={route === "bt"}
                              onClick={() => setRoute(cat, route === "bt" ? "" : "bt")}
                              color={accent}
                            />
                          </td>
                          <td className="px-6 py-3">
                            <RadioBtn
                              checked={route === "lan"}
                              onClick={() => setRoute(cat, route === "lan" ? "" : "lan")}
                              color="#10b981"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <RadioBtn
                              checked={route === "usb"}
                              onClick={() => setRoute(cat, route === "usb" ? "" : "usb")}
                              color="#f59e0b"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── OTHER PRINTERS TABLE ─────────────────────────────── */}
          <div className={`rounded-[28px] border overflow-hidden ${th.panel}`}>
            <div className={`px-6 py-4 border-b ${th.border} ${isDark ? "bg-white/[0.03]" : "bg-slate-50"}`}>
              <p className={`text-[10px] font-black uppercase tracking-widest ${th.soft}`}>Other Documents</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b ${th.thead}`}>
                    <th className={`p-6 text-[10px] font-black uppercase tracking-widest ${th.soft}`}>Document Type</th>
                    <th className={`p-6 text-[10px] font-black uppercase tracking-widest ${th.soft}`}>Printer Port</th>
                    <th className={`p-6 text-[10px] font-black uppercase tracking-widest ${th.soft}`}>Connection Type</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${th.divider}`}>
                  {OTHER_ROWS.map((row) => {
                    const p = ports[row.id];
                    return (
                      <tr key={row.id} className={`${th.row} transition-colors`}>
                        <td className="p-6">
                          <span className={`text-sm font-black ${th.primary}`}>{row.label}</span>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-2">
                            {p.type === "Bluetooth" ? (
                              <select
                                value={p.name}
                                onChange={(e) => updatePort(row.id, "name", e.target.value)}
                                className={`flex-1 px-4 py-3 rounded-xl border text-sm font-bold outline-none ${th.input}`}
                              >
                                <option value="" disabled>Select Port</option>
                                {BT_PORTS.map((port) => (
                                  <option key={port} value={port}>{port}</option>
                                ))}
                              </select>
                            ) : p.type === "USB" ? (
                              <select
                                value={p.name}
                                onChange={(e) => updatePort(row.id, "name", e.target.value)}
                                className={`flex-1 px-4 py-3 rounded-xl border text-sm font-bold outline-none ${th.input}`}
                              >
                                <option value="" disabled>Select Printer</option>
                                {systemPrinters.map((name) => (
                                  <option key={name} value={name}>{name}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                placeholder="e.g. 192.168.1.100"
                                value={p.name}
                                onChange={(e) => updatePort(row.id, "name", e.target.value)}
                                className={`flex-1 px-4 py-3 rounded-xl border text-sm font-bold outline-none ${th.input}`}
                              />
                            )}
                            <ScanBtn
                              scanKey={row.id}
                              type={p.type}
                              onSelect={(v) => updatePort(row.id, "name", v)}
                            />
                            <button
                              type="button"
                              onClick={() => handleTestPrint(p.name, p.type)}
                              className="p-3 text-blue-500 transition-colors rounded-xl bg-blue-500/10 hover:bg-blue-500 hover:text-white"
                              title="Test Printer"
                            >
                              <FiPrinter size={16} />
                            </button>
                          </div>
                        </td>
                        <td className="p-6">
                          <select
                            value={p.type}
                            onChange={(e) => updatePort(row.id, "type", e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl border text-sm font-bold outline-none cursor-pointer ${th.input}`}
                          >
                            <option value="USB">🖨️ USB (ESC/POS)</option>
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
          </div>

          {/* ── QR LABEL SETTINGS ───────────────────────────────────── */}
          <div className={`rounded-[28px] border overflow-hidden ${th.panel}`}>
            <div className={`px-6 py-4 border-b ${th.border} ${isDark ? "bg-white/[0.03]" : "bg-slate-50"}`}>
              <p className={`text-[10px] font-black uppercase tracking-widest ${th.soft}`}>QR Label Settings</p>
              <p className={`text-base font-black mt-0.5 ${th.primary}`}>Language, Size & Layout</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Language + Size row */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Print Language */}
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ${th.soft}`}>
                    Print Language
                  </label>
                  <select
                    value={qrLanguage}
                    onChange={(e) => setQrLanguage(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border text-sm font-bold outline-none cursor-pointer ${th.input}`}
                  >
                    <option value="escpos">ESC/POS (Thermal)</option>
                    <option value="tspl">TSPL (Label Printer)</option>
                  </select>
                </div>

                {/* QR Module Size */}
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ${th.soft}`}>
                    QR Module Size <span className={th.muted}>(1–16)</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={qrSize}
                    onChange={(e) => setQrSize(Number(e.target.value) || 8)}
                    className={`w-full px-4 py-3 rounded-xl border text-sm font-bold outline-none ${th.input}`}
                  />
                </div>
              </div>

              {/* TSPL-only label dimensions */}
              {qrLanguage === "tspl" && (
                <>
                  <div className={`border-t ${th.border}`} />
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-4 ${th.soft}`}>
                      TSPL Label Dimensions
                    </p>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      {[
                        { label: "Width (mm)", value: qrLabelWidth, setter: setQrLabelWidth },
                        { label: "Height (mm)", value: qrLabelHeight, setter: setQrLabelHeight },
                        { label: "Gap (mm)", value: qrGapMm, setter: setQrGapMm },
                      ].map(({ label, value, setter }) => (
                        <div key={label} className="space-y-2">
                          <label className={`text-[10px] font-black uppercase tracking-widest ${th.soft}`}>
                            {label}
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={value}
                            onChange={(e) => setter(Number(e.target.value))}
                            className={`w-full px-4 py-3 rounded-xl border text-sm font-bold outline-none ${th.input}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`border-t ${th.border}`} />
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-4 ${th.soft}`}>
                      TSPL Element Positions
                    </p>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {[
                        { label: "QR X", value: qrX, setter: setQrX },
                        { label: "QR Y", value: qrY, setter: setQrY },
                        { label: "Text X", value: qrTextX, setter: setQrTextX },
                        { label: "Text Y", value: qrTextY, setter: setQrTextY },
                      ].map(({ label, value, setter }) => (
                        <div key={label} className="space-y-2">
                          <label className={`text-[10px] font-black uppercase tracking-widest ${th.soft}`}>
                            {label}
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={value}
                            onChange={(e) => setter(Number(e.target.value))}
                            className={`w-full px-4 py-3 rounded-xl border text-sm font-bold outline-none ${th.input}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-4 mt-6">
        <button
          onClick={fetchPrinters}
          disabled={isSaving}
          className={`px-8 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] border ${th.panelSoft} ${th.primary} disabled:opacity-50`}
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
