// CmpEmployeeInfo.jsx
// Full rewrite with screenshot-style top nav
// Consistent URL handling
// Create / Edit / Read / Images all use the same URL builder

import React, { useEffect, useMemo, useState } from "react";
import "../../fonts/font-style.css";
import "../../components/Hris/Hris.css";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, LinearProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useCustomSecuredMutation } from "../../hooks/useCustomSecuredMutation";
import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import useCustomQuery from "../../hooks/useCustomQuery";

import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import ModalSuccessNavToSelf from "../Modals/ModalSuccessNavToSelf";
import ModalFailure from "../Modals/ModalFailure";

import useZustandLoginCred from "../../context/useZustandLoginCred";

import {
  FiBookOpen,
  FiCheckCircle,
  FiEdit2,
  FiSearch,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { FaTimes, FaArrowLeft } from "react-icons/fa";
import {
  HiOutlineMoon,
  HiOutlineViewColumns,
  HiOutlineSquares2X2,
} from "react-icons/hi2";

/** -------------------------------------------
 * URL helpers
 * ------------------------------------------ */
function normalizeUrlPart(value) {
  return String(value || "").trim();
}

function joinUrl(base, endpoint) {
  const cleanBase = normalizeUrlPart(base).replace(/\/+$/, "");
  const cleanEndpoint = normalizeUrlPart(endpoint).replace(/^\/+/, "");

  if (!cleanBase && !cleanEndpoint) return "";
  if (!cleanBase) return `/${cleanEndpoint}`;
  if (!cleanEndpoint) return cleanBase;

  return `${cleanBase}/${cleanEndpoint}`;
}

/** -------------------------------------------
 * Modern loader
 * ------------------------------------------ */
function ModernLoader({ size = 18, className = "" }) {
  return (
    <span
      className={["relative inline-block align-middle", className].join(" ")}
      style={{ width: size, height: size }}
      aria-label="Loading"
    >
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 90deg, rgba(255,122,0,1), rgba(255,61,110,1), rgba(139,92,246,1), rgba(6,182,212,1), rgba(255,122,0,1))",
          WebkitMask:
            "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
          animation: "spinLoader 0.9s linear infinite",
        }}
      />
      <span
        className="absolute -inset-1 rounded-full blur-md opacity-40"
        style={{
          background:
            "conic-gradient(from 90deg, rgba(255,122,0,1), rgba(255,61,110,1), rgba(139,92,246,1), rgba(6,182,212,1), rgba(255,122,0,1))",
          animation: "spinLoader 0.9s linear infinite",
        }}
      />
      <span className="absolute inset-[5px] rounded-full bg-white" />
    </span>
  );
}

/** -------------------------------------------
 * Toggle switch
 * ------------------------------------------ */
function ToggleSwitch({
  checked,
  onChange,
  labelOn = "Series",
  labelOff = "Manual",
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "group inline-flex items-center gap-3 rounded-2xl border px-3 py-2 transition active:scale-[0.99]",
        checked
          ? "border-emerald-200 bg-emerald-50/80 text-emerald-700"
          : "border-amber-200 bg-amber-50/80 text-amber-700",
      ].join(" ")}
      aria-pressed={checked}
    >
      <span
        className={[
          "relative inline-flex h-7 w-12 items-center rounded-full transition",
          checked ? "bg-emerald-500/80" : "bg-amber-500/80",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
            checked ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </span>

      <span className="text-xs font-semibold tracking-wide">
        {checked ? labelOn : labelOff}
      </span>
    </button>
  );
}

/** -------------------------------------------
 * Screenshot-style top nav
 * ------------------------------------------ */
