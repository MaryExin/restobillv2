"use client";

import React from "react";
import { FiCheck, FiLayers, FiInfo, FiDroplet } from "react-icons/fi";
import { motion } from "framer-motion";

const PosAppearance = ({
  isDark,
  accentColor,
  selectedColorObj,
  setSelectedColorObj,
  adaptivePalette,
  getContrastText,
}) => {
  const theme = {
    panel: isDark
      ? "bg-slate-900/40 border-white/5"
      : "bg-white border-slate-200 shadow-sm",
    panelSoft: isDark
      ? "bg-slate-950/50 border-slate-800"
      : "bg-slate-50 border-slate-200",
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-slate-400" : "text-slate-500",
    textSoft: isDark ? "text-slate-500" : "text-slate-400",
    previewBorder: isDark
      ? "border-slate-800 bg-slate-950/40"
      : "border-slate-200 bg-slate-50",
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* HERO */}
      <div
        className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 lg:p-10 ${theme.panel}`}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-[-40px] right-[-40px] h-40 w-40 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: accentColor }}
          />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.24em] uppercase border border-current/10 bg-white/5">
              <FiLayers size={12} style={{ color: accentColor }} />
              <span style={{ color: accentColor }}>Appearance</span>
            </div>

            <h2
              className={`mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase ${theme.textPrimary}`}
            >
              Accent & Branding
            </h2>

            <p className={`mt-3 text-sm max-w-2xl ${theme.textMuted}`}>
              Customize the system accent color used for active controls,
              highlights, buttons, and key visual indicators.
            </p>
          </div>

          <div className={`rounded-[24px] border px-5 py-4 ${theme.panelSoft}`}>
            <p
              className={`text-[10px] font-black tracking-[0.2em] uppercase ${theme.textSoft}`}
            >
              Current Accent
            </p>
            <p className={`mt-2 text-2xl font-black ${theme.textPrimary}`}>
              {selectedColorObj?.name || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* INFO */}
      <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
        <div className="flex items-start gap-4">
          <div
            className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
              isDark
                ? "bg-slate-950 border border-slate-800"
                : "bg-slate-50 border border-slate-200"
            }`}
          >
            <FiInfo size={18} style={{ color: accentColor }} />
          </div>

          <div>
            <p
              className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
            >
              Theme Information
            </p>
            <p className={`mt-2 text-sm leading-relaxed ${theme.textMuted}`}>
              The Dark and Light mode itself is currently controlled by the
              global system settings. This section changes the accent palette
              used across the POS interface.
            </p>
          </div>
        </div>
      </div>

      {/* PALETTE */}
      <div className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}>
        <div className="flex items-center gap-3 mb-6">
          <div
            className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
              isDark
                ? "bg-slate-950 border border-slate-800"
                : "bg-slate-50 border border-slate-200"
            }`}
          >
            <FiDroplet size={18} style={{ color: accentColor }} />
          </div>

          <div>
            <p
              className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
            >
              Accent Palette
            </p>
            <h3 className={`text-xl font-black ${theme.textPrimary}`}>
              Choose a color profile
            </h3>
          </div>
        </div>

        <div className={`rounded-[24px] border p-4 sm:p-6 ${theme.panelSoft}`}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {adaptivePalette.map((color) => {
              const isSelected = selectedColorObj?.name === color.name;
              const swatchColor = isDark ? color.dark : color.light;

              return (
                <motion.button
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.96 }}
                  key={color.name}
                  onClick={() => setSelectedColorObj(color)}
                  className={`rounded-[24px] border p-4 text-center transition-all ${
                    isSelected
                      ? isDark
                        ? "bg-slate-900 border-slate-700"
                        : "bg-white border-slate-300 shadow-sm"
                      : isDark
                        ? "bg-slate-950/40 border-slate-800"
                        : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div
                      className="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 shadow-lg"
                      style={{
                        backgroundColor: swatchColor,
                        borderColor: isSelected
                          ? isDark
                            ? "#ffffff"
                            : "#0f172a"
                          : "transparent",
                      }}
                    >
                      {isSelected && (
                        <FiCheck
                          size={26}
                          style={{ color: getContrastText() }}
                        />
                      )}
                    </div>

                    <p
                      className={`mt-4 text-[11px] font-black uppercase tracking-[0.14em] ${
                        isSelected ? theme.textPrimary : theme.textMuted
                      }`}
                    >
                      {color.name}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* PREVIEW */}
      <div
        className={`rounded-[28px] border p-6 sm:p-8 ${theme.previewBorder}`}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p
              className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
            >
              Visual Preview
            </p>
            <h3
              className={`mt-2 text-2xl sm:text-3xl font-black uppercase tracking-tight ${theme.textPrimary}`}
            >
              {selectedColorObj?.name} {isDark ? "Pastel" : "Deep"}
            </h3>
            <p className={`mt-3 text-sm max-w-2xl ${theme.textMuted}`}>
              This accent will be used for buttons, selected tabs, active
              indicators, and important highlights across the POS interface.
            </p>

            <div className="grid grid-cols-1 gap-4 mt-6 sm:grid-cols-3">
              <div
                className={`rounded-[20px] border p-4 ${
                  isDark
                    ? "bg-slate-900/50 border-slate-800"
                    : "bg-white border-slate-200"
                }`}
              >
                <p
                  className={`text-[10px] font-black tracking-[0.18em] uppercase ${theme.textSoft}`}
                >
                  Buttons
                </p>
                <div
                  className="mt-3 rounded-2xl px-4 py-3 text-center font-black uppercase tracking-[0.14em]"
                  style={{
                    backgroundColor: accentColor,
                    color: getContrastText(),
                  }}
                >
                  Primary
                </div>
              </div>

              <div
                className={`rounded-[20px] border p-4 ${
                  isDark
                    ? "bg-slate-900/50 border-slate-800"
                    : "bg-white border-slate-200"
                }`}
              >
                <p
                  className={`text-[10px] font-black tracking-[0.18em] uppercase ${theme.textSoft}`}
                >
                  Indicator
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: accentColor }}
                  />
                  <span className={`text-sm font-bold ${theme.textPrimary}`}>
                    Active status
                  </span>
                </div>
              </div>

              <div
                className={`rounded-[20px] border p-4 ${
                  isDark
                    ? "bg-slate-900/50 border-slate-800"
                    : "bg-white border-slate-200"
                }`}
              >
                <p
                  className={`text-[10px] font-black tracking-[0.18em] uppercase ${theme.textSoft}`}
                >
                  Highlight
                </p>
                <div
                  className="mt-3 rounded-2xl px-4 py-3 font-black uppercase tracking-[0.14em]"
                  style={{
                    backgroundColor: `${accentColor}20`,
                    color: accentColor,
                  }}
                >
                  Selected module
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-start lg:justify-end">
            <button
              className="px-8 sm:px-12 py-4 rounded-[22px] font-black uppercase text-[11px] tracking-[0.22em] shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: accentColor,
                color: getContrastText(),
                boxShadow: `0 20px 40px ${accentColor}35`,
              }}
            >
              Apply Theme
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PosAppearance;
