/*******PROMPT START***********************
💡 Apply my CmpBrands-style CRUD workflow to this module using local inline data first, no backend yet. Use my existing index.css theme classes (`theme-page`, `theme-surface`, `theme-card`, `theme-input`, `theme-text`, `theme-muted`, `theme-border`) instead of building a separate dark/light UI object when possible. Preserve my dynamic color palette via CSS variables and applyPalette. Keep the design in my Modern Glassy 2025 style.

Requirements:
- full copy-paste-ready updated component
- inline editable seed data structured for easy backend replacement later
- create/edit/delete/select workflow
- stable read/manage modal outside parent if needed
- confirmation modal + success/failure modal flow
- form reset
- search/filter in modal
- reactive info panel if selection affects displayed details
- mobile-first responsive
- preserve my coding style, imports, naming, and overall structure as much as possible
- no pseudo-code, no partial snippets, output full code

Structure local CRUD similarly to my CmpBrands pattern:
- state for modal open/close, mode, selected item, form fields, search, return messages, errors
- helper functions for normalize/reset/create/edit/delete/select
- confirmation trigger logic that switches by mode
- easy future swap from local state to backend hooks/mutations

If a Select button exists, integrate it into the same workflow and validate required selections before proceeding.
Match my existing variable names and architecture as closely as possible. Do not simplify away my structure unless necessary.
*************************************PROMPT END ************************/

import React, { useEffect, useMemo, useState } from "react";
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
import {
  FaBars,
  FaBook,
  FaCheckCircle,
  FaLock,
  FaRegMoneyBillAlt,
  FaUserCheck,
  FaUserCog,
  FaUserEdit,
  FaEdit,
  FaTimes,
  FaPlus,
} from "react-icons/fa";
import { IoSettingsOutline } from "react-icons/io5";
import { FiBookOpen, FiSearch, FiX } from "react-icons/fi";

