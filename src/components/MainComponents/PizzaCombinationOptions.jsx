import React, { useId, useMemo, useState } from "react";
import { getMenuVariantDetails } from "../../utils/menuProductVariants";
import {
  createPizzaCombination,
  getPizzaCombinationChoices,
  getPizzaCombinationSizes,
} from "../../utils/menuPizzaCombination";

const FLAVORS_PER_PAGE = 30;
const priceFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatPrice = (price) => `₱${priceFormatter.format(Number(price))}`;

const PizzaCombinationOptions = ({
  group,
  products = [],
  isLoading = false,
  error = "",
  onRetry,
  onSelect,
}) => {
  const searchId = useId();
  const [sizeSelection, setSizeSelection] = useState(null);
  const [flavorSelection, setFlavorSelection] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(null);
  const familyKey = group?.familyKey || group?.item_name || "";
  const isReady = !isLoading && !error;

  const sizes = useMemo(() => getPizzaCombinationSizes(group), [group]);
  const size = sizes.find((entry) =>
    sizeSelection?.familyKey === familyKey &&
    entry.sizeValue === sizeSelection.sizeValue,
  ) || sizes[0];
  const choices = useMemo(
    () => getPizzaCombinationChoices(group, size?.sizeValue, products),
    [group, size?.sizeValue, products],
  );
  // Resolve the selected ID against the current catalogue so a refreshed price
  // or a changed size cannot add a product from an older result.
  const secondHalf = flavorSelection?.familyKey === familyKey &&
    flavorSelection?.sizeValue === size?.sizeValue
    ? choices.find((product) => String(product.product_id) === flavorSelection.productId)
    : null;
  const combination = createPizzaCombination(size?.half, secondHalf);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredChoices = useMemo(() => {
    const terms = normalizedSearch.split(/\s+/u).filter(Boolean);
    return choices.filter((product) => {
      const name = String(product.item_name || "").toLowerCase();
      return terms.every((term) => name.includes(term));
    });
  }, [choices, normalizedSearch]);
  const pageKey = JSON.stringify([familyKey, size?.sizeValue, normalizedSearch]);
  const visibleCount = page?.key === pageKey ? page.count : FLAVORS_PER_PAGE;
  const visibleChoices = filteredChoices.slice(0, visibleCount);
  const firstFlavorName = size ? getMenuVariantDetails(size.half).baseName : group?.item_name;
  const secondFlavorName = secondHalf ? getMenuVariantDetails(secondHalf).baseName : "";

  return (
    <div className="mt-5 space-y-5 font-[Poppins-Regular]" aria-busy={isLoading}>
      <p className="text-sm opacity-70">
        Make one whole pizza with two different flavors of the same size.
        The total combines the prices of both flavor portions.
      </p>

      {sizes.length > 0 && (
        <div role="group" aria-label="Combination pizza size">
          <p className="mb-2 text-sm font-[Poppins-Medium]">Choose a size</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((entry) => {
              const selected = entry.sizeValue === size?.sizeValue;
              return (
                <button
                  key={entry.sizeValue}
                  type="button"
                  aria-label={`Combination size ${entry.sizeLabel}`}
                  aria-pressed={selected}
                  disabled={!isReady}
                  onClick={() => {
                    setSizeSelection({ familyKey, sizeValue: entry.sizeValue });
                    setFlavorSelection(null);
                    setPage(null);
                  }}
                  className={`min-h-[44px] min-w-[72px] rounded-xl border-2 px-4 py-2 font-[Poppins-SemiBold] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-colorBrand disabled:cursor-not-allowed disabled:opacity-40 ${
                    selected
                      ? "border-colorBrand bg-darkerPrimary text-colorBrandSecondary"
                      : "border-[var(--app-border)] text-colorBrandLighter hover:border-colorBrand"
                  }`}
                >
                  {entry.sizeLabel}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
      ) : !size ? (
        <p role="status" className="py-6 text-center text-sm opacity-70">
          This flavor is not available for a two-flavor pizza.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--app-border)] bg-darkerPrimary px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs opacity-70">First flavor · {size.sizeLabel} pizza</p>
              <p className="mt-1 break-words font-[Poppins-SemiBold]">{firstFlavorName}</p>
            </div>
            <span className="shrink-0 text-right font-[Poppins-SemiBold] text-colorBrandSecondary">
              {formatPrice(size.half.selling_price)}
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
              placeholder="Search flavors, e.g. cheese"
              autoComplete="off"
              className="min-h-[44px] w-full rounded-xl border-2 border-[var(--app-border)] bg-darkerPrimary px-4 py-3 text-sm text-colorBrandLighter placeholder:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-colorBrand"
            />
            {choices.length === 0 ? (
              <p role="status" className="py-4 text-sm opacity-70">
                No other flavors are available for a {size.sizeLabel} two-flavor pizza. Try another size.
              </p>
            ) : filteredChoices.length === 0 ? (
              <p role="status" className="py-4 text-sm opacity-70">
                No flavors match “{search.trim()}”. Try another word.
              </p>
            ) : (
              <>
                <div role="group" aria-label="Second flavor" className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {visibleChoices.map((product) => {
                    const flavorName = getMenuVariantDetails(product).baseName;
                    const selected = product === secondHalf;
                    return (
                      <button
                        key={product.product_id}
                        type="button"
                        aria-label={`Second flavor ${flavorName}, ${size.sizeLabel}, flavor portion price ${formatPrice(product.selling_price)}`}
                        aria-pressed={selected}
                        onClick={() => setFlavorSelection({
                          familyKey,
                          sizeValue: size.sizeValue,
                          productId: String(product.product_id),
                        })}
                        className={`flex min-h-[64px] items-center justify-between gap-4 rounded-xl border bg-darkerPrimary px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-colorBrand ${
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
                {visibleChoices.length < filteredChoices.length && (
                  <button
                    type="button"
                    onClick={() => setPage({ key: pageKey, count: visibleCount + FLAVORS_PER_PAGE })}
                    className="min-h-[44px] w-full rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm text-colorBrandSecondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-colorBrand"
                  >
                    Show more flavors ({filteredChoices.length - visibleChoices.length} remaining)
                  </button>
                )}
              </>
            )}
          </div>

          <div className="space-y-3 border-t border-[var(--app-border)] pt-4">
            <div aria-live="polite" aria-atomic="true">
              {combination ? (
                <>
                  <p className="break-words text-sm opacity-70">
                    {firstFlavorName} + {secondFlavorName} · {size.sizeLabel} Whole
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
                if (isReady && combination) onSelect?.(size.half, secondHalf);
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

export default PizzaCombinationOptions;
