/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  FaCheckCircle,
  FaDownload,
  FaExclamationTriangle,
  FaFileUpload,
  FaSpinner,
  FaTimes,
  FaUpload,
} from "react-icons/fa";

const PRICING_MUTATION_PATH =
  import.meta.env.VITE_POS_PRICING_MUTATION_ENDPOINT || "/api/pricing_engine.php";
const SALES_TYPE_LIST_PATH = "/api/sales_type_list.php";
const CHUNK_SIZE = 100;
const MAX_ROWS = 500;

const BASE_COLUMNS = ["Product Name", "Category", "Unit", "Vatable", "Discountable"];

// normalized header -> field
const HEADER_ALIASES = {
  "PRODUCT NAME": "item_name",
  "ITEM NAME": "item_name",
  ITEMNAME: "item_name",
  NAME: "item_name",
  PRODUCT: "item_name",
  CATEGORY: "item_category",
  "ITEM CATEGORY": "item_category",
  ITEMCATEGORY: "item_category",
  UNIT: "unit_of_measure",
  UOM: "unit_of_measure",
  "UNIT OF MEASURE": "unit_of_measure",
  VATABLE: "vatable",
  VAT: "vatable",
  DISCOUNTABLE: "isDiscountable",
  ISDISCOUNTABLE: "isDiscountable",
};

const authHeaders = (headers = {}) => {
  const next = { ...headers };
  const token = localStorage.getItem("access_token");
  if (token) next.Authorization = `Bearer ${token}`;
  return next;
};

