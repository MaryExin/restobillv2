import React, { useMemo, useState, useEffect } from "react";
import { FaUsers, FaUserCircle } from "react-icons/fa";

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

  useEffect(() => {
    let isMounted = true;

    const fetchShift = async () => {
      if (!userId) return;

      try {
        const response = await fetch(
          `${apiHost}/api/get_shift_details.php?user_id=${encodeURIComponent(userId)}`
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

    // hide main switch user modal first
    setOpen(false);

    // then open password modal
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
      selectedUser?.email ?? selectedUser?.username ?? ""
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
          : (result?.userrole ?? "")
      );
      localStorage.setItem("profile_pic", nextProfilePic);

      // close password modal first
      setPasswordModalOpen(false);

      // make sure the switch modal stays closed
      setOpen(false);

      // show success modal after modal transition finishes
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
      label: "Cancel",
      variant: "secondary",
      onClick: handleClose,
      disabled: isSubmitting,
      className: "min-w-[180px]",
    },
  ];

  const passwordButtons = [
    {
      label: "Cancel",
      variant: "secondary",
      onClick: handlePasswordModalClose,
      disabled: isSubmitting,
      className: "min-w-[140px]",
    },
    {
      label: isSubmitting ? "Switching..." : "Login",
      variant: "primary",
      onClick: handleSwitchUserLogin,
      disabled: isSubmitting,
      className: "min-w-[140px]",
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
          width="max-w-[95vw]"
          height="h-[82vh]"
          bodyClassName="pt-2"
          buttons={buttons}
        >
          <div className="flex h-full flex-col">
            <div className="flex flex-wrap content-start gap-5">
              {users.length > 0 ? (
                users.map((user) => {
                  const isActive = selectedUser?.id === user.id;

                  return (
                    <button
                      key={user.id}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleUserClick(user)}
                      className={`flex h-[120px] w-[120px] flex-col items-center justify-center rounded-[16px] border bg-white px-3 shadow-sm transition ${
                        isSubmitting
                          ? "cursor-not-allowed opacity-70"
                          : "hover:-translate-y-1 hover:shadow-md"
                      } ${
                        isActive
                          ? "border-sky-400 ring-2 ring-sky-200"
                          : "border-slate-200"
                      }`}
                    >
                      <FaUserCircle className="text-[48px] text-sky-500" />

                      <span className="mt-2 text-center text-[14px] font-bold leading-tight text-slate-600">
                        {user.name}
                      </span>

                      <span className="mt-1 text-center text-[11px] leading-tight text-slate-400">
                        {user.userRole || ""}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="w-full py-10 text-center text-sm text-slate-500">
                  No accounts found.
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
          width="max-w-[420px]"
          height="h-auto"
          bodyClassName="pt-2"
          buttons={passwordButtons}
        >
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col items-center justify-center">
              <FaUserCircle className="text-[64px] text-sky-500" />

              <div className="mt-3 text-center text-[18px] font-bold text-slate-700">
                {selectedUser?.name || "Selected User"}
              </div>

              <div className="mt-1 text-center text-[13px] text-slate-500">
                {selectedUser?.userRole || ""}
              </div>

              <div className="mt-1 text-center text-[12px] text-slate-400">
                {selectedUser?.email || selectedUser?.username || ""}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-600">
                Password
              </label>

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
                className="w-full rounded-[12px] border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
              />
            </div>

            {errorMessage ? (
              <div className="rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {errorMessage}
              </div>
            ) : null}
          </div>
        </PosModal>
      )}

      {isSuccessModalOpen && (
        <ModalSuccessNavToSelf
          header="Switch User Success"
          message={`You are now logged in as ${selectedUser?.name || "the selected user"}.`}
          setIsModalOpen={setIsSuccessModalOpen}
          resetForm={handleSuccessAcknowledge}
          button="Accept"
        />
      )}
    </>
  );
};

export default SwitchUser;