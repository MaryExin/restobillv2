"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useWindowSize } from "react-use";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import useZustandSideMenu from "../../context/useZustandSideMenu";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";
import { FaHome } from "react-icons/fa";
import { FiMenu } from "react-icons/fi";
import { useCustomSecuredMutation } from "../../hooks/useCustomSecuredMutation";
import { supabase } from "../../context/supaBaseClient";
import Toast from "../Toasts/Toast";

// Init Toast
const useToasts = () => {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, duration) => {
    const newToast = { message, duration };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prevToasts) => prevToasts.filter((t) => t !== newToast));
    }, duration);
  };

  return { showToast, toasts };
};

const UserInfoPanel = ({ toggleIsMobile }) => {
  const {
    isAuthenticated,
    firstName,
    profilePic,
    selectedMenu,
    setSelectedMenu,
    email,
    updateUserRole,
  } = useZustandLoginCred();

  /************************SUPABASE BEG****************************/
  // Supabase Client Update (ALWAYS an array: [] or [latestRow])
  const [clientUpdateData, setClientUpdateData] = useState([]);
  const { showToast, toasts } = useToasts();
  const [isRoleUpdated, setIsRoleUpdated] = useState(false);

  // ---- DEDUPE REFS (prevents toast on every remount/route change)
  const lastSeenResetIdRef = useRef(null); // prevents re-mutating same row during one mount
  const lastProcessedResetIdRef = useRef(null); // prevents re-toasting across remounts

  // Load lastProcessedResetId from sessionStorage (survive route changes)
  useEffect(() => {
    const saved = sessionStorage.getItem("lastProcessedResetId");
    lastProcessedResetIdRef.current = saved ? Number(saved) : null;
  }, []);

  /***************AUTO UPDATE SUPABASE*******************/
  // 1) Initial load: fetch ONLY latest row -> keep as array
  useEffect(() => {
    const fetchLatest = async () => {
      const { data, error } = await supabase
        .from("tbl_user_roles_reset")
        .select("*")
        .order("id", { ascending: false })
        .limit(1);

      if (error) console.error(error);
      else setClientUpdateData(data ?? []); // ✅ ALWAYS array
    };

    fetchLatest();
  }, []);

  // 2) Subscribe to INSERT/UPDATE/DELETE (keep only latest row)
  useEffect(() => {
    const chan = supabase
      .channel("public:tbl_user_roles_reset")
      .on(
        "postgres_changes",
        { schema: "public", table: "tbl_user_roles_reset", event: "*" },
        async ({ eventType, new: newRow, old: oldRow }) => {
          setClientUpdateData((cur) => {
            const latest = cur?.[0] ?? null;

            if (eventType === "INSERT") return [newRow];

            if (eventType === "UPDATE") {
              // update only if it's the row we currently hold
              return latest?.id === newRow?.id ? [newRow] : cur;
            }

            if (eventType === "DELETE") {
              // if latest deleted, clear then refetch below
              return latest?.id === oldRow?.id ? [] : cur;
            }

            return cur;
          });

          // If latest got deleted, refetch a new latest row
          if (eventType === "DELETE") {
            const { data, error } = await supabase
              .from("tbl_user_roles_reset")
              .select("*")
              .order("id", { ascending: false })
              .limit(1);

            if (!error) setClientUpdateData(data ?? []);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chan);
    };
  }, []);

  const {
    data: userRoleData,
    mutate: userRoleMutate,
    isLoading: userRoleIsLoading,
  } = useCustomSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_READ_USER_ROLE_BY_USER_ENDPOINT,
    "POST",
  );

  // ✅ Toast only when it actually updated (no initial spam)
  const didMountRole = useRef(false);
  useEffect(() => {
    if (!didMountRole.current) {
      didMountRole.current = true;
      return;
    }

    if (isRoleUpdated) {
      showToast(`Updated your user role`, 5000);
      setIsRoleUpdated(false);
    }
  }, [isRoleUpdated, showToast]);

  // ✅ Auto reload roles ONLY when reset row id CHANGED (prevents rerun on route change)
  useEffect(() => {
    const row = clientUpdateData?.[0];
    if (!row?.id) return;

    // If we already saw this row id in this mount, do nothing.
    if (lastSeenResetIdRef.current === row.id) return;

    lastSeenResetIdRef.current = row.id;
    userRoleMutate({});
  }, [clientUpdateData, userRoleMutate]);

  // ✅ Apply update ONLY when:
  //   - row matches current user/company
  //   - AND reset row id has NOT been processed before (sessionStorage)
  useEffect(() => {
    const row = clientUpdateData?.[0];
    if (!row) return;
    if (!userRoleData) return;

    const resetId = Number(row.id);
    if (!Number.isFinite(resetId)) return;

    // If already processed previously (even after route change), skip
    if (lastProcessedResetIdRef.current === resetId) return;

    const cc = String(row.companycode ?? "").trim();
    const ce = String(row.email ?? "")
      .trim()
      .toLowerCase();
    const emailNow = String(email ?? "")
      .trim()
      .toLowerCase();
    const codeNow = String(localStorage.getItem("companycode") ?? "").trim();

    console.log({ cc, ce, emailNow, codeNow });
    console.log(userRoleData);

    if (codeNow === cc && emailNow === ce) {
      // ✅ Apply new roles
      updateUserRole(userRoleData);

      // ✅ Mark processed so it won’t re-trigger on remount
      lastProcessedResetIdRef.current = resetId;
      sessionStorage.setItem("lastProcessedResetId", String(resetId));

      // ✅ Toast once per reset event id
      setIsRoleUpdated(true);
    }
    console.log(userRoleData);
  }, [userRoleData]);

  /************************SUPABASE END****************************/

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [companyCode, setCompanyCode] = useState("");

  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const navigate = useNavigate();
  const { width } = useWindowSize();

  const { toggleIsDesktopSideMenu } = useZustandSideMenu();

  // Modern way to get environment variables
  const Logo = import.meta.env.VITE_LOGO;

  // Modern way to handle company code with useEffect
  useEffect(() => {
    const storedCompanyCode = localStorage.getItem("companycode");
    if (storedCompanyCode) {
      setCompanyCode(storedCompanyCode);
    }
  }, []);

  // Memoized image URL handler for better performance
  const handleFilterImageURL = useMemo(() => {
    return (imagePath) => {
      if (!imagePath) return "/placeholder.svg";

      const parts = imagePath.split("images/employees/");
      const file = parts[1] || "";
      const apiEndpoint = localStorage.getItem("apiendpoint");
      const imageUrl = import.meta.env.VITE_IMAGE_URLS;

      return apiEndpoint && imageUrl
        ? `${apiEndpoint}${imageUrl}${file}`
        : "/placeholder.svg";
    };
  }, []);

  // Modern way to handle menu toggle with useCallback for optimization
  const onMenuToggle = () => {
    if (width > 768) {
      toggleIsDesktopSideMenu();
    } else {
      toggleIsMobile();
    }
    setIsMenuOpen((prev) => !prev);
  };

  // Modern way to handle login navigation
  const handleLoginClick = () => {
    navigate("/login");
    setSelectedMenu("Login");
  };

  // Modern way to handle logo click
  const handleLogoClick = () => {
    navigate("/");
  };

  // Modern way to format name
  const formattedFirstName = useMemo(() => {
    if (!firstName) return "";
    return firstName.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }, [firstName]);

  return (
    <>
      {" "}
      <header className="z-30 fixed top-0 left-0 w-full bg-gradient-to-r from-softPrimary to-darkPrimary border-darkerPrimary backdrop-blur-sm shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 lg:px-8">
          {/* Left: Logo + Menu Toggle + Company Code */}
          <div className="flex items-center space-x-4">
            {/* Animated Hamburger Menu (Mobile only) */}
            {/* <button
            onClick={onMenuToggle}
            className="relative w-9 h-9 flex flex-col justify-center items-center lg:hidden group"
            aria-label="Toggle Menu"
          >
            <span
              className={`w-6 h-0.5 bg-softWhite rounded transition-transform duration-300 ease-in-out ${
                isMenuOpen ? "rotate-45 translate-y-1.5" : "-translate-y-1.5"
              }`}
            />
            <span
              className={`w-6 h-0.5 bg-softWhite rounded my-1 transition-opacity duration-300 ${
                isMenuOpen ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`w-6 h-0.5 bg-softWhite rounded transition-transform duration-300 ease-in-out ${
                isMenuOpen ? "-rotate-45 -translate-y-1.5" : "translate-y-1.5"
              }`}
            />
          </button> */}

            {/* Desktop Toggle Icon */}
            {/* <button
            onClick={onMenuToggle}
            className="hidden lg:flex flex-col justify-center items-center w-9 h-9 group"
            aria-label="Toggle Desktop Menu"
          >
            <span
              className={`w-6 h-0.5 bg-softWhite rounded transition-transform duration-300 ease-in-out ${
                isMenuOpen ? "rotate-45 translate-y-1.5" : "-translate-y-1.5"
              }`}
            />
            <span
              className={`w-6 h-0.5 bg-softWhite rounded my-1 transition-opacity duration-300 ${
                isMenuOpen ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`w-6 h-0.5 bg-softWhite rounded transition-transform duration-300 ease-in-out ${
                isMenuOpen ? "-rotate-45 -translate-y-1.5" : "translate-y-1.5"
              }`}
            />
          </button> */}

            <button
              onClick={onMenuToggle}
              className="flex items-center justify-center w-9 h-9 text-softWhite hover:text-white hover:scale-75 duration-150 ease-linear transition-all"
              aria-label="Toggle Desktop Menu"
            >
              <FiMenu size={24} />
            </button>

            {/* Company Code Display - Modern way */}
            {companyCode && (
              <div
                onClick={handleLogoClick}
                className="flex items-center cursor-pointer transition-transform duration-200 hover:scale-95"
              >
                <span className="px-3 py-1 flex gap-2 items-center bg-white/10 backdrop-blur-sm rounded-full text-xs font-medium text-white border border-white/20">
                  <FaHome className="font-bold text-lg" />
                  {companyCode}
                </span>
              </div>
            )}

            {/* Login Button for unauthenticated users */}
            {!isAuthenticated && (
              <button
                onClick={handleLoginClick}
                className={`ml-2 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-all duration-200 ${
                  selectedMenu === "Login"
                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                Login
              </button>
            )}
          </div>

          {/* Right: User Info */}
          {isAuthenticated && (
            <div className="flex items-center gap-4">
              {/* Name + Greeting */}
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-semibold text-white capitalize">
                  {formattedFirstName}
                </span>
                <span className="text-xs text-white">Good day!</span>
              </div>

              {/* Avatar */}
              <div className="relative">
                <img
                  src={handleFilterImageURL(profilePic) || "/placeholder.svg"}
                  alt="Profile"
                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-300 shadow hover:shadow-md transition duration-300"
                  onError={(e) => {
                    e.currentTarget.src = "/default-avatar.png";
                  }}
                />
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full shadow-sm" />
              </div>
            </div>
          )}
        </div>
      </header>
      {/* Toasts */}
      <div>
        <div className="toast-container">
          {toasts.map((toast, index) => (
            <Toast key={index} message={toast.message} />
          ))}
        </div>
      </div>
    </>
  );
};

export default UserInfoPanel;
