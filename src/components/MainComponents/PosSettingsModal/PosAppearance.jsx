import React, { useEffect, useMemo, useState } from "react";
import {
  FiCheck,
  FiLayers,
  FiInfo,
  FiDroplet,
  FiImage,
  FiSearch,
  FiX,
  FiStar,
  FiUpload,
  FiTrash2,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import useApiHost from "../../../hooks/useApiHost";
import { useTheme } from "../../../context/ThemeContext";
import ModalYesNoReusable from "../../Modals/ModalYesNoReusable";
import ModalSuccessNavToSelf from "../../Modals/ModalSuccessNavToSelf";

const safeValue = (value, fallback = "") => {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
};

const isApiSuccess = (result) =>
  result?.success === true || result?.status === "success";

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
  if (!rgb) return hex || "rgba(0,0,0,0)";
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file."));
    };

    reader.readAsDataURL(file);
  });

const defaultPalettes = [
  {
    name: "Crimson",
    category: "Bold",
    light: "#ef4444",
    lightSecondary: "#f87171",
    dark: "#fca5a5",
    darkSecondary: "#fb7185",
  },
  {
    name: "Ocean",
    category: "Classic",
    light: "#2563eb",
    lightSecondary: "#38bdf8",
    dark: "#93c5fd",
    darkSecondary: "#60a5fa",
  },
  {
    name: "Forest",
    category: "Nature",
    light: "#16a34a",
    lightSecondary: "#22c55e",
    dark: "#86efac",
    darkSecondary: "#4ade80",
  },
  {
    name: "Grape",
    category: "Bold",
    light: "#9333ea",
    lightSecondary: "#a855f7",
    dark: "#d8b4fe",
    darkSecondary: "#c084fc",
  },
  {
    name: "Amber",
    category: "Warm",
    light: "#d97706",
    lightSecondary: "#f59e0b",
    dark: "#fcd34d",
    darkSecondary: "#fbbf24",
  },
  {
    name: "Rose",
    category: "Warm",
    light: "#e11d48",
    lightSecondary: "#fb7185",
    dark: "#fda4af",
    darkSecondary: "#f472b6",
  },
  {
    name: "Skyline",
    category: "Cool",
    light: "#0284c7",
    lightSecondary: "#0ea5e9",
    dark: "#7dd3fc",
    darkSecondary: "#38bdf8",
  },
  {
    name: "Emerald",
    category: "Nature",
    light: "#059669",
    lightSecondary: "#10b981",
    dark: "#6ee7b7",
    darkSecondary: "#34d399",
  },
  {
    name: "Sunset",
    category: "Warm",
    light: "#f97316",
    lightSecondary: "#fb7185",
    dark: "#fdba74",
    darkSecondary: "#fda4af",
  },
  {
    name: "Midnight",
    category: "Dark",
    light: "#334155",
    lightSecondary: "#475569",
    dark: "#cbd5e1",
    darkSecondary: "#94a3b8",
  },
  {
    name: "Coral",
    category: "Warm",
    light: "#fb7185",
    lightSecondary: "#f97316",
    dark: "#fda4af",
    darkSecondary: "#fdba74",
  },
  {
    name: "Mint",
    category: "Fresh",
    light: "#14b8a6",
    lightSecondary: "#2dd4bf",
    dark: "#99f6e4",
    darkSecondary: "#5eead4",
  },
  {
    name: "Royal",
    category: "Premium",
    light: "#4338ca",
    lightSecondary: "#6366f1",
    dark: "#c7d2fe",
    darkSecondary: "#a5b4fc",
  },
  {
    name: "Ruby",
    category: "Premium",
    light: "#be123c",
    lightSecondary: "#e11d48",
    dark: "#fda4af",
    darkSecondary: "#fb7185",
  },
  {
    name: "Arctic",
    category: "Cool",
    light: "#0891b2",
    lightSecondary: "#06b6d4",
    dark: "#a5f3fc",
    darkSecondary: "#67e8f9",
  },
  {
    name: "Lime",
    category: "Fresh",
    light: "#65a30d",
    lightSecondary: "#84cc16",
    dark: "#d9f99d",
    darkSecondary: "#bef264",
  },
  {
    name: "Orchid",
    category: "Bold",
    light: "#c026d3",
    lightSecondary: "#d946ef",
    dark: "#f0abfc",
    darkSecondary: "#e879f9",
  },
  {
    name: "Stone",
    category: "Neutral",
    light: "#57534e",
    lightSecondary: "#78716c",
    dark: "#d6d3d1",
    darkSecondary: "#a8a29e",
  },
  {
    name: "Lagoon",
    category: "Cool",
    light: "#0f766e",
    lightSecondary: "#14b8a6",
    dark: "#99f6e4",
    darkSecondary: "#5eead4",
  },
  {
    name: "Gold",
    category: "Premium",
    light: "#ca8a04",
    lightSecondary: "#eab308",
    dark: "#fde68a",
    darkSecondary: "#facc15",
  },
];

