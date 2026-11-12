import React from "react";
import { FaLock } from "react-icons/fa";
import "../../../fonts/font-style.css";

// Icon chip colors per tone. Every tile shares the same glass body so the
// dock reads as one set; only the icon chip carries the color.
const TONES = {
  green: ["#34d399", "#059669"],
  violet: ["#c084fc", "#7e22ce"],
  orange: ["#fdba74", "#ea580c"],
  indigo: ["#a5b4fc", "#4f46e5"],
  cyan: ["#67e8f9", "#0e7490"],
  sky: ["#7dd3fc", "#0284c7"],
  amber: ["#fcd34d", "#d97706"],
  rose: ["#fda4af", "#e11d48"],
  blue: ["#93c5fd", "#2563eb"],
  slate: ["#cbd5e1", "#475569"],
};

const GOLD = "#f8dc8b";

/**
 * Home dock tile.
 * - variant="primary": gold tile for the main action (e.g. New Transaction)
 * - active: marks the current page
 * - hint: shown as the tooltip when the tile is disabled (why it is locked)
 */
const PosQuickActionTile = ({
  label,
  icon,
  color = "slate",
  disabled = false,
  onClick,
  variant = "default",
  active = false,
  hint = "",
}) => {
  const [toneFrom, toneTo] = TONES[color] || TONES.slate;
  const isPrimary = variant === "primary" && !disabled;

  let background =
    "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 100%)";
  let border = "1px solid rgba(255,255,255,0.16)";
  let boxShadow =
    "0 10px 24px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.12)";

  if (isPrimary) {
    background =
      "linear-gradient(160deg, #fbe39a 0%, #e6b84a 52%, #b8860b 100%)";
    border = "1px solid rgba(255,240,200,0.9)";
    boxShadow =
      "0 14px 30px rgba(201,151,28,0.38), inset 0 1px 0 rgba(255,255,255,0.6)";
  } else if (active) {
    border = `1px solid ${GOLD}`;
    boxShadow =
      "0 0 0 3px rgba(248,220,139,0.22), 0 12px 26px rgba(0,0,0,0.28)";
  }

  const chipBackground = disabled
    ? "linear-gradient(160deg, #94a3b8 0%, #64748b 100%)"
    : isPrimary
      ? "linear-gradient(160deg, #5b21b6 0%, #2e1065 100%)"
      : `linear-gradient(160deg, ${toneFrom} 0%, ${toneTo} 100%)`;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={disabled && hint ? hint : label}
      aria-label={disabled && hint ? `${label} (${hint})` : label}
      aria-current={active ? "page" : undefined}
      className={`group relative flex h-[92px] w-[96px] shrink-0 flex-col items-center justify-center gap-2 rounded-[20px] px-2 text-center transition-all duration-200 ${
        disabled
          ? "cursor-not-allowed"
          : "hover:-translate-y-1 hover:brightness-110 active:scale-[0.97]"
      }`}
      style={{
        background,
        border,
        boxShadow,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {disabled && (
        <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[rgba(0,0,0,0.35)] text-[rgba(255,255,255,0.8)]">
          <FaLock className="text-[9px]" />
        </span>
      )}

      {active && !isPrimary && (
        <span
          className="absolute bottom-1.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full"
          style={{ backgroundColor: GOLD }}
        />
      )}

      <span
        className="grid h-11 w-11 place-items-center rounded-2xl text-[#fff] transition-transform duration-200 group-hover:scale-105 [&_svg]:!text-[20px]"
        style={{
          background: chipBackground,
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 14px rgba(0,0,0,0.18)",
        }}
      >
        {icon}
      </span>

      <span
        className={`line-clamp-2 font-[Poppins-SemiBold] text-[11.5px] leading-tight ${
          isPrimary ? "text-[#2e1065]" : "text-[#fff]"
        }`}
      >
        {label}
      </span>
    </button>
  );
};

export default PosQuickActionTile;
