import React from "react";
import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "../../context/ThemeContext";

const GlobalThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      // Positioning: Center Top
      className={`fixed top-5 left-1/2 z-[100] -translate-x-1/2 flex h-10 w-10 items-center justify-center rounded-full border shadow-xl backdrop-blur-md transition-all hover:scale-110 active:scale-90 ${
        isDark 
          ? "border-white/10 bg-slate-900/40 text-yellow-400 shadow-yellow-500/5" 
          : "border-white/60 bg-white/50 text-indigo-600 shadow-slate-200"
      }`}
    >
      {isDark ? (
        <FiSun size={20} className="drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]" />
      ) : (
        <FiMoon size={20} className="drop-shadow-[0_0_8px_rgba(79,70,229,0.3)]" />
      )}
    </button>
  );
};

export default GlobalThemeToggle;