const normalizeHeader = (value) =>
  String(value ?? "")
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// "Price - DINE IN", "DINE IN PRICE", "DINE IN (₱)" -> "DINE IN"
const stripPriceWords = (header) =>
  header
    .replace(/\(.*?\)/g, " ")
    .replace(/^PRICE\b[\s:]*/, "")
    .replace(/\bPRICE$/, "")
    .replace(/\bSRP\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const parseYesNo = (value) => {
  const text = String(value ?? "").trim().toUpperCase();
  if (text === "") return { value: "Yes" };
  if (["YES", "Y", "TRUE", "1"].includes(text)) return { value: "Yes" };
  if (["NO", "N", "FALSE", "0"].includes(text)) return { value: "No" };
  return { error: true };
};

const parsePrice = (value) => {
  if (value === null || value === undefined) return { empty: true };
  if (typeof value === "number") {
    return value > 0 ? { value: Math.round(value * 100) / 100 } : { error: true };
  }
  const text = String(value).replace(/[₱,\s]/g, "").replace(/^PHP/i, "");
  if (text === "") return { empty: true };
  const num = Number(text);
  if (!Number.isFinite(num) || num <= 0) return { error: true };
  return { value: Math.round(num * 100) / 100 };
};

/**
 * Upload many products at once from an Excel/CSV file.
 * Same rules as AddProductModal, saved through pricing_engine.php
 * action "batch_add" (one transaction per product, result per row).
 */
const BatchUploadProductModal = ({
  isOpen,
  onClose,
  onUploaded,
  isDark,
  apiHost,
  existingNames = [],
}) => {
  const fileInputRef = useRef(null);
  const [salesTypes, setSalesTypes] = useState([]);
  const [salesTypesLoading, setSalesTypesLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [fileError, setFileError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  // { [row]: { status: "success" | "error", message } }
  const [results, setResults] = useState({});
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFileName("");
    setRows([]);
    setFileError("");
    setResults({});
    setProgress({ done: 0, total: 0 });
    if (!apiHost) return;

    let cancelled = false;
    setSalesTypesLoading(true);
    fetch(`${apiHost}${SALES_TYPE_LIST_PATH}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const list = (Array.isArray(res?.data) ? res.data : [])
          .map((row) => String(row?.description || "").trim())
          .filter(Boolean);
        setSalesTypes(list);
      })
      .catch(() => {
        if (!cancelled) setSalesTypes([]);
      })
      .finally(() => {
        if (!cancelled) setSalesTypesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, apiHost]);

  const existingNameSet = useMemo(
    () =>
      new Set(
        existingNames.map((name) => String(name || "").trim().toLowerCase()).filter(Boolean),
      ),
    [existingNames],
  );

  const readyRows = useMemo(
    () => rows.filter((row) => row.errors.length === 0 && results[row.row]?.status !== "success"),
    [rows, results],
  );
  const errorCount = rows.filter((row) => row.errors.length > 0).length;
  const savedCount = Object.values(results).filter((r) => r.status === "success").length;
  const failedCount = Object.values(results).filter((r) => r.status === "error").length;
  const hasUploaded = Object.keys(results).length > 0;

  if (!isOpen) return null;

  const theme = {
    panel: isDark ? "bg-slate-900 border-white/10" : "bg-white border-slate-200",
    title: isDark ? "text-white" : "text-slate-800",
    label: isDark ? "text-slate-400" : "text-slate-500",
    row: isDark ? "border-white/10" : "border-slate-200",
    head: isDark ? "bg-slate-800 text-slate-400" : "bg-slate-50 text-slate-500",
    zone: isDark
      ? "border-white/15 hover:border-blue-500/60 hover:bg-blue-500/5"
      : "border-slate-300 hover:border-blue-400 hover:bg-blue-50",
    zoneOn: isDark ? "border-blue-500 bg-blue-500/10" : "border-blue-500 bg-blue-50",
  };

  const downloadTemplate = () => {
    const headers = [...BASE_COLUMNS, ...salesTypes];
    const sheet = XLSX.utils.aoa_to_sheet([headers]);
    sheet["!cols"] = headers.map((h) => ({ wch: Math.max(14, h.length + 4) }));

    const sample = [
      headers,
      ["Club Sandwich", "SANDWICHES", "PC", "Yes", "Yes", ...salesTypes.map((_, i) => (i === 0 ? 180 : ""))],
    ];
    const guide = XLSX.utils.aoa_to_sheet([
      ["How to fill the Products sheet"],
      [""],
      ["Product Name", "Required. Must not match an existing product."],
      ["Category", "Required. Use an existing category or type a new one."],
      ["Unit", "Optional. Default is PC."],
      ["Vatable / Discountable", "Yes or No. Blank means Yes."],
      ["Sales type columns", "Price per sales type. Leave blank to skip that sales type. At least one price is required."],
      [""],
      ["Example (do not paste this sheet's rows into Products):"],
      ...sample,
    ]);
    guide["!cols"] = [{ wch: 26 }, { wch: 90 }];

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Products");
    XLSX.utils.book_append_sheet(book, guide, "Guide");
    XLSX.writeFile(book, "product_batch_upload_template.xlsx");
  };

  const buildRows = (rawRows) => {
    if (rawRows.length === 0) throw new Error("The file has no rows.");
    const headerRow = rawRows[0].map(normalizeHeader);

    const fieldIndex = {};
    const priceColumns = []; // { index, sales_type }
    const salesTypeByKey = new Map(salesTypes.map((t) => [normalizeHeader(t), t]));
    const unknownHeaders = [];

    headerRow.forEach((header, index) => {
      if (!header) return;
      const field = HEADER_ALIASES[header];
      if (field) {
        if (fieldIndex[field] === undefined) fieldIndex[field] = index;
        return;
      }
      const salesType =
        salesTypeByKey.get(header) || salesTypeByKey.get(stripPriceWords(header));
      if (salesType) {
        priceColumns.push({ index, sales_type: salesType });
        return;
      }
      unknownHeaders.push(rawRows[0][index]);
    });

    if (fieldIndex.item_name === undefined) {
      throw new Error('Missing a "Product Name" column. Download the template to get the right columns.');
    }
    if (fieldIndex.item_category === undefined) {
      throw new Error('Missing a "Category" column. Download the template to get the right columns.');
    }
    if (priceColumns.length === 0) {
      throw new Error(
        `No sales type price columns found. Column names must match a sales type: ${salesTypes.join(", ") || "none set up"}.`,
      );
    }

    const cell = (raw, field) =>
      fieldIndex[field] === undefined ? "" : raw[fieldIndex[field]];

    const seen = new Map(); // lower name -> first row
    const parsed = [];
    for (let i = 1; i < rawRows.length; i++) {
      const raw = rawRows[i] || [];
      if (raw.every((v) => String(v ?? "").trim() === "")) continue;

      const rowNumber = i + 1; // spreadsheet row number
      const errors = [];
      const item_name = String(cell(raw, "item_name") ?? "").trim();
      const item_category = String(cell(raw, "item_category") ?? "").trim().toUpperCase();
      const unit_of_measure =
        String(cell(raw, "unit_of_measure") ?? "").trim().toUpperCase() || "PC";
      const vatable = parseYesNo(cell(raw, "vatable"));
      const discountable = parseYesNo(cell(raw, "isDiscountable"));

      if (!item_name) errors.push("Product name is required.");
      else if (item_name.length > 255) errors.push("Product name is too long.");
      if (!item_category) errors.push("Category is required.");
      if (vatable.error) errors.push("Vatable must be Yes or No.");
      if (discountable.error) errors.push("Discountable must be Yes or No.");

      const prices = [];
      priceColumns.forEach(({ index, sales_type }) => {
        const price = parsePrice(raw[index]);
        if (price.empty) return;
        if (price.error) errors.push(`Invalid price for ${sales_type}.`);
        else prices.push({ sales_type, srp: price.value });
      });
      if (prices.length === 0 && !errors.some((e) => e.startsWith("Invalid price"))) {
        errors.push("Enter at least one price.");
      }

      const key = item_name.toLowerCase();
      if (item_name) {
        if (existingNameSet.has(key)) errors.push("Product already exists.");
        else if (seen.has(key)) errors.push(`Same name as row ${seen.get(key)}.`);
        else seen.set(key, rowNumber);
      }

      parsed.push({
        row: rowNumber,
        item_name,
        item_category,
        unit_of_measure,
        vatable: vatable.value || "Yes",
        isDiscountable: discountable.value || "Yes",
        prices,
        errors,
      });
    }

    if (parsed.length === 0) throw new Error("The file has no product rows.");
    if (parsed.length > MAX_ROWS) {
      throw new Error(`The file has ${parsed.length} products. Upload at most ${MAX_ROWS} at a time.`);
    }
    return { parsed, unknownHeaders };
  };

  const handleFile = async (file) => {
    if (!file) return;
    setFileError("");
    setResults({});
    setRows([]);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const book = XLSX.read(buffer, { type: "array" });
      const sheetName = book.SheetNames.includes("Products")
        ? "Products"
        : book.SheetNames[0];
      const rawRows = XLSX.utils.sheet_to_json(book.Sheets[sheetName], {
        header: 1,
        defval: "",
        raw: true,
      });
      const { parsed, unknownHeaders } = buildRows(rawRows);
      setRows(parsed);
      if (unknownHeaders.length) {
        setFileError(`Ignored columns: ${unknownHeaders.join(", ")}.`);
      }
    } catch (err) {
      setFileError(err.message || "Could not read the file.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    const toSend = readyRows;
    if (toSend.length === 0) return;
    setIsUploading(true);
    setFileError("");
    setProgress({ done: 0, total: toSend.length });

    let added = 0;
    try {
      for (let start = 0; start < toSend.length; start += CHUNK_SIZE) {
        const chunk = toSend.slice(start, start + CHUNK_SIZE);
        const response = await fetch(`${apiHost}${PRICING_MUTATION_PATH}`, {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            action: "batch_add",
            products: chunk.map((row) => ({
              row: row.row,
              item_name: row.item_name,
              item_category: row.item_category,
              unit_of_measure: row.unit_of_measure,
              vatable: row.vatable,
              isDiscountable: row.isDiscountable,
              prices: row.prices,
            })),
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result?.status !== "success") {
          throw new Error(result?.message || "Upload failed.");
        }
        const next = {};
        (Array.isArray(result.results) ? result.results : []).forEach((r) => {
          next[r.row] = { status: r.status, message: r.message || "" };
          if (r.status === "success") added++;
        });
        setResults((prev) => ({ ...prev, ...next }));
        setProgress({ done: Math.min(start + chunk.length, toSend.length), total: toSend.length });
      }
    } catch (err) {
      setFileError(err.message || "Upload failed.");
    } finally {
      setIsUploading(false);
      if (added > 0) onUploaded?.({ added });
    }
  };

  const statusCell = (row) => {
    const result = results[row.row];
    if (result?.status === "success") {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-500">
          <FaCheckCircle size={11} /> Saved
        </span>
      );
    }
    const messages = result?.status === "error" ? [result.message] : row.errors;
    if (messages.length > 0) {
      return (
        <span className="inline-flex items-start gap-1 text-rose-500">
          <FaExclamationTriangle size={11} className="mt-0.5 flex-shrink-0" />
          <span>{messages.join(" ")}</span>
        </span>
      );
    }
    return <span className="text-blue-500">Ready</span>;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        className={`flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border-2 shadow-2xl ${theme.panel}`}
      >
        {/* Header */}
        <div className={`flex items-start justify-between gap-4 border-b-2 px-7 py-5 ${theme.row}`}>
          <div>
            <h3 className={`text-lg font-black uppercase tracking-tight ${theme.title}`}>
              Batch Upload Products
            </h3>
            <p className={`mt-0.5 text-[11px] font-bold ${theme.label}`}>
              Fill the template in Excel, then upload it. Each row becomes a product with
              a price for every sales type you fill in.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className={`rounded-xl border-2 p-2 transition-all ${theme.row} ${theme.label} hover:text-rose-500`}
          >
            <FaTimes size={12} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-7 py-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
            <button
              type="button"
              onClick={downloadTemplate}
              disabled={salesTypesLoading || salesTypes.length === 0}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 px-4 py-6 text-center transition-all disabled:opacity-50 ${theme.row} ${theme.title} hover:border-blue-400`}
            >
              {salesTypesLoading ? (
                <FaSpinner className="animate-spin text-blue-500" size={20} />
              ) : (
                <FaDownload className="text-blue-500" size={20} />
              )}
              <span className="text-[10px] font-black uppercase tracking-widest">
                1. Download Template
              </span>
              <span className={`text-[10px] font-bold ${theme.label}`}>
                {salesTypes.length
                  ? `${salesTypes.length} sales type column${salesTypes.length > 1 ? "s" : ""}`
                  : salesTypesLoading
                    ? "Loading sales types..."
                    : "No sales types found"}
              </span>
            </button>

            <label
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (!isUploading) handleFile(e.dataTransfer.files?.[0]);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-all ${
                isDragging ? theme.zoneOn : theme.zone
              } ${isUploading || salesTypesLoading ? "pointer-events-none opacity-50" : ""}`}
            >
              <FaFileUpload className="text-blue-500" size={20} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${theme.title}`}>
                2. Choose or drop the filled file
              </span>
              <span className={`text-[10px] font-bold ${theme.label}`}>
                {fileName || ".xlsx, .xls or .csv"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
          </div>

          {fileError && (
            <div className="flex items-start gap-2 rounded-2xl border-2 border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-600">
              <FaExclamationTriangle className="mt-0.5 flex-shrink-0" />
              <span>{fileError}</span>
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                <span className={`rounded-full border-2 px-3 py-1 ${theme.row} ${theme.label}`}>
                  {rows.length} row{rows.length > 1 ? "s" : ""}
                </span>
                {!hasUploaded && (
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-blue-500">
                    {readyRows.length} ready
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="rounded-full bg-rose-500/10 px-3 py-1 text-rose-500">
                    {errorCount} with errors (skipped)
                  </span>
                )}
                {savedCount > 0 && (
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-500">
                    {savedCount} saved
                  </span>
                )}
                {failedCount > 0 && (
                  <span className="rounded-full bg-rose-500/10 px-3 py-1 text-rose-500">
                    {failedCount} failed on save
                  </span>
                )}
              </div>

              <div className={`overflow-x-auto rounded-2xl border-2 ${theme.row}`}>
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead>
                    <tr className={`text-[10px] font-black uppercase tracking-widest ${theme.head}`}>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Unit</th>
                      <th className="px-3 py-2">VAT / Disc</th>
                      <th className="px-3 py-2">Prices</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.row} className={`border-t ${theme.row} ${theme.title} font-bold`}>
                        <td className={`px-3 py-2 ${theme.label}`}>{row.row}</td>
                        <td className="px-3 py-2">{row.item_name || "—"}</td>
                        <td className="px-3 py-2">{row.item_category || "—"}</td>
                        <td className="px-3 py-2">{row.unit_of_measure}</td>
                        <td className="px-3 py-2">
                          {row.vatable} / {row.isDiscountable}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {row.prices.map((p) => (
                              <span
                                key={p.sales_type}
                                className={`whitespace-nowrap rounded-lg border px-2 py-0.5 text-[10px] ${theme.row}`}
                              >
                                {p.sales_type} ₱{p.srp.toFixed(2)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="max-w-[240px] px-3 py-2 text-[11px]">{statusCell(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`flex gap-3 border-t-2 px-7 py-5 ${theme.row}`}>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className={`flex-1 rounded-2xl border-2 py-3.5 text-[10px] font-black uppercase tracking-widest transition-all ${theme.row} ${theme.label}`}
          >
            {hasUploaded ? "Done" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={isUploading || readyRows.length === 0}
            className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-60"
          >
            {isUploading ? <FaSpinner className="animate-spin" /> : <FaUpload />}
            {isUploading
              ? `Uploading ${progress.done}/${progress.total}...`
              : readyRows.length
                ? `Upload ${readyRows.length} product${readyRows.length > 1 ? "s" : ""}`
                : "Nothing to upload"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchUploadProductModal;
