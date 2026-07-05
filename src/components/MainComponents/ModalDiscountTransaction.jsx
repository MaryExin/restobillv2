import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiX,
  FiPrinter,
  FiUsers,
  FiFileText,
  FiTag,
  FiPackage,
  FiEye,
  FiAlertTriangle,
  FiTrash2,
  FiCheck,
  FiShoppingCart,
} from "react-icons/fi";
import ButtonComponent from "./Common/ButtonComponent";
import { BuildPrintableDiscountReceiptHtml } from "../../utils/BuildPrintableDiscountReceiptHtml";
import useGetDefaultPrinter from "../../hooks/useGetDefaultPrinter";
import useBusinessInfo from "../../hooks/useBusinessInfo";

const peso = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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

const DISCOUNT_META = [
  {
    key: "senior",
    label: "Senior Citizen Discount",
    shortLabel: "Senior",
    color: "emerald",
    needsAmount: false,
    hasVatExemption: true,
  },
  {
    key: "pwd",
    label: "PWD Discount",
    shortLabel: "PWD",
    color: "violet",
    needsAmount: false,
    hasVatExemption: true,
  },
  {
    key: "naac",
    label: "NAAC Discount",
    shortLabel: "NAAC",
    color: "blue",
    needsAmount: false,
    hasVatExemption: true,
  },
  {
    key: "soloParent",
    label: "Solo Parent Discount",
    shortLabel: "Solo Parent",
    color: "rose",
    needsAmount: false,
    hasVatExemption: true,
  },
  {
    key: "manual",
    label: "Manual Discount",
    shortLabel: "Manual",
    color: "amber",
    needsAmount: true,
    hasVatExemption: false,
  },
];

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

