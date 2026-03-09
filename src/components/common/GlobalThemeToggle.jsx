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
      title={isDark ? "Switch to white theme" : "Switch to dark theme"}
      className="fixed bottom-5 right-5 z-[120] inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-strong)] px-4 py-3 text-sm font-bold text-[var(--app-text)] shadow-2xl backdrop-blur-xl transition hover:scale-[1.02] active:scale-[0.98]"
    >
      {isDark ? <FiSun size={16} /> : <FiMoon size={16} />}
      <span>{isDark ? "White UI" : "Dark UI"}</span>
    </button>
  );
};

export default GlobalThemeToggle;
