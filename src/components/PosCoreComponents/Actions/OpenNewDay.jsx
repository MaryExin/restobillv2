import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FaCalendarPlus, FaMoneyBillWave, FaCalendarAlt } from "react-icons/fa";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import PosQuickActionTile from "../Common/PosQuickActionTile";
import PosModal from "../Common/PosModal";

import useApiHost from "../../../hooks/useApiHost";
import useZustandLoginCred from "../../../context/useZustandLoginCred";
import { useCustomSecuredMutation } from "../../../hooks/useCustomSecuredMutation";
import ModalYesNoReusable from "../../Modals/ModalYesNoReusable";
import ModalSuccessNavToSelf from "../../Modals/ModalSuccessNavToSelf";

const OpenNewDay = () => {
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isYesNoModalOpen, setIsYesNoModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState(
    "New shift has been opened!",
  );

  const apiHost = useApiHost();
  const { userId } = useZustandLoginCred();

  const [dateselection, setDateSelection] = useState(null);

  const refreshShiftData = useCallback(async () => {
    if (!userId || !apiHost) return;

    try {
      const response = await fetch(
        `${apiHost}/api/get_shift_details.php?user_id=${userId}`,
      );
      const result = await response.json();
      setDateSelection(result);
    } catch (error) {
      console.error("Error fetching shift:", error);
    }
  }, [userId, apiHost]);

  useEffect(() => {
    refreshShiftData();
  }, [refreshShiftData]);

  // expose refresh function globally so PosReadingModal can trigger it after Z-reading
  useEffect(() => {
    window.refreshOpenNewDayShift = refreshShiftData;

    return () => {
      delete window.refreshOpenNewDayShift;
    };
  }, [refreshShiftData]);
  const shiftingLoading = false;
  const getTodayLocal = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (dateValue) => {
    if (!dateValue) return "";
    const cleanDate = String(dateValue).split(" ")[0];
    const [year, month, day] = cleanDate.split("-");
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const addOneDay = (dateValue) => {
    if (!dateValue) return getTodayLocal();
    const cleanDate = String(dateValue).split(" ")[0];
    const [year, month, day] = cleanDate.split("-");
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    date.setDate(date.getDate() + 1);
    const nextYear = date.getFullYear();
    const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
    const nextDay = String(date.getDate()).padStart(2, "0");
    return `${nextYear}-${nextMonth}-${nextDay}`;
  };

  const [values, setValues] = useState({
    selectedDate: getTodayLocal(),
    inputAmount: "",
    verifyAmount: "",
    category_code: "",
    unit_code: "",
  });

  useEffect(() => {
    if (!dateselection) return;

    const fetchedDate =
      dateselection?.Opening_DateTime ||
      dateselection?.selectedDate ||
      dateselection?.date ||
      "";

    setValues((prev) => ({
      ...prev,
      selectedDate: fetchedDate ? addOneDay(fetchedDate) : getTodayLocal(),
      category_code: dateselection?.Category_Code || "",
      unit_code: dateselection?.Unit_Code || "",
    }));
  }, [dateselection]);

  const handleChange = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setStep(1);
    setValues((prev) => ({
      ...prev,
      inputAmount: "",
      verifyAmount: "",
    }));
  };

  const handleClose = () => {
    if (isSubmitting || shiftingLoading) return;
    setOpen(false);
    setIsYesNoModalOpen(false);
    resetForm();
  };

  const handleNext = () => {
    if (!values.selectedDate) {
      alert("Please select a date.");
      return;
    }
    setStep(2);
  };

  const handleCopyAmount = () => {
    if (!String(values.inputAmount).trim()) return;
    setValues((prev) => ({ ...prev, verifyAmount: prev.inputAmount }));
  };

  const handleAmountChange = (name, value) => {
    const cleanedValue = value.replace(/[^0-9.]/g, "");
    const parts = cleanedValue.split(".");
    const formattedValue =
      parts.length > 2
        ? `${parts[0]}.${parts.slice(1).join("")}`
        : cleanedValue;

    setValues((prev) => ({ ...prev, [name]: formattedValue }));
  };

  const handleOpenConfirm = () => {
    if (Number(values.inputAmount) !== Number(values.verifyAmount)) {
      alert("Input amount and verify amount do not match.");
      return;
    }
    setIsYesNoModalOpen(true);
  };

  const handleConfirmedSubmit = async () => {
    try {
      if (!apiHost) {
        alert("API host is not ready.");
        return;
      }

      const loggedUserId =
        userId ||
        localStorage.getItem("user_id") ||
        localStorage.getItem("id") ||
        "";

      const loggedUserName =
        localStorage.getItem("username") ||
        localStorage.getItem("email") ||
        localStorage.getItem("Cashier") ||
        "Store Crew";

      const cashierName =
        localStorage.getItem("Cashier") ||
        localStorage.getItem("fullname") ||
        localStorage.getItem("name") ||
        loggedUserName;

      if (!loggedUserId) {
        alert("User ID is missing. Please log in again.");
        return;
      }

      if (!values.category_code || !values.unit_code) {
        alert("Category code or unit code is missing.");
        return;
      }

      if (!values.selectedDate) {
        alert("Please select a date.");
        return;
      }

      const inputAmount = String(values.inputAmount ?? "").trim();
      const verifyAmount = String(values.verifyAmount ?? "").trim();

      if (inputAmount === "" || verifyAmount === "") {
        alert("Please input amount first.");
        return;
      }

      // if (Number(inputAmount) <= 0 || Number(verifyAmount) <= 0) {
      //   alert("Amounts must be greater than zero.");
      //   return;
      // }

      if (Number(inputAmount) !== Number(verifyAmount)) {
        alert("Input amount and verify amount do not match.");
        return;
      }

      setIsSubmitting(true);

      const formData = new FormData();
      formData.append("user_id", String(loggedUserId));
      formData.append("user_name", String(loggedUserName));
      formData.append("cashier_name", String(cashierName));
      formData.append("category_code", String(values.category_code));
      formData.append("unit_code", String(values.unit_code));
      formData.append(
        "terminal_number",
        String(localStorage.getItem("posTerminalNumber") || "1"),
      );
      formData.append("opening_cash_count", inputAmount);
      formData.append("opening_cash_count_confirmation", verifyAmount);
      formData.append("opening_date", String(values.selectedDate));

      const response = await fetch(`${apiHost}/api/open_shift.php`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || result?.status !== "success") {
        throw new Error(result?.message || "Failed to open new shift.");
      }

      await refreshShiftData();

      if (window.refreshShiftPanel) {
        await window.refreshShiftPanel();
      }

      if (window.refreshLayoutShift) {
        await window.refreshLayoutShift();
      }

      if (window.refreshSwitchUserShift) {
        await window.refreshSwitchUserShift();
      }

      if (window.refreshOpenNewDayShift) {
        await window.refreshOpenNewDayShift();
      }

      if (queryClient) {
        await queryClient.invalidateQueries();
      }

      setSuccessMessage(
        result?.message || "New shift has been opened successfully.",
      );
      setIsYesNoModalOpen(false);
      setOpen(false);
      resetForm();
      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error("Open shift failed:", error);
      alert(error?.message || "Failed to open new shift.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const dateFields = useMemo(
    () => [
      {
        name: "selectedDate",
        type: "text",
        icon: <FaCalendarAlt />,
        disabled: true,
        readOnly: true,
        value: formatDisplayDate(values.selectedDate),
      },
    ],
    [values.selectedDate],
  );

  const cashFields = useMemo(
    () => [
      {
        name: "inputAmount",
        label: "Input Amount:",
        type: "text",
        placeholder: "Amount",
        icon: <FaMoneyBillWave />,
        onChange: (value) => handleAmountChange("inputAmount", value),
      },
      {
        name: "verifyAmount",
        label: "Verify Amount:",
        type: "text",
        placeholder: "Double click to copy",
        icon: <FaMoneyBillWave />,
        onDoubleClick: handleCopyAmount,
        onChange: (value) => handleAmountChange("verifyAmount", value),
      },
    ],
    [values.inputAmount],
  );

  const buttons = useMemo(() => {
    if (step === 1) {
      return [
        { label: "Cancel", variant: "danger", onClick: handleClose },
        { label: "Continue", variant: "primary", onClick: handleNext },
      ];
    }

    return [
      { label: "Back", variant: "secondary", onClick: () => setStep(1) },
      {
        label: "Submit",
        variant: "primary",
        onClick: handleOpenConfirm,
        loading: isSubmitting || shiftingLoading,
      },
    ];
  }, [step, isSubmitting, shiftingLoading]);

  const isOpen = dateselection?.Shift_Status?.toLowerCase() === "open";

  return (
    <>
      <PosQuickActionTile
        label="Open New Day"
        icon={<FaCalendarPlus className="text-[28px] sm:text-[30px]" />}
        color={isOpen ? "green" : "orange"}
        disabled={isOpen}
        onClick={() => !isOpen && setOpen(true)}
      />

      {isSuccessModalOpen && (
        <ModalSuccessNavToSelf
          header="Success"
          message={successMessage}
          button="OK"
          setIsModalOpen={setIsSuccessModalOpen}
          resetForm={() => setIsSuccessModalOpen(false)}
        />
      )}

      {isYesNoModalOpen &&
        createPortal(
          <ModalYesNoReusable
            header="Open New Day Confirmation"
            message={`Are you sure you want to open a new day?\n\nDate: ${formatDisplayDate(
              values.selectedDate,
            )}\nOpening Cash Count: ${values.inputAmount}`}
            setYesNoModalOpen={setIsYesNoModalOpen}
            triggerYesNoEvent={handleConfirmedSubmit}
            triggerNoEvent={() => setIsYesNoModalOpen(false)}
            yesLabel="Proceed"
            noLabel="Cancel"
            isLoading={isSubmitting || shiftingLoading}
          />,
          document.body,
        )}

      <PosModal
        open={open}
        width="max-w-[450px]"
        title={step === 1 ? "Date" : "Input Cash Count"}
        subtitle={
          step === 2
            ? `Opening for: ${formatDisplayDate(values.selectedDate)}`
            : ""
        }
        fields={step === 1 ? dateFields : cashFields}
        values={values}
        buttons={buttons}
        onChange={handleChange}
        onClose={handleClose}
      />
    </>
  );
};

export default OpenNewDay;
