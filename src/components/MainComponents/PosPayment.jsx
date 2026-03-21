import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { FixedSizeList as List } from "react-window";
import { AnimatePresence, motion } from "framer-motion";
import { useReactToPrint } from "react-to-print";
import {
  FiX,
  FiSearch,
  FiEye,
  FiTag,
  FiUsers,
  FiCreditCard,
  FiFileText,
  FiPlus,
  FiTrash2,
  FiRefreshCw,
  FiShoppingCart,
  FiPrinter,
  FiDatabase,
  FiBarChart2,
} from "react-icons/fi";
import { FaMoneyBill, FaArrowLeft } from "react-icons/fa";
import { useTheme } from "../../context/ThemeContext";
import useApiHost from "../../hooks/useApiHost";
import PosPaymentReceipt from "./PosPaymentReceipt";
import { useNavigate } from "react-router-dom";

const peso = (value) =>
  `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const negativePeso = (value) => `- ${peso(value)}`;
const toNum = (value) => Number(value || 0);

const yesNoToBool = (value) =>
  String(value || "")
    .trim()
    .toLowerCase() === "yes";

const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const buildImagePath = (name) => {
  const safe = encodeURIComponent(String(name || "").trim());
  return `/${safe}.png`;
};

const safeReadJson = async (response, label) => {
  const text = await response.text();

  if (!text || !text.trim()) {
    throw new Error(`${label} returned an empty response.`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error(`${label} invalid JSON:`, text);
    throw new Error(`${label} returned invalid JSON.`);
  }
};

const emptyCustomerInfo = {
  customer_exclusive_id: "",
  customer_name: "",
  customer_id_no: "",
  tin: "",
  other_info_01: "",
  other_info_02: "",
  other_info_03: "",
};

const createEmptyCustomerCard = () => ({
  ...emptyCustomerInfo,
});

const createEmptyPaymentRow = () => ({
  payment_method: "",
  payment_amount: "",
  payment_reference: "",
});

const createEmptyOtherChargeRow = () => ({
  particulars: "",
  amount: "",
  reference: "",
});

const PENDING_COLUMN_TEMPLATE =
  "110px 200px 120px 140px 200px 170px 170px 200px";

const PENDING_TABLE_MIN_WIDTH = 1310;
const PENDING_ROW_HEIGHT = 76;
const PENDING_LIST_HEIGHT = 560;

const ListOuter = React.forwardRef(({ style, ...props }, ref) => (
  <div
    ref={ref}
    {...props}
    style={{
      ...style,
      overflowX: "hidden",
      overflowY: "auto",
    }}
  />
));

const ListInner = React.forwardRef(({ style, ...props }, ref) => (
  <div
    ref={ref}
    {...props}
    style={{
      ...style,
      width: "100%",
    }}
  />
));

const ModalShell = ({
  isOpen,
  onClose,
  isDark,
  maxWidth = "max-w-[1100px]",
  children,
  zIndex = "z-[100000]",
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className={`fixed inset-0 ${zIndex} flex items-center justify-center p-3 md:p-5 backdrop-blur-md ${
          isDark ? "bg-slate-950/80" : "bg-slate-900/20"
        }`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ scale: 0.97, opacity: 0, y: 14 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 14 }}
          transition={{ duration: 0.18 }}
          className={`relative flex w-full ${maxWidth} max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-[30px] border shadow-[0_30px_100px_rgba(15,23,42,0.35)] ${
            isDark
              ? "border-white/10 bg-[#0f172a] text-white"
              : "border-slate-200 bg-white text-slate-900"
          }`}
        >
          {onClose ? (
            <button
              onClick={onClose}
              className={`absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-2xl transition ${
                isDark
                  ? "bg-slate-800 text-slate-300 hover:bg-red-500/15 hover:text-red-400"
                  : "bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-500"
              }`}
            >
              <FiX size={18} />
            </button>
          ) : null}
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const SectionCard = ({ isDark, children, className = "" }) => (
  <div
    className={`rounded-[24px] border p-4 ${className} ${
      isDark
        ? "border-white/5 bg-white/[0.03]"
        : "border-slate-200 bg-white shadow-sm"
    }`}
  >
    {children}
  </div>
);


const ActionTile = ({
  isDark,
  icon,
  title,
  subtitle,
  onClick,
  active = false,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[18px] border px-3 py-3 text-left transition ${
        active
          ? "border-blue-500 bg-blue-600 text-white"
          : isDark
            ? "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700 hover:text-white"
            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            active
              ? "bg-white/15 text-white"
              : isDark
                ? "bg-slate-800 text-slate-300"
                : "bg-slate-100 text-slate-700"
          }`}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <div className="text-sm font-bold leading-tight">{title}</div>
          <div
            className={`mt-0.5 text-[10px] leading-tight ${
              active ? "text-blue-100" : "text-slate-500"
            }`}
          >
            {subtitle}
          </div>
        </div>
      </div>
    </button>
  );
};
const InfoPill = ({ isDark, children }) => (
  <span
    className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold ${
      isDark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-700"
    }`}
  >
    {children}
  </span>
);

const SummaryRow = ({ label, value, isDark, valueClassName = "" }) => (
  <div
    className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 ${
      isDark ? "bg-slate-950/80" : "bg-slate-50"
    }`}
  >
    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
      {label}
    </span>
    <span className={`text-sm font-black ${valueClassName}`}>{value}</span>
  </div>
);
const YesNoModal = ({
  isOpen,
  onClose,
  onYes,
  isDark,
  title = "Confirm Action",
  message = "Are you sure?",
  yesText = "Yes",
  noText = "No",
  busy = false,
}) => {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={busy ? undefined : onClose}
      isDark={isDark}
      maxWidth="max-w-[560px]"
      zIndex="z-[100003]"
    >
      <div className="p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-black">{title}</h2>
          <p className="mt-2 text-sm text-slate-500">{message}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
              busy
                ? "cursor-not-allowed bg-slate-300 text-slate-500"
                : isDark
                  ? "border border-slate-700 bg-slate-800 text-slate-200 hover:text-white"
                  : "border border-slate-200 bg-slate-100 text-slate-700 hover:text-slate-900"
            }`}
          >
            {noText}
          </button>

          <button
            type="button"
            onClick={onYes}
            disabled={busy}
            className={`rounded-2xl px-4 py-3 text-sm font-black text-white transition ${
              busy
                ? "cursor-not-allowed bg-slate-400"
                : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {busy ? "Processing..." : yesText}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

const SuccessModal = ({
  isOpen,
  onClose,
  onPrint,
  isDark,
  title = "Success",
  message = "Saved successfully.",
}) => {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      isDark={isDark}
      maxWidth="max-w-[560px]"
      zIndex="z-[100003]"
    >
      <div className="p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-black text-emerald-500">{title}</h2>
          <p className="mt-2 text-sm text-slate-500">{message}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-2xl px-6 py-3 text-sm font-black transition ${
              isDark
                ? "border border-slate-700 bg-slate-800 text-slate-200 hover:text-white"
                : "border border-slate-200 bg-slate-100 text-slate-700 hover:text-slate-900"
            }`}
          >
            Continue
          </button>

          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-black text-white transition bg-blue-600 rounded-2xl hover:bg-blue-500"
          >
            <FiPrinter size={15} />
            Print Receipt
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

function PendingHeaderRow({ isDark }) {
  const headers = [
    "Action",
    "Transaction ID",
    "Table",
    "Order Type",
    "Transaction Date",
    "Total Sales",
    "Cashier",
    "Remarks",
  ];

  return (
    <div
      className={`grid border-b ${
        isDark
          ? "border-white/5 bg-slate-950/70 text-slate-300"
          : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
      style={{ gridTemplateColumns: PENDING_COLUMN_TEMPLATE }}
    >
      {headers.map((header) => (
        <div
          key={header}
          className="px-5 py-4 text-[12px] font-black uppercase tracking-[0.16em]"
        >
          {header}
        </div>
      ))}
    </div>
  );
}

function PendingTransactionRow({ index, style, data }) {
  const row = data.rows[index];
  const isDark = data.isDark;
  const onOpen = data.onOpen;

  const remarksText = row.remarks || "Pending for Payment";
  const isPending = normalizeText(remarksText).includes("pending");

  return (
    <div style={style}>
      <div
        className={`grid border-b transition ${
          isDark
            ? "border-white/5 hover:bg-white/[0.03]"
            : "border-slate-100 hover:bg-slate-50"
        }`}
        style={{ gridTemplateColumns: PENDING_COLUMN_TEMPLATE }}
      >
        <div className="flex items-center px-5 py-4">
          <button
            type="button"
            onClick={() => onOpen(row)}
            className="inline-flex items-center justify-center text-white transition bg-blue-600 h-11 w-11 rounded-2xl hover:bg-blue-500"
            title="Open Payment"
          >
            <FiEye size={17} />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="font-black">{row.transaction_id || "-"}</div>
          <div className="mt-1 text-xs text-slate-500">
            {row.invoice_no ? `Invoice # ${row.invoice_no}` : "No invoice yet"}
          </div>
        </div>

        <div className="px-5 py-4 whitespace-nowrap">
          {row.table_number || "-"}
        </div>

        <div className="px-5 py-4 whitespace-nowrap">
          {row.order_type || "-"}
        </div>

        <div className="px-5 py-4 whitespace-nowrap">
          {row.transaction_date || "-"}
        </div>

        <div className="px-5 py-4 font-black text-right whitespace-nowrap">
          {peso(row.TotalSales)}
        </div>

        <div className="px-5 py-4 whitespace-nowrap">{row.cashier || "-"}</div>

        <div className="flex items-center px-5 py-4">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isPending
                ? "bg-green-500/10 text-green-500"
                : isDark
                  ? "bg-slate-500/10 text-slate-300"
                  : "bg-slate-900/10 text-slate-700"
            }`}
          >
            {remarksText}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, isDark }) {
  return (
    <div
      className={`rounded-[24px] border p-5 ${
        isDark
          ? "border-white/5 bg-white/[0.03]"
          : "border-slate-200 bg-white shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          {title}
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
            isDark
              ? "bg-slate-800 text-slate-300"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          <Icon size={18} />
        </div>
      </div>
      <div
        className={`text-2xl font-black ${
          isDark ? "text-white" : "text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

const PaymentMethodPickerModal = ({
  isOpen,
  onClose,
  isDark,
  methods,
  onPick,
}) => {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      isDark={isDark}
      maxWidth="max-w-[980px]"
      zIndex="z-[100002]"
    >
      <div
        className={`px-5 py-5 ${
          isDark
            ? "border-b border-white/5 bg-white/[0.03]"
            : "border-b border-slate-200 bg-slate-50"
        }`}
      >
        <h2 className="text-2xl font-black">Choose Payment Method</h2>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          Available payment channels
        </p>
      </div>

      <div className="p-5 md:p-6">
        {methods.length === 0 ? (
          <div
            className={`flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed ${
              isDark ? "border-white/10" : "border-slate-300"
            }`}
          >
            <p className="text-sm italic text-slate-500">
              No payment methods found.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
            {methods.map((method) => (
              <button
                key={method.mop_id || method.seq || method.mop}
                type="button"
                onClick={() => onPick(method)}
                className={`rounded-[22px] border p-4 transition ${
                  isDark
                    ? "border-white/5 bg-slate-950 hover:border-slate-700"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex min-h-[112px] flex-col items-center justify-center gap-2">
                  <img
                    src={buildImagePath(method.mop)}
                    alt={method.mop}
                    className="object-contain w-12 h-12"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <span className="text-sm font-semibold leading-tight text-center">
                    {method.mop}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-center mt-6">
          <button
            onClick={onClose}
            className="px-10 py-3 text-sm font-black text-white transition bg-blue-600 rounded-2xl hover:bg-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

const OtherChargesModal = ({
  isOpen,
  onClose,
  isDark,
  options,
  rows,
  setRows,
}) => {
  const inputClass = isDark
    ? "bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500"
    : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400";

  const addRow = () =>
    setRows((prev) => [...prev, createEmptyOtherChargeRow()]);

  const removeRow = (index) =>
    setRows((prev) => prev.filter((_, i) => i !== index));

  const updateRow = (index, field, value) =>
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      isDark={isDark}
      maxWidth="max-w-[900px]"
      zIndex="z-[100002]"
    >
      <div
        className={`px-5 py-5 ${
          isDark
            ? "border-b border-white/5 bg-white/[0.03]"
            : "border-b border-slate-200 bg-slate-50"
        }`}
      >
        <h2 className="text-2xl font-black">Other Charges</h2>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          Add fees and extra charges
        </p>
      </div>

      <div className="p-5 space-y-4 md:p-6">
        {rows.map((row, index) => (
          <div
            key={index}
            className={`grid gap-3 rounded-[22px] border p-4 ${
              isDark
                ? "border-white/5 bg-white/[0.03]"
                : "border-slate-200 bg-slate-50"
            } md:grid-cols-[60px_minmax(0,1.2fr)_180px_minmax(0,1fr)]`}
          >
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="flex items-center justify-center text-white transition bg-blue-600 h-11 w-11 rounded-2xl hover:bg-blue-500"
            >
              <FiTrash2 size={16} />
            </button>

            <select
              value={row.particulars}
              onChange={(e) => updateRow(index, "particulars", e.target.value)}
              className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
            >
              <option value="">Select charge</option>
              {options.map((option) => (
                <option
                  key={option.ID || option.particulars}
                  value={option.particulars}
                >
                  {option.particulars}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="0"
              step="0.01"
              value={row.amount}
              onChange={(e) => updateRow(index, "amount", e.target.value)}
              placeholder="0.00"
              className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
            />

            <input
              type="text"
              value={row.reference}
              onChange={(e) => updateRow(index, "reference", e.target.value)}
              placeholder="Reference"
              className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
            />
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={addRow}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${
              isDark
                ? "border border-slate-700 bg-slate-800 text-slate-200 hover:text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:text-slate-900"
            }`}
          >
            <FiPlus size={14} />
            Add charge
          </button>

          <button
            onClick={onClose}
            className="px-10 py-3 text-sm font-black text-white transition bg-blue-600 rounded-2xl hover:bg-blue-500"
          >
            Continue
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

const CustomerInfoModal = ({
  isOpen,
  onClose,
  isDark,
  customerCount,
  setCustomerCount,
  qualifiedCount,
  setQualifiedCount,
  customerCards,
  setCustomerCards,
}) => {
  const inputClass = isDark
    ? "bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500"
    : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400";

  const safeQualifiedCount = Math.max(Number(qualifiedCount) || 0, 0);

  const updateCard = (index, field, value) => {
    setCustomerCards((prev) =>
      prev.map((card, i) => (i === index ? { ...card, [field]: value } : card)),
    );
  };

  const clearCard = (index) => {
    setCustomerCards((prev) =>
      prev.map((card, i) => (i === index ? createEmptyCustomerCard() : card)),
    );
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      isDark={isDark}
      maxWidth="max-w-[1000px]"
      zIndex="z-[100002]"
    >
      <div className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                isDark
                  ? "bg-slate-800 text-slate-300"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              <FiUsers size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-black">Customer Info</h2>
              <p className="text-xs text-slate-500">
                Customer counts and optional discount reference details.
              </p>
            </div>
          </div>
        </div>

        <div
          className={`mb-4 rounded-[24px] border p-4 ${
            isDark
              ? "border-white/5 bg-white/[0.03]"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <div className="space-y-3">
              <div className="grid gap-2 md:grid-cols-[1.2fr_180px] md:items-center">
                <label className="text-sm font-black">Head Count:</label>
                <input
                  type="number"
                  min="1"
                  value={customerCount}
                  onChange={(e) => setCustomerCount(e.target.value)}
                  className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
                />
              </div>

              <div className="grid gap-2 md:grid-cols-[1.2fr_180px] md:items-center">
                <label className="text-sm font-black">
                  No. of Customer(s) with Discount:
                </label>
                <input
                  type="number"
                  min="0"
                  max={customerCount || 1}
                  value={qualifiedCount}
                  onChange={(e) => setQualifiedCount(e.target.value)}
                  className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
                />
              </div>
            </div>

            <div className="items-center justify-center hidden md:flex">
              <div
                className={`flex h-24 w-24 items-center justify-center rounded-full ${
                  isDark
                    ? "bg-blue-500/10 text-blue-400"
                    : "bg-blue-50 text-blue-600"
                }`}
              >
                <FiUsers size={40} />
              </div>
            </div>
          </div>
        </div>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {safeQualifiedCount === 0 ? (
            <div
              className={`rounded-[24px] border p-5 text-center text-sm italic ${
                isDark
                  ? "border-white/5 bg-white/[0.03] text-slate-400"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              No discount customer cards yet. Increase the qualified count to
              add cards.
            </div>
          ) : (
            customerCards
              .slice(0, safeQualifiedCount)
              .map((customerInfo, index) => (
                <div
                  key={index}
                  className={`rounded-[24px] border p-4 ${
                    isDark
                      ? "border-white/5 bg-white/[0.03]"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-sm font-black">
                        Customer #{index + 1}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Customer card for discount posting.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => clearCard(index)}
                      className="flex items-center justify-center text-white transition bg-blue-600 h-11 w-11 rounded-2xl hover:bg-blue-500"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      value={customerInfo.customer_exclusive_id}
                      onChange={(e) =>
                        updateCard(
                          index,
                          "customer_exclusive_id",
                          e.target.value,
                        )
                      }
                      placeholder="Exclusive Customer ID / Customer ID"
                      className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
                    />
                    <input
                      type="text"
                      value={customerInfo.customer_name}
                      onChange={(e) =>
                        updateCard(index, "customer_name", e.target.value)
                      }
                      placeholder="Name"
                      className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
                    />
                    <input
                      type="text"
                      value={customerInfo.customer_id_no}
                      onChange={(e) =>
                        updateCard(index, "customer_id_no", e.target.value)
                      }
                      placeholder="ID"
                      className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
                    />
                    <input
                      type="text"
                      value={customerInfo.tin}
                      onChange={(e) => updateCard(index, "tin", e.target.value)}
                      placeholder="TIN"
                      className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
                    />
                    <input
                      type="text"
                      value={customerInfo.other_info_01}
                      onChange={(e) =>
                        updateCard(index, "other_info_01", e.target.value)
                      }
                      placeholder="Other Info 01"
                      className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
                    />
                    <input
                      type="text"
                      value={customerInfo.other_info_02}
                      onChange={(e) =>
                        updateCard(index, "other_info_02", e.target.value)
                      }
                      placeholder="Other Info 02"
                      className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
                    />
                    <input
                      type="text"
                      value={customerInfo.other_info_03}
                      onChange={(e) =>
                        updateCard(index, "other_info_03", e.target.value)
                      }
                      placeholder="Other Info 03"
                      className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
                    />
                  </div>
                </div>
              ))
          )}
        </div>

        <div className="flex justify-center mt-5">
          <button
            onClick={onClose}
            className="px-10 py-3 text-sm font-black text-white transition bg-blue-600 rounded-2xl hover:bg-blue-500"
          >
            Continue
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

const DiscountSetupModal = ({
  isOpen,
  onClose,
  isDark,
  discountType,
  setDiscountType,
  manualDiscount,
  setManualDiscount,
  customerCount,
  setCustomerCount,
  qualifiedCount,
  setQualifiedCount,
  computed,
}) => {
  const inputClass = isDark
    ? "bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500"
    : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400";

  const isManualDiscount = discountType === "Manual Discount";

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      isDark={isDark}
      maxWidth="max-w-[860px]"
      zIndex="z-[100002]"
    >
      <div
        className={`px-5 py-5 ${
          isDark
            ? "border-b border-white/5 bg-white/[0.03]"
            : "border-b border-slate-200 bg-slate-50"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
              isDark
                ? "bg-slate-800 text-slate-300"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            <FiTag size={18} />
          </div>
          <div>
            <h2 className="text-2xl font-black">Discount Setup</h2>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Configure discount rules and computation
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard isDark={isDark}>
            <div className="flex items-center gap-2 mb-3">
              <FiFileText size={14} className="text-slate-500" />
              <h3 className="text-sm font-black">Discount Type</h3>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {[
                {
                  label: "No Discount",
                  description: "No discount computation",
                },
                {
                  label: "Senior Citizen Discount",
                  description: "20% prorated discountable base",
                },
                {
                  label: "PWD Discount",
                  description: "20% prorated discountable base",
                },
                {
                  label: "Manual Discount",
                  description: "Direct amount entry",
                },
              ].map((type) => {
                const active = discountType === type.label;
                return (
                  <button
                    key={type.label}
                    type="button"
                    onClick={() => setDiscountType(type.label)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-blue-500 bg-blue-600 text-white"
                        : isDark
                          ? "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-sm font-bold">{type.label}</div>
                    <div
                      className={`mt-1 text-[11px] ${
                        active ? "text-blue-100" : "text-slate-500"
                      }`}
                    >
                      {type.description}
                    </div>
                  </button>
                );
              })}
            </div>

            <div
              className={`mt-4 rounded-[22px] border p-4 ${
                isDark
                  ? "border-white/5 bg-slate-950"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                {isManualDiscount ? (
                  <FiTag size={14} className="text-slate-500" />
                ) : (
                  <FiUsers size={14} className="text-slate-500" />
                )}
                <h3 className="text-sm font-black">
                  {isManualDiscount ? "Manual Discount" : "Qualified Details"}
                </h3>
              </div>

              {isManualDiscount ? (
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Discount Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualDiscount}
                    onChange={(e) => setManualDiscount(e.target.value)}
                    className={`w-full rounded-2xl px-3 py-3 text-sm outline-none ${inputClass}`}
                    placeholder="0.00"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                      Total Customers
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={customerCount}
                      onChange={(e) => setCustomerCount(e.target.value)}
                      className={`w-full rounded-2xl px-3 py-3 text-sm outline-none ${inputClass}`}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                      Qualified
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={customerCount || 1}
                      value={qualifiedCount}
                      onChange={(e) => setQualifiedCount(e.target.value)}
                      className={`w-full rounded-2xl px-3 py-3 text-sm outline-none ${inputClass}`}
                    />
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard isDark={isDark}>
            <div className="flex items-center gap-2 mb-3">
              <FiTag size={14} className="text-slate-500" />
              <h3 className="text-sm font-black">Computation Summary</h3>
            </div>

            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-dashed border-slate-300/20">
                <span className="text-slate-500">Discountable Gross</span>
                <span className="font-semibold">
                  {peso(computed.discountableGross)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pb-2 border-b border-dashed border-slate-300/20">
                <span className="text-slate-500">Discountable Base</span>
                <span className="font-semibold">
                  {peso(computed.discountableBase)}
                </span>
              </div>

              {!isManualDiscount && discountType !== "No Discount" ? (
                <>
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-dashed border-slate-300/20">
                    <span className="text-slate-500">Ratio</span>
                    <span className="font-semibold">
                      {computed.safeQualifiedCount} /{" "}
                      {computed.safeCustomerCount}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-dashed border-slate-300/20">
                    <span className="text-slate-500">Prorated Base</span>
                    <span className="font-semibold">
                      {peso(computed.proratedBase)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-dashed border-slate-300/20">
                    <span className="text-slate-500">VAT Exemption</span>
                    <span className="font-semibold text-red-500">
                      {negativePeso(computed.vatExemption)}
                    </span>
                  </div>
                </>
              ) : null}

              <div className="flex items-center justify-between gap-2 px-3 py-3 rounded-2xl bg-emerald-500/10">
                <span className="text-[12px] font-bold">{discountType}</span>
                <span className="text-[13px] font-black text-red-500">
                  {negativePeso(computed.discount)}
                </span>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-10 py-3 text-sm font-black text-white transition bg-blue-600 rounded-2xl hover:bg-blue-500"
          >
            Continue
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

const InputPaymentsModal = ({
  isOpen,
  onClose,
  isDark,
  totalAmountDue,
  payments,
  setPayments,
  onAddPaymentMethod,
}) => {
  const inputClass = isDark
    ? "bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500"
    : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400";

  const totalPaid = payments.reduce(
    (sum, row) => sum + toNum(row.payment_amount),
    0,
  );
  const remaining = Math.max(toNum(totalAmountDue) - totalPaid, 0);

  const updateRow = (index, field, value) =>
    setPayments((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );

  const removeRow = (index) =>
    setPayments((prev) => prev.filter((_, i) => i !== index));

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      isDark={isDark}
      maxWidth="max-w-[880px]"
      zIndex="z-[100001]"
    >
      <div
        className={`px-5 py-5 ${
          isDark
            ? "border-b border-white/5 bg-white/[0.03]"
            : "border-b border-slate-200 bg-slate-50"
        }`}
      >
        <h2 className="text-2xl font-black">Input Payments</h2>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          Allocate payment amounts and references
        </p>
      </div>

      <div className="p-5 space-y-4 md:p-6">
        <div className="grid gap-3 md:grid-cols-2 md:items-center">
          <div className="text-2xl font-black text-slate-700 dark:text-slate-200">
            TOTAL AMOUNT DUE
          </div>
          <div className="text-3xl font-black text-right text-emerald-500">
            {peso(totalAmountDue)}
          </div>
        </div>

        <div
          className={`rounded-[24px] border p-4 ${
            isDark
              ? "border-white/5 bg-white/[0.03]"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm font-bold text-slate-500">Payments</p>
            <button
              type="button"
              onClick={onAddPaymentMethod}
              className="inline-flex items-center gap-2 px-4 py-3 text-xs font-bold text-white transition bg-blue-600 rounded-2xl hover:bg-blue-500"
            >
              <FiPlus size={14} />
              Add Payment Method
            </button>
          </div>

          <div className="space-y-3">
            {payments.length === 0 ? (
              <div
                className={`flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed ${
                  isDark ? "border-white/10" : "border-slate-300"
                }`}
              >
                <p className="text-sm italic text-slate-500">
                  Add at least one payment method.
                </p>
              </div>
            ) : (
              payments.map((row, index) => (
                <div
                  key={`${row.payment_method}-${index}`}
                  className={`grid gap-3 rounded-[22px] border p-4 ${
                    isDark
                      ? "border-white/5 bg-slate-950"
                      : "border-slate-200 bg-white"
                  } md:grid-cols-[60px_150px_minmax(0,1fr)]`}
                >
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="flex items-center justify-center text-white transition bg-blue-600 h-11 w-11 rounded-2xl hover:bg-blue-500"
                  >
                    <FiTrash2 size={16} />
                  </button>

                  <div className="flex items-center gap-3 px-3 py-2 bg-white border rounded-2xl border-slate-200 dark:border-white/5 dark:bg-slate-900">
                    <img
                      src={buildImagePath(row.payment_method)}
                      alt={row.payment_method}
                      className="object-contain w-10 h-10"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <div>
                      <p className="text-sm font-black">
                        {row.payment_method || "No method"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.payment_amount}
                      onChange={(e) =>
                        updateRow(index, "payment_amount", e.target.value)
                      }
                      placeholder="0.00"
                      className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
                    />
                    <input
                      type="text"
                      value={row.payment_reference}
                      onChange={(e) =>
                        updateRow(index, "payment_reference", e.target.value)
                      }
                      placeholder="Reference"
                      className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="grid gap-3 mt-4 md:grid-cols-2">
            <div
              className={`rounded-2xl border p-4 ${
                isDark
                  ? "border-white/5 bg-slate-950"
                  : "border-slate-200 bg-white"
              }`}
            >
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Total Paid
              </p>
              <p className="mt-1 text-lg font-black text-blue-500">
                {peso(totalPaid)}
              </p>
            </div>
            <div
              className={`rounded-2xl border p-4 ${
                isDark
                  ? "border-white/5 bg-slate-950"
                  : "border-slate-200 bg-white"
              }`}
            >
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Remaining
              </p>
              <p className="mt-1 text-lg font-black text-blue-500">
                {peso(remaining)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="px-10 py-3 text-sm font-black text-white transition bg-blue-600 rounded-2xl hover:bg-blue-500"
          >
            Continue
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

const TransactionPaymentModal = ({
  isOpen,
  onClose,
  transaction,
  apiHost,
  isDark,
  modeOfPayments,
  chargeOptions,
  onSaved,
}) => {
  const [items, setItems] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [discountType, setDiscountType] = useState("No Discount");
  const [manualDiscount, setManualDiscount] = useState("");
  const [customerCount, setCustomerCount] = useState(1);
  const [qualifiedCount, setQualifiedCount] = useState(0);
  const [customerCards, setCustomerCards] = useState([]);

  const [otherCharges, setOtherCharges] = useState([]);
  const [payments, setPayments] = useState([]);

  const [showOtherChargesModal, setShowOtherChargesModal] = useState(false);
  const [showCustomerInfoModal, setShowCustomerInfoModal] = useState(false);
  const [showPaymentMethodsModal, setShowPaymentMethodsModal] = useState(false);
  const [showInputPaymentsModal, setShowInputPaymentsModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showConfirmSaveModal, setShowConfirmSaveModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const receiptRef = useRef(null);
  const [receiptSnapshot, setReceiptSnapshot] = useState(null);

  const handlePrintReceipt = useReactToPrint({
    content: () => receiptRef.current,
    documentTitle: `${transaction?.transaction_id || "receipt"}-receipt`,
    pageStyle: `
      @media print {
        @page {
          size: 80mm auto;
          margin: 0;
        }

        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          font-family: Arial, Helvetica, sans-serif !important;
        }

        .print-root {
          width: 80mm !important;
          min-height: auto !important;
        }
      }
    `,
  });

  useEffect(() => {
    if (!isOpen || !transaction?.transaction_id) return;

    const initialQualified = Number(
      transaction.customer_count_for_discount || 0,
    );

    setDiscountType(transaction.discount_type || "No Discount");
    setManualDiscount("");
    setCustomerCount(transaction.customer_head_count || 1);
    setQualifiedCount(initialQualified);
    setCustomerCards(
      Array.from({ length: initialQualified }, (_, index) =>
        index === 0 && transaction.customer_exclusive_id
          ? {
              ...createEmptyCustomerCard(),
              customer_exclusive_id: transaction.customer_exclusive_id || "",
            }
          : createEmptyCustomerCard(),
      ),
    );
    setOtherCharges([]);
    setPayments([]);
    setErrorMessage("");
    setItems([]);
    setIsLoadingItems(true);
    setShowConfirmSaveModal(false);
    setShowSuccessModal(false);
    setReceiptSnapshot(null);

    fetch(`${apiHost}/api/pos_payment_read_transaction_details.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction_id: transaction.transaction_id,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setItems(Array.isArray(data?.items) ? data.items : []);
        setIsLoadingItems(false);
      })
      .catch((error) => {
        console.error(error);
        setErrorMessage("Failed to load transaction items.");
        setItems([]);
        setIsLoadingItems(false);
      });
  }, [isOpen, transaction, apiHost]);

  useEffect(() => {
    const safeQualified = Math.max(Number(qualifiedCount) || 0, 0);

    setCustomerCards((prev) => {
      const next = [...prev];

      if (next.length < safeQualified) {
        while (next.length < safeQualified) {
          next.push(createEmptyCustomerCard());
        }
      } else if (next.length > safeQualified) {
        next.length = safeQualified;
      }

      return next;
    });
  }, [qualifiedCount]);

  const computed = useMemo(() => {
    const safeCustomerCount = Math.max(Number(customerCount) || 1, 1);
    const safeQualifiedCount = Math.max(
      Math.min(Number(qualifiedCount) || 0, safeCustomerCount),
      0,
    );

    let grossTotal = 0;
    let totalQuantity = 0;

    let discountableGross = 0;
    let discountableBase = 0;

    let discountableVatableGross = 0;
    let discountableVatableBase = 0;

    let totalVatableGross = 0;
    let totalVatableBase = 0;

    items.forEach((item) => {
      const qty = toNum(item.sales_quantity);
      const price = toNum(item.selling_price);
      const lineTotal = qty * price;

      const isDiscountable = yesNoToBool(item.isDiscountable);
      const isVatable = yesNoToBool(item.vatable);

      grossTotal += lineTotal;
      totalQuantity += qty;

      if (isVatable) {
        totalVatableGross += lineTotal;
        totalVatableBase += lineTotal / 1.12;
      }

      if (isDiscountable) {
        discountableGross += lineTotal;
        discountableBase += isVatable ? lineTotal / 1.12 : lineTotal;

        if (isVatable) {
          discountableVatableGross += lineTotal;
          discountableVatableBase += lineTotal / 1.12;
        }
      }
    });

    const ratio =
      safeCustomerCount > 0 ? safeQualifiedCount / safeCustomerCount : 0;

    const proratedBase = discountableBase * ratio;
    const proratedDiscountableVatableBase = discountableVatableBase * ratio;

    let discount = 0;
    let vatExemption = 0;

    if (
      discountType === "Senior Citizen Discount" ||
      discountType === "PWD Discount"
    ) {
      discount = proratedBase * 0.2;
      vatExemption = proratedDiscountableVatableBase * 0.12;
    } else if (discountType === "Manual Discount") {
      discount = toNum(manualDiscount);
      vatExemption = 0;
    }

    const otherChargesTotal = otherCharges.reduce(
      (sum, row) => sum + toNum(row.amount),
      0,
    );

    const totalAmountDue =
      grossTotal - discount - vatExemption + otherChargesTotal;

    const vatableSales = Math.max(
      totalVatableBase - proratedDiscountableVatableBase,
      0,
    );
    const vatableSalesVat = vatableSales * 0.12;

    const vatExemptSales = proratedDiscountableVatableBase;
    const vatExemptSalesVat = vatExemption;

    const totalPaid = payments.reduce(
      (sum, row) => sum + toNum(row.payment_amount),
      0,
    );

    const changeAmount = Math.max(totalPaid - totalAmountDue, 0);
    const shortOver = totalPaid - totalAmountDue;

    return {
      grossTotal,
      totalQuantity,
      discountableGross,
      discountableBase,
      discountableItemsCount: items.filter((item) =>
        yesNoToBool(item.isDiscountable),
      ).length,
      safeCustomerCount,
      safeQualifiedCount,
      ratio,
      proratedBase,
      discount,
      vatExemption,
      otherChargesTotal,
      totalAmountDue,
      vatableSales,
      vatableSalesVat,
      vatExemptSales,
      vatExemptSalesVat,
      vatZeroRatedSales: 0,
      totalPaid,
      changeAmount,
      shortOver,
    };
  }, [
    items,
    customerCount,
    qualifiedCount,
    discountType,
    manualDiscount,
    otherCharges,
    payments,
  ]);

  const groupedPaymentMethodText = useMemo(() => {
    const uniqueMethods = [
      ...new Set(payments.map((p) => p.payment_method).filter(Boolean)),
    ];
    return uniqueMethods.join(", ");
  }, [payments]);

  const customerIdsForPosting = useMemo(() => {
    return customerCards
      .slice(0, computed.safeQualifiedCount)
      .map((card) => String(card.customer_exclusive_id || "").trim())
      .filter(Boolean);
  }, [customerCards, computed.safeQualifiedCount]);

  const canSave = useMemo(() => {
    if (items.length === 0) return false;
    if (payments.length === 0) return false;

    const validPayments = payments.every(
      (row) => row.payment_method && toNum(row.payment_amount) > 0,
    );
    if (!validPayments) return false;

    if (computed.totalPaid < computed.totalAmountDue) return false;

    if (
      computed.safeQualifiedCount > 0 &&
      customerIdsForPosting.length < computed.safeQualifiedCount
    ) {
      return false;
    }

    return true;
  }, [
    items,
    payments,
    computed.totalPaid,
    computed.totalAmountDue,
    computed.safeQualifiedCount,
    customerIdsForPosting,
  ]);

  const addPaymentMethod = (method) => {
    setPayments((prev) => [
      ...prev,
      {
        ...createEmptyPaymentRow(),
        payment_method: method.mop,
      },
    ]);
    setShowPaymentMethodsModal(false);
    setShowInputPaymentsModal(true);
  };

  const handleSavePayment = async () => {
    if (!canSave || !transaction?.transaction_id) return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const payload = {
        transaction_id: transaction.transaction_id,
        discount_type: discountType,
        customer_exclusive_id: customerIdsForPosting[0] || "",
        customer_head_count: computed.safeCustomerCount,
        customer_count_for_discount: computed.safeQualifiedCount,
        customer_info: customerCards
          .slice(0, computed.safeQualifiedCount)
          .map((card) => ({
            customer_exclusive_id: card.customer_exclusive_id || "",
            customer_name: card.customer_name || "",
            customer_id_no: card.customer_id_no || "",
            tin: card.tin || "",
            other_info_01: card.other_info_01 || "",
            other_info_02: card.other_info_02 || "",
            other_info_03: card.other_info_03 || "",
          })),

        TotalSales: computed.grossTotal,
        DiscountedSales: computed.discountableGross,
        Discount: computed.discount,
        OtherCharges: computed.otherChargesTotal,
        VATExemption: computed.vatExemption,
        TotalAmountDue: computed.totalAmountDue,
        VATableSales: computed.vatableSales,
        VATableSales_VAT: computed.vatableSalesVat,
        VATExemptSales: computed.vatExemptSales,
        VATExemptSales_VAT: computed.vatExemptSalesVat,
        VATZeroRatedSales: computed.vatZeroRatedSales,
        payment_amount: computed.totalPaid,
        payment_method: groupedPaymentMethodText,
        change_amount: computed.changeAmount,
        short_over: computed.shortOver,

        payments: payments
          .filter((row) => row.payment_method && toNum(row.payment_amount) > 0)
          .map((row) => ({
            payment_method: row.payment_method,
            payment_amount: toNum(row.payment_amount),
            payment_reference: row.payment_reference || "",
          })),

        other_charges: otherCharges
          .filter((row) => row.particulars && toNum(row.amount) > 0)
          .map((row) => ({
            particulars: row.particulars,
            amount: toNum(row.amount),
            reference: row.reference || "",
          })),
      };

      const res = await fetch(
        `${apiHost}/api/pos_payment_post_transaction.php`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to save payment.");
      }

      setReceiptSnapshot({
        transaction: {
          ...transaction,
          invoice_no: data?.invoice_no || transaction?.invoice_no || "",
          discount_type: discountType,
          payment_method: groupedPaymentMethodText,
          payment_amount: computed.totalPaid,
          change_amount: computed.changeAmount,
          remarks: "Paid",
        },
        items: [...items],
        computed: { ...computed },
        payments: [...payments],
        otherCharges: [...otherCharges],
        customerCards: customerCards.slice(0, computed.safeQualifiedCount),
        discountType,
      });

      setShowConfirmSaveModal(false);
      setShowSuccessModal(true);
      onSaved?.();
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || "Failed to save payment.");
      setShowConfirmSaveModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <ModalShell
        isOpen={isOpen}
        onClose={onClose}
        isDark={isDark}
        maxWidth="max-w-[1120px]"
      >
        <div
          className={`border-b px-4 py-4 ${
            isDark
              ? "border-white/5 bg-white/[0.02]"
              : "border-slate-200 bg-slate-50/80"
          }`}
        >
          <div className="pr-12">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-500">
                  Payment Review
                </p>
                <h2 className="mt-1 text-xl font-black">
                  Transaction {transaction?.transaction_id || "-"}
                </h2>

                <div className="flex flex-wrap gap-2 mt-2">
                  <InfoPill isDark={isDark}>
                    Table: {transaction?.table_number || "-"}
                  </InfoPill>
                  <InfoPill isDark={isDark}>
                    Type: {transaction?.order_type || "-"}
                  </InfoPill>
                  <InfoPill isDark={isDark}>
                    {transaction?.remarks || "Pending for Payment"}
                  </InfoPill>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Amount Due
                </p>
                <p className="mt-1 text-3xl font-black text-emerald-500">
                  {peso(computed.totalAmountDue)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 p-4 overflow-y-auto">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <SectionCard isDark={isDark}>
                <div className="mb-3">
                  <h3 className="text-sm font-black">Quick Actions</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Open only the section you need.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <ActionTile
                    isDark={isDark}
                    icon={<FaMoneyBill size={16} />}
                    title="Other Charges"
                    subtitle="Add fees"
                    onClick={() => setShowOtherChargesModal(true)}
                  />
                  <ActionTile
                    isDark={isDark}
                    icon={<FiTag size={16} />}
                    title="Discount"
                    subtitle="Senior / PWD / Manual"
                    onClick={() => setShowDiscountModal(true)}
                    active={discountType !== "No Discount"}
                  />
                  <ActionTile
                    isDark={isDark}
                    icon={<FiUsers size={16} />}
                    title="Customer Info"
                    subtitle="Head count and IDs"
                    onClick={() => setShowCustomerInfoModal(true)}
                    active={
                      computed.safeQualifiedCount > 0 ||
                      customerIdsForPosting.length > 0
                    }
                  />
                  <ActionTile
                    isDark={isDark}
                    icon={<FiCreditCard size={16} />}
                    title="Payments"
                    subtitle="Input payment"
                    onClick={() => setShowPaymentMethodsModal(true)}
                    active={payments.length > 0}
                  />
                </div>
              </SectionCard>

              <SectionCard isDark={isDark}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-sm font-black">Ordered Items</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Compact item list for quick review.
                    </p>
                  </div>
                  <div className="text-xs font-bold text-slate-500">
                    {items.length} item(s)
                  </div>
                </div>

                {isLoadingItems ? (
                  <div className="flex min-h-[280px] items-center justify-center rounded-[18px] border border-dashed border-slate-300/30">
                    <p className="text-sm italic text-slate-500">
                      Loading transaction items...
                    </p>
                  </div>
                ) : errorMessage ? (
                  <div className="flex min-h-[280px] items-center justify-center rounded-[18px] border border-dashed border-red-300/30">
                    <p className="text-sm italic text-red-500">
                      {errorMessage}
                    </p>
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex min-h-[280px] items-center justify-center rounded-[18px] border border-dashed border-slate-300/30">
                    <p className="text-sm italic text-slate-500">
                      No ordered items found.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {items.map((item, index) => {
                      const qty = toNum(item.sales_quantity);
                      const price = toNum(item.selling_price);
                      const lineTotal = qty * price;
                      const isDiscountable = yesNoToBool(item.isDiscountable);

                      return (
                        <div
                          key={item.ID || index}
                          className={`grid gap-3 rounded-[18px] border p-3 ${
                            isDark
                              ? "border-white/5 bg-slate-950"
                              : "border-slate-200 bg-white"
                          } md:grid-cols-[minmax(0,1fr)_56px_95px_110px]`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate">
                              {item.item_name || item.product_id}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {isDiscountable
                                ? "Discountable"
                                : "Non-discountable"}{" "}
                              •{" "}
                              {yesNoToBool(item.vatable)
                                ? "Vatable"
                                : "Non-VAT"}
                            </p>
                          </div>

                          <div className="flex items-center justify-center text-sm font-black">
                            {qty}
                          </div>

                          <div className="flex items-center justify-end text-sm font-semibold">
                            {peso(price)}
                          </div>

                          <div className="flex items-center justify-end text-sm font-black">
                            {peso(lineTotal)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </div>

            <div className="space-y-4">
              <SectionCard isDark={isDark}>
                <div className="mb-3">
                  <h3 className="text-sm font-black">Payment Summary</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Main totals at a glance.
                  </p>
                </div>

                <div
                  className={`mb-3 rounded-[20px] border p-4 ${
                    isDark
                      ? "border-emerald-500/20 bg-emerald-500/10"
                      : "border-emerald-200 bg-emerald-50"
                  }`}
                >
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Total Amount Due
                  </div>
                  <div className="mt-1 text-3xl font-black text-emerald-500">
                    {peso(computed.totalAmountDue)}
                  </div>
                </div>

                <div className="space-y-2">
                  <SummaryRow
                    label="Total Sales"
                    value={peso(computed.grossTotal)}
                    isDark={isDark}
                  />
                  <SummaryRow
                    label="Discount"
                    value={negativePeso(computed.discount)}
                    isDark={isDark}
                    valueClassName="text-red-500"
                  />
                  <SummaryRow
                    label="VAT Exemption"
                    value={negativePeso(computed.vatExemption)}
                    isDark={isDark}
                    valueClassName="text-red-500"
                  />
                  <SummaryRow
                    label="Other Charges"
                    value={peso(computed.otherChargesTotal)}
                    isDark={isDark}
                  />
                  <SummaryRow
                    label="Payment Received"
                    value={peso(computed.totalPaid)}
                    isDark={isDark}
                  />
                  <SummaryRow
                    label="Change"
                    value={peso(computed.changeAmount)}
                    isDark={isDark}
                  />
                </div>
              </SectionCard>

              <SectionCard isDark={isDark}>
                <div className="mb-3">
                  <h3 className="text-sm font-black">Current Setup</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Quick reference before saving.
                  </p>
                </div>

                <div className="space-y-2">
                  <SummaryRow
                    label="Discount Type"
                    value={discountType}
                    isDark={isDark}
                  />
                  <SummaryRow
                    label="Qualified Customers"
                    value={`${computed.safeQualifiedCount}/${computed.safeCustomerCount}`}
                    isDark={isDark}
                  />
                  <SummaryRow
                    label="Payment Method"
                    value={groupedPaymentMethodText || "No payment yet"}
                    isDark={isDark}
                  />
                </div>
              </SectionCard>

              {errorMessage ? (
                <div className="px-4 py-3 text-sm font-semibold text-red-500 rounded-2xl bg-red-500/10">
                  {errorMessage}
                </div>
              ) : null}

              {!canSave && payments.length > 0 ? (
                <div className="px-4 py-3 text-sm font-semibold text-blue-500 rounded-2xl bg-blue-500/10">
                  {computed.safeQualifiedCount > 0 &&
                  customerIdsForPosting.length < computed.safeQualifiedCount
                    ? "Complete all customer IDs for every qualified discount customer."
                    : "Total paid must be at least equal to total amount due."}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onClose}
                  className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                    isDark
                      ? "border border-slate-700 bg-slate-800 text-slate-200 hover:text-white"
                      : "border border-slate-200 bg-slate-100 text-slate-700 hover:text-slate-900"
                  }`}
                >
                  Close
                </button>

                <button
                  onClick={() => setShowConfirmSaveModal(true)}
                  disabled={!canSave || isSubmitting}
                  className={`rounded-2xl px-4 py-3 text-sm font-black text-white transition ${
                    !canSave || isSubmitting
                      ? "cursor-not-allowed bg-slate-400"
                      : "bg-blue-600 hover:bg-blue-500"
                  }`}
                >
                  {isSubmitting ? "Saving..." : "Save Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalShell>

      <OtherChargesModal
        isOpen={showOtherChargesModal}
        onClose={() => setShowOtherChargesModal(false)}
        isDark={isDark}
        options={chargeOptions}
        rows={otherCharges}
        setRows={setOtherCharges}
      />

      <CustomerInfoModal
        isOpen={showCustomerInfoModal}
        onClose={() => setShowCustomerInfoModal(false)}
        isDark={isDark}
        customerCount={customerCount}
        setCustomerCount={setCustomerCount}
        qualifiedCount={qualifiedCount}
        setQualifiedCount={setQualifiedCount}
        customerCards={customerCards}
        setCustomerCards={setCustomerCards}
      />

      <PaymentMethodPickerModal
        isOpen={showPaymentMethodsModal}
        onClose={() => setShowPaymentMethodsModal(false)}
        isDark={isDark}
        methods={modeOfPayments}
        onPick={addPaymentMethod}
      />

      <InputPaymentsModal
        isOpen={showInputPaymentsModal}
        onClose={() => setShowInputPaymentsModal(false)}
        isDark={isDark}
        totalAmountDue={computed.totalAmountDue}
        payments={payments}
        setPayments={setPayments}
        onAddPaymentMethod={() => setShowPaymentMethodsModal(true)}
      />

      <DiscountSetupModal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        isDark={isDark}
        discountType={discountType}
        setDiscountType={setDiscountType}
        manualDiscount={manualDiscount}
        setManualDiscount={setManualDiscount}
        customerCount={customerCount}
        setCustomerCount={setCustomerCount}
        qualifiedCount={qualifiedCount}
        setQualifiedCount={setQualifiedCount}
        computed={computed}
      />

      <YesNoModal
        isOpen={showConfirmSaveModal}
        onClose={() => setShowConfirmSaveModal(false)}
        onYes={handleSavePayment}
        isDark={isDark}
        title="Confirm Payment Submission"
        message="Are you sure you want to save and post this payment transaction?"
        yesText="Yes, Save Payment"
        noText="Cancel"
        busy={isSubmitting}
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          onClose?.();
        }}
        onPrint={() => handlePrintReceipt?.()}
        isDark={isDark}
        title="Payment Successful"
        message="The payment has been saved successfully. You can print the receipt now."
      />

      <div style={{ display: "none" }}>
        <PosPaymentReceipt
          ref={receiptRef}
          transaction={receiptSnapshot?.transaction || transaction}
          items={receiptSnapshot?.items || items}
          computed={receiptSnapshot?.computed || computed}
          payments={receiptSnapshot?.payments || payments}
          otherCharges={receiptSnapshot?.otherCharges || otherCharges}
          customerCards={receiptSnapshot?.customerCards || customerCards}
          discountType={receiptSnapshot?.discountType || discountType}
        />
      </div>
    </>
  );
};

export default function PosPayment() {
  const apiHost = useApiHost();
  const themeContext = useTheme();
  const isDark =
    typeof themeContext?.isDark === "boolean"
      ? themeContext.isDark
      : themeContext?.theme === "dark";

  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [modeOfPayments, setModeOfPayments] = useState([]);
  const [chargeOptions, setChargeOptions] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchAll = useCallback(async () => {
    if (!apiHost) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const [pendingRes, mopRes, chargesRes] = await Promise.all([
        fetch(`${apiHost}/api/pos_payment_read_pending.php`),
        fetch(`${apiHost}/api/pos_payment_read_mode_of_payment.php`),
        fetch(`${apiHost}/api/pos_payment_read_other_charges.php`),
      ]);

      const [pendingData, mopData, chargesData] = await Promise.all([
        safeReadJson(pendingRes, "Pending transactions API"),
        safeReadJson(mopRes, "Mode of payment API"),
        safeReadJson(chargesRes, "Other charges API"),
      ]);

      if (!pendingRes.ok || !pendingData?.success) {
        throw new Error(
          pendingData?.message || "Failed to load pending transactions.",
        );
      }

      if (!mopRes.ok || !mopData?.success) {
        throw new Error(mopData?.message || "Failed to load mode of payments.");
      }

      if (!chargesRes.ok || !chargesData?.success) {
        throw new Error(
          chargesData?.message || "Failed to load other charges.",
        );
      }

      setTransactions(
        Array.isArray(pendingData?.transactions)
          ? pendingData.transactions
          : [],
      );

      setModeOfPayments(Array.isArray(mopData?.modes) ? mopData.modes : []);

      setChargeOptions(
        Array.isArray(chargesData?.charges) ? chargesData.charges : [],
      );
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || "Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  }, [apiHost]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filteredTransactions = useMemo(() => {
    const searchValue = normalizeText(search);
    if (!searchValue) return transactions;

    return transactions.filter((row) => {
      const haystack = [
        row.transaction_id,
        row.table_number,
        row.order_type,
        row.Category_Code,
        row.Unit_Code,
        row.cashier,
        row.transaction_date,
        row.remarks,
        row.invoice_no,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(searchValue);
    });
  }, [transactions, search]);

  const summary = useMemo(() => {
    const totalTransactions = filteredTransactions.length;
    const totalSales = filteredTransactions.reduce(
      (sum, row) => sum + toNum(row.TotalSales),
      0,
    );

    return {
      totalTransactions,
      totalSales,
      totalMethods: modeOfPayments.length,
      totalCharges: chargeOptions.length,
    };
  }, [filteredTransactions, modeOfPayments, chargeOptions]);

  const listData = useMemo(
    () => ({
      rows: filteredTransactions,
      isDark,
      onOpen: (row) => {
        setSelectedTransaction(row);
        setIsPaymentModalOpen(true);
      },
    }),
    [filteredTransactions, isDark],
  );

  return (
    <>
      <div
        className={
          isDark
            ? "min-h-screen bg-[#020617] text-slate-200"
            : "min-h-screen bg-slate-100 text-slate-900"
        }
      >
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div
            className={`absolute -left-20 top-0 h-72 w-72 rounded-full blur-[120px] ${
              isDark ? "bg-blue-600/10" : "bg-blue-500/15"
            }`}
          />
          <div
            className={`absolute right-0 top-20 h-80 w-80 rounded-full blur-[140px] ${
              isDark ? "bg-cyan-500/10" : "bg-sky-400/15"
            }`}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-[1700px] p-4 sm:p-6 lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <button
              onClick={() => navigate("/poscorehomescreen")}
              className={`inline-flex items-center gap-3 rounded-2xl border px-5 py-3 font-semibold transition ${
                isDark
                  ? "border-white/5 bg-white/[0.03] text-slate-300 hover:text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:text-slate-900 shadow-sm"
              }`}
            >
              <FaArrowLeft size={14} />
              BACK TO MENU
            </button>

            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-blue-500">
              <FiTag />
              Payment Center
            </div>
          </div>

          <div className="mb-6">
            <h1
              className={`text-3xl font-black sm:text-4xl ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Pending for Payment
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Review billed transactions, open payment posting, and manage
              pending sales.
            </p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatCard
                title="Pending Transactions"
                value={summary.totalTransactions}
                icon={FiDatabase}
                isDark={isDark}
              />
              <StatCard
                title="Payment Methods"
                value={summary.totalMethods}
                icon={FiCreditCard}
                isDark={isDark}
              />
              <StatCard
                title="Charge Options"
                value={summary.totalCharges}
                icon={FaMoneyBill}
                isDark={isDark}
              />
            </div>

            <div
              className={`rounded-[28px] border p-4 sm:p-5 ${
                isDark
                  ? "border-white/5 bg-white/[0.03]"
                  : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_150px]">
                <div className="relative">
                  <FiSearch className="absolute -translate-y-1/2 pointer-events-none left-4 top-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search transaction, table, cashier, remarks..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={`w-full rounded-2xl py-4 pl-12 pr-4 outline-none transition ${
                      isDark
                        ? "border border-slate-800 bg-slate-950 text-white focus:border-blue-500"
                        : "border border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-400"
                    }`}
                  />
                </div>

                <button
                  onClick={fetchAll}
                  className="flex items-center justify-center gap-2 px-4 py-4 font-semibold text-white transition bg-blue-600 rounded-2xl hover:bg-blue-500"
                >
                  <FiRefreshCw size={16} />
                  Refresh
                </button>
              </div>
            </div>

            <div
              className={`overflow-hidden rounded-[30px] border ${
                isDark
                  ? "border-white/5 bg-white/[0.03]"
                  : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              {errorMessage ? (
                <div className="flex h-[420px] items-center justify-center px-6 text-center text-lg font-semibold text-red-500">
                  {errorMessage}
                </div>
              ) : isLoading ? (
                <div
                  className={`flex h-[420px] items-center justify-center text-lg font-semibold ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Loading pending transactions...
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div
                  className={`flex h-[420px] items-center justify-center text-2xl font-black ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  No data
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div style={{ minWidth: PENDING_TABLE_MIN_WIDTH }}>
                    <PendingHeaderRow isDark={isDark} />
                    <List
                      height={PENDING_LIST_HEIGHT}
                      itemCount={filteredTransactions.length}
                      itemSize={PENDING_ROW_HEIGHT}
                      width={PENDING_TABLE_MIN_WIDTH}
                      itemData={listData}
                      overscanCount={8}
                      outerElementType={ListOuter}
                      innerElementType={ListInner}
                    >
                      {PendingTransactionRow}
                    </List>
                  </div>
                </div>
              )}
            </div>

            <div
              className={`rounded-[28px] border p-5 ${
                isDark
                  ? "border-white/5 bg-white/[0.03]"
                  : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              <div
                className={`mb-4 text-sm font-black uppercase tracking-[0.18em] ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Legend
              </div>

              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-3.5 w-3.5 rounded-full ${
                      isDark ? "bg-slate-300" : "bg-slate-900"
                    }`}
                  />
                  <span className="text-slate-500">Paid Transactions</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="h-3.5 w-3.5 rounded-full bg-green-500" />
                  <span className="text-slate-500">Pending for Payment</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TransactionPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
        apiHost={apiHost}
        isDark={isDark}
        modeOfPayments={modeOfPayments}
        chargeOptions={chargeOptions}
        onSaved={fetchAll}
      />
    </>
  );
}
