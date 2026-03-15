import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReactToPrint } from "react-to-print";
import {
  FiX,
  FiPrinter,
  FiPercent,
  FiUsers,
  FiFileText,
  FiTag,
  FiPackage,
  FiEye,
} from "react-icons/fi";

const peso = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const PrintableDiscountReceipt = React.forwardRef(
  (
    { transaction, dateFrom, discountType, computed, items, isManualDiscount },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className="print-root"
        style={{
          width: "80mm",
          minHeight: "100vh",
          background: "#ffffff",
          color: "#000000",
          padding: "16px",
          fontFamily: "monospace",
          fontSize: "12px",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <h2
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              textTransform: "uppercase",
              textDecoration: "underline",
              margin: 0,
            }}
          >
            Discount Summary
          </h2>
          <p style={{ fontWeight: "bold", fontSize: "14px", margin: "4px 0" }}>
            Transaction: {transaction?.transaction_id || "-"}
          </p>
          <p style={{ margin: 0 }}>{dateFrom || "-"}</p>
          <div
            style={{
              borderBottom: "1px dashed #000",
              margin: "10px 0",
            }}
          />
        </div>

        <div style={{ marginBottom: "12px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "4px",
            }}
          >
            <span>Discount Type</span>
            <span style={{ fontWeight: "bold", textAlign: "right" }}>
              {discountType}
            </span>
          </div>

          {!isManualDiscount && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "4px",
                }}
              >
                <span>Total Customers</span>
                <span>{computed.safeCustomerCount}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "4px",
                }}
              >
                <span>Qualified Customers</span>
                <span>{computed.safeQualifiedCount}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "4px",
                }}
              >
                <span>Qualified Ratio</span>
                <span>
                  {computed.safeQualifiedCount}/{computed.safeCustomerCount}
                </span>
              </div>
            </>
          )}
        </div>

        <div
          style={{
            borderTop: "1px dashed #000",
            borderBottom: "1px dashed #000",
            padding: "8px 0",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "4px",
            }}
          >
            <span>Discountable Gross</span>
            <span>₱{peso(computed.discountableGross)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "4px",
            }}
          >
            <span>Discountable Base</span>
            <span>₱{peso(computed.discountableBase)}</span>
          </div>

          {!isManualDiscount && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "4px",
              }}
            >
              <span>Prorated Base</span>
              <span>₱{peso(computed.proratedBase)}</span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "4px",
              fontWeight: "bold",
            }}
          >
            <span>{discountType}</span>
            <span>₱{peso(computed.computedDiscount)}</span>
          </div>
        </div>

        <div
          style={{
            borderTop: "2px solid #000",
            paddingTop: "8px",
            marginBottom: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "4px",
            }}
          >
            <span>Gross Total</span>
            <span>₱{peso(computed.grossTotal)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: "900",
              fontSize: "13px",
            }}
          >
            <span>NET AFTER DISCOUNT</span>
            <span>₱{peso(computed.netAfterDiscount)}</span>
          </div>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <p
            style={{
              fontWeight: "bold",
              textTransform: "uppercase",
              fontSize: "10px",
              marginBottom: "8px",
            }}
          >
            Ordered Items
          </p>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #000", fontSize: "10px" }}>
                <th style={{ textAlign: "left", padding: "4px 0" }}>Item</th>
                <th style={{ textAlign: "center", padding: "4px 0" }}>Qty</th>
                <th style={{ textAlign: "right", padding: "4px 0" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const qty = Number(item.sales_quantity || 0);
                const price = Number(item.selling_price || 0);
                const lineTotal = qty * price;

                return (
                  <tr key={item.ID || index}>
                    <td style={{ padding: "5px 0", verticalAlign: "top" }}>
                      <div style={{ fontWeight: "bold" }}>
                        {item.item_name || item.product_id}
                      </div>
                      <div style={{ fontSize: "9px" }}>
                        Disc: {item.isDiscountable || "No"} | VAT:{" "}
                        {item.vatable || "No"}
                      </div>
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        padding: "5px 0",
                        verticalAlign: "top",
                      }}
                    >
                      {qty}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "5px 0",
                        verticalAlign: "top",
                      }}
                    >
                      ₱{peso(lineTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  },
);

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

  const cardClass = isDark
    ? "bg-slate-950/40 border border-white/5"
    : "bg-slate-50 border border-slate-200";

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

                    const isDiscountable =
                      String(item.isDiscountable || "")
                        .trim()
                        .toLowerCase() === "yes";

                    const isVatable =
                      String(item.vatable || "")
                        .trim()
                        .toLowerCase() === "yes";

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

