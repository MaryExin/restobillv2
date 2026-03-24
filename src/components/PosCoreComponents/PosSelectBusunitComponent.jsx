import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useWindowSize } from "react-use";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import "../../fonts/font-style.css";

import {
  AiOutlineBarChart,
  AiOutlineDashboard,
  AiOutlineDatabase,
} from "react-icons/ai";
import { FaEdit, FaTimes, FaPlus } from "react-icons/fa";
import { FiSearch, FiX } from "react-icons/fi";

import useCustomQuery from "../../hooks/useCustomQuery";
import useApiHost from "../../hooks/useApiHost";
import { colorSchemes } from "../../constants/ColorSchemes";

import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import ModalSuccessNavToSelf from "../Modals/ModalSuccessNavToSelf";
import ModalFailure from "../Modals/ModalFailure";

/* -----------------------------
   Stable local CRUD read/manage modal
------------------------------ */
function ReadBusunitManageModal({
  open,
  onClose,
  activeCrudTab,
  setActiveCrudTab,
  manageSearch,
  setManageSearch,
  categories,
  businessUnits,
  selectedCategory,
  categoryName,
  setCategoryName,
  unitForm,
  setUnitForm,
  addedit,
  setaddedit,
  setYesNoModalOpen,
  setErrormessage,
  handleCrudFormReset,
  filteredCategories,
  filteredBusinessUnits,
  openCreateCategory,
  openEditCategory,
  openDeleteCategory,
  openCreateUnit,
  openEditUnit,
  openDeleteUnit,
  COLORS,
}) {
  const close = () => onClose?.();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const overlay = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.15 } },
    exit: { opacity: 0, transition: { duration: 0.12 } },
  };

  const panel = {
    hidden: { opacity: 0, y: 10, scale: 0.985 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: "spring", stiffness: 360, damping: 28 },
    },
    exit: { opacity: 0, y: 10, scale: 0.985, transition: { duration: 0.12 } },
  };

  const LABEL = "text-[11px] font-semibold tracking-wide theme-muted";
  const INPUT =
    "theme-input h-11 w-full rounded-2xl px-4 text-sm outline-none transition";
  const GHOST_BTN =
    "h-11 px-4 rounded-2xl font-semibold transition active:scale-[0.99] theme-surface hover:opacity-90";
  const PRIMARY_BTN =
    "h-11 px-4 rounded-2xl font-semibold text-white transition active:scale-[0.99]";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[99999] flex items-end justify-center px-3 sm:items-center sm:px-6"
          variants={overlay}
          initial="hidden"
          animate="show"
          exit="exit"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />

          <motion.div
            variants={panel}
            initial="hidden"
            animate="show"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label="Manage Categories and Business Units"
            onMouseDown={(e) => e.stopPropagation()}
            className="relative max-h-[100vh] w-full overflow-y-auto rounded-3xl sm:max-w-6xl"
          >
            <div
              className="rounded-3xl p-[1px] shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
              style={{
                background: `linear-gradient(135deg, ${COLORS.brand}88, ${COLORS.brandSecondary}66, ${COLORS.brandLight}55)`,
              }}
            >
              <div className="theme-card relative overflow-hidden rounded-3xl">
                <div
                  className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl opacity-25"
                  style={{
                    background: `radial-gradient(circle, ${COLORS.brandLight} 0%, transparent 70%)`,
                  }}
                />
                <div
                  className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full blur-3xl opacity-20"
                  style={{
                    background: `radial-gradient(circle, ${COLORS.brandLighter} 0%, transparent 70%)`,
                  }}
                />

                <div className="theme-border border-b p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-black tracking-wide theme-muted">
                        LIVE DATA MODE
                      </div>
                      <div className="mt-1 text-xl font-black tracking-tight theme-text sm:text-2xl">
                        Manage Categories & Business Units
                      </div>
                      <div className="mt-1 text-sm theme-muted">
                        Hardcoded seed data removed. Live shift data is now
                        used.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={close}
                      className="grid h-10 w-10 place-items-center rounded-2xl theme-surface transition hover:opacity-90 active:scale-[0.99]"
                      aria-label="Close modal"
                    >
                      <FiX className="h-4 w-4 theme-text" />
                    </button>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="inline-flex rounded-2xl p-1 theme-surface">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCrudTab("category");
                          handleCrudFormReset();
                        }}
                        className={[
                          "h-10 rounded-xl px-4 text-sm font-semibold transition",
                          activeCrudTab === "category"
                            ? "text-white"
                            : "theme-text",
                        ].join(" ")}
                        style={
                          activeCrudTab === "category"
                            ? {
                                background: `linear-gradient(180deg, ${COLORS.brand} 0%, ${COLORS.brandSecondary} 100%)`,
                              }
                            : {}
                        }
                      >
                        Categories
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveCrudTab("unit");
                          handleCrudFormReset();
                        }}
                        className={[
                          "h-10 rounded-xl px-4 text-sm font-semibold transition",
                          activeCrudTab === "unit"
                            ? "text-white"
                            : "theme-text",
                        ].join(" ")}
                        style={
                          activeCrudTab === "unit"
                            ? {
                                background: `linear-gradient(180deg, ${COLORS.brand} 0%, ${COLORS.brandSecondary} 100%)`,
                              }
                            : {}
                        }
                      >
                        Business Units
                      </button>
                    </div>

                    <div className="w-full md:max-w-sm">
                      <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 theme-muted" />
                        <input
                          value={manageSearch}
                          onChange={(e) => setManageSearch(e.target.value)}
                          placeholder={`Search ${
                            activeCrudTab === "category"
                              ? "categories"
                              : "business units"
                          }...`}
                          className={[INPUT, "pl-10"].join(" ")}
                          style={{
                            borderColor: COLORS.brandLight,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 p-5 sm:p-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                  <div className="max-h-[60vh] overflow-y-auto rounded-3xl p-5 theme-surface">
                    {activeCrudTab === "category" ? (
                      <>
                        <div className="text-base font-bold theme-text">
                          Live Category
                        </div>
                        <div className="mt-1 text-xs theme-muted">
                          Live data only. No hardcoded category list.
                        </div>

                        <div className="mt-5">
                          <div className={LABEL}>Category Name</div>
                          <input
                            type="text"
                            value={categoryName}
                            readOnly
                            className={[INPUT, "mt-1 opacity-80"].join(" ")}
                            style={{
                              borderColor: COLORS.brandLight,
                            }}
                          />
                        </div>

                        <div className="mt-5 text-xs theme-muted">
                          This modal is now display-only because hardcoded local
                          CRUD data was removed.
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-base font-bold theme-text">
                          Live Business Unit
                        </div>
                        <div className="mt-1 text-xs theme-muted">
                          Live data only. No hardcoded unit list.
                        </div>

                        <div className="mt-5 space-y-4">
                          <div>
                            <div className={LABEL}>Category</div>
                            <input
                              type="text"
                              value={unitForm.category}
                              readOnly
                              className={[INPUT, "mt-1 opacity-80"].join(" ")}
                              style={{ borderColor: COLORS.brandLight }}
                            />
                          </div>

                          <div>
                            <div className={LABEL}>Business Unit Name</div>
                            <input
                              type="text"
                              value={unitForm.label}
                              readOnly
                              className={[INPUT, "mt-1 opacity-80"].join(" ")}
                              style={{ borderColor: COLORS.brandLight }}
                            />
                          </div>

                          <div>
                            <div className={LABEL}>Category Code</div>
                            <input
                              type="text"
                              value={unitForm.categoryCode}
                              readOnly
                              className={[INPUT, "mt-1 opacity-80"].join(" ")}
                              style={{ borderColor: COLORS.brandLight }}
                            />
                          </div>

                          <div>
                            <div className={LABEL}>Unit Code</div>
                            <input
                              type="text"
                              value={unitForm.unitCode}
                              readOnly
                              className={[INPUT, "mt-1 opacity-80"].join(" ")}
                              style={{ borderColor: COLORS.brandLight }}
                            />
                          </div>

                          <div>
                            <div className={LABEL}>Business Type</div>
                            <input
                              type="text"
                              value={unitForm.businessType}
                              readOnly
                              className={[INPUT, "mt-1 opacity-80"].join(" ")}
                              style={{ borderColor: COLORS.brandLight }}
                            />
                          </div>

                          <div>
                            <div className={LABEL}>TIN Number</div>
                            <input
                              type="text"
                              value={unitForm.Unit_TIN}
                              readOnly
                              className={[INPUT, "mt-1 opacity-80"].join(" ")}
                              style={{ borderColor: COLORS.brandLight }}
                            />
                          </div>

                          <div>
                            <div className={LABEL}>Address</div>
                            <input
                              type="text"
                              value={unitForm.Unit_Address}
                              readOnly
                              className={[INPUT, "mt-1 opacity-80"].join(" ")}
                              style={{ borderColor: COLORS.brandLight }}
                            />
                          </div>

                          <div>
                            <div className={LABEL}>Corporation</div>
                            <input
                              type="text"
                              value={unitForm.Category_Code}
                              readOnly
                              className={[INPUT, "mt-1 opacity-80"].join(" ")}
                              style={{ borderColor: COLORS.brandLight }}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="rounded-3xl p-5 theme-surface">
                    <div className="text-base font-bold theme-text">
                      Live Records
                    </div>
                    <div className="mt-1 text-xs theme-muted">
                      Populated from get_shift_details.
                    </div>

                    <div className="theme-border mt-4 overflow-auto rounded-2xl border">
                      <table className="theme-border min-w-full divide-y">
                        <thead>
                          <tr
                            style={{
                              background: `linear-gradient(180deg, ${COLORS.brandLighter}55 0%, transparent 100%)`,
                            }}
                          >
                            {activeCrudTab === "category" ? (
                              <>
                                <th className="px-4 py-3 text-left text-xs font-semibold theme-text">
                                  Category
                                </th>
                              </>
                            ) : (
                              <>
                                <th className="px-4 py-3 text-left text-xs font-semibold theme-text">
                                  Category
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold theme-text">
                                  Business Unit
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold theme-text">
                                  Unit Code
                                </th>
                              </>
                            )}
                          </tr>
                        </thead>

                        <tbody className="theme-border divide-y">
                          {activeCrudTab === "category" ? (
                            filteredCategories.length ? (
                              filteredCategories.map((item) => (
                                <tr key={item.id}>
                                  <td className="px-4 py-3 text-sm theme-text">
                                    {item.name}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td className="px-4 py-8 text-center text-sm theme-muted">
                                  No categories found.
                                </td>
                              </tr>
                            )
                          ) : filteredBusinessUnits.length ? (
                            filteredBusinessUnits.map((item) => (
                              <tr key={item.id}>
                                <td className="px-4 py-3 text-sm theme-text">
                                  {item.category}
                                </td>
                                <td className="px-4 py-3 text-sm theme-text">
                                  {item.label}
                                </td>
                                <td className="px-4 py-3 text-sm theme-muted">
                                  {item.info.unitCode}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={3}
                                className="px-4 py-8 text-center text-sm theme-muted"
                              >
                                No business units found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* -----------------------------
   MAIN COMPONENT
------------------------------ */
const PosSelectBusunitComponent = () => {
  const navigate = useNavigate();
  const apiHost = useApiHost();
  const { roles, userId, firstName } = useZustandLoginCred();
  const { width } = useWindowSize();

  const reduceMotion = useReducedMotion();
  const isMobile = width < 768;
  const reduceMobileMotion = reduceMotion || isMobile;

  const { data: userSelectedTheme } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_READ_SELECTED_THEME_ENDPOINT,
    "userthemes",
  );

  const applyPalette = (palette) => {
    if (!palette?.colors) return;
    const root = document.documentElement;
    Object.entries(palette.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
  };

  useEffect(() => {
    if (userSelectedTheme && userSelectedTheme.length > 0) {
      const themeSelected = userSelectedTheme.filter(
        (items) => items.userid === userId,
      );

      if (themeSelected.length > 0) {
        const palette = colorSchemes.filter(
          (colors) => colors.name === themeSelected[0].theme,
        );
        applyPalette(palette[0]);
      } else {
        applyPalette(colorSchemes[0]);
      }
    } else {
      applyPalette(colorSchemes[0]);
    }
  }, [userSelectedTheme, userId]);

  const COLORS = {
    brand: "var(--color-brandPrimary, #0f8a3a)",
    brandSecondary: "var(--color-brandSecondary, #169b43)",
    brandTertiary: "var(--color-brandTertiary, #8edb9c)",
    brandLight: "var(--color-light, #c4e5cb)",
    brandLighter: "var(--color-lighter, #dcf0e0)",
  };

  const emptyUnitForm = {
    id: "",
    category: "",
    value: "",
    label: "",
    categoryCode: "",
    unitCode: "",
    businessType: "",
    tinNumber: "",
    address: "",
    corporation: "",
  };

  const [categories, setCategories] = useState([]);
  const [businessUnits, setBusinessUnits] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState("");

  const [IsYesNoModalOpen, setYesNoModalOpen] = useState(false);
  const [showhidesuccess, setshowhidesuccess] = useState(false);
  const [showhidefailure, setshowhidefailure] = useState(false);

  const [returnmessage, setReturnmessage] = useState("Success");
  const [failureHeader, setFailureHeader] = useState("Validation");
  const [failureMessage, setFailureMessage] = useState(
    "Please complete fields.",
  );

  const [addedit, setaddedit] = useState("");

  const [isReadOpen, setIsReadOpen] = useState(false);
  const [activeCrudTab, setActiveCrudTab] = useState("category");
  const [manageSearch, setManageSearch] = useState("");

  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");

  const [categoryName, setCategoryName] = useState("");
  const [unitForm, setUnitForm] = useState(emptyUnitForm);

  const [errormessage, setErrormessage] = useState("");

  const [shiftDetails, setShiftDetails] = useState(null);
  const [isShiftLoading, setIsShiftLoading] = useState(false);
  const [shiftError, setShiftError] = useState("");

  const fetchShiftDetails = useCallback(async () => {
    if (!apiHost || !userId) return;

    setIsShiftLoading(true);
    setShiftError("");

    try {
      const response = await fetch(
        `${apiHost}/api/get_shift_details.php?user_id=${encodeURIComponent(userId)}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch shift details.");
      }

      const result = await response.json();
      console.log("PosSelectBusunitComponent shift details:", result);
      setShiftDetails(result || null);
    } catch (error) {
      console.error("Error fetching shift details:", error);
      setShiftDetails(null);
      setShiftError("Unable to load shift details.");
    } finally {
      setIsShiftLoading(false);
    }
  }, [apiHost, userId]);

  useEffect(() => {
    fetchShiftDetails();
  }, [fetchShiftDetails]);

  useEffect(() => {
    if (!shiftDetails) {
      setCategories([]);
      setBusinessUnits([]);
      setSelectedCategory("");
      setSelectedBusinessUnit("");
      setCategoryName("");
      setUnitForm(emptyUnitForm);
      return;
    }

    const liveCategoryName = String(shiftDetails?.Category_Code || "").trim();
    const liveUnitName = String(shiftDetails?.Unit_Name || "").trim();
    const liveUnitCode = String(shiftDetails?.Unit_Code || "").trim();

    const mappedCategories = liveCategoryName
      ? [
          {
            id: `CAT-${liveCategoryName}`,
            name: liveCategoryName,
          },
        ]
      : [];

    const mappedBusinessUnits =
      liveCategoryName || liveUnitName || liveUnitCode
        ? [
            {
              id: `BU-${liveUnitCode || liveUnitName || "LIVE"}`,
              category: liveCategoryName || "-",
              value: liveUnitName || "-",
              label: liveUnitName || "-",
              info: {
                categoryCode: shiftDetails?.Category_Code || "-",
                unitCode: shiftDetails?.Unit_Code || "-",
                businessType: shiftDetails?.Business_Type || "-",
                tinNumber: shiftDetails?.Unit_TIN || "-",
                address: shiftDetails?.Unit_Address || "-",
                corporation: shiftDetails?.Category_Code || "-",
              },
            },
          ]
        : [];

    setCategories(mappedCategories);
    setBusinessUnits(mappedBusinessUnits);

    setSelectedCategory(liveCategoryName || "");
    setSelectedBusinessUnit(liveUnitName || "");
    setCategoryName(liveCategoryName || "");
    setUnitForm({
      id: mappedBusinessUnits[0]?.id || "",
      category: liveCategoryName || "",
      value: liveUnitName || "",
      label: liveUnitName || "",
      categoryCode: shiftDetails?.Category_Code || "",
      unitCode: shiftDetails?.Unit_Code || "",
      businessType: shiftDetails?.Business_Type || "",
      tinNumber: shiftDetails?.TIN_No || "",
      address: shiftDetails?.Address || "",
      corporation: shiftDetails?.Corp_Name || "",
    });
  }, [shiftDetails]);

  const businessCategoryOptions = useMemo(
    () => categories.map((item) => ({ value: item.name, label: item.name })),
    [categories],
  );

  const availableBusinessUnits = useMemo(() => {
    return businessUnits.filter((item) => item.category === selectedCategory);
  }, [businessUnits, selectedCategory]);

  useEffect(() => {
    if (
      availableBusinessUnits.length &&
      !availableBusinessUnits.some((x) => x.value === selectedBusinessUnit)
    ) {
      setSelectedBusinessUnit(availableBusinessUnits[0]?.value || "");
    }

    if (!availableBusinessUnits.length) {
      setSelectedBusinessUnit("");
    }
  }, [selectedCategory, selectedBusinessUnit, availableBusinessUnits]);

  const selectedBUData =
    availableBusinessUnits.find((x) => x.value === selectedBusinessUnit) ||
    availableBusinessUnits[0] ||
    null;

  const liveDisplayInfo = useMemo(() => {
    return {
      categoryCode:
        shiftDetails?.Category_Code ||
        selectedBUData?.info?.categoryCode ||
        "-",
      unitCode:
        shiftDetails?.Unit_Code || selectedBUData?.info?.unitCode || "-",
      unitName: shiftDetails?.Unit_Name || selectedBUData?.label || "-",
      shiftStatus: shiftDetails?.Shift_Status || "-",
      shiftId: shiftDetails?.Shift_ID || "-",
      openingDateTime: shiftDetails?.Opening_DateTime || "-",
      closingDateTime: shiftDetails?.Closing_DateTime || "-",
      openedBy: shiftDetails?.opened_by_name || "N/A",
      closedBy: shiftDetails?.closed_by_name || "N/A",
      userName: shiftDetails?.userName || firstName || "-",
      userRole: shiftDetails?.userRole || "-",
      selectedDate: shiftDetails?.selectedDate || "-",
      businessType:
        shiftDetails?.Business_Type ||
        selectedBUData?.info?.businessType ||
        "-",
      tinNumber: shiftDetails?.TIN_No || selectedBUData?.info?.tinNumber || "-",
      address: shiftDetails?.Address || selectedBUData?.info?.address || "-",
      corporation:
        shiftDetails?.Corp_Name || selectedBUData?.info?.corporation || "-",
    };
  }, [shiftDetails, selectedBUData, firstName]);

  const filteredCategories = useMemo(() => {
    const q = String(manageSearch || "")
      .toLowerCase()
      .trim();
    if (!q) return categories;
    return categories.filter((item) => item.name.toLowerCase().includes(q));
  }, [categories, manageSearch]);

  const filteredBusinessUnits = useMemo(() => {
    const q = String(manageSearch || "")
      .toLowerCase()
      .trim();
    if (!q) return businessUnits;
    return businessUnits.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.info.unitCode.toLowerCase().includes(q) ||
        item.info.corporation.toLowerCase().includes(q),
    );
  }, [businessUnits, manageSearch]);

  const handleCrudFormReset = () => {
    setCategoryName(shiftDetails?.Category_Code || "");
    setUnitForm({
      id: businessUnits[0]?.id || "",
      category: shiftDetails?.Category_Code || "",
      value: shiftDetails?.Unit_Name || "",
      label: shiftDetails?.Unit_Name || "",
      categoryCode: shiftDetails?.Category_Code || "",
      unitCode: shiftDetails?.Unit_Code || "",
      businessType: shiftDetails?.Business_Type || "",
      tinNumber: shiftDetails?.TIN_No || "",
      address: shiftDetails?.Address || "",
      corporation: shiftDetails?.Corp_Name || "",
    });
    setSelectedCategoryId("");
    setSelectedUnitId("");
    setErrormessage("");
    setaddedit(activeCrudTab === "category" ? "ViewCategory" : "ViewUnit");
  };

  useEffect(() => {
    if (!addedit) {
      setaddedit(activeCrudTab === "category" ? "ViewCategory" : "ViewUnit");
    }
  }, [activeCrudTab, addedit]);

  const openCreateCategory = () => {};
  const openEditCategory = () => {};
  const openDeleteCategory = () => {};
  const openCreateUnit = () => {};
  const openEditUnit = () => {};
  const openDeleteUnit = () => {};

  const handleSelect = async () => {
    if (!selectedCategory || !selectedBusinessUnit) {
      setFailureHeader("Validation");
      setFailureMessage("Please select both category and business unit.");
      setshowhidefailure(true);
      return;
    }

    localStorage.setItem(
      "posBusinessCategoryCode",
      liveDisplayInfo.categoryCode || "",
    );
    localStorage.setItem("posBusinessUnitCode", liveDisplayInfo.unitCode || "");
    localStorage.setItem("posBusinessUnitName", liveDisplayInfo.unitName || "");
    localStorage.setItem("posShiftId", String(liveDisplayInfo.shiftId || ""));
    localStorage.setItem("posShiftStatus", liveDisplayInfo.shiftStatus || "");
    localStorage.setItem(
      "posShiftOpeningDateTime",
      liveDisplayInfo.openingDateTime || "",
    );
    localStorage.setItem("posCorpName", liveDisplayInfo.corporation || "");

    setReturnmessage("Selected");
    setshowhidesuccess(true);

    setTimeout(() => {
      navigate("/poscorehomescreen");
    }, 250);
  };

  const handleClose = () => {
    navigate(-1);
  };

  const triggerYesNoEvent = () => {
    switch (addedit) {
      case "Select":
        handleSelect();
        break;
      case "Close":
        handleClose();
        break;
      default:
        break;
    }
  };

  const containerVariants = reduceMobileMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.18 } },
      }
    : {
        hidden: { opacity: 0, y: 10 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: "easeOut" },
        },
      };

  return (
    <div className="theme-page relative min-h-screen w-full overflow-x-hidden overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-20 -top-20 h-72 w-72 rounded-full blur-3xl opacity-30"
          style={{
            background: `radial-gradient(circle, ${COLORS.brandLight} 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute -right-24 bottom-0 h-80 w-80 rounded-full blur-3xl opacity-20"
          style={{
            background: `radial-gradient(circle, ${COLORS.brandLighter} 0%, transparent 70%)`,
          }}
        />
      </div>

      {IsYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message={
            addedit === "Select"
              ? "Select this business unit and continue?"
              : addedit === "Close"
                ? "Close the selector?"
                : "Select yes to proceed or no to exit"
          }
          setYesNoModalOpen={setYesNoModalOpen}
          triggerYesNoEvent={triggerYesNoEvent}
        />
      )}

      {showhidesuccess && (
        <ModalSuccessNavToSelf
          header={returnmessage}
          message="Business unit selected successfully"
          button="OK"
          setIsModalOpen={setshowhidesuccess}
        />
      )}

      {showhidefailure && (
        <ModalFailure
          header={failureHeader}
          message={failureMessage}
          button="OK"
          setIsModalOpen={setshowhidefailure}
        />
      )}

      <ReadBusunitManageModal
        open={isReadOpen}
        onClose={() => setIsReadOpen(false)}
        activeCrudTab={activeCrudTab}
        setActiveCrudTab={setActiveCrudTab}
        manageSearch={manageSearch}
        setManageSearch={setManageSearch}
        categories={categories}
        businessUnits={businessUnits}
        selectedCategory={selectedCategory}
        categoryName={categoryName}
        setCategoryName={setCategoryName}
        unitForm={unitForm}
        setUnitForm={setUnitForm}
        addedit={addedit}
        setaddedit={setaddedit}
        setYesNoModalOpen={setYesNoModalOpen}
        setErrormessage={setErrormessage}
        handleCrudFormReset={handleCrudFormReset}
        filteredCategories={filteredCategories}
        filteredBusinessUnits={filteredBusinessUnits}
        openCreateCategory={openCreateCategory}
        openEditCategory={openEditCategory}
        openDeleteCategory={openDeleteCategory}
        openCreateUnit={openCreateUnit}
        openEditUnit={openEditUnit}
        openDeleteUnit={openDeleteUnit}
        COLORS={COLORS}
      />

      <div className="relative mx-auto w-full max-w-7xl p-3 sm:p-4 lg:p-6">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="theme-surface overflow-hidden rounded-[28px]"
        >
          <div
            className="px-5 py-4 sm:px-6 sm:py-5"
            style={{
              background: `linear-gradient(180deg, ${COLORS.brand} 0%, ${COLORS.brandSecondary} 100%)`,
            }}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-gray-100 sm:text-2xl">
                  Select Business Unit
                </h1>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveCrudTab("category");
                  setIsReadOpen(true);
                }}
                className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold text-gray-100 backdrop-blur-md transition hover:bg-white/15"
              >
                Manage Data
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="rounded-[26px] p-5 theme-surface sm:p-6">
                <div className="space-y-6 sm:space-y-8">
                  <div>
                    <label className="mb-2 block text-sm font-bold theme-text sm:text-base">
                      Business Category:{" "}
                      <span style={{ color: COLORS.brand }}>*</span>
                    </label>

                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="theme-input h-12 w-full rounded-2xl px-4 text-sm outline-none sm:h-14 sm:text-base"
                      style={{
                        border: `2px solid ${COLORS.brandLight}`,
                      }}
                    >
                      {businessCategoryOptions.length ? (
                        businessCategoryOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))
                      ) : (
                        <option value="">No category available</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold theme-text sm:text-base">
                      Business Unit Name:{" "}
                      <span style={{ color: COLORS.brand }}>*</span>
                    </label>

                    <select
                      value={selectedBusinessUnit}
                      onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                      className="theme-input h-12 w-full rounded-2xl px-4 text-sm outline-none sm:h-14 sm:text-base"
                      style={{
                        border: `2px solid ${COLORS.brandLight}`,
                      }}
                    >
                      {availableBusinessUnits.length ? (
                        availableBusinessUnits.map((option) => (
                          <option key={option.id} value={option.value}>
                            {option.label}
                          </option>
                        ))
                      ) : (
                        <option value="">No business unit available</option>
                      )}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 sm:pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setaddedit("Close");
                        setYesNoModalOpen(true);
                      }}
                      className="h-12 rounded-full px-4 text-sm font-bold text-gray-100 transition hover:scale-[0.99] active:scale-[0.98] sm:text-base"
                      style={{
                        background: `linear-gradient(180deg, ${COLORS.brandSecondary} 0%, ${COLORS.brand} 100%)`,
                      }}
                    >
                      Close
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setaddedit("Select");
                        setYesNoModalOpen(true);
                      }}
                      className="h-12 rounded-full px-4 text-sm font-bold text-gray-100 transition hover:scale-[0.99] active:scale-[0.98] sm:text-base"
                      style={{
                        background: `linear-gradient(180deg, ${COLORS.brand} 0%, ${COLORS.brandSecondary} 100%)`,
                        boxShadow: `0 14px 28px color-mix(in srgb, ${COLORS.brand} 34%, transparent)`,
                      }}
                    >
                      Select
                    </button>
                  </div>
                </div>
              </div>

              <div className="theme-card overflow-hidden rounded-[26px]">
                <div
                  className="theme-border border-b px-5 py-4"
                  style={{
                    background: `linear-gradient(180deg, ${COLORS.brandLighter}35 0%, transparent 100%)`,
                  }}
                >
                  <div
                    className="text-lg font-extrabold tracking-tight sm:text-[28px]"
                    style={{ color: COLORS.brand }}
                  >
                    Business Unit Information
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  <div className="space-y-4">
                    {[
                      {
                        label: "Category Code:",
                        value: liveDisplayInfo.categoryCode,
                      },
                      { label: "Unit Code:", value: liveDisplayInfo.unitCode },
                      { label: "Unit Name:", value: liveDisplayInfo.unitName },
                      {
                        label: "Shift Status:",
                        value: isShiftLoading
                          ? "Loading..."
                          : liveDisplayInfo.shiftStatus,
                      },
                      { label: "Shift ID:", value: liveDisplayInfo.shiftId },
                      {
                        label: "Opening DateTime:",
                        value: liveDisplayInfo.openingDateTime,
                      },
                      {
                        label: "Closing DateTime:",
                        value: liveDisplayInfo.closingDateTime,
                      },
                      { label: "Opened By:", value: liveDisplayInfo.openedBy },
                      { label: "Closed By:", value: liveDisplayInfo.closedBy },
                      { label: "User Name:", value: liveDisplayInfo.userName },
                      { label: "User Role:", value: liveDisplayInfo.userRole },
                      {
                        label: "Business Type:",
                        value: liveDisplayInfo.businessType,
                      },
                      {
                        label: "TIN Number:",
                        value: liveDisplayInfo.tinNumber,
                      },
                      { label: "Address:", value: liveDisplayInfo.address },
                      {
                        label: "Corporation:",
                        value: liveDisplayInfo.corporation,
                      },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="grid grid-cols-1 gap-2 md:grid-cols-[170px_minmax(0,1fr)] md:items-center"
                      >
                        <div className="text-sm font-extrabold theme-text sm:text-base">
                          {row.label}
                        </div>

                        <div
                          className="theme-input flex min-h-[48px] items-center justify-center rounded-2xl px-4 text-center text-sm font-semibold sm:min-h-[52px] sm:text-base"
                          style={{
                            border: `2px solid ${COLORS.brandLight}`,
                          }}
                        >
                          <span className="break-words">{row.value}</span>
                        </div>
                      </div>
                    ))}

                    {shiftError ? (
                      <p className="mt-2 text-sm font-semibold text-rose-600">
                        {shiftError}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-6 rounded-3xl p-4 theme-surface">
                    <div className="text-sm font-bold theme-text">
                      Live Data Summary
                    </div>
                    <div className="mt-1 text-xs theme-muted">
                      No hardcoded seed records are used anymore.
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {[
                        {
                          label: "Categories",
                          value: categories.length,
                          icon: <AiOutlineDashboard className="text-lg" />,
                        },
                        {
                          label: "Business Units",
                          value: businessUnits.length,
                          icon: <AiOutlineDatabase className="text-lg" />,
                        },
                        {
                          label: "Current Category Units",
                          value: availableBusinessUnits.length,
                          icon: <AiOutlineBarChart className="text-lg" />,
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-2xl p-4"
                          style={{
                            background: "var(--app-surface-strong)",
                            border: "1px solid var(--app-border)",
                          }}
                        >
                          <div
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-gray-100"
                            style={{
                              background: `linear-gradient(180deg, ${COLORS.brand} 0%, ${COLORS.brandSecondary} 100%)`,
                            }}
                          >
                            {item.icon}
                          </div>
                          <div className="mt-3 text-xs font-semibold theme-muted">
                            {item.label}
                          </div>
                          <div className="mt-1 text-2xl font-black theme-text">
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PosSelectBusunitComponent;
