import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import useApiHost from "../hooks/useApiHost";

const ThemeContext = createContext(null);

const STORAGE_KEY = "app-theme-mode";

const DEFAULT_THEME_SETTINGS = {
  Theme_Name: "default",

  Light_Primary: "#38bdf8",
  Light_Secondary: "#0ea5e9",
  Light_Background: "#f8fafc",
  Light_Surface: "#ffffff",
  Light_Text: "#0f172a",

  Dark_Primary: "#2563eb",
  Dark_Secondary: "#1d4ed8",
  Dark_Background: "#0f172a",
  Dark_Surface: "#111827",
  Dark_Text: "#ffffff",

  Logo_Url: "",
  Login_Background_Url: "",
  Dashboard_Background_Url: "",
  Status: "Active",
};

const isApiSuccess = (result) =>
  result?.success === true || result?.status === "success";

const safeColor = (value, fallback) => {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
};

const hexToRgb = (hex) => {
  if (!hex || typeof hex !== "string") return null;

  let normalized = hex.replace("#", "").trim();

  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((char) => char + char)
      .join("");
  }

  if (normalized.length !== 6) return null;

  const num = parseInt(normalized, 16);
  if (Number.isNaN(num)) return null;

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

const toRgba = (hex, alpha = 1) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const normalizeThemeSettings = (data = {}) => ({
  Theme_Name: data.Theme_Name || DEFAULT_THEME_SETTINGS.Theme_Name,

  Light_Primary: safeColor(
    data.Light_Primary,
    DEFAULT_THEME_SETTINGS.Light_Primary,
  ),
  Light_Secondary: safeColor(
    data.Light_Secondary,
    DEFAULT_THEME_SETTINGS.Light_Secondary,
  ),
  Light_Background: safeColor(
    data.Light_Background,
    DEFAULT_THEME_SETTINGS.Light_Background,
  ),
  Light_Surface: safeColor(
    data.Light_Surface,
    DEFAULT_THEME_SETTINGS.Light_Surface,
  ),
  Light_Text: safeColor(data.Light_Text, DEFAULT_THEME_SETTINGS.Light_Text),

  Dark_Primary: safeColor(
    data.Dark_Primary,
    DEFAULT_THEME_SETTINGS.Dark_Primary,
  ),
  Dark_Secondary: safeColor(
    data.Dark_Secondary,
    DEFAULT_THEME_SETTINGS.Dark_Secondary,
  ),
  Dark_Background: safeColor(
    data.Dark_Background,
    DEFAULT_THEME_SETTINGS.Dark_Background,
  ),
  Dark_Surface: safeColor(
    data.Dark_Surface,
    DEFAULT_THEME_SETTINGS.Dark_Surface,
  ),
  Dark_Text: safeColor(data.Dark_Text, DEFAULT_THEME_SETTINGS.Dark_Text),

  Logo_Url: data.Logo_Url || "",
  Login_Background_Url: data.Login_Background_Url || "",
  Dashboard_Background_Url: data.Dashboard_Background_Url || "",
  Status: data.Status || "Active",
});

