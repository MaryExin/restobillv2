import React from "react";
import { FiMonitor, FiShoppingCart, FiShoppingBag } from "react-icons/fi";
import useZustandLayoutMode from "../../../context/useZustandLayoutMode";

const MODES = [
  {
    id: "Restaurant",
    icon: FiMonitor,
    label: "Restaurant",
    description:
      "Standard POS layout with cart summary panel. Best for dine-in and table-service restaurants.",
  },
  {
    id: "Restaurant Version 2",
    icon: FiShoppingBag,
    label: "Retail POS",
    description:
      "Standard layout optimized for retail, groceries, and boutique shops. Features barcode-focused scanning and quick checkout workflow.",
  },
  {
    id: "Kiosk",
    icon: FiShoppingCart,
    label: "Kiosk Mode",
    description:
      "Self-service kiosk layout with quick-cash denominations, financial summary, and Charge / Grab actions.",
  },
];

const PosLayoutMode = ({ isDark, accent }) => {
  const { layoutMode, setLayoutMode } = useZustandLayoutMode();

  return (
    <div className="p-6 max-w-lg">
      <h2
        className="text-lg font-black mb-1"
        style={{ color: isDark ? "#fff" : "#0f172a" }}
      >
        System Layout Mode
      </h2>
      <p
        className="text-xs mb-6"
        style={{ color: isDark ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.55)" }}
      >
        Choose how the main ordering screen is displayed. Changes apply
        immediately.
      </p>

      <div className="flex flex-col gap-3">
        {MODES.map(({ id, icon: Icon, label, description }) => {
          const isActive = layoutMode === id;
          return (
            <button
              key={id}
              onClick={() => setLayoutMode(id)}
              className="flex items-start gap-4 w-full text-left p-4 rounded-2xl border transition-all"
              style={{
                borderColor: isActive ? accent : (isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.1)"),
                backgroundColor: isActive
                  ? isDark
                    ? "rgba(37,99,235,0.12)"
                    : "rgba(37,99,235,0.06)"
                  : isDark
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(15,23,42,0.02)",
                boxShadow: isActive ? `0 0 0 2px ${accent}` : "none",
              }}
            >
              <div
                className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 mt-0.5"
                style={{
                  background: isActive
                    ? accent
                    : isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(15,23,42,0.06)",
                }}
              >
                <Icon
                  size={18}
                  style={{ color: isActive ? "#fff" : isDark ? "rgba(255,255,255,0.5)" : "rgba(15,23,42,0.5)" }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className="font-bold text-sm"
                  style={{
                    color: isActive
                      ? accent
                      : isDark
                        ? "#fff"
                        : "#0f172a",
                  }}
                >
                  {label}
                  {isActive && (
                    <span
                      className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: accent,
                        color: "#fff",
                      }}
                    >
                      Active
                    </span>
                  )}
                </p>
                <p
                  className="text-xs mt-1 leading-relaxed"
                  style={{
                    color: isDark ? "rgba(255,255,255,0.5)" : "rgba(15,23,42,0.5)",
                  }}
                >
                  {description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PosLayoutMode;
