"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiEye, FiX } from "react-icons/fi";
import { FaUserShield } from "react-icons/fa6";

import InfiniteScrollComponent from "../../../components/InfiniteScrolling/InfiniteScrollComponent";
import CmpUserRolesSetup from "../../../components/Setup/CmpUserRolesSetup";

import { useQueryClient } from "@tanstack/react-query";
import useCustomInfiniteQuery from "../../../hooks/useCustomInfiniteQuery";
import { useSecuredMutation } from "../../../hooks/useSecuredMutation";

/* -------------------------------------------------------------------------- */
/* UI Helpers                                                                  */
/* -------------------------------------------------------------------------- */
const ModernLoader = ({ size = 18, className = "" }) => {
  const s = Number(size) || 18;

  return (
    <span className={["inline-grid place-items-center", className].join(" ")}>
      <style>{`
        @keyframes spinLoader {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <span
        style={{
          width: s,
          height: s,
          borderRadius: "9999px",
          background:
            "conic-gradient(from 0deg, #D75529, #FF7A00, #EC4899, #A855F7, #22C55E, #3B82F6, #D75529)",
          animation: "spinLoader 0.9s linear infinite",
          position: "relative",
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: Math.max(2, Math.round(s * 0.18)),
            borderRadius: "9999px",
            background: "rgba(255,255,255,0.85)",
            border: "1px solid rgba(226,232,240,0.9)",
            backdropFilter: "blur(10px)",
          }}
        />
      </span>
    </span>
  );
};

const FloatingReadButton = ({ onOpen, disabled = false }) => {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      whileHover={disabled ? {} : { y: -2, scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      className={[
        "fixed z-[9998] bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5",
        "group flex items-center gap-3 rounded-3xl border border-slate-200/80 bg-white/80 backdrop-blur-xl",
        "px-4 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.16)] transition",
        disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-white",
      ].join(" ")}
    >
      <span className="relative">
        <span className="pointer-events-none absolute -inset-3 rounded-2xl bg-gradient-to-br from-orange-500/20 via-red-400/15 to-purple-500/10 blur-xl opacity-80" />
        <span className="relative grid h-11 w-11 place-items-center rounded-2xl border border-slate-200/70 bg-white/75">
          <FiEye className="text-orange-600" size={20} />
        </span>
      </span>

      <span className="text-left leading-tight">
        <span className="block text-sm font-semibold text-slate-900">
          Read Roles
        </span>
        <span className="block text-[11px] text-slate-600">
          View / search / delete
        </span>
      </span>

      <span className="ml-1 text-[11px] font-semibold text-slate-500">
        Open →
      </span>
    </motion.button>
  );
};

/* -------------------------------------------------------------------------- */
/* Main Page                                                                    */
/* -------------------------------------------------------------------------- */
const UserRoles = () => {


  const [isReadModalOpen, setIsReadModalOpen] = useState(false);

  return (
    <>

      <div className="relative w-full min-h-screen overflow-x-hidden overflow-y-auto mt-[6vh] bg-slate-50 pb-10">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-[#faf7f5]" />
          <div className="absolute -top-36 -left-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(215,85,41,0.14),transparent_55%)] blur-2xl" />
          <div className="absolute -bottom-44 -right-44 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_70%_70%,rgba(168,85,247,0.12),transparent_58%)] blur-2xl" />
        </div>

        <div className="mx-auto w-full max-w-7xl px-4 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 rounded-[2rem] border border-slate-200 bg-white/80 backdrop-blur-xl shadow-sm overflow-hidden"
          >
            <div className="relative p-6 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-orange-600" />
                    Exinnov • User Access Control
                  </div>

                  <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
                    <span className="bg-gradient-to-r from-orange-600 via-red-500 to-purple-600 bg-clip-text text-transparent">
                      User Roles
                    </span>
                  </h1>

                  <p className="text-sm text-slate-600">
                    Assign access faster: choose the user, pick a{" "}
                    <b>Function</b>, then fine-tune routes, business units, and
                    teams.
                  </p>
                </div>

                <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                  <FaUserShield className="text-orange-600" />
                  Tip: Use <b>Function</b> to auto-select related routes.
                </div>
              </div>
            </div>
          </motion.div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="relative lg:col-span-2 rounded-[2rem] border border-slate-200 bg-white/80 backdrop-blur-xl shadow-sm">
              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Assign Roles
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      Pick an employee then assign access. Use Search inside
                      panels to find items quickly.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsReadModalOpen(true)}
                    className="hidden sm:inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <FiEye />
                    Read Roles
                  </button>
                </div>

                <div className="mt-4">
                  <CmpUserRolesSetup
                    mode="assign"
                    onOpenRead={() => setIsReadModalOpen(true)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[2rem] border border-slate-200 bg-white/80 backdrop-blur-xl shadow-sm">
                <div className="p-5 sm:p-6">
                  <div className="text-sm font-semibold text-slate-900">
                    What to do here
                  </div>

                  <div className="mt-2 space-y-3 text-sm text-slate-600">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold text-slate-800">
                        1) Select Employee
                      </div>
                      <div className="mt-1 text-xs">
                        Choose who will receive roles.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold text-slate-800">
                        2) Pick Function
                      </div>
                      <div className="mt-1 text-xs">
                        Selecting a function automatically adds its routes.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-semibold text-slate-800">
                        3) Fine-tune
                      </div>
                      <div className="mt-1 text-xs">
                        Add or remove specific routes, business units, or teams.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                      <div className="text-xs font-semibold text-slate-800">
                        Read roles anytime
                      </div>
                      <div className="mt-1 text-xs">
                        Use the floating <b>Read</b> button to view assignments
                        and delete.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white/80 backdrop-blur-xl shadow-sm">
                <div className="p-5 sm:p-6">
                  <div className="text-sm font-semibold text-slate-900">
                    Quick rule
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    If you want a user to access a module, ensure they have its{" "}
                    <b>route role</b> plus any business unit or team
                    restrictions your system requires.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <FloatingReadButton onOpen={() => setIsReadModalOpen(true)} />

        <ReadUserRolesModal
          isOpen={isReadModalOpen}
          onClose={() => setIsReadModalOpen(false)}
        />
      </div>
    </>
  );
};

export default UserRoles;

/* -------------------------------------------------------------------------- */
/* Read Modal                                                                   */
/* -------------------------------------------------------------------------- */
const ReadUserRolesModal = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();

  const [localSearch, setLocalSearch] = useState("");
  const [searchRole, setSearchRole] = useState("");
  const [pageItems, setPageItems] = useState("25");
  const [roleClassFilter, setRoleClassFilter] = useState("");

  const [deleteId, setDeleteId] = useState("");
  const [deleteRow, setDeleteRow] = useState(null);
  const [isDeleteYesNoModalOpen, setDeleteYesNoModalOpen] = useState(false);
  const [supabasePostMsg, setSupabasePostMsg] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchRole(localSearch.trim());
    }, 250);

    return () => clearTimeout(t);
  }, [localSearch]);

  const queryKey = useMemo(
    () => ["readuserroledata", searchRole, pageItems],
    [searchRole, pageItems],
  );

  const infiniteUrl =
    localStorage.getItem("apiendpoint") +
    import.meta.env.VITE_INFINITE_USER_ROLE_ENDPOINT;

  const {
    data: readUserRoleData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isFetching,
  } = useCustomInfiniteQuery(infiniteUrl, queryKey, searchRole, pageItems);

  const { data: deleteRoleData, isLoading: deleteRoleIsLoading, mutate: deleteRole } =
    useSecuredMutation(
      localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_MUTATE_USER_ROLES_ENDPOINT,
      "DELETE",
    );

  const classOptions = useMemo(() => {
    const values = new Set();

    (readUserRoleData?.pages || []).forEach((page) => {
      (page?.items || []).forEach((item) => {
        const roleClass = String(item?.roleclass || "").trim();
        if (roleClass) values.add(roleClass);
      });
    });

    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [readUserRoleData]);

  useEffect(() => {
    if (!isOpen) return;
    refetch();
  }, [isOpen, refetch]);

  const postResetToSupabase = async (rowForEmail) => {
    try {
      const companycode = localStorage.getItem("companycode") || "";
      const emailFromRow = rowForEmail?.email || "";
      const emailFallback = localStorage.getItem("email") || "";
      const email = String(emailFromRow || emailFallback).trim();

      if (!companycode || !email) {
        setSupabasePostMsg(
          "Skipped Supabase insert (missing companycode/email)",
        );
        return;
      }

      const { error } = await supabase
        .from("tbl_user_roles_reset")
        .insert([{ companycode, email }]);

      if (error) throw error;

      setSupabasePostMsg("Inserted to Supabase (roles reset trigger)");
    } catch (error) {
      console.error("Supabase insert error:", error);
      setSupabasePostMsg(
        error?.message
          ? `Supabase insert failed: ${error.message}`
          : "Supabase insert failed",
      );
    }
  };

  useEffect(() => {
    if (deleteRoleData?.message !== "Success") return;

    setDeleteYesNoModalOpen(false);
    setDeleteId("");

    postResetToSupabase(deleteRow);

    queryClient.invalidateQueries({ queryKey: ["readuserroledata"] });
    refetch();

    setDeleteRow(null);
  }, [deleteRoleData, deleteRow, queryClient, refetch]);

  const handleReset = () => {
    setLocalSearch("");
    setSearchRole("");
    setPageItems("25");
    setRoleClassFilter("");

    queryClient.invalidateQueries({ queryKey: ["readuserroledata"] });
    refetch();
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteRole({ id: deleteId });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {isDeleteYesNoModalOpen && (
            <ModalYesNoReusable
              header="Confirmation"
              message="Delete this role assignment?"
              setYesNoModalOpen={setDeleteYesNoModalOpen}
              triggerYesNoEvent={handleDelete}
              isLoading={deleteRoleIsLoading}
            />
          )}

          <motion.button
            type="button"
            onClick={onClose}
            className="fixed inset-0 z-[9999] bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close"
          />

          <motion.div
            className="fixed inset-0 z-[10000] grid place-items-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="relative w-full max-w-5xl h-[85svh] sm:h-[90vh] overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 backdrop-blur-xl shadow-[0_28px_90px_rgba(0,0,0,0.30)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-600 via-red-500 to-purple-600" />

              <div className="flex h-full flex-col">
                <div className="mt-3 ms-3">
                  <motion.div
                    initial={false}
                    animate={{
                      opacity: isFetching || isFetchingNextPage ? 1 : 0,
                      y: isFetching || isFetchingNextPage ? 0 : -4,
                    }}
                    transition={{ duration: 0.18 }}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600"
                    style={{ pointerEvents: "none" }}
                  >
                    <ModernLoader size={18} />
                    Syncing list…
                  </motion.div>

                  <div className="text-xs ms-2 lg:hidden text-zinc-500 mt-1">
                    Swipe right records to Edit or Delete
                  </div>
                </div>

                <div className="shrink-0 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        User Roles (Read)
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        Search, review, and delete role assignments.
                      </div>

                      {supabasePostMsg ? (
                        <div className="mt-1 text-[11px] text-slate-500">
                          {supabasePostMsg}
                        </div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <FiX />
                      Close
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                      <div className="text-[11px] font-semibold text-slate-500">
                        Search user / role
                      </div>
                      <input
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                        placeholder="Type to filter…"
                        className="mt-1 w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
                      />
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                      <div className="text-[11px] font-semibold text-slate-500">
                        Class
                      </div>
                      <select
                        value={roleClassFilter}
                        onChange={(e) => setRoleClassFilter(e.target.value)}
                        className="mt-1 w-full bg-transparent text-sm text-slate-800 outline-none"
                      >
                        <option value="">All</option>
                        {classOptions.map((roleClass) => (
                          <option key={roleClass} value={roleClass}>
                            {roleClass}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                      <div className="text-[11px] font-semibold text-slate-500">
                        Page size
                      </div>
                      <select
                        value={pageItems}
                        onChange={(e) => setPageItems(e.target.value)}
                        className="mt-1 w-full bg-transparent text-sm text-slate-800 outline-none"
                      >
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                        <option value="500">500</option>
                        <option value="1000">1000</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleReset}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="px-5 sm:px-6 pb-5 flex-1 min-h-0">
                  <div className="h-full overflow-auto rounded-[2rem] border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="sticky top-0 bg-orange-50 backdrop-blur">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-700">
                            User
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-700">
                            Class
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-700">
                            Role
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-semibold text-slate-700">
                            Description
                          </th>
                          <th className="px-5 py-3 text-center text-xs font-semibold text-slate-700">
                            Delete
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200 bg-white">
                        {readUserRoleData?.pages?.map((page) =>
                          (page?.items || [])
                            .filter((item) => {
                              if (!roleClassFilter) return true;
                              return (
                                String(item?.roleclass || "") ===
                                String(roleClassFilter)
                              );
                            })
                            .map((item) => (
                              <tr
                                key={item.uuid}
                                className="hover:bg-slate-50 transition"
                              >
                                <td className="px-5 py-3 text-sm text-slate-900">
                                  {item.username}
                                </td>
                                <td className="px-5 py-3 text-sm text-slate-700">
                                  {item.roleclass}
                                </td>
                                <td className="px-5 py-3 text-sm text-slate-700">
                                  {item.rolename}
                                </td>
                                <td className="px-5 py-3 text-sm text-slate-700">
                                  {item.role_description}
                                </td>
                                <td className="px-5 py-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteId(item.uuid);
                                      setDeleteRow(item);
                                      setDeleteYesNoModalOpen(true);
                                    }}
                                    className="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            )),
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4">
                    <InfiniteScrollComponent
                      fetchNextPage={fetchNextPage}
                      hasNextPage={hasNextPage}
                      isFetchingNextPage={isFetchingNextPage}
                      data={readUserRoleData}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};