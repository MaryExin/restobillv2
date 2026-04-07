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
  FiLock,
  FiEyeOff,
  FiChevronDown,
} from "react-icons/fi";
import { FaMoneyBill, FaArrowLeft } from "react-icons/fa";
import { useTheme } from "../../context/ThemeContext";
import useApiHost from "../../hooks/useApiHost";
import { useNavigate } from "react-router-dom";
import TransactionPaymentModal from "./TransactionPaymentModal";
import ModalSuccessNavToSelf from "../Modals/ModalSuccessNavToSelf";
import ButtonComponent from "./Common/ButtonComponent";
import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import { MdWarning } from "react-icons/md";

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

const InlineFailureModal = ({
  isOpen,
  header = "Action Failed",
  message = "Something went wrong.",
  button = "OK",
  setIsModalOpen,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[120000] flex items-center justify-center bg-black/50 px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="w-11/12 max-w-md overflow-hidden rounded-md border-t-8 border-red-500 bg-white shadow-lg"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
        >
          <div className="flex flex-col items-center p-6">
            <motion.div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-[#fee2e2]"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
            >
              <MdWarning className="h-8 w-8 text-red-500" />
            </motion.div>

            <h2 className="mb-2 text-2xl font-semibold text-gray-800">
              {header}
            </h2>
            <p className="mb-6 text-center text-gray-600">{message}</p>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsModalOpen(false)}
              className="rounded-md bg-red-500 px-6 py-2 text-white shadow-md transition hover:bg-red-600"
            >
              {button}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
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
    red: isDark ? "bg-red-500/10 text-red-300" : "bg-red-50 text-red-600",
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
  const titleMap = {
    pending: "Pending Overview",
    paid: "Paid Overview",
    voided: "Voided Overview",
    refunded: "Refunded Overview",
  };

  const countMap = {
    pending: "Pending Transactions",
    paid: "Paid Transactions",
    voided: "Voided Transactions",
    refunded: "Refunded Transactions",
  };

  const amountMap = {
    pending: "Pending Sales",
    paid: "Paid Amount",
    voided: "Voided Amount",
    refunded: "Refunded Amount",
  };

  const toneMap = {
    pending: "yellow",
    paid: "green",
    voided: "red",
    refunded: "blue",
  };

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
          {titleMap[viewMode]}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Quick totals and payment setup information.
        </p>
      </div>

      <div className="space-y-4">
        <StatCard
          title={countMap[viewMode]}
          value={summary.totalTransactions}
          icon={FiDatabase}
          isDark={isDark}
          tone={toneMap[viewMode]}
        />

        <StatCard
          title={amountMap[viewMode]}
          value={peso(summary.totalSales)}
          icon={FaMoneyBill}
          isDark={isDark}
          tone={toneMap[viewMode]}
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
            <span className="text-slate-500">Voided Transactions</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-3.5 w-3.5 rounded-full bg-blue-500" />
            <span className="text-slate-500">Refunded Transactions</span>
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
    mode === "pending" ? "Total Sales" : "Amount",
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
  adminPassword,
  setAdminPassword,
  selectedAdminId,
  setSelectedAdminId,
  adminAccounts,
  isLoadingAdmins,
  isDark,
  actionType,
  activeRow,
  isSubmitting,
  remarksInputRef,
}) {
  const [isYesNoModalOpen, setIsYesNoModalOpen] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

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
              <div className="mt-1">{activeRow?.transaction_id || "-"}</div>
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
                        activeRow?.TotalSales ||
                        0
                    : activeRow?.TotalSales ||
                        activeRow?.TotalAmountDue ||
                        activeRow?.payment_amount ||
                        0,
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
            ref={remarksInputRef}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
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

        <div className="mt-5">
          <label
            className={`mb-2 block text-sm font-bold ${
              isDark ? "text-slate-200" : "text-slate-700"
            }`}
          >
            Select Admin
          </label>
          <div className="relative">
            <select
              value={selectedAdminId}
              onChange={(e) => setSelectedAdminId(e.target.value)}
              disabled={isSubmitting || isLoadingAdmins}
              className={`w-full appearance-none rounded-[22px] border px-4 py-4 pr-12 text-sm outline-none transition ${
                isDark
                  ? "border-slate-700 bg-slate-950 text-white focus:border-blue-500"
                  : "border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-400"
              } ${isSubmitting || isLoadingAdmins ? "opacity-70" : ""}`}
            >
              <option value="">
                {isLoadingAdmins
                  ? "Loading admins..."
                  : adminAccounts.length > 0
                    ? "Select admin to authorize"
                    : "No admin accounts found"}
              </option>
              {adminAccounts.map((admin) => (
                <option
                  key={admin.id || admin.uuid || admin.username || admin.email}
                  value={
                    admin.id || admin.uuid || admin.username || admin.email
                  }
                >
                  {admin.name || admin.username || admin.email}{" "}
                  {admin.userRole ? `(${admin.userRole})` : ""}
                </option>
              ))}
            </select>
            <FiChevronDown
              size={18}
              className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            />
          </div>
        </div>

        <div className="mt-5">
          <label
            className={`mb-2 block text-sm font-bold ${
              isDark ? "text-slate-200" : "text-slate-700"
            }`}
          >
            Admin Password
          </label>
          <div
            className={`flex items-center gap-3 rounded-[22px] border px-4 py-3 transition ${
              isDark
                ? "border-slate-700 bg-slate-950 focus-within:border-blue-500"
                : "border-slate-200 bg-slate-50 focus-within:border-blue-400"
            }`}
          >
            <FiLock
              size={18}
              className={isDark ? "text-slate-400" : "text-slate-500"}
            />
            <input
              type={showAdminPassword ? "text" : "password"}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!isSubmitting) setIsYesNoModalOpen(true);
                }
              }}
              placeholder="Enter admin password to continue"
              className={`w-full bg-transparent text-sm outline-none ${
                isDark
                  ? "text-white placeholder:text-slate-500"
                  : "text-slate-900 placeholder:text-slate-400"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowAdminPassword((prev) => !prev)}
              className={`flex h-10 w-10 items-center justify-center rounded-2xl transition ${
                isDark
                  ? "bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                  : "bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}
              title={showAdminPassword ? "Hide password" : "Show password"}
            >
              {showAdminPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <ButtonComponent
            onClick={() => setIsYesNoModalOpen(true)}
            isLoading={isSubmitting}
            loadingText={
              isSubmitting
                ? actionType === "refund"
                  ? "Processing Refund..."
                  : "Processing Void..."
                : ""
            }
            className={buttonClass}
          >
            {isSubmitting
              ? actionType === "refund"
                ? "Processing Refund..."
                : "Processing Void..."
              : title}
          </ButtonComponent>
        </div>
      </div>
      {isYesNoModalOpen && (
        <ModalYesNoReusable
          header="Submit Confirmation"
          message={`Are you sure you want to Submit this ${actionType === "refund" ? "refund" : "void"}?`}
          setYesNoModalOpen={setIsYesNoModalOpen}
          triggerYesNoEvent={() => {
            setIsYesNoModalOpen(false);
            onSubmit();
          }}
          isLoading={isSubmitting}
        />
      )}
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
    row.remarks ||
    row.void_remarks ||
    row.refund_remarks ||
    (mode === "paid"
      ? "Paid"
      : mode === "pending"
        ? "Pending for Payment"
        : mode === "voided"
          ? "Voided"
          : "Refunded");

  const normalizedRemarks = normalizeText(remarksText);
  const isPaid = normalizedRemarks.includes("paid");
  const isPending = normalizedRemarks.includes("pending");
  const isVoided =
    normalizedRemarks.includes("void") ||
    normalizeText(row.status).includes("void");
  const isRefunded =
    normalizedRemarks.includes("refund") ||
    normalizeText(row.status).includes("refund");

  const viewTitle =
    mode === "paid"
      ? "Review / Print Duplicate"
      : mode === "pending"
        ? "Open Payment"
        : "View Transaction";

  const amount =
    mode === "pending"
      ? row.TotalSales
      : row.TotalAmountDue || row.payment_amount || row.TotalSales || 0;

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
            title={viewTitle}
          >
            {mode === "paid" ? <FiPrinter size={17} /> : <FiEye size={17} />}
          </button>

          {mode === "pending" ? (
            <button
              type="button"
              onClick={() => onVoid(row)}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-red-600 px-4 text-sm font-bold text-gray-100 transition hover:bg-red-500"
              title="Void Transaction"
            >
              Void
            </button>
          ) : mode === "paid" ? (
            <button
              type="button"
              onClick={() => onRefund(row)}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-yellow-500 px-4 text-sm font-bold text-white transition hover:bg-yellow-400"
              title="Refund Transaction"
            >
              Refund
            </button>
          ) : (
            <span
              className={`inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-bold ${
                mode === "voided"
                  ? "bg-red-500/10 text-red-500"
                  : "bg-blue-500/10 text-blue-500"
              }`}
            >
              View Only
            </span>
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
          {peso(amount)}
        </div>

        <div className="whitespace-nowrap px-5 py-4">{row.cashier || "-"}</div>

        <div className="flex items-center px-5 py-4">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isVoided
                ? "bg-red-500/10 text-red-500"
                : isRefunded
                  ? "bg-blue-500/10 text-blue-500"
                  : isPaid
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
  const [voidedTransactions, setVoidedTransactions] = useState([]);
  const [refundedTransactions, setRefundedTransactions] = useState([]);
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
  const [adminPassword, setAdminPassword] = useState("");
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [adminAccounts, setAdminAccounts] = useState([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false);

  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successHeader, setSuccessHeader] = useState("Saved Successfully");
  const [successMessage, setSuccessMessage] = useState(
    "Your changes have been saved.",
  );
  const [isFailureModalOpen, setIsFailureModalOpen] = useState(false);
  const [failureHeader, setFailureHeader] = useState("Action Failed");
  const [failureMessage, setFailureMessage] = useState("Something went wrong.");

  const fetchAll = useCallback(async () => {
    if (!apiHost) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const [pendingRes, paidRes, voidedRes, refundedRes, mopRes, chargesRes] =
        await Promise.allSettled([
          fetch(`${apiHost}/api/pos_payment_read_pending.php`),
          fetch(`${apiHost}/api/pos_payment_read_paid.php`),
          fetch(`${apiHost}/api/pos_payment_read_voided.php`),
          fetch(`${apiHost}/api/pos_payment_read_refunded.php`),
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

      if (voidedRes.status === "fulfilled") {
        try {
          const voidedData = await safeReadJson(
            voidedRes.value,
            "Voided transactions API",
          );
          if (voidedRes.value.ok && voidedData?.success) {
            setVoidedTransactions(
              Array.isArray(voidedData?.transactions)
                ? voidedData.transactions
                : [],
            );
          } else {
            setVoidedTransactions([]);
          }
        } catch (error) {
          console.error(error);
          setVoidedTransactions([]);
        }
      } else {
        setVoidedTransactions([]);
      }

      if (refundedRes.status === "fulfilled") {
        try {
          const refundedData = await safeReadJson(
            refundedRes.value,
            "Refunded transactions API",
          );
          if (refundedRes.value.ok && refundedData?.success) {
            setRefundedTransactions(
              Array.isArray(refundedData?.transactions)
                ? refundedData.transactions
                : [],
            );
          } else {
            setRefundedTransactions([]);
          }
        } catch (error) {
          console.error(error);
          setRefundedTransactions([]);
        }
      } else {
        setRefundedTransactions([]);
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

  const fetchShiftAdmins = useCallback(async () => {
    if (!apiHost) {
      setAdminAccounts([]);
      return;
    }

    const currentUserId =
      localStorage.getItem("userid") ||
      localStorage.getItem("user_id") ||
      localStorage.getItem("id") ||
      "";

    if (!currentUserId) {
      setAdminAccounts([]);
      return;
    }

    setIsLoadingAdmins(true);

    try {
      const response = await fetch(
        `${apiHost}/api/get_shift_details.php?user_id=${encodeURIComponent(currentUserId)}`,
      );
      const result = await safeReadJson(response, "Shift details API");

      if (!response.ok) {
        throw new Error(result?.message || "Failed to load shift details.");
      }

      const accounts = Array.isArray(result?.accounts) ? result.accounts : [];
      const admins = accounts.filter((account) => {
        const role = String(account?.userRole || "").toUpperCase();
        return role.includes("ADMIN");
      });

      setAdminAccounts(admins);
    } catch (error) {
      console.error("Failed to load admin accounts:", error);
      setAdminAccounts([]);
    } finally {
      setIsLoadingAdmins(false);
    }
  }, [apiHost]);

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
    setAdminPassword("");
    setSelectedAdminId("");
  }, [isActionLoading]);

  const openVoidModal = useCallback(
    (row) => {
      setActionType("void");
      setActiveRow(row);
      setActionRemarks("");
      setAdminPassword("");
      setSelectedAdminId("");
      setIsActionModalOpen(true);
      fetchShiftAdmins();
    },
    [fetchShiftAdmins],
  );

  const openRefundModal = useCallback(
    (row) => {
      setActionType("refund");
      setActiveRow(row);
      setActionRemarks("");
      setAdminPassword("");
      setSelectedAdminId("");
      setIsActionModalOpen(true);
      fetchShiftAdmins();
    },
    [fetchShiftAdmins],
  );

  const submitAction = useCallback(async () => {
    if (!apiHost) {
      setErrorMessage("API host is not configured.");
      return;
    }

    if (!activeRow?.transaction_id) {
      setErrorMessage("Transaction ID is missing.");
      return;
    }

    if (!actionType) {
      setErrorMessage("Please select an action first.");
      return;
    }

    const trimmedRemarks = String(actionRemarks || "").trim();
    const trimmedAdminPassword = String(adminPassword || "").trim();
    const trimmedSelectedAdminId = String(selectedAdminId || "").trim();

    if (!trimmedRemarks) {
      setFailureHeader("Missing Remarks");
      setFailureMessage(
        actionType === "refund"
          ? "Please enter refund remarks."
          : "Please enter void remarks.",
      );
      setIsFailureModalOpen(true);
      return;
    }

    if (!trimmedSelectedAdminId) {
      setFailureHeader("Admin Selection Required");
      setFailureMessage("Please select an admin account first.");
      setIsFailureModalOpen(true);
      return;
    }

    if (!trimmedAdminPassword) {
      setFailureHeader("Admin Password Required");
      setFailureMessage("Please enter admin password to continue.");
      setIsFailureModalOpen(true);
      return;
    }

    const userId =
      localStorage.getItem("userid") ||
      localStorage.getItem("user_id") ||
      localStorage.getItem("id") ||
      "";

    const userName = localStorage.getItem("Cashier") || "Store Crew";

    const selectedAdmin = adminAccounts.find(
      (admin) =>
        String(admin.id || admin.uuid || admin.username || admin.email) ===
        trimmedSelectedAdminId,
    );

    const payload = {
      transaction_id: String(activeRow.transaction_id || "").trim(),
      invoice_no: String(activeRow.invoice_no || "").trim(),
      table_number: String(activeRow.table_number || "").trim(),
      user_name: userName,
      amount_due: Number(
        activeRow.TotalAmountDue ||
          activeRow.payment_amount ||
          activeRow.total_amount ||
          activeRow.TotalSales ||
          0,
      ),
      remarks: trimmedRemarks,
      category_code: String(
        activeRow.Category_Code || activeRow.category_code || "",
      ).trim(),
      unit_code: String(
        activeRow.Unit_Code || activeRow.unit_code || "",
      ).trim(),
      user_id: String(userId).trim(),
      admin_password: trimmedAdminPassword,
      selected_admin_id: trimmedSelectedAdminId,
      selected_admin_name: String(
        selectedAdmin?.name ||
          selectedAdmin?.username ||
          selectedAdmin?.email ||
          "",
      ).trim(),
      selected_admin_role: String(selectedAdmin?.userRole || "").trim(),
    };

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
        body: JSON.stringify(payload),
      });

      const result = await safeReadJson(
        response,
        actionType === "refund"
          ? "Refund transaction API"
          : "Void transaction API",
      );

      if (!response.ok || !result?.success) {
        const backendMessage =
          result?.message ||
          (actionType === "refund"
            ? "Failed to refund transaction."
            : "Failed to void transaction.");

        const isInvalidPassword = backendMessage
          .toLowerCase()
          .includes("invalid admin password");

        setFailureHeader(
          isInvalidPassword
            ? "Incorrect Admin Password"
            : actionType === "refund"
              ? "Refund Failed"
              : "Void Failed",
        );
        setFailureMessage(backendMessage);

        if (isInvalidPassword) {
          setAdminPassword("");
        }

        setIsFailureModalOpen(true);
        return;
      }

      closeActionModal();
      await fetchAll();

      setSuccessHeader(
        actionType === "refund" ? "Refund Successful" : "Void Successful",
      );
      setSuccessMessage(
        result?.message ||
          (actionType === "refund"
            ? "Transaction refunded successfully."
            : "Transaction voided successfully."),
      );
      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error(
        `[${actionType === "refund" ? "REFUND" : "VOID"} ERROR]`,
        error,
      );

      setFailureHeader(
        actionType === "refund" ? "Refund Failed" : "Void Failed",
      );
      setFailureMessage(
        error?.message ||
          (actionType === "refund"
            ? "Failed to refund transaction."
            : "Failed to void transaction."),
      );
      setIsFailureModalOpen(true);
    } finally {
      setIsActionLoading(false);
    }
  }, [
    apiHost,
    activeRow,
    actionType,
    actionRemarks,
    adminPassword,
    selectedAdminId,
    adminAccounts,
    closeActionModal,
    fetchAll,
  ]);

  const sourceTransactions = useMemo(() => {
    if (viewMode === "paid") return paidTransactions;
    if (viewMode === "voided") return voidedTransactions;
    if (viewMode === "refunded") return refundedTransactions;
    return pendingTransactions;
  }, [
    viewMode,
    pendingTransactions,
    paidTransactions,
    voidedTransactions,
    refundedTransactions,
  ]);

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
        row.status,
        row.invoice_no,
        row.void_remarks,
        row.refund_remarks,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(searchValue);
    });
  }, [sourceTransactions, search]);

  const summary = useMemo(() => {
    return {
      totalTransactions: filteredTransactions.length,
      totalSales: filteredTransactions.reduce((sum, row) => {
        const amount =
          viewMode === "pending"
            ? row.TotalSales
            : row.TotalAmountDue || row.payment_amount || row.TotalSales || 0;

        return sum + toNum(amount);
      }, 0),
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

  const isPaymentReadOnly = viewMode === "voided" || viewMode === "refunded";

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
              isDark ? "bg-blue-500/10" : "bg-blue-300/30"
            }`}
          />
          <div
            className={`absolute right-0 top-20 h-72 w-72 rounded-full blur-[120px] ${
              isDark ? "bg-cyan-500/10" : "bg-cyan-300/30"
            }`}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-[1700px] px-4 py-6 md:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <button
                onClick={() => navigate("/poscorehomescreen")}
                className={`flex items-center gap-3 mt-2 px-10 py-6 rounded-full transition-all ${
                  isDark
                    ? "bg-slate-900/50 border border-white/5 text-slate-400 hover:text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm"
                }`}
              >
                <FaArrowLeft size={14} />
                <span className="text-sm font-bold uppercase">
                  BACK TO DASHBOARD
                </span>
              </button>

              <h1
                className={`mt-2 text-3xl font-black md:text-4xl ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Transaction Payment Management
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500 md:text-base">
                View pending, paid, voided, and refunded transactions in one
                place.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="order-1 min-w-0 space-y-6">
              <div
                className={`rounded-[30px] border p-5 ${
                  isDark
                    ? "border-white/5 bg-white/[0.03]"
                    : "border-slate-200 bg-white shadow-sm"
                }`}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap gap-3">
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

                    <button
                      type="button"
                      onClick={() => setViewMode("voided")}
                      className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                        viewMode === "voided"
                          ? "bg-red-600 text-gray-100"
                          : isDark
                            ? "border border-slate-700 bg-slate-900 text-slate-300"
                            : "border border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      Voided
                    </button>

                    <button
                      type="button"
                      onClick={() => setViewMode("refunded")}
                      className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                        viewMode === "refunded"
                          ? "bg-blue-600 text-gray-100"
                          : isDark
                            ? "border border-slate-700 bg-slate-900 text-slate-300"
                            : "border border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      Refunded
                    </button>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row">
                    <div
                      className={`flex items-center gap-3 rounded-[22px] border px-4 py-3 ${
                        isDark
                          ? "border-slate-700 bg-slate-950"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <FiSearch
                        size={18}
                        className={isDark ? "text-slate-400" : "text-slate-500"}
                      />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search transaction, table, cashier..."
                        className={`w-full bg-transparent text-sm outline-none ${
                          isDark
                            ? "text-white placeholder:text-slate-500"
                            : "text-slate-900 placeholder:text-slate-400"
                        }`}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={fetchAll}
                      className={`inline-flex items-center justify-center gap-2 rounded-[22px] px-5 py-3 text-sm font-black transition ${
                        isDark
                          ? "bg-slate-800 text-slate-100 hover:bg-slate-700"
                          : "bg-slate-900 text-white hover:bg-slate-800"
                      }`}
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
            </section>

            <aside className="order-2">
              <SummaryPanel
                isDark={isDark}
                viewMode={viewMode}
                summary={summary}
              />
            </aside>
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
        readOnly={isPaymentReadOnly}
        onSaved={fetchAll}
      />

      <ActionRemarksModal
        isOpen={isActionModalOpen}
        onClose={closeActionModal}
        onSubmit={submitAction}
        remarks={actionRemarks}
        setRemarks={setActionRemarks}
        adminPassword={adminPassword}
        setAdminPassword={setAdminPassword}
        selectedAdminId={selectedAdminId}
        setSelectedAdminId={setSelectedAdminId}
        adminAccounts={adminAccounts}
        isLoadingAdmins={isLoadingAdmins}
        isDark={isDark}
        actionType={actionType}
        activeRow={activeRow}
        isSubmitting={isActionLoading}
        remarksInputRef={remarksInputRef}
      />

      {isSuccessModalOpen && (
        <ModalSuccessNavToSelf
          header={successHeader}
          message={successMessage}
          button="OK"
          setIsModalOpen={setIsSuccessModalOpen}
          resetForm={() => {
            setSuccessHeader("Saved Successfully");
            setSuccessMessage("Your changes have been saved.");
          }}
        />
      )}

      <InlineFailureModal
        isOpen={isFailureModalOpen}
        header={failureHeader}
        message={failureMessage}
        button="OK"
        setIsModalOpen={setIsFailureModalOpen}
      />
    </>
  );
}