const buildThemeForm = (themeSettings = {}) => ({
  Theme_Name: themeSettings?.Theme_Name || "default",

  Light_Primary: safeValue(themeSettings?.Light_Primary),
  Light_Secondary: safeValue(themeSettings?.Light_Secondary),
  Light_Background: safeValue(themeSettings?.Light_Background),
  Light_Surface: safeValue(themeSettings?.Light_Surface),
  Light_Text: safeValue(themeSettings?.Light_Text),

  Dark_Primary: safeValue(themeSettings?.Dark_Primary),
  Dark_Secondary: safeValue(themeSettings?.Dark_Secondary),
  Dark_Background: safeValue(themeSettings?.Dark_Background),
  Dark_Surface: safeValue(themeSettings?.Dark_Surface),
  Dark_Text: safeValue(themeSettings?.Dark_Text),

  Logo_Url: themeSettings?.Logo_Url || "",
  Login_Background_Url: themeSettings?.Login_Background_Url || "",
  Dashboard_Background_Url: themeSettings?.Dashboard_Background_Url || "",
  Status: themeSettings?.Status || "Active",
});

const FieldInput = ({
  label,
  value,
  onChange,
  placeholder,
  ui,
  activePalette,
}) => {
  return (
    <label className="block space-y-2">
      <span
        className="text-[10px] font-black uppercase tracking-[0.18em]"
        style={{ color: ui.softText }}
      >
        {label}
      </span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-all focus:scale-[1.01]"
        style={{
          backgroundColor: ui.panelSoft,
          borderColor: ui.border,
          color: activePalette.text,
          boxShadow: `0 0 0 0 ${toRgba(activePalette.primary, 0)}`,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = activePalette.primary;
          e.currentTarget.style.boxShadow = `0 0 0 4px ${toRgba(
            activePalette.primary,
            0.12,
          )}`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = ui.border;
          e.currentTarget.style.boxShadow = `0 0 0 0 ${toRgba(
            activePalette.primary,
            0,
          )}`;
        }}
      />
    </label>
  );
};

