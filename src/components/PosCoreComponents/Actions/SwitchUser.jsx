import React, { useMemo, useState, useEffect } from "react";
import {
  FaUsers,
  FaUserCircle,
  FaSearch,
  FaLock,
  FaArrowRight,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";

import PosQuickActionTile from "../Common/PosQuickActionTile";
import PosModal from "../Common/PosModal";
import ModalSuccessNavToSelf from "../../Modals/ModalSuccessNavToSelf";

import useZustandLoginCred from "../../../context/useZustandLoginCred";
import useApiHost from "../../../hooks/useApiHost";
import { useTheme } from "../../../context/ThemeContext";

const SwitchUser = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [open, setOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateselection, setDateSelection] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const apiHost = useApiHost();

  const {
    userId,
    toggleAuthToTrue,
    setUserId,
    toggleFirstName,
    toggleEmail,
    updateUserRole,
    setProfilePic,
  } = useZustandLoginCred();

  useEffect(() => {
    let isMounted = true;

    const fetchShift = async () => {
      if (!userId || !apiHost) return;

      try {
        const response = await fetch(
          `${apiHost}/api/get_shift_details.php?user_id=${encodeURIComponent(
            userId,
          )}`,
        );
        const result = await response.json();

        if (isMounted) {
          setDateSelection(result);
        }
      } catch (error) {
        console.error("Error fetching shift:", error);
      }
    };

    fetchShift();
    window.refreshSwitchUserShift = fetchShift;

    return () => {
      isMounted = false;
      if (window.refreshSwitchUserShift === fetchShift) {
        delete window.refreshSwitchUserShift;
      }
    };
  }, [userId, apiHost]);

  const isClosed = useMemo(() => {
    return dateselection?.Shift_Status?.toLowerCase() !== "open";
  }, [dateselection]);

  const users = useMemo(() => {
    if (!Array.isArray(dateselection?.accounts)) return [];
    return dateselection.accounts.filter((item) => item?.uuid !== userId);
  }, [dateselection, userId]);

  const filteredUsers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    if (!keyword) return users;

    return users.filter((user) => {
      const name = String(user?.name ?? "").toLowerCase();
      const role = String(user?.userRole ?? "").toLowerCase();
      const email = String(user?.email ?? user?.username ?? "").toLowerCase();

      return (
        name.includes(keyword) ||
        role.includes(keyword) ||
        email.includes(keyword)
      );
    });
  }, [users, searchTerm]);

  const resetState = () => {
    setSelectedUser(null);
    setPassword("");
    setShowPassword(false);
    setErrorMessage("");
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setOpen(false);
    setPasswordModalOpen(false);
    setSearchTerm("");
    resetState();
  };

  const handleUserClick = (user) => {
    const normalizedUser = {
      id: user?.id ?? user?.uuid ?? "",
      uuid: user?.uuid ?? user?.id ?? "",
      email: (user?.email ?? user?.username ?? "").trim(),
      username: (user?.username ?? user?.email ?? "").trim(),
      name: user?.name ?? "",
      userRole: user?.userRole ?? "",
    };

    setSelectedUser(normalizedUser);
    setPassword("");
    setShowPassword(false);
    setErrorMessage("");
    setOpen(false);

    setTimeout(() => {
      setPasswordModalOpen(true);
    }, 120);
  };

  const handlePasswordModalClose = () => {
    if (isSubmitting) return;
    setPasswordModalOpen(false);
    resetState();
  };

  const handleSuccessAcknowledge = async () => {
    setIsSuccessModalOpen(false);
    resetState();

    if (typeof window.refreshSwitchUserShift === "function") {
      await window.refreshSwitchUserShift();
    }

    window.dispatchEvent(new Event("storage"));
  };

  const handleSwitchUserLogin = async () => {
    const loginEmail = String(
      selectedUser?.email ?? selectedUser?.username ?? "",
    ).trim();

    if (!loginEmail) {
      setErrorMessage("Selected user has no email.");
      return;
    }

    if (!password.trim()) {
      setErrorMessage("Please input password.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const response = await fetch(`${apiHost}/api/login.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: loginEmail,
          password: password,
        }),
      });

      const result = await response.json();

      if (!response.ok || result?.status !== "success") {
        setErrorMessage(result?.message || "Switch user failed.");
        return;
      }

      const nextUserId = result?.userid ?? "";
      const nextUsername = result?.username ?? "";
      const nextEmail = result?.email ?? loginEmail;
      const nextProfilePic = result?.profile_pic ?? "";

      let nextRole = result?.userrole ?? "";
      if (Array.isArray(nextRole)) {
        nextRole = nextRole[0] ?? "";
      }

      toggleAuthToTrue();
      setUserId(nextUserId);
      toggleFirstName(selectedUser?.name || nextUsername);
      toggleEmail(nextEmail);
      updateUserRole(nextRole);
      setProfilePic(nextProfilePic);

      localStorage.setItem("access_token", result?.access_token ?? "");
      localStorage.setItem("refresh_token", result?.refresh_token ?? "");
      localStorage.setItem("user_id", nextUserId);
      localStorage.setItem("username", selectedUser?.name || nextUsername);
      localStorage.setItem("email", nextEmail);
      localStorage.setItem(
        "user_role",
        Array.isArray(result?.userrole)
          ? JSON.stringify(result.userrole)
          : (result?.userrole ?? ""),
      );
      localStorage.setItem("profile_pic", nextProfilePic);

      setPasswordModalOpen(false);
      setOpen(false);

      setTimeout(() => {
        setIsSuccessModalOpen(true);
      }, 180);
    } catch (error) {
      console.error("Switch user failed:", error);
      setErrorMessage(error?.message || "Switch user failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const buttons = [
    {
      label: "Close",
      variant: "secondary",
      onClick: handleClose,
      disabled: isSubmitting,
      className: "min-w-[150px]",
    },
  ];

  const passwordButtons = [
    {
      label: "Back",
      variant: "secondary",
      onClick: handlePasswordModalClose,
      disabled: isSubmitting,
      className: "min-w-[130px]",
    },
    {
      label: isSubmitting ? "Switching..." : "Login",
      variant: "primary",
      onClick: handleSwitchUserLogin,
      disabled: isSubmitting,
      className: "min-w-[130px]",
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-2">
        <PosQuickActionTile
          label="Switch Users"
          icon={<FaUsers className="text-[28px] sm:text-[30px]" />}
          color="indigo"
          disabled={isClosed}
          onClick={() => !isClosed && setOpen(true)}
        />
      </div>

      {!passwordModalOpen && !isSuccessModalOpen && (
        <PosModal
          open={open}
          title="Switch User"
          onClose={handleClose}
          width="max-w-[1100px]"
          height="h-[84vh]"
          bodyClassName={`pt-2 ${isDark ? "bg-[#020617] text-slate-200" : ""}`}
          buttons={buttons}
        >
          <div className="flex h-full flex-col gap-4">
            <div
              className={`rounded-[20px] border p-4 sm:p-5 ${
                isDark
                  ? "border-slate-800 bg-gradient-to-r from-slate-900 to-slate-950"
                  : "border-slate-200 bg-gradient-to-r from-slate-50 to-white"
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                        isDark
                          ? "bg-blue-500/10 text-blue-400"
                          : "bg-sky-100 text-sky-600"
                      }`}
                    >
                      <FaUsers className="text-[20px]" />
                    </div>

                    <div>
                      <h2
                        className={`text-lg font-extrabold ${
                          isDark ? "text-white" : "text-slate-800"
                        }`}
                      >
                        Choose an account
                      </h2>
                      <p
                        className={`text-sm ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        Select the user you want to switch into.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="w-full lg:w-[340px]">
                  <div className="relative">
                    <FaSearch
                      className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${
                        isDark ? "text-slate-500" : "text-slate-400"
                      }`}
                    />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by name, role, or email"
                      className={`w-full rounded-[16px] py-3 pl-11 pr-4 text-sm outline-none transition ${
                        isDark
                          ? "border border-slate-700 bg-slate-900/60 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          : "border border-slate-300 bg-white text-slate-700 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div
                className={`mt-4 flex flex-wrap items-center gap-2 text-xs ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <span
                  className={`rounded-full px-3 py-1 font-medium ${
                    isDark
                      ? "bg-slate-800 text-slate-300"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  Total Users: {users.length}
                </span>
                <span
                  className={`rounded-full px-3 py-1 font-medium ${
                    isDark
                      ? "bg-blue-500/10 text-blue-300"
                      : "bg-sky-50 text-sky-700"
                  }`}
                >
                  Showing: {filteredUsers.length}
                </span>
                <span
                  className={`rounded-full px-3 py-1 font-medium ${
                    isDark
                      ? "bg-emerald-500/10 text-emerald-300"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  Shift: {dateselection?.Shift_Status || "Unknown"}
                </span>
              </div>
            </div>

            <div
              className={`min-h-0 flex-1 overflow-y-auto rounded-[20px] border p-3 sm:p-4 ${
                isDark
                  ? "border-slate-800 bg-slate-900/40"
                  : "border-slate-200 bg-slate-50/70"
              }`}
            >
              {filteredUsers.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredUsers.map((user) => {
                    const userKey = user?.id ?? user?.uuid ?? user?.email;
                    const isActive =
                      selectedUser?.id === (user?.id ?? user?.uuid ?? "");

                    return (
                      <button
                        key={userKey}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleUserClick(user)}
                        className={`group w-full rounded-[22px] border p-4 text-left transition-all duration-200 ${
                          isDark
                            ? "bg-slate-900/70 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                            : "bg-white shadow-sm"
                        } ${
                          isSubmitting
                            ? "cursor-not-allowed opacity-70"
                            : "hover:-translate-y-1 hover:shadow-lg"
                        } ${
                          isActive
                            ? isDark
                              ? "border-blue-500 ring-2 ring-blue-500/20"
                              : "border-sky-400 ring-2 ring-sky-100"
                            : isDark
                              ? "border-slate-800 hover:border-blue-500/50"
                              : "border-slate-200 hover:border-sky-300"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] ${
                              isDark
                                ? "bg-blue-500/10 text-blue-400"
                                : "bg-sky-50 text-sky-500"
                            }`}
                          >
                            <FaUserCircle className="text-[42px]" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div
                                  className={`truncate text-[16px] font-extrabold ${
                                    isDark ? "text-white" : "text-slate-800"
                                  }`}
                                >
                                  {user?.name || "Unnamed User"}
                                </div>

                                <div
                                  className={`mt-1 inline-flex max-w-full rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                    isDark
                                      ? "bg-slate-800 text-slate-300"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  <span className="truncate">
                                    {user?.userRole || "No role"}
                                  </span>
                                </div>
                              </div>

                              <div
                                className={`shrink-0 transition ${
                                  isDark
                                    ? "text-slate-600 group-hover:text-blue-400"
                                    : "text-slate-300 group-hover:text-sky-500"
                                }`}
                              >
                                <FaArrowRight className="text-[14px]" />
                              </div>
                            </div>

                            <div
                              className={`mt-3 break-all text-[12px] ${
                                isDark ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              {user?.email || user?.username || "No email"}
                            </div>

                            <div className="mt-4 flex items-center justify-between">
                              <span
                                className={`text-xs font-medium ${
                                  isDark ? "text-slate-500" : "text-slate-400"
                                }`}
                              >
                                Tap to continue
                              </span>

                              <span
                                className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                                  isDark
                                    ? "bg-blue-500/10 text-blue-300"
                                    : "bg-sky-50 text-sky-700"
                                }`}
                              >
                                Switch
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div
                  className={`flex h-full min-h-[280px] flex-col items-center justify-center rounded-[20px] border border-dashed px-6 text-center ${
                    isDark
                      ? "border-slate-700 bg-slate-900/40"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-full ${
                      isDark
                        ? "bg-slate-800 text-slate-500"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <FaUsers className="text-[26px]" />
                  </div>

                  <h3
                    className={`mt-4 text-base font-bold ${
                      isDark ? "text-white" : "text-slate-700"
                    }`}
                  >
                    No matching accounts found
                  </h3>

                  <p
                    className={`mt-2 max-w-md text-sm ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Try a different name, role, or email in the search field.
                  </p>
                </div>
              )}
            </div>
          </div>
        </PosModal>
      )}

      {!isSuccessModalOpen && (
        <PosModal
          open={passwordModalOpen}
          title="Confirm Switch User"
          onClose={handlePasswordModalClose}
          width="max-w-[460px]"
          height="h-auto"
          bodyClassName={`pt-2 ${isDark ? "bg-[#020617] text-slate-200" : ""}`}
          buttons={passwordButtons}
        >
          <div className="flex flex-col gap-5 py-2">
            <div
              className={`rounded-[20px] border p-5 ${
                isDark
                  ? "border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950"
                  : "border-slate-200 bg-gradient-to-b from-white to-slate-50"
              }`}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <div
                  className={`flex h-20 w-20 items-center justify-center rounded-full ${
                    isDark
                      ? "bg-blue-500/10 text-blue-400"
                      : "bg-sky-50 text-sky-500"
                  }`}
                >
                  <FaUserCircle className="text-[56px]" />
                </div>

                <div
                  className={`mt-4 text-[20px] font-extrabold ${
                    isDark ? "text-white" : "text-slate-800"
                  }`}
                >
                  {selectedUser?.name || "Selected User"}
                </div>

                <div
                  className={`mt-2 rounded-full px-3 py-1 text-[12px] font-semibold ${
                    isDark
                      ? "bg-slate-800 text-slate-300"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {selectedUser?.userRole || "No role"}
                </div>

                <div
                  className={`mt-3 break-all text-[12px] ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {selectedUser?.email || selectedUser?.username || ""}
                </div>
              </div>
            </div>

            <div
              className={`rounded-[18px] border p-4 ${
                isDark
                  ? "border-slate-800 bg-slate-900/70"
                  : "border-slate-200 bg-white"
              }`}
            >
              <label
                className={`mb-2 flex items-center gap-2 text-sm font-semibold ${
                  isDark ? "text-slate-200" : "text-slate-700"
                }`}
              >
                <FaLock
                  className={isDark ? "text-slate-500" : "text-slate-400"}
                />
                Password
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  disabled={isSubmitting}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSwitchUserLogin();
                    }
                  }}
                  placeholder="Enter password to continue"
                  className={`w-full rounded-[14px] px-4 py-3 pr-12 text-sm outline-none transition ${
                    isDark
                      ? "border border-slate-700 bg-slate-950 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-900"
                      : "border border-slate-300 text-slate-700 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
                  }`}
                />

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 transition disabled:cursor-not-allowed ${
                    isDark
                      ? "text-slate-500 hover:text-slate-300"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>

              <p
                className={`mt-2 text-xs ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                Enter the selected user’s password to confirm switching.
              </p>
            </div>

            {errorMessage ? (
              <div
                className={`rounded-[14px] border px-4 py-3 text-sm ${
                  isDark
                    ? "border-red-500/20 bg-red-500/10 text-red-300"
                    : "border-red-200 bg-red-50 text-red-600"
                }`}
              >
                {errorMessage}
              </div>
            ) : null}
          </div>
        </PosModal>
      )}

      {isSuccessModalOpen && (
        <ModalSuccessNavToSelf
          header="Switch User Success"
          message={`You are now logged in as ${
            selectedUser?.name || "the selected user"
          }.`}
          setIsModalOpen={setIsSuccessModalOpen}
          resetForm={handleSuccessAcknowledge}
          button="Accept"
        />
      )}
    </>
  );
};

export default SwitchUser;