const applyCssVariables = (mode, themeSettings) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const body = document.body;
  const isDark = mode === "dark";
  const settings = normalizeThemeSettings(themeSettings);

  const active = isDark
    ? {
        primary: settings.Dark_Primary,
        secondary: settings.Dark_Secondary,
        background: settings.Dark_Background,
        surface: settings.Dark_Surface,
        text: settings.Dark_Text,
      }
    : {
        primary: settings.Light_Primary,
        secondary: settings.Light_Secondary,
        background: settings.Light_Background,
        surface: settings.Light_Surface,
        text: settings.Light_Text,
      };

  root.setAttribute("data-theme", mode);
  root.style.colorScheme = mode;

  if (body) {
    body.setAttribute("data-theme", mode);
    body.classList.toggle("theme-dark", isDark);
    body.classList.toggle("theme-light", !isDark);
    body.style.backgroundColor = active.background;
    body.style.color = active.text;
  }

  root.style.setProperty("--color-brandPrimary", active.primary);
  root.style.setProperty("--color-brandSecondary", active.secondary);
  root.style.setProperty("--color-brandTertiary", active.secondary);
  root.style.setProperty("--color-darkerPrimary", active.background);
  root.style.setProperty("--color-darkPrimary", active.surface);
  root.style.setProperty("--color-softPrimary", active.secondary);
  root.style.setProperty("--color-softerPrimary", active.background);
  root.style.setProperty("--color-medPrimary", active.surface);
  root.style.setProperty("--color-lighter", active.text);
  root.style.setProperty("--color-light", active.text);
  root.style.setProperty("--color-redaccent", "#FF5252");

  root.style.setProperty("--app-bg", active.background);
  root.style.setProperty("--app-text", active.text);
  root.style.setProperty("--app-surface", active.surface);
  root.style.setProperty(
    "--app-surface-soft",
    isDark ? toRgba(active.surface, 0.78) : toRgba(active.surface, 0.9),
  );
  root.style.setProperty(
    "--app-surface-strong",
    isDark ? toRgba(active.surface, 0.92) : toRgba(active.surface, 0.98),
  );
  root.style.setProperty(
    "--app-border",
    isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
  );
  root.style.setProperty(
    "--app-border-strong",
    isDark ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.14)",
  );
  root.style.setProperty(
    "--app-muted-text",
    isDark ? "rgba(255,255,255,0.68)" : "rgba(15,23,42,0.68)",
  );
  root.style.setProperty(
    "--app-soft-text",
    isDark ? "rgba(255,255,255,0.5)" : "rgba(15,23,42,0.5)",
  );

  root.style.setProperty("--app-accent", active.primary);
  root.style.setProperty("--app-accent-secondary", active.secondary);
  root.style.setProperty("--app-accent-soft", toRgba(active.primary, 0.12));
  root.style.setProperty("--app-accent-glow", toRgba(active.primary, 0.35));

  // keep compatibility with old components still using branch vars
  root.style.setProperty("--branch-primary", active.primary);
  root.style.setProperty("--branch-secondary", active.secondary);
  root.style.setProperty("--branch-tertiary", active.secondary);
};

export const ThemeProvider = ({ children }) => {
  const apiHost = useApiHost();

  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem(STORAGE_KEY) || "light";
  });

  const [themeSettings, setThemeSettings] = useState(DEFAULT_THEME_SETTINGS);
  const [isThemeLoading, setIsThemeLoading] = useState(false);

  const refreshThemeSettings = useCallback(async () => {
    if (typeof window === "undefined" || !apiHost) return;

    setIsThemeLoading(true);

    try {
      const response = await fetch(`${apiHost}/api/theme_settings.php`);
      const result = await response.json();

      console.log("read_theme_settings result:", result);

      if (isApiSuccess(result) && result?.data) {
        const normalized = normalizeThemeSettings(result.data);

        setThemeSettings((prev) => {
          const prevString = JSON.stringify(prev);
          const nextString = JSON.stringify(normalized);
          return prevString === nextString ? prev : normalized;
        });
      } else {
        setThemeSettings(DEFAULT_THEME_SETTINGS);
      }
    } catch (error) {
      console.error("Error fetching theme settings in ThemeProvider:", error);
      setThemeSettings(DEFAULT_THEME_SETTINGS);
    } finally {
      setIsThemeLoading(false);
    }
  }, [apiHost]);

  useEffect(() => {
    if (!apiHost || typeof window === "undefined") return;
    refreshThemeSettings();
  }, [apiHost, refreshThemeSettings]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, theme);
    }

    applyCssVariables(theme, themeSettings);
  }, [theme, themeSettings]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      isLight: theme === "light",
      setTheme,
      toggleTheme: () =>
        setTheme((prev) => (prev === "dark" ? "light" : "dark")),

      themeSettings,
      setThemeSettings,
      refreshThemeSettings,
      isThemeLoading,
    }),
    [theme, themeSettings, refreshThemeSettings, isThemeLoading],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (context === null) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
};
