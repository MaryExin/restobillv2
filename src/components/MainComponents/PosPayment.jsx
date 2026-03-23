import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { FixedSizeList as List } from "react-window";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiX,
  FiSearch,
  FiEye,
  FiTag,
  FiCreditCard,
  FiRefreshCw,
  FiPrinter,
  FiDatabase,
} from "react-icons/fi";
import { FaMoneyBill, FaArrowLeft } from "react-icons/fa";
import { useTheme } from "../../context/ThemeContext";
import useApiHost from "../../hooks/useApiHost";
import { useNavigate } from "react-router-dom";
import TransactionPaymentModal from "./TransactionPaymentModal";

const peso = (value) =>
  `₱ ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const toNum = (value) => Number(value || 0);

const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

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

const TABLE_COLUMN_TEMPLATE = "210px 200px 120px 140px 180px 170px 170px 190px";
const TABLE_MIN_WIDTH = 1380;
const ROW_HEIGHT = 76;
const LIST_HEIGHT = 560;

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

function StatCard({ title, value, icon: Icon, isDark, tone = "blue" }) {
  const toneClasses = {
    blue: isDark ? "bg-blue-500/10 text-blue-300" : "bg-blue-50 text-blue-600",
    green: isDark
      ? "bg-emerald-500/10 text-emerald-300"
      : "bg-emerald-50 text-emerald-600",
    yellow: isDark
      ? "bg-amber-500/10 text-amber-300"
      : "bg-amber-50 text-amber-600",
    slate: isDark
      ? "bg-slate-800 text-slate-300"
      : "bg-slate-100 text-slate-600",
  };

  return (
    <div
      className={`rounded-[24px] border p-5 ${
        isDark
          ? "border-white/5 bg-white/[0.03]"
          : "border-slate-200 bg-white shadow-sm"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          {title}
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
            toneClasses[tone]
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

function SummaryPanel({ isDark, viewMode, summary }) {
  return (
    <div
      className={`rounded-[28px] border p-5 lg:sticky lg:top-6 ${
        isDark
          ? "border-white/5 bg-white/[0.03]"
          : "border-slate-200 bg-white shadow-sm"
      }`}
    >
      <div className="mb-5">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-500">
          Summary
        </div>
        <h2
          className={`mt-2 text-2xl font-black ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          {viewMode === "paid" ? "Paid Overview" : "Pending Overview"}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Quick totals and payment setup information.
        </p>
      </div>

      <div className="space-y-4">
        <StatCard
          title={
            viewMode === "paid" ? "Paid Transactions" : "Pending Transactions"
          }
          value={summary.totalTransactions}
          icon={FiDatabase}
          isDark={isDark}
          tone={viewMode === "paid" ? "green" : "yellow"}
        />

        <StatCard
          title={viewMode === "paid" ? "Paid Amount" : "Pending Sales"}
          value={peso(summary.totalSales)}
          icon={FaMoneyBill}
          isDark={isDark}
          tone={viewMode === "paid" ? "green" : "yellow"}
        />

        <StatCard
          title="Payment Methods"
          value={summary.totalMethods}
          icon={FiCreditCard}
          isDark={isDark}
          tone="blue"
        />

        <StatCard
          title="Charge Options"
          value={summary.totalCharges}
          icon={FaMoneyBill}
          isDark={isDark}
          tone="slate"
        />
      </div>

      <div
        className={`mt-5 rounded-[22px] border p-4 ${
          isDark
            ? "border-white/5 bg-slate-950/50"
            : "border-slate-200 bg-slate-50"
        }`}
      >
        <div
          className={`mb-3 text-xs font-black uppercase tracking-[0.18em] ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          Legend
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="h-3.5 w-3.5 rounded-full bg-emerald-500" />
            <span className="text-slate-500">Paid Transactions</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-3.5 w-3.5 rounded-full bg-amber-500" />
            <span className="text-slate-500">Pending for Payment</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-3.5 w-3.5 rounded-full bg-red-500" />
            <span className="text-slate-500">Void Action</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-3.5 w-3.5 rounded-full bg-yellow-500" />
            <span className="text-slate-500">Refund Action</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderRow({ isDark, mode }) {
  const headers = [
    "Actions",
    "Transaction ID",
    "Table",
    "Order Type",
    "Transaction Date",
    mode === "paid" ? "Amount Due / Paid" : "Total Sales",
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
      style={{ gridTemplateColumns: TABLE_COLUMN_TEMPLATE }}
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

function ActionRemarksModal({
  isOpen,
  onClose,
  onSubmit,
  remarks,
  setRemarks,
  isDark,
  actionType,
  activeRow,
  isSubmitting,
}) {
  const title =
    actionType === "refund" ? "Refund Transaction" : "Void Transaction";
  const buttonClass =
    actionType === "refund"
      ? "bg-yellow-500 hover:bg-yellow-400 text-white"
      : "bg-red-600 hover:bg-red-500 text-white";

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={!isSubmitting ? onClose : undefined}
      isDark={isDark}
      maxWidth="max-w-[620px]"
      zIndex="z-[110000]"
    >
      <div className="p-6 md:p-7">
        <div className="pr-14">
          <div
            className={`text-xs font-black uppercase tracking-[0.18em] ${
              actionType === "refund" ? "text-yellow-500" : "text-red-500"
            }`}
          >
            {title}
          </div>
          <h3
            className={`mt-2 text-2xl font-black ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            {activeRow?.transaction_id || "-"}
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Please enter remarks before continuing.
          </p>
        </div>

        <div
          className={`mt-5 rounded-[22px] border p-4 text-sm ${
            isDark
              ? "border-white/5 bg-slate-950/50"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Transaction ID
              </div>
              <div className="mt-1 font-bold">
                {activeRow?.transaction_id || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Invoice No
              </div>
              <div className="mt-1 font-bold">
                {activeRow?.invoice_no || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Table
              </div>
              <div className="mt-1 font-bold">
                {activeRow?.table_number || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Amount
              </div>
              <div className="mt-1 font-bold">
                {peso(
                  actionType === "refund"
                    ? activeRow?.TotalAmountDue ||
                        activeRow?.payment_amount ||
                        0
                    : activeRow?.TotalSales || 0,
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <label
            className={`mb-2 block text-sm font-bold ${
              isDark ? "text-slate-200" : "text-slate-700"
            }`}
          >
            Remarks
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={5}
            placeholder={
              actionType === "refund"
                ? "Enter refund remarks..."
                : "Enter void remarks..."
            }
            className={`w-full resize-none rounded-[22px] border px-4 py-4 outline-none transition ${
              isDark
                ? "border-slate-700 bg-slate-950 text-white placeholder:text-slate-500 focus:border-blue-500"
                : "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-blue-400"
            }`}
          />
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={`rounded-2xl px-5 py-3 font-bold transition ${
              isDark
                ? "bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-60"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-60"
            }`}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className={`rounded-2xl px-5 py-3 font-bold transition disabled:opacity-60 ${buttonClass}`}
          >
            {isSubmitting
              ? actionType === "refund"
                ? "Processing Refund..."
                : "Processing Void..."
              : title}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function TransactionRow({ index, style, data }) {
  const row = data.rows[index];
  const isDark = data.isDark;
  const onOpen = data.onOpen;
  const onVoid = data.onVoid;
  const onRefund = data.onRefund;
  const mode = data.mode;

  const remarksText =
    row.remarks || (mode === "paid" ? "Paid" : "Pending for Payment");

  const normalizedRemarks = normalizeText(remarksText);
  const isPaid = normalizedRemarks.includes("paid");
  const isPending = normalizedRemarks.includes("pending");

  return (
    <div style={style}>
      <div
        className={`grid border-b transition ${
          isDark
            ? "border-white/5 hover:bg-white/[0.03]"
            : "border-slate-100 hover:bg-slate-50"
        }`}
        style={{ gridTemplateColumns: TABLE_COLUMN_TEMPLATE }}
      >
        <div className="flex items-center gap-2 px-5 py-4">
          <button
            type="button"
            onClick={() => onOpen(row)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white transition hover:bg-blue-500"
            title={
              mode === "paid" ? "Review / Print Duplicate" : "Open Payment"
            }
          >
            {mode === "paid" ? <FiPrinter size={17} /> : <FiEye size={17} />}
          </button>

          {mode === "pending" ? (
            <button
              type="button"
              onClick={() => onVoid(row)}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-500"
              title="Void Transaction"
            >
              Void
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onRefund(row)}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-yellow-500 px-4 text-sm font-bold text-white transition hover:bg-yellow-400"
              title="Refund Transaction"
            >
              Refund
            </button>
          )}
        </div>

        <div className="px-5 py-4">
          <div className="font-black">{row.transaction_id || "-"}</div>
          <div className="mt-1 text-xs text-slate-500">
            {row.invoice_no ? `Invoice # ${row.invoice_no}` : "No invoice yet"}
          </div>
        </div>

        <div className="whitespace-nowrap px-5 py-4">
          {row.table_number || "-"}
        </div>

        <div className="whitespace-nowrap px-5 py-4">
          {row.order_type || "-"}
        </div>

        <div className="whitespace-nowrap px-5 py-4">
          {row.transaction_date || "-"}
        </div>

        <div className="whitespace-nowrap px-5 py-4 text-right font-black">
          {mode === "paid"
            ? peso(row.TotalAmountDue || row.payment_amount || 0)
            : peso(row.TotalSales)}
        </div>

        <div className="whitespace-nowrap px-5 py-4">{row.cashier || "-"}</div>

        <div className="flex items-center px-5 py-4">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isPaid
                ? "bg-emerald-500/10 text-emerald-500"
                : isPending
                  ? "bg-amber-500/10 text-amber-500"
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

export default function PosPayment() {
  const apiHost = useApiHost();
  const themeContext = useTheme();
  const isDark =
    typeof themeContext?.isDark === "boolean"
      ? themeContext.isDark
      : themeContext?.theme === "dark";

  const navigate = useNavigate();
  const remarksInputRef = useRef(null);

  const [viewMode, setViewMode] = useState("pending");
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [paidTransactions, setPaidTransactions] = useState([]);
  const [modeOfPayments, setModeOfPayments] = useState([]);
  const [chargeOptions, setChargeOptions] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState("");
  const [activeRow, setActiveRow] = useState(null);
  const [actionRemarks, setActionRemarks] = useState("");

  const fetchAll = useCallback(async () => {
    if (!apiHost) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const [pendingRes, paidRes, mopRes, chargesRes] =
        await Promise.allSettled([
          fetch(`${apiHost}/api/pos_payment_read_pending.php`),
          fetch(`${apiHost}/api/pos_payment_read_paid.php`),
          fetch(`${apiHost}/api/pos_payment_read_mode_of_payment.php`),
          fetch(`${apiHost}/api/pos_payment_read_other_charges.php`),
        ]);

      if (pendingRes.status !== "fulfilled") {
        throw new Error("Failed to load pending transactions.");
      }

      const pendingData = await safeReadJson(
        pendingRes.value,
        "Pending transactions API",
      );

      if (!pendingRes.value.ok || !pendingData?.success) {
        throw new Error(
          pendingData?.message || "Failed to load pending transactions.",
        );
      }

      setPendingTransactions(
        Array.isArray(pendingData?.transactions)
          ? pendingData.transactions
          : [],
      );

      if (paidRes.status === "fulfilled") {
        try {
          const paidData = await safeReadJson(
            paidRes.value,
            "Paid transactions API",
          );
          if (paidRes.value.ok && paidData?.success) {
            setPaidTransactions(
              Array.isArray(paidData?.transactions)
                ? paidData.transactions
                : [],
            );
          } else {
            setPaidTransactions([]);
          }
        } catch (error) {
          console.error(error);
          setPaidTransactions([]);
        }
      } else {
        setPaidTransactions([]);
      }

      if (mopRes.status === "fulfilled") {
        const mopData = await safeReadJson(mopRes.value, "Mode of payment API");
        if (!mopRes.value.ok || !mopData?.success) {
          throw new Error(
            mopData?.message || "Failed to load mode of payments.",
          );
        }
        setModeOfPayments(Array.isArray(mopData?.modes) ? mopData.modes : []);
      }

      if (chargesRes.status === "fulfilled") {
        const chargesData = await safeReadJson(
          chargesRes.value,
          "Other charges API",
        );
        if (!chargesRes.value.ok || !chargesData?.success) {
          throw new Error(
            chargesData?.message || "Failed to load other charges.",
          );
        }
        setChargeOptions(
          Array.isArray(chargesData?.charges) ? chargesData.charges : [],
        );
      }
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

  useEffect(() => {
    if (isActionModalOpen && remarksInputRef.current) {
      remarksInputRef.current.focus();
    }
  }, [isActionModalOpen]);

  const closeActionModal = useCallback(() => {
    if (isActionLoading) return;
    setIsActionModalOpen(false);
    setActionType("");
    setActiveRow(null);
    setActionRemarks("");
  }, [isActionLoading]);

  const openVoidModal = useCallback((row) => {
    setActionType("void");
    setActiveRow(row);
    setActionRemarks("");
    setIsActionModalOpen(true);
  }, []);

  const openRefundModal = useCallback((row) => {
    setActionType("refund");
    setActiveRow(row);
    setActionRemarks("");
    setIsActionModalOpen(true);
  }, []);

  const submitAction = useCallback(async () => {
    if (!apiHost || !activeRow?.transaction_id || !actionType) return;

    const trimmedRemarks = actionRemarks.trim();
    if (!trimmedRemarks) {
      window.alert(
        actionType === "refund"
          ? "Please enter refund remarks."
          : "Please enter void remarks.",
      );
      return;
    }

    setIsActionLoading(true);
    setErrorMessage("");

    try {
      const endpoint =
        actionType === "refund"
          ? `${apiHost}/api/pos_payment_refund.php`
          : `${apiHost}/api/pos_payment_void.php`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction_id: activeRow.transaction_id,
          invoice_no: activeRow.invoice_no || "",
          table_number: activeRow.table_number || "",
          amount_due: activeRow.TotalAmountDue || activeRow.payment_amount || 0,
          remarks: trimmedRemarks,
          category_code: activeRow.Category_Code || "",
          unit_code: activeRow.Unit_Code || "",
          user_id:
            localStorage.getItem("userid") ||
            localStorage.getItem("user_id") ||
            "",
        }),
      });

      const result = await safeReadJson(
        response,
        actionType === "refund"
          ? "Refund transaction API"
          : "Void transaction API",
      );

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message ||
            (actionType === "refund"
              ? "Failed to refund transaction."
              : "Failed to void transaction."),
        );
      }

      closeActionModal();
      await fetchAll();

      window.alert(
        result?.message ||
          (actionType === "refund"
            ? "Transaction refunded successfully."
            : "Transaction voided successfully."),
      );
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error.message ||
          (actionType === "refund"
            ? "Failed to refund transaction."
            : "Failed to void transaction."),
      );
    } finally {
      setIsActionLoading(false);
    }
  }, [
    apiHost,
    activeRow,
    actionType,
    actionRemarks,
    closeActionModal,
    fetchAll,
  ]);

  const sourceTransactions = useMemo(
    () => (viewMode === "paid" ? paidTransactions : pendingTransactions),
    [viewMode, paidTransactions, pendingTransactions],
  );

  const filteredTransactions = useMemo(() => {
    const searchValue = normalizeText(search);
    if (!searchValue) return sourceTransactions;

    return sourceTransactions.filter((row) => {
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
  }, [sourceTransactions, search]);

  const summary = useMemo(() => {
    return {
      totalTransactions: filteredTransactions.length,
      totalSales: filteredTransactions.reduce(
        (sum, row) =>
          sum +
          toNum(viewMode === "paid" ? row.TotalAmountDue : row.TotalSales),
        0,
      ),
      totalMethods: modeOfPayments.length,
      totalCharges: chargeOptions.length,
    };
  }, [filteredTransactions, modeOfPayments, chargeOptions, viewMode]);

  const listData = useMemo(
    () => ({
      rows: filteredTransactions,
      isDark,
      mode: viewMode,
      onOpen: (row) => {
        setSelectedTransaction(row);
        setIsPaymentModalOpen(true);
      },
      onVoid: openVoidModal,
      onRefund: openRefundModal,
    }),
    [filteredTransactions, isDark, viewMode, openVoidModal, openRefundModal],
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
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
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
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <button
              onClick={() => navigate("/poscorehomescreen")}
              className={`inline-flex items-center gap-3 rounded-2xl border px-5 py-3 font-semibold transition ${
                isDark
                  ? "border-white/5 bg-white/[0.03] text-slate-300 hover:text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:text-slate-900 shadow-sm"
              }`}
            >
              <FaArrowLeft size={14} />
              Back
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
              {viewMode === "paid"
                ? "Paid Transactions"
                : "Pending for Payment"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Review billed transactions, open payment posting, reprint
              duplicate invoice copies, void pending transactions, and refund
              paid transactions.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <div
                className={`rounded-[28px] border p-4 sm:p-5 ${
                  isDark
                    ? "border-white/5 bg-white/[0.03]"
                    : "border-slate-200 bg-white shadow-sm"
                }`}
              >
                <div className="flex flex-col items-start gap-4">
                  <div className="flex flex-wrap justify-start gap-3">
                    <button
                      type="button"
                      onClick={() => setViewMode("pending")}
                      className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                        viewMode === "pending"
                          ? "bg-amber-500 text-gray-100"
                          : isDark
                            ? "border border-slate-700 bg-slate-900 text-slate-300"
                            : "border border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      Pending
                    </button>

                    <button
                      type="button"
                      onClick={() => setViewMode("paid")}
                      className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                        viewMode === "paid"
                          ? "bg-emerald-600 text-gray-100"
                          : isDark
                            ? "border border-slate-700 bg-slate-900 text-slate-300"
                            : "border border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      Paid
                    </button>
                  </div>

                  <div className="grid w-full grid-cols-1 gap-3 lg:grid-cols-[1fr_150px]">
                    <div className="relative">
                      <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
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
                      disabled={isLoading || isActionLoading}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                    >
                      <FiRefreshCw size={16} />
                      Refresh
                    </button>
                  </div>
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
                    Loading transactions...
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
                    <div style={{ minWidth: TABLE_MIN_WIDTH }}>
                      <HeaderRow isDark={isDark} mode={viewMode} />
                      <List
                        height={LIST_HEIGHT}
                        itemCount={filteredTransactions.length}
                        itemSize={ROW_HEIGHT}
                        width={TABLE_MIN_WIDTH}
                        itemData={listData}
                        overscanCount={8}
                        outerElementType={ListOuter}
                        innerElementType={ListInner}
                      >
                        {TransactionRow}
                      </List>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <SummaryPanel
              isDark={isDark}
              viewMode={viewMode}
              summary={summary}
            />
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
        mode={viewMode}
        onSaved={fetchAll}
      />

      <ActionRemarksModal
        isOpen={isActionModalOpen}
        onClose={closeActionModal}
        onSubmit={submitAction}
        remarks={actionRemarks}
        setRemarks={setActionRemarks}
        isDark={isDark}
        actionType={actionType}
        activeRow={activeRow}
        isSubmitting={isActionLoading}
      />
    </>
  );
}
