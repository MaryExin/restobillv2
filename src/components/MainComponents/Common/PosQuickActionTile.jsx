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
          "linear-gradient(180deg, rgba(180,180,180,0.95) 0%, rgba(145,145,145,0.95) 100%)",
        color: "rgba(255,255,255,0.70)",
        border: "1px solid rgba(255,255,255,0.30)",
      };
    }

    switch (color) {
      case "green":
        return {
          background: "linear-gradient(180deg, #1db40d 0%, #169c0d 100%)",
          color: "#ffffff",
          border: "1px solid rgba(255,255,255,0.35)",
        };
      case "violet":
        return {
          background: "linear-gradient(180deg, #d01cf7 0%, #9f13da 100%)",
          color: "#ffffff",
          border: "1px solid rgba(255,255,255,0.35)",
        };
      case "orange":
        return {
          background: "linear-gradient(180deg, #ff6a22 0%, #ef4e18 100%)",
          color: "#ffffff",
          border: "1px solid rgba(255,255,255,0.35)",
        };
      case "indigo":
        return {
          background: "linear-gradient(180deg, #5d25e6 0%, #4a22ce 100%)",
          color: "#ffffff",
          border: "1px solid rgba(255,255,255,0.35)",
        };
      default:
        return {
          background:
            "linear-gradient(180deg, rgba(180,180,180,0.95) 0%, rgba(145,145,145,0.95) 100%)",
          color: "rgba(255,255,255,0.90)",
          border: "1px solid rgba(255,255,255,0.30)",
        };
    }
  };

  return (
    <button
      type="button"
      disabled={disabled}
      className="group min-h-[86px] rounded-[16px] px-2 py-2 text-center shadow-[0_10px_24px_rgba(0,0,0,0.14)] transition active:scale-[0.98] disabled:cursor-not-allowed sm:min-h-[92px] sm:w-[96px] sm:rounded-[18px] sm:px-2.5 sm:py-2.5"
      style={getTileStyle()}
      onClick={onClick}
    >
      <div className="flex h-full flex-col items-center justify-center gap-1.5 sm:gap-2">
        <div className="opacity-95">{icon}</div>
        <div className="text-[11px] sm:text-[12px] font-semibold leading-tight">
          {label}
        </div>
      </div>
    </button>
  );
};

export default PosQuickActionTile;
