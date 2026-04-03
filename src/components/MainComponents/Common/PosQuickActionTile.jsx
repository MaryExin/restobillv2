import React from "react";

const PosQuickActionTile = ({
  label,
  icon,
  color = "slate",
  disabled = false,
  onClick,
}) => {
  const getTileStyle = () => {
    if (disabled) {
      return {
        background:
          "linear-gradient(180deg, rgba(148,163,184,0.78) 0%, rgba(100,116,139,0.82) 100%)",
        color: "rgba(255,255,255,0.72)",
        border: "1px solid rgba(255,255,255,0.18)",
        boxShadow:
          "0 10px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.12)",
      };
    }

    switch (color) {
      case "green":
        return {
          background:
            "linear-gradient(180deg, rgba(34,197,94,0.92) 0%, rgba(22,163,74,0.96) 100%)",
          color: "#ffffff",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow:
            "0 12px 28px rgba(22,163,74,0.30), inset 0 1px 0 rgba(255,255,255,0.18)",
        };

      case "violet":
        return {
          background:
            "linear-gradient(180deg, rgba(168,85,247,0.92) 0%, rgba(126,34,206,0.96) 100%)",
          color: "#ffffff",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow:
            "0 12px 28px rgba(126,34,206,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
        };

      case "orange":
        return {
          background:
            "linear-gradient(180deg, rgba(251,146,60,0.94) 0%, rgba(234,88,12,0.98) 100%)",
          color: "#ffffff",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow:
            "0 12px 28px rgba(234,88,12,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
        };

      case "indigo":
        return {
          background:
            "linear-gradient(180deg, rgba(99,102,241,0.92) 0%, rgba(67,56,202,0.96) 100%)",
          color: "#ffffff",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow:
            "0 12px 28px rgba(67,56,202,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
        };

      case "cyan":
        return {
          background:
            "linear-gradient(180deg, rgba(34,211,238,0.92) 0%, rgba(14,116,144,0.96) 100%)",
          color: "#ffffff",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow:
            "0 12px 28px rgba(8,145,178,0.26), inset 0 1px 0 rgba(255,255,255,0.18)",
        };

      case "sky":
        return {
          background:
            "linear-gradient(180deg, rgba(56,189,248,0.92) 0%, rgba(2,132,199,0.96) 100%)",
          color: "#ffffff",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow:
            "0 12px 28px rgba(2,132,199,0.26), inset 0 1px 0 rgba(255,255,255,0.18)",
        };

      case "amber":
        return {
          background:
            "linear-gradient(180deg, rgba(251,191,36,0.94) 0%, rgba(217,119,6,0.98) 100%)",
          color: "#ffffff",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow:
            "0 12px 28px rgba(217,119,6,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
        };

      default:
        return {
          background:
            "linear-gradient(180deg, rgba(100,116,139,0.84) 0%, rgba(71,85,105,0.90) 100%)",
          color: "rgba(255,255,255,0.94)",
          border: "1px solid rgba(255,255,255,0.16)",
          boxShadow:
            "0 10px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.12)",
        };
    }
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group relative min-h-[86px] rounded-[18px] px-2 py-2 text-center transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-90 sm:min-h-[92px] sm:w-[96px] sm:rounded-[20px] sm:px-2.5 sm:py-2.5"
      style={getTileStyle()}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02)_38%,rgba(255,255,255,0.00)_100%)]" />

      <div className="relative flex h-full flex-col items-center justify-center gap-1.5 sm:gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-[2px] transition-transform duration-200 group-hover:scale-105 sm:h-11 sm:w-11">
          <div className="opacity-95">{icon}</div>
        </div>

        <div className="text-[11px] font-semibold leading-tight tracking-[0.01em] sm:text-[12px]">
          {label}
        </div>
      </div>
    </button>
  );
};

export default PosQuickActionTile;
