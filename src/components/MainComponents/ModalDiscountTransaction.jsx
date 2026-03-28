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
} from "react-icons/fi";
import ButtonComponent from "./Common/ButtonComponent";
import { BuildPrintableDiscountReceiptHtml } from "../../utils/buildPrintableDiscountReceiptHtml";
import useGetDefaultPrinter from "../../hooks/useGetDefaultPrinter";

const peso = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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
  manual: { qualifiedCount: 0, manualAmount: "" },
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

const DiscountEntryCard = ({
  meta,
  values,
  isDark,
  inputClass,
  cardClass,
  onChangeCount,
  onChangeManualAmount,
}) => {
  const accentClass =
    meta.color === "emerald"
      ? "text-emerald-500"
      : meta.color === "violet"
        ? "text-violet-500"
        : "text-amber-500";

  return (
    <div className={`rounded-[0.95rem] p-3 ${cardClass}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-black">{meta.label}</h4>
          <p className={`text-[11px] ${accentClass}`}>
            {meta.needsAmount
              ? "Enter count and direct amount."
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
          <div>
            <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
              Manual Amount
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={values.manualAmount}
              onChange={(e) => onChangeManualAmount(meta.key, e.target.value)}
              onFocus={handleSelectAllOnFocus}
              className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${inputClass}`}
              placeholder="0.00"
            />
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
            <p className="mt-1 font-semibold">20% of prorated base</p>
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

  const [printerName, setPrinterName] = useState("");
  const [printers, setPrinters] = useState([]);

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [customerCount, setCustomerCount] = useState(1);
  const [discountState, setDiscountState] = useState(buildInitialDiscountState);
  const [errorMessage, setErrorMessage] = useState("");
  const [showItemsModal, setShowItemsModal] = useState(false);
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
      },
    }));
  };

  const resetForm = () => {
    setCustomerCount(1);
    setQualifiedPrompt("");
    setDiscountState(buildInitialDiscountState());
    setExistingDiscountLoaded(false);
    setHadExistingDiscountBreakdown(false);
    setInitialLoadedSignature("");
    setShowOverrideWarning(false);
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
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        const nextItems = Array.isArray(data?.items) ? data.items : [];
        const txn = data?.transaction_summary || {};
        const discountCounts = data?.discount_counts || {
          senior: 0,
          pwd: 0,
          manual: 0,
        };
        const discountRows = Array.isArray(data?.discount_rows)
          ? data.discount_rows
          : [];

        setItems(nextItems);

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
          manual: {
            qualifiedCount: Number(discountCounts.manual || 0),
            manualAmount: discountRows
              .filter((row) =>
                String(row.discount_type || "")
                  .toLowerCase()
                  .includes("manual"),
              )
              .reduce((sum, row) => sum + Number(row.discount_amount || 0), 0),
          },
        };

        setCustomerCount(nextCustomerCount);
        setDiscountState(nextDiscountState);

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
        manual: {
          qualifiedCount: Number(discountState?.manual?.qualifiedCount || 0),
          manualAmount: Number(discountState?.manual?.manualAmount || 0),
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

    const totalQualifiedAll = rawSeniorCount + rawPwdCount + rawManualCount;
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

    items.forEach((item) => {
      const isDiscountable = yesNoToBool(item.isDiscountable);
      const isVatable = yesNoToBool(item.vatable);
      const qty = Number(item.sales_quantity || 0);
      const price = Number(item.selling_price || 0);
      const lineTotal = qty * price;

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
        key: "manual",
        label: "Manual Discount",
        shortLabel: "Manual",
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
      grossTotal,
      totalQuantity,
      discountableItemsCount,
      netAfterDiscount,
      safeCustomerCount,
      vatableSales,
      vatableSalesVat,
      vatExemptSales: finalVatExemptSales,
      rawVatExemptSales: vatExemptSales,
      vatZeroRatedSales,
      totalDiscount,
      totalVatExemption,
      totalQualifiedAll,
      statutoryQualifiedCount,
      statutoryQualifiedRatio,
      discountBreakdown,
      discountTypeSummary,
    };
  }, [items, customerCount, discountState]);

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
    const manualNum = Math.max(
      Math.floor(Number(nextState?.manual?.qualifiedCount || 0)),
      0,
    );

    const totalQualified = seniorNum + pwdNum + manualNum;

    if (totalNum > 0 && totalQualified > totalNum) {
      setQualifiedPrompt(
        "Total qualified across Senior, PWD, and Manual should not be more than total customers.",
      );
      return false;
    }

    if (manualNum > 0 && Number(nextState?.manual?.manualAmount || 0) <= 0) {
      setQualifiedPrompt(
        "Manual Discount amount is required when Manual qualified count is greater than zero.",
      );
      return false;
    }

    setQualifiedPrompt("");
    return true;
  };

  useEffect(() => {
    validateQualifiedCounts(customerCount, discountState);
  }, [customerCount, discountState]);

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

      customer_exclusive_id: transaction?.customer_exclusive_id || "",
      customer_head_count: Number(customerCount || 1),
      customer_count_for_discount: Number(computed?.totalQualifiedAll || 0),
      discount_type: computed?.discountTypeSummary || "",

      TotalSales: Number(computed?.grossTotal || 0),
      Discount: Number(computed?.totalDiscount || 0),
      OtherCharges: Number(transaction?.OtherCharges || 0),
      TotalAmountDue: Number(computed?.netAfterDiscount || 0),

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

      const html = BuildPrintableDiscountReceiptHtml({
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
        scale: 1,
      });

      const result = await window.electronAPI.printReceipt({
        html,
        printerName,
        silent: true,
        copies: 1,
      });

      console.log("Print result:", result);

      if (!result?.success) {
        throw new Error(result?.message || "Print failed.");
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

                    <p className="mt-2 text-xs font-semibold text-red-500 min-h-[18px]">
                      {qualifiedPrompt}
                    </p>
                  </div>

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
                      />
                    ))}
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
    </>
  );
};

export default ModalDiscountTransaction;
