import React from "react";
import { FiSearch } from "react-icons/fi";

const RetailTopBar = ({
  categories = [],
  selectedCategory,
  onSelectCategory,
  searchValue = "",
  onSearchChange,
  onBarcodeSubmit,
}) => {
  return (
    <div className="shrink-0">
      {/* ── Category tabs ── */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 px-4 pt-4 pb-1 overflow-x-auto no-scrollbar">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => onSelectCategory?.(cat)}
                className="shrink-0 px-4 py-1.5 rounded-full text-[12px] font-bold transition-all"
                style={
                  isActive
                    ? {
                        background:
                          "linear-gradient(180deg, var(--app-accent) 0%, var(--app-accent-secondary) 100%)",
                        color: "#fff",
                        boxShadow: "0 4px 12px var(--app-accent-glow)",
                      }
                    : {
                        border: "1px solid var(--app-border)",
                        color: "var(--app-muted-text)",
                        background: "var(--app-surface)",
                      }
                }
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Prominent scan/search bar ── */}
      <div className="p-4">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            onBarcodeSubmit?.(searchValue);
          }}
        >
          <FiSearch
            size={20}
            className="absolute -translate-y-1/2 left-5 top-1/2"
            style={{ color: "var(--app-accent)" }}
          />
          <input
            type="text"
            autoFocus
            placeholder="Scan Item Barcode or Type SKU..."
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full rounded-2xl border-2 py-4 pl-14 pr-4 text-base font-semibold outline-none transition-colors"
            style={{
              borderColor: "var(--app-accent)",
              background: "var(--app-surface)",
              color: "var(--app-text)",
              boxShadow: "0 8px 24px var(--app-accent-glow)",
            }}
          />
        </form>
      </div>
    </div>
  );
};

export default RetailTopBar;