import useCustomQuery from "../../hooks/useCustomQuery";
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
          className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center px-3 sm:px-6 "
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
            className="relative w-full sm:max-w-6xl  overflow-y-auto max-h-[100vh]  rounded-3xl"
          >
            <div
              className="rounded-3xl p-[1px] shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
              style={{
                background: `linear-gradient(135deg, ${COLORS.brand}88, ${COLORS.brandSecondary}66, ${COLORS.brandLight}55)`,
              }}
            >
              <div className="theme-card relative overflow-hidden rounded-3xl">
                <div
                  className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full blur-3xl opacity-25"
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

                <div className="p-5 sm:p-6 border-b theme-border">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-black tracking-wide theme-muted">
                        LOCAL CRUD SETUP
                      </div>
                      <div className="mt-1 text-xl sm:text-2xl font-black tracking-tight theme-text">
                        Manage Categories & Business Units
                      </div>
                      <div className="mt-1 text-sm theme-muted">
                        Inline local data for now. Easy to replace with backend
                        later.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={close}
                      className="h-10 w-10 rounded-2xl grid place-items-center theme-surface hover:opacity-90 transition active:scale-[0.99]"
                      aria-label="Close modal"
                    >
                      <FiX className="h-4 w-4 theme-text" />
                    </button>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="inline-flex rounded-2xl theme-surface p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCrudTab("category");
                          handleCrudFormReset();
                        }}
                        className={[
                          "h-10 px-4 rounded-xl text-sm font-semibold transition",
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
                          "h-10 px-4 rounded-xl text-sm font-semibold transition",
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

                <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-5 p-5 sm:p-6">
                  {/* LEFT FORM */}
                  <div className="theme-surface rounded-3xl p-5 max-h-[60vh] overflow-y-auto">
                    {activeCrudTab === "category" ? (
                      <>
                        <div className="text-base font-bold theme-text">
                          {addedit === "EditCategory"
                            ? "Edit Category"
                            : "Create Category"}
                        </div>
                        <div className="mt-1 text-xs theme-muted">
                          Maintain business categories used by the first
                          dropdown.
                        </div>

                        <div className="mt-5">
                          <div className={LABEL}>
                            Category Name{" "}
                            <span style={{ color: COLORS.brand }}>*</span>
                          </div>
                          <input
                            type="text"
                            value={categoryName}
                            onChange={(e) => {
                              setCategoryName(e.target.value);
                              setErrormessage("");
                            }}
                            placeholder="e.g., CNC"
                            className={[INPUT, "mt-1"].join(" ")}
                            style={{
                              borderColor: COLORS.brandLight,
                            }}
                          />
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={handleCrudFormReset}
                            className={GHOST_BTN}
                          >
                            Form Reset
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setYesNoModalOpen(true);
                              setaddedit(
                                addedit === "EditCategory"
                                  ? "EditCategory"
                                  : "CreateCategory",
                              );
                            }}
                            className={PRIMARY_BTN}
                            style={{
                              background: `linear-gradient(180deg, ${COLORS.brand} 0%, ${COLORS.brandSecondary} 100%)`,
                            }}
                          >
                            Submit
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={openCreateCategory}
                          className={[GHOST_BTN, "w-full mt-3"].join(" ")}
                        >
                          <span className="inline-flex items-center gap-2">
                            <FaPlus className="text-xs" />
                            New Category
                          </span>
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="text-base font-bold theme-text">
                          {addedit === "EditUnit"
                            ? "Edit Business Unit"
                            : "Create Business Unit"}
                        </div>
                        <div className="mt-1 text-xs theme-muted">
                          Maintain business units and the info panel values.
                        </div>

                        <div className="mt-5 space-y-4">
                          <div>
                            <div className={LABEL}>
                              Category{" "}
                              <span style={{ color: COLORS.brand }}>*</span>
                            </div>
                            <select
                              value={unitForm.category}
                              onChange={(e) =>
                                setUnitForm((prev) => ({
                                  ...prev,
                                  category: e.target.value,
                                }))
                              }
                              className={[INPUT, "mt-1"].join(" ")}
                              style={{ borderColor: COLORS.brandLight }}
                            >
                              {categories.map((item) => (
                                <option key={item.id} value={item.name}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <div className={LABEL}>
                              Business Unit Name{" "}
                              <span style={{ color: COLORS.brand }}>*</span>
                            </div>
                            <input
                              type="text"
                              value={unitForm.label}
                              onChange={(e) =>
                                setUnitForm((prev) => ({
                                  ...prev,
                                  label: e.target.value,
                                  value: e.target.value.toUpperCase(),
                                }))
                              }
                              placeholder="e.g., STA MARIA"
                              className={[INPUT, "mt-1"].join(" ")}
                              style={{ borderColor: COLORS.brandLight }}
                            />
                          </div>

                          <div>
                            <div className={LABEL}>Category Code</div>
                            <input
                              type="text"
                              value={unitForm.categoryCode}
                              onChange={(e) =>
                                setUnitForm((prev) => ({
                                  ...prev,
                                  categoryCode: e.target.value,
                                }))
                              }
                              className={[INPUT, "mt-1"].join(" ")}
                              style={{ borderColor: COLORS.brandLight }}
                            />
                          </div>

                          <div>
                            <div className={LABEL}>Unit Code</div>
                            <input
                              type="text"
                              value={unitForm.unitCode}
                              onChange={(e) =>
                                setUnitForm((prev) => ({
                                  ...prev,
                                  unitCode: e.target.value,
                                }))
                              }
                              className={[INPUT, "mt-1"].join(" ")}
                              style={{ borderColor: COLORS.brandLight }}
                            />
                          </div>

                          <div>
                            <div className={LABEL}>Business Type</div>
                            <input
                              type="text"
                              value={unitForm.businessType}
                              onChange={(e) =>
                                setUnitForm((prev) => ({
                                  ...prev,
                                  businessType: e.target.value,
                                }))
                              }
                              className={[INPUT, "mt-1"].join(" ")}
                              style={{ borderColor: COLORS.brandLight }}
                            />
                          </div>

                          <div>
                            <div className={LABEL}>TIN Number</div>
                            <input
                              type="text"
                              value={unitForm.tinNumber}
                              onChange={(e) =>
                                setUnitForm((prev) => ({
                                  ...prev,
                                  tinNumber: e.target.value,
                                }))
                              }
                              className={[INPUT, "mt-1"].join(" ")}
                              style={{ borderColor: COLORS.brandLight }}
                            />
                          </div>

                          <div>
                            <div className={LABEL}>Address</div>
                            <input
                              type="text"
                              value={unitForm.address}
                              onChange={(e) =>
                                setUnitForm((prev) => ({
                                  ...prev,
                                  address: e.target.value,
                                }))
                              }
                              className={[INPUT, "mt-1"].join(" ")}
                              style={{ borderColor: COLORS.brandLight }}
                            />
                          </div>

                          <div>
                            <div className={LABEL}>Corporation</div>
                            <input
                              type="text"
                              value={unitForm.corporation}
                              onChange={(e) =>
                                setUnitForm((prev) => ({
                                  ...prev,
                                  corporation: e.target.value,
                                }))
                              }
                              className={[INPUT, "mt-1"].join(" ")}
                              style={{ borderColor: COLORS.brandLight }}
                            />
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={handleCrudFormReset}
                            className={GHOST_BTN}
                          >
                            Form Reset
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setYesNoModalOpen(true);
                              setaddedit(
                                addedit === "EditUnit"
                                  ? "EditUnit"
                                  : "CreateUnit",
                              );
                            }}
                            className={PRIMARY_BTN}
                            style={{
                              background: `linear-gradient(180deg, ${COLORS.brand} 0%, ${COLORS.brandSecondary} 100%)`,
                            }}
                          >
                            Submit
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={openCreateUnit}
                          className={[GHOST_BTN, "w-full mt-3"].join(" ")}
                        >
                          <span className="inline-flex items-center gap-2">
                            <FaPlus className="text-xs" />
                            New Business Unit
                          </span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* RIGHT LIST */}
                  <div className="theme-surface rounded-3xl p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-bold theme-text">
                          {activeCrudTab === "category"
                            ? "Existing Categories"
                            : "Existing Business Units"}
                        </div>
                        <div className="mt-1 text-xs theme-muted">
                          {activeCrudTab === "category"
                            ? "Edit or delete category entries."
                            : "Edit or delete business unit entries."}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 overflow-auto rounded-2xl border theme-border">
                      <table className="min-w-full divide-y theme-border">
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
                                <th className="px-4 py-3 text-center text-xs font-semibold theme-text">
                                  Edit
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-semibold theme-text">
                                  Delete
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
                                <th className="px-4 py-3 text-center text-xs font-semibold theme-text">
                                  Edit
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-semibold theme-text">
                                  Delete
                                </th>
                              </>
                            )}
                          </tr>
                        </thead>

                        <tbody className="divide-y theme-border">
                          {activeCrudTab === "category" ? (
                            filteredCategories.length ? (
                              filteredCategories.map((item) => (
                                <tr
                                  key={item.id}
                                  className="transition hover:bg-black/5"
                                >
                                  <td className="px-4 py-3 text-sm theme-text whitespace-nowrap">
                                    {item.name}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      type="button"
                                      className="inline-flex items-center justify-center h-9 w-9 rounded-xl theme-surface hover:opacity-90 transition active:scale-[0.99]"
                                      onClick={() => openEditCategory(item)}
                                    >
                                      <FaEdit
                                        className="h-4 w-4"
                                        style={{ color: COLORS.brand }}
                                      />
                                    </button>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      type="button"
                                      className="inline-flex items-center justify-center h-9 w-9 rounded-xl theme-surface hover:opacity-90 transition active:scale-[0.99]"
                                      onClick={() => openDeleteCategory(item)}
                                    >
                                      <FaTimes className="h-4 w-4 text-rose-600" />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td
                                  colSpan={3}
                                  className="px-4 py-8 text-center text-sm theme-muted"
                                >
                                  No categories found.
                                </td>
                              </tr>
                            )
                          ) : filteredBusinessUnits.length ? (
                            filteredBusinessUnits.map((item) => (
                              <tr
                                key={item.id}
                                className="transition hover:bg-black/5"
                              >
                                <td className="px-4 py-3 text-sm theme-text whitespace-nowrap">
                                  {item.category}
                                </td>
                                <td className="px-4 py-3 text-sm theme-text whitespace-nowrap">
                                  {item.label}
                                </td>
                                <td className="px-4 py-3 text-sm theme-muted whitespace-nowrap">
                                  {item.info.unitCode}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl theme-surface hover:opacity-90 transition active:scale-[0.99]"
                                    onClick={() => openEditUnit(item)}
                                  >
                                    <FaEdit
                                      className="h-4 w-4"
                                      style={{ color: COLORS.brand }}
                                    />
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl theme-surface hover:opacity-90 transition active:scale-[0.99]"
                                    onClick={() => openDeleteUnit(item)}
                                  >
                                    <FaTimes className="h-4 w-4 text-rose-600" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={5}
                                className="px-4 py-8 text-center text-sm theme-muted"
                              >
                                No business units found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {activeCrudTab === "unit" && selectedCategory ? (
                      <div className="mt-3 text-xs theme-muted">
                        Showing units for all categories. Current dropdown
                        category:{" "}
                        <span className="font-semibold">
                          {selectedCategory}
                        </span>
                      </div>
                    ) : null}
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
  const { roles, userId, firstName } = useZustandLoginCred();
  const { width } = useWindowSize();

  const reduceMotion = useReducedMotion();
  const isMobile = width < 768;
  const reduceMobileMotion = reduceMotion || isMobile;

  /* -----------------------------
     THEME / PALETTE
  ------------------------------ */
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

  /* -----------------------------
     INLINE LOCAL DATA
     Replace these later with backend data
  ------------------------------ */
  const initialCategories = [
    { id: "CAT-001", name: "CNC" },
    { id: "CAT-002", name: "RETAIL" },
    { id: "CAT-003", name: "FOODS" },
  ];

  const initialBusinessUnits = [
    {
      id: "BU-001",
      category: "CNC",
      value: "STA MARIA",
      label: "STA MARIA",
      info: {
        categoryCode: "Crab & Crack",
        unitCode: "BU-247001cd32f1",
        businessType: "Restaurant",
        tinNumber: "123-456-789-00000",
        address: "Sta. Maria Address",
        corporation: "CNC",
      },
    },
    {
      id: "BU-002",
      category: "CNC",
      value: "MEYCAUAYAN",
      label: "MEYCAUAYAN",
      info: {
        categoryCode: "Crab & Crack",
        unitCode: "BU-247001cd32f2",
        businessType: "Restaurant",
        tinNumber: "987-654-321-00000",
        address: "Meycauayan Address",
        corporation: "CNC",
      },
    },
    {
      id: "BU-003",
      category: "RETAIL",
      value: "MAIN BRANCH",
      label: "MAIN BRANCH",
      info: {
        categoryCode: "Retail",
        unitCode: "BU-RET-1001",
        businessType: "Store",
        tinNumber: "111-222-333-44444",
        address: "Main Branch Address",
        corporation: "Retail Corp",
      },
    },
    {
      id: "BU-004",
      category: "FOODS",
      value: "KITCHEN 1",
      label: "KITCHEN 1",
      info: {
        categoryCode: "Foods",
        unitCode: "BU-FD-1001",
        businessType: "Commissary",
        tinNumber: "555-666-777-88888",
        address: "Kitchen Address",
        corporation: "Foods Corp",
      },
    },
  ];

  const emptyUnitForm = {
    id: "",
    category: "CNC",
    value: "",
    label: "",
    categoryCode: "",
    unitCode: "",
    businessType: "",
    tinNumber: "",
    address: "",
    corporation: "",
  };

  /* -----------------------------
     CRUD / LOCAL STATE
  ------------------------------ */
  const [categories, setCategories] = useState(initialCategories);
  const [businessUnits, setBusinessUnits] = useState(initialBusinessUnits);

  const [selectedCategory, setSelectedCategory] = useState("CNC");
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState("STA MARIA");

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

  /* -----------------------------
     DERIVED DATA
  ------------------------------ */
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

  useEffect(() => {
    if (
      categories.length &&
      !categories.some((item) => item.name === selectedCategory)
    ) {
      setSelectedCategory(categories[0]?.name || "");
    }
  }, [categories, selectedCategory]);

  const selectedBUData =
    availableBusinessUnits.find((x) => x.value === selectedBusinessUnit) ||
    availableBusinessUnits[0];

  const info = selectedBUData?.info || {
    categoryCode: "-",
    unitCode: "-",
    businessType: "-",
    tinNumber: "-",
    address: "-",
    corporation: "-",
  };

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

  /* -----------------------------
     HELPERS
  ------------------------------ */
  const normalizeName = (v) => String(v || "").trim();

  const handleCrudFormReset = () => {
    setCategoryName("");
    setUnitForm({
      ...emptyUnitForm,
      category: selectedCategory || categories[0]?.name || "CNC",
    });
    setSelectedCategoryId("");
    setSelectedUnitId("");
    setErrormessage("");
    if (activeCrudTab === "category") {
      setaddedit("CreateCategory");
    } else {
      setaddedit("CreateUnit");
    }
  };

  useEffect(() => {
    if (!addedit) {
      setaddedit(
        activeCrudTab === "category" ? "CreateCategory" : "CreateUnit",
      );
    }
  }, [activeCrudTab, addedit]);

  const openCreateCategory = () => {
    setActiveCrudTab("category");
    setaddedit("CreateCategory");
    setCategoryName("");
    setSelectedCategoryId("");
    setErrormessage("");
  };

  const openEditCategory = (item) => {
    setActiveCrudTab("category");
    setaddedit("EditCategory");
    setSelectedCategoryId(item.id);
    setCategoryName(item.name);
    setErrormessage("");
  };

  const openDeleteCategory = (item) => {
    setActiveCrudTab("category");
    setaddedit("DeleteCategory");
    setSelectedCategoryId(item.id);
    setCategoryName(item.name);
    setYesNoModalOpen(true);
    setErrormessage("");
  };

  const openCreateUnit = () => {
    setActiveCrudTab("unit");
    setaddedit("CreateUnit");
    setSelectedUnitId("");
    setUnitForm({
      ...emptyUnitForm,
      category: selectedCategory || categories[0]?.name || "CNC",
    });
    setErrormessage("");
  };

  const openEditUnit = (item) => {
    setActiveCrudTab("unit");
    setaddedit("EditUnit");
    setSelectedUnitId(item.id);
    setUnitForm({
      id: item.id,
      category: item.category,
      value: item.value,
      label: item.label,
      categoryCode: item.info.categoryCode,
      unitCode: item.info.unitCode,
      businessType: item.info.businessType,
      tinNumber: item.info.tinNumber,
      address: item.info.address,
      corporation: item.info.corporation,
    });
    setErrormessage("");
  };

  const openDeleteUnit = (item) => {
    setActiveCrudTab("unit");
    setaddedit("DeleteUnit");
    setSelectedUnitId(item.id);
    setUnitForm({
      id: item.id,
      category: item.category,
      value: item.value,
      label: item.label,
      categoryCode: item.info.categoryCode,
      unitCode: item.info.unitCode,
      businessType: item.info.businessType,
      tinNumber: item.info.tinNumber,
      address: item.info.address,
      corporation: item.info.corporation,
    });
    setYesNoModalOpen(true);
    setErrormessage("");
  };

  /* -----------------------------
     CRUD ACTIONS
  ------------------------------ */
  const handleCreateCategory = () => {
    const name = normalizeName(categoryName).toUpperCase();

    if (!name) {
      setFailureHeader("Validation");
      setFailureMessage("Enter Category Name");
      setshowhidefailure(true);
      setErrormessage("CATEGORY");
      return;
    }

    const duplicate = categories.some((item) => item.name === name);
    if (duplicate) {
      setReturnmessage("Duplicate Entry");
      setshowhidesuccess(true);
      return;
    }

    const newItem = {
      id: `CAT-${Date.now()}`,
      name,
    };

    setCategories((prev) => [...prev, newItem]);
    setSelectedCategory(name);
    setReturnmessage("Created");
    setshowhidesuccess(true);
    openCreateCategory();
  };

  const handleEditCategory = () => {
    const name = normalizeName(categoryName).toUpperCase();

    if (!name) {
      setFailureHeader("Validation");
      setFailureMessage("Enter Category Name");
      setshowhidefailure(true);
      setErrormessage("CATEGORY");
      return;
    }

    const current = categories.find((item) => item.id === selectedCategoryId);
    if (!current) return;

    const duplicate = categories.some(
      (item) => item.name === name && item.id !== selectedCategoryId,
    );

    if (duplicate) {
      setReturnmessage("Duplicate Entry");
      setshowhidesuccess(true);
      return;
    }

    const oldName = current.name;

    setCategories((prev) =>
      prev.map((item) =>
        item.id === selectedCategoryId ? { ...item, name } : item,
      ),
    );

    setBusinessUnits((prev) =>
      prev.map((item) =>
        item.category === oldName ? { ...item, category: name } : item,
      ),
    );

    if (selectedCategory === oldName) {
      setSelectedCategory(name);
    }

    setReturnmessage("Edited");
    setshowhidesuccess(true);
    openCreateCategory();
  };

  const handleDeleteCategory = () => {
    const current = categories.find((item) => item.id === selectedCategoryId);
    if (!current) return;

    const hasUnits = businessUnits.some(
      (item) => item.category === current.name,
    );
    if (hasUnits) {
      setFailureHeader("Cannot Delete");
      setFailureMessage(
        "Delete or transfer the business units under this category first.",
      );
      setshowhidefailure(true);
      return;
    }

    const nextCategories = categories.filter(
      (item) => item.id !== selectedCategoryId,
    );

    setCategories(nextCategories);

    if (selectedCategory === current.name) {
      setSelectedCategory(nextCategories[0]?.name || "");
    }

    setReturnmessage("Deleted");
    setshowhidesuccess(true);
    openCreateCategory();
  };

  const handleCreateUnit = () => {
    const name = normalizeName(unitForm.label).toUpperCase();
    const category = normalizeName(unitForm.category).toUpperCase();

    if (!category || !name) {
      setFailureHeader("Validation");
      setFailureMessage("Category and Business Unit Name are required.");
      setshowhidefailure(true);
      setErrormessage("UNIT");
      return;
    }

    const duplicate = businessUnits.some(
      (item) => item.category === category && item.label === name,
    );

    if (duplicate) {
      setReturnmessage("Duplicate Entry");
      setshowhidesuccess(true);
      return;
    }

    const newItem = {
      id: `BU-${Date.now()}`,
      category,
      value: name,
      label: name,
      info: {
        categoryCode: normalizeName(unitForm.categoryCode) || "-",
        unitCode: normalizeName(unitForm.unitCode) || `BU-${Date.now()}`,
        businessType: normalizeName(unitForm.businessType) || "-",
        tinNumber: normalizeName(unitForm.tinNumber) || "-",
        address: normalizeName(unitForm.address) || "-",
        corporation: normalizeName(unitForm.corporation) || "-",
      },
    };

    setBusinessUnits((prev) => [...prev, newItem]);
    setSelectedCategory(category);
    setSelectedBusinessUnit(name);

    setReturnmessage("Created");
    setshowhidesuccess(true);
    openCreateUnit();
  };

  const handleEditUnit = () => {
    const category = normalizeName(unitForm.category).toUpperCase();
    const name = normalizeName(unitForm.label).toUpperCase();

    if (!category || !name) {
      setFailureHeader("Validation");
      setFailureMessage("Category and Business Unit Name are required.");
      setshowhidefailure(true);
      setErrormessage("UNIT");
      return;
    }

    const duplicate = businessUnits.some(
      (item) =>
        item.category === category &&
        item.label === name &&
        item.id !== selectedUnitId,
    );

    if (duplicate) {
      setReturnmessage("Duplicate Entry");
      setshowhidesuccess(true);
      return;
    }

    const current = businessUnits.find((item) => item.id === selectedUnitId);
    if (!current) return;

    setBusinessUnits((prev) =>
      prev.map((item) =>
        item.id === selectedUnitId
          ? {
              ...item,
              category,
              value: name,
              label: name,
              info: {
                categoryCode: normalizeName(unitForm.categoryCode) || "-",
                unitCode: normalizeName(unitForm.unitCode) || "-",
                businessType: normalizeName(unitForm.businessType) || "-",
                tinNumber: normalizeName(unitForm.tinNumber) || "-",
                address: normalizeName(unitForm.address) || "-",
                corporation: normalizeName(unitForm.corporation) || "-",
              },
            }
          : item,
      ),
    );

    if (selectedBusinessUnit === current.label) {
      setSelectedCategory(category);
      setSelectedBusinessUnit(name);
    }

    setReturnmessage("Edited");
    setshowhidesuccess(true);
    openCreateUnit();
  };

  const handleDeleteUnit = () => {
    const current = businessUnits.find((item) => item.id === selectedUnitId);
    if (!current) return;

    const nextUnits = businessUnits.filter(
      (item) => item.id !== selectedUnitId,
    );
    setBusinessUnits(nextUnits);

    if (selectedBusinessUnit === current.label) {
      const fallback = nextUnits.find(
        (item) => item.category === current.category,
      );
      if (fallback) {
        setSelectedCategory(fallback.category);
        setSelectedBusinessUnit(fallback.label);
      } else {
        setSelectedBusinessUnit("");
      }
    }

    setReturnmessage("Deleted");
    setshowhidesuccess(true);
    openCreateUnit();
  };

  const handleSelect = () => {
    if (!selectedCategory || !selectedBusinessUnit) {
      setFailureHeader("Validation");
      setFailureMessage("Please select both category and business unit.");
      setshowhidefailure(true);
      return;
    }

    console.log("Selected Business Unit:", {
      category: selectedCategory,
      businessUnit: selectedBusinessUnit,
      info,
      user: {
        firstName,
        roles,
        userId,
      },
    });

    setReturnmessage("Selected");
    setshowhidesuccess(true);
  };

  const handleClose = () => {
    console.log("Close BU selector");
    // navigate(-1);
  };

  const triggerYesNoEvent = () => {
    switch (addedit) {
      case "CreateCategory":
        handleCreateCategory();
        break;
      case "EditCategory":
        handleEditCategory();
        break;
      case "DeleteCategory":
        handleDeleteCategory();
        break;
      case "CreateUnit":
        handleCreateUnit();
        break;
      case "EditUnit":
        handleEditUnit();
        break;
      case "DeleteUnit":
        handleDeleteUnit();
        break;
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

  /* -----------------------------
     MOTION
  ------------------------------ */
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

  const guideItems = useMemo(
    () => [
      {
        label: "Select Category",
        ok: Boolean(selectedCategory),
        hint: "Choose a business category first.",
      },
      {
        label: "Select Business Unit",
        ok: Boolean(selectedBusinessUnit),
        hint: "Choose a business unit under the category.",
      },
      {
        label: "Review Business Unit Information",
        ok: Boolean(info?.unitCode && info?.unitCode !== "-"),
        hint: "Check the right panel before confirming.",
      },
      {
        label: "Manage Local Data",
        ok: true,
        hint: "Use Manage Data to create, edit, and delete entries.",
      },
    ],
    [selectedCategory, selectedBusinessUnit, info],
  );

  return (
    <div className="theme-page relative min-h-screen w-full overflow-x-hidden overflow-y-auto">
      <style>{`
        .no-callout {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
        }
      `}</style>

      {/* Background blobs */}
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

      {/* Confirm + success + failure */}
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
          triggerYesNoEvent={() => navigate("/poscorehomescreen")}
        />
      )}

      {showhidesuccess &&
        (returnmessage === "Duplicate Entry" ? (
          <ModalFailure
            header={returnmessage}
            message="Data already existed"
            button="OK"
            setIsModalOpen={setshowhidesuccess}
          />
        ) : (
          <ModalSuccessNavToSelf
            header={returnmessage}
            message={
              returnmessage === "Created"
                ? "New record successfully added"
                : returnmessage === "Edited"
                  ? "Record updated successfully"
                  : returnmessage === "Deleted"
                    ? "Record deleted successfully"
                    : "Business unit selected successfully"
            }
            button="OK"
            setIsModalOpen={setshowhidesuccess}
          />
        ))}

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
          {/* Top Header */}
          <div
            className="px-5 py-4 sm:px-6 sm:py-5"
            style={{
              background: `linear-gradient(180deg, ${COLORS.brand} 0%, ${COLORS.brandSecondary} 100%)`,
            }}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                  Select Business Unit
                </h1>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 lg:p-8">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              {/* Left side */}
              <div className="theme-surface rounded-[26px] p-5 sm:p-6">
                <div className="space-y-6 sm:space-y-8">
                  <div>
                    <label className="mb-2 block text-sm sm:text-base font-bold theme-text">
                      Business Category:{" "}
                      <span style={{ color: COLORS.brand }}>*</span>
                    </label>

                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="theme-input w-full h-12 sm:h-14 rounded-2xl px-4 text-sm sm:text-base outline-none"
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

                    {errormessage === "CATEGORY" && (
                      <p className="mt-2 text-sm font-semibold text-rose-600">
                        Enter Category Name
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm sm:text-base font-bold theme-text">
                      Business Unit Name:{" "}
                      <span style={{ color: COLORS.brand }}>*</span>
                    </label>

                    <select
                      value={selectedBusinessUnit}
                      onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                      className="theme-input w-full h-12 sm:h-14 rounded-2xl px-4 text-sm sm:text-base outline-none"
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

                    {errormessage === "UNIT" && (
                      <p className="mt-2 text-sm font-semibold text-rose-600">
                        Category and Business Unit Name are required
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 sm:pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setaddedit("Close");
                        setYesNoModalOpen(true);
                      }}
                      className="h-12 rounded-full px-4 text-sm sm:text-base font-bold text-white transition hover:scale-[0.99] active:scale-[0.98]"
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
                      className="h-12 rounded-full px-4 text-sm sm:text-base font-bold text-white transition hover:scale-[0.99] active:scale-[0.98]"
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

              {/* Right side */}
              <div className="theme-card rounded-[26px] overflow-hidden">
                <div
                  className="px-5 py-4 border-b theme-border"
                  style={{
                    background: `linear-gradient(180deg, ${COLORS.brandLighter}35 0%, transparent 100%)`,
                  }}
                >
                  <div
                    className="text-lg sm:text-[28px] font-extrabold tracking-tight"
                    style={{ color: COLORS.brand }}
                  >
                    Business Unit Information
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_120px] lg:gap-6">
                    <div className="space-y-4">
                      {[
                        { label: "Category Code:", value: info.categoryCode },
                        { label: "Unit Code:", value: info.unitCode },
                        { label: "Business Type:", value: info.businessType },
                        { label: "TIN Number:", value: info.tinNumber },
                        { label: "Address:", value: info.address },
                        { label: "Corporation:", value: info.corporation },
                      ].map((row) => (
                        <div
                          key={row.label}
                          className="grid grid-cols-1 gap-2 md:grid-cols-[150px_minmax(0,1fr)] md:items-center"
                        >
                          <div className="text-sm sm:text-base font-extrabold theme-text">
                            {row.label}
                          </div>

                          <div
                            className="theme-input flex min-h-[48px] sm:min-h-[52px] items-center justify-center rounded-2xl px-4 text-center text-sm sm:text-base font-semibold"
                            style={{
                              border: `2px solid ${COLORS.brandLight}`,
                            }}
                          >
                            {row.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden lg:flex items-start justify-center pt-2">
                      <div
                        className="w-full rounded-[22px] p-4"
                        style={{
                          background: "var(--app-panel)",
                          border: `1px solid var(--app-border)`,
                        }}
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div
                            className="grid h-20 w-20 place-items-center rounded-3xl"
                            style={{
                              background: `linear-gradient(180deg, ${COLORS.brandLighter} 0%, rgba(255,255,255,0.92) 100%)`,
                              border: `1px solid var(--app-border)`,
                            }}
                          >
                            <span className="text-5xl">🖥️</span>
                          </div>

                          <div className="text-center text-xs font-semibold theme-muted">
                            Desktop Unit
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* mobile helper tile */}
                  <div className="mt-5 lg:hidden">
                    <div
                      className="rounded-2xl p-4 flex items-center gap-3"
                      style={{
                        background: "var(--app-panel)",
                        border: `1px solid var(--app-border)`,
                      }}
                    >
                      <div
                        className="grid h-14 w-14 place-items-center rounded-2xl"
                        style={{
                          background: `linear-gradient(180deg, ${COLORS.brandLighter} 0%, rgba(255,255,255,0.92) 100%)`,
                          border: `1px solid var(--app-border)`,
                        }}
                      >
                        <span className="text-3xl">🖥️</span>
                      </div>

                      <div>
                        <div className="text-sm font-bold theme-text">
                          Selected Business Unit
                        </div>
                        <div className="text-xs mt-1 theme-muted">
                          Review the details before pressing Select.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* local debug / preview */}
                  <div className="mt-6 rounded-3xl theme-surface p-4">
                    <div className="text-sm font-bold theme-text">
                      Local Data Preview
                    </div>
                    <div className="mt-1 text-xs theme-muted">
                      These counts update as you create, edit, and delete inline
                      data.
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-white"
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
              {/* end right side */}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Floating manage/read button */}
      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-[9998]">
        <motion.button
          type="button"
          onClick={() => {
            setActiveCrudTab("category");
            setIsReadOpen(true);
          }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="group relative overflow-hidden rounded-full px-4 py-3 theme-surface transition active:scale-[0.99]"
          aria-label="Open Manage Data"
        >
          <span
            className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
            style={{
              background: `radial-gradient(circle at 30% 20%, ${COLORS.brandLight}, transparent 55%), radial-gradient(circle at 80% 80%, ${COLORS.brandLighter}, transparent 55%)`,
            }}
          />
          <span className="relative z-10 inline-flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-2xl theme-card">
              <FiBookOpen className="h-4 w-4" style={{ color: COLORS.brand }} />
            </span>
            <span className="text-sm font-semibold theme-text">
              Manage Data
            </span>
            <span className="text-xs font-semibold theme-muted">Open →</span>
          </span>
        </motion.button>
      </div>
    </div>
  );
};

export default PosSelectBusunitComponent;
