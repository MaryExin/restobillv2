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
} from "react-icons/fi";
import { FaMoneyBill } from "react-icons/fa";
import ButtonComponent from "./Common/ButtonComponent";
import BuildPosPaymentReceiptHtml from "../../utils/BuildPosPaymentReceiptHtml";
import useGetDefaultPrinter from "../../hooks/useGetDefaultPrinter";

const loggedUserId = localStorage.getItem("user_id") || "";
const loggedUserName =
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
  manual: { qualifiedCount: 0, manualAmount: "" },
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

        <div className="mt-6 grid grid-cols-2 gap-3">
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

        <div className="mt-6 grid grid-cols-2 gap-3">
          <ButtonComponent
            type="button"
            onClick={onClose}
            variant={isDark ? "dark" : "secondary"}
            className="px-6 py-3 text-sm mb-0"
            disabled={isPrinting}
          >
            Continue
          </ButtonComponent>

          <ButtonComponent
            type="button"
            onClick={onPrint}
            variant="primary"
            icon={<FiPrinter size={15} />}
            className="px-6 py-3 text-sm mb-0"
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
                    className="h-12 w-12 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <span className="text-center text-sm font-semibold leading-tight">
                    {method.mop}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <button
            onClick={onClose}
            className="rounded-2xl bg-blue-600 px-10 py-3 text-sm font-black text-white transition hover:bg-blue-500"
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

      <div className="space-y-4 p-5 md:p-6">
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
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white transition hover:bg-blue-500 disabled:opacity-50"
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
            className="rounded-2xl bg-blue-600 px-10 py-3 text-sm font-black text-white transition hover:bg-blue-500"
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
        <div className="mb-5 flex items-start justify-between gap-4">
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

            <div className="hidden items-center justify-center md:flex">
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
                  <div className="mb-3 flex items-center justify-between gap-3">
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
                        className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white transition hover:bg-blue-500"
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

        <div className="mt-5 flex justify-center">
          <button
            onClick={onClose}
            className="rounded-2xl bg-blue-600 px-10 py-3 text-sm font-black text-white transition hover:bg-blue-500"
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
  readOnly = false,
}) => {
  const inputClass = isDark
    ? "bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500"
    : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400";

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
      key: "manual",
      label: "Manual Discount",
      description: "Direct amount, no VAT exemption",
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
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard isDark={isDark}>
            <div className="mb-3 flex items-center gap-2">
              <FiFileText size={14} className="text-slate-500" />
              <h3 className="text-sm font-black">Customer Count</h3>
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                Total Customers
              </label>
              <input
                type="number"
                min="1"
                value={customerCount}
                disabled={readOnly}
                onChange={(e) => setCustomerCount(e.target.value)}
                onFocus={handleSelectAllOnFocus}
                className={`w-full rounded-2xl px-3 py-3 text-sm outline-none ${inputClass}`}
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              {cards.map((card) => (
                <div
                  key={card.key}
                  className={`rounded-[20px] border p-4 ${
                    isDark
                      ? "border-white/5 bg-slate-950"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="mb-3">
                    <div className="text-sm font-black">{card.label}</div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {card.description}
                    </div>
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
                      <div>
                        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Manual Amount
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={discountState[card.key].manualAmount}
                          disabled={readOnly}
                          onChange={(e) =>
                            handleManualAmountChange(card.key, e.target.value)
                          }
                          onFocus={handleSelectAllOnFocus}
                          className={`w-full rounded-2xl px-3 py-3 text-sm outline-none ${inputClass}`}
                        />
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
            </div>
          </SectionCard>

          <SectionCard isDark={isDark}>
            <div className="mb-3 flex items-center gap-2">
              <FiTag size={14} className="text-slate-500" />
              <h3 className="text-sm font-black">Computation Summary</h3>
            </div>

            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                <span className="text-slate-500">Discountable Gross</span>
                <span className="font-semibold">
                  {peso(computed.discountableGross)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                <span className="text-slate-500">Discountable Base</span>
                <span className="font-semibold">
                  {peso(computed.discountableBase)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
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
                    className="rounded-2xl bg-emerald-500/10 px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-bold">
                        {entry.label}
                      </span>
                      <span className="text-[13px] font-black text-red-500">
                        {negativePeso(entry.discountAmount)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span>Count: {entry.qualifiedCount}</span>
                      <span>VAT Exempt: {peso(entry.vatExemption)}</span>
                    </div>
                  </div>
                ))}

              <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                <span className="text-slate-500">Total Discount</span>
                <span className="font-semibold text-red-500">
                  {negativePeso(computed.totalDiscount)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                <span className="text-slate-500">Total VAT Exemption</span>
                <span className="font-semibold text-red-500">
                  {negativePeso(computed.totalVatExemption)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-2xl bg-blue-500/10 px-3 py-3">
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
            className="rounded-2xl bg-blue-600 px-10 py-3 text-sm font-black text-white transition hover:bg-blue-500"
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
  readOnly = false,
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
              <div className="space-y-4 px-5 py-2 md:px-6">
                <div className="grid gap-3 md:grid-cols-2 md:items-center">
                  <div className="text-xl font-black text-slate-700 dark:text-slate-200">
                    TOTAL AMOUNT DUE
                  </div>
                  <div className="text-right text-2xl font-black text-emerald-500">
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
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-500">Payments</p>

                    {!readOnly ? (
                      <button
                        type="button"
                        onClick={handleAddPaymentMethod}
                        className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-xs font-bold text-white transition hover:bg-blue-500"
                      >
                        <FiPlus size={14} />
                        Add Payment Method
                      </button>
                    ) : null}
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
                              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white transition hover:bg-blue-500 disabled:opacity-50"
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
                                className="h-10 w-10 object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black">
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
                                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                                    Reference
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
                                    placeholder="Reference"
                                    className={`h-12 w-full rounded-2xl px-4 text-sm outline-none ${inputClass}`}
                                  />
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
                    <div className="my-4 grid gap-3 md:grid-cols-2">
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

                    <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
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

                      <button
                        type="button"
                        disabled={readOnly || payments.length === 0}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setExactAmountForActiveRow();
                        }}
                        className="col-span-2 rounded-2xl bg-emerald-500 px-8 py-5 text-lg font-black tracking-wide text-emerald-100 shadow-lg transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Exact
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center pb-5">
                  <button
                    onClick={onClose}
                    className="rounded-2xl bg-blue-600 px-10 py-3 text-sm font-black text-white transition hover:bg-blue-500"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
}) {
  const defaultPrinterName = useGetDefaultPrinter();

  const [isPrinting, setIsPrinting] = useState(false);

  const isPaidMode = mode === "paid";

  const [items, setItems] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [customerCount, setCustomerCount] = useState(1);
  const [discountState, setDiscountState] = useState(
    buildInitialDiscountState(),
  );
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

  const [receiptSnapshot, setReceiptSnapshot] = useState(null);
  const [printerName, setPrinterName] = useState("");
  const [printers, setPrinters] = useState([]);
  const [shiftDetails, setShiftDetails] = useState(null);
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
    if (!isOpen || !apiHost || !loggedUserId) return;

    let cancelled = false;

    const fetchShiftDetails = async () => {
      try {
        const response = await fetch(
          `${apiHost}/api/get_shift_details.php?user_id=${encodeURIComponent(
            loggedUserId,
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

  const terminalConfig = useMemo(() => {
    const terminal = shiftDetails?.terminal || {};

    return {
      categoryCode:
        shiftDetails?.Category_Code ||
        transaction?.Category_Code ||
        "",
      unitCode:
        shiftDetails?.Unit_Code ||
        transaction?.Unit_Code ||
        "",
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

      const html = BuildPosPaymentReceiptHtml({
        transaction: snapshot.transaction || transaction,
        items: snapshot.items || items,
        computed: snapshot.computed || computed,
        payments: snapshot.payments || payments,
        otherCharges: snapshot.otherCharges || otherCharges,
        customerCards: snapshot.customerCards || customerCards,
        isDuplicateCopy: snapshot.isDuplicateCopy || false,
        terminalConfig,
      });

      const result = await window.electronAPI.printReceipt({
        html,
        printerName: printerName || defaultPrinterName || "",
        silent: true,
        copies: 1,
      });

      console.log("Payment print result:", result);

      if (!result?.success) {
        throw new Error(result?.message || "Failed to print receipt.");
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || "Failed to print receipt.");
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
          manual: 0,
        };

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
        const rawManual = Number(discountCounts.manual || 0);

        const totalQualifiedFromBreakdown = rawSenior + rawPwd + rawManual;

        let clampedSenior = rawSenior;
        let clampedPwd = rawPwd;
        let clampedManual = rawManual;

        if (totalQualifiedFromBreakdown > safeHeadCount) {
          let overflow = totalQualifiedFromBreakdown - safeHeadCount;

          const manualReduce = Math.min(clampedManual, overflow);
          clampedManual -= manualReduce;
          overflow -= manualReduce;

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
              rawManual,
              clampedSenior,
              clampedPwd,
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
          manual: {
            qualifiedCount: clampedManual,
            manualAmount: discountRows
              .filter((row) =>
                String(row.discount_type || "")
                  .toLowerCase()
                  .includes("manual"),
              )
              .reduce((sum, row) => sum + Number(row.discount_amount || 0), 0),
          },
        });

        setCustomerCards(
          discountRows.length > 0
            ? discountRows
                .slice(0, clampedSenior + clampedPwd + clampedManual)
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
    return (
      Number(discountState?.senior?.qualifiedCount || 0) +
      Number(discountState?.pwd?.qualifiedCount || 0) +
      Number(discountState?.manual?.qualifiedCount || 0)
    );
  }, [discountState]);

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
    const rawManualCount = Math.max(
      Math.floor(Number(discountState?.manual?.qualifiedCount || 0)),
      0,
    );
    const manualAmount = Math.max(
      Number(discountState?.manual?.manualAmount || 0),
      0,
    );

    const totalQualifiedAllLocal =
      rawSeniorCount + rawPwdCount + rawManualCount;
    const statutoryQualifiedCount = rawSeniorCount + rawPwdCount;

    const statutoryQualifiedRatio =
      safeCustomerCount > 0
        ? Math.min(statutoryQualifiedCount, safeCustomerCount) /
          safeCustomerCount
        : 0;

    const notQualifiedRatio =
      safeCustomerCount > 0 ? 1 - statutoryQualifiedRatio : 0;

    let discountableGross = 0;
    let discountableBase = 0;
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

      grossTotal += lineTotal;
      totalQuantity += qty;

      if (isDiscountable) {
        discountableGross += lineTotal;
        discountableBase += isVatable ? lineTotal / 1.12 : lineTotal;

        if (isVatable) {
          vatExemptSales += lineTotal * statutoryQualifiedRatio;
          rawVatableGross += lineTotal * notQualifiedRatio;
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

    const seniorProratedBase =
      safeCustomerCount > 0
        ? discountableBase * (rawSeniorCount / safeCustomerCount)
        : 0;

    const pwdProratedBase =
      safeCustomerCount > 0
        ? discountableBase * (rawPwdCount / safeCustomerCount)
        : 0;

    const seniorDiscountAmount = seniorProratedBase * 0.2;
    const seniorVatExemption = seniorProratedBase * 0.12;

    const pwdDiscountAmount = pwdProratedBase * 0.2;
    const pwdVatExemption = pwdProratedBase * 0.12;

    const manualDiscountAmount = manualAmount;
    const manualVatExemption = 0;

    const discountBreakdown = [
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
        key: "manual",
        label: "Manual Discount",
        qualifiedCount: rawManualCount,
        proratedBase: 0,
        discountAmount: manualDiscountAmount,
        vatExemption: manualVatExemption,
      },
    ];

    const totalDiscount = discountBreakdown.reduce(
      (sum, entry) => sum + Number(entry.discountAmount || 0),
      0,
    );

    const totalVatExemption = discountBreakdown.reduce(
      (sum, entry) => sum + Number(entry.vatExemption || 0),
      0,
    );

    const finalVatExemptSales = Math.max(vatExemptSales - totalVatExemption, 0);

    const otherChargesTotal = otherCharges.reduce(
      (sum, row) => sum + toNum(row.amount),
      0,
    );

    const totalAmountDue = Math.max(
      grossTotal - totalDiscount - totalVatExemption + otherChargesTotal,
      0,
    );

    const totalPaid = payments.reduce(
      (sum, row) => sum + toNum(row.payment_amount),
      0,
    );

    const changeAmount = Math.max(totalPaid - totalAmountDue, 0);
    const shortOver = totalPaid - totalAmountDue;

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
      discountableItemsCount: items.filter((item) =>
        yesNoToBool(item.isDiscountable),
      ).length,
      safeCustomerCount,
      totalQualifiedAll: totalQualifiedAllLocal,
      statutoryQualifiedCount,
      discountBreakdown,
      totalDiscount,
      totalVatExemption,
      totalAmountDue,
      otherChargesTotal,
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
  }, [items, customerCount, discountState, otherCharges, payments]);

  const groupedPaymentMethodText = useMemo(() => {
    const uniqueMethods = [
      ...new Set(payments.map((p) => p.payment_method).filter(Boolean)),
    ];
    return uniqueMethods.join(", ");
  }, [payments]);

  const canSave = useMemo(() => {
    if (isPaidMode) return false;
    if (items.length === 0) return false;
    if (payments.length === 0) return false;

    const validPayments = payments.every(
      (row) => row.payment_method && toNum(row.payment_amount) > 0,
    );
    if (!validPayments) return false;

    if (computed.totalPaid < computed.totalAmountDue) return false;

    return true;
  }, [
    items,
    payments,
    computed.totalPaid,
    computed.totalAmountDue,
    isPaidMode,
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
        user_id: loggedUserId,
        user_name: loggedUserName,
        cashier: loggedUserName,

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
              Number(entry.qualifiedCount || 0) > 0 ||
              Number(entry.discountAmount || 0) > 0,
          )
          .map((entry) => ({
            discount_type: entry.label,
            qualified_count: Number(entry.qualifiedCount || 0),
            discount_amount: Number(entry.discountAmount || 0),
            vat_exemption: Number(entry.vatExemption || 0),
            prorated_base: Number(entry.proratedBase || 0),
          })),

        TotalSales: Number(computed.grossTotal || 0),
        Discount: Number(computed.totalDiscount || 0),
        OtherCharges: Number(computed.otherChargesTotal || 0),
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

        other_charges: otherCharges
          .filter((row) => row.particulars && toNum(row.amount) > 0)
          .map((row) => ({
            particulars: row.particulars,
            amount: Number(toNum(row.amount)),
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
          discount_type: computed.discountTypeSummary || "No Discount",
          payment_method: groupedPaymentMethodText,
          payment_amount: computed.totalPaid,
          change_amount: computed.changeAmount,
          cashier: loggedUserName,
          remarks: "Paid",
        },
        items: [...items],
        computed: { ...computed },
        payments: [...payments],
        otherCharges: [...otherCharges],
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
        cashier: loggedUserName,
      },
      items: [...items],
      computed: { ...computed },
      payments: [...payments],
      otherCharges: [...otherCharges],
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

                <div className="mt-2 flex flex-wrap gap-2">
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

        <div className="min-h-0 overflow-y-auto p-4">
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

                <div className="grid grid-cols-2 gap-3">
                  <ActionTile
                    isDark={isDark}
                    icon={<FaMoneyBill size={16} />}
                    title="Other Charges"
                    subtitle="Add fees"
                    onClick={() => setShowOtherChargesModal(true)}
                    active={otherCharges.length > 0}
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
                        Number(x.qualifiedCount || 0) > 0 ||
                        Number(x.discountAmount || 0) > 0,
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
                </div>
              </SectionCard>

              <SectionCard isDark={isDark}>
                <div className="mb-3 flex items-center justify-between gap-3">
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
                            <p className="truncate text-sm font-bold">
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
                  <SummaryRow
                    label="VAT Exemption"
                    value={negativePeso(computed.totalVatExemption)}
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
                <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500">
                  {errorMessage}
                </div>
              ) : null}

              {!isPaidMode && !canSave && payments.length > 0 ? (
                <div className="rounded-2xl bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-500">
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
        readOnly={isPaidMode}
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
