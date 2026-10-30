import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import { getOrderItemDisplayName } from "../../utils/orderItemDisplayName";

const priceFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatPrice = (value) => `₱${priceFormatter.format(value)}`;
const getPrice = (value) => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
};
const getProductId = (product) => String(product?.product_id ?? "").trim();
const addPrices = (base, fee) => (Math.round(base * 100) + Math.round(fee * 100)) / 100;

const CoffeeAddonModal = ({
  product,
  drinkName,
  addons = [],
  isLoading = false,
  error = "",
  onRetry,
  onClose,
  onSelect,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const optionName = useId();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const [selection, setSelection] = useState(null);
  const productId = getProductId(product);
  const basePrice = getPrice(product?.selling_price);
  const isReady = !isLoading && !error;
  const hasBasePrice = Boolean(productId) && basePrice !== null;
  const options = Array.isArray(addons) ? addons.filter((addon) => addon && typeof addon === "object") : [];
  const selectedId = selection?.productId === productId ? selection.addonId : null;
  // Always resolve the selected ID from the current catalog, keeping updated
  // prices and the original row object and rejecting removed selections.
  const selectedAddon = selectedId === null ? null : options.find((addon) => getProductId(addon) === selectedId);
  const addonPrice = selectedId === null ? 0 : getPrice(selectedAddon?.selling_price);
  const hasSelection = selectedId === null || (Boolean(selectedAddon) && addonPrice !== null);
  const canConfirm = isReady && hasBasePrice && hasSelection;
  const total = hasBasePrice && hasSelection ? addPrices(basePrice, addonPrice) : null;
  const name = product?.item_name || drinkName || "Coffee";

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    const keepFocusInside = (event) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target)) closeButtonRef.current?.focus();
    };
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", keepFocusInside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", keepFocusInside);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus?.();
    };
  }, []);

  const renderOption = (addon, index) => {
    const isRegular = addon === null;
    const addonId = isRegular ? null : getProductId(addon);
    const fee = isRegular ? 0 : getPrice(addon?.selling_price);
    const available = isRegular || (Boolean(addonId) && fee !== null);
    const disabled = !isReady || !hasBasePrice || !available;
    const checked = isRegular ? selectedId === null : Boolean(addonId) && selectedId === addonId;
    const label = isRegular ? "Regular" : getOrderItemDisplayName(addon?.item_name) || "Coffee add-on";
    return (
      <label
        key={isRegular ? "regular" : `${addonId}-${index}`}
        className={`flex min-h-[84px] items-center gap-3 rounded-2xl border-2 p-4 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-colorBrand ${
          checked ? "border-colorBrand bg-darkerPrimary" : "border-[var(--app-border)]"
        } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-colorBrand"}`}
      >
        <input
          type="radio"
          name={optionName}
          value={isRegular ? "regular" : addonId}
          aria-label={label}
          checked={checked}
          disabled={disabled}
          onChange={() => {
            if (!disabled) setSelection({ productId, addonId });
          }}
          className="h-5 w-5 shrink-0 accent-[var(--app-accent)]"
        />
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-[Poppins-SemiBold]">{label}</span>
          <span className="mt-1 block text-xs opacity-70">{isRegular ? "No add-on" : "Add to your drink"}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-[Poppins-SemiBold] text-colorBrandLighter">
            {available ? `+${formatPrice(fee)}` : "Price unavailable"}
          </span>
          {available && hasBasePrice && (
            <span className="mt-1 block text-xs opacity-70">Total {formatPrice(addPrices(basePrice, fee))}</span>
          )}
        </span>
      </label>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        "--color-darkPrimary": "var(--app-surface)",
        "--color-darkerPrimary": "var(--app-bg)",
        "--color-lighter": "var(--app-text)",
        "--color-brandPrimary": "var(--app-accent)",
        "--color-brandSecondary": "var(--app-accent-secondary)",
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-[var(--app-border)] bg-darkPrimary font-[Poppins-Regular] text-colorBrandLighter shadow-2xl outline-none sm:max-h-[calc(100dvh-3rem)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-7 sm:pt-7">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-[Poppins-Medium] uppercase tracking-[0.14em] text-colorBrandLighter opacity-70">Make it yours</p>
            <h2 id={titleId} className="break-words text-xl font-[Poppins-SemiBold] sm:text-2xl">{name}</h2>
            <p id={descriptionId} className="mt-2 text-sm opacity-70">Choose Regular or one add-on for your drink.</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close coffee options"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-darkerPrimary text-colorBrandLighter hover:text-colorBrandSecondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-colorBrand"
          >
            <FiX size={22} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto px-5 pb-5 sm:px-7" aria-busy={isLoading}>
          {isLoading ? (
            <p role="status" className="py-8 text-center text-sm opacity-70">Loading coffee options and prices…</p>
          ) : error ? (
            <div className="py-6 text-center">
              <p role="alert" className="text-sm text-redAccent">{error}</p>
              {onRetry && <button type="button" onClick={onRetry} className="mt-4 min-h-[44px] rounded-xl border-2 border-colorBrand px-5 py-3 font-[Poppins-Medium] text-colorBrandSecondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-colorBrand">Try again</button>}
            </div>
          ) : (
            <>
              {!hasBasePrice && <p role="alert" className="mb-4 text-sm text-redAccent">The drink price is unavailable. Try again before adding it to your order.</p>}
              <div role="radiogroup" aria-label="Coffee options" className="space-y-3">
                {renderOption(null, 0)}
                {options.map(renderOption)}
              </div>
              {selectedId !== null && !selectedAddon && <p role="status" className="mt-4 text-sm text-redAccent">This add-on is no longer available. Choose another option or Regular.</p>}
              {!hasBasePrice && onRetry && <button type="button" onClick={onRetry} className="mt-4 min-h-[44px] rounded-xl border-2 border-colorBrand px-5 py-3 font-[Poppins-Medium] text-colorBrandSecondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-colorBrand">Try again</button>}
            </>
          )}
        </div>

        <footer className="shrink-0 space-y-4 border-t border-[var(--app-border)] px-5 py-5 sm:px-7">
          <div className="flex items-center justify-between gap-4" aria-live="polite" aria-atomic="true">
            <span className="font-[Poppins-Medium]">Order total</span>
            <span className="text-xl font-[Poppins-SemiBold] text-colorBrandLighter">{isReady && total !== null ? formatPrice(total) : "—"}</span>
          </div>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => { if (canConfirm) onSelect?.(selectedAddon ?? null); }}
            className="min-h-[52px] w-full rounded-2xl bg-colorBrand px-5 py-3 font-[Poppins-SemiBold] text-white transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-colorBrand disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add to order
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
};

export default CoffeeAddonModal;
