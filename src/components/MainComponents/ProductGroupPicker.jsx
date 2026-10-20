import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiMinus, FiPlus, FiShoppingBag, FiX } from "react-icons/fi";
import {
  hasGroupPrice,
  productGroupSizeKey,
  productGroupUnitPrice,
  roundProductGroupMoney,
} from "../../utils/productGroups";

const money = (value) => Number(value).toLocaleString("en-PH", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const allowed = (value) => [true, 1, "1", "true", "yes"].includes(
  typeof value === "string" ? value.toLowerCase() : value,
);
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-surface)]";
const choiceClass = (active) => `border-2 text-[var(--app-text)] transition-colors ${focusRing} ${active
  ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)]"
  : "border-[var(--app-border)] bg-[var(--app-surface)] enabled:hover:border-[var(--app-accent)]"} disabled:cursor-not-allowed disabled:border-dashed disabled:bg-[var(--app-surface-soft)] disabled:text-[var(--app-muted-text)]`;

function SelectionMark({ selected }) {
  return <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected
    ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-[var(--app-on-accent,#ffffff)]" : "border-[var(--app-border-strong)]"}`}>
    {selected && <FiCheck size={13} strokeWidth={3} />}
  </span>;
}

function PortionIcon({ half = false, split = false, className = "h-10 w-10" }) {
  return <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" opacity=".25" />
    {half ? <path d="M24 4a20 20 0 0 1 0 40V4Z" fill="currentColor" fillOpacity=".2" stroke="currentColor" strokeWidth="2" />
      : <circle cx="24" cy="24" r="20" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="2" />}
    {split ? <path d="M24 5v38" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
      : !half && <path d="m10 10 28 28M10 38l28-28M24 4v40M4 24h40" stroke="currentColor" strokeWidth="1.5" opacity=".5" />}
  </svg>;
}

export default function ProductGroupPicker({ products = [], onClose, onAdd }) {
  const panel = useRef(null);
  const heading = useRef(null);
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;
  const groupName = products[0]?.product_group?.name || "item";
  const sizes = useMemo(() => [...new Map(products
    .filter((product) => productGroupSizeKey(product))
    .map((product) => [productGroupSizeKey(product), product.group_size])).values()]
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" })), [products]);
  const [size, setSize] = useState("");
  const [orderPortion, setOrderPortion] = useState("");
  const [twoFlavors, setTwoFlavors] = useState(false);
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [count, setCount] = useState("1");
  const portion = orderPortion === "whole" && twoFlavors ? "half_and_half" : orderPortion;
  const options = useMemo(() => products.filter((product) => productGroupSizeKey(product)
    === productGroupSizeKey({ group_size: size })), [products, size]);
  // Show the flavors immediately, but require an explicit size and portion to order.
  const visibleOptions = size ? options : [...new Map(products.map((product) => [
    String(product.group_variant || product.build_code).trim().toLowerCase(), product,
  ])).values()];
  const available = (product) => hasGroupPrice(product)
    && (!product.group_size_id || allowed(product.group_recipe_configured))
    && (portion !== "half" || allowed(product.product_group.allow_half))
    && (portion !== "half_and_half" || allowed(product.product_group.allow_half_and_half));
  const firstProduct = options.find((product) => product.build_code === first && available(product));
  const secondProduct = portion === "half_and_half" ? options.find((product) =>
    product.build_code === second && product.build_code !== first && available(product)) : null;
  const selected = [firstProduct, secondProduct].filter(Boolean);
  const price = size && portion ? productGroupUnitPrice(selected, portion) : null;
  const validCount = Number.isInteger(Number(count)) && Number(count) >= 1 && Number(count) <= 10000;
  const taxMismatch = selected.length === 2 && selected[0].tax_type !== selected[1].tax_type;
  const unitMismatch = selected.length === 2 && new Set(selected.map((product) =>
    String(product.unit_of_measure || "").trim().toLowerCase())).size > 1;
  const canAdd = price !== null && validCount && !taxMismatch && !unitMismatch;
  const canChooseHalf = options.some((product) => hasGroupPrice(product)
    && (!product.group_size_id || allowed(product.group_recipe_configured)) && allowed(product.product_group.allow_half));
  const canChooseTwo = options.filter((product) => hasGroupPrice(product)
    && (!product.group_size_id || allowed(product.group_recipe_configured))
    && allowed(product.product_group.allow_half_and_half)).length >= 2;
  const portionLabel = portion === "half_and_half" ? "Whole · half & half" : portion === "half" ? "Half" : portion === "whole" ? "Whole" : "Choose a portion";
  const selectionLabel = selected.map((product) => product.group_variant).join(" + ");
  const guidance = !sizes.length ? "No sizes are available for this item."
    : !size ? "Start by choosing your size."
      : !portion ? "Choose a whole or half portion."
        : !firstProduct ? "Pick your favorite flavor below."
          : portion === "half_and_half" && !secondProduct ? "Choose a different flavor for the second half."
            : taxMismatch || unitMismatch ? "Choose compatible flavors to continue."
              : !validCount ? "Enter a valid quantity to continue."
            : "Your selection is ready. You can adjust anything before adding.";
  const resetFlavors = () => { setFirst(""); setSecond(""); setTwoFlavors(false); };
  const chooseSize = (value) => {
    if (productGroupSizeKey({ group_size: value }) === productGroupSizeKey({ group_size: size })) return;
    setSize(value); setOrderPortion(""); resetFlavors();
  };
  const choosePortion = (value) => {
    if (value === orderPortion) return;
    setOrderPortion(value); resetFlavors();
  };

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    heading.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); closeHandler.current();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = [...(panel.current?.querySelectorAll("button:not(:disabled), input:not(:disabled)") || [])];
      const active = document.activeElement;
      const outsideControls = !controls.includes(active);
      if (event.shiftKey && (active === controls[0] || outsideControls)) {
        event.preventDefault(); controls.at(-1)?.focus();
      } else if (!event.shiftKey && (active === controls.at(-1) || outsideControls)) {
        event.preventDefault(); controls[0]?.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus?.();
    };
  }, []);

  const flavorPrice = (product, isSecond) => {
    if (!size) return "Choose a size";
    if (!hasGroupPrice(product)) return product.group_price_error || "Price not set";
    let value = productGroupUnitPrice([product], !portion || portion === "whole" ? "whole" : "half");
    // Allocate the second half's cents from the rounded total, as in the saved order.
    if (isSecond && firstProduct) value = roundProductGroupMoney(
      productGroupUnitPrice([firstProduct, product], "half_and_half") - productGroupUnitPrice([firstProduct], "half"),
    );
    return `₱${money(value)} ${!portion || portion === "whole" ? "whole" : "half"}`;
  };
  const variants = (value, choose, label, excluded = "", isSecond = false) => (
    <fieldset className="min-w-0">
      <legend className="mb-3 flex w-full items-center gap-2 text-sm font-[Poppins-SemiBold]">
        {portion === "half_and_half" && <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--app-accent-soft)] text-[var(--app-text)]">{isSecond ? "½ B" : "½ A"}</span>}
        {label}
      </legend>
      <div className={`grid gap-3 ${portion === "half_and_half" ? "grid-cols-1 min-[1440px]:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 min-[1440px]:grid-cols-3"}`}>
        {visibleOptions.map((product) => {
          const active = value === product.build_code;
          const sameFlavor = product.build_code === excluded;
          const labelPrice = flavorPrice(product, isSecond);
          return <button key={product.build_code} type="button" aria-pressed={active}
            aria-label={`${product.group_variant} ${labelPrice}`}
            disabled={!size || !portion || !available(product) || sameFlavor}
            onClick={() => choose(product.build_code)}
            className={`${choiceClass(active)} flex min-h-[112px] items-start gap-3 rounded-2xl p-4 text-left`}>
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--app-accent-soft)] text-[var(--app-text)]">
              <PortionIcon half={portion === "half" || portion === "half_and_half"} className="h-7 w-7" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block break-words text-sm font-[Poppins-SemiBold] leading-6">{product.group_variant}</span>
              <span className={`mt-1 block text-xs leading-5 ${active ? "text-[var(--app-text)] font-[Poppins-SemiBold]" : "text-[var(--app-muted-text)]"}`}>{labelPrice}</span>
              {sameFlavor && <span className="mt-1 block text-xs text-[var(--app-muted-text)]">Selected for the first half</span>}
            </span>
            <SelectionMark selected={active} />
          </button>;
        })}
      </div>
    </fieldset>
  );

  return createPortal(
    <section ref={panel} role="dialog" aria-modal="true" aria-labelledby="product-group-heading" aria-describedby="product-group-description"
      className="fixed inset-0 z-[20000] flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--app-bg)] font-[Poppins-Regular] text-[var(--app-text)]">
      <header className="shrink-0 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--app-accent-soft)] text-[var(--app-text)] sm:flex"><PortionIcon className="h-8 w-8" /></span>
            <div className="min-w-0">
              <h2 ref={heading} tabIndex={-1} id="product-group-heading" className="break-words text-xl font-[Poppins-Bold] outline-none sm:text-2xl">Customize {groupName}</h2>
              <p id="product-group-description" className="mt-1 text-xs text-[var(--app-muted-text)] sm:text-sm">Your size. Your portion. Your favorite flavors.</p>
            </div>
          </div>
          <button type="button" aria-label="Close product choices" onClick={onClose}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--app-border-strong)] bg-[var(--app-surface)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-text)] ${focusRing}`}><FiX size={22} /></button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto grid max-w-[1600px] items-start gap-5 p-4 sm:p-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6 lg:p-8 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-5 lg:sticky lg:top-8">
            <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5">
              <h3 className="text-base font-[Poppins-SemiBold]">1. Choose a size</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--app-muted-text)]">Find the right size for your appetite.</p>
              <fieldset className="mt-4"><legend className="sr-only">Size</legend>
                <div className="grid grid-cols-3 gap-2">
                  {sizes.map((value) => {
                    const active = productGroupSizeKey({ group_size: size }) === productGroupSizeKey({ group_size: value });
                    return <button key={value} type="button" aria-label={String(value)} aria-pressed={active} onClick={() => chooseSize(value)}
                      className={`${choiceClass(active)} flex min-h-[64px] items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-center text-sm font-[Poppins-SemiBold]`}>
                      <span className="break-words">{value}</span>{active && <FiCheck aria-hidden="true" className="shrink-0 text-[var(--app-text)]" />}
                    </button>;
                  })}
                </div>
                {!sizes.length && <p className="text-sm text-[var(--app-muted-text)]">No sizes available.</p>}
              </fieldset>
            </section>

            <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-5">
              <h3 className="text-base font-[Poppins-SemiBold]">2. Whole or half?</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--app-muted-text)]">{size ? "Choose how much you would like." : "Select a size to unlock your portion."}</p>
              <fieldset className="mt-4"><legend className="sr-only">Portion</legend>
                <div className="grid grid-cols-2 gap-3">
                  {[["whole", "Whole item", "Whole", "A full serving"], ["half", "Half item", "Half", "A half serving"]].map(([value, label, title, description]) => (
                    <button key={value} type="button" aria-label={label} aria-pressed={orderPortion === value}
                      disabled={!size || (value === "half" && !canChooseHalf)} onClick={() => choosePortion(value)}
                      className={`${choiceClass(orderPortion === value)} relative flex flex-col items-center rounded-2xl px-3 pb-4 pt-5`}>
                      <span className="absolute right-2 top-2"><SelectionMark selected={orderPortion === value} /></span>
                      <PortionIcon half={value === "half"} className="mb-3 mt-2 h-12 w-12 text-[var(--app-text)]" />
                      <span className="font-[Poppins-SemiBold]">{title}</span>
                      <span className="mt-1 text-[11px] text-[var(--app-muted-text)]">{description}</span>
                    </button>
                  ))}
                </div>
                {size && !canChooseHalf && <p className="mt-3 text-xs text-[var(--app-muted-text)]">Half portions aren’t available for this size.</p>}
              </fieldset>
              {orderPortion === "whole" && <fieldset className="mt-5 border-t border-[var(--app-border)] pt-4">
                <legend className="sr-only">Flavors in this whole item</legend>
                <p className="mb-3 text-xs font-[Poppins-SemiBold]">Make it your way</p>
                <div className="grid gap-2">
                  {[[false, "One flavor"], [true, "Two flavors · half & half"]].map(([value, label]) => (
                    <button key={label} type="button" aria-label={label} aria-pressed={twoFlavors === value} disabled={value && !canChooseTwo}
                      onClick={() => { if (twoFlavors !== value) { setTwoFlavors(value); setFirst(""); setSecond(""); } }}
                      className={`${choiceClass(twoFlavors === value)} flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-[Poppins-Medium]`}>
                      <PortionIcon split={value} className="h-6 w-6 shrink-0 text-[var(--app-text)]" /><span className="flex-1">{label}</span><SelectionMark selected={twoFlavors === value} />
                    </button>
                  ))}
                </div>
                {!canChooseTwo && <p className="mt-2 text-xs leading-5 text-[var(--app-muted-text)]">Two-flavor combinations aren’t available for this size.</p>}
              </fieldset>}
            </section>
          </div>

          <section className="min-w-0 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--app-border)] pb-5">
              <div><h3 className="text-lg font-[Poppins-SemiBold]">3. Choose your {twoFlavors ? "flavors" : "flavor"}</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--app-muted-text)]" aria-live="polite">{guidance}</p></div>
              {size && <span className="rounded-full bg-[var(--app-accent-soft)] px-3 py-1.5 text-xs font-[Poppins-Medium] text-[var(--app-text)]">{size}{portion ? ` · ${portionLabel}` : ""}</span>}
            </div>
            <div className={`grid gap-6 ${portion === "half_and_half" ? "md:grid-cols-2" : ""}`}>
              {variants(first, (value) => { setFirst(value); if (second === value) setSecond(""); }, portion === "half_and_half" ? "First half flavor / variant" : "Flavor / variant")}
              {portion === "half_and_half" && variants(second, setSecond, "Second half flavor / variant", first, true)}
            </div>
            {portion && <p className="mt-5 text-xs leading-5 text-[var(--app-muted-text)]">{portion === "half_and_half"
              ? "One whole item, two flavors. The price combines half of each flavor’s whole price."
              : portion === "half" ? "Half portions cost half of the selected flavor’s whole price."
                : "Prices shown are for one whole item."} Prices reflect your selected size and service type.</p>}
            {taxMismatch && <p role="alert" className="mt-4 rounded-xl border border-redAccent p-3 text-sm text-redAccent">These flavors use different tax types. Choose a matching flavor.</p>}
            {unitMismatch && <p role="alert" className="mt-4 rounded-xl border border-redAccent p-3 text-sm text-redAccent">These flavors use different units of measure. Choose a matching flavor.</p>}
          </section>
        </div>
      </div>

      <footer className="shrink-0 border-t border-[var(--app-border)] bg-[var(--app-surface)] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-[1600px] grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:gap-x-8">
          <div role="region" aria-label="Order summary" aria-live="polite" className="col-span-2 min-w-0 lg:col-span-1">
            <p className="text-[11px] font-[Poppins-SemiBold] uppercase tracking-widest text-[var(--app-muted-text)]">Your selection</p>
            <p className="mt-1 truncate text-sm font-[Poppins-SemiBold]" title={selectionLabel || groupName}>{selectionLabel || groupName}</p>
            <p className="mt-0.5 text-xs text-[var(--app-muted-text)]">{size || "Choose a size"} · {portionLabel}{price !== null ? <span> · <span>₱{money(price)} each</span></span> : ""}</p>
          </div>
          <div>
            <label htmlFor="product-group-quantity" className="mb-1.5 block text-xs font-[Poppins-Medium]">Quantity</label>
            <div className="flex h-11 items-center rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-bg)] p-1">
              <button type="button" aria-label="Decrease quantity" disabled={!validCount || Number(count) <= 1} onClick={() => setCount(String(Number(count) - 1))}
                className={`flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--app-surface)] text-[var(--app-text)] enabled:hover:bg-[var(--app-accent-soft)] disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[var(--app-muted-text)] ${focusRing}`}><FiMinus size={17} /></button>
              <input id="product-group-quantity" type="number" min="1" max="10000" step="1" inputMode="numeric" value={count} aria-invalid={!validCount}
                aria-describedby={!validCount ? "product-group-quantity-error" : undefined}
                onFocus={(event) => event.target.select()} onChange={(event) => setCount(event.target.value)}
                className={`h-9 w-14 rounded-lg bg-transparent text-[var(--app-text)] text-center text-sm font-[Poppins-SemiBold] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${focusRing}`} />
              <button type="button" aria-label="Increase quantity" disabled={!validCount || Number(count) >= 10000} onClick={() => setCount(String(Number(count) + 1))}
                className={`flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--app-surface)] text-[var(--app-text)] enabled:hover:bg-[var(--app-accent-soft)] disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[var(--app-muted-text)] ${focusRing}`}><FiPlus size={17} /></button>
            </div>
            {!validCount && <p id="product-group-quantity-error" role="alert" className="mt-1 max-w-[180px] text-xs text-redAccent">Enter a whole number from 1 to 10,000.</p>}
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-5">
            <div aria-live="polite" className="text-right"><p className="text-[11px] text-[var(--app-muted-text)]">Total</p>
              <p className="whitespace-nowrap text-xl font-[Poppins-Bold] sm:text-2xl">{price !== null && validCount ? `₱${money(roundProductGroupMoney(price * Number(count)))}` : "—"}</p>
            </div>
            <button type="button" aria-label="Add item to cart" disabled={!canAdd} onClick={() => { if (canAdd) onAdd({ products: selected, portion, count: Number(count) }); }}
              className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[var(--app-accent)] bg-[var(--app-accent)] px-4 py-3 text-sm font-[Poppins-SemiBold] text-[var(--app-on-accent,#ffffff)] transition-colors enabled:hover:shadow-lg disabled:cursor-not-allowed disabled:border-[var(--app-border-strong)] disabled:bg-[var(--app-surface-soft)] disabled:text-[var(--app-muted-text)] sm:min-w-[180px] ${focusRing}`}>
              <FiShoppingBag aria-hidden="true" size={18} /><span>Add to cart</span>
            </button>
          </div>
        </div>
      </footer>
    </section>, document.body,
  );
}
