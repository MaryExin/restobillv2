/* eslint-disable react/prop-types */
import { useState } from "react";
import { FaQuestionCircle } from "react-icons/fa";
import { FiX } from "react-icons/fi";
import { useTheme } from "../../context/ThemeContext";
import { GUIDE_SECTIONS } from "../../constants/TutorialGuideSections";

// section must match a `title` in GUIDE_SECTIONS (src/constants/TutorialGuideSections.jsx)
const TutorialTip = ({ section, title }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [isOpen, setIsOpen] = useState(false);

  const guide = GUIDE_SECTIONS.find((item) => item.title === section);
  if (!guide) return null;
  const Icon = guide.icon;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title={title || `How to use ${section}`}
        className={`p-3 rounded-2xl border-2 transition-all ${
          isDark
            ? "bg-white/5 border-white/10 text-white"
            : "bg-slate-100 border-slate-200 text-slate-600"
        }`}
      >
        <FaQuestionCircle size={18} />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-[28px] border p-6 shadow-2xl ${
              isDark
                ? "bg-slate-900 border-white/10"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 shrink-0">
                  <Icon size={18} />
                </span>
                <h3
                  className={`text-base font-black uppercase tracking-tight ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {guide.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={`shrink-0 p-1 rounded-lg ${
                  isDark
                    ? "text-slate-400 hover:text-white"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                <FiX size={18} />
              </button>
            </div>

            <ul className="space-y-3">
              {guide.steps.map((step, index) => (
                <li key={index} className="flex gap-3 text-sm leading-relaxed">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-black text-white">
                    {index + 1}
                  </span>
                  <span className={isDark ? "text-slate-300" : "text-slate-700"}>
                    {step}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
};

export default TutorialTip;
