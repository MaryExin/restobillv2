import React, { useState, useEffect, useRef } from "react";
import { FaPrint, FaSpinner, FaReceipt, FaCalendarAlt, FaTimes } from "react-icons/fa";

const ReprintModal = ({ isOpen, onClose, terminalNumber, unitCode }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const printRef = useRef();

  const f = (n) => parseFloat(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  useEffect(() => {
    if (!isOpen) return;
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("api/reprint_z_reading.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: selectedDate, terminal_number: terminalNumber, unit_code: unitCode }),
        });
        const result = await res.json();
        result.success ? setReport(result.data) : setError(result.message);
      } catch (err) {
        setError("Connection error to API.");
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [selectedDate, isOpen, terminalNumber, unitCode]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(`<html><head><style>
      body { font-family: 'Courier New', monospace; padding: 20px; font-size: 11px; }
      .text-center { text-align: center; }
      .flex { display: flex; justify-content: space-between; }
      .hr { border-top: 1px dashed black; margin: 10px 0; }
    </style></head><body onload="window.print(); window.close();">${printRef.current.innerHTML}</body></html>`);
    printWindow.document.close();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[85vh] rounded-[2rem] flex overflow-hidden shadow-2xl border dark:border-slate-800">
        
        {/* Left Side: Controls */}
        <div className="w-[300px] p-8 border-r dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3 mb-8">
            <FaReceipt className="text-2xl text-blue-500" />
            <h2 className="text-xl font-bold tracking-tighter uppercase dark:text-white">Reprint Z</h2>
          </div>
          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Pumili ng Petsa</label>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full p-3 mb-6 font-bold border outline-none rounded-xl dark:bg-slate-950 dark:border-slate-700 dark:text-white focus:ring-2 ring-blue-500"
          />
          <button onClick={handlePrint} disabled={!report} className="flex items-center justify-center w-full gap-2 p-4 font-bold text-white transition-all bg-green-600 hover:bg-green-700 rounded-xl disabled:opacity-50">
            <FaPrint /> PRINT REPORT
          </button>
          <button onClick={onClose} className="w-full mt-4 text-xs font-bold uppercase text-slate-500 hover:text-red-500">Close</button>
        </div>

        {/* Right Side: Preview */}
        <div className="flex items-start justify-center flex-1 p-10 overflow-auto bg-slate-200 dark:bg-slate-950">
          {loading ? (
            <FaSpinner className="mt-20 text-4xl text-blue-500 animate-spin" />
          ) : report ? (
            <div ref={printRef} className="bg-white p-8 w-[350px] shadow-lg text-black font-mono text-[11px] leading-tight border border-slate-300">
              <div className="space-y-1 font-bold text-center uppercase">
                <p>{report.corpName}</p>
                <p>{report.businessUnitName}</p>
                <p className="text-[9px] font-normal">{report.address}</p>
                <p className="text-[9px] font-normal">TIN: {report.tin}</p>
                <div className="hr"></div>
                <p className="underline">Z-READING REPRINT</p>
                <p>Z-Counter: {report.zCounterNo}</p>
              </div>
              <div className="mt-5 space-y-1">
                <div className="flex justify-between"><span>Date:</span><span>{report.reportDate}</span></div>
                <div className="flex justify-between"><span>SI Range:</span><span>{report.begSI}-{report.endSI}</span></div>
                <div className="hr"></div>
                <div className="flex justify-between font-bold"><span>GROSS SALES:</span><span>{f(report.grossAmount)}</span></div>
                <div className="flex justify-between"><span>Less: Discount:</span><span>({f(report.lessDiscount)})</span></div>
                <div className="flex justify-between py-1 text-sm font-bold"><span>NET SALES:</span><span>{f(report.netAmount)}</span></div>
                <div className="hr"></div>
                <div className="flex justify-between font-bold uppercase"><span>Cash in Drawer:</span><span>{f(report.cashInDrawer)}</span></div>
                <div className="hr"></div>
                <p className="mt-4 font-bold text-center underline">ACCUMULATED SALES</p>
                <div className="flex justify-between"><span>Previous:</span><span>{f(report.previousAccumulatedSales)}</span></div>
                <div className="flex justify-between"><span>Present:</span><span>{f(report.presentAccumulatedSales)}</span></div>
                <div className="mt-10 text-center opacity-40 uppercase text-[9px]">*** END OF REPORT ***<br/>Reprinted: {new Date().toLocaleString()}</div>
              </div>
            </div>
          ) : (
            <div className="mt-32 font-bold tracking-widest uppercase text-slate-400">{error || "Pumili ng petsa para mag-preview"}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReprintModal;