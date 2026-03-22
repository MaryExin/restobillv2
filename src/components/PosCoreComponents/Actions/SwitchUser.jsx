import React, { useMemo, useState, useEffect } from "react";
import {
  FaUsers,
  FaUserCircle,
  FaLock,
  FaExchangeAlt,
  FaCheckCircle,
} from "react-icons/fa";

import PosQuickActionTile from "../Common/PosQuickActionTile";
import PosModal from "../Common/PosModal";
import ModalSuccessNavToSelf from "../../Modals/ModalSuccessNavToSelf";

import useZustandLoginCred from "../../../context/useZustandLoginCred";
import useApiHost from "../../../hooks/useApiHost";

const SwitchUser = () => {
  const [open, setOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateselection, setDateSelection] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

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
console.log(toggleEmail);
  useEffect(() => {
    let isMounted = true;

    const fetchShift = async () => {
      if (!userId) return;

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

  const resetState = () => {
    setSelectedUser(null);
    setPassword("");
    setErrorMessage("");
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setOpen(false);
    setPasswordModalOpen(false);
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
      className: "min-w-[180px]",
    },
  ];

  const passwordButtons = [
    {
      label: "Back",
      variant: "secondary",
      onClick: handlePasswordModalClose,
      disabled: isSubmitting,
      className: "min-w-[140px]",
    },
    {
      label: isSubmitting ? "Switching..." : "Switch User",
      variant: "primary",
      onClick: handleSwitchUserLogin,
      disabled: isSubmitting,
      className: "min-w-[160px]",
    },
  ];

  return (
    <>
      <PosQuickActionTile
        label="Switch Users"
        icon={<FaUsers className="text-[28px] sm:text-[30px]" />}
        color="indigo"
        disabled={isClosed}
        onClick={() => !isClosed && setOpen(true)}
      />

      {!passwordModalOpen && !isSuccessModalOpen && (
        <PosModal
          open={open}
          title="Switch User"
          onClose={handleClose}
          width="max-w-[1100px]"
          height="h-[82vh]"
          bodyClassName="pt-2"
          buttons={buttons}
        >
          <div className="flex h-full flex-col">
            <div className="mb-5 rounded-[22px] border border-slate-200 bg-gradient-to-r from-sky-50 via-white to-indigo-50 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                  <FaExchangeAlt className="text-[22px]" />
                </div>

                <div>
                  <div className="text-[22px] font-bold text-slate-800">
                    Choose account
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Select the account you want to switch into for this active
                    shift.
                  </p>
                </div>
              </div>
            </div>

            {users.length > 0 ? (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {users.map((user) => {
                  const isActive =
                    selectedUser?.id === (user?.id ?? user?.uuid);

                  return (
                    <button
                      key={user.id ?? user.uuid}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleUserClick(user)}
                      className={`group relative overflow-hidden rounded-[24px] border bg-white p-5 text-left shadow-sm transition-all duration-300 ${
                        isSubmitting
                          ? "cursor-not-allowed opacity-70"
                          : "hover:-translate-y-1.5 hover:border-sky-300 hover:shadow-[0_20px_40px_rgba(14,165,233,0.12)]"
                      } ${
                        isActive
                          ? "border-sky-400 ring-4 ring-sky-100"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-cyan-400 to-indigo-500 opacity-90" />

                      <div className="flex flex-col items-center text-center">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sky-50 text-sky-500 transition group-hover:scale-105">
                          <FaUserCircle className="text-[54px]" />
                        </div>

                        <div className="mt-4 line-clamp-2 text-[15px] font-bold leading-tight text-slate-800">
                          {user.name}
                        </div>

                        <div className="mt-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">
                          {user.userRole || "User"}
                        </div>

                        <div className="mt-3 line-clamp-2 text-[12px] text-slate-400">
                          {user.email || user.username || ""}
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-center">
                        <span className="rounded-xl bg-sky-50 px-3 py-2 text-[12px] font-semibold text-sky-600 transition group-hover:bg-sky-100">
                          Switch to this account
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="w-full max-w-md rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
                    <FaUsers className="text-[24px]" />
                  </div>
                  <div className="mt-4 text-lg font-bold text-slate-700">
                    No accounts found
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    There are no available accounts to switch to right now.
                  </p>
                </div>
              </div>
            )}
          </div>
        </PosModal>
      )}

      {!isSuccessModalOpen && (
        <PosModal
          open={passwordModalOpen}
          title="Confirm Switch User"
          onClose={handlePasswordModalClose}
          width="max-w-[480px]"
          height="h-auto"
          bodyClassName="pt-2"
          buttons={passwordButtons}
        >
          <div className="flex flex-col gap-5 py-2">
            <div className="rounded-[24px] border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-sky-50 text-sky-500 shadow-inner">
                  <FaUserCircle className="text-[64px]" />
                </div>

                <div className="mt-4 text-[22px] font-bold text-slate-800">
                  {selectedUser?.name || "Selected User"}
                </div>

                <div className="mt-2 rounded-full bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-500">
                  {selectedUser?.userRole || "User"}
                </div>

                <div className="mt-3 text-[13px] text-slate-400">
                  {selectedUser?.email || selectedUser?.username || ""}
                </div>
              </div>
            </div>

            <div className="rounded-[20px] border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-slate-700">
                <FaLock className="text-sky-500" />
                <label className="text-sm font-semibold">Password</label>
              </div>

              <input
                type="password"
                value={password}
                disabled={isSubmitting}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSwitchUserLogin();
                  }
                }}
                placeholder="Enter password"
                className="w-full rounded-[14px] border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-100"
              />
            </div>

            {errorMessage ? (
              <div className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {errorMessage}
              </div>
            ) : (
              <div className="rounded-[16px] border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                Enter the password for this account to continue switching user.
              </div>
            )}
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
