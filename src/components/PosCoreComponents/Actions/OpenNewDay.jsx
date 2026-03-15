import React, { useEffect, useMemo, useState } from "react";
import {
  FaCalendarPlus,
  FaMoneyBillWave,
  FaCalendarAlt,
} from "react-icons/fa";
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
  const [successMessage, setSuccessMessage] = useState("New shift has been opened!");

  const apiHost = useApiHost();
  const { userId } = useZustandLoginCred();

  const [dateselection, setDateSelection] = useState(null);

  const apiEndpoint = localStorage.getItem("apiendpoint") || "";

  const {
    data: shiftingData,
    isLoading: shiftingLoading,
    mutateAsync: mutateShifting,
  } = useCustomSecuredMutation(
    apiEndpoint + import.meta.env.VITE_MUTATION_CASH_TRANSACTIONS_ENDPOINT,
    "POST"
  );

  // ✅ FETCH SHIFT DETAILS
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

  }, [userId, apiHost]);

  const getTodayLocal = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (dateValue) => {
    if (!dateValue) return "";

    const [year, month, day] = dateValue.split("-");
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

    if (dateselection) {

      setValues(prev => ({
        ...prev,
        selectedDate: dateselection.selectedDate || prev.selectedDate,
        category_code: dateselection.Category_Code || "",
        unit_code: dateselection.Unit_Code || "",
      }));

    }

  }, [dateselection]);

  useEffect(() => {

    if (!dateselection) return;

    const fetchedDate =
      dateselection?.Opening_DateTime ||
      dateselection?.selectedDate ||
      dateselection?.date ||
      "";

    if (!fetchedDate) return;

    setValues((prev) => ({
      ...prev,
      selectedDate: addOneDay(fetchedDate),
    }));

  }, [dateselection]);

  const handleChange = (name, value) => {
    setValues((prev) => ({
      ...prev,
      [name]: value,
    }));
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

    setValues((prev) => ({
      ...prev,
      verifyAmount: prev.inputAmount,
    }));

  };

  const handleAmountChange = (name, value) => {

    const cleanedValue = value.replace(/[^0-9.]/g, "");

    const parts = cleanedValue.split(".");

    const formattedValue =
      parts.length > 2
        ? `${parts[0]}.${parts.slice(1).join("")}`
        : cleanedValue;

    setValues((prev) => ({
      ...prev,
      [name]: formattedValue,
    }));

  };

  const handleOpenConfirm = () => {

    if (Number(values.inputAmount) !== Number(values.verifyAmount)) {
      alert("Input amount and verify amount do not match.");
      return;
    }

    setIsYesNoModalOpen(true);
  };

  const handleCancelConfirm = () => {
    setIsYesNoModalOpen(false);
  };

  const handleConfirmedSubmit = async () => {

    try {

      setIsSubmitting(true);

      const payload = {
        transaction: "openNewShift",
        category_code: values.category_code,
        unit_code: values.unit_code,
        terminal_number: localStorage.getItem("posTerminalNumber") || "",
        opening_cash_count: values.inputAmount,
        opening_cash_count_confirmation: values.verifyAmount,
        opening_date: values.selectedDate,
      };

      const response = await mutateShifting(payload);

      queryClient.invalidateQueries(["dateselection"]);

      setSuccessMessage(response?.message || "New shift has been opened!");

      setIsYesNoModalOpen(false);
      setOpen(false);
      resetForm();
      setIsSuccessModalOpen(true);

    } catch (error) {

      console.error("Failed:", error);

      alert(error?.response?.data?.message || "Failed to open new shift.");

    } finally {

      setIsSubmitting(false);

    }

  };

  const handleSuccessClose = () => {
    setIsSuccessModalOpen(false);
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
    [values.selectedDate]
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
    [values.inputAmount]
  );

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
          resetForm={handleSuccessClose}
        />
      )}

      {isYesNoModalOpen && (
        <ModalYesNoReusable
          header="Open New Day Confirmation"
          message={`Are you sure you want to open a new day?\n\nDate: ${formatDisplayDate(
            values.selectedDate
          )}\nOpening Cash Count: ${values.inputAmount}`}
          setYesNoModalOpen={setIsYesNoModalOpen}
          triggerYesNoEvent={handleConfirmedSubmit}
          triggerNoEvent={handleCancelConfirm}
          yesLabel="Proceed"
          noLabel="Cancel"
          isLoading={isSubmitting || shiftingLoading}
        />
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
        buttons={[]}
        onChange={handleChange}
        onClose={handleClose}
      />
    </>
  );
};

export default OpenNewDay;