function TopNav({ activeNavView, setActiveNavView, onBack }) {
  return (
    <div className="sticky top-0 z-40 bg-[#eeeeef]/92 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1450px] items-center justify-between pt-8 sm:px-6 lg:px-10 ">
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center gap-3 rounded-full border border-slate-300/90 bg-white px-7 py-5 text-slate-600 shadow-[0_8px_30px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-[1px] hover:text-slate-900"
        >
          <FaArrowLeft
            size={15}
            className="transition-transform duration-200 group-hover:-translate-x-0.5"
          />
          <span className="text-[13px] font-extrabold uppercase tracking-[0.01em]">
            Back to Dashboard
          </span>
        </button>

      </div>
    </div>
  );
}

/** -------------------------------------------
 * Stable Read Modal (outside parent)
 * ------------------------------------------ */
function ReadEmployeesModal({
  open,
  onClose,
  search,
  setSearch,
  data,
  isLoading,
  onRefresh,
  onEdit,
  onDelete,
  handleFilterImageURL,
  logo,
  BTN_GHOST,
  INPUT,
  LABEL,
}) {
  const close = () => onClose?.();

  const [localSearch, setLocalSearch] = useState(search || "");

  useEffect(() => {
    if (open) setLocalSearch(search || "");
  }, [open, search]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setSearch(localSearch);
    }, 250);
    return () => clearTimeout(t);
  }, [localSearch, open, setSearch]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const filtered = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    const q = String(localSearch || "")
      .trim()
      .toLowerCase();

    if (!q) return list;

    return list.filter((item) => {
      const full =
        `${item.firstname || ""} ${item.lastname || ""}`.toLowerCase();

      return (
        String(item.lastname || "")
          .toLowerCase()
          .includes(q) ||
        String(item.firstname || "")
          .toLowerCase()
          .includes(q) ||
        String(item.payroll_empid || "")
          .toLowerCase()
          .includes(q) ||
        full.includes(q)
      );
    });
  }, [data, localSearch]);

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
      transition: { type: "spring", stiffness: 380, damping: 28 },
    },
    exit: { opacity: 0, y: 10, scale: 0.985, transition: { duration: 0.12 } },
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center px-2 sm:px-4 lg:px-6"
          variants={overlay}
          initial="hidden"
          animate="show"
          exit="exit"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />

          <motion.div
            variants={panel}
            initial="hidden"
            animate="show"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label="Read Employees"
            onMouseDown={(e) => e.stopPropagation()}
            className="relative w-full max-w-6xl"
            style={{ height: "min(92vh, 980px)" }}
          >
            <div className="h-full rounded-3xl p-[1px] bg-gradient-to-br from-colorBrand/70 via-redAccent/30 to-colorBrandSecondary/60 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <div className="relative h-full overflow-hidden rounded-3xl border border-white/60 bg-white/90 backdrop-blur-xl">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/10 to-transparent" />
                <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(215,85,41,0.18),transparent_60%)] blur-3xl" />
                <div className="pointer-events-none absolute -bottom-28 -left-28 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_70%_70%,rgba(236,72,153,0.12),transparent_60%)] blur-3xl" />

                <div className="flex h-full flex-col">
                  <div className="shrink-0 p-4 sm:p-5 lg:p-6 border-b border-slate-200/70">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-black tracking-wide text-slate-500">
                          HRIS • USERS
                        </div>
                        <div className="mt-1 text-lg sm:text-xl lg:text-2xl font-black tracking-tight text-slate-900">
                          <span className="bg-gradient-to-r font-[Poppins-Black] from-colorBrand via-redAccent to-colorBrandSecondary bg-clip-text text-transparent">
                            Employees
                          </span>{" "}
                          • Read & Manage
                        </div>
                        <div className="mt-1 text-xs sm:text-sm text-slate-600">
                          Search, edit, or review employee records.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={close}
                        className="h-10 w-10 rounded-2xl grid place-items-center border border-slate-200/80 bg-white/70 hover:bg-white transition active:scale-[0.99]"
                        aria-label="Close modal"
                      >
                        <FiX className="h-4 w-4 text-slate-700" />
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <div className={LABEL}>Search employee</div>
                        <div className="relative mt-1">
                          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                            placeholder="Type lastname, firstname, or payroll ID…"
                            className={[INPUT, "pl-10"].join(" ")}
                          />
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          Tip: typing filters the list automatically.
                        </div>
                      </div>

                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setLocalSearch("");
                            setSearch("");
                            onRefresh?.();
                          }}
                          className={[BTN_GHOST, "w-full"].join(" ")}
                        >
                          <span className="inline-flex items-center justify-center gap-2">
                            {isLoading ? <ModernLoader size={18} /> : null}
                            <span>{isLoading ? "Refreshing…" : "Reset"}</span>
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-xs text-slate-600">
                        {isLoading ? (
                          <>
                            <ModernLoader size={18} />
                            <span className="font-semibold">Syncing list…</span>
                          </>
                        ) : (
                          <>
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="font-semibold">Ready</span>
                          </>
                        )}
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-xs text-slate-600">
                        <span className="font-semibold">{filtered.length}</span>
                        <span>record(s)</span>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-5 lg:px-6 py-4">
                    <div className="grid grid-cols-1 gap-3 md:hidden">
                      {filtered.length ? (
                        filtered.map((row, idx) => (
                          <div
                            key={`${row.empid}-${idx}`}
                            className="rounded-3xl border border-slate-200/80 bg-white/75 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
                          >
                            <div className="flex items-start gap-3">
                              <Avatar
                                src={handleFilterImageURL(row.image_filename)}
                                style={{ height: 52, width: 52 }}
                                imgProps={{
                                  onError: (e) => {
                                    e.target.src = logo;
                                  },
                                }}
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-slate-900">
                                      {row.firstname} {row.lastname}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      Emp ID: {row.empid}
                                    </div>
                                  </div>

                                  <span
                                    className={[
                                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border",
                                      String(row.status || "")
                                        .trim()
                                        .toLowerCase() === "active"
                                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                                        : "bg-rose-500/10 text-rose-700 border-rose-500/20",
                                    ].join(" ")}
                                  >
                                    <span
                                      className={[
                                        "h-1.5 w-1.5 rounded-full",
                                        String(row.status || "")
                                          .trim()
                                          .toLowerCase() === "active"
                                          ? "bg-emerald-500"
                                          : "bg-rose-500",
                                      ].join(" ")}
                                    />
                                    {row.status || "Inactive"}
                                  </span>
                                </div>

                                <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2">
                                    <div className="text-[11px] font-semibold text-slate-500">
                                      Position / Department
                                    </div>
                                    <div className="mt-1 font-medium text-slate-900">
                                      {row.position} • {row.department}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2">
                                    <div className="text-[11px] font-semibold text-slate-500">
                                      Payroll ID
                                    </div>
                                    <div className="mt-1 font-medium text-slate-900">
                                      {row.payroll_empid}
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-4 flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center h-10 w-10 rounded-2xl border border-slate-200/80 bg-white/70 hover:bg-white transition active:scale-[0.99]"
                                    title="Edit"
                                    onClick={() => {
                                      onClose?.();
                                      onEdit?.(row);
                                    }}
                                  >
                                    <FiEdit2 className="h-4 w-4 text-colorBrand" />
                                  </button>

                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center h-10 w-10 rounded-2xl border border-slate-200/80 bg-white/70 hover:bg-white transition active:scale-[0.99]"
                                    title="Delete"
                                    onClick={() => {
                                      onClose?.();
                                      onDelete?.(row);
                                    }}
                                  >
                                    <FaTimes className="h-4 w-4 text-rose-600" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-3xl border border-slate-200/80 bg-white/75 px-4 py-10 text-center text-sm text-slate-600">
                          No results found.
                        </div>
                      )}
                    </div>

                    <div className="hidden md:block">
                      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70">
                        <div className="max-h-[100%] overflow-auto">
                          <table className="min-w-full divide-y divide-slate-200">
                            <thead className="sticky top-0 z-10 bg-colorBrand/10 backdrop-blur">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">
                                  Employee
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">
                                  Position / Department
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">
                                  Payroll ID
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">
                                  Status
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700">
                                  Edit
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700">
                                  Delete
                                </th>
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-200 bg-white">
                              {filtered.length ? (
                                filtered.map((row, idx) => (
                                  <tr
                                    key={`${row.empid}-${idx}`}
                                    className="hover:bg-slate-50 transition"
                                  >
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <Avatar
                                          src={handleFilterImageURL(row.image_filename)}
                                          style={{ height: 42, width: 42 }}
                                          imgProps={{
                                            onError: (e) => {
                                              e.target.src = logo;
                                            },
                                          }}
                                        />
                                        <div className="min-w-0">
                                          <div className="text-sm font-semibold text-slate-900 truncate">
                                            {row.firstname} {row.lastname}
                                          </div>
                                          <div className="text-xs text-slate-500 truncate">
                                            Emp ID: {row.empid}
                                          </div>
                                        </div>
                                      </div>
                                    </td>

                                    <td className="px-4 py-3 text-sm text-slate-900 whitespace-nowrap">
                                      {row.position} • {row.department}
                                    </td>

                                    <td className="px-4 py-3 text-sm text-slate-900 whitespace-nowrap">
                                      {row.payroll_empid}
                                    </td>

                                    <td className="px-4 py-3">
                                      <span
                                        className={[
                                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border",
                                          String(row.status || "")
                                            .trim()
                                            .toLowerCase() === "active"
                                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                                            : "bg-rose-500/10 text-rose-700 border-rose-500/20",
                                        ].join(" ")}
                                      >
                                        <span
                                          className={[
                                            "h-1.5 w-1.5 rounded-full",
                                            String(row.status || "")
                                              .trim()
                                              .toLowerCase() === "active"
                                              ? "bg-emerald-500"
                                              : "bg-rose-500",
                                          ].join(" ")}
                                        />
                                        {row.status || "Inactive"}
                                      </span>
                                    </td>

                                    <td className="px-4 py-3 text-center">
                                      <button
                                        type="button"
                                        className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200/80 bg-white/70 hover:bg-white transition active:scale-[0.99]"
                                        title="Edit"
                                        onClick={() => {
                                          onClose?.();
                                          onEdit?.(row);
                                        }}
                                      >
                                        <FiEdit2 className="h-4 w-4 text-colorBrand" />
                                      </button>
                                    </td>

                                    <td className="px-4 py-3 text-center">
                                      <button
                                        type="button"
                                        className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200/80 bg-white/70 hover:bg-white transition active:scale-[0.99]"
                                        title="Delete"
                                        onClick={() => {
                                          onClose?.();
                                          onDelete?.(row);
                                        }}
                                      >
                                        <FaTimes className="h-4 w-4 text-rose-600" />
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td
                                    colSpan={6}
                                    className="px-4 py-10 text-center text-sm text-slate-600"
                                  >
                                    No results found.
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
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

const CmpEmployeeInfo = () => {
  const { roles } = useZustandLoginCred();
  const navigate = useNavigate();
  const [activeNavView, setActiveNavView] = useState("grid");

  /** -------------------------------------------
   * Single source of truth for API base URL
   * ------------------------------------------ */
  const apiBaseUrl = useMemo(() => {
    return (
      import.meta.env.VITE_LOCALAPIENDPOINT ||
      localStorage.getItem("apiendpoint") ||
      ""
    );
  }, []);

  const logoUrl = useMemo(() => {
    return joinUrl(apiBaseUrl, import.meta.env.VITE_LOGO);
  }, [apiBaseUrl]);

  /** -------------------------------------------
   * Read/query URLs
   * ------------------------------------------ */
  const employeePositionUrl = useMemo(() => {
    return joinUrl(
      apiBaseUrl,
      import.meta.env.VITE_MUTATE_EMPLOYEE_POSITION_ENDPOINT,
    );
  }, [apiBaseUrl]);

  const departmentUrl = useMemo(() => {
    return joinUrl(apiBaseUrl, import.meta.env.VITE_MUTATE_DEPARTMENT_ENDPOINT);
  }, [apiBaseUrl]);

  const businessUnitUrl = useMemo(() => {
    return joinUrl(apiBaseUrl, import.meta.env.VITE_BUSINESS_UNITS_READ_ENDPOINT);
  }, [apiBaseUrl]);

  const employeesDataMutationUrl = useMemo(() => {
    return joinUrl(
      apiBaseUrl,
      import.meta.env.VITE_EMPLOYEES_DATA_MUTATION_ENDPOINT,
    );
  }, [apiBaseUrl]);

  const employeeInfoUploadUrl = useMemo(() => {
    return joinUrl(apiBaseUrl, import.meta.env.VITE_EMPLOYEE_INFO_UPLOAD);
  }, [apiBaseUrl]);

  const editEmployeeInfoUrl = useMemo(() => {
    return joinUrl(apiBaseUrl, import.meta.env.VITE_EDIT_EMPLOYEE_INFO);
  }, [apiBaseUrl]);

  const imageBaseUrl = useMemo(() => {
    return joinUrl(apiBaseUrl, import.meta.env.VITE_IMAGE_URLS);
  }, [apiBaseUrl]);

  const PAGE_BG =
    "relative min-h-screen w-full overflow-x-clip bg-[#eeeeef] text-slate-900";
  const GLASS_CARD = [
    "rounded-3xl border border-slate-200/80 bg-white/65 backdrop-blur-xl",
    "shadow-[0_18px_50px_rgba(15,23,42,0.07)]",
  ].join(" ");

  const INPUT =
    "h-11 w-full rounded-2xl border border-slate-200/80 bg-white/70 px-4 text-base sm:text-sm text-slate-900 " +
    "outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-[#D75529]/25 focus:border-[#D75529]/30";

  const SELECT =
    "h-11 w-full rounded-2xl border border-slate-200/80 bg-white/70 px-4 text-base sm:text-sm text-slate-900 " +
    "outline-none focus:ring-2 focus:ring-[#D75529]/25 focus:border-[#D75529]/30";

  const LABEL = "text-[11px] font-semibold tracking-wide text-slate-500";

  const BTN_PRIMARY =
    "h-11 px-5 rounded-2xl font-semibold text-white " +
    "bg-gradient-to-r from-colorBrand via-colorBrandSecondary to-redAccent " +
    "hover:opacity-95 active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed";

  const BTN_GHOST =
    "h-11 px-5 rounded-2xl font-semibold text-slate-700 " +
    "border border-slate-200/80 bg-white/70 hover:bg-white transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed";

  const colorBrand = "#D75529";

  const BG_BLOBS = (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#f0f0f1] via-[#efeff0] to-[#faf7f5]" />
      <div className="absolute -top-36 -left-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(215,85,41,0.08),transparent_55%)] blur-2xl" />
      <div className="absolute -bottom-44 -right-44 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_70%_70%,rgba(236,72,153,0.08),transparent_58%)] blur-2xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(0,0,0,0.03),transparent_35%),radial-gradient(circle_at_90%_90%,rgba(0,0,0,0.02),transparent_35%)]" />
    </div>
  );

  const digitsOnly = (value) => String(value || "").replace(/\D/g, "");
  const preventWheelOnNumber = (e) => e.currentTarget.blur();

  const [formStep, setFormStep] = useState(1);
  const [formSubmitIsLoading, setFormSubmitIsLoading] = useState(false);

  const [IsYesNoModalOpen, setYesNoModalOpen] = useState(false);
  const [showhidesuccess, setshowhidesuccess] = useState(false);
  const [canceledit, setcanceledit] = useState(false);
  const [addedit, setaddedit] = useState("");
  const [successmassage, setsuccessmassage] = useState("");

  const [payrollempid, setpayrollempid] = useState("");
  const [isPayrollSeries, setIsPayrollSeries] = useState(true);

  const [empid, setempid] = useState("");
  const [firstname, setfirstname] = useState("");
  const [middlename, setmiddlename] = useState("");
  const [lastname, setlastname] = useState("");
  const [position, setposition] = useState("");
  const [department, setdepartment] = useState("");
  const [birthdate, setbirthdate] = useState("");
  const [sss, setsss] = useState("");
  const [phic, setphic] = useState("");
  const [mdf, setmdf] = useState("");
  const [tin, settin] = useState("");
  const [contactno, setcontactno] = useState("");
  const [email, setemail] = useState("");
  const [address, setaddress] = useState("");
  const [date_started, setdate_started] = useState("");
  const [salary, setsalary] = useState("");
  const [salarytype, setsalarytype] = useState("");
  const [businessunit, setbusinessunit] = useState("");
  const [taxclass, settaxclass] = useState("");
  const [sppclass, setsppclass] = useState("");
  const [dayfactor, setdayfactor] = useState("");
  const [employeeinfodata, setemployeeinfodata] = useState([]);
  const [employeeinfoSearch, setemployeeinfoSearch] = useState("");
  const [imageSelected, setImageSelected] = useState(null);
  const [previewImageURL, setPreviewImageURL] = useState(null);
  const [previousImage, setPreviousImage] = useState("");

  const [isReadOpen, setIsReadOpen] = useState(false);

  const [isApproveNoticeOpen, setIsApproveNoticeOpen] = useState(false);
  const [approveNoticeMessage, setApproveNoticeMessage] = useState(
    "This user must be approved first before they can use the system.\n\nOnce approved, the system will send the login password to their email.",
  );

  const goToUsersQueue = () => {
    setIsApproveNoticeOpen(false);
    navigate("/usersqueu");
  };

  /** -------------------------------------------
   * Queries
   * ------------------------------------------ */
  const { data: qryEmppositonData = [] } = useCustomQuery(
    employeePositionUrl,
    ["employee-position"],
  );

  const { data: qrydepartmentData = [] } = useCustomQuery(departmentUrl, [
    "department",
  ]);

  const { data: qrybusiunitviewData = [] } = useCustomQuery(businessUnitUrl, [
    "business-unit",
  ]);

  /** -------------------------------------------
   * List mutation
   * ------------------------------------------ */
  const [pageItems] = useState(10);
  const [indexPage] = useState(0);

  const {
    data: mutationData,
    isLoading: mutationIsLoading,
    mutate,
  } = useCustomSecuredMutation(employeesDataMutationUrl);

  /** -------------------------------------------
   * Delete mutation
   * ------------------------------------------ */
  const { data: deleteData } = useSecuredMutation(
    employeeInfoUploadUrl,
    "POST",
  );

  /** -------------------------------------------
   * List bootstrap
   * ------------------------------------------ */
  useEffect(() => {
    if (!employeesDataMutationUrl) return;
    mutate({ pageIndex: indexPage + 1, pageItems });
  }, [employeesDataMutationUrl, indexPage, pageItems, mutate]);

  useEffect(() => {
    const list = Array.isArray(mutationData) ? mutationData : [];
    const q = String(employeeinfoSearch || "")
      .trim()
      .toLowerCase();

    if (!q) {
      setemployeeinfodata(list);
      return;
    }

    setemployeeinfodata(
      list.filter((employeeinfo) => {
        const full =
          `${employeeinfo.firstname || ""} ${employeeinfo.lastname || ""}`.toLowerCase();

        return (
          String(employeeinfo.lastname || "")
            .toLowerCase()
            .includes(q) ||
          String(employeeinfo.firstname || "")
            .toLowerCase()
            .includes(q) ||
          String(employeeinfo.payroll_empid || "")
            .toLowerCase()
            .includes(q) ||
          full.includes(q)
        );
      }),
    );
  }, [mutationData, employeeinfoSearch]);

  useEffect(() => {
    if (deleteData) {
      mutate({ pageIndex: indexPage + 1, pageItems });
    }
  }, [deleteData, indexPage, pageItems, mutate]);

  /** -------------------------------------------
   * Helpers
   * ------------------------------------------ */
  const handleRefreshList = () => {
    mutate({ pageIndex: indexPage + 1, pageItems });
  };

  const handleImagePreview = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewImageURL(URL.createObjectURL(file));
    } else {
      setPreviewImageURL(null);
    }
  };

  const handleFilterImageURL = (imagePath) => {
    const inputString = imagePath || "";
    const parts = inputString.split("images/employees/");
    const imageName = parts?.[1] || "";
    return joinUrl(imageBaseUrl, imageName);
  };

  const handleEditReset = () => {
    setpayrollempid("");
    setIsPayrollSeries(true);
    setempid("");
    setfirstname("");
    setmiddlename("");
    setlastname("");
    setposition("");
    setdepartment("");
    setbirthdate("");
    setsss("");
    setphic("");
    setmdf("");
    settin("");
    setcontactno("");
    setemail("");
    setaddress("");
    setsalary("");
    setsalarytype("");
    setbusinessunit("");
    settaxclass("");
    setsppclass("");
    setdayfactor("");
    setdate_started("");
    setaddedit("");
    setImageSelected(null);
    setPreviousImage("");
    setPreviewImageURL(null);
    setFormSubmitIsLoading(false);
    setFormStep(1);
    setcanceledit(false);
  };

  const requiredPayrollOK = isPayrollSeries
    ? true
    : digitsOnly(payrollempid) !== "";

  const requiredStep1OK =
    requiredPayrollOK &&
    firstname !== "" &&
    lastname !== "" &&
    businessunit !== "" &&
    position !== "" &&
    department !== "" &&
    birthdate !== "" &&
    contactno !== "" &&
    email !== "" &&
    address !== "" &&
    date_started !== "";

  const goNext = () => {
    if (!requiredStep1OK) {
      alert("Please complete all required fields in Step 1.");
      return;
    }
    setFormStep(2);
  };

  const goBack = () => setFormStep(1);

  /** -------------------------------------------
   * Plan gating
   * ------------------------------------------ */
  const roleSet = useMemo(() => {
    const arr = Array.isArray(roles?.[0]) ? roles[0] : [];
    return new Set(arr.map((r) => String(r?.rolename || "").toUpperCase()));
  }, [roles]);

  const isActiveStatus = (s) =>
    String(s || "")
      .trim()
      .toLowerCase() === "active";

  const planInfo = useMemo(() => {
    if (roleSet.has("UNLIMITED")) return { plan: "UNLIMITED", max: Infinity };
    if (roleSet.has("PREMIUM")) return { plan: "PREMIUM", max: 10 };
    if (roleSet.has("PRO")) return { plan: "PRO", max: 3 };
    return { plan: "FREE", max: 100 };
  }, [roleSet]);

  const activeUserCount = useMemo(() => {
    const list = Array.isArray(mutationData) ? mutationData : [];
    return list.filter((u) => isActiveStatus(u.status)).length;
  }, [mutationData]);

  const isEditMode = useMemo(
    () => addedit === "Edit" || canceledit,
    [addedit, canceledit],
  );

  /** -------------------------------------------
   * Create
   * ------------------------------------------ */
  const handleFormSubmit = async () => {
    if (!requiredStep1OK) {
      alert("Failed submission: empty required fields.");
      return;
    }

    if (!employeeInfoUploadUrl) {
      alert("Employee create URL is missing. Check your .env values.");
      return;
    }

    setFormSubmitIsLoading(true);

    const formData = new FormData();
    formData.append("payrollmode", isPayrollSeries ? "SERIES" : "MANUAL");
    formData.append("payrollempid", digitsOnly(payrollempid));
    formData.append("firstname", firstname.toUpperCase());
    formData.append("middlename", middlename.toUpperCase());
    formData.append("lastname", lastname.toUpperCase());
    formData.append("position", position.toUpperCase());
    formData.append("department", department.toUpperCase());
    formData.append("birthdate", birthdate);
    formData.append("sss", digitsOnly(sss));
    formData.append("phic", digitsOnly(phic));
    formData.append("mdf", digitsOnly(mdf));
    formData.append("tin", digitsOnly(tin));
    formData.append("contactno", digitsOnly(contactno));
    formData.append("email", email.toUpperCase());
    formData.append("address", address.toUpperCase());
    formData.append("datestarted", date_started);
    formData.append("salary", salary);
    formData.append("salarytype", salarytype);
    formData.append("businessunit", businessunit);
    formData.append("taxclass", taxclass);
    formData.append("sppclass", sppclass);
    formData.append("dayfactor", dayfactor);

    if (imageSelected) {
      formData.append("employeeimage", imageSelected);
    }

    try {
      const response = await fetch(employeeInfoUploadUrl, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + localStorage.getItem("access_token"),
        },
        body: formData,
      });

      const res = await response.json();

      if (!response.ok) {
        alert(res.message || "Failed to save employee.");
        return;
      }

      if (res.message === "DuplicateInfo") {
        alert("Employee email already exists in employee records.");
      } else if (res.message === "DuplicateUser") {
        alert("User email already exists in users table.");
      } else if (res.message === "DuplicatePayrollId") {
        alert("Payroll ID already exists.");
      } else if (
        res.message === "imageUploadSuccess" ||
        res.message === "infoOnlyUploadSuccess"
      ) {
        handleEditReset();
        setsuccessmassage("Create");
        setshowhidesuccess(true);
        mutate({ pageIndex: indexPage + 1, pageItems });

        setApproveNoticeMessage(
          `New user has been added.\n\nResolved Payroll ID: ${res.payroll_empid || "-"}\n\nThey need to be approved first before they can use the system.\n\nOnce approved, the system will send the password to their email.`,
        );
        setIsApproveNoticeOpen(true);
      } else {
        alert(res.message || "Unexpected response.");
      }
    } catch (error) {
      alert("Error saving employee information: " + error.message);
    } finally {
      setFormSubmitIsLoading(false);
    }
  };

  /** -------------------------------------------
   * Edit
   * ------------------------------------------ */
  const handleEditSubmit = async () => {
    if (!requiredStep1OK) {
      alert("Edit submission failed: missing required fields.");
      return;
    }

    if (!editEmployeeInfoUrl) {
      alert("Employee edit URL is missing. Check your .env values.");
      return;
    }

    setFormSubmitIsLoading(true);

    const editFormData = new FormData();
    editFormData.append("payrollmode", isPayrollSeries ? "SERIES" : "MANUAL");
    editFormData.append("payrollempid", digitsOnly(payrollempid));
    editFormData.append("firstname", firstname.toUpperCase());
    editFormData.append("middlename", middlename.toUpperCase());
    editFormData.append("lastname", lastname.toUpperCase());
    editFormData.append("position", position.toUpperCase());
    editFormData.append("department", department.toUpperCase());
    editFormData.append("birthdate", birthdate);
    editFormData.append("sss", digitsOnly(sss));
    editFormData.append("phic", digitsOnly(phic));
    editFormData.append("mdf", digitsOnly(mdf));
    editFormData.append("tin", digitsOnly(tin));
    editFormData.append("contactno", digitsOnly(contactno));
    editFormData.append("email", email.toUpperCase());
    editFormData.append("address", address.toUpperCase());
    editFormData.append("salary", salary);
    editFormData.append("salarytype", salarytype);
    editFormData.append("businessunit", businessunit);
    editFormData.append("taxclass", taxclass);
    editFormData.append("sppclass", sppclass);
    editFormData.append("dayfactor", dayfactor);
    editFormData.append("datestarted", date_started);
    editFormData.append("empid", empid);
    editFormData.append("previousimage", previousImage);

    if (imageSelected) {
      editFormData.append("employeeimage", imageSelected);
    }

    try {
      const response = await fetch(editEmployeeInfoUrl, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + localStorage.getItem("access_token"),
        },
        body: editFormData,
      });

      const res = await response.json();

      if (!response.ok) {
        alert(res.message || "Failed to update employee.");
        return;
      }

      if (res.message === "DuplicatePayrollId") {
        alert("Payroll ID already exists.");
      } else if (res.message === "DuplicateInfo") {
        alert("Employee email already exists in employee records.");
      } else if (res.message === "DuplicateUser") {
        alert("User email already exists in users table.");
      } else if (res.message === "Success") {
        setsuccessmassage("Edit");
        setshowhidesuccess(true);
        handleEditReset();
        mutate({ pageIndex: indexPage + 1, pageItems });
      } else {
        alert(res.message || "Unexpected response.");
      }
    } catch (error) {
      alert("Error saving employee information: " + error.message);
    } finally {
      setFormSubmitIsLoading(false);
    }
  };

  const openEdit = (data) => {
    setaddedit("Edit");
    setempid(data.empid);
    setfirstname(data.firstname || "");
    setmiddlename(data.middlename || "");
    setlastname(data.lastname || "");
    setposition(data.position || "");
    setdepartment(data.department || "");
    setbirthdate(data.birthdate || "");
    setsss(data.sss || "");
    setphic(data.phic || "");
    setmdf(data.mdf || "");
    settin(data.tin || "");
    setcontactno(data.contact_no || "");
    setemail(data.email || "");
    setaddress(data.address || "");
    setsalary(data.salary || "");
    setsalarytype(data.salary_type || "");
    setbusinessunit(data.busunit_code || "");
    settaxclass(data.tax_class || "");
    setsppclass(data.spp_class || "");
    setdayfactor(data.factordays || "");
    setdate_started(data.date_started || "");
    setPreviousImage(data.image_filename || "");
    setpayrollempid(String(data.payroll_empid || ""));
    setIsPayrollSeries(false);
    setsuccessmassage("Edit");
    setcanceledit(true);
    setFormStep(1);
  };

  const requestDelete = (data) => {
    setYesNoModalOpen(true);
    setaddedit("Delete");
    setsuccessmassage("Delete");
    setempid(data.empid);
    setfirstname(data.firstname);
  };

  const brandNameOK = useMemo(
    () => String(firstname || "").trim().length > 0,
    [firstname],
  );

  const guideItems = useMemo(
    () => [
      {
        label: isPayrollSeries ? "Series Payroll ID" : "Manual Payroll ID",
        ok: requiredPayrollOK,
        hint: isPayrollSeries
          ? "Backend will assign highest payroll ID + 1 on create."
          : "Manual payroll ID must contain numbers only and will be checked for duplicates.",
      },
      {
        label: canceledit ? "Edit Mode" : "Create Mode",
        ok: true,
        hint: canceledit
          ? "You selected an employee from Read list."
          : "You’re adding a new employee.",
      },
      {
        label: "Open Read (Search/List)",
        ok: true,
        hint: "Use Read to search and manage employee records.",
      },
    ],
    [isPayrollSeries, requiredPayrollOK, canceledit],
  );

  return (
    <div className={PAGE_BG}>
      <style>{`
        @keyframes spinLoader { to { transform: rotate(360deg); } }
      `}</style>

      {BG_BLOBS}

      {IsYesNoModalOpen &&
        (addedit === "UPGRADE_GATE" ? (
          <ModalYesNoReusable
            header={"Upgrade Required"}
            message={`Your plan is ${planInfo.plan}. User limit: ${
              planInfo.max === Infinity ? "Unlimited" : planInfo.max
            }. Active users: ${activeUserCount}.
              Inactive users are not counted.
              Select Yes to upgrade or No to cancel.`}
            setYesNoModalOpen={setYesNoModalOpen}
            yesLabel="Upgrade"
            noLabel="Cancel"
          />
        ) : addedit === "Create" ? (
          <ModalYesNoReusable
            header={"Confirmation"}
            message={"Select yes to proceed or no to exit"}
            setYesNoModalOpen={setYesNoModalOpen}
            triggerYesNoEvent={handleFormSubmit}
          />
        ) : addedit === "Edit" ? (
          <ModalYesNoReusable
            header={"Confirmation"}
            message={"Select yes to proceed or no to exit"}
            setYesNoModalOpen={setYesNoModalOpen}
            triggerYesNoEvent={handleEditSubmit}
          />
        ) : (
          <ModalYesNoReusable
            header={"Delete Employee"}
            message={
              "As of now you cannot delete an employee but set them instead to Inactive in Users Approval Menu"
            }
            setYesNoModalOpen={setYesNoModalOpen}
            triggerYesNoEvent={""}
            yesLabel={"Confirm"}
            noLabel={"Cancel"}
          />
        ))}

      {showhidesuccess &&
        (successmassage === "Create" ? (
          <ModalSuccessNavToSelf
            header={"Create"}
            message={"New employee successfully added"}
            button={"Confirm"}
            setIsModalOpen={setshowhidesuccess}
            resetForm={handleEditReset}
          />
        ) : successmassage === "Edit" ? (
          <ModalSuccessNavToSelf
            header={"Employee Updating"}
            message={"Updated employee info successfully"}
            button={"Confirm"}
            setIsModalOpen={setshowhidesuccess}
            resetForm={handleEditReset}
          />
        ) : successmassage === "Delete" ? (
          <ModalSuccessNavToSelf
            header={"Delete Employee"}
            message={"Deleted employee successfully"}
            button={"Delete"}
            setIsModalOpen={setshowhidesuccess}
            resetForm={handleEditReset}
          />
        ) : (
          <ModalFailure
            header={"Error"}
            message={"Something went wrong."}
            button={"OK"}
            setIsModalOpen={setshowhidesuccess}
          />
        ))}

      {isApproveNoticeOpen && (
        <ModalYesNoReusable
          header={"Approval Required"}
          message={approveNoticeMessage}
          setYesNoModalOpen={setIsApproveNoticeOpen}
          triggerYesNoEvent={goToUsersQueue}
          yesLabel="Go to Approvals"
          noLabel="Later"
        />
      )}

      <ReadEmployeesModal
        open={isReadOpen}
        onClose={() => setIsReadOpen(false)}
        search={employeeinfoSearch}
        setSearch={setemployeeinfoSearch}
        data={employeeinfodata}
        isLoading={mutationIsLoading}
        onRefresh={handleRefreshList}
        onEdit={openEdit}
        onDelete={requestDelete}
        handleFilterImageURL={handleFilterImageURL}
        logo={logoUrl}
        BTN_GHOST={BTN_GHOST}
        INPUT={INPUT}
        LABEL={LABEL}
      />

      <TopNav
        activeNavView={activeNavView}
        setActiveNavView={setActiveNavView}
        onBack={() => navigate(-1)}
      />

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-28">
        <div
          className={[GLASS_CARD, "p-5 sm:p-7 overflow-hidden relative"].join(
            " ",
          )}
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/10 to-transparent" />
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br from-colorBrand/10 via-redAccent/8 to-purple-500/6 blur-3xl" />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-xs text-slate-600">
                <span className="h-2 w-2 rounded-full bg-colorBrand" />
                HRIS • Users Information
              </div>

              <h1 className="mt-2 text-2xl font-[Poppins-Black] sm:text-3xl font-semibold tracking-tight text-slate-900">
                <span className="bg-gradient-to-r from-colorBrand via-redAccent to-colorBrandSecondary bg-clip-text text-transparent">
                  Employee Setup
                </span>
              </h1>

              <p className="mt-1 text-sm text-slate-600">
                Add an employee quickly, then use{" "}
                <span className="font-semibold">Read</span> to manage the list.
              </p>
            </div>

            <div className="shrink-0 inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700">
              <span
                className={[
                  "h-2 w-2 rounded-full",
                  canceledit ? "bg-amber-500" : "bg-emerald-500",
                ].join(" ")}
              />
              {canceledit ? "Edit Mode" : "Create Mode"}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3">
            <div className={[GLASS_CARD, "p-5 sm:p-6"].join(" ")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    {canceledit ? "Edit Employee" : "Create Employee"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {canceledit
                      ? "You selected an employee from Read list. Update then submit."
                      : "Fill out employee details and submit."}
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-[#D75529]/20 bg-colorBrand/10 px-2 py-1 text-[11px] font-semibold text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-colorBrand" />
                  Guide ✅
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormStep(1)}
                  className={[
                    "h-9 px-3 rounded-full text-xs font-semibold border transition",
                    formStep === 1
                      ? "bg-colorBrand text-white border-colorBrand"
                      : "bg-white/70 text-slate-700 border-slate-200 hover:bg-white",
                  ].join(" ")}
                >
                  Step 1
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (requiredStep1OK) setFormStep(2);
                    else alert("Complete Step 1 required fields first.");
                  }}
                  className={[
                    "h-9 px-3 rounded-full text-xs font-semibold border transition",
                    formStep === 2
                      ? "bg-colorBrand text-white border-colorBrand"
                      : "bg-white/70 text-slate-700 border-slate-200 hover:bg-white",
                  ].join(" ")}
                >
                  Step 2
                </button>
              </div>

              <div className="mt-4">
                {formSubmitIsLoading && <LinearProgress color="success" />}
              </div>

              <form
                className="mt-5"
                onSubmit={(e) => {
                  e.preventDefault();
                }}
              >
                {formStep === 1 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                        <div>
                          <div className={LABEL}>
                            Payroll ID{" "}
                            {!isPayrollSeries && (
                              <span className="text-rose-600">*</span>
                            )}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            {isPayrollSeries
                              ? canceledit
                                ? "Series mode is on. For edit, backend will keep current payroll ID if no manual ID is provided."
                                : "Series mode is on. Backend will assign highest payroll ID + 1 on submit."
                              : "Manual mode is on. Numbers only. Backend will reject duplicates."}
                          </div>
                        </div>

                        <ToggleSwitch
                          checked={isPayrollSeries}
                          onChange={(v) => {
                            setIsPayrollSeries(v);
                            if (v && !canceledit) {
                              setpayrollempid("");
                            }
                          }}
                          labelOn="Series"
                          labelOff="Manual"
                        />
                      </div>

                      <div className="mt-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={
                            isPayrollSeries && !canceledit ? "" : payrollempid
                          }
                          onChange={(e) =>
                            setpayrollempid(digitsOnly(e.target.value))
                          }
                          placeholder={
                            isPayrollSeries && !canceledit
                              ? "Assigned by backend upon submit"
                              : "Enter payroll ID"
                          }
                          className={INPUT}
                          disabled={isPayrollSeries && !canceledit}
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    <div>
                      <div className={LABEL}>
                        Firstname <span className="text-rose-600">*</span>
                      </div>
                      <div className="mt-1 relative">
                        <input
                          type="text"
                          value={firstname}
                          onChange={(e) => setfirstname(e.target.value)}
                          autoComplete="off"
                          className={INPUT}
                        />
                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                          {brandNameOK ? (
                            <FiCheckCircle className="h-5 w-5 text-emerald-600" />
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className={LABEL}>Middle Name</div>
                      <input
                        type="text"
                        value={middlename}
                        onChange={(e) => setmiddlename(e.target.value)}
                        autoComplete="off"
                        className={[INPUT, "mt-1"].join(" ")}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <div className={LABEL}>
                        Last Name <span className="text-rose-600">*</span>
                      </div>
                      <input
                        type="text"
                        value={lastname}
                        onChange={(e) => setlastname(e.target.value)}
                        autoComplete="off"
                        className={[INPUT, "mt-1"].join(" ")}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <div className={LABEL}>
                        Business Unit <span className="text-rose-600">*</span>
                      </div>
                      <select
                        value={businessunit}
                        onChange={(e) => setbusinessunit(e.target.value)}
                        className={[SELECT, "mt-1"].join(" ")}
                      >
                        <option value="">Select business unit…</option>
                        {qrybusiunitviewData.map((busiunit, index) => (
                          <option key={index} value={busiunit.Unit_Code}>
                            {busiunit.Unit_Name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className={LABEL}>
                        Position <span className="text-rose-600">*</span>
                      </div>
                      <select
                        value={position}
                        onChange={(e) => setposition(e.target.value)}
                        className={[SELECT, "mt-1"].join(" ")}
                      >
                        <option value="">Select position…</option>
                        {qryEmppositonData.map((pos, index) => (
                          <option key={index} value={pos.empposition_name}>
                            {pos.empposition_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className={LABEL}>
                        Department <span className="text-rose-600">*</span>
                      </div>
                      <select
                        value={department}
                        onChange={(e) => setdepartment(e.target.value)}
                        className={[SELECT, "mt-1"].join(" ")}
                      >
                        <option value="">Select department…</option>
                        {qrydepartmentData.map((dep, index) => (
                          <option key={index} value={dep.department_name}>
                            {dep.department_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className={LABEL}>
                        Birthdate <span className="text-rose-600">*</span>
                      </div>
                      <input
                        type="date"
                        value={birthdate}
                        onChange={(e) => setbirthdate(e.target.value)}
                        className={[INPUT, "mt-1"].join(" ")}
                      />
                    </div>

                    <div>
                      <div className={LABEL}>
                        Date Started <span className="text-rose-600">*</span>
                      </div>
                      <input
                        type="date"
                        value={date_started}
                        onChange={(e) => setdate_started(e.target.value)}
                        className={[INPUT, "mt-1"].join(" ")}
                      />
                    </div>

                    <div>
                      <div className={LABEL}>
                        Contact No. <span className="text-rose-600">*</span>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        onWheel={preventWheelOnNumber}
                        value={contactno}
                        onChange={(e) =>
                          setcontactno(digitsOnly(e.target.value))
                        }
                        className={[INPUT, "mt-1"].join(" ")}
                      />
                    </div>

                    <div>
                      <div className={LABEL}>
                        Email <span className="text-rose-600">*</span>
                      </div>
                      <input
                        type="text"
                        value={email}
                        onChange={(e) => setemail(e.target.value)}
                        autoComplete="off"
                        className={[INPUT, "mt-1"].join(" ")}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <div className={LABEL}>
                        Address <span className="text-rose-600">*</span>
                      </div>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setaddress(e.target.value)}
                        autoComplete="off"
                        className={[INPUT, "mt-1"].join(" ")}
                      />
                    </div>
                  </div>
                )}

                {formStep === 2 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className={LABEL}>SSS No.</div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        onWheel={preventWheelOnNumber}
                        value={sss}
                        onChange={(e) => setsss(digitsOnly(e.target.value))}
                        className={[INPUT, "mt-1"].join(" ")}
                      />
                    </div>

                    <div>
                      <div className={LABEL}>Philhealth No.</div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        onWheel={preventWheelOnNumber}
                        value={phic}
                        onChange={(e) => setphic(digitsOnly(e.target.value))}
                        className={[INPUT, "mt-1"].join(" ")}
                      />
                    </div>

                    <div>
                      <div className={LABEL}>Pag-ibig No.</div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        onWheel={preventWheelOnNumber}
                        value={mdf}
                        onChange={(e) => setmdf(digitsOnly(e.target.value))}
                        className={[INPUT, "mt-1"].join(" ")}
                      />
                    </div>

                    <div>
                      <div className={LABEL}>TIN No.</div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        onWheel={preventWheelOnNumber}
                        value={tin}
                        onChange={(e) => settin(digitsOnly(e.target.value))}
                        className={[INPUT, "mt-1"].join(" ")}
                      />
                    </div>

                    <div>
                      <div className={LABEL}>Salary</div>
                      <input
                        type="number"
                        onWheel={preventWheelOnNumber}
                        value={salary}
                        onChange={(e) => setsalary(e.target.value)}
                        className={[INPUT, "mt-1"].join(" ")}
                      />
                    </div>

                    <div>
                      <div className={LABEL}>Salary Type</div>
                      <select
                        value={salarytype}
                        onChange={(e) => setsalarytype(e.target.value)}
                        className={[SELECT, "mt-1"].join(" ")}
                      >
                        <option value="">Select…</option>
                        <option value="DAS">Daily</option>
                        <option value="MOS">Monthly</option>
                      </select>
                    </div>

                    <div>
                      <div className={LABEL}>Tax Class</div>
                      <select
                        value={taxclass}
                        onChange={(e) => settaxclass(e.target.value)}
                        className={[SELECT, "mt-1"].join(" ")}
                      >
                        <option value="">Select…</option>
                        <option value="N/A">N/A</option>
                      </select>
                    </div>

                    <div>
                      <div className={LABEL}>SPP Class</div>
                      <select
                        value={sppclass}
                        onChange={(e) => setsppclass(e.target.value)}
                        className={[SELECT, "mt-1"].join(" ")}
                      >
                        <option value="">Select…</option>
                        <option value="N/A">N/A</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <div className={LABEL}>Factor Day</div>
                      <input
                        type="number"
                        onWheel={preventWheelOnNumber}
                        value={dayfactor}
                        onChange={(e) => setdayfactor(e.target.value)}
                        className={[INPUT, "mt-1"].join(" ")}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <div className={LABEL}>Upload Image</div>
                      <input
                        type="file"
                        accept="image/*"
                        className={[
                          "mt-1 h-11 w-full rounded-2xl border border-slate-200/80 bg-white/70 px-4 text-base sm:text-sm",
                          "outline-none backdrop-blur-xl focus:border-slate-300 focus:ring-2 focus:ring-colorBrand/25",
                        ].join(" ")}
                        onChange={(e) => {
                          handleImagePreview(e);
                          setImageSelected(e.target.files?.[0] || null);
                        }}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      {previewImageURL ? (
                        <div className="mt-2 flex items-center gap-3">
                          <img
                            src={previewImageURL}
                            alt="Preview"
                            className="h-20 w-20 rounded-2xl object-cover shadow-md"
                          />
                          <div className="text-xs text-slate-600">
                            Image ready to upload.
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <div className="flex gap-2">
                    {formStep === 2 && (
                      <button
                        type="button"
                        onClick={goBack}
                        className={BTN_GHOST}
                      >
                        Back
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                    <button
                      type="button"
                      onClick={handleEditReset}
                      className={BTN_GHOST}
                      disabled={formSubmitIsLoading}
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        {formSubmitIsLoading ? <ModernLoader size={18} /> : null}
                        <span>
                          {formSubmitIsLoading ? "Resetting…" : "Form Reset"}
                        </span>
                      </span>
                    </button>

                    {formStep === 1 ? (
                      <button
                        type="button"
                        onClick={goNext}
                        className={BTN_PRIMARY}
                      >
                        Next
                      </button>
                    ) : (
                      <>
                        {canceledit && (
                          <button
                            type="button"
                            onClick={() => {
                              handleEditReset();
                              setsuccessmassage("");
                            }}
                            className={BTN_GHOST}
                            disabled={formSubmitIsLoading}
                          >
                            Cancel
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const nextAction = isEditMode ? "Edit" : "Create";

                            if (
                              nextAction === "Create" &&
                              activeUserCount >= planInfo.max
                            ) {
                              setaddedit("UPGRADE_GATE");
                              setsuccessmassage("UPGRADE_GATE");
                              setYesNoModalOpen(true);
                              return;
                            }

                            setaddedit(nextAction);
                            setsuccessmassage(nextAction);
                            setYesNoModalOpen(true);
                          }}
                          className={BTN_PRIMARY}
                          disabled={formSubmitIsLoading}
                        >
                          <span className="inline-flex items-center justify-center gap-2">
                            {formSubmitIsLoading ? <ModernLoader size={18} /> : null}
                            <span>
                              {formSubmitIsLoading ? "Processing…" : "Submit"}
                            </span>
                          </span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className={[GLASS_CARD, "p-5 sm:p-6"].join(" ")}>
              <div className="text-sm font-semibold text-slate-900">
                What to do here
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Follow along — the checks update as you complete fields.
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3">
                {guideItems.map((g, idx) => (
                  <div
                    key={idx}
                    className={[
                      "rounded-2xl border p-3 bg-white/70",
                      g.ok ? "border-emerald-200" : "border-slate-200/80",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-500">
                          Step {idx + 1}
                        </div>
                        <div className="mt-1 font-semibold text-slate-900">
                          {g.label}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {g.hint}
                        </div>
                      </div>

                      <div
                        className={[
                          "shrink-0 inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold",
                          g.ok
                            ? "bg-emerald-600/10 text-emerald-700 border border-emerald-200"
                            : "bg-slate-600/5 text-slate-600 border border-slate-200/80",
                        ].join(" ")}
                      >
                        {g.ok ? "Yes ✅" : "No"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-[11px] text-slate-500">
                Tip: Use <span className="font-semibold">Read</span> to edit or
                review employees.
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                <div className="text-xs font-semibold text-slate-500">
                  Plan Status
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {planInfo.plan}
                  </div>
                  <div className="text-xs text-slate-600">
                    Active Users: {activeUserCount} /{" "}
                    {planInfo.max === Infinity ? "Unlimited" : planInfo.max}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200/80 bg-white">
                    <FiUsers className="h-5 w-5 text-colorBrand" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Employees Loaded
                    </div>
                    <div className="text-xs text-slate-500">
                      {Array.isArray(employeeinfodata)
                        ? employeeinfodata.length
                        : 0}{" "}
                      record(s)
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRefreshList}
                  className={[BTN_GHOST, "mt-4 w-full"].join(" ")}
                >
                  Refresh List
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-[9998]">
        <motion.button
          type="button"
          onClick={() => setIsReadOpen(true)}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className={[
            "group relative overflow-hidden",
            "rounded-full px-4 py-3",
            "border border-slate-200/80 bg-white/75 backdrop-blur-xl",
            "shadow-[0_18px_50px_rgba(15,23,42,0.12)]",
            "transition active:scale-[0.99]",
          ].join(" ")}
          aria-label="Open Read Employees"
        >
          <span className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(circle_at_30%_20%,rgba(215,85,41,0.16),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(236,72,153,0.12),transparent_55%)]" />
          <span className="relative z-10 inline-flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-2xl border border-slate-200/80 bg-white/80">
              <FiBookOpen className="h-4 w-4" style={{ color: colorBrand }} />
            </span>
            <span className="text-sm font-semibold text-slate-900">Read</span>
            <span className="text-xs font-semibold text-slate-500">Open →</span>
          </span>
        </motion.button>
      </div>
    </div>
  );
};

export default CmpEmployeeInfo;