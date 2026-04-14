// MemberQueings.jsx
// Full rewrite with screenshot-style top nav
// Keeps: approve/reject flow, plan gate, assign-roles prompt, endpoint pattern

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { CiSearch } from "react-icons/ci";
import {
  FiRefreshCw,
  FiUsers,
  FiCheck,
  FiX,
  FiArrowLeft,
} from "react-icons/fi";
import { HiDotsHorizontal } from "react-icons/hi";
import { IoMdSettings } from "react-icons/io";
import {
  HiOutlineMoon,
  HiOutlineViewColumns,
  HiOutlineSquares2X2,
} from "react-icons/hi2";
import { useNavigate } from "react-router-dom";

import useCustomInfiniteQuery from "../../hooks/useCustomInfiniteQuery";
import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import ModalYesNoReusable from "../../components/Modals/ModalYesNoReusable";
import ModalSuccessNavToSelf from "../../components/Modals/ModalSuccessNavToSelf";
import InfiniteScrollComponent from "../../components/InfiniteScrolling/InfiniteScrollComponent";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

/* -------------------------------------------------------------------------- */
/* Modern Loader                                                               */
/* -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- */
/* Screenshot-style top nav                                                    */
/* -------------------------------------------------------------------------- */
function TopNav({ activeNavView, setActiveNavView, onBack }) {
  return (
    <div className="sticky top-0 z-40 bg-[#eeeeef]/92 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1450px] items-center justify-between px-4 py-7 sm:px-6 lg:px-10">
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center gap-3 rounded-full border border-slate-300/90 bg-white px-7 py-5 text-slate-600 shadow-[0_8px_30px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-[1px] hover:text-slate-900"
        >
          <FiArrowLeft
            size={17}
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

const MemberQueings = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { endpoint } = useZustandAPIEndpoint();
  const { roles, toggleAuthToFalse } = useZustandLoginCred();

  const [activeNavView, setActiveNavView] = useState("grid");

  const [showSuccess, setShowSuccess] = useState(false);
  const [successHeader, setSuccessHeader] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const lastActionRef = useRef("");
  const lastUserIdRef = useRef(null);

  const apiHost = useMemo(() => {
    const stored = localStorage.getItem("apiendpoint");
    if (!stored || stored === "null" || stored === "undefined") {
      return "http://localhost";
    }
    return stored;
  }, []);

  const [isYesNoModalOpen, setYesNoModalOpen] = useState(false);
  const [confirmMeta, setConfirmMeta] = useState({
    header: "Confirmation",
    message: "Select yes to proceed or no to exit",
    onYes: null,
    yesLabel: "Yes",
    noLabel: "No",
    isLoading: false,
  });

  const [isAfterApproveModalOpen, setAfterApproveModalOpen] = useState(false);
  const [afterApproveMeta, setAfterApproveMeta] = useState({
    header: "Next Step",
    message: "",
    onYes: null,
    yesLabel: "Assign Roles",
    noLabel: "Later",
  });

  const [searchParams, setSearchParams] = useState("");
  const [pageItems, setPageItems] = useState("5");
  const [showSearch, setShowSearch] = useState(false);

  const usersReadUrl = useMemo(
    () => `${apiHost}${import.meta.env.VITE_USERS_READ_DATA_MUTATION}`,
    [apiHost],
  );

  const approveMemberUrl = useMemo(
    () => `${apiHost}${import.meta.env.VITE_APPROVEMEMBER_ENDPOINT}`,
    [apiHost],
  );

  const usersQueryKey = useMemo(
    () => `users:${searchParams}:${pageItems}`,
    [searchParams, pageItems],
  );

  const {
    data: usersData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  } = useCustomInfiniteQuery(
    usersReadUrl,
    usersQueryKey,
    searchParams,
    pageItems,
  );

  const {
    data: mutationData,
    isLoading: mutationIsLoading,
    isError: mutationIsError,
    mutate,
  } = useSecuredMutation(approveMemberUrl, "PATCH");

  const roleSet = useMemo(() => {
    const arr = Array.isArray(roles?.[0]) ? roles[0] : [];
    return new Set(
      arr.map((r) =>
        String(r?.rolename || "")
          .trim()
          .toUpperCase(),
      ),
    );
  }, [roles]);

  const planInfo = useMemo(() => {
    if (roleSet.has("UNLIMITED")) return { plan: "UNLIMITED", max: Infinity };
    if (roleSet.has("PREMIUM")) return { plan: "PREMIUM", max: 10 };
    if (roleSet.has("PRO")) return { plan: "PRO", max: 3 };
    return { plan: "FREE", max: 100 };
  }, [roleSet]);

  const isActiveStatus = (s) =>
    String(s || "")
      .trim()
      .toLowerCase() === "active";

  const activeUserCount = useMemo(() => {
    const pages = Array.isArray(usersData?.pages) ? usersData.pages : [];
    let count = 0;

    for (const page of pages) {
      const items = Array.isArray(page?.items) ? page.items : [];
      for (const member of items) {
        if (isActiveStatus(member?.status)) count += 1;
      }
    }

    return count;
  }, [usersData]);

  const isSuperAdminUser = useMemo(
    () => roles?.[0]?.some((r) => r.rolename === "SUPER ADMIN"),
    [roles],
  );

  const openUpgradeGate = (extraMessage = "") => {
    setConfirmMeta({
      header: "Upgrade Required",
      message:
        `Your plan is ${planInfo.plan}.\n\n` +
        `User limit: ${planInfo.max === Infinity ? "Unlimited" : planInfo.max}\n` +
        `Active users: ${activeUserCount}\n` +
        `Inactive users are not counted.\n\n` +
        (extraMessage || "Select Yes to upgrade or No to cancel."),
      yesLabel: "Upgrade",
      noLabel: "Cancel",
      isLoading: false,
      onYes: () => navigate("/renewalandplanupgrade"),
    });
    setYesNoModalOpen(true);
  };

  const handleUsersReset = () => {
    queryClient.resetQueries({ queryKey: ["users"] });
  };

  useEffect(() => {
    fetchNextPage();
    queryClient.resetQueries({ queryKey: ["users"] });
  }, [searchParams, pageItems, fetchNextPage, queryClient]);

  const handleTokenExpiry = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    alert("Login your credentials");
    toggleAuthToFalse();
    navigate("/");
  };

  useEffect(() => {
    if (mutationIsError) handleTokenExpiry();
  }, [mutationIsError]);

  useEffect(() => {
    if (mutationData?.message === "token has expired") {
      handleTokenExpiry();
      return;
    }

    if (!mutationData) return;

    const action = (lastActionRef.current || "Action").toLowerCase();

    if (action === "approved") {
      setSuccessHeader("Approved");
      setSuccessMessage(
        "User approved successfully. Login credentials (username & password) were sent to their email, including the company code.",
      );
      setShowSuccess(true);
      return;
    }

    setSuccessHeader(lastActionRef.current || "Success");
    setSuccessMessage(
      `${lastActionRef.current || "Action"} user successfully.`,
    );
    setShowSuccess(true);
  }, [mutationData]);

  const approveOrRejectMember = (id, status, companycode) => {
    lastUserIdRef.current = id;
    lastActionRef.current = status === "approved" ? "Approved" : "Rejected";
    mutate({ id, status, companycode: companycode || "" });
  };

  const openConfirm = ({ header, message, onYes, yesLabel, noLabel }) => {
    setConfirmMeta({
      header: header || "Confirmation",
      message: message || "Select yes to proceed or no to exit",
      onYes: onYes || null,
      yesLabel: yesLabel || "Yes",
      noLabel: noLabel || "No",
      isLoading: false,
    });
    setYesNoModalOpen(true);
  };

  const triggerYesNoEvent = () => {
    const fn = confirmMeta.onYes;
    setYesNoModalOpen(false);
    if (typeof fn === "function") fn();
  };

  const openAfterApproveModal = ({ message, onYes, yesLabel, noLabel }) => {
    setAfterApproveMeta({
      header: "Assign User Access",
      message:
        message ||
        "Would you like to go to User Roles now and assign Function / Routes / Business Unit access?",
      onYes: onYes || null,
      yesLabel: yesLabel || "Assign Roles",
      noLabel: noLabel || "Later",
    });
    setAfterApproveModalOpen(true);
  };

  const triggerAfterApproveYes = () => {
    const fn = afterApproveMeta.onYes;
    setAfterApproveModalOpen(false);
    if (typeof fn === "function") fn();
  };

  const PAGE_BG =
    "relative min-h-screen w-full overflow-x-clip bg-[#eeeeef] text-slate-900";

  const BG_BLOBS = (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#f0f0f1] via-[#efeff0] to-[#faf7f5]" />
      <div className="absolute -top-36 -left-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(215,85,41,0.10),transparent_55%)] blur-2xl" />
      <div className="absolute -bottom-44 -right-44 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_70%_70%,rgba(236,72,153,0.08),transparent_58%)] blur-2xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(0,0,0,0.03),transparent_35%),radial-gradient(circle_at_90%_90%,rgba(0,0,0,0.02),transparent_35%)]" />
    </div>
  );

  const GLASS_CARD = [
    "rounded-3xl border border-slate-200/80 bg-white/65 backdrop-blur-xl",
    "shadow-[0_18px_50px_rgba(15,23,42,0.07)]",
  ].join(" ");

  const INPUT =
    "h-11 w-full min-w-0 rounded-2xl border border-slate-200/80 bg-white/70 px-4 text-sm text-slate-900 " +
    "outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-orange-200 focus:border-orange-200";

  const BTN_GHOST =
    "h-11 px-4 rounded-2xl font-semibold text-slate-700 " +
    "border border-slate-200/80 bg-white/70 hover:bg-white transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed";

  const BTN_PRIMARY =
    "h-11 px-5 rounded-2xl font-semibold text-white " +
    "bg-gradient-to-r from-[#D75529] via-[#ec4899] to-[#f97316] " +
    "hover:opacity-95 active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed";

  const headerChip = (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-xs text-slate-700">
      <span className="h-2 w-2 rounded-full bg-[#D75529]" />
      User Queue • Manage
    </div>
  );

  const MemberQueueCard = ({ member }) => {
    const [imageName, setImageName] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);

    const panelRef = useRef(null);
    const cardRef = useRef(null);

    const imageClass =
      member.uuid?.substring(0, 2) !== "C-" ? "Employee" : "Customer";

    const baseUrl =
      member.uuid?.substring(0, 2) !== "C-"
        ? localStorage.getItem("apiendpoint") + import.meta.env.VITE_IMAGE_URLS
        : endpoint + import.meta.env.VITE_IMAGE_CUSTOMERS_URLS;

    useEffect(() => {
      if (baseUrl && member?.image_filename) {
        const parts =
          imageClass === "Employee"
            ? member.image_filename.split("images/employees/")
            : member.image_filename.split("images/customers/");

        setImageName(parts?.[1] ? baseUrl + parts[1] : null);
      } else {
        setImageName(null);
      }
    }, [baseUrl, member?.image_filename, imageClass]);

    useEffect(() => {
      const onPointerDown = (e) => {
        if (!menuOpen) return;
        if (panelRef.current?.contains(e.target)) return;
        if (cardRef.current?.contains(e.target)) return;
        setMenuOpen(false);
      };

      document.addEventListener("pointerdown", onPointerDown);
      return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [menuOpen]);

    const fullName = useMemo(() => {
      const f = member?.firstname || "";
      const l = member?.lastname || "";
      return `${f} ${l}`.trim();
    }, [member?.firstname, member?.lastname]);

    const initials = useMemo(() => {
      const f = (member?.firstname || "").trim();
      const l = (member?.lastname || "").trim();
      const a = f ? f[0].toUpperCase() : "";
      const b = l ? l[0].toUpperCase() : "";
      return a + b || "U";
    }, [member?.firstname, member?.lastname]);

    const getCompanyCode = () =>
      member?.companycode ||
      member?.company_code ||
      member?.corpcode ||
      member?.corp_code ||
      "";

    const openApproveConfirm = () => {
      const id = member?.uuid;
      if (!id) return;

      if (planInfo.max !== Infinity && activeUserCount >= planInfo.max) {
        openUpgradeGate(
          "You have reached your active-user limit.\n\nTo approve more users, upgrade your plan.",
        );
        return;
      }

      const companycode = getCompanyCode();

      openConfirm({
        header: "Confirmation",
        message:
          "Approve this user? Select yes to proceed or no to exit.\n\nOnce approved, credentials will be sent to the user’s email (including company code).",
        yesLabel: "Approve",
        noLabel: "Cancel",
        onYes: () => approveOrRejectMember(id, "approved", companycode),
      });
    };

    const openRejectConfirm = () => {
      const id = member?.uuid;
      if (!id) return;

      const companycode = getCompanyCode();

      openConfirm({
        header: "Confirmation",
        message: "Reject this user? Select yes to proceed or no to exit.",
        yesLabel: "Reject",
        noLabel: "Cancel",
        onYes: () => approveOrRejectMember(id, "rejected", companycode),
      });
    };

    const statusTone =
      member?.status === "Active"
        ? "border-emerald-200/80 bg-emerald-600/10 text-emerald-700"
        : "border-rose-200/80 bg-rose-600/10 text-rose-700";

    const cardVariants = {
      hidden: { opacity: 0, y: 16, scale: 0.985 },
      show: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: "spring", stiffness: 420, damping: 30 },
      },
    };

    const panelVariants = {
      closed: { x: "110%", opacity: 0 },
      open: {
        x: 0,
        opacity: 1,
        transition: { type: "spring", stiffness: 380, damping: 30 },
      },
      exit: { x: "110%", opacity: 0, transition: { duration: 0.15 } },
    };

    const ActionBtn = ({ icon, label, onClick, tone = "default" }) => {
      const toneClass =
        tone === "good"
          ? "hover:bg-emerald-50"
          : tone === "bad"
            ? "hover:bg-rose-50"
            : "hover:bg-slate-50";

      return (
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className={[
            "w-full flex items-center gap-2 px-3 py-2 rounded-2xl",
            "border border-slate-200/80 bg-white/70 transition",
            toneClass,
          ].join(" ")}
          onClick={onClick}
          type="button"
        >
          <span className="grid h-8 w-8 place-items-center rounded-2xl border border-slate-200/80 bg-white">
            {icon}
          </span>
          <span className="text-sm font-semibold text-slate-800">{label}</span>
        </motion.button>
      );
    };

    const BTN_APPROVE =
      "flex-1 h-10 rounded-2xl font-semibold text-slate-900 " +
      "text-sm sm:text-[13px] border border-slate-200/80 bg-white/75 backdrop-blur " +
      "hover:bg-white transition active:scale-[0.99] relative overflow-hidden";

    const BTN_REJECT =
      "flex-1 h-10 rounded-2xl font-semibold text-slate-900 " +
      "text-sm sm:text-[13px] border border-slate-200/80 bg-white/75 backdrop-blur " +
      "hover:bg-white transition active:scale-[0.99] relative overflow-hidden";

    return (
      <motion.div
        ref={cardRef}
        variants={cardVariants}
        initial="hidden"
        animate="show"
        className={[
          "relative overflow-hidden rounded-3xl",
          "border border-slate-200/80 bg-white/65 backdrop-blur-xl",
          "shadow-[0_18px_50px_rgba(15,23,42,0.10)]",
        ].join(" ")}
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/10 to-transparent" />
        <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(215,85,41,0.16),transparent_60%)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_70%_70%,rgba(236,72,153,0.10),transparent_60%)] blur-3xl" />

        <div className="absolute top-3 right-3 z-30">
          <button
            type="button"
            className="h-10 w-10 rounded-2xl grid place-items-center border border-slate-200/80 bg-white/75 hover:bg-white transition active:scale-[0.99]"
            onClick={() => setMenuOpen((s) => !s)}
            aria-label="Open actions"
          >
            <HiDotsHorizontal size={22} className="text-slate-700" />
          </button>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              ref={panelRef}
              variants={panelVariants}
              initial="closed"
              animate="open"
              exit="exit"
              className={[
                "absolute z-20 top-0 right-0 h-full w-[220px]",
                "p-3 bg-white/80 backdrop-blur-xl border-l border-slate-200/80",
                "shadow-[0_20px_60px_rgba(0,0,0,0.20)]",
              ].join(" ")}
            >
              <div className="text-[11px] font-black tracking-wide text-slate-500 px-1">
                ACTIONS
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <ActionBtn
                  tone="good"
                  label="Approve"
                  icon={<FiCheck className="text-emerald-600" />}
                  onClick={() => {
                    setMenuOpen(false);
                    openApproveConfirm();
                  }}
                />
                <ActionBtn
                  tone="bad"
                  label="Reject"
                  icon={<FiX className="text-rose-600" />}
                  onClick={() => {
                    setMenuOpen(false);
                    openRejectConfirm();
                  }}
                />
                <ActionBtn
                  label="Settings"
                  icon={<IoMdSettings className="text-slate-700" />}
                  onClick={() => {
                    const path = member.uuid?.startsWith("C")
                      ? `/customeraccountsummary/${member.uuid}`
                      : `/memberprofile/${member.uuid}`;
                    navigate(path);
                    setMenuOpen(false);
                  }}
                />
              </div>

              <div className="mt-3 text-[11px] text-slate-500 px-1">
                Tip: Use approve/reject here.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute -inset-2 rounded-3xl bg-gradient-to-br from-orange-200 via-pink-200 to-orange-200 blur-md" />
              <div className="relative rounded-3xl p-[2px] bg-gradient-to-br from-orange-200 via-pink-200 to-orange-200">
                <div className="rounded-3xl bg-white/85 border border-white/60 p-1">
                  <Avatar
                    src={imageName || undefined}
                    sx={{ width: 76, height: 76 }}
                    className="rounded-3xl"
                  >
                    <span className="font-black text-slate-700">
                      {initials}
                    </span>
                  </Avatar>
                </div>
              </div>

              <div className="pointer-events-none absolute inset-0 rounded-3xl overflow-hidden">
                <div className="absolute -left-24 top-0 h-full w-24 bg-white/35 rotate-12 blur-md opacity-30 animate-[shimmer_2.4s_ease-in-out_infinite]" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="min-w-0 pr-12">
                <div className="text-sm font-black text-slate-900 truncate">
                  {fullName || "Unnamed User"}
                </div>
                <div className="mt-0.5 text-xs text-slate-500 truncate">
                  {member?.department || "—"}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 truncate">
                  {member?.position || ""}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ y: -1 }}
                  type="button"
                  className={BTN_APPROVE}
                  onClick={openApproveConfirm}
                >
                  <span className="pointer-events-none absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_20%_20%,rgba(215,85,41,0.20),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(255,122,0,0.16),transparent_60%)]" />
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-300 to-transparent" />
                  <span className="relative inline-flex items-center justify-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-2xl bg-white/80 border border-slate-200/70">
                      <FiCheck className="text-[#D75529]" />
                    </span>
                    Approve
                  </span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ y: -1 }}
                  type="button"
                  className={BTN_REJECT}
                  onClick={openRejectConfirm}
                >
                  <span className="pointer-events-none absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_20%_20%,rgba(236,72,153,0.14),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(215,85,41,0.14),transparent_60%)]" />
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-300 to-transparent" />
                  <span className="relative inline-flex items-center justify-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-2xl bg-white/80 border border-slate-200/70">
                      <FiX className="text-pink-600" />
                    </span>
                    Reject
                  </span>
                </motion.button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span
                className={[
                  "inline-flex items-center rounded-full px-2.5 py-1",
                  "text-[11px] font-semibold border",
                  statusTone,
                ].join(" ")}
              >
                {member?.status || "—"}
              </span>

              <span className="text-[11px] text-slate-500">
                <span className="font-semibold">ID:</span>{" "}
                <span className="font-mono">{member?.uuid}</span>
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white/60 px-3 py-2 text-[11px] text-slate-600">
              <span className="font-semibold">Tip:</span> Use the ellipse button
              for Actions (Approve / Reject / Settings).
            </div>
          </div>
        </div>

        <style>{`
          @keyframes shimmer {
            0% { transform: translateX(0) rotate(12deg); opacity: .15; }
            50% { opacity: .35; }
            100% { transform: translateX(260px) rotate(12deg); opacity: .15; }
          }
        `}</style>
      </motion.div>
    );
  };

  return (
    <>
      <style>{`
        @keyframes spinLoader { to { transform: rotate(360deg); } }
      `}</style>

      <div className="relative z-[9999]">
        {isYesNoModalOpen && (
          <ModalYesNoReusable
            header={confirmMeta.header}
            message={confirmMeta.message}
            setYesNoModalOpen={setYesNoModalOpen}
            triggerYesNoEvent={triggerYesNoEvent}
            yesLabel={confirmMeta.yesLabel}
            noLabel={confirmMeta.noLabel}
            isLoading={mutationIsLoading}
          />
        )}

        {isAfterApproveModalOpen && (
          <ModalYesNoReusable
            header={afterApproveMeta.header}
            message={afterApproveMeta.message}
            setYesNoModalOpen={setAfterApproveModalOpen}
            triggerYesNoEvent={triggerAfterApproveYes}
            yesLabel={afterApproveMeta.yesLabel}
            noLabel={afterApproveMeta.noLabel}
            isLoading={false}
          />
        )}

        {showSuccess && (
          <ModalSuccessNavToSelf
            header={successHeader}
            message={successMessage}
            button={"Confirm"}
            setIsModalOpen={setShowSuccess}
            resetForm={() => {
              handleUsersReset();

              if ((lastActionRef.current || "").toLowerCase() === "approved") {
                const approvedId = lastUserIdRef.current;

                openAfterApproveModal({
                  message:
                    "✅ Approved successfully.\n\nCredentials (username & password) were already sent to the user’s email, including the company code.\n\nWould you like to go to User Roles now and assign Function / Routes / Business Unit access?",
                  yesLabel: "Go to User Roles",
                  noLabel: "Later",
                  onYes: () => {
                    navigate("/userroles", {
                      state: approvedId ? { approvedUserId: approvedId } : null,
                    });
                  },
                });
              }
            }}
          />
        )}
      </div>

      <div className={PAGE_BG}>
        {BG_BLOBS}

        <TopNav
          activeNavView={activeNavView}
          setActiveNavView={setActiveNavView}
          onBack={() =>
            navigate("/poscorehomescreen", {
              state: { openSettings: true },
            })
          }
        />

        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-24">
          <div
            className={[GLASS_CARD, "p-5 sm:p-7 overflow-hidden relative"].join(
              " ",
            )}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/10 to-transparent" />
            <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br from-orange-200/40 via-pink-200/30 to-orange-200/20 blur-3xl" />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                {headerChip}
                <h1 className="mt-2 text-2xl font-[Poppins-Black] sm:text-3xl tracking-tight text-slate-900">
                  <span className="bg-gradient-to-r from-[#D75529] via-pink-500 to-orange-500 bg-clip-text text-transparent">
                    Users
                  </span>{" "}
                  Queue
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Approve, reject, and manage user registrations.
                </p>

                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-[11px] font-semibold text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-[#D75529]" />
                  Plan: {planInfo.plan} • Active: {activeUserCount} • Limit:{" "}
                  {planInfo.max === Infinity ? "Unlimited" : planInfo.max}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUsersReset}
                  className={BTN_GHOST}
                  disabled={isFetching}
                >
                  <span className="inline-flex items-center gap-2">
                    {isFetching ? (
                      <ModernLoader size={18} />
                    ) : (
                      <FiRefreshCw className="h-4 w-4" />
                    )}
                    <span>{isFetching ? "Refreshing…" : "Reset"}</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSearch((s) => !s)}
                  className={BTN_PRIMARY}
                >
                  <span className="inline-flex items-center gap-2">
                    <CiSearch className="text-[20px]" />
                    {showSearch ? "Hide" : "Search"}
                  </span>
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <div className="text-[11px] font-semibold tracking-wide text-slate-500">
                  Page Size
                </div>
                <select
                  className={[
                    INPUT,
                    "cursor-pointer font-semibold text-slate-700",
                  ].join(" ")}
                  value={pageItems}
                  onChange={(e) => setPageItems(e.target.value)}
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="500">500</option>
                  <option value="1000">1000</option>
                </select>
              </div>

              <div
                className={[
                  "sm:col-span-2 transition-all duration-300",
                  showSearch ? "opacity-100" : "opacity-0 pointer-events-none",
                ].join(" ")}
              >
                <div className="text-[11px] font-semibold tracking-wide text-slate-500">
                  Search
                </div>
                <div className="mt-1 relative">
                  <CiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[22px]" />
                  <input
                    value={searchParams}
                    onChange={(e) => setSearchParams(e.target.value)}
                    placeholder="Search name / department / reference…"
                    className={[INPUT, "pl-11"].join(" ")}
                  />
                </div>
              </div>
            </div>

            {(mutationIsLoading || isFetching) && (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-2">
                <ModernLoader size={22} />
                <span className="text-xs font-semibold text-slate-600">
                  Syncing…
                </span>
              </div>
            )}
          </div>

          <div className="mt-5">
            <div className={[GLASS_CARD, "p-4 sm:p-5"].join(" ")}>
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <span className="grid h-9 w-9 place-items-center rounded-2xl border border-slate-200/80 bg-white/70">
                    <FiUsers className="h-4 w-4 text-[#D75529]" />
                  </span>
                  <span>Users list</span>
                </div>

                <div className="text-xs text-slate-500">
                  {isFetchingNextPage
                    ? "Loading more…"
                    : hasNextPage
                      ? "Scroll for more"
                      : "End of list"}
                </div>
              </div>

              <div className="mt-4">
                <div
                  className={
                    activeNavView === "grid"
                      ? "grid grid-cols-1 lg:grid-cols-2 gap-4"
                      : "grid grid-cols-1 gap-4"
                  }
                >
                  {usersData &&
                    Array.isArray(usersData.pages) &&
                    usersData.pages.length > 0 &&
                    usersData.pages.map((page, index) => (
                      <React.Fragment key={index}>
                        {page.items
                          .filter((m) =>
                            isSuperAdminUser ? m : m.position !== "SUPER ADMIN",
                          )
                          .map((member) => (
                            <MemberQueueCard
                              key={member.uuid}
                              member={member}
                            />
                          ))}
                      </React.Fragment>
                    ))}
                </div>

                <div className="mt-4">
                  <InfiniteScrollComponent
                    isFetchingNextPage={isFetchingNextPage}
                    hasNextPage={hasNextPage}
                    fetchNextPage={fetchNextPage}
                    data={usersData}
                  />
                </div>

                <div className="mt-4 flex justify-end">
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className={BTN_GHOST}
                    onClick={handleUsersReset}
                    disabled={isFetching}
                  >
                    <span className="inline-flex items-center gap-2">
                      {isFetching ? <ModernLoader size={18} /> : null}
                      <span>{isFetching ? "Refreshing…" : "Reset"}</span>
                    </span>
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="h-10" />
      </div>
    </>
  );
};

export default MemberQueings;
