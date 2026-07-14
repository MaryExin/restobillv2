import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiX,
  FiTag,
  FiUsers,
  FiCreditCard,
  FiFileText,
  FiPlus,
  FiTrash2,
  FiPrinter,
  FiShoppingCart,
  FiCheck,
  FiAward,
  FiSearch,
} from "react-icons/fi";
import { FaMoneyBill } from "react-icons/fa";
import ButtonComponent from "./Common/ButtonComponent";
import BuildPosPaymentReceiptHtml from "../../utils/BuildPosPaymentReceiptHtml";
import useGetDefaultPrinter from "../../hooks/useGetDefaultPrinter";
import useBusinessInfo from "../../hooks/useBusinessInfo";
import { resolveDiscountLineAmount } from "../../utils/discountLineMath";

// Read fresh from localStorage on every call so a mid-shift user switch
// (SwitchUser) is reflected immediately, instead of a stale value captured
// once when this module was first imported.
const getActiveUserId = () => localStorage.getItem("user_id") || "";
const getActiveUserName = () =>
  localStorage.getItem("username") ||
  localStorage.getItem("user_name") ||
  "Store Crew";

const peso = (value) =>
  `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const CASH_METHOD_KEYWORDS = ["cash", "salapi"];

const QUICK_DENOMINATIONS = [
  20, 50, 100, 200, 500, 1000, 1500, 2000, 2500, 3000, 5000, 10000,
];

const formatAmountInput = (value) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return "";
  return String(num);
};

const negativePeso = (value) => `- ${peso(value)}`;
const toNum = (value) => Number(value || 0);
const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const applyDiscountCeiling = (breakdown, ceilingAmount) => {
  const rawTotalDiscount = breakdown.reduce(
    (sum, entry) => sum + Number(entry.discountAmount || 0),
    0,
  );
  const safeCeiling = Number(ceilingAmount || 0);

  if (!Number.isFinite(safeCeiling) || safeCeiling <= 0) {
    return {
      discountBreakdown: breakdown,
      rawTotalDiscount,
      totalDiscount: rawTotalDiscount,
      isDiscountCeilingApplied: false,
    };
  }

  if (rawTotalDiscount <= safeCeiling || rawTotalDiscount <= 0) {
    return {
      discountBreakdown: breakdown,
      rawTotalDiscount,
      totalDiscount: rawTotalDiscount,
      isDiscountCeilingApplied: false,
    };
  }

  let assigned = 0;
  const discountEntries = breakdown.filter(
    (entry) => Number(entry.discountAmount || 0) > 0,
  );

  const cappedBreakdown = breakdown.map((entry) => {
    const discountAmount = Number(entry.discountAmount || 0);

    if (discountAmount <= 0) {
      return entry;
    }

    const isLastDiscountEntry =
      discountEntries[discountEntries.length - 1]?.key === entry.key;
    const cappedAmount = isLastDiscountEntry
      ? roundMoney(safeCeiling - assigned)
      : roundMoney((discountAmount / rawTotalDiscount) * safeCeiling);

    assigned = roundMoney(assigned + cappedAmount);

    return {
      ...entry,
      originalDiscountAmount: discountAmount,
      discountAmount: Math.max(cappedAmount, 0),
      isDiscountCeilingApplied: true,
    };
  });

  return {
    discountBreakdown: cappedBreakdown,
    rawTotalDiscount,
    totalDiscount: safeCeiling,
    isDiscountCeilingApplied: true,
  };
};

const yesNoToBool = (value) =>
  String(value || "")
    .trim()
    .toLowerCase() === "yes";

const buildImagePath = (name) => {
  const safe = encodeURIComponent(String(name || "").trim());
  return `/${safe}.png`;
};

const buildInitialDiscountState = () => ({
  senior: { qualifiedCount: 0, manualAmount: "" },
  pwd: { qualifiedCount: 0, manualAmount: "" },
  naac: { qualifiedCount: 0, manualAmount: "" },
  soloParent: { qualifiedCount: 0, manualAmount: "" },
  manual: {
    qualifiedCount: 0,
    manualAmount: "",
    manualPercent: "",
    manualMode: "amount",
  },
});

// Statutory/manual labels that already have their own dedicated card + state.
// Anything saved under a different label is a custom discount type from
// Settings > Discount Mode > Discount Types, tracked separately in
// `customDiscountLines`.
const STATUTORY_DISCOUNT_LABELS = new Set([
  "senior",
  "senior citizen",
  "senior citizen discount",
  "pwd",
  "pwd discount",
  "naac",
  "naac discount",
  "national athletes and coaches",
  "national athletes and coaches discount",
  "solo parent",
  "solo parent discount",
  "soloparent",
  "manual",
  "manual discount",
]);

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

const isAutoServiceChargeRow = (row) => {
  return String(row?.reference || "").trim().toUpperCase() === "AUTO";
};

const emptyCustomerInfo = {
  customer_exclusive_id: "",
  customer_name: "",
  date_of_birth: "",
  gender: "",
  tin: "",
  contact_no: "",
};

const createEmptyCustomerCard = () => ({
  ...emptyCustomerInfo,
});

const handleSelectAllOnFocus = (e) => {
  requestAnimationFrame(() => {
    try {
      e.target.select();
    } catch (error) {
      console.error(error);
    }
  });
};

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
          className={`relative flex w-full ${maxWidth} max-h-[calc(100vh-1.5rem)] flex-col overflow-auto rounded-[30px] border shadow-[0_30px_100px_rgba(15,23,42,0.35)] ${
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
  disabled = false,
}) => {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`rounded-[18px] border px-3 py-3 text-left transition ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : active
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
    className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-1 ${
      isDark ? "bg-slate-950/80" : "bg-slate-50"
    }`}
  >
    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
      {label}
    </span>
    <span className={`text-xs font-black ${valueClassName}`}>{value}</span>
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
  isPrinting = false,
  printText = "Print Receipt",
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
          <ButtonComponent
            type="button"
            onClick={onClose}
            variant={isDark ? "dark" : "secondary"}
            className="px-6 py-3 mb-0 text-sm"
            disabled={isPrinting}
          >
            Continue
          </ButtonComponent>

          <ButtonComponent
            type="button"
            onClick={onPrint}
            variant="primary"
            icon={<FiPrinter size={15} />}
            className="px-6 py-3 mb-0 text-sm"
            isLoading={isPrinting}
            loadingText="Printing..."
            disabled={isPrinting}
          >
            {printText}
          </ButtonComponent>
        </div>
      </div>
    </ModalShell>
  );
};

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