const ModalDiscountTransaction = ({
  isOpen,
  onClose,
  transaction,
  dateFrom,
  apiHost,
  isDark,
}) => {
  const printRef = useRef(null);

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [discountType, setDiscountType] = useState("Senior Citizen Discount");
  const [customerCount, setCustomerCount] = useState(1);
  const [qualifiedCount, setQualifiedCount] = useState(1);
  const [manualDiscount, setManualDiscount] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showItemsModal, setShowItemsModal] = useState(false);

  const safeCustomerCount = Math.max(Number(customerCount) || 1, 1);
  const safeQualifiedCount = Math.max(
    Math.min(Number(qualifiedCount) || 0, safeCustomerCount),
    0,
  );

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
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setItems(Array.isArray(data?.items) ? data.items : []);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setErrorMessage("Failed to load transaction items.");
        setItems([]);
        setIsLoading(false);
      });
  }, [isOpen, apiHost, transaction]);

  const isManualDiscount = discountType === "Manual Discount";

  const computed = useMemo(() => {
    const safeCustomerCount = Math.max(Number(customerCount) || 1, 1);
    const safeQualifiedCount = Math.max(
      Math.min(Number(qualifiedCount) || 0, safeCustomerCount),
      0,
    );

    let discountableGross = 0;
    let discountableBase = 0;

    items.forEach((item) => {
      const isDiscountable =
        String(item.isDiscountable || "")
          .trim()
          .toLowerCase() === "yes";
      const isVatable =
        String(item.vatable || "")
          .trim()
          .toLowerCase() === "yes";

      const qty = Number(item.sales_quantity || 0);
      const price = Number(item.selling_price || 0);
      const lineTotal = qty * price;

      if (isDiscountable) {
        discountableGross += lineTotal;
        discountableBase += isVatable ? lineTotal / 1.12 : lineTotal;
      }
    });

    const proratedBase =
      safeCustomerCount > 0
        ? discountableBase * (safeQualifiedCount / safeCustomerCount)
        : 0;

    let computedDiscount = 0;

    if (
      discountType === "Senior Citizen Discount" ||
      discountType === "PWD Discount"
    ) {
      computedDiscount = proratedBase * 0.2;
    } else {
      computedDiscount = Number(manualDiscount || 0);
    }

    const grossTotal = items.reduce((sum, item) => {
      return (
        sum + Number(item.sales_quantity || 0) * Number(item.selling_price || 0)
      );
    }, 0);

    const totalQuantity = items.reduce((sum, item) => {
      return sum + Number(item.sales_quantity || 0);
    }, 0);

    const discountableItemsCount = items.filter(
      (item) =>
        String(item.isDiscountable || "")
          .trim()
          .toLowerCase() === "yes",
    ).length;

    const netAfterDiscount = grossTotal - computedDiscount;

    return {
      discountableGross,
      discountableBase,
      proratedBase,
      computedDiscount,
      grossTotal,
      totalQuantity,
      discountableItemsCount,
      netAfterDiscount,
      safeCustomerCount,
      safeQualifiedCount,
    };
  }, [items, discountType, customerCount, qualifiedCount, manualDiscount]);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `${transaction?.transaction_id || "discount"}-discount`,
    pageStyle: `
      @media print {
        @page {
          size: 80mm auto;
          margin: 0;
        }

        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          font-family: monospace !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .print-root {
          width: 80mm !important;
          min-height: auto !important;
        }
      }
    `,
  });

  const containerClass = isDark
    ? "bg-slate-900 border border-white/10 text-white"
    : "bg-white border border-slate-200 text-slate-900";

  const cardClass = isDark
    ? "bg-slate-950/40 border border-white/5"
    : "bg-slate-50 border border-slate-200";

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
            className={`w-full max-w-[820px] overflow-hidden rounded-[1rem] shadow-2xl ${containerClass}`}
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

            <div className="space-y-3 p-3">
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
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-all hover:bg-blue-500"
                  >
                    <FiEye size={14} />
                    View Ordered Items
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className={`rounded-[1rem] p-3 ${cardClass}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <FiFileText size={14} className="text-slate-500" />
                    <h3 className="text-sm font-black">Discount Setup</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {[
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
                        <FiPercent size={14} className="text-slate-500" />
                      ) : (
                        <FiUsers size={14} className="text-slate-500" />
                      )}
                      <h3 className="text-sm font-black">
                        {isManualDiscount
                          ? "Manual Discount"
                          : "Qualified Details"}
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
                            onFocus={() => {
                              if (customerCount === 1) setCustomerCount("");
                            }}
                            onChange={(e) => setCustomerCount(e.target.value)}
                            onBlur={() => {
                              if (
                                customerCount === "" ||
                                Number(customerCount) < 1
                              ) {
                                setCustomerCount(1);
                              }
                            }}
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
                            onFocus={() => {
                              if (qualifiedCount === 1) setQualifiedCount("");
                            }}
                            onChange={(e) => setQualifiedCount(e.target.value)}
                            onBlur={() => {
                              if (qualifiedCount === "") {
                                setQualifiedCount(1);
                              } else if (Number(qualifiedCount) < 0) {
                                setQualifiedCount(0);
                              } else if (
                                Number(qualifiedCount) >
                                Number(customerCount || 1)
                              ) {
                                setQualifiedCount(customerCount || 1);
                              }
                            }}
                            className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${inputClass}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`rounded-[1rem] p-3 ${cardClass}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <FiTag size={14} className="text-slate-500" />
                    <h3 className="text-sm font-black">Computation Summary</h3>
                  </div>

                  <div className="space-y-2 text-[13px]">
                    <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                      <span className="text-slate-500">Disc. Gross</span>
                      <span className="font-semibold">
                        ₱ {peso(computed.discountableGross)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                      <span className="text-slate-500">Disc. Base</span>
                      <span className="font-semibold">
                        ₱ {peso(computed.discountableBase)}
                      </span>
                    </div>

                    {!isManualDiscount && (
                      <>
                        <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                          <span className="text-slate-500">Ratio</span>
                          <span className="font-semibold">
                            {computed.safeQualifiedCount} /{" "}
                            {computed.safeCustomerCount}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                          <span className="text-slate-500">Prorated</span>
                          <span className="font-semibold">
                            ₱ {peso(computed.proratedBase)}
                          </span>
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-500/10 px-3 py-2">
                      <span className="text-[12px] font-bold">
                        {discountType}
                      </span>
                      <span className="text-[13px] font-black text-emerald-500">
                        ₱ {peso(computed.computedDiscount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-b border-dashed border-slate-300/20 pb-2">
                      <span className="text-slate-500">Gross Total</span>
                      <span className="font-semibold">
                        ₱ {peso(computed.grossTotal)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded-lg bg-blue-500/10 px-3 py-2.5">
                      <span className="text-sm font-black">
                        Net After Discount
                      </span>
                      <span className="text-base font-black text-blue-500">
                        ₱ {peso(computed.netAfterDiscount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={onClose}
                  className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                    isDark
                      ? "bg-slate-800 text-slate-300 hover:text-white"
                      : "bg-slate-200 text-slate-700 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>

                <button
                  onClick={() => handlePrint?.()}
                  className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-blue-500"
                >
                  <FiPrinter size={14} />
                  Print Discount
                </button>
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

      <div style={{ display: "none" }}>
        <PrintableDiscountReceipt
          ref={printRef}
          transaction={transaction}
          dateFrom={dateFrom}
          discountType={discountType}
          computed={computed}
          items={items}
          isManualDiscount={isManualDiscount}
        />
      </div>
    </>
  );
};

export default ModalDiscountTransaction;
