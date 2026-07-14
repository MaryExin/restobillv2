import React from "react";
import { FiCrosshair } from "react-icons/fi";

const RetailEmptyState = ({ quickKeys = [] }) => {
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-0 gap-5 px-6 py-10 text-center">
      <div
        className="flex items-center justify-center rounded-full w-24 h-24"
        style={{ background: "var(--app-accent-soft)" }}
      >
        <FiCrosshair size={40} style={{ color: "var(--app-accent)" }} />
      </div>

      <div>
        <h3 className="text-lg font-black" style={{ color: "var(--app-text)" }}>
          Ready for First Item
        </h3>
        <p
          className="max-w-sm mx-auto mt-2 text-sm leading-relaxed"
          style={{ color: "var(--app-muted-text)" }}
        >
          Scan a product barcode to begin or use the quick-keys below for
          non-scannable items.
        </p>
      </div>

      {quickKeys.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {quickKeys.map((key) => (
            <button
              key={key.label}
              onClick={key.onClick}
              className="px-4 py-2 text-xs font-bold transition-colors border rounded-xl hover:opacity-80"
              style={{
                borderColor: "var(--app-border)",
                background: "var(--app-surface)",
                color: "var(--app-text)",
              }}
            >
              {key.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RetailEmptyState;