const OrderedItemsSummaryModal = ({
  isOpen,
  onClose,
  items,
  isLoading,
  errorMessage,
  computed,
  isDark,
}) => {
  if (!isOpen) return null;

  const modalClass = isDark
    ? "bg-slate-900 border border-white/10 text-white"
    : "bg-white border border-slate-200 text-slate-900";

  return (
    <AnimatePresence>
      <motion.div
        className={`fixed inset-0 z-[100001] flex items-center justify-center p-3 backdrop-blur-md ${
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
          className={`w-full max-w-[900px] overflow-hidden rounded-[1rem] shadow-2xl ${modalClass}`}
        >
          <div
            className={`relative px-4 py-3 ${
              isDark
                ? "border-b border-white/5 bg-white/5"
                : "border-b border-slate-200 bg-slate-50"
            }`}
          >
            <button
              onClick={onClose}
              className={`absolute right-3 top-3 rounded-full p-1.5 transition-all ${
                isDark
                  ? "bg-slate-800 text-slate-400 hover:bg-red-500/20 hover:text-red-400"
                  : "bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-500"
              }`}
            >
              <FiX size={14} />
            </button>

            <div className="pr-8 flex items-center gap-2.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  isDark
                    ? "bg-slate-900 text-slate-300"
                    : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                <FiPackage size={14} />
              </div>

              <div>
                <h3 className="text-base font-black">Ordered Items Summary</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Compact view of transaction items and eligibility.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div
                className={`rounded-lg px-3 py-2 ${
                  isDark
                    ? "bg-slate-900/70"
                    : "bg-white border border-slate-200"
                }`}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Total Qty
                </p>
                <p className="mt-1 text-sm font-black">
                  {computed.totalQuantity}
                </p>
              </div>

              <div
                className={`rounded-lg px-3 py-2 ${
                  isDark
                    ? "bg-slate-900/70"
                    : "bg-white border border-slate-200"
                }`}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Discountable
                </p>
                <p className="mt-1 text-sm font-black text-emerald-500">
                  {computed.discountableItemsCount}
                </p>
              </div>

              <div
                className={`rounded-lg px-3 py-2 ${
                  isDark
                    ? "bg-slate-900/70"
                    : "bg-white border border-slate-200"
                }`}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Gross Total
                </p>
                <p className="mt-1 text-sm font-black">
                  ₱ {peso(computed.grossTotal)}
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-slate-300/30">
                <p className="text-sm italic text-slate-500">
                  Loading transaction items...
                </p>
              </div>
            ) : errorMessage ? (
              <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-red-300/30">
                <p className="text-sm italic text-red-500">{errorMessage}</p>
              </div>
            ) : items.length === 0 ? (
              <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-slate-300/30">
                <p className="text-sm italic text-slate-500">
                  No ordered items found.
                </p>
              </div>
            ) : (
              <div
                className={`overflow-hidden rounded-lg border ${
                  isDark ? "border-white/5" : "border-slate-200"
                }`}
              >
                <div
                  className={`grid grid-cols-[minmax(0,1.5fr)_80px_110px_110px] gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] ${
                    isDark
                      ? "bg-slate-900/80 text-slate-400"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <div>Item</div>
                  <div className="text-center">Qty</div>
                  <div className="text-center">Status</div>
                  <div className="text-right">Total</div>
                </div>

                <div className="max-h-[360px] overflow-y-auto">
                  {items.map((item, index) => {
                    const qty = Number(item.sales_quantity || 0);
                    const price = Number(item.selling_price || 0);
                    const lineTotal = qty * price;

                    const isDiscountable = yesNoToBool(item.isDiscountable);
                    const isVatable = yesNoToBool(item.vatable);

                    return (
                      <div
                        key={item.ID || index}
                        className={`grid grid-cols-[minmax(0,1.5fr)_80px_110px_110px] gap-2 px-3 py-2.5 text-[12px] ${
                          isDark
                            ? "border-t border-white/5 bg-slate-900/30"
                            : "border-t border-slate-200 bg-white"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-bold">
                            {item.item_name || item.product_id}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            ₱ {peso(price)} each
                          </p>
                        </div>

                        <div className="flex items-center justify-center font-semibold">
                          {qty}
                        </div>

                        <div className="flex flex-col items-center justify-center gap-1">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${
                              isDiscountable
                                ? "bg-emerald-500/10 text-emerald-500"
                                : "bg-slate-500/10 text-slate-500"
                            }`}
                          >
                            {isDiscountable ? "Discountable" : "Non-disc"}
                          </span>

                          <span
                            className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${
                              isVatable
                                ? "bg-blue-500/10 text-blue-500"
                                : "bg-amber-500/10 text-amber-500"
                            }`}
                          >
                            {isVatable ? "Vatable" : "Non-VAT"}
                          </span>
                        </div>

                        <div className="flex items-center justify-end font-black">
                          ₱ {peso(lineTotal)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={onClose}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                  isDark
                    ? "bg-slate-800 text-slate-300 hover:text-white"
                    : "bg-slate-200 text-slate-700 hover:text-slate-900"
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
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
  onSave,
  isSaving = false,
  readOnly = false,
}) => {
  if (!isOpen) return null;

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
    <AnimatePresence>
      <motion.div
        className={`fixed inset-0 z-[100002] flex items-center justify-center p-3 backdrop-blur-md ${
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
          className={`w-full max-w-[1000px] max-h-[calc(100vh-1.5rem)] overflow-auto rounded-[1rem] shadow-2xl ${
            isDark
              ? "border border-white/10 bg-slate-900 text-white"
              : "border border-slate-200 bg-white text-slate-900"
          }`}
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

              <button
                type="button"
                onClick={onClose}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                  isDark
                    ? "bg-slate-800 text-slate-400 hover:bg-red-500/20 hover:text-red-400"
                    : "bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-500"
                }`}
              >
                <FiX size={16} />
              </button>
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
                          onChange={(e) =>
                            updateCard(index, "tin", e.target.value)
                          }
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
                onClick={onSave || onClose}
                disabled={isSaving}
                className={`px-10 py-3 text-sm font-black text-white transition bg-blue-600 rounded-2xl hover:bg-blue-500 ${
                  isSaving ? "cursor-not-allowed opacity-60" : ""
                }`}
              >
                {isSaving ? "Saving..." : "Save Customer Info"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const DiscountEntryCard = ({
  meta,
  values,
  isDark,
  inputClass,
  cardClass,
  onChangeCount,
  onChangeManualAmount,
  onChangeManualPercent,
  manualBaseAmount = 0,
  discountMode = "PerCustomer",
}) => {
  const accentClass =
    meta.color === "emerald"
      ? "text-emerald-500"
      : meta.color === "violet"
        ? "text-violet-500"
        : meta.color === "blue"
          ? "text-blue-500"
          : meta.color === "rose"
            ? "text-rose-500"
        : "text-amber-500";

  return (
    <div className={`rounded-[0.95rem] p-3 ${cardClass}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-black">{meta.label}</h4>
          <p className={`text-[11px] ${accentClass}`}>
            {meta.needsAmount
              ? "Enter a direct amount or percentage."
              : meta.key === "soloParent"
                ? discountMode === "PerProduct"
                  ? "10% of per-person share (selected items ÷ total customers)."
                  : "10% statutory discount per qualified share."
                : discountMode === "PerProduct"
                  ? "20% of per-person share (selected items ÷ total customers)."
                  : "20% statutory discount per qualified share."}
          </p>
        </div>
        <div
          className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
            isDark
              ? "bg-slate-900/80 text-slate-300"
              : "bg-white text-slate-600"
          }`}
        >
          {meta.shortLabel}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
            Qualified Count
          </label>
          <input
            type="number"
            min="0"
            value={values.qualifiedCount}
            onChange={(e) => onChangeCount(meta.key, e.target.value)}
            onFocus={handleSelectAllOnFocus}
            className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${inputClass}`}
            placeholder="0"
          />
        </div>

        {meta.needsAmount ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                Manual Amount
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  values.manualMode === "percent"
                    ? values.manualPercent === ""
                      ? ""
                      : roundMoney(
                        manualBaseAmount *
                          (Number(values.manualPercent || 0) / 100),
                        )
                    : values.manualAmount
                }
                onChange={(e) => onChangeManualAmount(meta.key, e.target.value)}
                onFocus={handleSelectAllOnFocus}
                className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${inputClass}`}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                Percent
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={
                  values.manualMode === "percent"
                    ? values.manualPercent
                    : manualBaseAmount > 0 &&
                        Number(values.manualAmount || 0) > 0
                      ? roundMoney(
                          (Number(values.manualAmount || 0) /
                            manualBaseAmount) *
                            100,
                        )
                      : ""
                }
                onChange={(e) => onChangeManualPercent(meta.key, e.target.value)}
                onFocus={handleSelectAllOnFocus}
                className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${inputClass}`}
                placeholder="%"
              />
            </div>

            <p className="sm:col-span-2 text-[10px] font-semibold text-slate-500">
              Percentage is computed from discountable gross.
            </p>
          </div>
        ) : (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              isDark
                ? "bg-slate-900/60 border border-white/5 text-slate-300"
                : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
              Rule
            </p>
            <p className="mt-1 font-semibold">
              {meta.key === "soloParent"
                ? discountMode === "PerProduct" ? "10% of per-person share (selected items)" : "10% of prorated base"
                : discountMode === "PerProduct" ? "20% of per-person share (selected items)" : "20% of prorated base"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const ModalDiscountTransaction = ({
  isOpen,
  onClose,
  transaction,
  dateFrom,
  apiHost,
  isDark,
  billingNo,
}) => {
  const defaultPrinterName = useGetDefaultPrinter();
  const { businessInfo, isBusInfoLoading } = useBusinessInfo();

  const [printerName, setPrinterName] = useState("");
  const [printers, setPrinters] = useState([]);

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [customerCount, setCustomerCount] = useState(1);
  const [customerCards, setCustomerCards] = useState([]);
  const [discountState, setDiscountState] = useState(buildInitialDiscountState);
  const [discountCeilingAmount, setDiscountCeilingAmount] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [showCustomerInfoModal, setShowCustomerInfoModal] = useState(false);
  const [qualifiedPrompt, setQualifiedPrompt] = useState("");
  const [latestBillingNo, setLatestBillingNo] = useState(
    billingNo || transaction?.billing_no || transaction?.billingNo || "",
  );
  const [latestInvoiceNo, setLatestInvoiceNo] = useState(
    transaction?.invoice_no || "",
  );
  const [existingDiscountLoaded, setExistingDiscountLoaded] = useState(false);
  const [hadExistingDiscountBreakdown, setHadExistingDiscountBreakdown] =
    useState(false);
  const [initialLoadedSignature, setInitialLoadedSignature] = useState("");
  const [showOverrideWarning, setShowOverrideWarning] = useState(false);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceCharges, setServiceCharges] = useState([]);
  // per-transaction toggle: chargeId → boolean (true = include this transaction)
  const [chargeToggles, setChargeToggles] = useState({});
  const [discountMode, setDiscountMode] = useState("PerCustomer");
  const [discountSharingMode, setDiscountSharingMode] = useState("shared");
  // Per Product: object { [String(item.ID)]: number } — how many units per item are discounted
  const [selectedProductIds, setSelectedProductIds] = useState({});
  const [customerInfoEnabled, setCustomerInfoEnabled] = useState(false);
  const [isSavingCustomerInfo, setIsSavingCustomerInfo] = useState(false);
  const [customerInfoSavedMessage, setCustomerInfoSavedMessage] = useState("");

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

        console.log("Electron printers:", safeList);
        console.log("Printer count:", safeList.length);
        console.log("Default printer from hook:", defaultPrinterName);

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

        console.log(
          "Matched printer from hook:",
          matchedPrinter?.name || "(none)",
        );
        console.log(
          "Electron default printer:",
          fallbackElectronDefault?.name || "(none)",
        );
        console.log("Resolved printer name:", resolvedPrinterName);
      } catch (error) {
        console.error("Failed to load printers:", error);
        setPrinterName(String(defaultPrinterName || "").trim());
      }
    };

    loadPrinters();
  }, [isOpen, defaultPrinterName]);

  const handleChangeCount = (key, value) => {
    setDiscountState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        qualifiedCount: value,
      },
    }));
  };

  const handleChangeManualAmount = (key, value) => {
    setDiscountState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        manualAmount: value,
        manualMode: "amount",
      },
    }));
  };

  const handleChangeManualPercent = (key, value) => {
    setDiscountState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        manualPercent: value,
        manualMode: "percent",
      },
    }));
  };

  const resetForm = () => {
    setCustomerCount(1);
    setCustomerCards([]);
    setQualifiedPrompt("");
    setDiscountState(buildInitialDiscountState());
    setExistingDiscountLoaded(false);
    setHadExistingDiscountBreakdown(false);
    setInitialLoadedSignature("");
    setShowOverrideWarning(false);
    setIsSavingCustomerInfo(false);
    setCustomerInfoSavedMessage("");
  };

  useEffect(() => {
    if (!isOpen || !apiHost || !transaction?.transaction_id) return;

    setIsLoading(true);
    setErrorMessage("");

    fetch(`${apiHost}/api/transaction_discount_items.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction_id: transaction.transaction_id,
        category_code:
          transaction?.Category_Code || transaction?.category_code || "",
        unit_code: transaction?.Unit_Code || transaction?.unit_code || "",
        terminal_number: transaction?.terminal_number || "",
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        const nextItems = Array.isArray(data?.items) ? data.items : [];
        const txn = data?.transaction_summary || {};
        const discountCounts = data?.discount_counts || {
          senior: 0,
          pwd: 0,
          naac: 0,
          soloParent: 0,
          manual: 0,
        };
        const discountRows = Array.isArray(data?.discount_rows)
          ? data.discount_rows
          : [];

        setItems(nextItems);

        // Initialize all discountable items at full qty for Per Product mode
        const initSelected = {};
        nextItems.forEach((item) => {
          if (yesNoToBool(item.isDiscountable)) {
            initSelected[String(item.ID)] = Number(item.sales_quantity || 0);
          }
        });
        setSelectedProductIds(initSelected);

        const nextCustomerCount = Math.max(
          Number(
            txn.customer_head_count || transaction?.customer_head_count || 1,
          ),
          1,
        );

        const nextDiscountState = {
          senior: {
            qualifiedCount: Number(discountCounts.senior || 0),
            manualAmount: "",
          },
          pwd: {
            qualifiedCount: Number(discountCounts.pwd || 0),
            manualAmount: "",
          },
          naac: {
            qualifiedCount: Number(discountCounts.naac || discountCounts.NAAC || 0),
            manualAmount: "",
          },
          soloParent: {
            qualifiedCount: Number(
              discountCounts.soloParent ||
                discountCounts.solo_parent ||
                discountCounts["Solo Parent"] ||
                0,
            ),
            manualAmount: "",
          },
          manual: {
            qualifiedCount: Number(discountCounts.manual || 0),
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
        };

        setCustomerCount(nextCustomerCount);
        setDiscountState(nextDiscountState);
        setCustomerCards(
          discountRows.length > 0
            ? discountRows
                .slice(
                  0,
                  Number(discountCounts.senior || 0) +
                    Number(discountCounts.pwd || 0) +
                    Number(discountCounts.naac || discountCounts.NAAC || 0) +
                    Number(
                      discountCounts.soloParent ||
                        discountCounts.solo_parent ||
                        discountCounts["Solo Parent"] ||
                        0,
                    ) +
                    Number(discountCounts.manual || 0),
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

        const hasExistingBreakdown = discountRows.length > 0;
        setExistingDiscountLoaded(true);
        setHadExistingDiscountBreakdown(hasExistingBreakdown);

        const signature = JSON.stringify({
          customerCount: nextCustomerCount,
          discountState: nextDiscountState,
        });
        setInitialLoadedSignature(signature);
        setShowOverrideWarning(false);

        setLatestBillingNo(
          billingNo ||
            txn?.billing_no ||
            transaction?.billing_no ||
            transaction?.billingNo ||
            "",
        );
        setLatestInvoiceNo(txn?.invoice_no || transaction?.invoice_no || "");

        setIsLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setErrorMessage("Failed to load transaction items.");
        setItems([]);
        setCustomerCards([]);
        setExistingDiscountLoaded(false);
        setHadExistingDiscountBreakdown(false);
        setInitialLoadedSignature("");
        setShowOverrideWarning(false);
        setIsLoading(false);
      });
  }, [isOpen, apiHost, transaction, billingNo]);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

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

    const fetchServiceChargeSettings = async () => {
      try {
        const [scRes, listRes, modeRes] = await Promise.all([
          fetch(`${apiHost}/api/pos_service_charge.php`),
          fetch(`${apiHost}/api/pos_manage_other_charges.php`),
          fetch(`${apiHost}/api/pos_discount_mode.php`),
        ]);
        const scResult   = await scRes.json();
        const listResult = await listRes.json();
        const modeResult = await modeRes.json();

        if (!cancelled) {
          setServiceChargeEnabled(Boolean(scResult?.data?.service_charge_enabled || false));
          const loadedCharges = Array.isArray(listResult?.charges) ? listResult.charges : [];
          setServiceCharges(loadedCharges);
          // initialise per-transaction toggles: all charges default OFF, cashier picks which to turn on
          const toggleInit = {};
          loadedCharges.forEach((c) => {
            toggleInit[Number(c.ID)] = false;
          });
          setChargeToggles(toggleInit);
          setDiscountMode(modeResult?.data?.discount_mode === "PerProduct" ? "PerProduct" : "PerCustomer");
        }
      } catch (error) {
        console.error("Failed to load service charge settings:", error);
        if (!cancelled) {
          setServiceChargeEnabled(false);
          setServiceCharges([]);
          setDiscountMode("PerCustomer");
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

    const fetchCustomerInfoSettings = async () => {
      try {
        const response = await fetch(
          `${apiHost}/api/pos_customer_info_settings.php`,
        );
        const result = await response.json();

        if (!cancelled) {
          setCustomerInfoEnabled(
            Boolean(result?.data?.customer_info_enabled || false),
          );
        }
      } catch (error) {
        console.error("Failed to load customer info settings:", error);
        if (!cancelled) {
          setCustomerInfoEnabled(false);
        }
      }
    };

    fetchCustomerInfoSettings();

    return () => {
      cancelled = true;
    };
  }, [isOpen, apiHost]);

  useEffect(() => {
    if (!existingDiscountLoaded || !hadExistingDiscountBreakdown) return;

    const currentSignature = JSON.stringify({
      customerCount: Math.max(Number(customerCount || 0), 1),
      discountState: {
        senior: {
          qualifiedCount: Number(discountState?.senior?.qualifiedCount || 0),
          manualAmount: "",
        },
        pwd: {
          qualifiedCount: Number(discountState?.pwd?.qualifiedCount || 0),
          manualAmount: "",
        },
        naac: {
          qualifiedCount: Number(discountState?.naac?.qualifiedCount || 0),
          manualAmount: "",
        },
        soloParent: {
          qualifiedCount: Number(
            discountState?.soloParent?.qualifiedCount || 0,
          ),
          manualAmount: "",
        },
        manual: {
          qualifiedCount: Number(discountState?.manual?.qualifiedCount || 0),
          manualAmount: Number(discountState?.manual?.manualAmount || 0),
          manualPercent: Number(discountState?.manual?.manualPercent || 0),
          manualMode:
            discountState?.manual?.manualMode === "percent"
              ? "percent"
              : "amount",
        },
      },
    });

    setShowOverrideWarning(currentSignature !== initialLoadedSignature);
  }, [
    customerCount,
    discountState,
    existingDiscountLoaded,
    hadExistingDiscountBreakdown,
    initialLoadedSignature,
  ]);

  const computed = useMemo(() => {
    const isPerProduct = discountMode === "PerProduct";
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

    const totalQualifiedAll =
      rawSeniorCount +
      rawPwdCount +
      rawNaacCount +
      rawSoloParentCount +
      rawManualCount;
    const statutoryQualifiedCount =
      rawSeniorCount + rawPwdCount + rawNaacCount + rawSoloParentCount;

    const statutoryQualifiedRatio =
      safeCustomerCount > 0
        ? Math.min(statutoryQualifiedCount, safeCustomerCount) /
          safeCustomerCount
        : 0;

    const notQualifiedRatio =
      safeCustomerCount > 0 ? 1 - statutoryQualifiedRatio : 0;

    let discountableGross = 0;
    let discountableBase = 0;
    let selectedDiscountableGross = 0;
    let selectedDiscountableBase = 0;
    let rawVatableGross = 0;
    let vatableSales = 0;
    let vatableSalesVat = 0;
    let vatExemptSales = 0;
    const vatZeroRatedSales = 0;

    items.forEach((item) => {
      const isDiscountable = yesNoToBool(item.isDiscountable);
      const isVatable = yesNoToBool(item.vatable);
      const qty = Number(item.sales_quantity || 0);
      const price = Number(item.selling_price || 0);
      const lineTotal = qty * price;
      const itemKey = String(item.ID || "");
      // Per Product: discountQty = how many units are discounted (0..qty)
      const discountQty = isPerProduct
        ? Math.min(Math.max(Number(selectedProductIds[itemKey] ?? qty), 0), qty)
        : qty;
      const discountLineTotal = price * discountQty;
      const nonDiscountLineTotal = lineTotal - discountLineTotal;

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

    // Per Product: restrict the base to selected items, then prorate by qualified/total.
    // Per Customer: use all discountable items, prorated by qualified/total.
    // Formula in both modes: base × (qualifiedCount / totalCustomers)
    // "base" = selectedDiscountableBase (Per Product) or discountableBase (Per Customer)
    const discountBase = isPerProduct ? selectedDiscountableBase : discountableBase;

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

    const seniorDiscountAmount = seniorProratedBase * 0.2;
    const seniorVatExemption = seniorProratedBase * 0.12;

    const pwdDiscountAmount = pwdProratedBase * 0.2;
    const pwdVatExemption = pwdProratedBase * 0.12;

    const naacDiscountAmount = naacProratedBase * 0.2;
    const naacVatExemption = naacProratedBase * 0.12;

    const soloParentDiscountAmount = soloParentProratedBase * 0.1;
    const soloParentVatExemption = soloParentProratedBase * 0.12;

    const manualDiscountAmount =
      manualMode === "percent"
        ? discountableGross * (manualPercent / 100)
        : rawManualAmount;
    const manualVatExemption = 0;

    const rawDiscountBreakdown = [
      {
        key: "senior",
        label: "Senior Citizen Discount",
        shortLabel: "Senior",
        qualifiedCount: rawSeniorCount,
        proratedBase: seniorProratedBase,
        discountAmount: seniorDiscountAmount,
        vatExemption: seniorVatExemption,
      },
      {
        key: "pwd",
        label: "PWD Discount",
        shortLabel: "PWD",
        qualifiedCount: rawPwdCount,
        proratedBase: pwdProratedBase,
        discountAmount: pwdDiscountAmount,
        vatExemption: pwdVatExemption,
      },
      {
        key: "naac",
        label: "NAAC Discount",
        shortLabel: "NAAC",
        qualifiedCount: rawNaacCount,
        proratedBase: naacProratedBase,
        discountAmount: naacDiscountAmount,
        vatExemption: naacVatExemption,
      },
      {
        key: "soloParent",
        label: "Solo Parent Discount",
        shortLabel: "Solo Parent",
        qualifiedCount: rawSoloParentCount,
        proratedBase: soloParentProratedBase,
        discountAmount: soloParentDiscountAmount,
        vatExemption: soloParentVatExemption,
      },
      {
        key: "manual",
        label: "Manual Discount",
        shortLabel: "Manual",
        qualifiedCount: rawManualCount,
        proratedBase: 0,
        discountAmount: manualDiscountAmount,
        vatExemption: manualVatExemption,
        manualPercent,
        manualMode,
      },
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

    const grossTotal = items.reduce((sum, item) => {
      return (
        sum + Number(item.sales_quantity || 0) * Number(item.selling_price || 0)
      );
    }, 0);

    const totalQuantity = items.reduce((sum, item) => {
      return sum + Number(item.sales_quantity || 0);
    }, 0);

    const discountableItemsCount = items.filter((item) =>
      yesNoToBool(item.isDiscountable),
    ).length;

    const netAfterDiscount = Math.max(
      grossTotal - totalDiscount - totalVatExemption,
      0,
    );
    const netOfVat = netAfterDiscount / 1.12;
    const serviceChargeBase = netOfVat;

    const appliedCharges = serviceChargeEnabled
      ? (Array.isArray(serviceCharges) ? serviceCharges : [])
          .filter((c) => Boolean(c.is_enabled) && chargeToggles[Number(c.ID)] !== false)
          .map((c) => {
            const rate = Number(c.amount || 0);
            const computed =
              c.rate_type === "Fixed"
                ? roundMoney(rate)
                : roundMoney(serviceChargeBase * (rate / 100));
            return {
              id:            Number(c.ID),
              particulars:   String(c.particulars || ""),
              rate_type:     String(c.rate_type || "Percentage"),
              rate,
              computedAmount: computed,
            };
          })
          .filter((c) => c.computedAmount > 0)
      : [];

    const totalOtherCharges = appliedCharges.reduce((s, c) => s + c.computedAmount, 0);
    const totalAmountDue = Math.max(netAfterDiscount + totalOtherCharges, 0);

    const discountTypeSummary = discountBreakdown
      .filter(
        (entry) =>
          Number(entry.qualifiedCount || 0) > 0 ||
          Number(entry.discountAmount || 0) > 0,
      )
      .map((entry) => entry.label)
      .join(", ");

    return {
      discountableGross,
      discountableBase,
      selectedDiscountableGross,
      selectedDiscountableBase,
      grossTotal,
      totalQuantity,
      discountableItemsCount,
      netAfterDiscount,
      netOfVat,
      totalAmountDue,
      serviceChargeEnabled,
      appliedCharges,
      serviceChargeBase,
      totalOtherCharges,
      safeCustomerCount,
      vatableSales,
      vatableSalesVat,
      vatExemptSales: finalVatExemptSales,
      rawVatExemptSales: vatExemptSales,
      vatZeroRatedSales,
      rawTotalDiscount,
      totalDiscount,
      discountCeilingAmount,
      isDiscountCeilingApplied,
      totalVatExemption,
      totalQualifiedAll,
      statutoryQualifiedCount,
      statutoryQualifiedRatio,
      discountBreakdown,
      discountTypeSummary,
      discountMode,
    };
  }, [
    items,
    customerCount,
    discountState,
    discountCeilingAmount,
    transaction,
    serviceChargeEnabled,
    serviceCharges,
    chargeToggles,
    discountMode,
    discountSharingMode,
    selectedProductIds,
  ]);

  const validateQualifiedCounts = (nextTotal, nextState = discountState) => {
    const totalNum = Math.max(Number(nextTotal || 0), 0);
    const seniorNum = Math.max(
      Math.floor(Number(nextState?.senior?.qualifiedCount || 0)),
      0,
    );
    const pwdNum = Math.max(
      Math.floor(Number(nextState?.pwd?.qualifiedCount || 0)),
      0,
    );
    const naacNum = Math.max(
      Math.floor(Number(nextState?.naac?.qualifiedCount || 0)),
      0,
    );
    const soloParentNum = Math.max(
      Math.floor(Number(nextState?.soloParent?.qualifiedCount || 0)),
      0,
    );
    const manualNum = Math.max(
      Math.floor(Number(nextState?.manual?.qualifiedCount || 0)),
      0,
    );

    const totalQualified =
      seniorNum + pwdNum + naacNum + soloParentNum + manualNum;

    if (totalNum > 0 && totalQualified > totalNum) {
      setQualifiedPrompt(
        "Total qualified across Senior, PWD, NAAC, Solo Parent, and Manual should not be more than total customers.",
      );
      return false;
    }

    const manualHasDiscount =
      nextState?.manual?.manualMode === "percent"
        ? Number(nextState?.manual?.manualPercent || 0) > 0
        : Number(nextState?.manual?.manualAmount || 0) > 0;

    if (manualNum > 0 && !manualHasDiscount) {
      setQualifiedPrompt(
        "Manual Discount amount or percentage is required when Manual qualified count is greater than zero.",
      );
      return false;
    }

    setQualifiedPrompt("");
    return true;
  };

  useEffect(() => {
    const safeQualified = Math.max(Number(computed.totalQualifiedAll) || 0, 0);

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
  }, [computed.totalQualifiedAll]);

  useEffect(() => {
    validateQualifiedCounts(customerCount, discountState);
  }, [customerCount, discountState]);

  const handleSaveCustomerInfo = async () => {
    if (!apiHost || !transaction?.transaction_id || isSavingCustomerInfo) {
      return;
    }

    if (!validateQualifiedCounts(customerCount, discountState)) {
      setCustomerInfoSavedMessage("Please fix the discount validation first.");
      return;
    }

    const safeCards = customerCards.slice(0, computed.totalQualifiedAll);
    const discountBreakdownPayload = computed.discountBreakdown
      .filter(
        (entry) =>
          Number(entry.qualifiedCount || 0) > 0 ||
          Number(entry.discountAmount || 0) > 0,
      )
      .map((entry) => ({
        key: entry.key,
        discount_type: entry.label,
        qualified_count: Number(entry.qualifiedCount || 0),
        discount_amount: Number(entry.discountAmount || 0),
        vat_exemption: Number(entry.vatExemption || 0),
        prorated_base: Number(entry.proratedBase || 0),
      }));

    try {
      setIsSavingCustomerInfo(true);
      setCustomerInfoSavedMessage("");

      const response = await fetch(`${apiHost}/api/pos_discount_customer_info.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction_id: transaction.transaction_id,
          category_code:
            transaction?.Category_Code ||
            transaction?.category_code ||
            "Crab & Crack",
          unit_code: transaction?.Unit_Code || transaction?.unit_code || "",
          user_id: localStorage.getItem("user_id") || "",
          user_name:
            localStorage.getItem("username") || transaction?.cashier || "System",
          cashier:
            localStorage.getItem("username") || transaction?.cashier || "System",
          customer_head_count: Number(customerCount || 1),
          customer_count_for_discount: Number(computed.totalQualifiedAll || 0),
          discount_type: computed.discountTypeSummary || "",
          customer_info: safeCards.map((card) => ({
            customer_exclusive_id: card.customer_exclusive_id || "",
            customer_name: card.customer_name || "",
            date_of_birth: card.date_of_birth || "",
            gender: card.gender || "",
            tin: card.tin || "",
            contact_no: card.contact_no || "",
          })),
          discount_breakdown: discountBreakdownPayload,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to save customer info.");
      }

      setCustomerCards(safeCards);
      setCustomerInfoSavedMessage("Customer info saved.");
      setShowCustomerInfoModal(false);
      setExistingDiscountLoaded(true);
      setHadExistingDiscountBreakdown(discountBreakdownPayload.length > 0);
    } catch (error) {
      console.error(error);
      setCustomerInfoSavedMessage(error.message || "Failed to save customer info.");
    } finally {
      setIsSavingCustomerInfo(false);
    }
  };

  const isPrintDisabled = Boolean(qualifiedPrompt) || isPrinting;

  const saveBillingBeforePrint = async () => {
    if (!apiHost || !transaction?.transaction_id) {
      throw new Error("Missing transaction data.");
    }

    if (!validateQualifiedCounts(customerCount, discountState)) {
      throw new Error("Please fix the discount validation first.");
    }

    const loggedUserId = localStorage.getItem("user_id") || "";
    const loggedUserName =
      localStorage.getItem("username") || transaction?.cashier || "System";

    const discountBreakdownPayload = computed.discountBreakdown
      .filter(
        (entry) =>
          Number(entry.qualifiedCount || 0) > 0 ||
          Number(entry.discountAmount || 0) > 0,
      )
      .map((entry) => ({
        key: entry.key,
        discount_type: entry.label,
        qualified_count: Number(entry.qualifiedCount || 0),
        discount_amount: Number(entry.discountAmount || 0),
        vat_exemption: Number(entry.vatExemption || 0),
        prorated_base: Number(entry.proratedBase || 0),
      }));

    const payload = {
      transaction_id: transaction.transaction_id,
      printTitle: "BILLING",
      transStatus: transaction?.remarks || "Pending for Payment",

      category_code:
        transaction?.Category_Code ||
        transaction?.category_code ||
        "Crab & Crack",
      unit_code: transaction?.Unit_Code || transaction?.unit_code || "",

      user_id: loggedUserId,
      user_name: loggedUserName,

      customer_exclusive_id:
        customerCards?.[0]?.customer_exclusive_id ||
        transaction?.customer_exclusive_id ||
        "",
      customer_head_count: Number(customerCount || 1),
      customer_count_for_discount: Number(computed?.totalQualifiedAll || 0),
      discount_type: computed?.discountTypeSummary || "",

      customer_info: customerInfoEnabled
        ? customerCards.slice(0, computed.totalQualifiedAll).map((card) => ({
            customer_exclusive_id: card.customer_exclusive_id || "",
            customer_name: card.customer_name || "",
            date_of_birth: card.date_of_birth || "",
            gender: card.gender || "",
            tin: card.tin || "",
            contact_no: card.contact_no || "",
          }))
        : undefined,

      TotalSales: Number(computed?.grossTotal || 0),
      Discount: Number(computed?.totalDiscount || 0),
      OtherCharges: Number(computed?.totalOtherCharges || 0),
      TotalAmountDue: Number(computed?.totalAmountDue || 0),

      VATableSales: Number(computed?.vatableSales || 0),
      VATableSales_VAT: Number(computed?.vatableSalesVat || 0),
      VATExemptSales: Number(computed?.vatExemptSales || 0),
      VATExemptSales_VAT: Number(computed?.totalVatExemption || 0),
      VATZeroRatedSales: Number(computed?.vatZeroRatedSales || 0),

      payment_amount: Number(transaction?.payment_amount || 0),
      payment_method: transaction?.payment_method || "Cash",
      change_amount: Number(transaction?.change_amount || 0),
      cashier: loggedUserName,

      discount_breakdown: discountBreakdownPayload,

      cart_items: (items || []).map((item) => ({
        databaseID: item.ID || item.id || item.databaseID,
        selling_price: Number(item.selling_price || 0),
      })),
    };

    const response = await fetch(`${apiHost}/api/billing.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok || result.status !== "success") {
      throw new Error(result.message || "Failed to save billing.");
    }

    setLatestBillingNo(result.billing_no || "");
    setLatestInvoiceNo(result.invoice_no || "");

    return result;
  };

  const handleNativePrint = async () => {
    if (isPrinting) return;

    if (!apiHost || !transaction?.transaction_id) {
      alert("Missing transaction data.");
      return;
    }

    if (!validateQualifiedCounts(customerCount, discountState)) {
      alert("Please fix the discount validation first.");
      return;
    }

    console.log("Selected printerName:", printerName);
    console.log("Available printers:", printers);
    console.log(
      "Is aligned:",
      printers.some((p) => p.name === printerName),
    );

    try {
      setIsPrinting(true);

      const billingResult = await saveBillingBeforePrint();

      const finalBillingNo =
        billingResult?.billing_no ||
        latestBillingNo ||
        billingNo ||
        transaction?.billing_no ||
        transaction?.billingNo ||
        "";

      const finalInvoiceNo =
        billingResult?.invoice_no ||
        latestInvoiceNo ||
        transaction?.invoice_no ||
        "";

      const result = await window.electronAPI.printEscposDiscount({
        transaction: {
          ...transaction,
          cashier:
            localStorage.getItem("username") ||
            transaction?.cashier ||
            "System",
          billing_no: finalBillingNo,
          invoice_no: finalInvoiceNo,
        },
        dateFrom,
        computed,
        items,
        businessInfo,
        printerName,
      });

      // const html = BuildPrintableDiscountReceiptHtml({
      //   transaction: {
      //     ...transaction,
      //     cashier:
      //       localStorage.getItem("username") ||
      //       transaction?.cashier ||
      //       "System",
      //     billing_no: finalBillingNo,
      //     invoice_no: finalInvoiceNo,
      //   },
      //   dateFrom,
      //   computed,
      //   items,
      //   scale: 1,
      //   businessInfo,
      // });

      // const result = await window.electronAPI.printReceipt({
      //   html,
      //   printerName,
      //   silent: true,
      //   copies: 1,
      // });

      // const handleDiscountPrintElectron = async ({
      //   transaction,
      //   finalBillingNo,
      //   finalInvoiceNo,
      //   dateFrom,
      //   computed,
      //   items,
      //   businessInfo,
      //   printerName,
      // }) => {
      //   const result = await window.electronAPI.printableDiscountReceipt({
      //     transaction: {
      //       ...transaction,
      //       cashier:
      //         localStorage.getItem("username") ||
      //         transaction?.cashier ||
      //         "System",
      //       billing_no: finalBillingNo,
      //       invoice_no: finalInvoiceNo,
      //     },
      //     dateFrom,
      //     computed,
      //     items,
      //     businessInfo,
      //     printerName,
      //     silent: true,
      //     copies: 1,
      //   });

      //   if (!result?.success) {
      //     throw new Error(result?.message || "ESC/POS printing failed.");
      //   }

      //   return result;
      // };

      console.log("Print result:", result);

      if (!result?.success) {
        throw new Error(result?.message || "Print failed.");
      }

      // Always sync AUTO charges after billing — this deletes any stale charges from a
      // prior billing print even when all charges are now OFF, preventing the payment
      // modal from inflating Amount Due with leftover DB rows.
      try {
        const activeCharges = Array.isArray(computed?.appliedCharges)
          ? computed.appliedCharges
              .filter((c) => Number(c.computedAmount || 0) > 0)
              .map((c) => ({ particulars: c.particulars, amount: c.computedAmount }))
          : [];
        await fetch(`${apiHost}/api/pos_save_transaction_charges.php`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction_id: transaction?.transaction_id || "",
            Category_Code: transaction?.Category_Code || "",
            Unit_Code: transaction?.Unit_Code || "",
            charges: activeCharges,
          }),
        });
      } catch (e) {
        console.warn("Failed to save billing charges:", e);
      }

      // Save per-product discount selection when mode is Per Product
      if (discountMode === "PerProduct") {
        try {
          const activeDiscountTypes = computed.discountBreakdown.filter(
            (entry) => Number(entry.qualifiedCount || 0) > 0 || Number(entry.discountAmount || 0) > 0,
          );
          const totalBase = computed.selectedDiscountableBase || 0;
          const rows = [];

          items.forEach((item) => {
            if (!yesNoToBool(item.isDiscountable)) return;
            const qty    = Number(item.sales_quantity || 0);
            const price  = Number(item.selling_price || 0);
            const itemKey = String(item.ID || "");
            const discQty = Math.min(Math.max(Number(selectedProductIds[itemKey] ?? qty), 0), qty);
            if (discQty === 0) return;

            const isVatable = yesNoToBool(item.vatable);
            const discLineTotal = price * discQty;
            const itemBase = isVatable ? discLineTotal / 1.12 : discLineTotal;
            const itemRatio = totalBase > 0 ? itemBase / totalBase : 0;

            activeDiscountTypes.forEach((entry) => {
              rows.push({
                product_id:        itemKey,
                item_name:         String(item.item_name || item.product_id || ""),
                customer_id:       "",
                discount_type:     String(entry.shortLabel || entry.label || ""),
                discount_sharing:  discountSharingMode,
                total_customers:   computed.safeCustomerCount,
                qualified_customers: Number(entry.qualifiedCount || 0),
                discount_amount:   Number((entry.discountAmount || 0) * itemRatio),
                vat_exempt_amount: Number((entry.vatExemption || 0) * itemRatio),
              });
            });
          });

          await fetch(`${apiHost}/api/pos_save_discount_per_product.php`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transaction_id:   transaction?.transaction_id || "",
              transaction_date: transaction?.transaction_date || "",
              category_code:    transaction?.Category_Code || "",
              unit_code:        transaction?.Unit_Code || "",
              rows,
            }),
          });
        } catch (e) {
          console.warn("Failed to save per-product discount data:", e);
        }
      }
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to print billing.");
    } finally {
      setIsPrinting(false);
    }
  };

  const containerClass = isDark
    ? "bg-slate-900 border border-white/10 text-white"
    : "bg-white border border-slate-200 text-slate-900";

  const cardClass = isDark
    ? "bg-slate-950/40 border border-white/5"
    : "bg-slate-50 border border-slate-200";

  const innerCardClass = isDark
    ? "bg-slate-900/70 border border-white/5"
    : "bg-white border border-slate-200";

  const inputClass = isDark
    ? "bg-slate-900/70 border border-slate-800 text-white placeholder:text-slate-500"
    : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400";

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          className={`fixed inset-0 z-[100000] flex items-center justify-center p-2 backdrop-blur-md ${
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
            className={`w-full max-w-[980px] max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)] overflow-hidden rounded-[1rem] shadow-2xl flex flex-col ${containerClass}`}
          >
            <div
              className={`relative px-4 py-3 ${
                isDark
                  ? "border-b border-white/5 bg-white/5"
                  : "border-b border-slate-200 bg-slate-50"
              }`}
            >
              <button
                onClick={onClose}
                disabled={isPrinting}
                className={`absolute right-3 top-3 rounded-full p-1.5 transition-all ${
                  isDark
                    ? "bg-slate-800 text-slate-400 hover:bg-red-500/20 hover:text-red-400"
                    : "bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-500"
                } ${isPrinting ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <FiX size={14} />
              </button>

              <div className="pr-8 ">
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
                      Apply Discount
                    </h2>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Transaction {transaction?.transaction_id || "-"} • Date{" "}
                      {dateFrom || "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-3 overflow-y-auto flex-1 min-h-0">
              {hadExistingDiscountBreakdown ? (
                <div
                  className={`rounded-[1rem] border px-3 py-3 ${
                    showOverrideWarning
                      ? isDark
                        ? "border-amber-400/40 bg-amber-500/10"
                        : "border-amber-300 bg-amber-50"
                      : isDark
                        ? "border-blue-400/30 bg-blue-500/10"
                        : "border-blue-200 bg-blue-50"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`mt-0.5 ${
                        showOverrideWarning ? "text-amber-500" : "text-blue-500"
                      }`}
                    >
                      <FiAlertTriangle size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-black">
                        {showOverrideWarning
                          ? "Editing will override previous billing discount breakdown"
                          : "Previous billing discount breakdown loaded"}
                      </p>
                      <p className="mt-1 text-[12px] text-slate-500">
                        {showOverrideWarning
                          ? "This transaction already has an active discount breakdown. Printing billing again with your changes will replace the previous active breakdown for this transaction."
                          : "This modal loaded the existing active discount breakdown from billing for this transaction. You may review it or edit it if needed."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className={`rounded-[1rem] p-3 ${cardClass}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FiPackage size={14} className="text-slate-500" />
                    <div>
                      <h3 className="text-sm font-black">
                        Ordered Items Summary
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        View the full item summary in a separate modal.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowItemsModal(true)}
                    disabled={isPrinting}
                    className={`inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-all hover:bg-blue-500 ${
                      isPrinting ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <FiEye size={14} />
                    View Ordered Items
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.9fr]">
                <div className={`rounded-[1rem] p-3 ${cardClass}`}>
                  <div className="mb-3 flex items-center gap-2">
                    <FiFileText size={14} className="text-slate-500" />
                    <h3 className="text-sm font-black">Discount Setup</h3>
                    <span
                      className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                      style={{
                        backgroundColor: discountMode === "PerProduct" ? "rgba(234,179,8,0.15)" : "rgba(99,102,241,0.15)",
                        color: discountMode === "PerProduct" ? "#ca8a04" : "#6366f1",
                      }}
                    >
                      {discountMode === "PerProduct" ? "Per Product" : "Per Customer"}
                    </span>
                  </div>

                  <div
                    className={`rounded-[0.95rem] p-3 mb-3 ${innerCardClass}`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <FiUsers size={14} className="text-slate-500" />
                      <h3 className="text-sm font-black">Customer Details</h3>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Total Customers
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={customerCount}
                          onChange={(e) => setCustomerCount(e.target.value)}
                          onFocus={handleSelectAllOnFocus}
                          onBlur={() => {
                            const normalized =
                              customerCount === "" || Number(customerCount) < 1
                                ? 1
                                : Number(customerCount);
                            setCustomerCount(normalized);
                          }}
                          disabled={isPrinting}
                          className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${inputClass} ${
                            isPrinting ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                        />
                      </div>

                      <div
                        className={`rounded-lg px-3 py-2 ${
                          isDark
                            ? "bg-slate-900/60 border border-white/5 text-slate-300"
                            : "bg-white border border-slate-200 text-slate-600"
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
                    {discountMode === "PerProduct" && <div className="mt-3">
                      <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Discount Sharing
                      </label>
                      <div className={`flex overflow-hidden rounded-lg border text-[10px] font-black uppercase tracking-[0.14em] ${isDark ? "border-white/10" : "border-slate-200"}`}>
                        <button
                          type="button"
                          disabled={isPrinting}
                          onClick={() => setDiscountSharingMode("solo")}
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
                          disabled={isPrinting}
                          onClick={() => setDiscountSharingMode("shared")}
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

                    <p className="mt-2 text-xs font-semibold text-red-500 min-h-[18px]">
                      {qualifiedPrompt}
                    </p>

                    {customerInfoEnabled ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerInfoSavedMessage("");
                            setShowCustomerInfoModal(true);
                          }}
                          disabled={isPrinting || isSavingCustomerInfo}
                          className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-bold text-white transition-all hover:bg-blue-500 ${
                            isPrinting || isSavingCustomerInfo
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          <FiUsers size={14} />
                          Customer Info
                        </button>

                        <p className="mt-2 text-xs font-semibold text-emerald-500 min-h-[18px]">
                          {customerInfoSavedMessage}
                        </p>
                      </>
                    ) : null}
                  </div>

                  {discountMode === "PerProduct" && (() => {
                    const discountableItems = items.filter((item) =>
                      yesNoToBool(item.isDiscountable),
                    );
                    const allSelected = discountableItems.every((item) => {
                      const k = String(item.ID);
                      const q = Number(item.sales_quantity || 0);
                      return Number(selectedProductIds[k] ?? q) >= q;
                    });
                    const noneSelected = discountableItems.every(
                      (item) => Number(selectedProductIds[String(item.ID)] ?? 0) === 0,
                    );
                    return (
                      <div className={`rounded-[0.95rem] p-3 mb-3 ${innerCardClass}`}>
                        <div className="mb-2 flex items-center gap-2">
                          <FiShoppingCart size={14} className="text-slate-500" />
                          <h3 className="text-sm font-black">Products for Discount</h3>
                          <div className="ml-auto flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const next = {};
                                discountableItems.forEach((item) => {
                                  next[String(item.ID)] = Number(item.sales_quantity || 0);
                                });
                                setSelectedProductIds((prev) => ({ ...prev, ...next }));
                              }}
                              className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-wider transition-colors ${
                                allSelected
                                  ? "opacity-40 cursor-default"
                                  : isDark
                                    ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                                    : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                              }`}
                              disabled={allSelected}
                            >
                              All
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const next = {};
                                discountableItems.forEach((item) => {
                                  next[String(item.ID)] = 0;
                                });
                                setSelectedProductIds((prev) => ({ ...prev, ...next }));
                              }}
                              className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-wider transition-colors ${
                                noneSelected
                                  ? "opacity-40 cursor-default"
                                  : isDark
                                    ? "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25"
                                    : "bg-rose-50 text-rose-600 hover:bg-rose-100"
                              }`}
                              disabled={noneSelected}
                            >
                              None
                            </button>
                          </div>
                        </div>

                        {discountableItems.length === 0 ? (
                          <p className="text-xs text-slate-500 py-2">No discountable items in this transaction.</p>
                        ) : (
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {discountableItems.map((item) => {
                              const itemKey = String(item.ID);
                              const maxQty = Number(item.sales_quantity || 0);
                              const price = Number(item.selling_price || 0);
                              const discQty = Math.min(Math.max(Number(selectedProductIds[itemKey] ?? maxQty), 0), maxQty);
                              const isOn = discQty > 0;
                              const discLineTotal = price * discQty;
                              return (
                                <div
                                  key={itemKey}
                                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors ${
                                    isOn
                                      ? isDark
                                        ? "bg-emerald-500/10"
                                        : "bg-emerald-50"
                                      : isDark
                                        ? "bg-slate-900/40 opacity-50"
                                        : "bg-slate-100 opacity-50"
                                  }`}
                                >
                                  {/* Checkbox toggle */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedProductIds((prev) => ({
                                        ...prev,
                                        [itemKey]: isOn ? 0 : maxQty,
                                      }))
                                    }
                                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                                      isOn
                                        ? "border-emerald-500 bg-emerald-500"
                                        : isDark
                                          ? "border-slate-600 bg-transparent"
                                          : "border-slate-300 bg-white"
                                    }`}
                                  >
                                    {isOn && <FiCheck size={10} className="text-white" />}
                                  </button>

                                  {/* Item name */}
                                  <span className={`flex-1 font-semibold truncate ${isOn ? "" : "line-through"}`}>
                                    {item.item_name || item.product_id || `Item #${itemKey}`}
                                  </span>

                                  {/* Qty stepper (only when maxQty >= 2) */}
                                  {maxQty >= 2 ? (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSelectedProductIds((prev) => ({
                                            ...prev,
                                            [itemKey]: Math.max(discQty - 1, 0),
                                          }))
                                        }
                                        disabled={discQty === 0}
                                        className={`flex h-5 w-5 items-center justify-center rounded font-black text-[11px] disabled:opacity-30 transition-colors ${
                                          isDark ? "bg-slate-700 hover:bg-slate-600" : "bg-slate-200 hover:bg-slate-300"
                                        }`}
                                      >
                                        −
                                      </button>
                                      <span className={`w-8 text-center font-black tabular-nums text-[11px] ${isOn ? "text-emerald-600" : "text-slate-400"}`}>
                                        {discQty}/{maxQty}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSelectedProductIds((prev) => ({
                                            ...prev,
                                            [itemKey]: Math.min(discQty + 1, maxQty),
                                          }))
                                        }
                                        disabled={discQty === maxQty}
                                        className={`flex h-5 w-5 items-center justify-center rounded font-black text-[11px] disabled:opacity-30 transition-colors ${
                                          isDark ? "bg-slate-700 hover:bg-slate-600" : "bg-slate-200 hover:bg-slate-300"
                                        }`}
                                      >
                                        +
                                      </button>
                                    </div>
                                  ) : (
                                    <span className={`flex-shrink-0 font-bold ${isOn ? "text-emerald-600" : "text-slate-400"}`}>
                                      ×{maxQty}
                                    </span>
                                  )}

                                  {/* Line total based on discounted qty */}
                                  <span className={`flex-shrink-0 font-bold tabular-nums w-16 text-right ${isOn ? "" : "text-slate-400"}`}>
                                    ₱{peso(discLineTotal)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className={`mt-2 flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-black ${
                          isDark ? "bg-slate-900/60" : "bg-white border border-slate-200"
                        }`}>
                          <span className="text-slate-500">Selected Total</span>
                          <span>₱{peso(computed.selectedDiscountableGross)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 gap-3">
                    {DISCOUNT_META.map((meta) => (
                      <DiscountEntryCard
                        key={meta.key}
                        meta={meta}
                        values={discountState[meta.key]}
                        isDark={isDark}
                        inputClass={`${inputClass} ${
                          isPrinting ? "opacity-60 cursor-not-allowed" : ""
                        }`}
                        cardClass={innerCardClass}
                        onChangeCount={handleChangeCount}
                        onChangeManualAmount={handleChangeManualAmount}
                        onChangeManualPercent={handleChangeManualPercent}
                        manualBaseAmount={computed.discountableGross}
                        discountMode={discountMode}
                      />
                    ))}
                  </div>
                </div>

                <div className={`rounded-[1rem] p-3 ${cardClass}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <FiTag size={14} className="text-slate-500" />
                    <h3 className="text-sm font-black">Computation Summary</h3>
                    <span
                      className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                      style={{
                        backgroundColor: computed.discountMode === "PerProduct" ? "rgba(234,179,8,0.15)" : "rgba(99,102,241,0.15)",
                        color: computed.discountMode === "PerProduct" ? "#ca8a04" : "#6366f1",
                      }}
                    >
                      {computed.discountMode === "PerProduct" ? "Per Product" : "Per Customer"}
                    </span>
                  </div>

                  <div className="space-y-2 text-[13px]">
                    <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                      <span className="text-slate-500">Disc. Gross</span>
                      <span className="font-semibold">
                        ₱ {peso(computed.discountMode === "PerProduct" ? computed.selectedDiscountableGross : computed.discountableGross)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                      <span className="text-slate-500">Disc. Base</span>
                      <span className="font-semibold">
                        ₱ {peso(computed.discountMode === "PerProduct" ? computed.selectedDiscountableBase : computed.discountableBase)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                      <span className="text-slate-500">
                        Statutory Qualified
                      </span>
                      <span className="font-semibold">
                        {computed.statutoryQualifiedCount} /{" "}
                        {computed.safeCustomerCount}
                      </span>
                    </div>

                    {computed.discountBreakdown.map((entry) => {
                      const hasValue =
                        Number(entry.qualifiedCount || 0) > 0 ||
                        Number(entry.discountAmount || 0) > 0;

                      if (!hasValue) return null;

                      return (
                        <div
                          key={`summary-${entry.key}`}
                          className="rounded-lg bg-emerald-500/10 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[12px] font-bold">
                              {entry.label}
                            </span>
                            <span className="text-[13px] font-black text-emerald-500">
                              ₱ {peso(entry.discountAmount)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span>Count: {entry.qualifiedCount}</span>
                            <span>
                              VAT Exempt: ₱ {peso(entry.vatExemption)}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {computed.isDiscountCeilingApplied ? (
                      <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-600">
                        Discount ceiling applied. Original discount was{" "}
                        <span className="font-black">
                          PHP {peso(computed.rawTotalDiscount)}
                        </span>
                        , capped at{" "}
                        <span className="font-black">
                          PHP {peso(discountCeilingAmount)}
                        </span>
                        .
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                      <span className="text-slate-500">Total Discount</span>
                      <span className="font-semibold text-emerald-500">
                        ₱ {peso(computed.totalDiscount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                      <span className="text-slate-500">
                        Total VAT Exemption
                      </span>
                      <span className="font-semibold text-violet-500">
                        ₱ {peso(computed.totalVatExemption)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                      <span className="text-slate-500">Gross Total</span>
                      <span className="font-semibold">
                        ₱ {peso(computed.grossTotal)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                      <span className="text-slate-500">Net of VAT</span>
                      <span className="font-semibold">
                        ₱ {peso(computed.netOfVat)}
                      </span>
                    </div>

                    {serviceChargeEnabled && serviceCharges
                      .filter((c) => Boolean(c.is_enabled))
                      .map((c) => {
                        const id      = Number(c.ID);
                        const isOn    = chargeToggles[id] !== false;
                        const applied = computed.appliedCharges?.find((a) => a.id === id);
                        return (
                          <div key={id} className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setChargeToggles((prev) => ({ ...prev, [id]: !isOn }))
                                }
                                className={`flex-shrink-0 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wide transition ${
                                  isOn
                                    ? "bg-emerald-500/15 text-emerald-500"
                                    : "bg-slate-200/60 text-slate-400 dark:bg-slate-700/60"
                                }`}
                              >
                                {isOn ? "ON" : "OFF"}
                              </button>
                              <span className={isOn ? "text-slate-500" : "text-slate-400 line-through"}>
                                {c.particulars}
                                {c.rate_type === "Percentage" ? ` (${Number(c.amount)}%)` : ""}
                              </span>
                            </div>
                            <span className={`font-semibold ${isOn ? "" : "text-slate-400"}`}>
                              ₱ {peso(isOn && applied ? applied.computedAmount : 0)}
                            </span>
                          </div>
                        );
                      })
                    }

                    <div className="flex items-center justify-between gap-2 rounded-lg bg-blue-500/10 px-3 py-2.5">
                      <span className="text-sm font-black">
                        Amount Due
                      </span>
                      <span className="text-base font-black text-blue-500">
                        ₱ {peso(computed.totalAmountDue)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`rounded-[0.95rem] p-3 ${innerCardClass}`}>
                <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Printer
                </label>
                <select
                  value={printerName}
                  onChange={(e) => setPrinterName(e.target.value)}
                  disabled={isPrinting}
                  className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${inputClass} ${
                    isPrinting ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  <option value="">Default Printer</option>
                  {printers.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.displayName || printer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <ButtonComponent
                  onClick={onClose}
                  isLoading={false}
                  disabled={isPrinting}
                  loadingText="Cancel..."
                  variant="secondary"
                  icon={<FiX size={14} />}
                >
                  Cancel
                </ButtonComponent>

                <ButtonComponent
                  onClick={handleNativePrint}
                  isLoading={isPrinting}
                  disabled={isPrintDisabled}
                  loadingText="Printing Billing..."
                  variant="primary"
                  icon={<FiPrinter size={14} />}
                >
                  Print Billing
                </ButtonComponent>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <OrderedItemsSummaryModal
        isOpen={showItemsModal}
        onClose={() => setShowItemsModal(false)}
        items={items}
        isLoading={isLoading}
        errorMessage={errorMessage}
        computed={computed}
        isDark={isDark}
      />

      <CustomerInfoModal
        isOpen={customerInfoEnabled && showCustomerInfoModal}
        onClose={() => setShowCustomerInfoModal(false)}
        isDark={isDark}
        customerCount={customerCount}
        setCustomerCount={setCustomerCount}
        totalQualified={computed.totalQualifiedAll}
        customerCards={customerCards}
        setCustomerCards={setCustomerCards}
        onSave={handleSaveCustomerInfo}
        isSaving={isSavingCustomerInfo}
        readOnly={isPrinting}
      />
    </>
  );
};

export default ModalDiscountTransaction;
