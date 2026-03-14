import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReactToPrint } from "react-to-print";
import {
  FiX,
  FiPrinter,
  FiPercent,
  FiUsers,
  FiCreditCard,
} from "react-icons/fi";

const peso = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const ModalDiscountTransaction = ({
  isOpen,
  onClose,
  transaction,
  dateFrom,
  apiHost,
  isDark,
}) => {
  const componentRef = useRef(null);

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [discountType, setDiscountType] = useState("Senior Citizen Discount");
  const [customerCount, setCustomerCount] = useState(1);
  const [qualifiedCount, setQualifiedCount] = useState(1);
  const [manualDiscount, setManualDiscount] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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
      .catch((err) => {
        console.error(err);
        setErrorMessage("Failed to load transaction items.");
        setItems([]);
        setIsLoading(false);
      });
  }, [isOpen, apiHost, transaction]);

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
        sum +
        Number(item.sales_quantity || 0) * Number(item.selling_price || 0)
      );
    }, 0);

    const netAfterDiscount = grossTotal - computedDiscount;

    return {
      discountableGross,
      discountableBase,
      proratedBase,
      computedDiscount,
      grossTotal,
      netAfterDiscount,
      safeCustomerCount,
      safeQualifiedCount,
    };
  }, [items, discountType, customerCount, qualifiedCount, manualDiscount]);

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: `${transaction?.transaction_id || "discount"}-discount`,
    pageStyle: `
      @media print {
        @page { size: 80mm auto; margin: 0; }
        html, body {
          background: #ffffff !important;
          color: #000000 !important;
          font-family: monospace;
          font-size: 12px;
          margin: 0;
          padding: 0;
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 2px 0; vertical-align: top; }
        hr { margin: 4px 0; border: 1px dashed #000; }
      }
    `,
  });

  return (
    <>
      <AnimatePresence>
        <motion.div
          className={`fixed inset-0 z-[100000] flex items-center justify-center p-4 backdrop-blur-md ${
            isDark ? "bg-slate-950/80" : "bg-slate-200/70"
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 20 }}
            className={`rounded-[2.2rem] shadow-2xl max-w-4xl w-full overflow-hidden ${
              isDark
                ? "bg-slate-900 border border-white/10"
                : "bg-white border border-slate-200"
            }`}
          >
            <div
              className={`relative p-6 ${
                isDark
                  ? "border-b border-white/5 bg-white/5"
                  : "border-b border-slate-200 bg-slate-50"
              }`}
            >
              <button
                onClick={onClose}
                className={`absolute right-6 top-6 p-2 rounded-full transition-all ${
                  isDark
                    ? "bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400"
                    : "bg-slate-100 hover:bg-red-100 hover:text-red-500 text-slate-500"
                }`}
              >
                <FiX size={20} />
              </button>

              <h2
                className={`text-2xl font-black tracking-tight ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Apply Discount
              </h2>

              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                Transaction {transaction?.transaction_id} • Date {dateFrom}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
              <div className="space-y-4">
                <div
                  className={`rounded-2xl p-4 ${
                    isDark
                      ? "bg-slate-950/40 border border-white/5"
                      : "bg-slate-50 border border-slate-200"
                  }`}
                >
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-3 block">
                    Discount Type
                  </label>

                  <div className="grid grid-cols-1 gap-2">
                    {[
                      "Senior Citizen Discount",
                      "PWD Discount",
                      "Manual Discount",
                    ].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setDiscountType(type)}
                        className={`w-full rounded-2xl px-4 py-3 text-left font-bold transition-all ${
                          discountType === type
                            ? "bg-blue-600 text-white"
                            : isDark
                              ? "bg-slate-800/70 text-slate-300 hover:bg-slate-800"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {(discountType === "Senior Citizen Discount" ||
                  discountType === "PWD Discount") && (
                  <div
                    className={`rounded-2xl p-4 ${
                      isDark
                        ? "bg-slate-950/40 border border-white/5"
                        : "bg-slate-50 border border-slate-200"
                    }`}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2 block">
                          <FiUsers className="inline mr-2" />
                          Customers
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={customerCount}
                          onChange={(e) => setCustomerCount(e.target.value)}
                          className={`w-full rounded-2xl px-4 py-3 ${
                            isDark
                              ? "bg-slate-900/70 border border-slate-800 text-white"
                              : "bg-white border border-slate-200 text-slate-900"
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2 block">
                          <FiCreditCard className="inline mr-2" />
                          Qualified
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={customerCount}
                          value={qualifiedCount}
                          onChange={(e) => setQualifiedCount(e.target.value)}
                          className={`w-full rounded-2xl px-4 py-3 ${
                            isDark
                              ? "bg-slate-900/70 border border-slate-800 text-white"
                              : "bg-white border border-slate-200 text-slate-900"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {discountType === "Manual Discount" && (
                  <div
                    className={`rounded-2xl p-4 ${
                      isDark
                        ? "bg-slate-950/40 border border-white/5"
                        : "bg-slate-50 border border-slate-200"
                    }`}
                  >
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2 block">
                      <FiPercent className="inline mr-2" />
                      Manual Discount Amount
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={manualDiscount}
                      onChange={(e) => setManualDiscount(e.target.value)}
                      className={`w-full rounded-2xl px-4 py-3 ${
                        isDark
                          ? "bg-slate-900/70 border border-slate-800 text-white"
                          : "bg-white border border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>
                )}

                <div
                  className={`rounded-2xl p-4 ${
                    isDark
                      ? "bg-slate-950/40 border border-white/5"
                      : "bg-slate-50 border border-slate-200"
                  }`}
                >
                  <h3
                    className={`font-black mb-3 ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Computation Summary
                  </h3>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Discountable Gross</span>
                      <span className={isDark ? "text-white" : "text-slate-900"}>
                        ₱ {peso(computed.discountableGross)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">
                        Discountable Base
                      </span>
                      <span className={isDark ? "text-white" : "text-slate-900"}>
                        ₱ {peso(computed.discountableBase)}
                      </span>
                    </div>

                    {(discountType === "Senior Citizen Discount" ||
                      discountType === "PWD Discount") && (
                      <>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">Qualified Ratio</span>
                          <span
                            className={isDark ? "text-white" : "text-slate-900"}
                          >
                            {computed.safeQualifiedCount} /{" "}
                            {computed.safeCustomerCount}
                          </span>
                        </div>

                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">Prorated Base</span>
                          <span
                            className={isDark ? "text-white" : "text-slate-900"}
                          >
                            ₱ {peso(computed.proratedBase)}
                          </span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between gap-4 font-black">
                      <span className="text-slate-500">{discountType}</span>
                      <span className="text-emerald-500">
                        ₱ {peso(computed.computedDiscount)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Gross Total</span>
                      <span className={isDark ? "text-white" : "text-slate-900"}>
                        ₱ {peso(computed.grossTotal)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4 font-black text-base pt-2">
                      <span className="text-slate-500">Net After Discount</span>
                      <span className="text-blue-500">
                        ₱ {peso(computed.netAfterDiscount)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className={`flex-1 rounded-2xl px-5 py-4 ${
                      isDark
                        ? "bg-slate-800 text-slate-300 hover:text-white"
                        : "bg-slate-200 text-slate-700 hover:text-slate-900"
                    }`}
                  >
                    Cancel
                  </button>

                  <button
                    onClick={() => handlePrint?.()}
                    className="flex-1 rounded-2xl px-5 py-4 bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all flex items-center justify-center gap-2"
                  >
                    <FiPrinter size={16} />
                    Print Discount
                  </button>
                </div>
              </div>

              <div
                className={`rounded-2xl p-4 ${
                  isDark
                    ? "bg-slate-950/40 border border-white/5"
                    : "bg-slate-50 border border-slate-200"
                }`}
              >
                <h3
                  className={`font-black mb-4 ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  Ordered Items
                </h3>

                {isLoading ? (
                  <p className="text-slate-500 italic">
                    Loading transaction items...
                  </p>
                ) : errorMessage ? (
                  <p className="text-red-500 italic">{errorMessage}</p>
                ) : items.length === 0 ? (
                  <p className="text-slate-500 italic">No ordered items found.</p>
                ) : (
                  <div className="max-h-[480px] overflow-y-auto space-y-2 pr-1">
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
                          className={`rounded-2xl p-3 border ${
                            isDark
                              ? "bg-slate-900/60 border-white/5"
                              : "bg-white border-slate-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p
                                className={`font-semibold ${
                                  isDark ? "text-white" : "text-slate-900"
                                }`}
                              >
                                {item.item_name || item.product_id}
                              </p>
                              <p className="text-xs text-slate-500">
                                Qty {qty} × ₱ {peso(price)}
                              </p>
                            </div>

                            <div className="text-right">
                              <p
                                className={`font-bold ${
                                  isDark ? "text-white" : "text-slate-900"
                                }`}
                              >
                                ₱ {peso(lineTotal)}
                              </p>
                              <div className="flex gap-2 justify-end mt-1 flex-wrap">
                                <span
                                  className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                                    isDiscountable
                                      ? "bg-emerald-500/10 text-emerald-500"
                                      : "bg-slate-500/10 text-slate-500"
                                  }`}
                                >
                                  {isDiscountable
                                    ? "Discountable"
                                    : "Non-discountable"}
                                </span>

                                <span
                                  className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                                    isVatable
                                      ? "bg-blue-500/10 text-blue-500"
                                      : "bg-amber-500/10 text-amber-500"
                                  }`}
                                >
                                  {isVatable ? "Vatable" : "Non-VAT"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <div style={{ display: "none" }}>
        <div ref={componentRef}>
          <div
            style={{
              width: "80mm",
              padding: "8px",
              fontFamily: "monospace",
              fontSize: "12px",
              color: "#000",
              background: "#fff",
            }}
          >
            <div style={{ textAlign: "center", fontWeight: "bold" }}>
              DISCOUNT COMPUTATION
            </div>
            <div style={{ textAlign: "center", marginBottom: "8px" }}>
              Transaction: {transaction?.transaction_id}
            </div>
            <div>Date: {dateFrom}</div>
            <div>Discount Type: {discountType}</div>
            <hr />

            {discountType !== "Manual Discount" && (
              <>
                <div>Total Customers: {computed.safeCustomerCount}</div>
                <div>Qualified Customers: {computed.safeQualifiedCount}</div>
                <hr />
              </>
            )}

            <div>Discountable Gross: ₱ {peso(computed.discountableGross)}</div>
            <div>Discountable Base: ₱ {peso(computed.discountableBase)}</div>

            {discountType !== "Manual Discount" && (
              <div>Prorated Base: ₱ {peso(computed.proratedBase)}</div>
            )}

            <div>{discountType}: ₱ {peso(computed.computedDiscount)}</div>
            <hr />
            <div>Gross Total: ₱ {peso(computed.grossTotal)}</div>
            <div style={{ fontWeight: "bold" }}>
              Net After Discount: ₱ {peso(computed.netAfterDiscount)}
            </div>

            <hr />
            <div style={{ fontWeight: "bold" }}>DISCOUNTABLE ITEMS</div>
            {items.map((item, index) => {
              const qty = Number(item.sales_quantity || 0);
              const price = Number(item.selling_price || 0);
              const lineTotal = qty * price;
              return (
                <div key={item.ID || index} style={{ marginBottom: "4px" }}>
                  <div>{item.item_name || item.product_id}</div>
                  <div>
                    {qty} x {peso(price)} = {peso(lineTotal)}
                  </div>
                  <div>
                    Disc: {item.isDiscountable} | VAT: {item.vatable}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalDiscountTransaction;