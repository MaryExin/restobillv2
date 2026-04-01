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

          @media print {
            body * { visibility: hidden; }
            .no-print { display: none !important; }

            #thermal-receipt, #thermal-receipt * { 
              visibility: visible; 
              font-weight: 900 !important; /* Bold lahat lahat */
              color: black !important;
              text-transform: uppercase;
            }

            #thermal-receipt {
              position: absolute;
              left: 0;
              top: 0;
              width: 70mm; 
              padding: 0;
              margin: 0;
              display: block !important;
              font-family: 'Courier New', Courier, monospace;
            }

            @page {
              size: 70mm auto;
              margin: 0;
            }
            
            .t-table { 
              width: 100%; 
              border-collapse: collapse; 
              table-layout: fixed;
            }
            
            .t-divider { border-top: 2.5pt solid black; margin: 4px 0; }
            
            /* Column widths adjusted para magkatabi QTY at TOTAL */
            .col-item { width: 55%; text-align: left; }
            .col-qty { width: 15%; text-align: left; }
            .col-total { width: 30%; text-align: left; }

            .t-cell { 
              padding: 2px 0; 
              word-wrap: break-word; 
              vertical-align: top;
            }
          }
        `}
      </style>

      {/* SCREEN UI */}
      <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 backdrop-blur-sm no-print font-bold">
        <div className="w-full max-w-6xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-800">
          
          <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
            <h2 className="text-xl font-bold tracking-tight uppercase">Sales Per Product</h2>
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-2 py-1 text-sm border rounded outline-none" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-2 py-1 text-sm border rounded outline-none" />
              <button onClick={fetchSales} className="p-2 rounded-lg bg-slate-200"><FaSyncAlt className={loading ? "animate-spin" : ""} /></button>
              <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-emerald-600"><FaFileExcel /> Excel</button>
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg"><FaPrint /> Print</button>
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

      {/* ================= THERMAL RECEIPT (BOLD, LEFT, TIGHT SPACING) ================= */}
      <div id="thermal-receipt">
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 2px 0', fontSize: '15px' }}>SALES REPORT</h2>
          <p style={{ margin: 0, fontSize: '10px' }}>{dateFrom} - {dateTo}</p>
        </div>

        <div className="t-divider" />

        <table className="t-table">
          <thead>
            <tr style={{ fontSize: '11px' }}>
              <th className="col-item">ITEM</th>
              <th className="col-qty">QTY</th>
              <th className="col-total">TOTAL</th>
            </tr>
          </thead>
          <tbody style={{ fontSize: '12px' }}>
            {filteredData.map((item, i) => (
              <tr key={i}>
                <td className="t-cell col-item">{item["Product Name"]}</td>
                <td className="t-cell col-qty">{item["Total Qty Sold"]}</td>
                <td className="t-cell col-total">
                  {Number(item["Gross Sales"]).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="t-divider" />

        <div style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
          <span>TOTAL QTY: {totals.qty}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', fontSize: '12px', marginTop: '2px' }}>
          <span>GRAND TOTAL: ₱{totals.amt.toLocaleString()}</span>
        </div>

        <div className="t-divider" />
        <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '5px' }}>
          <p style={{ margin: 0 }}>DATE: {new Date().toLocaleString()}</p>
          {searchTerm && <p style={{ margin: 0 }}>FILTER: "{searchTerm}"</p>}
        </div>
      </div>
    </>
  );
};

export default SalesPerProductModal;