"use client";
/* eslint-disable react/prop-types */

import { useState } from "react";
import { FiFileText, FiChevronDown } from "react-icons/fi";
import { GUIDE_SECTIONS } from "../../../constants/TutorialGuideSections";

const PosTutorialGuide = ({ isDark, accent = "#3b82f6" }) => {
  const [openIndex, setOpenIndex] = useState(0);

  const theme = {
    panel: isDark
      ? "bg-slate-900/40 border-white/5"
      : "bg-white border-slate-200 shadow-sm",
    panelSoft: isDark
      ? "bg-slate-950/50 border-slate-800"
      : "bg-slate-50 border-slate-200",
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-slate-400" : "text-slate-500",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 ${theme.panel}`}>
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.24em] uppercase border border-current/10 bg-white/5">
          <FiFileText size={12} style={{ color: accent }} />
          <span style={{ color: accent }}>Help &amp; Guides</span>
        </div>

        <h2
          className={`mt-4 text-3xl sm:text-4xl font-black tracking-tight uppercase ${theme.textPrimary}`}
        >
          Tutorial Guide
        </h2>

        <p className={`mt-3 max-w-2xl text-sm ${theme.textMuted}`}>
          A quick walkthrough of the main POS workflows, from opening your
          shift to closing it at the end of the day.
        </p>
      </div>

      <div className="space-y-3">
        {GUIDE_SECTIONS.map((section, index) => {
          const Icon = section.icon;
          const isOpen = openIndex === index;

          return (
            <div
              key={section.title}
              className={`overflow-hidden rounded-[24px] border transition-all ${theme.panel}`}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                className="flex items-center justify-between w-full gap-4 px-5 py-4 text-left sm:px-6"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex items-center justify-center w-10 h-10 rounded-2xl shrink-0"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`,
                    }}
                  >
                    <Icon size={18} style={{ color: accent }} />
                  </span>
                  <span className={`text-sm font-black sm:text-base ${theme.textPrimary}`}>
                    {section.title}
                  </span>
                </div>

                <FiChevronDown
                  size={18}
                  className={`shrink-0 transition-transform duration-300 ${
                    isOpen ? "rotate-180" : ""
                  } ${theme.textMuted}`}
                />
              </button>

              {isOpen && (
                <div className={`px-5 pb-5 sm:px-6 ${theme.textMuted}`}>
                  <ul className={`space-y-3 rounded-2xl border p-4 sm:p-5 ${theme.panelSoft}`}>
                    {section.steps.map((step, stepIndex) => (
                      <li key={stepIndex} className="flex gap-3 text-sm leading-relaxed">
                        <span
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
                          style={{
                            backgroundColor: accent,
                            color: isDark ? "#0f172a" : "#ffffff",
                          }}
                        >
                          {stepIndex + 1}
                        </span>
                        <span className={theme.textPrimary}>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PosTutorialGuide;
