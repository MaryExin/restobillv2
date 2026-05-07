import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  FaTimes,
  FaCalendarAlt,
  FaDownload,
  FaFileCode,
  FaBoxes,
  FaCashRegister,
} from "react-icons/fa";
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
  const affectedProducts = Array.isArray(data.affectedProducts)
    ? data.affectedProducts
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

  lines.push(`  <master>`);
  affectedProducts.forEach((product) => {
    lines.push(`    <product>`);
    lines.push(xmlTag("sku", product?.sku ?? "", "      "));
    lines.push(xmlTag("name", product?.name ?? "", "      "));
    lines.push(xmlTag("inventory", product?.inventory ?? "1", "      "));
    lines.push(xmlTag("price", product?.price ?? "0.00", "      "));
    lines.push(xmlTag("category", product?.category ?? "99", "      "));
    lines.push(`    </product>`);
  });
  lines.push(`  </master>`);

  lines.push(`</root>`);

  return {
    filename: `sales_${tenantId}_${terminal}_${String(zCounter || "0").padStart(5, "0")}.xml`,
    content: lines.join("\n"),
  };
};

const summaryCardBase = "rounded-[24px] border p-4 transition-all duration-200";

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

  const affectedProducts = useMemo(() => {
    if (!response?.success) return [];
    return Array.isArray(response?.data?.affectedProducts)
      ? response.data.affectedProducts
      : [];
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

      const res = await fetch(`${apiHost}/api/generate_sales_xml.php`, {
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
      });

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
      className={`fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-5 ${
        isDark ? "bg-black/70" : "bg-slate-900/40"
      } backdrop-blur-md`}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className={`relative flex h-[94vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-[32px] border shadow-[0_30px_80px_rgba(0,0,0,0.18)] ${
          isDark
            ? "border-white/10 bg-slate-950"
            : "border-slate-200 bg-slate-100"
        }`}
      >
        <div
          className={`shrink-0 border-b px-5 py-5 sm:px-8 sm:py-6 ${
            isDark
              ? "border-white/10 bg-white/[0.03]"
              : "border-slate-200 bg-white/80"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div
                className={`text-sm font-extrabold tracking-wide ${
                  isDark ? "text-emerald-400" : "text-emerald-600"
                }`}
              >
                XML Generator
              </div>
              <h2
                className={`mt-1 text-3xl font-black leading-tight sm:text-4xl ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Generate Sales XML
              </h2>
              <p
                className={`mt-2 text-sm sm:text-base ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Category code, unit code, and report date are loaded from local
                storage.
              </p>
            </div>

            <button
              onClick={onClose}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition ${
                isDark
                  ? "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-rose-500 hover:text-white"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-rose-500 hover:text-white"
              }`}
            >
              <FaTimes size={17} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="grid h-full min-h-0 grid-cols-1 gap-5 overflow-hidden p-4 sm:p-6 xl:grid-cols-[360px,minmax(0,1fr)]">
            <div
              className={`min-h-0 overflow-auto rounded-[28px] border p-5 ${
                isDark
                  ? "border-white/10 bg-white/[0.04]"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="space-y-4">
                <div>
                  <label
                    className={`mb-2 block text-sm font-extrabold ${
                      isDark ? "text-slate-200" : "text-slate-700"
                    }`}
                  >
                    Category Code
                  </label>
                  <input
                    value={form.categoryCode}
                    readOnly
                    className={`w-full rounded-2xl border px-4 py-3.5 text-base outline-none ${
                      isDark
                        ? "border-white/10 bg-slate-900 text-white"
                        : "border-slate-300 bg-slate-50 text-slate-900"
                    }`}
                    placeholder="Category Code"
                  />
                </div>

                <div>
                  <label
                    className={`mb-2 block text-sm font-extrabold ${
                      isDark ? "text-slate-200" : "text-slate-700"
                    }`}
                  >
                    Unit Code
                  </label>
                  <input
                    value={form.unitCode}
                    readOnly
                    className={`w-full rounded-2xl border px-4 py-3.5 text-base outline-none ${
                      isDark
                        ? "border-white/10 bg-slate-900 text-white"
                        : "border-slate-300 bg-slate-50 text-slate-900"
                    }`}
                    placeholder="Unit Code"
                  />
                </div>

                <div>
                  <label
                    className={`mb-2 block text-sm font-extrabold ${
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
                    className={`w-full rounded-2xl border px-4 py-3.5 text-base outline-none transition ${
                      isDark
                        ? "border-white/10 bg-slate-900 text-white placeholder:text-slate-500 focus:border-emerald-500"
                        : "border-slate-300 bg-white text-slate-900 focus:border-emerald-500"
                    }`}
                    placeholder="1"
                  />
                </div>

                <div>
                  <label
                    className={`mb-2 flex items-center gap-2 text-sm font-extrabold ${
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
                    className={`w-full rounded-2xl border px-4 py-3.5 text-base outline-none transition ${
                      isDark
                        ? "border-emerald-500/40 bg-slate-900 text-white focus:border-emerald-500"
                        : "border-slate-300 bg-white text-slate-900 focus:border-emerald-500"
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`mb-2 block text-sm font-extrabold ${
                      isDark ? "text-slate-200" : "text-slate-700"
                    }`}
                  >
                    Tenant ID
                  </label>
                  <input
                    value={form.tenantId}
                    onChange={(e) => handleChange("tenantId", e.target.value)}
                    className={`w-full rounded-2xl border px-4 py-3.5 text-base outline-none transition ${
                      isDark
                        ? "border-white/10 bg-slate-900 text-white placeholder:text-slate-500 focus:border-emerald-500"
                        : "border-slate-300 bg-white text-slate-900 focus:border-emerald-500"
                    }`}
                  />
                </div>

                <div>
                  <label
                    className={`mb-2 block text-sm font-extrabold ${
                      isDark ? "text-slate-200" : "text-slate-700"
                    }`}
                  >
                    Tenant Key
                  </label>
                  <input
                    value={form.tenantKey}
                    onChange={(e) => handleChange("tenantKey", e.target.value)}
                    className={`w-full rounded-2xl border px-4 py-3.5 text-base outline-none transition ${
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
                    className="rounded-2xl bg-blue-600 px-4 py-3.5 text-base font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading ? "Loading..." : "Generate"}
                  </button>

                  <button
                    onClick={handleDownload}
                    disabled={!response?.success || isLoading}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3.5 text-base font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
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

            <div className="min-h-0 overflow-auto">
              <div className="space-y-5">
                <div
                  className={`rounded-[28px] border p-5 ${
                    isDark
                      ? "border-white/10 bg-white/[0.04]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <h3
                    className={`mb-4 text-xl font-black ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Summary
                  </h3>

                  {!response?.success ? (
                    <p className={isDark ? "text-slate-400" : "text-slate-500"}>
                      No generated data yet.
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div
                        className={`${summaryCardBase} ${
                          isDark
                            ? "border-white/10 bg-slate-900/80"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                          Z Counter
                        </div>
                        <div
                          className={`mt-3 text-3xl font-black ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}
                        >
                          {response.data.sales.zcounter}
                        </div>
                      </div>

                      <div
                        className={`${summaryCardBase} ${
                          isDark
                            ? "border-white/10 bg-slate-900/80"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                          Gross
                        </div>
                        <div
                          className={`mt-3 text-3xl font-black ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}
                        >
                          ₱ {peso(response.data.sales.gross)}
                        </div>
                      </div>

                      <div
                        className={`${summaryCardBase} ${
                          isDark
                            ? "border-white/10 bg-slate-900/80"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                          Cash
                        </div>
                        <div
                          className={`mt-3 text-3xl font-black ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}
                        >
                          ₱ {peso(response.data.sales.cash)}
                        </div>
                      </div>

                      <div
                        className={`${summaryCardBase} ${
                          isDark
                            ? "border-white/10 bg-slate-900/80"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                          <FaCashRegister />
                          Transactions
                        </div>
                        <div
                          className={`mt-3 text-3xl font-black ${
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
                  className={`rounded-[28px] border p-5 ${
                    isDark
                      ? "border-white/10 bg-white/[0.04]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3
                      className={`flex items-center gap-2 text-xl font-black ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}
                    >
                      <FaBoxes />
                      Affected Products
                    </h3>

                    {response?.success ? (
                      <div
                        className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${
                          isDark
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {affectedProducts.length} Items
                      </div>
                    ) : null}
                  </div>

                  {!response?.success ? (
                    <p className={isDark ? "text-slate-400" : "text-slate-500"}>
                      No affected products yet.
                    </p>
                  ) : affectedProducts.length === 0 ? (
                    <p className={isDark ? "text-slate-400" : "text-slate-500"}>
                      No affected products found.
                    </p>
                  ) : (
                    <div
                      className={`overflow-hidden rounded-[22px] border ${
                        isDark ? "border-white/10" : "border-slate-200"
                      }`}
                    >
                      <div className="max-h-[320px] overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead
                            className={`sticky top-0 z-10 ${
                              isDark
                                ? "bg-slate-900 text-slate-200"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            <tr>
                              <th className="px-4 py-3 text-left font-black">
                                SKU
                              </th>
                              <th className="px-4 py-3 text-left font-black">
                                Name
                              </th>
                              <th className="px-4 py-3 text-left font-black">
                                Type
                              </th>
                              <th className="px-4 py-3 text-right font-black">
                                Price
                              </th>
                              <th className="px-4 py-3 text-left font-black">
                                Category
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {affectedProducts.map((product, index) => (
                              <tr
                                key={`${product.product_id || product.sku || "row"}-${index}`}
                                className={
                                  isDark
                                    ? "border-t border-white/10 text-slate-300"
                                    : "border-t border-slate-200 text-slate-700"
                                }
                              >
                                <td className="px-4 py-3 font-semibold">
                                  {product.sku}
                                </td>
                                <td className="px-4 py-3">
                                  {product.name || "-"}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                      String(product.inventory) === "1"
                                        ? isDark
                                          ? "bg-blue-500/15 text-blue-300"
                                          : "bg-blue-50 text-blue-700"
                                        : isDark
                                          ? "bg-amber-500/15 text-amber-300"
                                          : "bg-amber-50 text-amber-700"
                                    }`}
                                  >
                                    {String(product.inventory) === "1"
                                      ? "Inventory"
                                      : "Non-Inventory"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-semibold">
                                  ₱ {peso(product.price)}
                                </td>
                                <td className="px-4 py-3">
                                  {product.category}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className={`rounded-[28px] border p-5 ${
                    isDark
                      ? "border-white/10 bg-white/[0.04]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <h3
                    className={`mb-4 flex items-center gap-2 text-xl font-black ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    <FaFileCode />
                    XML Preview
                  </h3>

                  <pre className="max-h-[420px] overflow-auto rounded-[22px] bg-slate-950 p-5 text-xs leading-6 text-emerald-300 shadow-inner">
                    {xmlPreview || "No XML generated yet."}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
