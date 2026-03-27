import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FaTimes, FaCalendarAlt, FaDownload, FaFileCode } from "react-icons/fa";
import { useTheme } from "../../context/ThemeContext";
import useApiHost from "../../hooks/useApiHost";

const peso = (value) => {
  const num = Number(value || 0);
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const getTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDateFromShiftOpening = () => {
  const shiftDateTime = localStorage.getItem("posShiftOpeningDateTime") || "";

  if (!shiftDateTime) return getTodayDate();

  const normalized = shiftDateTime.replace(" ", "T");
  const dateObj = new Date(normalized);

  if (Number.isNaN(dateObj.getTime())) {
    const rawDate = shiftDateTime.split(" ")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return rawDate;
    }
    return getTodayDate();
  }

  const year = dateObj.getFullYear();
  const month = `${dateObj.getMonth() + 1}`.padStart(2, "0");
  const day = `${dateObj.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const downloadTextFile = (
  filename,
  content,
  contentType = "application/xml",
) => {
  const blob = new Blob([content], { type: `${contentType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const escapeXml = (unsafe) => {
  return String(unsafe ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const xmlTag = (name, value, indent = "  ") =>
  `${indent}<${name}>${escapeXml(value)}</${name}>`;

const buildSalesXml = (payload) => {
  const data = payload?.data || {};
  const sales = data.sales || {};
  const transactions = Array.isArray(data.transactions)
    ? data.transactions
    : [];
  const tenantId = data.tenantId || "19092784";
  const tenantKey = data.tenantKey || "K9BRJGJS";
  const terminal = data.terminalNumber || "1";
  const reportDate = data.reportDateXml || "";
  const zCounter = sales.zcounter || "0";

  const lines = [];

  lines.push(`<?xml version="1.0" encoding="utf-8"?>`);
  lines.push(`<root>`);

  lines.push(`  <id>`);
  lines.push(xmlTag("tenantid", tenantId, "    "));
  lines.push(xmlTag("key", tenantKey, "    "));
  lines.push(xmlTag("tmid", terminal, "    "));
  lines.push(xmlTag("doc", "SALES_EOD", "    "));
  lines.push(`  </id>`);

  lines.push(`  <sales>`);
  lines.push(xmlTag("date", reportDate, "    "));
  lines.push(xmlTag("zcounter", sales.zcounter, "    "));
  lines.push(xmlTag("previousnrgt", sales.previousnrgt, "    "));
  lines.push(xmlTag("nrgt", sales.nrgt, "    "));
  lines.push(xmlTag("previoustax", sales.previoustax, "    "));
  lines.push(xmlTag("newtax", sales.newtax, "    "));
  lines.push(xmlTag("previoustaxsale", sales.previoustaxsale, "    "));
  lines.push(xmlTag("newtaxsale", sales.newtaxsale, "    "));
  lines.push(xmlTag("previousnotaxsale", sales.previousnotaxsale, "    "));
  lines.push(xmlTag("newnotaxsale", sales.newnotaxsale, "    "));
  lines.push(xmlTag("opentime", sales.opentime, "    "));
  lines.push(xmlTag("closetime", sales.closetime, "    "));
  lines.push(xmlTag("gross", sales.gross, "    "));
  lines.push(xmlTag("vat", sales.vat, "    "));
  lines.push(xmlTag("localtax", sales.localtax, "    "));
  lines.push(xmlTag("amusement", sales.amusement, "    "));
  lines.push(xmlTag("ewt", sales.ewt, "    "));
  lines.push(xmlTag("taxsale", sales.taxsale, "    "));
  lines.push(xmlTag("notaxsale", sales.notaxsale, "    "));
  lines.push(xmlTag("zerosale", sales.zerosale, "    "));
  lines.push(xmlTag("vatexempt", sales.vatexempt, "    "));
  lines.push(xmlTag("void", sales.void, "    "));
  lines.push(xmlTag("voidcnt", sales.voidcnt, "    "));
  lines.push(xmlTag("disc", sales.disc, "    "));
  lines.push(xmlTag("disccnt", sales.disccnt, "    "));
  lines.push(xmlTag("refund", sales.refund, "    "));
  lines.push(xmlTag("refundcnt", sales.refundcnt, "    "));
  lines.push(xmlTag("senior", sales.senior, "    "));
  lines.push(xmlTag("seniorcnt", sales.seniorcnt, "    "));
  lines.push(xmlTag("pwd", sales.pwd, "    "));
  lines.push(xmlTag("pwdcnt", sales.pwdcnt, "    "));
  lines.push(xmlTag("diplomat", sales.diplomat, "    "));
  lines.push(xmlTag("diplomatcnt", sales.diplomatcnt, "    "));
  lines.push(xmlTag("nac", sales.nac, "    "));
  lines.push(xmlTag("naccnt", sales.naccnt, "    "));
  lines.push(xmlTag("service", sales.service, "    "));
  lines.push(xmlTag("servicecnt", sales.servicecnt, "    "));
  lines.push(xmlTag("receiptstart", sales.receiptstart, "    "));
  lines.push(xmlTag("receiptend", sales.receiptend, "    "));
  lines.push(xmlTag("trxcnt", sales.trxcnt, "    "));
  lines.push(xmlTag("cash", sales.cash, "    "));
  lines.push(xmlTag("cashcnt", sales.cashcnt, "    "));
  lines.push(xmlTag("credit", sales.credit, "    "));
  lines.push(xmlTag("creditcnt", sales.creditcnt, "    "));
  lines.push(xmlTag("charge", sales.charge, "    "));
  lines.push(xmlTag("chargecnt", sales.chargecnt, "    "));
  lines.push(xmlTag("giftcheck", sales.giftcheck, "    "));
  lines.push(xmlTag("giftcheckcnt", sales.giftcheckcnt, "    "));
  lines.push(xmlTag("othertender", sales.othertender, "    "));
  lines.push(xmlTag("othertendercnt", sales.othertendercnt, "    "));
  lines.push(`  </sales>`);

  transactions.forEach((trx) => {
    lines.push(`  <trx>`);
    lines.push(xmlTag("receiptno", trx.receiptno, "    "));
    lines.push(xmlTag("void", trx.void, "    "));
    lines.push(xmlTag("cash", trx.cash, "    "));
    lines.push(xmlTag("credit", trx.credit, "    "));
    lines.push(xmlTag("charge", trx.charge, "    "));
    lines.push(xmlTag("giftcheck", trx.giftcheck, "    "));
    lines.push(xmlTag("othertender", trx.othertender, "    "));
    lines.push(xmlTag("linedisc", trx.linedisc, "    "));
    lines.push(xmlTag("linesenior", trx.linesenior, "    "));
    lines.push(xmlTag("evat", trx.evat, "    "));
    lines.push(xmlTag("linepwd", trx.linepwd, "    "));
    lines.push(xmlTag("linediplomat", trx.linediplomat, "    "));
    lines.push(xmlTag("linenac", trx.linenac, "    "));
    lines.push(xmlTag("subtotal", trx.subtotal, "    "));
    lines.push(xmlTag("disc", trx.disc, "    "));
    lines.push(xmlTag("senior", trx.senior, "    "));
    lines.push(xmlTag("pwd", trx.pwd, "    "));
    lines.push(xmlTag("diplomat", trx.diplomat, "    "));
    lines.push(xmlTag("nac", trx.nac, "    "));
    lines.push(xmlTag("vat", trx.vat, "    "));
    lines.push(xmlTag("exvat", trx.exvat, "    "));
    lines.push(xmlTag("incvat", trx.incvat, "    "));
    lines.push(xmlTag("localtax", trx.localtax, "    "));
    lines.push(xmlTag("amusement", trx.amusement, "    "));
    lines.push(xmlTag("ewt", trx.ewt, "    "));
    lines.push(xmlTag("service", trx.service, "    "));
    lines.push(xmlTag("taxsale", trx.taxsale, "    "));
    lines.push(xmlTag("notaxsale", trx.notaxsale, "    "));
    lines.push(xmlTag("taxexsale", trx.taxexsale, "    "));
    lines.push(xmlTag("taxincsale", trx.taxincsale, "    "));
    lines.push(xmlTag("zerosale", trx.zerosale, "    "));
    lines.push(xmlTag("vatexempt", trx.vatexempt, "    "));
    lines.push(xmlTag("customercount", trx.customercount, "    "));
    lines.push(xmlTag("gross", trx.gross, "    "));
    lines.push(xmlTag("refund", trx.refund, "    "));
    lines.push(xmlTag("taxrate", trx.taxrate, "    "));
    lines.push(xmlTag("posted", trx.posted, "    "));
    lines.push(xmlTag("qty", trx.qty, "    "));
    lines.push(xmlTag("created", trx.created, "    "));
    lines.push(xmlTag("memo", trx.memo, "    "));

    (trx.lines || []).forEach((line) => {
      lines.push(`    <line>`);
      lines.push(xmlTag("sku", line.sku, "      "));
      lines.push(xmlTag("qty", line.qty, "      "));
      lines.push(xmlTag("unitprice", line.unitprice, "      "));
      lines.push(xmlTag("disc", line.disc, "      "));
      lines.push(xmlTag("senior", line.senior, "      "));
      lines.push(xmlTag("pwd", line.pwd, "      "));
      lines.push(xmlTag("diplomat", line.diplomat, "      "));
      lines.push(xmlTag("nac", line.nac, "      "));
      lines.push(xmlTag("taxtype", line.taxtype, "      "));
      lines.push(xmlTag("tax", line.tax, "      "));
      lines.push(xmlTag("memo", line.memo, "      "));
      lines.push(xmlTag("total", line.total, "      "));
      lines.push(xmlTag("choicetype", line.choicetype, "      "));
      lines.push(`    </line>`);
    });

    lines.push(`  </trx>`);
  });

  lines.push(`</root>`);

  return {
    filename: `sales_${tenantId}_${terminal}_${String(zCounter || "0").padStart(5, "0")}.xml`,
    content: lines.join("\n"),
  };
};

export default function ModalXml({ isOpen, onClose }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
    const apiHost = useApiHost();

  const [form, setForm] = useState({
    categoryCode: localStorage.getItem("posBusinessCategoryCode") || "",
    unitCode: localStorage.getItem("posBusinessUnitCode") || "",
    terminalNumber: "1",
    reportDate: getDateFromShiftOpening(),
    tenantId: "19092784",
    tenantKey: "K9BRJGJS",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState(null);

  const xmlPreview = useMemo(() => {
    if (!response?.success) return "";
    return buildSalesXml(response).content;
  }, [response]);

  if (!isOpen) return null;

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerate = async () => {
    try {
      setIsLoading(true);
      setError("");

      const categoryCode =
        localStorage.getItem("posBusinessCategoryCode") ||
        form.categoryCode ||
        "";
      const unitCode =
        localStorage.getItem("posBusinessUnitCode") || form.unitCode || "";
      const reportDate = form.reportDate || getDateFromShiftOpening();

      if (!categoryCode) {
        throw new Error("Category code is missing in local storage.");
      }

      if (!unitCode) {
        throw new Error("Unit code is missing in local storage.");
      }

      if (!reportDate) {
        throw new Error("Please select a report date.");
      }

      const res = await fetch(
        `${apiHost}/api/generate_sales_xml.php`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            categoryCode,
            unitCode,
            terminalNumber: form.terminalNumber,
            reportDate,
            tenantId: form.tenantId,
            tenantKey: form.tenantKey,
          }),
        },
      );

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(
          result?.message || "Failed to generate sales XML data.",
        );
      }

      setResponse(result);
      setForm((prev) => ({
        ...prev,
        categoryCode,
        unitCode,
        reportDate,
      }));
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setResponse(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!response?.success) return;
    const xml = buildSalesXml(response);
    downloadTextFile(xml.filename, xml.content, "application/xml");
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[100000] flex items-center justify-center p-4 backdrop-blur-sm ${
        isDark ? "bg-black/70" : "bg-slate-900/45"
      }`}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className={`relative flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[30px] border shadow-2xl ${
          isDark
            ? "border-white/10 bg-[#0f172a]"
            : "border-slate-200 bg-[#f8fafc]"
        }`}
      >
        <div
          className={`border-b px-6 py-5 sm:px-8 ${
            isDark
              ? "border-white/10 bg-white/[0.03]"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div
                className={`text-sm font-semibold ${
                  isDark ? "text-emerald-400" : "text-emerald-600"
                }`}
              >
                XML Generator
              </div>
              <h2
                className={`mt-1 text-2xl font-black sm:text-3xl ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Generate Sales XML
              </h2>
              <p
                className={`mt-1 text-sm ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Category code, unit code, and report date are loaded from local
                storage.
              </p>
            </div>

            <button
              onClick={onClose}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                isDark
                  ? "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-rose-500 hover:text-white"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-rose-500 hover:text-white"
              }`}
            >
              <FaTimes size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6 sm:px-8">
          <div className="grid gap-6 xl:grid-cols-[380px,1fr]">
            <div
              className={`rounded-3xl border p-5 shadow-sm ${
                isDark
                  ? "border-white/10 bg-white/[0.04]"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="grid gap-4">
                <div>
                  <label
                    className={`mb-1 block text-sm font-bold ${
                      isDark ? "text-slate-200" : "text-slate-700"
                    }`}
                  >
                    Category Code
                  </label>
                  <input
                    value={form.categoryCode}
                    readOnly
                    className={`w-full rounded-2xl border px-4 py-3 outline-none ${
                      isDark
                        ? "border-white/10 bg-slate-900 text-white"
                        : "border-slate-300 bg-slate-50 text-slate-900"
                    }`}
                    placeholder="Category Code"
                  />
                </div>

                <div>
                  <label
                    className={`mb-1 block text-sm font-bold ${
                      isDark ? "text-slate-200" : "text-slate-700"
                    }`}
                  >
                    Unit Code
                  </label>
                  <input
                    value={form.unitCode}
                    readOnly
                    className={`w-full rounded-2xl border px-4 py-3 outline-none ${
                      isDark
                        ? "border-white/10 bg-slate-900 text-white"
                        : "border-slate-300 bg-slate-50 text-slate-900"
                    }`}
                    placeholder="Unit Code"
                  />
                </div>

                <div>
                  <label
                    className={`mb-1 block text-sm font-bold ${
                      isDark ? "text-slate-200" : "text-slate-700"
                    }`}
                  >
                    Terminal Number
                  </label>
                  <input
                    value={form.terminalNumber}
                    onChange={(e) =>
                      handleChange("terminalNumber", e.target.value)
                    }
                    className={`w-full rounded-2xl border px-4 py-3 outline-none ${
                      isDark
                        ? "border-white/10 bg-slate-900 text-white placeholder:text-slate-500 focus:border-emerald-500"
                        : "border-slate-300 bg-white text-slate-900 focus:border-emerald-500"
                    }`}
                    placeholder="1"
                  />
                </div>

                <div>
                  <label
                    className={`mb-1 flex items-center gap-2 text-sm font-bold ${
                      isDark ? "text-slate-200" : "text-slate-700"
                    }`}
                  >
                    <FaCalendarAlt />
                    Report Date
                  </label>
                  <input
                    type="date"
                    value={form.reportDate}
                    onChange={(e) => handleChange("reportDate", e.target.value)}
                    className={`w-full rounded-2xl border px-4 py-3 outline-none ${
                      isDark
                        ? "border-emerald-500/40 bg-slate-900 text-white focus:border-emerald-500"
                        : "border-slate-300 bg-white text-slate-900 focus:border-emerald-500"
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`mb-1 block text-sm font-bold ${
                      isDark ? "text-slate-200" : "text-slate-700"
                    }`}
                  >
                    Tenant ID
                  </label>
                  <input
                    value={form.tenantId}
                    onChange={(e) => handleChange("tenantId", e.target.value)}
                    className={`w-full rounded-2xl border px-4 py-3 outline-none ${
                      isDark
                        ? "border-white/10 bg-slate-900 text-white placeholder:text-slate-500 focus:border-emerald-500"
                        : "border-slate-300 bg-white text-slate-900 focus:border-emerald-500"
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`mb-1 block text-sm font-bold ${
                      isDark ? "text-slate-200" : "text-slate-700"
                    }`}
                  >
                    Tenant Key
                  </label>
                  <input
                    value={form.tenantKey}
                    onChange={(e) => handleChange("tenantKey", e.target.value)}
                    className={`w-full rounded-2xl border px-4 py-3 outline-none ${
                      isDark
                        ? "border-white/10 bg-slate-900 text-white placeholder:text-slate-500 focus:border-emerald-500"
                        : "border-slate-300 bg-white text-slate-900 focus:border-emerald-500"
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="rounded-2xl bg-blue-600 px-4 py-3 font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading ? "Loading..." : "Generate"}
                  </button>

                  <button
                    onClick={handleDownload}
                    disabled={!response?.success || isLoading}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FaDownload />
                    Download
                  </button>
                </div>

                {error ? (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                      isDark
                        ? "border-red-500/30 bg-red-500/10 text-red-300"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {error}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-6">
              <div
                className={`rounded-3xl border p-5 shadow-sm ${
                  isDark
                    ? "border-white/10 bg-white/[0.04]"
                    : "border-slate-200 bg-white"
                }`}
              >
                <h2
                  className={`mb-4 text-lg font-black ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Summary
                </h2>

                {!response?.success ? (
                  <p className={isDark ? "text-slate-400" : "text-slate-500"}>
                    No generated data yet.
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div
                      className={`rounded-2xl p-4 ${
                        isDark ? "bg-slate-900/80" : "bg-slate-50"
                      }`}
                    >
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Z Counter
                      </div>
                      <div
                        className={`mt-2 text-2xl font-black ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      >
                        {response.data.sales.zcounter}
                      </div>
                    </div>

                    <div
                      className={`rounded-2xl p-4 ${
                        isDark ? "bg-slate-900/80" : "bg-slate-50"
                      }`}
                    >
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Gross
                      </div>
                      <div
                        className={`mt-2 text-2xl font-black ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      >
                        ₱ {peso(response.data.sales.gross)}
                      </div>
                    </div>

                    <div
                      className={`rounded-2xl p-4 ${
                        isDark ? "bg-slate-900/80" : "bg-slate-50"
                      }`}
                    >
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Cash
                      </div>
                      <div
                        className={`mt-2 text-2xl font-black ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      >
                        ₱ {peso(response.data.sales.cash)}
                      </div>
                    </div>

                    <div
                      className={`rounded-2xl p-4 ${
                        isDark ? "bg-slate-900/80" : "bg-slate-50"
                      }`}
                    >
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Transactions
                      </div>
                      <div
                        className={`mt-2 text-2xl font-black ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      >
                        {response.data.sales.trxcnt}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div
                className={`rounded-3xl border p-5 shadow-sm ${
                  isDark
                    ? "border-white/10 bg-white/[0.04]"
                    : "border-slate-200 bg-white"
                }`}
              >
                <h2
                  className={`mb-4 flex items-center gap-2 text-lg font-black ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  <FaFileCode />
                  XML Preview
                </h2>

                <pre className="max-h-[500px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-emerald-300">
                  {xmlPreview || "No XML generated yet."}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
