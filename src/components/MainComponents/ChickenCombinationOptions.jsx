import React, { useMemo, useState } from "react";
import {
  createChickenCombination,
  getChickenCombinationChoices,
  getChickenCombinationSizes,
  getChickenVariantDetails,
} from "../../utils/menuChickenCombination";

const priceFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatPrice = (value) => `₱${priceFormatter.format(Number(value))}`;

const ChickenCombinationOptions = ({
  group,
  products = [],
  isLoading = false,
  error = "",
  onRetry,
  onSelect,
}) => {
  const [sizeSelection, setSizeSelection] = useState(null);
  const [firstSelection, setFirstSelection] = useState(null);
  const [secondSelection, setSecondSelection] = useState(null);
  const familyKey = group?.familyKey || `${group?.item_category || ""}:${group?.item_name || ""}`;
  const isReady = !isLoading && !error;
  const sizes = useMemo(() => getChickenCombinationSizes(group), [group]);
  const size = sizes.find((entry) => sizeSelection?.familyKey === familyKey &&
    entry.servingSize === sizeSelection.servingSize) || sizes[0];
  const sizeKey = JSON.stringify([familyKey, size?.servingSize]);
  // Resolve both selected IDs from current rows so refreshed prices are used
  // and a removed choice cannot silently become a different flavor.
  const first = firstSelection?.sizeKey === sizeKey
    ? size?.options.find(({ half }) => String(half.product_id) === firstSelection.productId)
    : size?.options[0];
  const firstHalf = first?.half;
  const choices = useMemo(() => firstHalf
    ? getChickenCombinationChoices(group, size?.servingSize, products, firstHalf)
    : [], [group, size?.servingSize, products, firstHalf]);
  const secondKey = JSON.stringify([sizeKey, firstHalf?.product_id]);
  const secondHalf = secondSelection?.key === secondKey
    ? choices.find((product) => String(product.product_id) === secondSelection.productId)
    : null;
  const combination = createChickenCombination(firstHalf, secondHalf);
  const secondFlavorName = secondHalf ? getChickenVariantDetails(secondHalf)?.flavorLabel : "";

  const flavorButton = (product, label, selected, onClick, position) => (
    <button
      key={product.product_id}
      type="button"
      aria-label={`${position} flavor ${label}, ${size.sizeLabel}, flavor portion price ${formatPrice(product.selling_price)}`}
      aria-pressed={selected}
      disabled={!isReady}
      onClick={() => { if (isReady) onClick(); }}
      className={`flex min-h-[76px] items-center justify-between gap-4 rounded-2xl border-2 bg-darkerPrimary px-4 py-3 text-left text-colorBrandLighter transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-colorBrand disabled:cursor-not-allowed disabled:opacity-40 ${
        selected ? "border-colorBrand" : "border-[var(--app-border)] hover:border-colorBrand"
      }`}
    >
      <span className="min-w-0 break-words text-sm font-[Poppins-SemiBold]">{label}</span>
      <span className="shrink-0 text-right font-[Poppins-SemiBold]">
        {formatPrice(product.selling_price)}
        <span className="block text-xs font-[Poppins-Regular] opacity-70">/ flavor portion</span>
      </span>
    </button>
  );

  return (
    <div className="mt-5 space-y-5 font-[Poppins-Regular] text-colorBrandLighter" aria-busy={isLoading}>
      <p className="text-sm opacity-70">
        Make one whole order with two different flavors of the same size.
        The total combines the prices of both flavor portions.
      </p>

      {sizes.length > 0 && (
        <div role="group" aria-label="Chicken combination size">
          <p className="mb-2 text-sm font-[Poppins-Medium]">Choose a size</p>
          <div className="grid grid-cols-3 gap-2">
            {sizes.map((entry) => (
              <button
                key={entry.servingSize}
                type="button"
                aria-label={`Chicken combination size ${entry.sizeLabel}`}
                aria-pressed={entry.servingSize === size?.servingSize}
                disabled={!isReady}
                onClick={() => {
                  if (!isReady) return;
                  setSizeSelection({ familyKey, servingSize: entry.servingSize });
                  setFirstSelection(null);
                  setSecondSelection(null);
                }}
                className={`min-h-[48px] rounded-xl border-2 px-3 py-2 text-colorBrandLighter font-[Poppins-SemiBold] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-colorBrand disabled:cursor-not-allowed disabled:opacity-40 ${
                  entry.servingSize === size?.servingSize ? "border-colorBrand bg-darkerPrimary" : "border-[var(--app-border)] hover:border-colorBrand"
                }`}
              >
                {entry.sizeLabel}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <p role="status" className="py-6 text-center text-sm opacity-70">Loading available chicken flavors and prices…</p>
      ) : error ? (
        <div className="py-4 text-center">
          <p role="alert" className="text-sm text-redAccent">{error}</p>
          {onRetry && <button type="button" onClick={onRetry} className="mt-4 min-h-[44px] rounded-xl border-2 border-colorBrand px-5 py-3 font-[Poppins-Medium] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-colorBrand">Try again</button>}
        </div>
      ) : !size ? (
        <p role="status" className="py-6 text-center text-sm opacity-70">No sizes are available to combine right now.</p>
      ) : (
        <>
          <div role="group" aria-label="First chicken flavor" className="space-y-3">
            <p className="text-sm font-[Poppins-Medium]">Choose the first flavor</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {size.options.map((option) => flavorButton(
                option.half,
                option.flavorLabel,
                option === first,
                () => {
                  setFirstSelection({ sizeKey, productId: String(option.half.product_id) });
                  setSecondSelection(null);
                },
                "First",
              ))}
            </div>
          </div>

          {!firstHalf ? (
            <p role="status" className="text-sm opacity-70">The selected first flavor is unavailable. Choose a first flavor to continue.</p>
          ) : choices.length === 0 ? (
            <p role="status" className="text-sm opacity-70">No other flavors are available in {size.sizeLabel}. Try another size.</p>
          ) : (
            <div role="group" aria-label="Second chicken flavor" className="space-y-3">
              <p className="text-sm font-[Poppins-Medium]">Choose a different second flavor</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {choices.map((product) => flavorButton(
                  product,
                  getChickenVariantDetails(product).flavorLabel,
                  product === secondHalf,
                  () => setSecondSelection({ key: secondKey, productId: String(product.product_id) }),
                  "Second",
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4 border-t border-[var(--app-border)] pt-4">
            <div aria-live="polite" aria-atomic="true">
              {combination ? (
                <>
                  <p className="break-words text-sm opacity-70">{first.flavorLabel} + {secondFlavorName} · {size.sizeLabel} whole order</p>
                  <div className="mt-2 flex items-center justify-between gap-4">
                    <span className="font-[Poppins-Medium]">Order total</span>
                    <span className="text-xl font-[Poppins-SemiBold]">{formatPrice(combination.total)}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm opacity-70">Select two different flavors to see the order total.</p>
              )}
            </div>
            <button
              type="button"
              disabled={!isReady || !combination}
              onClick={() => { if (isReady && combination) onSelect?.(firstHalf, secondHalf); }}
              className="min-h-[52px] w-full rounded-2xl bg-colorBrand px-5 py-3 font-[Poppins-SemiBold] text-white transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-colorBrand disabled:cursor-not-allowed disabled:opacity-40"
            >
              Combine flavor
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ChickenCombinationOptions;
