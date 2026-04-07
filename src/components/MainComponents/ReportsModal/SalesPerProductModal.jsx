import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  FaSearch,
  FaSyncAlt,
  FaTimes,
  FaPrint,
  FaFileExcel,
} from "react-icons/fa";
import * as XLSX from "xlsx";

const SalesPerProductModal = ({ isOpen, onClose }) => {
  const today = new Date().toISOString().split("T")[0];

  const [searchTerm, setSearchTerm] = useState("");
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(false);

  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  // ================= FETCH DATA =================
  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "http://localhost/api/reports_dashboard.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            datefrom: dateFrom,
            dateto: dateTo,
          }),
        }
      );

      const data = await res.json();
      setSalesData(data?.salesPerProduct || []);
    } catch (err) {
      console.error("Fetch Error:", err);
      setSalesData([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (isOpen) fetchSales();
  }, [isOpen, fetchSales]);

  // ================= FILTER LOGIC =================
  const filteredData = useMemo(() => {
    const kw = searchTerm.toLowerCase().trim();
    if (!kw) return salesData;
    return salesData.filter(
      (item) =>
        item["Product Name"]?.toLowerCase().includes(kw) ||
        item["Code"]?.toLowerCase().includes(kw)
    );
  }, [salesData, searchTerm]);

  // ================= CALC TOTALS =================
  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, curr) => {
        acc.qty += Number(curr["Total Qty Sold"] || 0);
        acc.amt += Number(curr["Gross Sales"] || 0);
        return acc;
      },
      { qty: 0, amt: 0 }
    );
  }, [filteredData]);

  const handlePrint = () => {
    if (filteredData.length === 0) {
      alert("No data to print.");
      return;
    }
    window.print();
  };

  const exportToExcel = () => {
    if (filteredData.length === 0) return alert("No data to export");
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales");
    XLSX.writeFile(wb, `Sales_Report.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <>
      <style>
        {`
          @media screen {
            #thermal-receipt { display: none; }
          }

          /* Ito ang magtatago sa lahat ng screen elements habang nagpi-print */
          @media print {
            body > *:not(#thermal-receipt) {
              display: none !important;
            }
            .no-print { display: none !important; }
          }
        `}
        
        {/* DYNAMIC PRINT CSS: Gagawa lang ng Page Size kung may data */}
        {filteredData.length > 0 ? (
          `@media print {
            @page {
              size: 70mm auto;
              margin: 0;
            }
            #thermal-receipt {
              display: block !important;
              width: 70mm;
              padding: 0;
              margin: 0;
              visibility: visible !important;
            }
          }`
        ) : (
          `@media print {
            @page { size: 0; margin: 0; }
            #thermal-receipt { display: none !important; }
          }`
        )}
      </style>

      {/* SCREEN UI (Non-printable) */}
      <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 backdrop-blur-sm no-print font-bold">
        <div className="w-full max-w-6xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-800">
          
          <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
            <h2 className="text-xl font-bold tracking-tight uppercase">Sales Per Product</h2>
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-2 py-1 text-sm border rounded outline-none" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-2 py-1 text-sm border rounded outline-none" />
              <button onClick={fetchSales} className="p-2 rounded-lg bg-slate-200"><FaSyncAlt className={loading ? "animate-spin" : ""} /></button>
              <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-emerald-600"><FaFileExcel /> Excel</button>
              <button 
                onClick={handlePrint} 
                disabled={filteredData.length === 0}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg ${filteredData.length === 0 ? 'bg-gray-400' : 'bg-blue-600'}`}
              >
                <FaPrint /> Print
              </button>
              <button onClick={onClose} className="p-2 text-white rounded-lg bg-rose-500"><FaTimes /></button>
            </div>
          </div>

          <div className="p-4 border-b">
            <div className="flex items-center px-3 py-2 bg-slate-100 rounded-xl">
              <FaSearch className="mr-2 text-slate-400" />
              <input
                type="text"
                placeholder="Search product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-sm font-bold bg-transparent outline-none"
              />
            </div>
          </div>

          <div className="flex-1 p-4 overflow-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b text-slate-500 uppercase text-[10px]">
                  <th className="py-3">Item</th>
                  <th className="py-3 text-center">Qty</th>
                  <th className="py-3 text-right">Gross Sales</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-3">{item["Product Name"]}</td>
                    <td className="py-3 text-center">{item["Total Qty Sold"]}</td>
                    <td className="py-3 text-right">₱{Number(item["Gross Sales"]).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between px-6 py-4 font-bold uppercase border-t bg-slate-50">
            <span>Total Qty: {totals.qty}</span>
            <span className="text-blue-600">₱{totals.amt.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ================= THERMAL RECEIPT ================= */}
      {/* Ginagamit ang condition para hindi mag-render ang DOM element kapag empty */}
      {filteredData.length > 0 && (
        <div id="thermal-receipt" style={{ color: 'black', textTransform: 'uppercase', fontFamily: 'monospace' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ margin: '0', fontSize: '15px', fontWeight: '900' }}>SALES REPORT</h2>
            <p style={{ margin: '2px 0', fontSize: '10px' }}>{dateFrom} - {dateTo}</p>
          </div>

          <div style={{ borderTop: '2pt solid black', margin: '4px 0' }} />

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontWeight: '900' }}>
            <thead>
              <tr style={{ fontSize: '11px' }}>
                <th style={{ textAlign: 'left', width: '55%' }}>ITEM</th>
                <th style={{ textAlign: 'left', width: '15%' }}>QTY</th>
                <th style={{ textAlign: 'left', width: '30%' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, i) => (
                <tr key={i}>
                  <td style={{ padding: '2px 0', wordBreak: 'break-all' }}>{item["Product Name"]}</td>
                  <td>{item["Total Qty Sold"]}</td>
                  <td>{Number(item["Gross Sales"]).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: '2pt solid black', margin: '4px 0' }} />

          <div style={{ fontSize: '12px', fontWeight: '900' }}>
            <div>TOTAL QTY: {totals.qty}</div>
            <div>GRAND TOTAL: ₱{totals.amt.toLocaleString()}</div>
          </div>

          <div style={{ borderTop: '1pt solid black', margin: '4px 0' }} />
          <div style={{ textAlign: 'center', fontSize: '9px' }}>
            <p style={{ margin: 0 }}>DATE: {new Date().toLocaleString()}</p>
          </div>
        </div>
      )}
    </>
  );
};

export default SalesPerProductModal;