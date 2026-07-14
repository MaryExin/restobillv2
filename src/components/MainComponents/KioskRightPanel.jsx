import React, { useState } from "react";
import {
  FaTrash,
  FaShoppingCart,
  FaEdit,
  FaMinus,
  FaPlus,
  FaReceipt,
  FaQrcode,
} from "react-icons/fa";
import { FiLoader, FiX, FiPrinter, FiRefreshCw } from "react-icons/fi";
import { MdOutlineGridView } from "react-icons/md";

const peso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ── Shared cart card — identical design to the restaurant CartList ────────────
const KioskCartItem = ({
  item,
  updateQuantity,
  updateQuantityByInput,
  removeItem,
  openItemInstructionModal,
}) => (
  <div
    className="p-3 transition-colors border rounded-xl"
    style={{
      backgroundColor: "var(--app-surface)",
      borderColor: "var(--app-border)",
      color: "var(--app-text)",
    }}
  >
    {/* ── Row 1: name + action icons ── */}
    <div className="flex items-start justify-between gap-2 mb-2">
      <div className="flex-1 min-w-0">
        <span
          className="block text-xs font-medium leading-tight"
          style={{ color: "var(--app-text)" }}
        >
          {item.name}
        </span>

        {item.itemInstruction && (
          <p className="mt-1 break-words text-[10px] text-amber-500">
            Note: {item.itemInstruction}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => openItemInstructionModal?.(item)}
          className="p-2 transition-colors"
          style={{ color: "var(--app-muted-text)" }}
          title="Add instruction"
        >
          <FaEdit size={16} />
        </button>

        <button
          onClick={() => removeItem?.(item.lineId, item)}
          className="p-2 transition-colors"
          style={{ color: "var(--app-muted-text)" }}
          title="Remove item"
        >
          <FaTrash size={16} />
        </button>
      </div>
    </div>

    {/* ── Row 2: qty controls + price ── */}
    <div className="flex items-center justify-between">
      {item.hasAdditionalEntry ? (
        <div
          className="text-xs font-bold"
          style={{ color: "var(--app-muted-text)" }}
        >
          Qty: {item.quantity}
          {item.originalQuantity > 0 &&
          item.originalQuantity !== item.quantity
            ? ` / Original: ${item.originalQuantity}`
            : ""}
        </div>
      ) : (
        <div
          className="flex items-center gap-2 p-1 transition-colors border rounded-lg"
          style={{
            backgroundColor: "var(--app-surface-soft)",
            borderColor: "var(--app-border)",
          }}
        >
          <button
            onClick={() => updateQuantity?.(item.lineId, -1, item)}
            className="flex items-center justify-center transition-colors rounded-md h-7 w-7"
            style={{
              color: "var(--app-text)",
              backgroundColor: "var(--app-surface)",
              border: "1px solid var(--app-border)",
            }}
          >
            <FaMinus size={8} />
          </button>

          <span
            className="text-xs"
            style={{ color: "var(--app-muted-text)" }}
          >
            Qty
          </span>

          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={item.quantity}
            onFocus={(e) => e.target.select()}
            onChange={(e) =>
              updateQuantityByInput?.(item.lineId, e.target.value, item)
            }
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v === "" || Number(v) <= 0 || Number.isNaN(Number(v))) {
                updateQuantityByInput?.(item.lineId, "1", item);
              }
            }}
            className="w-16 px-2 py-1.5 text-sm font-bold text-center transition-colors rounded-lg outline-none"
            style={{
              backgroundColor: "var(--app-surface)",
              border: "1px solid var(--app-border)",
              color: "var(--app-text)",
            }}
          />

          <button
            onClick={() => updateQuantity?.(item.lineId, 1, item)}
            className="flex items-center justify-center transition-colors rounded-md h-7 w-7"
            style={{
              color: "var(--app-text)",
              backgroundColor: "var(--app-surface)",
              border: "1px solid var(--app-border)",
            }}
          >
            <FaPlus size={8} />
          </button>
        </div>
      )}

      <span
        className="text-sm font-bold"
        style={{ color: "var(--app-accent)" }}
      >
        ₱{(Number(item.price) * Number(item.quantity)).toLocaleString()}
      </span>
    </div>
  </div>
);