const DiscountTypePickerModal = ({
  isOpen,
  onClose,
  isDark,
  statutoryOptions,
  customOptions,
  onPickStatutory,
  onPickCustom,
}) => {
  const hasOptions = statutoryOptions.length > 0 || customOptions.length > 0;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      isDark={isDark}
      maxWidth="max-w-[980px]"
      zIndex="z-[100003]"
    >
      <div
        className={`px-5 py-5 ${
          isDark
            ? "border-b border-white/5 bg-white/[0.03]"
            : "border-b border-slate-200 bg-slate-50"
        }`}
      >
        <h2 className="text-2xl font-black">Choose Discount Type</h2>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          Active for this sales type
        </p>
      </div>

      <div className="p-5 md:p-6">
        {!hasOptions ? (
          <div
            className={`flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed ${
              isDark ? "border-white/10" : "border-slate-300"
            }`}
          >
            <p className="text-sm italic text-slate-500">
              No more discount types active for this sales type.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
            {statutoryOptions.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => onPickStatutory(card.key)}
                className={`rounded-[22px] border p-4 transition ${
                  isDark
                    ? "border-white/5 bg-slate-950 hover:border-slate-700"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex min-h-[112px] flex-col items-center justify-center gap-2">
                  <span className="text-sm font-semibold leading-tight text-center">
                    {card.label}
                  </span>
                  <span className="text-xs font-black text-emerald-500">
                    {card.percent}%
                  </span>
                </div>
              </button>
            ))}

            {customOptions.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => onPickCustom(type)}
                className={`rounded-[22px] border p-4 transition ${
                  isDark
                    ? "border-white/5 bg-slate-950 hover:border-slate-700"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex min-h-[112px] flex-col items-center justify-center gap-2">
                  <span className="text-sm font-semibold leading-tight text-center">
                    {type.discount_name}
                  </span>
                  <span className="text-xs font-black text-emerald-500">
                    {type.calculation_type === "fixed"
                      ? `₱${Number(type.percent).toFixed(2)}`
                      : `${Number(type.percent)}%`}
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
  readOnly = false,
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
              disabled={readOnly}
              className="flex items-center justify-center text-white transition bg-blue-600 h-11 w-11 rounded-2xl hover:bg-blue-500 disabled:opacity-50"
            >
              <FiTrash2 size={16} />
            </button>

            <select
              value={row.particulars}
              disabled={readOnly}
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
              disabled={readOnly}
              onChange={(e) => updateRow(index, "amount", e.target.value)}
              placeholder="0.00"
              onFocus={handleSelectAllOnFocus}
              className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
            />

            <input
              type="text"
              value={row.reference}
              disabled={readOnly}
              onChange={(e) => updateRow(index, "reference", e.target.value)}
              placeholder="Reference"
              className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
            />
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {!readOnly ? (
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
          ) : (
            <div />
          )}

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
  totalQualified,
  customerCards,
  setCustomerCards,
  readOnly = false,
}) => {
  const inputClass = isDark
    ? "bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500"
    : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400";

  const safeQualifiedCount = Math.max(Number(totalQualified) || 0, 0);

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
                Optional details for discount rows and receipt printing.
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
                  disabled={readOnly}
                  onChange={(e) => setCustomerCount(e.target.value)}
                  onFocus={handleSelectAllOnFocus}
                  className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
                />
              </div>

              <div className="grid gap-2 md:grid-cols-[1.2fr_180px] md:items-center">
                <label className="text-sm font-black">
                  Total Discount Customer Rows:
                </label>
                <input
                  type="number"
                  min="0"
                  value={safeQualifiedCount}
                  disabled
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
              No discount customer cards yet.
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
                        Discount Customer #{index + 1}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        These fields may be left blank.
                      </p>
                    </div>

                    {!readOnly ? (
                      <button
                        type="button"
                        onClick={() => clearCard(index)}
                        className="flex items-center justify-center text-white transition bg-blue-600 h-11 w-11 rounded-2xl hover:bg-blue-500"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      value={customerInfo.customer_exclusive_id}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateCard(
                          index,
                          "customer_exclusive_id",
                          e.target.value,
                        )
                      }
                      placeholder="Customer ID / Exclusive ID"
                      className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
                    />

                    <input
                      type="text"
                      value={customerInfo.customer_name}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateCard(index, "customer_name", e.target.value)
                      }
                      placeholder="Customer Name"
                      className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
                    />

                    <input
                      type="text"
                      value={customerInfo.date_of_birth}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateCard(index, "date_of_birth", e.target.value)
                      }
                      placeholder="Date of Birth"
                      className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
                    />

                    <input
                      type="text"
                      value={customerInfo.gender}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateCard(index, "gender", e.target.value)
                      }
                      placeholder="Gender"
                      className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
                    />

                    <input
                      type="text"
                      value={customerInfo.tin}
                      disabled={readOnly}
                      onChange={(e) => updateCard(index, "tin", e.target.value)}
                      placeholder="TIN"
                      className={`h-11 rounded-2xl px-3 text-sm outline-none ${inputClass}`}
                    />

                    <input
                      type="text"
                      value={customerInfo.contact_no}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateCard(index, "contact_no", e.target.value)
                      }
                      placeholder="Contact No."
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
  customerCount,
  setCustomerCount,
  discountState,
  setDiscountState,
  computed,
  discountCeilingAmount = 0,
  readOnly = false,
  discountMode = "PerCustomer",
  discountSharingMode = "shared",
  setDiscountSharingMode,
  selectedProductIds = {},
  setSelectedProductIds,
  items = [],
  availableDiscountTypes = [],
  addedStatutoryKeys = new Set(),
  customDiscountLines = [],
  showAddDiscountMenu = false,
  onToggleAddDiscountMenu,
  onAddStatutoryDiscount,
  onRemoveStatutoryDiscount,
  onAddCustomDiscountLine,
  onRemoveCustomDiscountLine,
  onUpdateCustomLine,
}) => {
  const inputClass = isDark
    ? "bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500"
    : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400";

  const isPerProduct = discountMode === "PerProduct";
  const discountableItems = items.filter((item) => yesNoToBool(item.isDiscountable));

  const toggleProduct = (id, maxQty) => {
    if (readOnly || !setSelectedProductIds) return;
    setSelectedProductIds((prev) => ({
      ...prev,
      [String(id)]: Number(prev[String(id)] ?? maxQty) > 0 ? 0 : maxQty,
    }));
  };
  const selectAllProducts = () => {
    if (readOnly || !setSelectedProductIds) return;
    const next = {};
    discountableItems.forEach((item) => {
      next[String(item.ID || item.id || item.databaseID || "")] = Number(item.sales_quantity || 0);
    });
    setSelectedProductIds(next);
  };
  const selectNoneProducts = () => {
    if (readOnly || !setSelectedProductIds) return;
    const next = {};
    discountableItems.forEach((item) => {
      next[String(item.ID || item.id || item.databaseID || "")] = 0;
    });
    setSelectedProductIds(next);
  };
  const setProductDiscountQty = (id, qty, maxQty) => {
    if (readOnly || !setSelectedProductIds) return;
    const bounded = Math.min(Math.max(Number(qty) || 0, 0), maxQty);
    setSelectedProductIds((prev) => ({ ...prev, [String(id)]: bounded }));
  };

  const handleCountChange = (key, value) => {
    setDiscountState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        qualifiedCount: value,
      },
    }));
  };

  const handleManualAmountChange = (key, value) => {
    setDiscountState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        manualAmount: value,
        manualMode: "amount",
      },
    }));
  };

  const handleManualPercentChange = (key, value) => {
    setDiscountState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        manualPercent: value,
        manualMode: "percent",
      },
    }));
  };

  const cards = [
    {
      key: "senior",
      label: "Senior Citizen",
      description: "20% prorated base + 12% VAT exemption",
      showManual: false,
      amount: computed.discountBreakdown.find((x) => x.key === "senior")
        ?.discountAmount,
    },
    {
      key: "pwd",
      label: "PWD",
      description: "20% prorated base + 12% VAT exemption",
      showManual: false,
      amount: computed.discountBreakdown.find((x) => x.key === "pwd")
        ?.discountAmount,
    },
    {
      key: "naac",
      label: "National Athletes and Coaches (NAAC)",
      description: "20% prorated base + 12% VAT exemption",
      showManual: false,
      amount: computed.discountBreakdown.find((x) => x.key === "naac")
        ?.discountAmount,
    },
    {
      key: "soloParent",
      label: "Solo Parent",
      description: "10% prorated base + 12% VAT exemption",
      showManual: false,
      amount: computed.discountBreakdown.find((x) => x.key === "soloParent")
        ?.discountAmount,
    },
    {
      key: "manual",
      label: "Manual Discount",
      description: "Direct amount or percentage, no VAT exemption",
      showManual: true,
      amount: computed.discountBreakdown.find((x) => x.key === "manual")
        ?.discountAmount,
    },
  ];

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
              Multi-discount breakdown
            </p>
          </div>
          <div className="ml-auto">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                isPerProduct
                  ? "bg-violet-500/15 text-violet-500"
                  : "bg-blue-500/15 text-blue-500"
              }`}
            >
              {isPerProduct ? <FiShoppingCart size={11} /> : <FiUsers size={11} />}
              {isPerProduct ? "Per Product" : "Per Customer"}
            </span>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard isDark={isDark}>
            <div className="flex items-center gap-2 mb-3">
              <FiFileText size={14} className="text-slate-500" />
              <h3 className="text-sm font-black">Customer Count</h3>
            </div>

            {/* Total Customers + Total Qualified — 2-col grid matching billing layout */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 mb-3">
              <div>
                <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Total Customers
                </label>
                <input
                  type="number"
                  min="1"
                  value={customerCount}
                  disabled={readOnly}
                  onChange={(e) => setCustomerCount(e.target.value)}
                  onFocus={handleSelectAllOnFocus}
                  className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${inputClass}`}
                />
              </div>

              <div
                className={`rounded-lg px-3 py-2 ${
                  isDark
                    ? "bg-slate-900/60 border border-white/5 text-slate-300"
                    : "bg-slate-50 border border-slate-200 text-slate-600"
                }`}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Total Qualified
                </p>
                <p className="mt-1 text-lg font-black">
                  {computed.totalQualifiedAll}
                </p>
              </div>
            </div>

            {/* Solo / Shared toggle — Per Product mode only */}
            {isPerProduct && <div className="mb-4">
              <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                Discount Sharing
              </label>
              <div className={`flex overflow-hidden rounded-lg border text-[10px] font-black uppercase tracking-[0.14em] ${isDark ? "border-white/10" : "border-slate-200"}`}>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => setDiscountSharingMode?.("solo")}
                  className={`flex-1 py-2 transition-colors ${
                    discountSharingMode === "solo"
                      ? "bg-emerald-500 text-white"
                      : isDark ? "bg-slate-900 text-slate-400 hover:text-slate-200" : "bg-white text-slate-400 hover:text-slate-700"
                  }`}
                >
                  Solo
                </button>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => setDiscountSharingMode?.("shared")}
                  className={`flex-1 py-2 transition-colors ${
                    discountSharingMode === "shared"
                      ? "bg-blue-500 text-white"
                      : isDark ? "bg-slate-900 text-slate-400 hover:text-slate-200" : "bg-white text-slate-400 hover:text-slate-700"
                  }`}
                >
                  Shared
                </button>
              </div>
              <p className={`mt-1 text-[9px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                {discountSharingMode === "solo"
                  ? "Each qualified person gets the full discount on the entire discountable amount."
                  : "Discount is prorated — each person's share = total ÷ head count."}
              </p>
            </div>}

            {!readOnly && (
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                  Applied Discounts
                </h4>
                <button
                  type="button"
                  onClick={onToggleAddDiscountMenu}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-wide ${
                    isDark ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-600"
                  }`}
                >
                  <FiPlus size={12} />
                  Add Discount
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              {cards
                .filter((card) => card.key === "manual" || addedStatutoryKeys.has(card.key))
                .map((card) => (
                <div
                  key={card.key}
                  className={`relative rounded-[20px] border p-4 ${
                    isDark
                      ? "border-white/5 bg-slate-950"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-black">{card.label}</div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {card.description}
                      </div>
                    </div>
                    {!readOnly && card.key !== "manual" && (
                      <button
                        type="button"
                        onClick={() => onRemoveStatutoryDiscount?.(card.key)}
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10"
                        title="Remove"
                      >
                        <FiTrash2 size={13} />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Qualified Count
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={discountState[card.key].qualifiedCount}
                        disabled={readOnly}
                        onChange={(e) =>
                          handleCountChange(card.key, e.target.value)
                        }
                        onFocus={handleSelectAllOnFocus}
                        className={`w-full rounded-2xl px-3 py-3 text-sm outline-none ${inputClass}`}
                      />
                    </div>

                    {card.showManual ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                            Manual Amount
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              discountState[card.key].manualMode === "percent"
                                ? discountState[card.key].manualPercent === ""
                                  ? ""
                                  : roundMoney(
                                      computed.discountableGross *
                                        (Number(
                                          discountState[card.key]
                                            .manualPercent || 0,
                                        ) /
                                          100),
                                    )
                                : discountState[card.key].manualAmount
                            }
                            disabled={readOnly}
                            onChange={(e) =>
                              handleManualAmountChange(card.key, e.target.value)
                            }
                            onFocus={handleSelectAllOnFocus}
                            className={`w-full rounded-2xl px-3 py-3 text-sm outline-none ${inputClass}`}
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                            Percent
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={
                              discountState[card.key].manualMode === "percent"
                                ? discountState[card.key].manualPercent
                                : computed.discountableGross > 0 &&
                                    Number(
                                      discountState[card.key].manualAmount || 0,
                                    ) > 0
                                  ? roundMoney(
                                      (Number(
                                        discountState[card.key].manualAmount ||
                                          0,
                                      ) /
                                        computed.discountableGross) *
                                        100,
                                    )
                                  : ""
                            }
                            disabled={readOnly}
                            onChange={(e) =>
                              handleManualPercentChange(
                                card.key,
                                e.target.value,
                              )
                            }
                            onFocus={handleSelectAllOnFocus}
                            className={`w-full rounded-2xl px-3 py-3 text-sm outline-none ${inputClass}`}
                            placeholder="%"
                          />
                        </div>

                        <p className="md:col-span-2 text-[10px] font-semibold text-slate-500">
                          Percentage is computed from discountable gross.
                        </p>
                      </div>
                    ) : (
                      <div
                        className={`rounded-2xl px-3 py-3 ${
                          isDark
                            ? "bg-slate-900 text-slate-300"
                            : "bg-white text-slate-700 border border-slate-200"
                        }`}
                      >
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Computed Amount
                        </div>
                        <div className="mt-2 text-lg font-black text-red-500">
                          {negativePeso(card.amount)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {customDiscountLines.map((line) => {
                const entry = computed.discountBreakdown.find(
                  (x) => x.key === `custom-${line.localId}`,
                );
                const isFixed = line.calculation_type === "fixed";

                return (
                  <div
                    key={line.localId}
                    className={`relative rounded-[20px] border p-4 ${
                      isDark ? "border-white/5 bg-slate-950" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-black">{line.label}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {isFixed
                            ? "Fixed amount off, no VAT exemption."
                            : line.is_vat_exempt
                              ? `${line.percent}% discount per qualified share + VAT exemption.`
                              : `${line.percent}% discount per qualified share.`}
                        </div>
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => onRemoveCustomDiscountLine?.(line.localId)}
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10"
                          title="Remove"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {isFixed ? (
                        <div>
                          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                            Amount
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.manualAmount}
                            disabled={readOnly}
                            onChange={(e) =>
                              onUpdateCustomLine?.(line.localId, { manualAmount: e.target.value })
                            }
                            onFocus={handleSelectAllOnFocus}
                            className={`w-full rounded-2xl px-3 py-3 text-sm outline-none ${inputClass}`}
                            placeholder="0.00"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                            Qualified Count
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={line.qualifiedCount}
                            disabled={readOnly}
                            onChange={(e) =>
                              onUpdateCustomLine?.(line.localId, { qualifiedCount: e.target.value })
                            }
                            onFocus={handleSelectAllOnFocus}
                            className={`w-full rounded-2xl px-3 py-3 text-sm outline-none ${inputClass}`}
                          />
                        </div>
                      )}

                      <div
                        className={`rounded-2xl px-3 py-3 ${
                          isDark
                            ? "bg-slate-900 text-slate-300"
                            : "bg-white text-slate-700 border border-slate-200"
                        }`}
                      >
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Computed Amount
                        </div>
                        <div className="mt-2 text-lg font-black text-red-500">
                          {negativePeso(entry?.discountAmount)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard isDark={isDark}>
            <div className="flex items-center gap-2 mb-3">
              <FiTag size={14} className="text-slate-500" />
              <h3 className="text-sm font-black">Computation Summary</h3>
            </div>

            {isPerProduct && discountableItems.length > 0 && (
              <div
                className={`mb-4 rounded-[20px] border p-4 ${
                  isDark
                    ? "border-violet-500/20 bg-violet-500/5"
                    : "border-violet-200 bg-violet-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <FiShoppingCart size={13} className="text-violet-500" />
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-500">
                      Selected Items for Discount
                    </span>
                  </div>
                  {!readOnly && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllProducts}
                        className="text-[10px] font-black text-violet-500 hover:underline"
                      >
                        All
                      </button>
                      <span className="text-slate-400">·</span>
                      <button
                        type="button"
                        onClick={selectNoneProducts}
                        className="text-[10px] font-black text-slate-400 hover:underline"
                      >
                        None
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {discountableItems.map((item) => {
                    const id = String(item.ID || item.id || item.databaseID || "");
                    const maxQty = Number(item.sales_quantity || 0);
                    const price = Number(item.selling_price || 0);
                    const discQty = Math.min(Math.max(Number(selectedProductIds[id] ?? maxQty), 0), maxQty);
                    const checked = discQty > 0;
                    const discLineTotal = price * discQty;
                    return (
                      <div
                        key={id}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[11px] transition ${
                          checked
                            ? isDark
                              ? "bg-violet-500/15 text-white"
                              : "bg-violet-100 text-slate-900"
                            : isDark
                            ? "bg-slate-800/60 text-slate-500"
                            : "bg-white text-slate-400 border border-slate-200"
                        }`}
                      >
                        {/* Checkbox toggle */}
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={() => toggleProduct(id, maxQty)}
                          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                            checked ? "bg-violet-500" : isDark ? "bg-slate-700" : "bg-slate-200"
                          }`}
                        >
                          {checked && <FiCheck size={9} className="text-white" />}
                        </button>

                        {/* Item name */}
                        <span className="flex-1 font-semibold">
                          {item.item_name || item.product_id || id}
                        </span>

                        {/* Qty stepper (only when maxQty >= 2) */}
                        {maxQty >= 2 ? (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              disabled={readOnly || discQty === 0}
                              onClick={() => setProductDiscountQty(id, discQty - 1, maxQty)}
                              className={`flex h-4 w-4 items-center justify-center rounded font-black text-[11px] disabled:opacity-30 transition-colors ${
                                isDark ? "bg-slate-700 hover:bg-slate-600" : "bg-slate-200 hover:bg-slate-300"
                              }`}
                            >
                              −
                            </button>
                            <span className={`w-8 text-center font-black tabular-nums text-[10px] ${checked ? "text-violet-500" : ""}`}>
                              {discQty}/{maxQty}
                            </span>
                            <button
                              type="button"
                              disabled={readOnly || discQty === maxQty}
                              onClick={() => setProductDiscountQty(id, discQty + 1, maxQty)}
                              className={`flex h-4 w-4 items-center justify-center rounded font-black text-[11px] disabled:opacity-30 transition-colors ${
                                isDark ? "bg-slate-700 hover:bg-slate-600" : "bg-slate-200 hover:bg-slate-300"
                              }`}
                            >
                              +
                            </button>
                          </div>
                        ) : null}

                        {/* Price based on discounted qty */}
                        <span className={`font-black flex-shrink-0 ${checked ? "text-violet-500" : ""}`}>
                          {peso(discLineTotal)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div
                  className={`mt-3 flex items-center justify-between rounded-xl px-3 py-2 text-[11px] ${
                    isDark ? "bg-slate-800 text-slate-300" : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  <span className="font-semibold text-slate-500">Selected Total</span>
                  <span className="font-black text-violet-500">
                    {peso(computed.selectedDiscountableGross)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-dashed border-slate-300/20">
                <span className="text-slate-500">Discountable Gross</span>
                <span className="font-semibold">
                  {peso(isPerProduct ? computed.selectedDiscountableGross : computed.discountableGross)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pb-2 border-b border-dashed border-slate-300/20">
                <span className="text-slate-500">Discountable Base (VAT-ex)</span>
                <span className="font-semibold">
                  {peso(isPerProduct ? computed.selectedDiscountableBase : computed.discountableBase)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pb-2 border-b border-dashed border-slate-300/20">
                <span className="text-slate-500">Statutory Qualified</span>
                <span className="font-semibold">
                  {computed.statutoryQualifiedCount} /{" "}
                  {computed.safeCustomerCount}
                </span>
              </div>

              {computed.discountBreakdown
                .filter(
                  (entry) =>
                    Number(entry.qualifiedCount || 0) > 0 ||
                    Number(entry.discountAmount || 0) > 0,
                )
                .map((entry) => (
                  <div
                    key={entry.key}
                    className="px-3 py-3 rounded-2xl bg-emerald-500/10"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-bold">
                        {entry.label}
                      </span>
                      <div className="text-right">
                        {entry.isDiscountCeilingApplied ? (
                          <div className="text-[10px] font-bold text-slate-500 line-through">
                            {negativePeso(entry.originalDiscountAmount)}
                          </div>
                        ) : null}
                        <span className="text-[13px] font-black text-red-500">
                          {negativePeso(entry.discountAmount)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span>Count: {entry.qualifiedCount}</span>
                      <span>VAT Exempt: {peso(entry.vatExemption)}</span>
                    </div>
                  </div>
                ))}

              <div className="flex items-center justify-between gap-2 pb-2 border-b border-dashed border-slate-300/20">
                <span className="text-slate-500">Total Discount</span>
                <span className="font-semibold text-red-500">
                  {negativePeso(computed.totalDiscount)}
                </span>
              </div>

              {computed.isDiscountCeilingApplied ? (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-3 text-[11px] text-amber-600">
                  Discount ceiling applied. Original discount was{" "}
                  <span className="font-black">
                    {negativePeso(computed.rawTotalDiscount)}
                  </span>
                  , capped at{" "}
                  <span className="font-black">
                    {negativePeso(discountCeilingAmount)}
                  </span>
                  .
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2 pb-2 border-b border-dashed border-slate-300/20">
                <span className="text-slate-500">Total VAT Exemption</span>
                <span className="font-semibold text-red-500">
                  {negativePeso(computed.totalVatExemption)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 px-3 py-3 rounded-2xl bg-blue-500/10">
                <span className="text-[12px] font-bold">Amount Due</span>
                <span className="text-[16px] font-black text-blue-500">
                  {peso(computed.totalAmountDue)}
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

      <DiscountTypePickerModal
        isOpen={showAddDiscountMenu}
        onClose={() => onToggleAddDiscountMenu?.()}
        isDark={isDark}
        statutoryOptions={cards.filter(
          (card) => card.key !== "manual" && !addedStatutoryKeys.has(card.key),
        )}
        customOptions={availableDiscountTypes.filter(
          (type) => !customDiscountLines.some((line) => line.discount_type_id === type.id),
        )}
        onPickStatutory={(key) => onAddStatutoryDiscount?.(key)}
        onPickCustom={(type) => onAddCustomDiscountLine?.(type)}
      />
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
  readOnly = false,
  modeOfPayments = [],
  onShowQR = null,
  qrActive = false,
}) => {
  const [activePaymentIndex, setActivePaymentIndex] = useState(0);

  const inputClass = isDark
    ? "bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500"
    : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400";

  const activeInputClass = isDark
    ? "bg-slate-950 border-2 border-blue-500 text-white placeholder:text-slate-500"
    : "bg-white border-2 border-blue-500 text-slate-900 placeholder:text-slate-400";

  const toNumLocal = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const pesoLocal = (value) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(toNumLocal(value));
  };

  const buildImagePathLocal = (paymentMethod) => {
    if (!paymentMethod) return "";

    const fileName = String(paymentMethod)
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "");

    return `/payments/${fileName}.png`;
  };

  const handleSelectAllOnFocusLocal = (e) => {
    requestAnimationFrame(() => {
      try {
        e.target.select();
      } catch {}
    });
  };

  const totalPaid = payments.reduce(
    (sum, row) => sum + toNumLocal(row.payment_amount),
    0,
  );

  const remaining = Math.max(toNumLocal(totalAmountDue) - totalPaid, 0);

  const hasRefsMissing = payments.some((row) => {
    const mopEntry = modeOfPayments.find((m) => m.mop === row.payment_method);
    if (Number(mopEntry?.reference_On_Off ?? 0) !== 1) return false;
    return !String(row.payment_reference ?? "").trim();
  });

  const activePaymentMethod =
    payments.length > 0 &&
    activePaymentIndex >= 0 &&
    activePaymentIndex < payments.length
      ? payments[activePaymentIndex]?.payment_method || "No method selected"
      : "No method selected";

  const updateRow = (index, field, value) =>
    setPayments((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );

  const removeRow = (index) => {
    setPayments((prev) => {
      const next = prev.filter((_, i) => i !== index);

      if (next.length === 0) {
        setActivePaymentIndex(0);
      } else if (index === activePaymentIndex) {
        setActivePaymentIndex(Math.max(0, index - 1));
      } else if (activePaymentIndex > index) {
        setActivePaymentIndex((prevActive) => Math.max(0, prevActive - 1));
      }

      return next;
    });
  };

  const handleAddPaymentMethod = () => {
    if (readOnly) return;

    const previousLength = payments.length;

    if (typeof onAddPaymentMethod === "function") {
      onAddPaymentMethod();
    }

    setTimeout(() => {
      setActivePaymentIndex(previousLength);
    }, 0);
  };

  const setExactAmountForActiveRow = () => {
    if (payments.length === 0) return;
    if (activePaymentIndex < 0 || activePaymentIndex >= payments.length) return;

    setPayments((prev) =>
      prev.map((row, i) => {
        if (i !== activePaymentIndex) return row;

        const otherRowsTotal = prev.reduce((sum, item, rowIndex) => {
          if (rowIndex === activePaymentIndex) return sum;
          return sum + toNumLocal(item.payment_amount);
        }, 0);

        const exactNeeded = Math.max(
          toNumLocal(totalAmountDue) - otherRowsTotal,
          0,
        );

        return {
          ...row,
          payment_amount: String(exactNeeded),
        };
      }),
    );
  };

  const addDenominationToActiveRow = (amountToAdd) => {
    if (payments.length === 0) return;
    if (activePaymentIndex < 0 || activePaymentIndex >= payments.length) return;

    setPayments((prev) =>
      prev.map((row, i) => {
        if (i !== activePaymentIndex) return row;

        const current = toNumLocal(row.payment_amount);
        return {
          ...row,
          payment_amount: String(current + Number(amountToAdd || 0)),
        };
      }),
    );
  };

  const clearAmountForActiveRow = () => {
    if (payments.length === 0) return;
    if (activePaymentIndex < 0 || activePaymentIndex >= payments.length) return;

    setPayments((prev) =>
      prev.map((row, i) =>
        i === activePaymentIndex ? { ...row, payment_amount: "" } : row,
      ),
    );
  };

  const handleAmountChange = (index, rawValue) => {
    if (/^\d*\.?\d*$/.test(rawValue)) {
      updateRow(index, "payment_amount", rawValue);
    }
  };

  const handleAmountBlur = (index, currentValue) => {
    if (
      currentValue !== "" &&
      currentValue !== null &&
      currentValue !== undefined &&
      !isNaN(currentValue)
    ) {
      updateRow(index, "payment_amount", currentValue);
    }
  };

  const getDenominationColor = (amount, isDarkMode) => {
    if (amount === 20) {
      return isDarkMode
        ? "border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20"
        : "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100";
    }

    if (amount === 50) {
      return isDarkMode
        ? "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
        : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100";
    }

    if (amount === 100) {
      return isDarkMode
        ? "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
        : "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100";
    }

    if (amount === 200) {
      return isDarkMode
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
    }

    if (amount === 500) {
      return isDarkMode
        ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20"
        : "border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100";
    }

    return isDarkMode
      ? "border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20"
      : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/50 p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            className={`max-h-[92vh] w-full max-w-[980px] overflow-hidden rounded-[30px] shadow-2xl ${
              isDark
                ? "border border-white/10 bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div
              className={`px-5 py-3 ${
                isDark
                  ? "border-b border-white/5 bg-white/[0.03]"
                  : "border-b border-slate-200 bg-slate-50"
              }`}
            >
              <h2 className="text-xl font-black">Input Payments</h2>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Allocate payment amounts and references
              </p>
            </div>

            <div className="max-h-[calc(92vh-72px)] overflow-y-auto">
              <div className="px-5 py-2 space-y-4 md:px-6">
                <div className="grid gap-3 md:grid-cols-2 md:items-center">
                  <div className="text-xl font-black text-slate-700 dark:text-slate-200">
                    TOTAL AMOUNT DUE
                  </div>
                  <div className="text-2xl font-black text-right text-emerald-500">
                    {pesoLocal(totalAmountDue)}
                  </div>
                </div>

                <div
                  className={`rounded-[24px] border px-4 py-2 ${
                    isDark
                      ? "border-white/5 bg-white/[0.03]"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-sm font-bold text-slate-500">Payments</p>

                    <div className="flex items-center gap-2">
                      {onShowQR && !readOnly && payments.length > 0 && payments[0]?.payment_method ? (
                        <button
                          type="button"
                          onClick={() => onShowQR(payments[activePaymentIndex]?.payment_method || payments[0]?.payment_method)}
                          className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition rounded-xl ${
                            qrActive
                              ? "bg-emerald-500 text-white shadow-sm"
                              : "bg-cyan-100 text-cyan-700 hover:bg-cyan-200"
                          }`}
                        >
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                          </svg>
                          {qrActive ? "QR On ✓" : "Show QR"}
                        </button>
                      ) : null}

                      {!readOnly ? (
                        <button
                          type="button"
                          onClick={handleAddPaymentMethod}
                          className="inline-flex items-center gap-2 px-4 py-3 text-xs font-bold text-white transition bg-blue-600 rounded-2xl hover:bg-blue-500"
                        >
                          <FiPlus size={14} />
                          Add Payment Method
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {payments.length === 0 ? (
                      <div
                        className={`flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed ${
                          isDark ? "border-white/10" : "border-slate-300"
                        }`}
                      >
                        <p className="text-sm text-slate-500">
                          No payment rows.
                        </p>
                      </div>
                    ) : (
                      payments.map((row, index) => (
                        <div
                          key={`${row.payment_method}-${index}`}
                          onClick={() => setActivePaymentIndex(index)}
                          className={`cursor-pointer rounded-[22px] border p-4 transition ${
                            index === activePaymentIndex
                              ? isDark
                                ? "border-blue-500/60 bg-slate-950 shadow-[0_0_0_1px_rgba(59,130,246,0.35)]"
                                : "border-blue-300 bg-white shadow-[0_0_0_1px_rgba(59,130,246,0.18)]"
                              : isDark
                                ? "border-white/5 bg-slate-950"
                                : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="grid gap-3 md:grid-cols-[60px_170px_minmax(0,1fr)]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRow(index);
                              }}
                              disabled={readOnly}
                              className="flex items-center justify-center text-white transition bg-blue-600 h-11 w-11 rounded-2xl hover:bg-blue-500 disabled:opacity-50"
                            >
                              <FiTrash2 size={16} />
                            </button>

                            <div
                              className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${
                                isDark
                                  ? "border-white/5 bg-slate-900"
                                  : "border-slate-200 bg-slate-50"
                              }`}
                            >
                              <img
                                src={buildImagePathLocal(row.payment_method)}
                                alt={row.payment_method}
                                className="object-contain w-10 h-10"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-black truncate">
                                  {row.payment_method || "No method"}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {index === activePaymentIndex
                                    ? "Active amount field"
                                    : "Tap amount field to activate"}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                                    Amount
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={
                                      row.payment_amount === "" ||
                                      row.payment_amount === null ||
                                      row.payment_amount === undefined
                                        ? ""
                                        : row.payment_amount
                                    }
                                    disabled={readOnly}
                                    onChange={(e) =>
                                      handleAmountChange(index, e.target.value)
                                    }
                                    onFocus={(e) => {
                                      setActivePaymentIndex(index);
                                      handleSelectAllOnFocusLocal(e);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    onBlur={() =>
                                      handleAmountBlur(
                                        index,
                                        row.payment_amount,
                                      )
                                    }
                                    placeholder="0.00"
                                    className={`h-12 w-full rounded-2xl px-4 text-base font-bold outline-none transition ${
                                      index === activePaymentIndex
                                        ? activeInputClass
                                        : inputClass
                                    }`}
                                  />
                                </div>

                                <div>
                                  {(() => {
                                    const mopEntry = modeOfPayments.find(
                                      (m) => m.mop === row.payment_method,
                                    );
                                    const refRequired =
                                      Number(mopEntry?.reference_On_Off ?? 0) === 1;
                                    const refMissing =
                                      refRequired &&
                                      !String(row.payment_reference ?? "").trim();
                                    return (
                                      <>
                                        <label className={`mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] ${refMissing ? "text-red-500" : "text-slate-500"}`}>
                                          Reference
                                          {refRequired && (
                                            <span className="text-red-500">*</span>
                                          )}
                                        </label>
                                        <input
                                          type="text"
                                          value={row.payment_reference ?? ""}
                                          disabled={readOnly}
                                          onChange={(e) =>
                                            updateRow(
                                              index,
                                              "payment_reference",
                                              e.target.value,
                                            )
                                          }
                                          onFocus={() => setActivePaymentIndex(index)}
                                          onClick={(e) => e.stopPropagation()}
                                          placeholder={refRequired ? "Required" : "Reference"}
                                          className={`h-12 w-full rounded-2xl px-4 text-sm outline-none ${
                                            refMissing
                                              ? isDark
                                                ? "bg-red-950/40 border-2 border-red-500/60 text-white placeholder:text-red-400"
                                                : "bg-red-50 border-2 border-red-400 text-slate-900 placeholder:text-red-400"
                                              : inputClass
                                          }`}
                                        />
                                        {refMissing && (
                                          <p className="mt-1 text-[10px] font-bold text-red-500">
                                            Reference number required
                                          </p>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div
                    className={`mt-4 rounded-[22px] border p-4 ${
                      isDark
                        ? "border-white/5 bg-slate-950"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="grid gap-3 my-4 md:grid-cols-2">
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
                          {pesoLocal(totalPaid)}
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
                          {pesoLocal(remaining)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                          Shared Quick Amount Input
                        </p>

                        <p className="mt-1 text-[11px] font-black text-slate-500">
                          Active Payment Method:{" "}
                          <span className="text-blue-600">
                            {activePaymentMethod}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={readOnly || payments.length === 0}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            clearAmountForActiveRow();
                          }}
                          className={`rounded-xl px-4 py-3 text-xs font-black transition disabled:opacity-50 ${
                            isDark
                              ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                          }`}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                      {QUICK_DENOMINATIONS.map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          disabled={readOnly || payments.length === 0}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addDenominationToActiveRow(amount);
                          }}
                          className={`rounded-2xl border px-3 py-6 text-lg font-black transition disabled:opacity-50 ${getDenominationColor(
                            amount,
                            isDark,
                          )}`}
                        >
                          ₱{amount.toLocaleString("en-PH")}
                        </button>
                      ))}

                      <div className="col-span-2 space-y-2">
                        {remaining <= 0 && hasRefsMissing && (
                          <p className="rounded-xl bg-red-500/10 px-3 py-2 text-center text-[11px] font-bold text-red-500">
                            Fill in all required reference numbers to continue.
                          </p>
                        )}
                        <button
                          type="button"
                          disabled={readOnly || payments.length === 0 || (remaining <= 0 && hasRefsMissing)}
                          onMouseDown={(e) => {
                            e.preventDefault();

                            if (remaining > 0) {
                              setExactAmountForActiveRow();
                            } else {
                              onClose();
                            }
                          }}
                          className={`w-full rounded-2xl px-8 py-5 text-lg font-black tracking-wide text-white shadow-lg transition disabled:opacity-50 ${
                            remaining > 0
                              ? "bg-emerald-500 hover:bg-emerald-700"
                              : "bg-blue-600 hover:bg-blue-700"
                          }`}
                        >
                          {remaining > 0 ? "Exact" : "Continue"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const CustomerExclusiveModal = ({
  isOpen,
  onClose,
  isDark,
  value,
  onChange,
  readOnly = false,
}) => {
  const inputClass = isDark
    ? "bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500"
    : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400";

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      isDark={isDark}
      maxWidth="max-w-[560px]"
      zIndex="z-[100002]"
    >
      <div className="p-5 md:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
              isDark
                ? "bg-slate-800 text-slate-300"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            <FiFileText size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-black">Customer Exclusive</h2>
            <p className="mt-1 text-xs text-slate-500">
              Input the QR ID or exclusive customer ID for B1T1 item validation.
            </p>
          </div>
        </div>

        <div
          className={`rounded-[24px] border p-4 ${
            isDark
              ? "border-white/5 bg-white/[0.03]"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Exclusive ID / QR ID
          </label>
          <input
            type="text"
            value={value}
            disabled={readOnly}
            onChange={(e) => onChange(e.target.value)}
            onFocus={handleSelectAllOnFocus}
            placeholder="Scan or enter exclusive ID"
            className={`h-12 w-full rounded-2xl px-4 text-sm outline-none ${inputClass}`}
          />
        </div>

        <div className="mt-5 flex justify-center">
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

const LoyaltyRedeemModal = ({
  isOpen,
  onClose,
  isDark,
  apiHost,
  loyaltyConfig,
  loyaltyMember,
  setLoyaltyMember,
  loyaltyPointsToApply,
  setLoyaltyPointsToApply,
  loyaltyDiscountAmount,
  loyaltyPointsToEarn,
  readOnly = false,
}) => {
  const [members, setMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [search, setSearch] = useState("");

  const inputClass = isDark
    ? "bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500"
    : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400";

  useEffect(() => {
    if (!isOpen || !apiHost || readOnly) return;

    let cancelled = false;

    const fetchMembers = async () => {
      try {
        setIsLoadingMembers(true);
        const response = await fetch(`${apiHost}/api/pos_loyalty_members.php`);
        const result = await response.json();
        if (!cancelled) {
          setMembers(Array.isArray(result?.data) ? result.data : []);
        }
      } catch (error) {
        console.error("Failed to load loyalty members:", error);
        if (!cancelled) setMembers([]);
      } finally {
        if (!cancelled) setIsLoadingMembers(false);
      }
    };

    fetchMembers();

    return () => {
      cancelled = true;
    };
  }, [isOpen, apiHost]);

  useEffect(() => {
    if (!isOpen) setSearch("");
  }, [isOpen]);

  const filteredMembers = members.filter((m) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      String(m.customer_name || "").toLowerCase().includes(term) ||
      String(m.phone_number || "").toLowerCase().includes(term)
    );
  });

  const balance = Number(loyaltyMember?.loyalty_points || 0);
  const minToRedeem = Number(loyaltyConfig?.minimumPointsToRedeem || 0);
  const canRedeem = balance > 0 && balance >= minToRedeem;
  const formatPts = (value) => Number(value || 0).toFixed(2);
  const newBalance = balance - Number(loyaltyPointsToApply || 0) + Number(loyaltyPointsToEarn || 0);

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      isDark={isDark}
      maxWidth="max-w-[680px]"
      zIndex="z-[100002]"
    >
      <div className="p-5 md:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
              isDark
                ? "bg-slate-800 text-slate-300"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            <FiAward size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-black">Loyal Customers</h2>
            <p className="mt-1 text-xs text-slate-500">
              {readOnly
                ? "Loyalty points applied to this transaction."
                : "Search a member and apply their loyalty points as a discount."}
            </p>
          </div>
        </div>

        {!loyaltyMember && readOnly ? (
          <p className="p-4 text-sm italic text-center text-slate-500">
            No loyalty redemption was applied to this transaction.
          </p>
        ) : !loyaltyMember ? (
          <>
            <div className="relative mb-3">
              <FiSearch
                className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400"
                size={16}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or phone number..."
                className={`h-12 w-full rounded-2xl pl-11 pr-4 text-sm outline-none ${inputClass}`}
              />
            </div>

            <div
              className={`max-h-[320px] space-y-2 overflow-y-auto rounded-[20px] border p-2 ${
                isDark
                  ? "border-white/5 bg-white/[0.03]"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              {isLoadingMembers ? (
                <p className="p-4 text-sm italic text-center text-slate-500">
                  Loading members...
                </p>
              ) : filteredMembers.length === 0 ? (
                <p className="p-4 text-sm italic text-center text-slate-500">
                  No loyalty members found.
                </p>
              ) : (
                filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setLoyaltyMember(m);
                      setLoyaltyPointsToApply(0);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      isDark
                        ? "border-slate-800 bg-slate-950 hover:border-slate-700"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">
                        {m.customer_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {m.phone_number}
                      </p>
                    </div>
                    <div className="text-sm font-black text-blue-500 shrink-0">
                      {formatPts(m.loyalty_points)} pts
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div
              className={`flex items-center justify-between gap-3 rounded-[20px] border p-4 ${
                isDark
                  ? "border-white/5 bg-white/[0.03]"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-black truncate">
                  {loyaltyMember.customer_name}
                </p>
                <p className="text-xs text-slate-500">
                  {loyaltyMember.phone_number}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  {readOnly ? "Points Redeemed" : "Balance"}
                </p>
                <p className="text-lg font-black text-blue-500">
                  {formatPts(balance)} pts
                </p>
              </div>
            </div>

            {!readOnly ? (
              <button
                type="button"
                onClick={() => {
                  setLoyaltyMember(null);
                  setLoyaltyPointsToApply(0);
                }}
                className="mt-2 text-xs font-bold text-slate-500 hover:text-red-500"
              >
                Change member
              </button>
            ) : null}

            {readOnly ? (
              <div
                className={`mt-4 rounded-[20px] border p-4 ${
                  isDark
                    ? "border-white/5 bg-white/[0.03]"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-500">Points redeemed</span>
                  <span className="font-black text-red-500">
                    -{Number(loyaltyPointsToApply || 0).toLocaleString()} pts
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 mt-2 text-sm">
                  <span className="text-slate-500">Discount applied</span>
                  <span className="font-black text-emerald-500">
                    {peso(loyaltyDiscountAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 mt-2 text-sm">
                  <span className="text-slate-500">Points earned</span>
                  <span className="font-black text-emerald-500">
                    +{formatPts(loyaltyPointsToEarn)} pts
                  </span>
                </div>
              </div>
            ) : !canRedeem ? (
              <div
                className={`mt-4 rounded-2xl border p-4 text-sm ${
                  isDark
                    ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                This customer needs at least {minToRedeem.toLocaleString()} points
                to redeem. Current balance: {formatPts(balance)} pts.
              </div>
            ) : (
              <div
                className={`mt-4 rounded-[20px] border p-4 ${
                  isDark
                    ? "border-white/5 bg-white/[0.03]"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Points to Redeem (max {Math.floor(balance).toLocaleString()})
                </label>
                <input
                  type="number"
                  min="0"
                  max={Math.floor(balance)}
                  step="1"
                  value={loyaltyPointsToApply}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => {
                    const raw = Math.max(
                      0,
                      parseInt(e.target.value || 0, 10) || 0,
                    );
                    setLoyaltyPointsToApply(Math.min(raw, Math.floor(balance)));
                  }}
                  className={`h-12 w-full rounded-2xl px-4 text-sm font-black outline-none ${inputClass}`}
                  placeholder="0"
                />

                <div className="flex items-center justify-between gap-3 mt-3 text-sm">
                  <span className="text-slate-500">Discount to apply</span>
                  <span className="font-black text-emerald-500">
                    {peso(loyaltyDiscountAmount)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 mt-2 text-sm">
                  <span className="text-slate-500">Points to earn (this sale)</span>
                  <span className="font-black text-emerald-500">
                    +{formatPts(loyaltyPointsToEarn)} pts
                  </span>
                </div>

                <div
                  className={`mt-3 flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm ${
                    isDark
                      ? "border-white/5 bg-slate-950/60"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <span className="font-bold text-slate-500">New Balance</span>
                  <span className="font-black text-blue-500">
                    {formatPts(newBalance)} pts
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-center mt-5">
          <button
            onClick={onClose}
            className="px-10 py-3 text-sm font-black text-white transition bg-blue-600 rounded-2xl hover:bg-blue-500"
          >
            Done
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export default function TransactionPaymentModal({
  isOpen,
  onClose,
  transaction,
  apiHost,
  isDark,
  modeOfPayments,
  chargeOptions,
  onSaved,
  mode = "pending",
  onShowQR = null,
}) {
  const defaultPrinterName = useGetDefaultPrinter();
  const { businessInfo, isBusInfoLoading } = useBusinessInfo();

  const [isPrinting, setIsPrinting] = useState(false);

  const isPaidMode = mode === "paid";

  const [items, setItems] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [customerCount, setCustomerCount] = useState(1);
  const [discountState, setDiscountState] = useState(
    buildInitialDiscountState(),
  );
  const [discountCeilingAmount, setDiscountCeilingAmount] = useState(0);
  const [customerCards, setCustomerCards] = useState([]);

  // Amounts saved by billing.php via tbl_pos_transactions_discounts (one row per qualified person).
  // Used so the payment modal shows the exact amounts computed during Print Billing.
  const [billingStoredDiscounts, setBillingStoredDiscounts] = useState(null);
  const [billingCounts, setBillingCounts] = useState(null);

  // Discount types (Senior/PWD/NAAC/Solo Parent + any custom type from
  // Settings > Discount Mode > Discount Types) are no longer always shown --
  // cashier adds them via "+ Add Discount", filtered to whatever's active
  // for this transaction's sales type.
  const [availableDiscountTypes, setAvailableDiscountTypes] = useState([]);
  const [addedStatutoryKeys, setAddedStatutoryKeys] = useState(() => new Set());
  const [customDiscountLines, setCustomDiscountLines] = useState([]);
  const [rawCustomCountsByLabel, setRawCustomCountsByLabel] = useState(null);
  const [showAddDiscountMenu, setShowAddDiscountMenu] = useState(false);

  const [discountMode, setDiscountMode] = useState("PerCustomer");
  const [discountSharingMode, setDiscountSharingMode] = useState("shared");
  const [selectedProductIds, setSelectedProductIds] = useState({});

  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceChargePercentage, setServiceChargePercentage] = useState(0);

  const [otherCharges, setOtherCharges] = useState([]);
  const [payments, setPayments] = useState([]);

  // Discount types active for this transaction's sales type -- what the
  // "+ Add Discount" picker offers, resolved via lkp_discount_type +
  // tbl_pos_discount_type_sales_type (Settings > Discount Mode).
  useEffect(() => {
    if (!isOpen || !apiHost) return undefined;

    const salesTypeDescription = transaction?.order_type || "";
    if (!salesTypeDescription) {
      setAvailableDiscountTypes([]);
      return undefined;
    }

    let cancelled = false;

    fetch(
      `${apiHost}/api/pos_discount_types.php?sales_type_description=${encodeURIComponent(salesTypeDescription)}`,
    )
      .then((res) => res.json())
      .then((result) => {
        if (!cancelled && result?.success) {
          setAvailableDiscountTypes(
            Array.isArray(result?.data?.discount_types)
              ? result.data.discount_types
              : [],
          );
        }
      })
      .catch(() => {
        if (!cancelled) setAvailableDiscountTypes([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, apiHost, transaction?.order_type]);

  // Once both the previously-saved custom discount rows (from the load
  // effect further below) and the sales-type-active discount types are in,
  // rebuild customDiscountLines so reopening a transaction doesn't lose
  // custom discount lines applied during Print Billing.
  useEffect(() => {
    if (!rawCustomCountsByLabel) return;

    const labels = Object.keys(rawCustomCountsByLabel);
    if (labels.length === 0) return;

    setCustomDiscountLines((prev) => {
      if (prev.length > 0) return prev;

      return labels.map((label) => {
        const match = availableDiscountTypes.find(
          (t) => t.discount_name === label,
        );
        return {
          localId: `restored-${label}`,
          discount_type_id: match?.id ?? null,
          label,
          calculation_type: match?.calculation_type || "percentage",
          is_vat_exempt: !!Number(match?.is_vat_exempt || 0),
          percent: Number(match?.percent ?? 0),
          qualifiedCount: Number(rawCustomCountsByLabel[label]?.count || 0),
          manualAmount: "",
        };
      });
    });
  }, [rawCustomCountsByLabel, availableDiscountTypes]);

  // "Show QR" toggle state for Kiosk second-screen
  const [qrActive, setQrActive] = useState(false);

  // When modal closes, revert second screen and reset toggle
  useEffect(() => {
    if (!isOpen && onShowQR) {
      onShowQR(null);
      setQrActive(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Auto-update of the displayed QR + payment summary while QR is active
  // lives further below, once `computed`/`groupedPaymentMethodText` exist.

  const [showOtherChargesModal, setShowOtherChargesModal] = useState(false);
  const [showCustomerInfoModal, setShowCustomerInfoModal] = useState(false);
  const [showPaymentMethodsModal, setShowPaymentMethodsModal] = useState(false);
  const [showInputPaymentsModal, setShowInputPaymentsModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showConfirmSaveModal, setShowConfirmSaveModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCustomerExclusiveModal, setShowCustomerExclusiveModal] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);

  const [loyaltyConfig, setLoyaltyConfig] = useState({
    earningRuleAmount: 100,
    redemptionRuleValue: 1,
    minimumPointsToRedeem: 50,
  });
  const [loyaltyMember, setLoyaltyMember] = useState(null);
  const [loyaltyPointsToApply, setLoyaltyPointsToApply] = useState(0);
  // Non-null once a saved redemption is loaded for this transaction (paid/history) —
  // pins the discount to the amount actually charged instead of recomputing off
  // the live redemption rate, which may have changed since.
  const [loyaltyStoredDiscountAmount, setLoyaltyStoredDiscountAmount] = useState(null);
  // Same idea, but for points earned -- pins the reprint to the exact
  // fractional amount actually credited instead of recomputing off today's
  // earning rule.
  const [loyaltyStoredPointsEarned, setLoyaltyStoredPointsEarned] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [receiptSnapshot, setReceiptSnapshot] = useState(null);
  const [printerName, setPrinterName] = useState("");
  const [printers, setPrinters] = useState([]);
  const [shiftDetails, setShiftDetails] = useState(null);

  const validManualOtherCharges = useMemo(
    () =>
      otherCharges
        .filter(
          (row) =>
            !isAutoServiceChargeRow(row) &&
            String(row.particulars || "").trim() &&
            toNum(row.amount) > 0,
        )
        .map((row) => ({
          particulars: String(row.particulars || "").trim(),
          amount: Number(toNum(row.amount)),
          reference: String(row.reference || "").trim(),
        })),
    [otherCharges],
  );

  const autoBillingCharges = useMemo(
    () =>
      otherCharges
        .filter(
          (row) =>
            isAutoServiceChargeRow(row) &&
            String(row.particulars || "").trim() &&
            toNum(row.amount) > 0,
        )
        .map((row) => ({
          particulars: String(row.particulars || "").trim(),
          amount: Number(toNum(row.amount)),
        })),
    [otherCharges],
  );

  // let escposWarmedUp = false;

  useEffect(() => {
    // if (escposWarmedUp) return;

    const warmupPrinter = async () => {
      try {
        if (!window?.electronAPI?.warmupEscPos) return;

        const result = await window.electronAPI.warmupEscPos();
        console.log("ESC/POS warm-up result:", result);

        // if (result?.success) {
        //   escposWarmedUp = true;
        // }
      } catch (error) {
        console.error("ESC/POS warm-up failed:", error);
      }
    };

    warmupPrinter();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const loadPrinters = async () => {
      try {
        const list = await window.electronAPI?.getPrinters?.();
        const safeList = Array.isArray(list) ? list : [];

        setPrinters(safeList);

        const matchedPrinter = safeList.find(
          (p) =>
            String(p.name || "").trim() ===
            String(defaultPrinterName || "").trim(),
        );

        const fallbackElectronDefault = safeList.find((p) => p.isDefault);

        const resolvedPrinterName =
          matchedPrinter?.name ||
          String(defaultPrinterName || "").trim() ||
          fallbackElectronDefault?.name ||
          "";

        setPrinterName(resolvedPrinterName);

        console.log("Electron printers:", safeList);
        console.log("Default printer from hook:", defaultPrinterName);
        console.log(
          "Matched printer from hook:",
          matchedPrinter?.name || "(none)",
        );
        console.log(
          "Electron default printer:",
          fallbackElectronDefault?.name || "(none)",
        );
        // console.log("Resolved printer:", resolvedPrinterName);
      } catch (error) {
        console.error("Failed to load printers:", error);
        setPrinterName(String(defaultPrinterName || "").trim());
      }
    };

    loadPrinters();
  }, [isOpen, defaultPrinterName]);

  useEffect(() => {
    const activeUserId = getActiveUserId();
    if (!isOpen || !apiHost || !activeUserId) return;

    let cancelled = false;

    const fetchShiftDetails = async () => {
      try {
        const response = await fetch(
          `${apiHost}/api/get_shift_details.php?user_id=${encodeURIComponent(
            activeUserId,
          )}`,
        );

        const result = await response.json();

        if (!cancelled) {
          setShiftDetails(result || null);

          if (result?.userName) {
            localStorage.setItem("Cashier", result.userName);
          }
        }
      } catch (error) {
        console.error("Failed to load shift details:", error);
        if (!cancelled) {
          setShiftDetails(null);
        }
      }
    };

    fetchShiftDetails();

    return () => {
      cancelled = true;
    };
  }, [isOpen, apiHost]);

  useEffect(() => {
    if (!isOpen || !apiHost) return;

    let cancelled = false;

    const fetchDiscountCeiling = async () => {
      try {
        const response = await fetch(`${apiHost}/api/pos_discount_ceiling.php`);
        const result = await response.json();

        if (!cancelled) {
          setDiscountCeilingAmount(Number(result?.data?.discount_ceiling || 0));
        }
      } catch (error) {
        console.error("Failed to load discount ceiling:", error);
        if (!cancelled) {
          setDiscountCeilingAmount(0);
        }
      }
    };

    fetchDiscountCeiling();

    return () => {
      cancelled = true;
    };
  }, [isOpen, apiHost]);

  useEffect(() => {
    if (!isOpen || !apiHost) return;

    let cancelled = false;

    const fetchServiceCharge = async () => {
      try {
        const response = await fetch(`${apiHost}/api/pos_service_charge.php`);
        const result = await response.json();

        if (!cancelled) {
          const enabled = String(result?.data?.enabled || "False") === "True";
          const percentage = Number(result?.data?.percentage || 0);
          setServiceChargeEnabled(enabled);
          setServiceChargePercentage(percentage);
        }
      } catch (error) {
        console.error("Failed to load service charge settings:", error);
        if (!cancelled) {
          setServiceChargeEnabled(false);
          setServiceChargePercentage(0);
        }
      }
    };

    fetchServiceCharge();

    return () => {
      cancelled = true;
    };
  }, [isOpen, apiHost]);

  useEffect(() => {
    if (!isOpen || !apiHost) return;

    let cancelled = false;

    const fetchServiceChargeSettings = async () => {
      try {
        const response = await fetch(`${apiHost}/api/pos_service_charge.php`);
        const result = await response.json();

        if (!cancelled) {
          setServiceChargeEnabled(Boolean(result?.data?.service_charge_enabled || false));
          setServiceChargePercentage(Number(result?.data?.service_charge_percentage || 0));
        }
      } catch (error) {
        console.error("Failed to load service charge settings:", error);
        if (!cancelled) {
          setServiceChargeEnabled(false);
          setServiceChargePercentage(0);
        }
      }
    };

    fetchServiceChargeSettings();

    return () => {
      cancelled = true;
    };
  }, [isOpen, apiHost]);

  useEffect(() => {
    if (!isOpen || !apiHost) return;
    let cancelled = false;
    const fetchDiscountMode = async () => {
      try {
        const res = await fetch(`${apiHost}/api/pos_discount_mode.php`);
        const result = await res.json();
        if (!cancelled) {
          setDiscountMode(
            result?.data?.discount_mode === "PerProduct"
              ? "PerProduct"
              : "PerCustomer",
          );
        }
      } catch {
        if (!cancelled) setDiscountMode("PerCustomer");
      }
    };
    fetchDiscountMode();
    return () => { cancelled = true; };
  }, [isOpen, apiHost]);

  useEffect(() => {
    if (!isOpen || !apiHost) return;
    let cancelled = false;

    const fetchLoyaltyConfig = async () => {
      try {
        const response = await fetch(`${apiHost}/api/pos_loyalty_config.php`);
        const result = await response.json();
        if (!cancelled) {
          setLoyaltyConfig({
            earningRuleAmount: Number(result?.data?.earning_rule_amount || 100),
            redemptionRuleValue: Number(result?.data?.redemption_rule_value || 1),
            minimumPointsToRedeem: Number(result?.data?.minimum_points_to_redeem || 50),
          });
        }
      } catch (error) {
        console.error("Failed to load loyalty configuration:", error);
      }
    };

    fetchLoyaltyConfig();
    return () => { cancelled = true; };
  }, [isOpen, apiHost]);

  useEffect(() => {
    if (!items.length || discountMode !== "PerProduct") return;
    const init = {};
    items.forEach((item) => {
      if (yesNoToBool(item.isDiscountable)) {
        init[String(item.ID || item.id || item.databaseID || "")] = Number(item.sales_quantity || 0);
      }
    });
    setSelectedProductIds(init);
  }, [items, discountMode]);

  const terminalConfig = useMemo(() => {
    const terminal = shiftDetails?.terminal || {};

    return {
      categoryCode:
        shiftDetails?.Category_Code || transaction?.Category_Code || "",
      unitCode: shiftDetails?.Unit_Code || transaction?.Unit_Code || "",
      businessUnitName:
        shiftDetails?.Unit_Name ||
        terminal?.businessUnitName ||
        transaction?.Unit_Name ||
        "",
      terminalNumber:
        shiftDetails?.terminal_number ||
        terminal?.terminalNumber ||
        transaction?.terminal_number ||
        "1",
      corpName:
        terminal?.corpName ||
        shiftDetails?.corpName ||
        "Crabs N Crack Seafood House",
      unitAddress:
        shiftDetails?.Unit_Address ||
        terminal?.unitAddress ||
        transaction?.Unit_Address ||
        "",
      vatTin:
        shiftDetails?.Unit_TIN ||
        terminal?.vatTin ||
        transaction?.Unit_TIN ||
        "",
      machineNumber:
        terminal?.machineNumber ||
        terminal?.machine_number ||
        shiftDetails?.machineNumber ||
        shiftDetails?.machine_number ||
        "",
      serialNumber:
        terminal?.serialNumber ||
        terminal?.serial_number ||
        shiftDetails?.serialNumber ||
        shiftDetails?.serial_number ||
        "",
      ptuNumber:
        terminal?.ptuNumber ||
        terminal?.ptu_number ||
        shiftDetails?.ptuNumber ||
        shiftDetails?.ptu_number ||
        "",
      ptuDateIssued:
        terminal?.ptuDateIssued ||
        terminal?.ptu_date_issued ||
        shiftDetails?.ptuDateIssued ||
        shiftDetails?.ptu_date_issued ||
        "",
    };
  }, [shiftDetails, transaction]);

  const handleElectronPrint = async (snapshotOverride = null) => {
    try {
      const snapshot = snapshotOverride || receiptSnapshot;

      if (!snapshot) {
        throw new Error("No receipt data available to print.");
      }

      if (!window.electronAPI?.printReceipt) {
        throw new Error("Electron print API is not available.");
      }

      const result = await window.electronAPI.pospaymentreceipt({
        transaction: snapshot.transaction || transaction,
        items: snapshot.items || items,
        computed: snapshot.computed || computed,
        payments: snapshot.payments || payments,
        otherCharges: snapshot.otherCharges || otherCharges,
        customerCards: snapshot.customerCards || customerCards,
        isDuplicateCopy: snapshot.isDuplicateCopy || false,
        terminalConfig,
        businessInfo,
        printerName: printerName || defaultPrinterName || "",
      });

      const safeComputed = snapshot.computed || computed || {};
      const totalQualified = Number(
        safeComputed?.totalQualifiedCount ??
          safeComputed?.totalQualifiedAll ??
          0,
      );

      if (result?.success && totalQualified > 0) {
        await window.electronAPI.pospaymentreceipt({
          transaction: snapshot.transaction || transaction,
          items: snapshot.items || items,
          computed: snapshot.computed || computed,
          payments: snapshot.payments || payments,
          otherCharges: snapshot.otherCharges || otherCharges,
          customerCards: snapshot.customerCards || customerCards,
          isDuplicateCopy: snapshot.isDuplicateCopy || false,
          terminalConfig,
          businessInfo,
          printerName: printerName || defaultPrinterName || "",
        });
      }
      // const html = BuildPosPaymentReceiptHtml({
      //   transaction: snapshot.transaction || transaction,
      //   items: snapshot.items || items,
      //   computed: snapshot.computed || computed,
      //   payments: snapshot.payments || payments,
      //   otherCharges: snapshot.otherCharges || otherCharges,
      //   customerCards: snapshot.customerCards || customerCards,
      //   isDuplicateCopy: snapshot.isDuplicateCopy || false,
      //   terminalConfig,
      //   businessInfo,
      // });

      // const result = await window.electronAPI.printReceipt({
      //   html,
      //   printerName: printerName || defaultPrinterName || "",
      //   silent: true,
      //   copies: 1,
      // });

      console.log("Payment print result:", result);

      if (!result?.success) {
        throw new Error(result?.message || "Failed to print receipt.");
      }
      setIsPrinting(false);
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || "Failed to print receipt.");
      setIsPrinting(false);
    }
  };

  const handleSuccessModalPrint = async () => {
    try {
      setIsPrinting(true);
      await handleElectronPrint();
    } finally {
      setIsPrinting(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !transaction?.transaction_id) return;

    const initialize = async () => {
      setItems([]);
      setIsLoadingItems(true);
      setErrorMessage("");
      setShowConfirmSaveModal(false);
      setShowSuccessModal(false);
      setReceiptSnapshot(null);
      setOtherCharges([]);
      setPayments([]);
      setBillingStoredDiscounts(null);
      setBillingCounts(null);
      setAddedStatutoryKeys(new Set());
      setCustomDiscountLines([]);
      setRawCustomCountsByLabel(null);
      setShowAddDiscountMenu(false);
      setDiscountSharingMode("shared");
      setSelectedProductIds({});
      setLoyaltyMember(null);
      setLoyaltyPointsToApply(0);
      setLoyaltyStoredDiscountAmount(null);
      setLoyaltyStoredPointsEarned(null);

      try {
        const res = await fetch(
          `${apiHost}/api/pos_payment_read_transaction_details.php`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              transaction_id: transaction.transaction_id,
            }),
          },
        );

        const data = await res.json();

        const txn = data?.transaction_summary || {};
        const detailItems = Array.isArray(data?.items) ? data.items : [];
        const detailPayments = Array.isArray(data?.payments)
          ? data.payments
          : [];
        const detailCharges = Array.isArray(data?.other_charges)
          ? data.other_charges
          : [];
        const discountRows = Array.isArray(data?.discount_rows)
          ? data.discount_rows
          : [];
        const discountCounts = data?.discount_counts || {
          senior: 0,
          pwd: 0,
          naac: 0,
          soloParent: 0,
          manual: 0,
        };
        const loyaltyDiscountRow = data?.loyalty_discount || null;

        if (loyaltyDiscountRow) {
          setLoyaltyMember({
            id: Number(loyaltyDiscountRow.loyalty_member_id),
            customer_name: loyaltyDiscountRow.customer_name || "",
            phone_number: loyaltyDiscountRow.phone_number || "",
            loyalty_points: Number(loyaltyDiscountRow.points_redeemed || 0),
          });
          setLoyaltyPointsToApply(Number(loyaltyDiscountRow.points_redeemed || 0));
          setLoyaltyStoredDiscountAmount(Number(loyaltyDiscountRow.discount_amount || 0));
          setLoyaltyStoredPointsEarned(Number(loyaltyDiscountRow.points_earned || 0));
        }

         setItems(detailItems);

        setPayments(
          detailPayments.length > 0
            ? detailPayments.map((row) => ({
                payment_method: row.payment_method || "",
                payment_amount: row.payment_amount || "",
                payment_reference: row.payment_reference || "",
              }))
            : [],
        );

        setOtherCharges(
          detailCharges.length > 0
            ? detailCharges.map((row) => ({
                particulars: row.particulars || "",
                amount: row.amount || "",
                reference: row.reference || "",
              }))
            : [],
        );

        const safeHeadCount = Math.max(
          Number(
            txn.customer_head_count || transaction.customer_head_count || 1,
          ),
          1,
        );

        const rawSenior = Number(discountCounts.senior || 0);
        const rawPwd = Number(discountCounts.pwd || 0);
        const rawNaac = Number(discountCounts.naac || discountCounts.NAAC || 0);
        const rawSoloParent = Number(
          discountCounts.soloParent ||
            discountCounts.solo_parent ||
            discountCounts["Solo Parent"] ||
            0,
        );
        const rawManual = Number(discountCounts.manual || 0);

        const totalQualifiedFromBreakdown =
          rawSenior + rawPwd + rawNaac + rawSoloParent + rawManual;

        let clampedSenior = rawSenior;
        let clampedPwd = rawPwd;
        let clampedNaac = rawNaac;
        let clampedSoloParent = rawSoloParent;
        let clampedManual = rawManual;

        if (totalQualifiedFromBreakdown > safeHeadCount) {
          let overflow = totalQualifiedFromBreakdown - safeHeadCount;

          const manualReduce = Math.min(clampedManual, overflow);
          clampedManual -= manualReduce;
          overflow -= manualReduce;

          const soloParentReduce = Math.min(clampedSoloParent, overflow);
          clampedSoloParent -= soloParentReduce;
          overflow -= soloParentReduce;

          const naacReduce = Math.min(clampedNaac, overflow);
          clampedNaac -= naacReduce;
          overflow -= naacReduce;

          const pwdReduce = Math.min(clampedPwd, overflow);
          clampedPwd -= pwdReduce;
          overflow -= pwdReduce;

          const seniorReduce = Math.min(clampedSenior, overflow);
          clampedSenior -= seniorReduce;
          overflow -= seniorReduce;

          console.warn(
            "Discount rows exceed customer_head_count for transaction",
            transaction.transaction_id,
            {
              safeHeadCount,
              rawSenior,
              rawPwd,
              rawNaac,
              rawSoloParent,
              rawManual,
              clampedSenior,
              clampedPwd,
              clampedNaac,
              clampedSoloParent,
              clampedManual,
            },
          );
        }

        setCustomerCount(safeHeadCount);

        setDiscountState({
          senior: {
            qualifiedCount: clampedSenior,
            manualAmount: "",
          },
          pwd: {
            qualifiedCount: clampedPwd,
            manualAmount: "",
          },
          naac: {
            qualifiedCount: clampedNaac,
            manualAmount: "",
          },
          soloParent: {
            qualifiedCount: clampedSoloParent,
            manualAmount: "",
          },
          manual: {
            qualifiedCount: clampedManual,
            manualAmount: discountRows
              .filter((row) =>
                String(row.discount_type || "")
                  .toLowerCase()
                  .includes("manual"),
              )
              .reduce((sum, row) => sum + Number(row.discount_amount || 0), 0),
            manualPercent: "",
            manualMode: "amount",
          },
        });

        // Compute per-type totals from the rows saved during Print Billing so the
        // payment amounts match the billing receipt without recomputing from items.
        const billingAmountsByType = { senior: 0, pwd: 0, naac: 0, soloParent: 0 };
        const billingCountsByType = {
          senior: Number(discountCounts.senior || 0),
          pwd: Number(discountCounts.pwd || 0),
          naac: Number(discountCounts.naac || 0),
          soloParent: Number(discountCounts.soloParent || 0),
        };
        discountRows.forEach((row) => {
          const t = String(row.discount_type || "").toLowerCase().trim();
          let k = "";
          if (t === "senior" || t === "senior citizen" || t === "senior citizen discount") k = "senior";
          else if (t === "pwd" || t === "pwd discount") k = "pwd";
          else if (t === "naac" || t === "naac discount" || t.startsWith("national athletes")) k = "naac";
          else if (t.includes("solo parent") || t === "soloparent") k = "soloParent";
          if (k) billingAmountsByType[k] += Number(row.discount_amount || 0);
        });
        setBillingStoredDiscounts(billingAmountsByType);
        setBillingCounts(billingCountsByType);

        setAddedStatutoryKeys(
          new Set(
            [
              clampedSenior > 0 ? "senior" : null,
              clampedPwd > 0 ? "pwd" : null,
              clampedNaac > 0 ? "naac" : null,
              clampedSoloParent > 0 ? "soloParent" : null,
            ].filter(Boolean),
          ),
        );

        const rawByLabel = data?.discount_counts_by_label || {};
        const customByLabel = {};
        Object.entries(rawByLabel).forEach(([label, info]) => {
          if (!STATUTORY_DISCOUNT_LABELS.has(String(label).trim().toLowerCase())) {
            customByLabel[label] = info;
          }
        });
        setRawCustomCountsByLabel(customByLabel);

        setCustomerCards(
          discountRows.length > 0
            ? discountRows
                .slice(
                  0,
                  clampedSenior +
                    clampedPwd +
                    clampedNaac +
                    clampedSoloParent +
                    clampedManual,
                )
                .map((row) => ({
                  customer_exclusive_id: row.customer_id || "",
                  customer_name: row.customer_name || "",
                  date_of_birth: row.date_of_birth || "",
                  gender: row.gender || "",
                  tin: row.tin || "",
                  contact_no: row.contact_no || "",
                }))
            : [],
        );
      } catch (error) {
        console.error(error);
        setErrorMessage("Failed to load transaction items.");
        setItems([]);
        setDiscountState(buildInitialDiscountState());
        setCustomerCards([]);
      } finally {
        setIsLoadingItems(false);
      }
    };

    initialize();
  }, [isOpen, transaction, apiHost]);

  const totalQualifiedAll = useMemo(() => {
    const customCount = customDiscountLines
      .filter((line) => line.calculation_type !== "fixed")
      .reduce(
        (sum, line) => sum + Math.max(Math.floor(Number(line.qualifiedCount || 0)), 0),
        0,
      );

    return (
      Number(discountState?.senior?.qualifiedCount || 0) +
      Number(discountState?.pwd?.qualifiedCount || 0) +
      Number(discountState?.naac?.qualifiedCount || 0) +
      Number(discountState?.soloParent?.qualifiedCount || 0) +
      Number(discountState?.manual?.qualifiedCount || 0) +
      customCount
    );
  }, [discountState, customDiscountLines]);

  useEffect(() => {
    const safeQualified = Math.max(Number(totalQualifiedAll) || 0, 0);

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
  }, [totalQualifiedAll]);

  const computed = useMemo(() => {
    const safeCustomerCount = Math.max(Number(customerCount) || 1, 1);

    const rawSeniorCount = Math.max(
      Math.floor(Number(discountState?.senior?.qualifiedCount || 0)),
      0,
    );
    const rawPwdCount = Math.max(
      Math.floor(Number(discountState?.pwd?.qualifiedCount || 0)),
      0,
    );
    const rawNaacCount = Math.max(
      Math.floor(Number(discountState?.naac?.qualifiedCount || 0)),
      0,
    );

    const rawSoloParentCount = Math.max(
      Math.floor(Number(discountState?.soloParent?.qualifiedCount || 0)),
      0,
    );
    const rawManualCount = Math.max(
      Math.floor(Number(discountState?.manual?.qualifiedCount || 0)),
      0,
    );
    const rawManualAmount = Math.max(
      Number(discountState?.manual?.manualAmount || 0),
      0,
    );
    const manualPercent = Math.max(
      Number(discountState?.manual?.manualPercent || 0),
      0,
    );
    const manualMode =
      discountState?.manual?.manualMode === "percent" ? "percent" : "amount";

    // Custom discount lines (added via "+ Add Discount", any lkp_discount_type
    // entry that isn't one of the 4 statutory types) qualify the same way --
    // their qualified count counts toward VAT-exemption proration when
    // is_vat_exempt, and toward the customer-info-capture count either way.
    const customQualifiedCount = customDiscountLines
      .filter((line) => line.calculation_type !== "fixed")
      .reduce(
        (sum, line) => sum + Math.max(Math.floor(Number(line.qualifiedCount || 0)), 0),
        0,
      );
    const customVatExemptQualifiedCount = customDiscountLines
      .filter((line) => line.calculation_type !== "fixed" && line.is_vat_exempt)
      .reduce(
        (sum, line) => sum + Math.max(Math.floor(Number(line.qualifiedCount || 0)), 0),
        0,
      );

    const totalQualifiedAllLocal =
      rawSeniorCount +
      rawPwdCount +
      rawNaacCount +
      rawSoloParentCount +
      rawManualCount +
      customQualifiedCount;

    const statutoryQualifiedCount =
      rawSeniorCount +
      rawPwdCount +
      rawNaacCount +
      rawSoloParentCount +
      customVatExemptQualifiedCount;

    const statutoryQualifiedRatio =
      safeCustomerCount > 0
        ? Math.min(statutoryQualifiedCount, safeCustomerCount) /
          safeCustomerCount
        : 0;

    const notQualifiedRatio =
      safeCustomerCount > 0 ? 1 - statutoryQualifiedRatio : 0;

    const isPerProduct = discountMode === "PerProduct";

    let discountableGross = 0;
    let discountableBase = 0;
    let selectedDiscountableGross = 0;
    let selectedDiscountableBase = 0;
    let rawVatableGross = 0;
    let vatableSales = 0;
    let vatableSalesVat = 0;
    let vatExemptSales = 0;
    const vatZeroRatedSales = 0;

    let grossTotal = 0;
    let totalQuantity = 0;

    items.forEach((item) => {
      const qty = Number(item.sales_quantity || 0);
      const price = Number(item.selling_price || 0);
      const lineTotal = qty * price;
      const isDiscountable = yesNoToBool(item.isDiscountable);
      const isVatable = yesNoToBool(item.vatable);
      const itemKey = String(item.ID || item.id || item.databaseID || "");
      const discountQty = isPerProduct
        ? Math.min(Math.max(Number(selectedProductIds[itemKey] ?? qty), 0), qty)
        : qty;
      const discountLineTotal = price * discountQty;
      const nonDiscountLineTotal = lineTotal - discountLineTotal;

      grossTotal += lineTotal;
      totalQuantity += qty;

      if (isDiscountable) {
        discountableGross += lineTotal;
        discountableBase += isVatable ? lineTotal / 1.12 : lineTotal;

        if (discountQty > 0) {
          selectedDiscountableGross += discountLineTotal;
          selectedDiscountableBase += isVatable ? discountLineTotal / 1.12 : discountLineTotal;
        }

        if (isVatable) {
          if (isPerProduct) {
            if (discountQty > 0) {
              vatExemptSales += discountLineTotal * statutoryQualifiedRatio;
              rawVatableGross += nonDiscountLineTotal + discountLineTotal * notQualifiedRatio;
            } else {
              rawVatableGross += lineTotal;
            }
          } else {
            vatExemptSales += lineTotal * statutoryQualifiedRatio;
            rawVatableGross += lineTotal * notQualifiedRatio;
          }
        } else {
          vatExemptSales += lineTotal;
        }
      } else {
        if (isVatable) {
          rawVatableGross += lineTotal;
        } else {
          vatExemptSales += lineTotal;
        }
      }
    });

    vatableSales = rawVatableGross / 1.12;
    vatableSalesVat = vatableSales * 0.12;

    const discountBase = isPerProduct
      ? selectedDiscountableBase
      : discountableBase;

    // Solo: each qualified person gets the full base (no division by total customers)
    // Shared: standard proration — base × (qualifiedCount / totalCustomers)
    const prorate = (count) =>
      discountSharingMode === "solo"
        ? discountBase * count
        : safeCustomerCount > 0 ? discountBase * (count / safeCustomerCount) : 0;

    const seniorProratedBase = prorate(rawSeniorCount);
    const pwdProratedBase = prorate(rawPwdCount);
    const naacProratedBase = prorate(rawNaacCount);
    const soloParentProratedBase = prorate(rawSoloParentCount);
    // Use amounts saved during Print Billing when the qualified counts still match
    // what billing used. When counts are changed manually in the payment modal,
    // the stored amounts no longer correspond so we fall back to recomputing.
    const useStoredSenior =
      billingStoredDiscounts !== null &&
      billingCounts !== null &&
      rawSeniorCount > 0 &&
      rawSeniorCount === billingCounts.senior &&
      billingStoredDiscounts.senior > 0;
    const useStoredPwd =
      billingStoredDiscounts !== null &&
      billingCounts !== null &&
      rawPwdCount > 0 &&
      rawPwdCount === billingCounts.pwd &&
      billingStoredDiscounts.pwd > 0;
    const useStoredNaac =
      billingStoredDiscounts !== null &&
      billingCounts !== null &&
      rawNaacCount > 0 &&
      rawNaacCount === billingCounts.naac &&
      billingStoredDiscounts.naac > 0;
    const useStoredSoloParent =
      billingStoredDiscounts !== null &&
      billingCounts !== null &&
      rawSoloParentCount > 0 &&
      rawSoloParentCount === billingCounts.soloParent &&
      billingStoredDiscounts.soloParent > 0;

    // Senior/PWD/NAAC: discount = base × 0.20, vatEx = base × 0.12 → vatEx = discount × 0.6
    // Solo Parent: discount = base × 0.10, vatEx = base × 0.12 → vatEx = discount × 1.2
    const seniorDiscountAmount = useStoredSenior
      ? billingStoredDiscounts.senior
      : seniorProratedBase * 0.2;
    const seniorVatExemption = useStoredSenior
      ? billingStoredDiscounts.senior * 0.6
      : seniorProratedBase * 0.12;

    const pwdDiscountAmount = useStoredPwd
      ? billingStoredDiscounts.pwd
      : pwdProratedBase * 0.2;
    const pwdVatExemption = useStoredPwd
      ? billingStoredDiscounts.pwd * 0.6
      : pwdProratedBase * 0.12;

    const naacDiscountAmount = useStoredNaac
      ? billingStoredDiscounts.naac
      : naacProratedBase * 0.2;
    const naacVatExemption = useStoredNaac
      ? billingStoredDiscounts.naac * 0.6
      : naacProratedBase * 0.12;

    const soloParentDiscountAmount = useStoredSoloParent
      ? billingStoredDiscounts.soloParent
      : soloParentProratedBase * 0.1;
    const soloParentVatExemption = useStoredSoloParent
      ? billingStoredDiscounts.soloParent * 1.2
      : soloParentProratedBase * 0.12;

    const manualDiscountAmount =
      manualMode === "percent"
        ? discountableGross * (manualPercent / 100)
        : rawManualAmount;
    const manualVatExemption = 0;

    const loyaltyDiscountAmount = loyaltyStoredDiscountAmount !== null
      ? loyaltyStoredDiscountAmount
      : loyaltyMember
        ? Math.min(
            Number(loyaltyPointsToApply || 0),
            Number(loyaltyMember.loyalty_points || 0),
          ) * Number(loyaltyConfig.redemptionRuleValue || 0)
        : 0;

    // Custom discount lines added via "+ Add Discount" (any lkp_discount_type
    // entry active for this sales type besides the 4 statutory ones). Reuse
    // the amount saved during Print Billing when the qualified count still
    // matches, same as the statutory types above, so the payment screen
    // doesn't drift from what was already printed.
    const customLinesComputed = customDiscountLines.map((line) => {
      const isFixed = line.calculation_type === "fixed";
      const qualifiedCount = isFixed
        ? 0
        : Math.max(Math.floor(Number(line.qualifiedCount || 0)), 0);
      const proratedBase = isFixed ? 0 : prorate(qualifiedCount);
      const { discountAmount, vatExemption } = resolveDiscountLineAmount({
        label: line.label,
        qualifiedCount,
        line,
        proratedBase,
        storedCountsByLabel: rawCustomCountsByLabel,
      });

      return {
        key: `custom-${line.localId}`,
        label: line.label,
        qualifiedCount: isFixed ? 1 : qualifiedCount,
        proratedBase,
        discountAmount,
        vatExemption,
      };
    });

    const rawDiscountBreakdown = [
      {
        key: "senior",
        label: "Senior Citizen",
        qualifiedCount: rawSeniorCount,
        proratedBase: seniorProratedBase,
        discountAmount: seniorDiscountAmount,
        vatExemption: seniorVatExemption,
      },
      {
        key: "pwd",
        label: "PWD",
        qualifiedCount: rawPwdCount,
        proratedBase: pwdProratedBase,
        discountAmount: pwdDiscountAmount,
        vatExemption: pwdVatExemption,
      },
      {
        key: "naac",
        label: "NAAC",
        qualifiedCount: rawNaacCount,
        proratedBase: naacProratedBase,
        discountAmount: naacDiscountAmount,
        vatExemption: naacVatExemption,
      },
      {
        key: "soloParent",
        label: "Solo Parent",
        qualifiedCount: rawSoloParentCount,
        proratedBase: soloParentProratedBase,
        discountAmount: soloParentDiscountAmount,
        vatExemption: soloParentVatExemption,
      },
      {
        key: "manual",
        label: "Manual Discount",
        qualifiedCount: rawManualCount,
        proratedBase: 0,
        discountAmount: manualDiscountAmount,
        vatExemption: manualVatExemption,
        manualPercent,
        manualMode,
      },
      {
        key: "loyalty",
        label: "Loyalty Points",
        qualifiedCount: loyaltyDiscountAmount > 0 ? 1 : 0,
        proratedBase: 0,
        discountAmount: loyaltyDiscountAmount,
        vatExemption: 0,
      },
      ...customLinesComputed,
    ];

    const {
      discountBreakdown,
      rawTotalDiscount,
      totalDiscount,
      isDiscountCeilingApplied,
    } = applyDiscountCeiling(rawDiscountBreakdown, discountCeilingAmount);

    const totalVatExemption = discountBreakdown.reduce(
      (sum, entry) => sum + Number(entry.vatExemption || 0),
      0,
    );

    const finalVatExemptSales = Math.max(vatExemptSales - totalVatExemption, 0);

    const serviceChargeBase = grossTotal;
    const serviceChargeAmount = 0;

    const autoBillingChargesAmount = autoBillingCharges.reduce(
      (sum, row) => sum + row.amount,
      0,
    );

    const manualOtherChargesAmount = validManualOtherCharges.reduce(
      (sum, row) => sum + toNum(row.amount),
      0,
    );

    const totalOtherCharges = autoBillingChargesAmount + manualOtherChargesAmount;

    const totalAmountDue = Math.max(
      grossTotal - totalDiscount - totalVatExemption + totalOtherCharges,
      0,
    );

    const totalPaid = payments.reduce(
      (sum, row) => sum + toNum(row.payment_amount),
      0,
    );

    const changeAmount = Math.max(totalPaid - totalAmountDue, 0);
    const shortOver = totalPaid - totalAmountDue;

    const loyaltyEarningRuleAmount = Number(loyaltyConfig.earningRuleAmount || 0);
    const loyaltyPointsToEarn = loyaltyStoredPointsEarned !== null
      ? loyaltyStoredPointsEarned
      : loyaltyEarningRuleAmount > 0
        ? roundMoney(totalAmountDue / loyaltyEarningRuleAmount)
        : 0;

    const loyaltyNewBalance = loyaltyMember
      ? roundMoney(
          Number(loyaltyMember.loyalty_points || 0) -
            Number(loyaltyPointsToApply || 0) +
            Number(loyaltyPointsToEarn || 0),
        )
      : 0;

    const discountTypeSummary = discountBreakdown
      .filter(
        (entry) =>
          Number(entry.qualifiedCount || 0) > 0 ||
          Number(entry.discountAmount || 0) > 0,
      )
      .map((entry) => entry.label)
      .join(", ");

    return {
      grossTotal,
      totalQuantity,
      discountableGross,
      discountableBase,
      selectedDiscountableGross,
      selectedDiscountableBase,
      isPerProduct,
      discountableItemsCount: items.filter((item) =>
        yesNoToBool(item.isDiscountable),
      ).length,
      safeCustomerCount,
      totalQualifiedAll: totalQualifiedAllLocal,
      statutoryQualifiedCount,
      discountBreakdown,
      rawTotalDiscount,
      totalDiscount,
      discountCeilingAmount,
      isDiscountCeilingApplied,
      totalVatExemption,
      totalAmountDue,
      loyaltyDiscountAmount,
      loyaltyPointsToEarn,
      loyaltyNewBalance,
      serviceChargeEnabled,
      serviceChargePercentage,
      serviceChargeBase,
      serviceChargeAmount,
      autoBillingCharges,
      autoBillingChargesAmount,
      manualOtherChargesAmount,
      totalOtherCharges,
      vatableSales,
      vatableSalesVat,
      vatExemptSales: finalVatExemptSales,
      vatExemptSalesVat: totalVatExemption,
      vatZeroRatedSales,
      totalPaid,
      changeAmount,
      shortOver,
      discountTypeSummary,
    };
  }, [
    items,
    customerCount,
    discountState,
    payments,
    discountCeilingAmount,
    serviceChargeEnabled,
    serviceChargePercentage,
    validManualOtherCharges,
    autoBillingCharges,
    billingStoredDiscounts,
    billingCounts,
    discountMode,
    discountSharingMode,
    selectedProductIds,
    loyaltyMember,
    loyaltyPointsToApply,
    loyaltyConfig,
    loyaltyStoredDiscountAmount,
    loyaltyStoredPointsEarned,
    customDiscountLines,
    rawCustomCountsByLabel,
  ]);

  const groupedPaymentMethodText = useMemo(() => {
    const uniqueMethods = [
      ...new Set(payments.map((p) => p.payment_method).filter(Boolean)),
    ];
    return uniqueMethods.join(", ");
  }, [payments]);

  // Mirrors the "Payment Summary" card so the Kiosk second screen can show
  // the same totals under the QR code.
  const secondScreenPaymentSummary = useMemo(
    () => ({
      totalAmountDue: computed.totalAmountDue,
      totalSales: computed.grossTotal,
      discount: computed.totalDiscount,
      vatExemption: computed.totalVatExemption,
      paymentReceived: computed.totalPaid,
      change: computed.changeAmount,
      discountType: computed.discountTypeSummary || "No Discount",
      qualifiedCustomers: computed.totalQualifiedAll,
      totalCustomers: computed.safeCustomerCount,
      paymentMethod:
        groupedPaymentMethodText ||
        transaction?.payment_method ||
        "No payment yet",
    }),
    [computed, groupedPaymentMethodText, transaction?.payment_method],
  );

  // If QR is active and the payment method or totals change, keep the
  // second screen's QR + payment summary in sync.
  useEffect(() => {
    if (!qrActive || !onShowQR) return;
    onShowQR(
      payments[0]?.payment_method || null,
      undefined,
      secondScreenPaymentSummary,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments[0]?.payment_method, secondScreenPaymentSummary]);

  // "+ Add Discount" picker actions -- statutory cards (Senior/PWD/NAAC/Solo
  // Parent) just toggle visibility (their state/math is unchanged); custom
  // types (from Settings > Discount Mode > Discount Types) get their own
  // dynamic line.
  const addStatutoryDiscount = (key) => {
    setAddedStatutoryKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setShowAddDiscountMenu(false);
  };

  const removeStatutoryDiscount = (key) => {
    setAddedStatutoryKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setDiscountState((prev) => ({
      ...prev,
      [key]: { qualifiedCount: 0, manualAmount: "" },
    }));
  };

  const addCustomDiscountLine = (type) => {
    setCustomDiscountLines((prev) => [
      ...prev,
      {
        localId: `new-${type.id}-${Date.now()}`,
        discount_type_id: type.id,
        label: type.discount_name,
        calculation_type: type.calculation_type,
        is_vat_exempt: !!Number(type.is_vat_exempt),
        percent: Number(type.percent || 0),
        qualifiedCount: 0,
        manualAmount: "",
      },
    ]);
    setShowAddDiscountMenu(false);
  };

  const removeCustomDiscountLine = (localId) => {
    setCustomDiscountLines((prev) => prev.filter((line) => line.localId !== localId));
  };

  const updateCustomLine = (localId, patch) => {
    setCustomDiscountLines((prev) =>
      prev.map((line) => (line.localId === localId ? { ...line, ...patch } : line)),
    );
  };

  const canSave = useMemo(() => {
    if (isPaidMode) return false;
    if (items.length === 0) return false;
    if (payments.length === 0) return false;

    const validPayments = payments.every(
      (row) => row.payment_method && toNum(row.payment_amount) > 0,
    );
    if (!validPayments) return false;

    if (computed.totalPaid < computed.totalAmountDue) return false;

    const allRefsProvided = payments.every((row) => {
      const mopEntry = modeOfPayments.find((m) => m.mop === row.payment_method);
      if (Number(mopEntry?.reference_On_Off ?? 0) !== 1) return true;
      return String(row.payment_reference ?? "").trim().length > 0;
    });
    if (!allRefsProvided) return false;

    return true;
  }, [
    items,
    payments,
    computed.totalPaid,
    computed.totalAmountDue,
    isPaidMode,
    modeOfPayments,
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

  // ── Customer Exclusive (B1T1) ──────────────────────────────────────
  const hasB1T1LoadItem = useMemo(
    () => items.some((item) => Boolean(item?.is_b1t1_load)),
    [items],
  );

  const hasB1T1ExclusivePayment = useMemo(
    () =>
      payments.some((row) => {
        const method = String(row?.payment_method || "").trim().toLowerCase();
        return method === "b1t1balance" || method === "b1t1diamonds";
      }),
    [payments],
  );

  const shouldShowCustomerExclusive = hasB1T1LoadItem || hasB1T1ExclusivePayment;

  const customerExclusiveValue = String(
    customerCards?.[0]?.customer_exclusive_id || "",
  );

  const setCustomerExclusiveValue = (value) => {
    setCustomerCards((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      if (next.length === 0) next.push(createEmptyCustomerCard());
      next[0] = { ...createEmptyCustomerCard(), ...next[0], customer_exclusive_id: value };
      return next;
    });
  };

  const handleSavePayment = async () => {
    if (!canSave || !transaction?.transaction_id) return;

    setIsSubmitting(true);
    setErrorMessage("");

    if (shouldShowCustomerExclusive && customerExclusiveValue.trim() === "") {
      setErrorMessage(
        "Customer Exclusive ID is required for B1T1 LOAD, B1T1Balance, or B1T1Diamonds payment.",
      );
      setShowConfirmSaveModal(false);
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        transaction_id: transaction.transaction_id,
        category_code: terminalConfig.categoryCode,
        unit_code: terminalConfig.unitCode,
        terminal_number: terminalConfig.terminalNumber,
        user_id: getActiveUserId(),
        user_name: getActiveUserName(),
        cashier: getActiveUserName(),

        discount_type: computed.discountTypeSummary || "No Discount",
        customer_exclusive_id: customerCards?.[0]?.customer_exclusive_id || "",
        customer_head_count: computed.safeCustomerCount,
        customer_count_for_discount: computed.totalQualifiedAll,

        customer_info: customerCards
          .slice(0, computed.totalQualifiedAll)
          .map((card) => ({
            customer_exclusive_id: card.customer_exclusive_id || "",
            customer_name: card.customer_name || "",
            date_of_birth: card.date_of_birth || "",
            gender: card.gender || "",
            tin: card.tin || "",
            contact_no: card.contact_no || "",
          })),

        discount_breakdown: computed.discountBreakdown
          .filter(
            (entry) =>
              entry.key !== "loyalty" &&
              (Number(entry.qualifiedCount || 0) > 0 ||
                Number(entry.discountAmount || 0) > 0),
          )
          .map((entry) => ({
            discount_type: entry.label,
            qualified_count: Number(entry.qualifiedCount || 0),
            discount_amount: Number(entry.discountAmount || 0),
            vat_exemption: Number(entry.vatExemption || 0),
            prorated_base: Number(entry.proratedBase || 0),
          })),

        loyalty_member_id: loyaltyMember ? Number(loyaltyMember.id) : 0,
        loyalty_points_redeemed: loyaltyMember
          ? Math.min(
              Number(loyaltyPointsToApply || 0),
              Number(loyaltyMember.loyalty_points || 0),
            )
          : 0,
        loyalty_discount_amount: Number(computed.loyaltyDiscountAmount || 0),

        TotalSales: Number(computed.grossTotal || 0),
        Discount: Number(computed.totalDiscount || 0),
        OtherCharges: Number(computed.totalOtherCharges || 0),
        TotalAmountDue: Number(computed.totalAmountDue || 0),

        VATableSales: Number(computed.vatableSales || 0),
        VATableSales_VAT: Number(computed.vatableSalesVat || 0),
        VATExemptSales: Number(computed.vatExemptSales || 0),
        VATExemptSales_VAT: Number(computed.vatExemptSalesVat || 0),
        VATZeroRatedSales: Number(computed.vatZeroRatedSales || 0),

        payment_amount: Number(computed.totalPaid || 0),
        payment_method: groupedPaymentMethodText || "Cash",
        change_amount: Number(computed.changeAmount || 0),
        short_over: Number(computed.shortOver || 0),

        payments: payments
          .filter((row) => row.payment_method && toNum(row.payment_amount) > 0)
          .map((row) => ({
            payment_method: row.payment_method,
            payment_amount: Number(toNum(row.payment_amount)),
            payment_reference: row.payment_reference || "",
          })),

        other_charges: [
          ...validManualOtherCharges,
          // Include automatic service charge if enabled
          ...autoBillingCharges,
        ],
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
          discount_type: computed.discountTypeSummary || "No Discount",
          payment_method: groupedPaymentMethodText,
          payment_amount: computed.totalPaid,
          change_amount: computed.changeAmount,
          cashier: getActiveUserName(),
          remarks: "Paid",
        },
        items: [...items],
        computed: { ...computed },
        payments: [...payments],
        otherCharges: [
          ...validManualOtherCharges,
          ...autoBillingCharges,
        ],
        customerCards: customerCards.slice(0, computed.totalQualifiedAll),
        isDuplicateCopy: false,
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

  const handlePrintDuplicate = async () => {
    const snapshot = {
      transaction: {
        ...transaction,
        cashier: getActiveUserName(),
      },
      items: [...items],
      computed: { ...computed },
      payments: [...payments],
      otherCharges: [
        ...validManualOtherCharges,
        ...autoBillingCharges,
      ],
      customerCards: customerCards.slice(0, computed.totalQualifiedAll),
      isDuplicateCopy: true,
    };

    setReceiptSnapshot(snapshot);
    await handleElectronPrint(snapshot);
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
                  {isPaidMode ? "Paid Transaction Review" : "Payment Review"}
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
                    {transaction?.remarks || (isPaidMode ? "Paid" : "Pending")}
                  </InfoPill>
                  {isPaidMode ? (
                    <InfoPill isDark={isDark}>
                      Invoice #: {transaction?.invoice_no || "-"}
                    </InfoPill>
                  ) : null}
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
                    {isPaidMode
                      ? "Review and print duplicate invoice copy."
                      : "Open only the section you need."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <ActionTile
                    isDark={isDark}
                    icon={<FaMoneyBill size={16} />}
                    title="Other Charges"
                    subtitle="Add fees"
                    onClick={() => setShowOtherChargesModal(true)}
                    active={validManualOtherCharges.length > 0}
                    disabled={false}
                  />
                  <ActionTile
                    isDark={isDark}
                    icon={<FiTag size={16} />}
                    title="Discount"
                    subtitle="Senior / PWD / Manual"
                    onClick={() => setShowDiscountModal(true)}
                    active={computed.discountBreakdown.some(
                      (x) =>
                        x.key !== "loyalty" &&
                        (Number(x.qualifiedCount || 0) > 0 ||
                          Number(x.discountAmount || 0) > 0),
                    )}
                  />
                  <ActionTile
                    isDark={isDark}
                    icon={<FiUsers size={16} />}
                    title="Customer Info"
                    subtitle="Optional details"
                    onClick={() => setShowCustomerInfoModal(true)}
                    active={computed.totalQualifiedAll > 0}
                  />
                  <ActionTile
                    isDark={isDark}
                    icon={<FiCreditCard size={16} />}
                    title="Payments"
                    subtitle="Input payment"
                    onClick={() =>
                      isPaidMode
                        ? setShowInputPaymentsModal(true)
                        : setShowPaymentMethodsModal(true)
                    }
                    active={payments.length > 0}
                  />
                  <ActionTile
                    isDark={isDark}
                    icon={<FiAward size={16} />}
                    title="Loyal Customers"
                    subtitle="Apply points or rewards"
                    onClick={() => setShowLoyaltyModal(true)}
                    active={Boolean(loyaltyMember)}
                  />
                  {shouldShowCustomerExclusive && (
                    <ActionTile
                      isDark={isDark}
                      icon={<FiFileText size={16} />}
                      title="Customer Exclusive"
                      subtitle="Input B1T1 ID"
                      onClick={() => setShowCustomerExclusiveModal(true)}
                      active={customerExclusiveValue.trim() !== ""}
                    />
                  )}
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
                  value={negativePeso(computed.totalDiscount)}
                  isDark={isDark}
                  valueClassName="text-red-500"
                />
                {computed.isDiscountCeilingApplied ? (
                  <SummaryRow
                    label="Original Discount"
                    value={negativePeso(computed.rawTotalDiscount)}
                    isDark={isDark}
                    valueClassName="text-amber-500 line-through"
                  />
                ) : null}
                <SummaryRow
                  label="VAT Exemption"
                  value={negativePeso(computed.totalVatExemption)}
                    isDark={isDark}
                    valueClassName="text-red-500"
                  />
                  {Array.isArray(computed.autoBillingCharges) &&
                    computed.autoBillingCharges.map((c, i) => (
                      <SummaryRow
                        key={i}
                        label={c.particulars}
                        value={peso(c.amount)}
                        isDark={isDark}
                      />
                    ))}
                  {computed.manualOtherChargesAmount > 0 && (
                    <SummaryRow
                      label="Other Charges"
                      value={peso(computed.manualOtherChargesAmount)}
                      isDark={isDark}
                    />
                  )}
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
                <div className="mb-1">
                  <h3 className="text-xs font-black">Current Setup</h3>
                </div>

                <div className="space-y-1">
                  <SummaryRow
                    label="Discount Type"
                    value={computed.discountTypeSummary || "No Discount"}
                    isDark={isDark}
                  />
                  <SummaryRow
                    label="Qualified Customers"
                    value={`${computed.totalQualifiedAll}/${computed.safeCustomerCount}`}
                    isDark={isDark}
                  />
                  <SummaryRow
                    label="Payment Method"
                    value={
                      groupedPaymentMethodText ||
                      transaction?.payment_method ||
                      "No payment yet"
                    }
                    isDark={isDark}
                  />
                  {loyaltyMember ? (
                    <>
                      <SummaryRow
                        label="Loyalty Member"
                        value={loyaltyMember.customer_name}
                        isDark={isDark}
                      />
                      {Number(loyaltyPointsToApply || 0) > 0 ? (
                        <SummaryRow
                          label="Points Redeemed"
                          value={`-${Number(loyaltyPointsToApply || 0).toFixed(0)} pts`}
                          isDark={isDark}
                          valueClassName="text-red-500"
                        />
                      ) : null}
                      <SummaryRow
                        label="Points to Earn"
                        value={`+${Number(computed.loyaltyPointsToEarn || 0).toFixed(2)} pts`}
                        isDark={isDark}
                        valueClassName="text-emerald-500"
                      />
                      {loyaltyStoredPointsEarned === null ? (
                        <SummaryRow
                          label="New Balance"
                          value={`${Number(computed.loyaltyNewBalance || 0).toFixed(2)} pts`}
                          isDark={isDark}
                        />
                      ) : null}
                    </>
                  ) : null}
                </div>
              </SectionCard>

              <SectionCard isDark={isDark}>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Printer
                </label>
                <select
                  value={printerName}
                  onChange={(e) => setPrinterName(e.target.value)}
                  className={`w-full rounded-2xl px-3 py-3 text-sm outline-none ${
                    isDark
                      ? "border border-slate-700 bg-slate-950 text-white"
                      : "border border-slate-300 bg-white text-slate-900"
                  }`}
                >
                  <option value="">Default Printer</option>
                  {printers.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.displayName || printer.name}
                    </option>
                  ))}
                </select>
              </SectionCard>

              {errorMessage ? (
                <div className="px-4 py-3 text-sm font-semibold text-red-500 rounded-2xl bg-red-500/10">
                  {errorMessage}
                </div>
              ) : null}

              {!isPaidMode && !canSave && payments.length > 0 ? (
                <div className="px-4 py-3 text-sm font-semibold text-blue-500 rounded-2xl bg-blue-500/10">
                  Total paid must be at least equal to total amount due.
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <ButtonComponent
                  onClick={onClose}
                  isLoading={isSubmitting}
                  loadingText="Close"
                  variant="danger"
                >
                  Close
                </ButtonComponent>

                {isPaidMode ? (
                  <ButtonComponent
                    onClick={handlePrintDuplicate}
                    loadingText="Duplicating..."
                    variant="secondary"
                  >
                    Print Duplicate Invoice
                  </ButtonComponent>
                ) : (
                  <ButtonComponent
                    onClick={() => setShowConfirmSaveModal(true)}
                    isLoading={isSubmitting}
                    disabled={!canSave || isSubmitting}
                    loadingText="Saving..."
                    variant="primary"
                  >
                    Save Payment
                  </ButtonComponent>
                )}
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
        readOnly={isPaidMode}
      />

      <CustomerInfoModal
        isOpen={showCustomerInfoModal}
        onClose={() => setShowCustomerInfoModal(false)}
        isDark={isDark}
        customerCount={customerCount}
        setCustomerCount={setCustomerCount}
        totalQualified={computed.totalQualifiedAll}
        customerCards={customerCards}
        setCustomerCards={setCustomerCards}
        readOnly={false}
      />

      <PaymentMethodPickerModal
        isOpen={showPaymentMethodsModal}
        onClose={() => setShowPaymentMethodsModal(false)}
        isDark={isDark}
        methods={modeOfPayments.filter((m) => Number(m.MOP_On_Off ?? 1) !== 0)}
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
        readOnly={isPaidMode}
        modeOfPayments={modeOfPayments}
        onShowQR={onShowQR ? (method) => {
          if (qrActive) {
            setQrActive(false);
            onShowQR(null, null, null);
          } else {
            setQrActive(true);
            const secondScreenItems = items.map((item) => ({
              name: item.item_name || item.product_id || "",
              quantity: Number(item.sales_quantity || 0),
              price: Number(item.selling_price || 0),
            }));
            onShowQR(method || null, secondScreenItems, secondScreenPaymentSummary);
          }
        } : null}
        qrActive={qrActive}
      />

      <DiscountSetupModal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        isDark={isDark}
        customerCount={customerCount}
        setCustomerCount={setCustomerCount}
        discountState={discountState}
        setDiscountState={setDiscountState}
        computed={computed}
        discountCeilingAmount={discountCeilingAmount}
        readOnly={isPaidMode}
        discountMode={discountMode}
        discountSharingMode={discountSharingMode}
        setDiscountSharingMode={setDiscountSharingMode}
        selectedProductIds={selectedProductIds}
        setSelectedProductIds={setSelectedProductIds}
        items={items}
        availableDiscountTypes={availableDiscountTypes}
        addedStatutoryKeys={addedStatutoryKeys}
        customDiscountLines={customDiscountLines}
        showAddDiscountMenu={showAddDiscountMenu}
        onToggleAddDiscountMenu={() => setShowAddDiscountMenu((prev) => !prev)}
        onAddStatutoryDiscount={addStatutoryDiscount}
        onRemoveStatutoryDiscount={removeStatutoryDiscount}
        onAddCustomDiscountLine={addCustomDiscountLine}
        onRemoveCustomDiscountLine={removeCustomDiscountLine}
        onUpdateCustomLine={updateCustomLine}
      />

      <CustomerExclusiveModal
        isOpen={showCustomerExclusiveModal}
        onClose={() => setShowCustomerExclusiveModal(false)}
        isDark={isDark}
        value={customerExclusiveValue}
        onChange={setCustomerExclusiveValue}
        readOnly={isPaidMode}
      />

      <LoyaltyRedeemModal
        isOpen={showLoyaltyModal}
        onClose={() => setShowLoyaltyModal(false)}
        isDark={isDark}
        apiHost={apiHost}
        loyaltyConfig={loyaltyConfig}
        loyaltyMember={loyaltyMember}
        setLoyaltyMember={setLoyaltyMember}
        loyaltyPointsToApply={loyaltyPointsToApply}
        setLoyaltyPointsToApply={setLoyaltyPointsToApply}
        loyaltyDiscountAmount={computed.loyaltyDiscountAmount}
        loyaltyPointsToEarn={computed.loyaltyPointsToEarn}
        readOnly={isPaidMode}
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
        onPrint={handleSuccessModalPrint}
        isPrinting={isPrinting}
        isDark={isDark}
        title="Payment Successful"
        message="The payment has been saved successfully. You can print the receipt now."
        printText="Print Invoice"
      />
    </>
  );
}
