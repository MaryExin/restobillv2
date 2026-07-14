import React from "react";
import { FaShoppingBag, FaUserCircle } from "react-icons/fa";
import { FiArrowRight } from "react-icons/fi";

const peso = (value) =>
  Number(value) > 0
    ? `₱${Number(value).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "---";

const SummaryRow = ({ label, value, emphasis }) => (
  <div className="flex items-center justify-between">
    <span style={{ color: "var(--app-muted-text)" }}>{label}</span>
    <span
      className={emphasis ? "font-black" : "font-semibold"}
      style={{ color: emphasis ? "var(--app-accent)" : "var(--app-text)" }}
    >
      {value}
    </span>
  </div>
);

const RetailRightPanel = ({
  transactionNumber = "00001",
  isNewTransaction = true,
  subtotal = 0,
  discounts = 0,
  tax = 0,
  total = 0,
  cashier = { name: "Robert James", role: "Senior Sales Manager" },
  onProceedToPayment,
}) => {
  const hasItems = Number(subtotal) > 0;

  return (
    <aside
      className="relative flex-col hidden min-h-0 overflow-hidden transition-colors w-80 lg:flex"
      style={{
        borderLeft: "1px solid var(--app-border)",
        backgroundColor: "var(--app-surface-soft)",
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between p-4 border-b shrink-0"
        style={{ borderColor: "var(--app-border)" }}
      >
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--app-muted-text)" }}
          >
            Order Number
          </p>
          <p className="text-base font-black" style={{ color: "var(--app-text)" }}>
            #{transactionNumber}
            {isNewTransaction && (
              <span
                className="ml-2 text-[11px] font-bold"
                style={{ color: "var(--app-accent)" }}
              >
                (New Transaction)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ── Empty cart / cart items ── */}
      <div className="flex flex-col items-center justify-center flex-1 min-h-0 gap-4 px-6">
        <div
          className="flex items-center justify-center w-16 h-16 rounded-full"
          style={{ background: "var(--app-accent-soft)" }}
        >
          <FaShoppingBag size={24} style={{ color: "var(--app-accent)" }} />
        </div>
        <p
          className="text-sm font-semibold text-center"
          style={{ color: "var(--app-muted-text)" }}
        >
          No items scanned yet.
        </p>
      </div>

      {/* ── Totals summary ── */}
      <div
        className="mx-4 mb-3 rounded-2xl p-4 text-sm space-y-2 shrink-0"
        style={{
          background: "var(--app-surface)",
          border: "1px solid var(--app-border)",
        }}
      >
        <SummaryRow label="Sub Total" value={hasItems ? peso(subtotal) : "0.00"} />
        <SummaryRow label="Discounts" value={hasItems ? peso(discounts) : "0.00"} />
        <SummaryRow label="Tax" value={hasItems ? peso(tax) : "0.00"} />
        <div
          className="pt-2 mt-1 border-t"
          style={{ borderColor: "var(--app-border)" }}
        >
          <SummaryRow
            label="Total"
            value={hasItems ? peso(total) : "0.00"}
            emphasis
          />
        </div>
      </div>

      {/* ── Proceed to Payment ── */}
      <div className="px-4 pb-4 shrink-0">
        <button
          onClick={onProceedToPayment}
          disabled={!hasItems}
          className="flex items-center justify-center w-full gap-2 py-3 text-sm font-bold text-white rounded-2xl disabled:opacity-50"
          style={{
            background:
              "linear-gradient(180deg, var(--app-accent) 0%, var(--app-accent-secondary) 100%)",
            boxShadow: hasItems ? "0 12px 28px var(--app-accent-glow)" : "none",
          }}
        >
          Proceed to Payment (F12)
          <FiArrowRight size={16} />
        </button>
      </div>

      {/* ── Cashier footer ── */}
      <div
        className="flex items-center gap-3 p-4 border-t shrink-0"
        style={{ borderColor: "var(--app-border)" }}
      >
        <FaUserCircle size={30} style={{ color: "var(--app-accent)" }} />
        <div className="min-w-0">
          <p
            className="text-sm font-bold truncate"
            style={{ color: "var(--app-text)" }}
          >
            {cashier?.name || "Cashier"}
          </p>
          <p
            className="text-xs truncate"
            style={{ color: "var(--app-muted-text)" }}
          >
            {cashier?.role || ""}
          </p>
        </div>
      </div>
    </aside>
  );
};

export default RetailRightPanel;