const ImageAssetField = ({
  title,
  fieldKey,
  fileKey,
  value,
  file,
  previewUrl,
  onUrlChange,
  onFileChange,
  onRemove,
  ui,
  activePalette,
}) => {
  return (
    <div
      className="rounded-[24px] border p-4"
      style={{
        backgroundColor: ui.panelSoft,
        borderColor: ui.border,
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p
            className="text-[10px] font-black uppercase tracking-[0.18em]"
            style={{ color: ui.softText }}
          >
            {title}
          </p>
          <p
            className="mt-1 text-xs font-semibold"
            style={{ color: ui.mutedText }}
          >
            Upload image or use direct URL
          </p>
        </div>

        <button
          type="button"
          onClick={() => onRemove(fieldKey, fileKey)}
          className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
          style={{
            borderColor: ui.border,
            backgroundColor: ui.panelStrong,
            color: activePalette.text,
          }}
        >
          <FiTrash2 size={14} />
          Remove
        </button>
      </div>

      <label
        className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed px-4 py-4 text-sm font-bold transition"
        style={{
          borderColor: ui.borderStrong,
          backgroundColor: toRgba(activePalette.primary, 0.04),
          color: activePalette.primary,
        }}
      >
        <FiUpload size={18} />
        <span>{file ? file.name : "Choose image file"}</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => onFileChange(fileKey, e.target.files?.[0] || null)}
          className="hidden"
        />
      </label>

      <div
        className="my-3 text-center text-[10px] font-black uppercase tracking-[0.18em]"
        style={{ color: ui.softText }}
      >
        or
      </div>

      <FieldInput
        label={`${title} URL`}
        value={value}
        onChange={(e) => onUrlChange(fieldKey, e.target.value)}
        placeholder="https://example.com/image.jpg"
        ui={ui}
        activePalette={activePalette}
      />

      <div
        className="mt-4 overflow-hidden rounded-2xl border"
        style={{ borderColor: ui.border }}
      >
        {previewUrl ? (
          <div
            className="flex h-44 w-full items-center justify-center"
            style={{ backgroundColor: toRgba(activePalette.primary, 0.08) }}
          >
            <img
              src={previewUrl}
              alt={title}
              className="h-full w-full object-cover"
              onLoad={() => console.log(`${title} loaded:`, previewUrl)}
              onError={() => console.error(`${title} failed:`, previewUrl)}
            />
          </div>
        ) : (
          <div
            className="flex h-44 w-full items-center justify-center"
            style={{
              color: ui.mutedText,
              backgroundColor: toRgba(activePalette.primary, 0.04),
            }}
          >
            No image selected
          </div>
        )}
      </div>
    </div>
  );
};

const PalettePickerModal = ({
  open,
  onClose,
  palettes,
  activePaletteMode,
  selectedName,
  onPick,
  ui,
  pagePalette,
  getContrastText,
}) => {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const filteredPalettes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return palettes;
    return palettes.filter(
      (palette) =>
        palette.name.toLowerCase().includes(q) ||
        String(palette.category || "")
          .toLowerCase()
          .includes(q),
    );
  }, [palettes, search]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="relative z-10 max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[32px] border"
            style={{
              background: `linear-gradient(135deg, ${ui.panelStrong} 0%, ${ui.panelSoft} 100%)`,
              borderColor: ui.border,
              boxShadow: `0 30px 90px ${toRgba(pagePalette.primary, 0.28)}`,
            }}
          >
            <div
              className="flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-6"
              style={{ borderColor: ui.border }}
            >
              <div>
                <p
                  className="text-[10px] font-black uppercase tracking-[0.22em]"
                  style={{ color: ui.softText }}
                >
                  Palette Library
                </p>
                <h3
                  className="mt-1 text-2xl font-black"
                  style={{ color: pagePalette.text }}
                >
                  Choose a theme palette
                </h3>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="grid h-11 w-11 place-items-center rounded-2xl border transition"
                style={{
                  borderColor: ui.border,
                  backgroundColor: ui.panelSoft,
                  color: pagePalette.text,
                }}
              >
                <FiX size={18} />
              </button>
            </div>

            <div
              className="border-b px-5 py-4 sm:px-6"
              style={{ borderColor: ui.border }}
            >
              <div className="relative max-w-md">
                <FiSearch
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                  style={{ color: ui.mutedText }}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search palette name or category..."
                  className="w-full rounded-2xl border py-3 pl-12 pr-4 text-sm outline-none"
                  style={{
                    backgroundColor: ui.panelSoft,
                    borderColor: ui.border,
                    color: pagePalette.text,
                  }}
                />
              </div>
            </div>

            <div className="max-h-[calc(90vh-144px)] overflow-y-auto p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredPalettes.map((palette) => {
                  const swatchColor =
                    activePaletteMode === "dark" ? palette.dark : palette.light;
                  const swatchSecondary =
                    activePaletteMode === "dark"
                      ? palette.darkSecondary || palette.dark
                      : palette.lightSecondary || palette.light;

                  const isSelected = selectedName === palette.name;

                  return (
                    <motion.button
                      key={palette.name}
                      type="button"
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onPick(palette)}
                      className="overflow-hidden rounded-[28px] border text-left transition-all"
                      style={{
                        borderColor: isSelected
                          ? pagePalette.primary
                          : ui.border,
                        backgroundColor: isSelected
                          ? ui.accentSoft
                          : ui.panelSoft,
                        boxShadow: isSelected
                          ? `0 18px 40px ${toRgba(pagePalette.primary, 0.18)}`
                          : "none",
                      }}
                    >
                      <div
                        className="h-28 w-full"
                        style={{
                          background: `linear-gradient(135deg, ${swatchColor} 0%, ${swatchSecondary} 100%)`,
                        }}
                      />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p
                              className="text-sm font-black uppercase tracking-[0.12em]"
                              style={{ color: pagePalette.text }}
                            >
                              {palette.name}
                            </p>
                            <p
                              className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em]"
                              style={{ color: ui.mutedText }}
                            >
                              {palette.category || "Preset"}
                            </p>
                          </div>

                          <div
                            className="grid h-9 w-9 place-items-center rounded-full"
                            style={{
                              backgroundColor: swatchColor,
                              color: getContrastText
                                ? getContrastText(swatchColor)
                                : "#ffffff",
                            }}
                          >
                            {isSelected ? (
                              <FiCheck size={18} />
                            ) : (
                              <FiStar size={16} />
                            )}
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                          <span
                            className="h-6 w-6 rounded-full border"
                            style={{
                              backgroundColor: palette.light,
                              borderColor: toRgba("#ffffff", 0.45),
                            }}
                          />
                          <span
                            className="h-6 w-6 rounded-full border"
                            style={{
                              backgroundColor:
                                palette.lightSecondary || palette.light,
                              borderColor: toRgba("#ffffff", 0.45),
                            }}
                          />
                          <span
                            className="h-6 w-6 rounded-full border"
                            style={{
                              backgroundColor: palette.dark,
                              borderColor: toRgba("#ffffff", 0.45),
                            }}
                          />
                          <span
                            className="h-6 w-6 rounded-full border"
                            style={{
                              backgroundColor:
                                palette.darkSecondary || palette.dark,
                              borderColor: toRgba("#ffffff", 0.45),
                            }}
                          />
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {!filteredPalettes.length ? (
                <div
                  className="mt-6 rounded-[24px] border p-8 text-center"
                  style={{
                    borderColor: ui.border,
                    backgroundColor: ui.panelSoft,
                    color: ui.mutedText,
                  }}
                >
                  No palette matched your search.
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

const PosAppearance = ({ adaptivePalette = [], getContrastText }) => {
  const apiHost = useApiHost();

  const {
    isDark,
    themeSettings,
    refreshThemeSettings,
    isThemeLoading,
    setThemeSettings,
  } = useTheme();

  const [themeForm, setThemeForm] = useState(() =>
    buildThemeForm(themeSettings),
  );
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [isPaletteModalOpen, setIsPaletteModalOpen] = useState(false);
  const [isYesNoModalOpen, setIsYesNoModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const [imageFiles, setImageFiles] = useState({
    Logo_Url_File: null,
    Login_Background_Url_File: null,
    Dashboard_Background_Url_File: null,
  });

  const [imagePreviews, setImagePreviews] = useState({
    Logo_Url_File: "",
    Login_Background_Url_File: "",
    Dashboard_Background_Url_File: "",
  });

  useEffect(() => {
    if (!themeSettings) return;
    setThemeForm(buildThemeForm(themeSettings));
  }, [themeSettings]);

  const allPalettes = useMemo(() => {
    const incoming = Array.isArray(adaptivePalette) ? adaptivePalette : [];
    const map = new Map();

    [...defaultPalettes, ...incoming].forEach((item) => {
      if (!item?.name) return;
      map.set(item.name, {
        category: item.category || "Preset",
        ...item,
      });
    });

    return Array.from(map.values());
  }, [adaptivePalette]);

  const mergedTheme = useMemo(
    () => ({
      Theme_Name:
        themeForm.Theme_Name || themeSettings?.Theme_Name || "default",

      Light_Primary:
        themeForm.Light_Primary || themeSettings?.Light_Primary || "",
      Light_Secondary:
        themeForm.Light_Secondary || themeSettings?.Light_Secondary || "",
      Light_Background:
        themeForm.Light_Background || themeSettings?.Light_Background || "",
      Light_Surface:
        themeForm.Light_Surface || themeSettings?.Light_Surface || "",
      Light_Text: themeForm.Light_Text || themeSettings?.Light_Text || "",

      Dark_Primary: themeForm.Dark_Primary || themeSettings?.Dark_Primary || "",
      Dark_Secondary:
        themeForm.Dark_Secondary || themeSettings?.Dark_Secondary || "",
      Dark_Background:
        themeForm.Dark_Background || themeSettings?.Dark_Background || "",
      Dark_Surface: themeForm.Dark_Surface || themeSettings?.Dark_Surface || "",
      Dark_Text: themeForm.Dark_Text || themeSettings?.Dark_Text || "",

      Logo_Url: themeForm.Logo_Url || "",
      Login_Background_Url: themeForm.Login_Background_Url || "",
      Dashboard_Background_Url: themeForm.Dashboard_Background_Url || "",
      Status: themeForm.Status || themeSettings?.Status || "Active",
    }),
    [themeForm, themeSettings],
  );

  const activePalette = useMemo(() => {
    if (isDark) {
      return {
        primary: mergedTheme.Dark_Primary,
        secondary: mergedTheme.Dark_Secondary,
        background: mergedTheme.Dark_Background,
        surface: mergedTheme.Dark_Surface,
        text: mergedTheme.Dark_Text,
      };
    }

    return {
      primary: mergedTheme.Light_Primary,
      secondary: mergedTheme.Light_Secondary,
      background: mergedTheme.Light_Background,
      surface: mergedTheme.Light_Surface,
      text: mergedTheme.Light_Text,
    };
  }, [isDark, mergedTheme]);

  const ui = useMemo(() => {
    const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";
    const borderStrong = isDark
      ? "rgba(255,255,255,0.14)"
      : "rgba(15,23,42,0.14)";
    const mutedText = isDark ? "rgba(255,255,255,0.70)" : "rgba(15,23,42,0.68)";
    const softText = isDark ? "rgba(255,255,255,0.48)" : "rgba(15,23,42,0.48)";
    const panelSoft = isDark
      ? toRgba(activePalette.surface, 0.72)
      : toRgba(activePalette.surface, 0.9);
    const panelStrong = isDark
      ? toRgba(activePalette.surface, 0.9)
      : toRgba(activePalette.surface, 0.98);
    const accentSoft = toRgba(activePalette.primary, 0.12);
    const accentGlow = toRgba(activePalette.primary, 0.3);

    return {
      border,
      borderStrong,
      mutedText,
      softText,
      panelSoft,
      panelStrong,
      accentSoft,
      accentGlow,
    };
  }, [activePalette, isDark]);

  const selectedColorObj = useMemo(() => {
    if (!Array.isArray(allPalettes) || allPalettes.length === 0) return null;
    return (
      allPalettes.find((color) => color.name === mergedTheme.Theme_Name) || null
    );
  }, [allPalettes, mergedTheme.Theme_Name]);

  const handleSelectPalette = (color) => {
    setThemeForm((prev) => ({
      ...prev,
      Theme_Name: color.name,
      Light_Primary: color.light,
      Light_Secondary: color.lightSecondary || color.light,
      Light_Background:
        prev.Light_Background || themeSettings?.Light_Background || "",
      Light_Surface: prev.Light_Surface || themeSettings?.Light_Surface || "",
      Light_Text: prev.Light_Text || themeSettings?.Light_Text || "",
      Dark_Primary: color.dark,
      Dark_Secondary: color.darkSecondary || color.dark,
      Dark_Background:
        prev.Dark_Background || themeSettings?.Dark_Background || "",
      Dark_Surface: prev.Dark_Surface || themeSettings?.Dark_Surface || "",
      Dark_Text: prev.Dark_Text || themeSettings?.Dark_Text || "",
    }));

    setSaveMessage("");
    setSaveStatus("");
    setIsPaletteModalOpen(false);
  };

  const resolveImageUrl = (value) => {
    if (!value) return "";
    if (value.startsWith("data:")) return value;
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return value;
    }

    const base = (apiHost || "").replace(/\/$/, "");

    if (value.startsWith("/uploads/")) {
      return `${base}${value}`;
    }

    if (value.startsWith("uploads/")) {
      return `${base}/${value}`;
    }

    return value;
  };

  const handleFileChange = async (fileKey, file) => {
    setSaveMessage("");
    setSaveStatus("");

    setImageFiles((prev) => ({
      ...prev,
      [fileKey]: file,
    }));

    let preview = "";
    if (file) {
      try {
        preview = await fileToDataUrl(file);
      } catch (error) {
        console.error("Failed to create preview:", error);
      }
    }

    setImagePreviews((prev) => ({
      ...prev,
      [fileKey]: preview,
    }));
  };

  const handleUrlChange = (fieldKey, value) => {
    setThemeForm((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));
    setSaveMessage("");
    setSaveStatus("");
  };

  const handleRemoveImage = (fieldKey, fileKey) => {
    setThemeForm((prev) => ({
      ...prev,
      [fieldKey]: "",
    }));

    setImageFiles((prev) => ({
      ...prev,
      [fileKey]: null,
    }));

    setImagePreviews((prev) => ({
      ...prev,
      [fileKey]: "",
    }));

    setSaveMessage("");
    setSaveStatus("");
  };

  const logoPreview =
    imagePreviews.Logo_Url_File || resolveImageUrl(themeForm.Logo_Url);

  const loginPreview =
    imagePreviews.Login_Background_Url_File ||
    resolveImageUrl(themeForm.Login_Background_Url);

  const dashboardPreview =
    imagePreviews.Dashboard_Background_Url_File ||
    resolveImageUrl(themeForm.Dashboard_Background_Url);

  const handleSave = async () => {
    try {
      if (!apiHost) {
        setSaveStatus("error");
        setSaveMessage("API host not found.");
        return;
      }

      setIsSavingTheme(true);
      setSaveMessage("");
      setSaveStatus("");

      const formData = new FormData();

      formData.append("Theme_Name", mergedTheme.Theme_Name || "default");
      formData.append("Light_Primary", mergedTheme.Light_Primary || "");
      formData.append("Light_Secondary", mergedTheme.Light_Secondary || "");
      formData.append("Light_Background", mergedTheme.Light_Background || "");
      formData.append("Light_Surface", mergedTheme.Light_Surface || "");
      formData.append("Light_Text", mergedTheme.Light_Text || "");

      formData.append("Dark_Primary", mergedTheme.Dark_Primary || "");
      formData.append("Dark_Secondary", mergedTheme.Dark_Secondary || "");
      formData.append("Dark_Background", mergedTheme.Dark_Background || "");
      formData.append("Dark_Surface", mergedTheme.Dark_Surface || "");
      formData.append("Dark_Text", mergedTheme.Dark_Text || "");

      formData.append("Logo_Url", mergedTheme.Logo_Url || "");
      formData.append(
        "Login_Background_Url",
        mergedTheme.Login_Background_Url || "",
      );
      formData.append(
        "Dashboard_Background_Url",
        mergedTheme.Dashboard_Background_Url || "",
      );
      formData.append("Status", mergedTheme.Status || "Active");

      if (imageFiles.Logo_Url_File) {
        formData.append("logo_file", imageFiles.Logo_Url_File);
      }

      if (imageFiles.Login_Background_Url_File) {
        formData.append(
          "login_background_file",
          imageFiles.Login_Background_Url_File,
        );
      }

      if (imageFiles.Dashboard_Background_Url_File) {
        formData.append(
          "dashboard_background_file",
          imageFiles.Dashboard_Background_Url_File,
        );
      }

      const response = await fetch(`${apiHost}/api/theme_settings.php`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      console.log("save_theme_settings result:", result);

      if (isApiSuccess(result)) {
        const latestTheme = result?.data
          ? buildThemeForm(result.data)
          : mergedTheme;

        setThemeSettings?.(latestTheme);
        setThemeForm(buildThemeForm(latestTheme));

        setImageFiles({
          Logo_Url_File: null,
          Login_Background_Url_File: null,
          Dashboard_Background_Url_File: null,
        });

        setImagePreviews({
          Logo_Url_File: "",
          Login_Background_Url_File: "",
          Dashboard_Background_Url_File: "",
        });

        setSaveStatus("success");
        setSaveMessage(result.message || "Theme saved successfully.");
        setIsSuccessModalOpen(true);

        await refreshThemeSettings?.();
      } else {
        setSaveStatus("error");
        setSaveMessage(result.message || "Failed to save theme.");
      }
    } catch (error) {
      console.error("Error saving theme:", error);
      setSaveStatus("error");
      setSaveMessage("An error occurred while saving theme.");
    } finally {
      setIsSavingTheme(false);
    }
  };

  const statusPillStyle = useMemo(() => {
    if (isThemeLoading) {
      return {
        backgroundColor: toRgba("#3b82f6", 0.12),
        color: "#2563eb",
      };
    }

    if (saveStatus === "success") {
      return {
        backgroundColor: toRgba("#10b981", 0.12),
        color: "#059669",
      };
    }

    if (saveStatus === "error") {
      return {
        backgroundColor: toRgba("#ef4444", 0.12),
        color: "#dc2626",
      };
    }

    return {
      backgroundColor: toRgba(activePalette.primary, 0.12),
      color: activePalette.primary,
    };
  }, [isThemeLoading, saveStatus, activePalette.primary]);

  return (
    <>
      <PalettePickerModal
        open={isPaletteModalOpen}
        onClose={() => setIsPaletteModalOpen(false)}
        palettes={allPalettes}
        activePaletteMode={isDark ? "dark" : "light"}
        selectedName={mergedTheme.Theme_Name}
        onPick={handleSelectPalette}
        ui={ui}
        pagePalette={activePalette}
        getContrastText={getContrastText}
      />

      <div
        className="mx-auto max-w-6xl space-y-6"
        style={{ color: activePalette.text }}
      >
        <div
          className="relative overflow-hidden rounded-[32px] border p-6 sm:p-8 lg:p-10"
          style={{
            background: isDark
              ? `linear-gradient(135deg, ${toRgba(activePalette.surface, 0.96)} 0%, ${toRgba(activePalette.background, 0.96)} 100%)`
              : `linear-gradient(135deg, ${toRgba(activePalette.surface, 0.98)} 0%, ${toRgba(activePalette.background, 0.98)} 100%)`,
            borderColor: ui.border,
            color: activePalette.text,
            boxShadow: `0 24px 80px ${toRgba(activePalette.primary, 0.1)}`,
          }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute right-[-40px] top-[-40px] h-40 w-40 rounded-full opacity-70 blur-3xl"
              style={{ backgroundColor: ui.accentGlow }}
            />
            <div
              className="absolute bottom-[-60px] left-[-20px] h-40 w-40 rounded-full opacity-50 blur-3xl"
              style={{ backgroundColor: toRgba(activePalette.secondary, 0.2) }}
            />
          </div>

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em]"
                style={{
                  border: `1px solid ${ui.borderStrong}`,
                  backgroundColor: ui.accentSoft,
                  color: activePalette.primary,
                }}
              >
                <FiLayers size={12} />
                <span>Appearance</span>
              </div>

              <h2
                className="mt-4 text-3xl font-black uppercase tracking-tight sm:text-4xl lg:text-5xl"
                style={{ color: activePalette.text }}
              >
                Theme & Branding
              </h2>

              <p
                className="mt-3 max-w-2xl text-sm"
                style={{ color: ui.mutedText }}
              >
                Customize the global POS appearance, logo, and background images
                for login and dashboard.
              </p>
            </div>

            <div
              className="rounded-[24px] border px-5 py-4"
              style={{
                backgroundColor: ui.panelSoft,
                borderColor: ui.border,
              }}
            >
              <p
                className="text-[10px] font-black uppercase tracking-[0.2em]"
                style={{ color: ui.softText }}
              >
                Current Theme
              </p>
              <p
                className="mt-2 text-2xl font-black"
                style={{ color: activePalette.text }}
              >
                {mergedTheme.Theme_Name || "default"}
              </p>
              <p
                className="mt-1 text-xs font-semibold"
                style={{ color: ui.mutedText }}
              >
                Global Theme Settings
              </p>
            </div>
          </div>
        </div>

        <div
          className="rounded-[28px] border p-5 sm:p-6"
          style={{
            backgroundColor: ui.panelStrong,
            borderColor: ui.border,
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
              style={{
                backgroundColor: ui.panelSoft,
                borderColor: ui.border,
              }}
            >
              <FiInfo size={18} style={{ color: activePalette.primary }} />
            </div>

            <div>
              <p
                className="text-[10px] font-black uppercase tracking-[0.22em]"
                style={{ color: ui.softText }}
              >
                Theme Information
              </p>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: ui.mutedText }}
              >
                This panel now uses one global theme configuration, so the login
                page and dashboard can read the same settings without depending
                on a unit code.
              </p>

              {(isThemeLoading || saveMessage) && (
                <div
                  className="mt-4 inline-flex rounded-2xl px-4 py-2 text-xs font-bold"
                  style={statusPillStyle}
                >
                  {isThemeLoading ? "Loading theme..." : saveMessage}
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className="rounded-[28px] border p-5 sm:p-6"
          style={{
            backgroundColor: ui.panelStrong,
            borderColor: ui.border,
          }}
        >
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl border"
                style={{
                  backgroundColor: ui.panelSoft,
                  borderColor: ui.border,
                }}
              >
                <FiDroplet size={18} style={{ color: activePalette.primary }} />
              </div>

              <div>
                <p
                  className="text-[10px] font-black uppercase tracking-[0.22em]"
                  style={{ color: ui.softText }}
                >
                  Accent Palette
                </p>
                <h3
                  className="text-xl font-black"
                  style={{ color: activePalette.text }}
                >
                  Choose a color profile
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPaletteModalOpen(true)}
              className="rounded-[18px] border px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] transition hover:scale-[1.02] active:scale-[0.98]"
              style={{
                borderColor: ui.borderStrong,
                backgroundColor: ui.panelSoft,
                color: activePalette.primary,
              }}
            >
              Open Palette Library
            </button>
          </div>

          <div
            className="rounded-[24px] border p-4 sm:p-6"
            style={{
              backgroundColor: ui.panelSoft,
              borderColor: ui.border,
            }}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
              <div
                className="rounded-[24px] border p-4"
                style={{
                  backgroundColor: ui.panelStrong,
                  borderColor: ui.border,
                }}
              >
                <p
                  className="text-[10px] font-black uppercase tracking-[0.18em]"
                  style={{ color: ui.softText }}
                >
                  Selected Palette
                </p>
                <p
                  className="mt-2 text-lg font-black"
                  style={{ color: activePalette.text }}
                >
                  {selectedColorObj?.name || mergedTheme.Theme_Name || "Custom"}
                </p>
                <p
                  className="mt-1 text-xs font-semibold"
                  style={{ color: ui.mutedText }}
                >
                  {selectedColorObj?.category || "Theme preset"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Light Primary", value: mergedTheme.Light_Primary },
                  {
                    label: "Light Secondary",
                    value: mergedTheme.Light_Secondary,
                  },
                  { label: "Dark Primary", value: mergedTheme.Dark_Primary },
                  {
                    label: "Dark Secondary",
                    value: mergedTheme.Dark_Secondary,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[22px] border p-4"
                    style={{
                      backgroundColor: ui.panelStrong,
                      borderColor: ui.border,
                    }}
                  >
                    <p
                      className="text-[10px] font-black uppercase tracking-[0.16em]"
                      style={{ color: ui.softText }}
                    >
                      {item.label}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <span
                        className="h-10 w-10 rounded-full border"
                        style={{
                          backgroundColor: item.value,
                          borderColor: toRgba("#ffffff", 0.35),
                        }}
                      />
                      <span
                        className="text-xs font-bold"
                        style={{ color: ui.mutedText }}
                      >
                        {item.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          className="rounded-[28px] border p-5 sm:p-6"
          style={{
            backgroundColor: ui.panelStrong,
            borderColor: ui.border,
          }}
        >
          <div className="mb-6 flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl border"
              style={{
                backgroundColor: ui.panelSoft,
                borderColor: ui.border,
              }}
            >
              <FiImage size={18} style={{ color: activePalette.primary }} />
            </div>

            <div>
              <p
                className="text-[10px] font-black uppercase tracking-[0.22em]"
                style={{ color: ui.softText }}
              >
                Branding Assets
              </p>
              <h3
                className="text-xl font-black"
                style={{ color: activePalette.text }}
              >
                Logo and background images
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <ImageAssetField
              title="Logo"
              fieldKey="Logo_Url"
              fileKey="Logo_Url_File"
              value={themeForm.Logo_Url}
              file={imageFiles.Logo_Url_File}
              previewUrl={logoPreview}
              onUrlChange={handleUrlChange}
              onFileChange={handleFileChange}
              onRemove={handleRemoveImage}
              ui={ui}
              activePalette={activePalette}
            />

            <ImageAssetField
              title="Login Background"
              fieldKey="Login_Background_Url"
              fileKey="Login_Background_Url_File"
              value={themeForm.Login_Background_Url}
              file={imageFiles.Login_Background_Url_File}
              previewUrl={loginPreview}
              onUrlChange={handleUrlChange}
              onFileChange={handleFileChange}
              onRemove={handleRemoveImage}
              ui={ui}
              activePalette={activePalette}
            />

            <ImageAssetField
              title="Dashboard Background"
              fieldKey="Dashboard_Background_Url"
              fileKey="Dashboard_Background_Url_File"
              value={themeForm.Dashboard_Background_Url}
              file={imageFiles.Dashboard_Background_Url_File}
              previewUrl={dashboardPreview}
              onUrlChange={handleUrlChange}
              onFileChange={handleFileChange}
              onRemove={handleRemoveImage}
              ui={ui}
              activePalette={activePalette}
            />
          </div>
        </div>

        <div
          className="rounded-[28px] border p-6 sm:p-8"
          style={{
            backgroundColor: ui.panelStrong,
            borderColor: ui.border,
          }}
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p
                className="text-[10px] font-black uppercase tracking-[0.22em]"
                style={{ color: ui.softText }}
              >
                Visual Preview
              </p>
              <h3
                className="mt-2 text-2xl font-black uppercase tracking-tight sm:text-3xl"
                style={{ color: activePalette.text }}
              >
                {mergedTheme.Theme_Name || "default"}{" "}
                {isDark ? "Dark" : "Light"}
              </h3>
              <p
                className="mt-3 max-w-2xl text-sm"
                style={{ color: ui.mutedText }}
              >
                This theme saves one global light and dark palette, together
                with logo and background images for login and dashboard.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div
                  className="rounded-[20px] border p-4"
                  style={{
                    backgroundColor: ui.panelSoft,
                    borderColor: ui.border,
                  }}
                >
                  <p
                    className="text-[10px] font-black uppercase tracking-[0.18em]"
                    style={{ color: ui.softText }}
                  >
                    Buttons
                  </p>
                  <div
                    className="mt-3 rounded-2xl px-4 py-3 text-center font-black uppercase tracking-[0.14em]"
                    style={{
                      backgroundColor: activePalette.primary,
                      color: getContrastText
                        ? getContrastText(activePalette.primary)
                        : "#ffffff",
                    }}
                  >
                    Primary
                  </div>
                </div>

                <div
                  className="rounded-[20px] border p-4"
                  style={{
                    backgroundColor: ui.panelSoft,
                    borderColor: ui.border,
                  }}
                >
                  <p
                    className="text-[10px] font-black uppercase tracking-[0.18em]"
                    style={{ color: ui.softText }}
                  >
                    Indicator
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: activePalette.primary }}
                    />
                    <span
                      className="text-sm font-bold"
                      style={{ color: activePalette.text }}
                    >
                      Active status
                    </span>
                  </div>
                </div>

                <div
                  className="rounded-[20px] border p-4"
                  style={{
                    backgroundColor: ui.panelSoft,
                    borderColor: ui.border,
                  }}
                >
                  <p
                    className="text-[10px] font-black uppercase tracking-[0.18em]"
                    style={{ color: ui.softText }}
                  >
                    Highlight
                  </p>
                  <div
                    className="mt-3 rounded-2xl px-4 py-3 font-black uppercase tracking-[0.14em]"
                    style={{
                      backgroundColor: ui.accentSoft,
                      color: activePalette.primary,
                    }}
                  >
                    Selected module
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-start lg:justify-end">
              <button
                type="button"
                onClick={() => setIsYesNoModalOpen(true)}
                disabled={isSavingTheme || isThemeLoading}
                className="rounded-[22px] px-8 py-4 text-[11px] font-black uppercase tracking-[0.22em] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:px-12"
                style={{
                  backgroundColor: activePalette.primary,
                  color: getContrastText
                    ? getContrastText(activePalette.primary)
                    : "#ffffff",
                  boxShadow: `0 20px 40px ${toRgba(activePalette.primary, 0.35)}`,
                }}
              >
                {isSavingTheme ? "Saving Theme..." : "Apply Theme"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isYesNoModalOpen && (
        <ModalYesNoReusable
          header="Apply Theme"
          message="Are you sure you want to save and apply the current appearance settings?"
          setYesNoModalOpen={setIsYesNoModalOpen}
          triggerYesNoEvent={handleSave}
          isLoading={isSavingTheme}
        />
      )}

      {isSuccessModalOpen && (
        <ModalSuccessNavToSelf
          header="Theme Saved"
          message="Appearance settings applied successfully."
          setIsModalOpen={setIsSuccessModalOpen}
          button="Accept"
        />
      )}
    </>
  );
};

export default PosAppearance;