// ── Quick Option Button ───────────────────────────────────────────────────────
const QUICK_COLORS = {
  blue:    { bg: "rgba(59,130,246,0.1)",  text: "#3b82f6" },
  emerald: { bg: "rgba(16,185,129,0.1)",  text: "#10b981" },
  violet:  { bg: "rgba(139,92,246,0.1)",  text: "#8b5cf6" },
};

const QuickOptionButton = ({ icon, label, sub, color = "blue", onClick }) => {
  const { bg, text } = QUICK_COLORS[color] || QUICK_COLORS.blue;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left transition-opacity hover:opacity-80 active:scale-[0.98]"
      style={{ background: bg }}
    >
      <span
        className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
        style={{ background: text + "22", color: text }}
      >
        {icon}
      </span>
      <span className="flex flex-col min-w-0">
        <span className="text-sm font-bold leading-tight" style={{ color: "var(--app-text)" }}>
          {label}
        </span>
        <span className="text-[11px] leading-tight mt-0.5" style={{ color: "var(--app-muted-text)" }}>
          {sub}
        </span>
      </span>
    </button>
  );
};

// ── Main Panel ────────────────────────────────────────────────────────────────
const KioskRightPanel = ({
  customerName,
  transactionId,
  cartItems = [],
  totalItems = 0,
  totalPrice = 0,
  isDark,
  onClearCart,
  onCharge,
  onViewSummary,
  isCharging = false,
  updateQuantity,
  updateQuantityByInput,
  removeItem,
  openItemInstructionModal,
  onPrintQR,
  onAppToPos,
  onPrintOrderSummary,
}) => {
  const [showQuickOptions, setShowQuickOptions] = useState(false);

  const closeQuickOptions = () => setShowQuickOptions(false);

  return (
    <aside
      className="relative flex-col hidden min-h-0 overflow-hidden transition-colors w-80 lg:flex"
      style={{
        borderLeft: "1px solid var(--app-border)",
        backgroundColor: "var(--app-surface-soft)",
      }}
    >
      {/* ── Header: Welcome + Items badge ── */}
      <div
        className="px-4 pt-4 pb-3 border-b shrink-0"
        style={{ borderColor: "var(--app-border)" }}
      >
        <p className="text-sm font-bold text-center text-emerald-400 tracking-wide">
          Hello {customerName || "Customer"}
        </p>

        <div className="flex items-center justify-between mt-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{
              background: "var(--app-accent-soft)",
              color: "var(--app-accent)",
            }}
          >
            <FaShoppingCart size={10} />
            ITEMS ({totalItems})
          </span>

          <button
            onClick={onClearCart}
            disabled={isCharging}
            className="p-1.5 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
            title="Clear Cart"
          >
            <FaTrash size={13} />
          </button>
        </div>
      </div>

      {/* ── Empty Cart Placeholder ── */}
      {totalItems === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 px-6 py-8">
          <div
            className="flex items-center justify-center w-20 h-20 rounded-full"
            style={{ background: "var(--app-accent-soft)" }}
          >
            <FaShoppingCart size={30} style={{ color: "var(--app-accent)" }} />
          </div>
          <p
            className="text-xs text-center leading-relaxed"
            style={{ color: "var(--app-muted-text)" }}
          >
            Tap an Item
            <br />
            to add to transaction
            <br />
            <span className="font-bold" style={{ color: "var(--app-accent)" }}>
              {transactionId || "—"}
            </span>
          </p>
        </div>
      )}

      {/* ── Cart Items (shared card design with Restaurant mode) ── */}
      {totalItems > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
          {cartItems.map((item, idx) => (
            <KioskCartItem
              key={item.lineId || item.item_id || idx}
              item={item}
              updateQuantity={updateQuantity}
              updateQuantityByInput={updateQuantityByInput}
              removeItem={removeItem}
              openItemInstructionModal={openItemInstructionModal}
            />
          ))}
        </div>
      )}

      {/* ── Order Summary button ── */}
      <div className="px-3 mt-2 shrink-0">
        <button
          onClick={onViewSummary}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-colors"
          style={{
            background: "var(--app-surface)",
            border: "1px solid var(--app-border)",
            color: "var(--app-accent)",
          }}
        >
          <FaReceipt size={12} />
          Order Summary
        </button>
      </div>

      {/* ── Financial Summary (Subtotal + Total only) ── */}
      <div
        className="mx-3 mt-2 mb-1 rounded-xl p-3 text-xs shrink-0"
        style={{
          background: "var(--app-surface)",
          border: "1px solid var(--app-border)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p style={{ color: "var(--app-muted-text)" }}>Subtotal</p>
            <p className="font-bold mt-0.5" style={{ color: "var(--app-text)" }}>
              {peso(totalPrice)}
            </p>
          </div>
          <div className="text-right">
            <p style={{ color: "var(--app-muted-text)" }}>Total</p>
            <p className="font-bold mt-0.5 text-emerald-400">
              {peso(totalPrice)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="flex items-center gap-2 p-3 shrink-0">
        <button
          onClick={() => setShowQuickOptions(true)}
          disabled={isCharging}
          className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-colors disabled:opacity-40 hover:opacity-80"
          style={{
            border: "1px solid var(--app-border)",
            color: "var(--app-muted-text)",
            background: "var(--app-surface)",
          }}
          title="Quick Options"
        >
          <MdOutlineGridView size={18} />
        </button>

        <button
          onClick={onCharge}
          disabled={isCharging || totalItems === 0}
          className="flex-1 h-10 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          style={{
            background:
              "linear-gradient(180deg, var(--app-accent) 0%, var(--app-accent-secondary) 100%)",
            boxShadow:
              isCharging || totalItems === 0
                ? "none"
                : "0 8px 20px var(--app-accent-glow)",
          }}
        >
          {isCharging ? (
            <>
              <FiLoader size={14} className="animate-spin" />
              Saving…
            </>
          ) : (
            "Charge"
          )}
        </button>
      </div>
      {/* ── Quick Options Modal (Kiosk-only) ── */}
      {showQuickOptions && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={closeQuickOptions}
        >
          <div
            className="w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden"
            style={{
              backgroundColor: "var(--app-surface)",
              border: "1px solid var(--app-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: "var(--app-border)" }}
            >
              <div className="flex items-center gap-2">
                <MdOutlineGridView size={16} style={{ color: "var(--app-accent)" }} />
                <span className="text-sm font-bold" style={{ color: "var(--app-text)" }}>
                  Quick Options
                </span>
              </div>
              <button
                onClick={closeQuickOptions}
                className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                style={{ color: "var(--app-muted-text)" }}
              >
                <FiX size={15} />
              </button>
            </div>

            {/* Option buttons */}
            <div className="p-3 flex flex-col gap-2">
              <QuickOptionButton
                icon={<FaQrcode size={17} />}
                label="Print QR Code"
                sub="Digital payment / scanning"
                color="blue"
                onClick={() => { onPrintQR?.(); closeQuickOptions(); }}
              />
              <QuickOptionButton
                icon={<FiRefreshCw size={17} />}
                label="App to POS"
                sub="Sync & save order to POS"
                color="emerald"
                onClick={() => { onAppToPos?.(); closeQuickOptions(); }}
              />
              <QuickOptionButton
                icon={<FiPrinter size={17} />}
                label="Print Order Summary"
                sub="Print draft bill breakdown"
                color="violet"
                onClick={() => { onPrintOrderSummary?.(); closeQuickOptions(); }}
              />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default KioskRightPanel;
