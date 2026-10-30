import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import { getMenuVariantDetails } from "../../utils/menuProductVariants";
import { isPizzaVariantGroup } from "../../utils/menuPizzaCombination";
import { isPlatterVariantGroup } from "../../utils/menuPlatterCombination";
import { isChickenVariantGroup } from "../../utils/menuChickenCombination";
import PizzaCombinationOptions from "./PizzaCombinationOptions";
import PlatterCombinationOptions from "./PlatterCombinationOptions";
import ChickenCombinationOptions from "./ChickenCombinationOptions";

const priceFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const ProductVariantModal = ({
  group,
  isLoading = false,
  error = "",
  onRetry,
  onClose,
  onSelect,
  combinationMode = false,
  onCombinationModeChange,
  combinationOptions = { products: [], isLoading: false, error: "" },
  onSelectCombination,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const [servingSize, setServingSize] = useState("solo");

  const variantsByPortion = useMemo(() => {
    const result = { whole: [], half: [] };
    for (const product of group?.variants || []) {
      const details = getMenuVariantDetails(product);
      result[details.portion].push({ product, details });
    }
    for (const variants of Object.values(result)) {
      variants.sort((a, b) => {
        const sizeDifference =
          (a.details.sizeOrder ?? a.details.sizeValue ?? Infinity) -
          (b.details.sizeOrder ?? b.details.sizeValue ?? Infinity);
        return sizeDifference || String(a.product.item_name || "").localeCompare(
          String(b.product.item_name || ""),
          undefined,
          { numeric: true },
        );
      });
    }
    return result;
  }, [group?.variants]);

  const isReady = !isLoading && !error;
  const hasServingSizes = group?.sizeKind === "serving" ||
    Object.values(variantsByPortion).some((options) =>
      options.some(({ details }) => details.sizeKind === "serving"));
  const hasOunceSizes = group?.sizeKind === "oz" ||
    Object.values(variantsByPortion).some((options) =>
      options.some(({ details }) => details.sizeKind === "oz"));
  const hasScoopSizes = group?.sizeKind === "scoop" ||
    Object.values(variantsByPortion).some((options) =>
      options.some(({ details }) => details.sizeKind === "scoop"));
  const hasMeasuredSizes = hasOunceSizes || hasScoopSizes;
  const hasApparelSizes = group?.sizeKind === "apparel" ||
    Object.values(variantsByPortion).some((options) =>
      options.some(({ details }) => details.sizeKind === "apparel"));
  const hasServingFlavors = hasServingSizes && (group?.hasFlavorOptions ||
    Object.values(variantsByPortion).some((options) =>
      options.some(({ details }) => Boolean(details.flavorLabel))));
  // Half SKUs stay in group.variants for the two-flavor picker, but are never
  // offered as standalone orders or as a fallback when a whole price is absent.
  const portionVariants = variantsByPortion.whole;
  const servingSizes = Array.from(new Map(portionVariants
    .filter(({ details }) => details.servingSize)
    .map(({ details }) => [details.servingSize, details])).values());
  const activeServingSize = servingSizes.find((details) => details.servingSize === servingSize)
    || servingSizes[0];
  const variants = hasServingFlavors
    ? portionVariants.filter(({ details }) => details.servingSize === activeServingSize?.servingSize)
    : portionVariants;
  const isPlatter = isPlatterVariantGroup(group);
  const isChicken = isChickenVariantGroup(group);
  const supportsCombination = !hasMeasuredSizes &&
    (isChicken || (!hasServingSizes && (isPizzaVariantGroup(group) || isPlatter))) && Boolean(onSelectCombination);
  const CombinationOptions = isChicken ? ChickenCombinationOptions : isPlatter ? PlatterCombinationOptions : PizzaCombinationOptions;

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
      if (dialogRef.current && !dialogRef.current.contains(event.target)) {
        closeButtonRef.current?.focus();
      }
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

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        // Keep this portal on the Digital Menu's active theme, even if a
        // legacy screen has overridden the shared brand palette.
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
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[1024px] flex-col overflow-hidden rounded-[28px] border border-[var(--app-border)] bg-darkPrimary font-[Poppins-Regular] text-colorBrandLighter shadow-2xl outline-none sm:max-h-[calc(100dvh-3rem)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-7 sm:pt-7">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-[Poppins-Medium] uppercase tracking-[0.14em] text-colorBrandSecondary">
              Choose your product
            </p>
            <h2 id={titleId} className="break-words text-xl font-[Poppins-SemiBold] sm:text-2xl">
              {group?.item_name || "Product options"}
            </h2>
            <p id={descriptionId} className="mt-2 text-sm opacity-70">
              {hasApparelSizes
                ? "Choose a shirt size."
                : hasMeasuredSizes
                ? hasScoopSizes ? "Choose a serving size." : "Choose a size in ounces."
                : combinationMode && supportsCombination
                  ? isChicken
                    ? "Combine two different chicken flavors in one whole order of the same size."
                    : isPlatter
                      ? "Combine two different flavors in one whole chicken wings platter."
                      : "Combine two different flavors in one whole pizza."
                  : hasServingSizes
                  ? hasServingFlavors
                    ? "Choose Solo, Double, or Group, then select a flavor."
                    : "Choose a size: Solo, Double, or Group."
                    : isPlatter
                      ? "Order one whole platter with a single flavor or a 2-flavor combination."
                      : "Choose a size for one whole order."}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close product options"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-darkerPrimary text-colorBrandLighter hover:text-colorBrandSecondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-colorBrand"
          >
            <FiX size={22} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto px-5 pb-5 sm:px-7 sm:pb-7" aria-busy={isLoading}>
          {hasServingFlavors && !(combinationMode && supportsCombination) && isReady && servingSizes.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-[Poppins-Medium] opacity-70">Choose a size</p>
              <div role="group" aria-label="Size" className="grid grid-cols-3 gap-2 rounded-2xl bg-darkerPrimary p-2">
                {servingSizes.map((details) => (
                  <button
                    key={details.servingSize}
                    type="button"
                    aria-label={details.sizeLabel}
                    aria-pressed={details.servingSize === activeServingSize?.servingSize}
                    onClick={() => setServingSize(details.servingSize)}
                    className={`min-h-[64px] rounded-xl border-2 px-3 py-2 text-center font-[Poppins-SemiBold] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-colorBrand ${
                      details.servingSize === activeServingSize?.servingSize
                        ? "border-colorBrand bg-darkPrimary text-colorBrandSecondary"
                        : "border-transparent text-colorBrandLighter"
                    }`}
                  >
                    {details.sizeLabel}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isReady && supportsCombination && (
            <div role="group" aria-label={isChicken ? "Whole chicken flavors" : isPlatter ? "Whole platter flavors" : "Whole pizza flavors"} className="mt-4 grid grid-cols-2 gap-2">
              {[[false, "Single flavor"], [true, "Combine flavor"]].map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={combinationMode === value}
                  onClick={() => onCombinationModeChange?.(value)}
                  className={`rounded-xl border-2 px-3 py-3 text-sm font-[Poppins-Medium] focus-visible:outline focus-visible:outline-2 focus-visible:outline-colorBrand ${combinationMode === value ? `border-colorBrand ${isChicken ? "text-colorBrandLighter" : "text-colorBrandSecondary"}` : "border-[var(--app-border)] text-colorBrandLighter"}`}
                >{label}</button>
              ))}
            </div>
          )}

          {isLoading ? (
            <p role="status" className="py-10 text-center text-sm opacity-70">
              {isPlatter ? "Loading whole platter options and prices…" : "Loading available sizes and prices…"}
            </p>
          ) : error ? (
            <div className="py-7 text-center">
              <p role="alert" className="text-sm text-redAccent">{error}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 rounded-xl border-2 border-colorBrand px-5 py-3 font-[Poppins-Medium] text-colorBrandSecondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-colorBrand"
                >
                  Try again
                </button>
              )}
            </div>
          ) : combinationMode && supportsCombination ? (
            <CombinationOptions
              group={group}
              products={combinationOptions.products}
              isLoading={combinationOptions.isLoading}
              error={combinationOptions.error}
              onRetry={combinationOptions.retry}
              onSelect={onSelectCombination}
            />
          ) : variants.length === 0 ? (
            <p role="status" className="py-10 text-center text-sm opacity-70">
              {hasApparelSizes ? "No sizes are available right now." : "No whole-order options are available right now."}
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              <p className="text-sm font-[Poppins-Medium] opacity-70">
                {hasMeasuredSizes || hasApparelSizes
                  ? "Size options"
                  : hasServingSizes
                    ? hasServingFlavors
                      ? `${activeServingSize?.sizeLabel || "Size"} flavors`
                      : "Size options"
                    : "Whole options"}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {variants.map(({ product, details }, index) => {
                  const rawPrice = product.selling_price;
                  const price = rawPrice == null || String(rawPrice).trim() === "" ? NaN : Number(rawPrice);
                  const hasPrice = Number.isFinite(price) && price >= 0;
                  return (
                    <button
                      key={`${product.product_id ?? "variant"}-${index}`}
                      type="button"
                      data-product-id={product.product_id}
                      aria-label={`Select ${product.item_name}`}
                      disabled={!hasPrice}
                      onClick={() => { if (isReady && hasPrice) onSelect?.(product); }}
                      className="flex min-h-[76px] items-center justify-between gap-4 rounded-xl border border-[var(--app-border)] bg-darkerPrimary px-4 py-3 text-left hover:border-colorBrand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-colorBrand disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="min-w-0">
                        <span className="text-base font-[Poppins-SemiBold]">
                          {hasServingFlavors
                            ? details.flavorLabel
                            : details.sizeLabel || "Whole"}
                        </span>
                        <span className="mt-1 block break-words text-xs opacity-70">{product.item_name}</span>
                      </div>
                      <span className="shrink-0 text-right text-base font-[Poppins-SemiBold] text-colorBrandSecondary sm:text-lg">
                        {hasPrice ? `₱${priceFormatter.format(price)}` : "Price unavailable"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
};

export default ProductVariantModal;
