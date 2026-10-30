import React, { useId, useMemo, useState } from "react";
import { getMenuVariantDetails } from "../../utils/menuProductVariants";
import {
  createPlatterCombination,
  getPlatterCombinationChoices,
  getPlatterCombinationPair,
} from "../../utils/menuPlatterCombination";

const priceFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatPrice = (price) => `₱${priceFormatter.format(Number(price))}`;

const PlatterCombinationOptions = ({
  group,
  products = [],
  isLoading = false,
  error = "",
  onRetry,
  onSelect,
}) => {
  const searchId = useId();
  const [flavorSelection, setFlavorSelection] = useState(null);
  const [search, setSearch] = useState("");
  const familyKey = group?.familyKey || group?.item_name || "";
  const isReady = !isLoading && !error;
  const pair = useMemo(() => getPlatterCombinationPair(group), [group]);
  const choices = useMemo(() => getPlatterCombinationChoices(group, products), [group, products]);
  // Resolve the ID against the current catalog to preserve refreshed prices
  // and reject choices removed while the picker is open.
  const secondHalf = flavorSelection?.familyKey === familyKey
    ? choices.find((product) => String(product.product_id) === flavorSelection.productId)
    : null;
  const combination = createPlatterCombination(pair?.half, secondHalf);
  const searchTerms = search.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  const filteredChoices = choices.filter((product) => {
    const name = String(product.item_name || "").toLowerCase();
    return searchTerms.every((term) => name.includes(term));
  });
  const firstFlavorName = pair ? getMenuVariantDetails(pair.half).baseName : group?.item_name;
  const secondFlavorName = secondHalf ? getMenuVariantDetails(secondHalf).baseName : "";

  return (
    <div className="mt-5 space-y-5 font-[Poppins-Regular]" aria-busy={isLoading}>
      <p className="text-sm opacity-70">
        Make one whole chicken wings platter with two different flavors.
        The total combines the prices of both flavor portions.
      </p>

      {isLoading ? (
        <p role="status" className="py-6 text-center text-sm opacity-70">
          Loading available flavors and portion prices…
        </p>
      ) : error ? (
        <div className="py-4 text-center">
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
      ) : !pair ? (
        <p role="status" className="py-6 text-center text-sm opacity-70">
          This flavor is not available for a two-flavor platter.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--app-border)] bg-darkerPrimary px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs opacity-70">First flavor</p>
              <p className="mt-1 break-words font-[Poppins-SemiBold]">{firstFlavorName}</p>
            </div>
            <span className="shrink-0 text-right font-[Poppins-SemiBold] text-colorBrandSecondary">
              {formatPrice(pair.half.selling_price)}
              <span className="block text-xs font-[Poppins-Regular] text-colorBrandLighter opacity-70">/ flavor portion</span>
            </span>
          </div>

          <div className="space-y-3">
            <label htmlFor={searchId} className="block text-sm font-[Poppins-Medium]">
              Choose a different second flavor
            </label>
            <input
              id={searchId}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search flavors, e.g. honey"
              autoComplete="off"
              className="min-h-[44px] w-full rounded-xl border-2 border-[var(--app-border)] bg-darkerPrimary px-4 py-3 text-sm text-colorBrandLighter placeholder:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-colorBrand"
            />
            {choices.length === 0 ? (
              <p role="status" className="py-4 text-sm opacity-70">
                No other flavors are available for a two-flavor platter.
              </p>
            ) : filteredChoices.length === 0 ? (
              <p role="status" className="py-4 text-sm opacity-70">
                No flavors match “{search.trim()}”. Try another word.
              </p>
            ) : (
              <div role="group" aria-label="Second flavor" className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {filteredChoices.map((product) => {
                  const flavorName = getMenuVariantDetails(product).baseName;
                  const selected = product === secondHalf;
                  return (
                    <button
                      key={product.product_id}
                      type="button"
                      aria-label={`Second flavor ${flavorName}, flavor portion price ${formatPrice(product.selling_price)}`}
                      aria-pressed={selected}
                      onClick={() => setFlavorSelection({ familyKey, productId: String(product.product_id) })}
                      className={`flex min-h-[64px] items-center justify-between gap-4 rounded-xl border bg-darkerPrimary px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-colorBrand ${
                        selected ? "border-colorBrand ring-1 ring-colorBrand" : "border-[var(--app-border)] hover:border-colorBrand"
                      }`}
                    >
                      <span className="min-w-0 break-words text-sm font-[Poppins-SemiBold]">{flavorName}</span>
                      <span className="shrink-0 text-right text-base font-[Poppins-SemiBold] text-colorBrandSecondary">
                        {formatPrice(product.selling_price)}
                        <span className="block text-xs font-[Poppins-Regular] text-colorBrandLighter opacity-70">/ flavor portion</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-[var(--app-border)] pt-4">
            <div aria-live="polite" aria-atomic="true">
              {combination ? (
                <>
                  <p className="break-words text-sm opacity-70">
                    {firstFlavorName} + {secondFlavorName} · Whole platter
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-4">
                    <span className="font-[Poppins-Medium]">Combination total</span>
                    <span className="text-xl font-[Poppins-SemiBold] text-colorBrandSecondary">
                      {formatPrice(combination.total)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm opacity-70">Select a second flavor to see the combination total.</p>
              )}
            </div>
            <button
              type="button"
              disabled={!isReady || !combination}
              onClick={() => {
                if (isReady && combination) onSelect?.(pair.half, secondHalf);
              }}
              className="min-h-[48px] w-full rounded-xl bg-colorBrand px-5 py-3 font-[Poppins-SemiBold] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-colorBrand disabled:cursor-not-allowed disabled:opacity-40"
            >
              Combine flavor
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default PlatterCombinationOptions;
