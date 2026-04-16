import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  const [isPrinting, setIsPrinting] = useState(false);

  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost/api/reports_dashboard.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datefrom: dateFrom,
          dateto: dateTo,
        }),
      });

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

  const filteredData = useMemo(() => {
    const kw = searchTerm.toLowerCase().trim();
    if (!kw) return salesData;

    return salesData.filter(
      (item) =>
        String(item["Product Name"] || "")
          .toLowerCase()
          .includes(kw) ||
        String(item["Code"] || "")
          .toLowerCase()
          .includes(kw),
    );
  }, [salesData, searchTerm]);

  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, curr) => {
        acc.qty += Number(curr["Total Qty Sold"] || 0);
        acc.amt += Number(curr["Gross Sales"] || 0);
        return acc;
      },
      { qty: 0, amt: 0 },
    );
  }, [filteredData]);

  const handlePrint = async () => {
    if (filteredData.length === 0) {
      alert("No data to print.");
      return;
    }

    if (!window.electronAPI?.printEscposSalesPerProduct) {
      alert("ESC/POS print API is not available.");
      return;
    }

    try {
      setIsPrinting(true);

      const result = await window.electronAPI.printEscposSalesPerProduct({
        title: "SALES REPORT",
        dateFrom,
        dateTo,
        printedAt: new Date().toLocaleString(),
        items: filteredData.map((item) => ({
          code: item["Code"] || "",
          name: item["Product Name"] || "",
          qty: Number(item["Total Qty Sold"] || 0),
          amount: Number(item["Gross Sales"] || 0),
        })),
        totals: {
          qty: Number(totals.qty || 0),
          amount: Number(totals.amt || 0),
        },
      });

      console.log("sales per product print result:", result);

      if (!result?.success) {
        throw new Error(
          result?.message || "Failed to print sales per product report.",
        );
      }
    } catch (error) {
      console.error("ESC/POS print error:", error);
      alert(
        error?.message || "Something went wrong while printing the report.",
      );
    } finally {
      setIsPrinting(false);
    }
  };

  const exportToExcel = () => {
    if (filteredData.length === 0) {
      alert("No data to export");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales");
    XLSX.writeFile(wb, `Sales_Report.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 backdrop-blur-sm font-bold">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white text-slate-800 shadow-2xl">
        <div className="flex items-center justify-between border-b bg-slate-50 px-6 py-4">
          <h2 className="text-xl font-bold uppercase tracking-tight">
            Sales Per Product
          </h2>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded border px-2 py-1 text-sm outline-none"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded border px-2 py-1 text-sm outline-none"
            />

            <button
              onClick={fetchSales}
              disabled={loading || isPrinting}
              className="rounded-lg bg-slate-200 p-2 disabled:opacity-60"
            >
              <FaSyncAlt className={loading ? "animate-spin" : ""} />
            </button>

            <button
              onClick={exportToExcel}
              disabled={loading || isPrinting}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              <FaFileExcel /> Excel
            </button>

            <button
              onClick={handlePrint}
              disabled={filteredData.length === 0 || loading || isPrinting}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-60 ${
                filteredData.length === 0 || loading || isPrinting
                  ? "bg-gray-400"
                  : "bg-blue-600"
              }`}
            >
              <FaPrint />
              {isPrinting ? "Printing..." : "Print"}
            </button>

            <button
              onClick={onClose}
              disabled={isPrinting}
              className="rounded-lg bg-rose-500 p-2 text-white disabled:opacity-60"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="border-b p-4">
          <div className="flex items-center rounded-xl bg-slate-100 px-3 py-2">
            <FaSearch className="mr-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-sm font-bold outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-[10px] uppercase text-slate-500">
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
                  <td className="py-3 text-right">
                    ₱{Number(item["Gross Sales"] || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between border-t bg-slate-50 px-6 py-4 font-bold uppercase">
          <span>Total Qty: {totals.qty}</span>
          <span className="text-blue-600">
            ₱{Number(totals.amt || 0).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SalesPerProductModal;
