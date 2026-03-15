import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { colorSchemes } from "../constants/ColorSchemes";

const ThemeContext = createContext(null);

const STORAGE_KEY = "app-theme-mode";
const SCHEME_KEY = "app-color-scheme";
const DEFAULT_SCHEME = colorSchemes[0]?.colors || {
  brandPrimary: "#093FB4",
  brandSecondary: "#345FD1",
  brandTertiary: "#A0BDF7",
  darkerPrimary: "#0E0F14",
  darkPrimary: "#15161D",
  softPrimary: "#1C2D6E",
  softerPrimary: "#E6ECFA",
  medPrimary: "#212229",
  lighter: "#DDE7FC",
  light: "#C6D8F6",
  redaccent: "#FF5252",
};

const applyCssVariables = (mode, scheme) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const body = document.body;

  const palette =
    mode === "dark"
      ? {
          darkerPrimary: scheme.darkerPrimary,
          darkPrimary: scheme.darkPrimary,
          medPrimary: scheme.medPrimary,
          softPrimary: scheme.softPrimary,
          softerPrimary: scheme.softerPrimary,
          brandPrimary: scheme.brandPrimary,
          brandSecondary: scheme.brandSecondary,
          brandTertiary: scheme.brandTertiary,
          lighter: scheme.lighter,
          light: scheme.light,
          redaccent: scheme.redaccent,
        }
      : {
          darkerPrimary: "#F8FAFC",
          darkPrimary: "#FFFFFF",
          medPrimary: scheme.softerPrimary,
          softPrimary: scheme.lighter,
          softerPrimary: "#F8FAFC",
          brandPrimary: scheme.brandPrimary,
          brandSecondary: scheme.brandSecondary,
          brandTertiary: scheme.brandTertiary,
          lighter: "#FFFFFF",
          light: scheme.light,
          redaccent: scheme.redaccent,
        };

  root.setAttribute("data-theme", mode);
  root.style.colorScheme = mode;
  body?.setAttribute("data-theme", mode);
  body?.classList.toggle("theme-dark", mode === "dark");
  body?.classList.toggle("theme-light", mode === "light");

  Object.entries(palette).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });

  root.style.setProperty("--app-bg", mode === "dark" ? "#020617" : "#f8fafc");
  root.style.setProperty("--app-text", mode === "dark" ? "#e2e8f0" : "#0f172a");
  root.style.setProperty(
    "--app-surface",
    mode === "dark" ? "rgba(15,23,42,0.72)" : "rgba(255,255,255,0.86)",
  );
  root.style.setProperty(
    "--app-surface-strong",
    mode === "dark" ? "rgba(2,6,23,0.82)" : "rgba(255,255,255,0.96)",
  );
  root.style.setProperty(
    "--app-border",
    mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(148,163,184,0.28)",
  );
  root.style.setProperty(
    "--app-muted-text",
    mode === "dark" ? "#94a3b8" : "#475569",
  );
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem(STORAGE_KEY) || "light";
  });

  const [schemeName] = useState(() => {
    if (typeof window === "undefined") {
      return colorSchemes[0]?.name || "Royal Azure";
    }
    return (
      localStorage.getItem(SCHEME_KEY) || colorSchemes[0]?.name || "Royal Azure"
    );
  });

  const scheme = useMemo(() => {
    return (
      colorSchemes.find((item) => item.name === schemeName)?.colors ||
      DEFAULT_SCHEME
    );
  }, [schemeName]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, theme);
      if (!localStorage.getItem(SCHEME_KEY)) {
        localStorage.setItem(
          SCHEME_KEY,
          colorSchemes[0]?.name || "Royal Azure",
        );
      }
    }

    applyCssVariables(theme, scheme);
  }, [theme, scheme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      isLight: theme === "light",
      setTheme,
      toggleTheme: () =>
        setTheme((prev) => (prev === "dark" ? "light" : "dark")),
    }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
};
