import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReactToPrint } from "react-to-print";
import {
  FiX,
  FiSearch,
  FiEye,
  FiTag,
  FiUsers,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiPlus,
  FiTrash2,
  FiRefreshCw,
  FiShoppingCart,
  FiPrinter,
} from "react-icons/fi";
import { useTheme } from "../../context/ThemeContext";
import useApiHost from "../../hooks/useApiHost";
import PosPaymentReceipt from "./PosPaymentReceipt";
import { FaMoneyBill } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const peso = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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
        className={`fixed inset-0 ${zIndex} flex items-center justify-center p-2 md:p-4 backdrop-blur-md ${
          isDark ? "bg-slate-950/80" : "bg-slate-200/70"
        }`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ scale: 0.985, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.985, opacity: 0, y: 10 }}
          transition={{ duration: 0.16 }}
          className={`relative flex w-full ${maxWidth} max-h-[calc(100vh-1rem)] md:max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[1rem] shadow-2xl ${
            isDark
              ? "bg-slate-900 border border-white/10 text-white"
              : "bg-white border border-slate-200 text-slate-900"
          }`}
        >
          {onClose && (
            <button
              onClick={onClose}
              className={`absolute right-3 top-3 z-20 rounded-full p-1.5 transition-all ${
                isDark
                  ? "bg-slate-800 text-slate-400 hover:bg-red-500/20 hover:text-red-400"
                  : "bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-500"
              }`}
            >
              <FiX size={14} />
            </button>
          )}
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const SectionCard = ({ isDark, children, className = "" }) => (
  <div
    className={`rounded-[1rem] p-3 ${className} ${
      isDark
        ? "bg-slate-950/40 border border-white/5"
        : "bg-slate-50 border border-slate-200"
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
      className={`rounded-[0.95rem] border p-3 text-left transition-all ${
        active
          ? "border-blue-600 bg-blue-600 text-white"
          : isDark
            ? "border-white/5 bg-slate-900/70 text-slate-200 hover:bg-slate-900"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            active
              ? "bg-white/15 text-white"
              : isDark
                ? "bg-slate-800 text-blue-500"
                : "bg-slate-100 text-blue-500"
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black leading-tight">{title}</p>
          <p
            className={`mt-0.5 text-[10px] ${active ? "text-blue-100" : "text-slate-500"}`}
          >
            {subtitle}
          </p>
        </div>
      </div>
    </button>
  );
};

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
      maxWidth="max-w-[520px]"
      zIndex="z-[100003]"
    >
      <div className="p-5 md:p-6">
        <div className="mb-3">
          <h2 className="text-xl font-black">{title}</h2>
          <p className="mt-2 text-sm text-slate-500">{message}</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`rounded-full px-4 py-3 text-sm font-black transition-all ${
              busy
                ? "cursor-not-allowed bg-slate-300 text-slate-500"
                : isDark
                  ? "bg-slate-800 text-slate-200 hover:text-white"
                  : "bg-slate-200 text-slate-700 hover:text-slate-900"
            }`}
          >
            {noText}
          </button>

          <button
            type="button"
            onClick={onYes}
            disabled={busy}
            className={`rounded-full px-4 py-3 text-sm font-black text-white shadow-lg transition-all ${
              busy
                ? "cursor-not-allowed bg-slate-400"
                : "bg-blue-600 hover:opacity-95"
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
      <div className="p-5 md:p-6">
        <div className="mb-3">
          <h2 className="text-xl font-black text-emerald-500">{title}</h2>
          <p className="mt-2 text-sm text-slate-500">{message}</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-full px-6 py-3 text-sm font-black transition-all ${
              isDark
                ? "bg-slate-800 text-slate-200 hover:text-white"
                : "bg-slate-200 text-slate-700 hover:text-slate-900"
            }`}
          >
            Continue
          </button>

          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg transition-all hover:opacity-95"
          >
            <FiPrinter size={14} />
            Print Receipt
          </button>
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
        className={`px-4 py-4 ${
          isDark
            ? "border-b border-white/5 bg-blue-500/90"
            : "border-b border-slate-200 bg-blue-500"
        }`}
      >
        <h2 className="text-center text-xl font-black text-white">
          Choose Payment Method
        </h2>
      </div>

      <div className="p-4 md:p-6">
        {methods.length === 0 ? (
          <div
            className={`flex min-h-[220px] items-center justify-center rounded-xl border border-dashed ${
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
                className={`rounded-[1rem] border p-3 shadow-sm transition-all ${
                  isDark
                    ? "border-white/5 bg-slate-900/60 hover:bg-slate-900"
                    : "border-slate-200 bg-white hover:bg-slate-50"
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
            className="rounded-full bg-blue-600 px-10 py-3 text-sm font-black text-white shadow-lg transition-all hover:opacity-95"
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
    ? "bg-slate-900/70 border border-slate-800 text-white placeholder:text-slate-500"
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
      maxWidth="max-w-[860px]"
      zIndex="z-[100002]"
    >
      <div
        className={`px-4 py-4 ${
          isDark
            ? "border-b border-white/5 bg-blue-500/90"
            : "border-b border-slate-200 bg-blue-500"
        }`}
      >
        <h2 className="text-center text-xl font-black text-white">
          Other Charges
        </h2>
      </div>

      <div className="space-y-4 p-4 md:p-6">
        {rows.map((row, index) => (
          <div
            key={index}
            className={`grid gap-3 rounded-[1rem] p-3 ${
              isDark
                ? "bg-slate-950/40 border border-white/5"
                : "bg-slate-50 border border-slate-200"
            } md:grid-cols-[60px_minmax(0,1.2fr)_180px_minmax(0,1fr)]`}
          >
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white transition-all hover:bg-blue-500"
            >
              <FiTrash2 size={16} />
            </button>

            <select
              value={row.particulars}
              onChange={(e) => updateRow(index, "particulars", e.target.value)}
              className={`h-11 rounded-xl px-3 text-sm outline-none ${inputClass}`}
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
              className={`h-11 rounded-xl px-3 text-sm outline-none ${inputClass}`}
            />

            <input
              type="text"
              value={row.reference}
              onChange={(e) => updateRow(index, "reference", e.target.value)}
              placeholder="Reference"
              className={`h-11 rounded-xl px-3 text-sm outline-none ${inputClass}`}
            />
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={addRow}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
              isDark
                ? "bg-slate-800 text-slate-200 hover:text-white"
                : "bg-slate-200 text-slate-700 hover:text-slate-900"
            }`}
          >
            <FiPlus size={14} />
            Add charge
          </button>

          <button
            onClick={onClose}
            className="rounded-full bg-blue-600 px-10 py-3 text-sm font-black text-white shadow-lg transition-all hover:opacity-95"
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
    ? "bg-slate-900/70 border border-slate-800 text-white placeholder:text-slate-500"
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
      <div className="p-4 md:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${
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

          <div
            className={`hidden h-16 w-16 items-center justify-center rounded-full md:flex ${
              isDark
                ? "bg-cyan-500/15 text-cyan-400"
                : "bg-cyan-50 text-cyan-600"
            }`}
          >
            <FiUsers size={28} />
          </div>
        </div>

        <div
          className={`mb-4 rounded-[1rem] p-4 ${isDark ? "bg-slate-950/40 border border-white/5" : "bg-slate-50 border border-slate-200"}`}
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
                  className={`h-11 rounded-xl px-3 text-sm outline-none ${inputClass}`}
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
                  className={`h-11 rounded-xl px-3 text-sm outline-none ${inputClass}`}
                />
              </div>
            </div>

            <div className="hidden items-center justify-center md:flex">
              <div
                className={`flex h-24 w-24 items-center justify-center rounded-full ${
                  isDark
                    ? "bg-cyan-500/15 text-cyan-400"
                    : "bg-cyan-50 text-cyan-600"
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
              className={`rounded-[1rem] p-5 text-center text-sm italic ${
                isDark
                  ? "bg-slate-950/40 border border-white/5 text-slate-400"
                  : "bg-slate-50 border border-slate-200 text-slate-500"
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
                  className={`rounded-[1rem] p-4 ${isDark ? "bg-slate-950/40 border border-white/5" : "bg-slate-50 border border-slate-200"}`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
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
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white transition-all hover:bg-blue-500"
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
                      className={`h-11 rounded-xl px-3 text-sm outline-none ${inputClass}`}
                    />
                    <input
                      type="text"
                      value={customerInfo.customer_name}
                      onChange={(e) =>
                        updateCard(index, "customer_name", e.target.value)
                      }
                      placeholder="Name"
                      className={`h-11 rounded-xl px-3 text-sm outline-none ${inputClass}`}
                    />
                    <input
                      type="text"
                      value={customerInfo.customer_id_no}
                      onChange={(e) =>
                        updateCard(index, "customer_id_no", e.target.value)
                      }
                      placeholder="ID"
                      className={`h-11 rounded-xl px-3 text-sm outline-none ${inputClass}`}
                    />
                    <input
                      type="text"
                      value={customerInfo.tin}
                      onChange={(e) => updateCard(index, "tin", e.target.value)}
                      placeholder="TIN"
                      className={`h-11 rounded-xl px-3 text-sm outline-none ${inputClass}`}
                    />
                    <input
                      type="text"
                      value={customerInfo.other_info_01}
                      onChange={(e) =>
                        updateCard(index, "other_info_01", e.target.value)
                      }
                      placeholder="Other Info 01"
                      className={`h-11 rounded-xl px-3 text-sm outline-none ${inputClass}`}
                    />
                    <input
                      type="text"
                      value={customerInfo.other_info_02}
                      onChange={(e) =>
                        updateCard(index, "other_info_02", e.target.value)
                      }
                      placeholder="Other Info 02"
                      className={`h-11 rounded-xl px-3 text-sm outline-none ${inputClass}`}
                    />
                    <input
                      type="text"
                      value={customerInfo.other_info_03}
                      onChange={(e) =>
                        updateCard(index, "other_info_03", e.target.value)
                      }
                      placeholder="Other Info 03"
                      className={`h-11 rounded-xl px-3 text-sm outline-none ${inputClass}`}
                    />
                  </div>
                </div>
              ))
          )}
        </div>

        <div className="mt-5 flex justify-center">
          <button
            onClick={onClose}
            className="rounded-full bg-blue-600 px-10 py-3 text-sm font-black text-white shadow-lg transition-all hover:opacity-95"
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
    ? "bg-slate-900/70 border border-slate-800 text-white placeholder:text-slate-500"
    : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400";

  const isManualDiscount = discountType === "Manual Discount";

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      isDark={isDark}
      maxWidth="max-w-[820px]"
      zIndex="z-[100002]"
    >
      <div
        className={`relative px-4 py-3 ${
          isDark
            ? "border-b border-white/5 bg-white/5"
            : "border-b border-slate-200 bg-slate-50"
        }`}
      >
        <div className="pr-8">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                isDark
                  ? "bg-blue-500/15 text-blue-400"
                  : "bg-blue-50 text-blue-600"
              }`}
            >
              <FiTag size={15} />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">
                Discount Setup
              </h2>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Same logic as discount_page
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <SectionCard isDark={isDark}>
            <div className="mb-2 flex items-center gap-2">
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
                    className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all ${
                      active
                        ? "border-blue-600 bg-blue-600 text-white"
                        : isDark
                          ? "border-white/5 bg-slate-900/70 text-slate-300 hover:bg-slate-900"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-sm font-bold">{type.label}</div>
                    <div
                      className={`mt-0.5 text-[10px] ${
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
              className={`rounded-[0.9rem] p-3 mt-4 ${
                isDark
                  ? "bg-slate-900/70 border border-white/5"
                  : "bg-white border border-slate-200"
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
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
                  <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Discount Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualDiscount}
                    onChange={(e) => setManualDiscount(e.target.value)}
                    className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${inputClass}`}
                    placeholder="0.00"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                      Total Customers
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={customerCount}
                      onChange={(e) => setCustomerCount(e.target.value)}
                      className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${inputClass}`}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                      Qualified
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={customerCount || 1}
                      value={qualifiedCount}
                      onChange={(e) => setQualifiedCount(e.target.value)}
                      className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${inputClass}`}
                    />
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard isDark={isDark}>
            <div className="mb-2 flex items-center gap-2">
              <FiTag size={14} className="text-slate-500" />
              <h3 className="text-sm font-black">Computation Summary</h3>
            </div>

            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                <span className="text-slate-500">Discountable Gross</span>
                <span className="font-semibold">
                  ₱ {peso(computed.discountableGross)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                <span className="text-slate-500">Discountable Base</span>
                <span className="font-semibold">
                  ₱ {peso(computed.discountableBase)}
                </span>
              </div>

              {!isManualDiscount && discountType !== "No Discount" && (
                <>
                  <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                    <span className="text-slate-500">Ratio</span>
                    <span className="font-semibold">
                      {computed.safeQualifiedCount} /{" "}
                      {computed.safeCustomerCount}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                    <span className="text-slate-500">Prorated Base</span>
                    <span className="font-semibold">
                      ₱ {peso(computed.proratedBase)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                    <span className="text-slate-500">VAT Exemption</span>
                    <span className="font-semibold text-red-500">
                      {negativePeso(computed.vatExemption)}
                    </span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-500/10 px-3 py-2">
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
            className="rounded-full bg-blue-600 px-10 py-3 text-sm font-black text-white shadow-lg transition-all hover:opacity-95"
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
    ? "bg-slate-900/70 border border-slate-800 text-white placeholder:text-slate-500"
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
      maxWidth="max-w-[860px]"
      zIndex="z-[100001]"
    >
      <div
        className={`px-4 py-4 ${
          isDark
            ? "border-b border-white/5 bg-blue-500/90"
            : "border-b border-slate-200 bg-blue-500"
        }`}
      >
        <h2 className="text-center text-xl font-black text-white">
          Input Payments
        </h2>
      </div>

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 md:grid-cols-2 md:items-center">
          <div className="text-2xl font-black text-slate-700 dark:text-slate-200">
            TOTAL AMOUNT DUE:
          </div>
          <div className="text-right text-3xl font-black text-green-600">
            {peso(totalAmountDue)}
          </div>
        </div>

        <div
          className={`rounded-[1rem] border p-3 ${
            isDark
              ? "border-cyan-500/20 bg-slate-950/40"
              : "border-cyan-200 bg-cyan-50/30"
          }`}
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-500">Payments</p>
            <button
              type="button"
              onClick={onAddPaymentMethod}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500"
            >
              <FiPlus size={14} />
              Add Payment Method
            </button>
          </div>

          <div className="space-y-3">
            {payments.length === 0 ? (
              <div
                className={`flex min-h-[120px] items-center justify-center rounded-xl border border-dashed ${
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
                  className={`grid gap-3 rounded-[1rem] p-3 ${
                    isDark
                      ? "bg-slate-900/60 border border-white/5"
                      : "bg-white border border-slate-200"
                  } md:grid-cols-[60px_140px_minmax(0,1fr)]`}
                >
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white transition-all hover:bg-blue-500"
                  >
                    <FiTrash2 size={16} />
                  </button>

                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/5 dark:bg-slate-950/50">
                    <img
                      src={buildImagePath(row.payment_method)}
                      alt={row.payment_method}
                      className="h-10 w-10 object-contain"
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
                      className={`h-11 rounded-xl px-3 text-sm outline-none ${inputClass}`}
                    />
                    <input
                      type="text"
                      value={row.payment_reference}
                      onChange={(e) =>
                        updateRow(index, "payment_reference", e.target.value)
                      }
                      placeholder="Reference"
                      className={`h-11 rounded-xl px-3 text-sm outline-none ${inputClass}`}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <div
              className={`rounded-xl p-3 ${isDark ? "bg-slate-900/60" : "bg-white border border-slate-200"}`}
            >
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Total Paid
              </p>
              <p className="mt-1 text-lg font-black text-blue-500">
                ₱ {peso(totalPaid)}
              </p>
            </div>
            <div
              className={`rounded-xl p-3 ${isDark ? "bg-slate-900/60" : "bg-white border border-slate-200"}`}
            >
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Remaining
              </p>
              <p className="mt-1 text-lg font-black text-blue-500">
                ₱ {peso(remaining)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="rounded-full bg-blue-600 px-10 py-3 text-sm font-black text-white shadow-lg transition-all hover:opacity-95"
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

  const containerClass = isDark
    ? "bg-slate-900 border border-white/10 text-white"
    : "bg-white border border-slate-200 text-slate-900";

  if (!isOpen) return null;

  return (
    <>
      <ModalShell
        isOpen={isOpen}
        onClose={onClose}
        isDark={isDark}
        maxWidth="max-w-[1250px]"
      >
        <div
          className={`flex min-h-0 w-full flex-1 flex-col ${containerClass}`}
        >
          <div className="min-h-0 overflow-y-auto p-3 md:p-4">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <SectionCard isDark={isDark} className="min-h-[580px]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FiShoppingCart size={22} className="text-slate-500" />
                    <div>
                      <h2 className="text-2xl font-black text-slate-700 dark:text-slate-200">
                        Transaction Details
                      </h2>
                      <p className="text-xs text-slate-500">
                        Transaction ID: {transaction?.transaction_id || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-black">
                      {transaction?.transaction_id || "-"}
                    </p>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      Trans. ID
                    </p>
                  </div>
                </div>

                {isLoadingItems ? (
                  <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-300/30">
                    <p className="text-sm italic text-slate-500">
                      Loading transaction items...
                    </p>
                  </div>
                ) : errorMessage ? (
                  <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-red-300/30">
                    <p className="text-sm italic text-red-500">
                      {errorMessage}
                    </p>
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-300/30">
                    <p className="text-sm italic text-slate-500">
                      No ordered items found.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[490px] overflow-y-auto pr-1">
                    {items.map((item, index) => {
                      const qty = toNum(item.sales_quantity);
                      const price = toNum(item.selling_price);
                      const lineTotal = qty * price;
                      const isDiscountable = yesNoToBool(item.isDiscountable);

                      return (
                        <div
                          key={item.ID || index}
                          className={`grid gap-3 rounded-[0.95rem] p-3 ${
                            isDark
                              ? "bg-slate-900/60 border border-white/5"
                              : "bg-white border border-slate-200"
                          } md:grid-cols-[56px_minmax(0,1fr)_70px_90px_110px]`}
                        >
                          <div className="flex items-center justify-center">
                            <div
                              className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                                isDark
                                  ? "bg-slate-800 text-blue-400"
                                  : "bg-blue-50 text-blue-600"
                              }`}
                            >
                              <FiShoppingCart size={18} />
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="grid grid-cols-2 gap-2 text-[11px] uppercase tracking-[0.12em] text-cyan-500">
                              <span>Code:</span>
                              <span>SKU:</span>
                            </div>
                            <p className="mt-1 truncate text-base font-semibold">
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

                          <div className="flex items-center justify-center text-lg font-black">
                            {qty}
                          </div>

                          <div className="flex items-center justify-end text-sm font-semibold">
                            {peso(price)}
                          </div>

                          <div className="flex flex-col items-end justify-center">
                            <span
                              className={`text-[11px] ${isDiscountable ? "text-violet-500" : "text-slate-500"}`}
                            >
                              {isDiscountable
                                ? "Discountable"
                                : "Non-Discountable"}
                            </span>
                            <span className="text-xl font-black">
                              {peso(lineTotal)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>

              <SectionCard isDark={isDark} className="min-h-[580px]">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <ActionTile
                    isDark={isDark}
                    icon={<FaMoneyBill size={18} />}
                    title="Other Charges"
                    subtitle="Add shipping or fees"
                    onClick={() => setShowOtherChargesModal(true)}
                  />
                  <ActionTile
                    isDark={isDark}
                    icon={<FiTag size={18} />}
                    title="Discount"
                    subtitle="Senior / PWD / Manual"
                    onClick={() => setShowDiscountModal(true)}
                    active={discountType !== "No Discount"}
                  />
                  <ActionTile
                    isDark={isDark}
                    icon={<FiUsers size={18} />}
                    title="Customer Info"
                    subtitle="Counts and reference"
                    onClick={() => setShowCustomerInfoModal(true)}
                    active={
                      computed.safeQualifiedCount > 0 ||
                      customerIdsForPosting.length > 0
                    }
                  />
                  <ActionTile
                    isDark={isDark}
                    icon={<FiCreditCard size={18} />}
                    title="Payments"
                    subtitle="Choose and input"
                    onClick={() => setShowPaymentMethodsModal(true)}
                    active={payments.length > 0}
                  />
                </div>

                <div className="mt-5 space-y-3">
                  <div className="grid grid-cols-[1fr_200px] items-center gap-3">
                    <span className="text-lg font-black text-slate-700 dark:text-slate-200">
                      TOTAL SALES
                    </span>
                    <div
                      className={`rounded-xl px-4 py-3 text-right text-2xl font-black ${
                        isDark
                          ? "bg-slate-900/70 border border-white/5"
                          : "bg-white border border-slate-200"
                      }`}
                    >
                      {peso(computed.grossTotal)}
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_200px] items-center gap-3">
                    <span className="text-lg font-black text-slate-700 dark:text-slate-200">
                      Discountable Sales
                    </span>
                    <div
                      className={`rounded-xl px-4 py-3 text-right text-2xl font-black ${
                        isDark
                          ? "bg-slate-900/70 border border-white/5"
                          : "bg-white border border-slate-200"
                      }`}
                    >
                      {peso(computed.discountableGross)}
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_200px] items-center gap-3">
                    <span className="text-lg font-black text-slate-700 dark:text-slate-200">
                      Discount
                    </span>
                    <div
                      className={`rounded-xl px-4 py-3 text-right text-2xl font-black text-red-500 ${
                        isDark
                          ? "bg-slate-900/70 border border-white/5"
                          : "bg-white border border-slate-200"
                      }`}
                    >
                      {negativePeso(computed.discount)}
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_200px] items-center gap-3">
                    <span className="text-lg font-black text-slate-700 dark:text-slate-200">
                      VAT Exemption
                    </span>
                    <div
                      className={`rounded-xl px-4 py-3 text-right text-2xl font-black text-red-500 ${
                        isDark
                          ? "bg-slate-900/70 border border-white/5"
                          : "bg-white border border-slate-200"
                      }`}
                    >
                      {negativePeso(computed.vatExemption)}
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_200px] items-center gap-3">
                    <span className="text-lg font-black text-slate-700 dark:text-slate-200">
                      Other Charges
                    </span>
                    <div
                      className={`rounded-xl px-4 py-3 text-right text-2xl font-black ${
                        isDark
                          ? "bg-slate-900/70 border border-white/5"
                          : "bg-white border border-slate-200"
                      }`}
                    >
                      {peso(computed.otherChargesTotal)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-300/20 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[34px] font-black tracking-tight text-slate-700 dark:text-slate-200">
                      TOTAL AMOUNT DUE:
                    </span>
                    <span className="text-[44px] font-black text-green-600">
                      {peso(computed.totalAmountDue)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {[
                    ["Payment Amount", computed.totalPaid],
                    ["Change Amount", computed.changeAmount],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="grid grid-cols-[1fr_200px] items-center gap-3"
                    >
                      <span className="text-lg font-black text-slate-700 dark:text-slate-200">
                        {label}
                      </span>
                      <div
                        className={`rounded-xl px-4 py-3 text-right text-2xl font-black ${
                          isDark
                            ? "bg-slate-900/70 border border-white/5"
                            : "bg-white border border-slate-200"
                        }`}
                      >
                        {peso(value)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div
                    className={`rounded-xl p-3 ${isDark ? "bg-slate-900/60" : "bg-white border border-slate-200"}`}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-bold text-slate-500">
                        VATable Sales
                      </span>
                      <span className="text-right font-black">
                        {peso(computed.vatableSales)}
                      </span>
                      <span className="font-bold text-slate-500">
                        VAT-Exempt Sales
                      </span>
                      <span className="text-right font-black">
                        {peso(computed.vatExemptSales)}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`rounded-xl p-3 ${isDark ? "bg-slate-900/60" : "bg-white border border-slate-200"}`}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <span className="font-bold text-slate-500">VAT</span>
                      <span className="text-right font-black">
                        {peso(computed.vatableSalesVat)}
                      </span>
                      <span className="font-bold text-slate-500">
                        Zero Rated
                      </span>
                      <span className="text-right font-black">
                        {peso(computed.vatZeroRatedSales)}
                      </span>
                    </div>
                  </div>
                </div>

                {errorMessage ? (
                  <div className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500">
                    {errorMessage}
                  </div>
                ) : null}

                {!canSave && payments.length > 0 ? (
                  <div className="mt-4 rounded-xl bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-500">
                    {computed.safeQualifiedCount > 0 &&
                    customerIdsForPosting.length < computed.safeQualifiedCount
                      ? "Complete all customer IDs for every qualified discount customer."
                      : "Total paid must be at least equal to total amount due."}
                  </div>
                ) : null}

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    onClick={onClose}
                    className="rounded-full bg-blue-600 px-4 py-4 text-sm font-black text-white shadow-lg transition-all hover:opacity-95"
                  >
                    Close
                  </button>

                  <button
                    onClick={() => setShowConfirmSaveModal(true)}
                    disabled={!canSave || isSubmitting}
                    className={`rounded-full px-4 py-4 text-sm font-black text-white shadow-lg transition-all ${
                      !canSave || isSubmitting
                        ? "cursor-not-allowed bg-slate-400"
                        : "bg-blue-600 hover:opacity-95"
                    }`}
                  >
                    {isSubmitting ? "Saving..." : "Save Payment"}
                  </button>
                </div>
              </SectionCard>
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

const PosPayment = () => {
  const apiHost = useApiHost();
  const { isDark } = useTheme();

  const [transactions, setTransactions] = useState([]);
  const [modeOfPayments, setModeOfPayments] = useState([]);
  const [chargeOptions, setChargeOptions] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const navigate = useNavigate();

  const fetchAll = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [pendingRes, mopRes, chargesRes] = await Promise.all([
        fetch(`${apiHost}/api/pos_payment_read_pending.php`),
        fetch(`${apiHost}/api/pos_payment_read_mode_of_payment.php`),
        fetch(`${apiHost}/api/pos_payment_read_other_charges.php`),
      ]);

      const [pendingData, mopData, chargesData] = await Promise.all([
        pendingRes.json(),
        mopRes.json(),
        chargesRes.json(),
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
  };

  useEffect(() => {
    fetchAll();
  }, [apiHost]);

  const filteredTransactions = useMemo(() => {
    const key = search.trim().toLowerCase();
    if (!key) return transactions;

    return transactions.filter((row) => {
      const hay = [
        row.transaction_id,
        row.table_number,
        row.order_type,
        row.Category_Code,
        row.Unit_Code,
        row.cashier,
        row.transaction_date,
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(key);
    });
  }, [transactions, search]);

  const totalSales = filteredTransactions.reduce(
    (sum, row) => sum + toNum(row.TotalSales),
    0,
  );

  return (
    <>
      <div className="max-h-screen p-3 md:p-4">
        <div
          className={`rounded-[1.25rem] shadow-xl ${
            isDark
              ? "border border-white/10 bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-900"
          }`}
        >
          <div className="rounded-t-[1.25rem] px-4 py-4 text-white">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h1 className="text-3xl font-black">Pending for Payment</h1>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchAll}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-white/15 px-4 text-sm font-bold text-white hover:bg-white/20"
                >
                  <FiRefreshCw size={16} />
                </button>

                <div className="relative">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search"
                    className="h-11 w-[260px] rounded-full border  bg-white/95 pl-10 pr-4 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/poscorehomescreen")}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black shadow-sm backdrop-blur transition-all ${
                    isDark
                      ? "border border-white/10 bg-slate-900/60 text-slate-200 hover:bg-slate-800/80 hover:text-white"
                      : "border border-slate-200 bg-white/90 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  Back
                </button>
              </div>
            </div>
          </div>

          <div className="p-4">
            {errorMessage ? (
              <div className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500">
                {errorMessage}
              </div>
            ) : null}

            <div
              className={`overflow-hidden rounded-[1rem] border ${
                isDark ? "border-white/5" : "border-slate-200"
              }`}
            >
              <div
                className={`grid grid-cols-[90px_170px_120px_120px_160px_160px_160px] gap-3 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] ${
                  isDark
                    ? "bg-slate-900/80 text-slate-400"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                <div>Action</div>
                <div>Transaction ID</div>
                <div>Table</div>
                <div>Type</div>
                <div>Date</div>
                <div>Total Sales</div>
                <div>Remarks</div>
              </div>

              <div className="max-h-[520px] overflow-y-auto">
                {isLoading ? (
                  <div className="flex min-h-[220px] items-center justify-center">
                    <p className="text-sm italic text-slate-500">
                      Loading pending transactions...
                    </p>
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center">
                    <p className="text-sm italic text-slate-500">
                      No pending-for-payment transactions found.
                    </p>
                  </div>
                ) : (
                  filteredTransactions.map((row, index) => (
                    <div
                      key={row.ID || row.transaction_id || index}
                      className={`grid grid-cols-[90px_170px_120px_120px_160px_160px_160px] items-center gap-3 px-4 py-3 text-sm ${
                        isDark
                          ? "border-t border-white/5 bg-slate-900/30"
                          : "border-t border-slate-200 bg-white"
                      }`}
                    >
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTransaction(row);
                            setIsPaymentModalOpen(true);
                          }}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white transition-all hover:bg-blue-500"
                          title="Open Payment"
                        >
                          <FiEye size={16} />
                        </button>
                      </div>

                      <div className="font-black">{row.transaction_id}</div>
                      <div>{row.table_number || "-"}</div>
                      <div>{row.order_type || "-"}</div>
                      <div>{row.transaction_date || "-"}</div>
                      <div className="font-black">₱ {peso(row.TotalSales)}</div>
                      <div>
                        <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-500">
                          {row.remarks || "Pending for Payment"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-6 text-sm font-semibold">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full bg-black" />
                  Paid Transactions
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <span className="h-4 w-4 rounded-full bg-green-600" />
                  Pending for Payment
                </div>
              </div>

              <div className="text-right">
                <p className="text-lg font-black">
                  Total Transactions: {filteredTransactions.length}
                </p>
                <p className="text-4xl font-black text-blue-700 dark:text-blue-400">
                  Total Sales ₱ {peso(totalSales)}
                </p>
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
};

export default PosPayment;
