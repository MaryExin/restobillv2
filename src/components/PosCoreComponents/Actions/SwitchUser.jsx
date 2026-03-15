import React, { useMemo, useState, useEffect } from "react";

import { FaUsers, FaUserCircle } from "react-icons/fa";

import PosQuickActionTile from "../Common/PosQuickActionTile";
import PosModal from "../Common/PosModal";

import useZustandLoginCred from "../../../context/useZustandLoginCred";
import useApiHost from "../../../hooks/useApiHost";

const SwitchUser = () => {

  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [dateselection, setDateSelection] = useState(null);

  const { userId } = useZustandLoginCred();
  const apiHost = useApiHost();

  // 🔹 FETCH SHIFT STATUS
useEffect(() => {

  const fetchShift = async () => {

    if (!userId) return;

    try {

      const response = await fetch(
        `${apiHost}/api/get_shift_details.php?user_id=${userId}`
      );

      const result = await response.json();

      setDateSelection(result);

    } catch (error) {

      console.error("Error fetching shift:", error);

    }

  };

  fetchShift();

  // 🔥 allow global refresh
  window.refreshSwitchUserShift = fetchShift;

}, [userId, apiHost]);

  // 🔹 DISABLE SWITCH USER IF SHIFT CLOSED
  const isClosed = useMemo(() => {

    return dateselection?.Shift_Status?.toLowerCase() !== "open";

  }, [dateselection]);

  const users = useMemo(
    () => [
      { id: 1, name: "AM SHIFT" },
      { id: 2, name: "Dianne Bulactao" },
      { id: 3, name: "Emma De Vera" },
      { id: 4, name: "PM SHIFT" },
      { id: 5, name: "Reichel Lunaria" },
      { id: 6, name: "Supervisor Admin" },
    ],
    [],
  );

  const handleClose = () => {

    if (isSubmitting) return;

    setOpen(false);
    setSelectedUser(null);

  };

  const handleSelectUser = async (user) => {

    try {

      setIsSubmitting(true);
      setSelectedUser(user);

      console.log("Switch user:", user);

      // 🔹 Switch user API logic here

      setOpen(false);
      setSelectedUser(null);

    } catch (error) {

      console.error("Switch user failed:", error);

    } finally {

      setIsSubmitting(false);

    }

  };

  const buttons = useMemo(
    () => [
      {
        label: "Cancel",
        variant: "secondary",
        onClick: handleClose,
        disabled: isSubmitting,
        className: "min-w-[180px]",
      },
    ],
    [isSubmitting],
  );

  return (
    <>
      <PosQuickActionTile
        label="Switch User"
        icon={<FaUsers className="text-[28px] sm:text-[30px]" />}
        color="indigo"
        disabled={isClosed}
        onClick={() => !isClosed && setOpen(true)}
      />

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

            {users.map((user) => {

              const isActive = selectedUser?.id === user.id;

              return (
                <button
                  key={user.id}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSelectUser(user)}
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

                </button>
              );

            })}

          </div>

        </div>
      </PosModal>
    </>
  );
};

export default SwitchUser;