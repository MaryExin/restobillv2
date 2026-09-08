"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaCashRegister, FaPrint } from "react-icons/fa";
import { FiX } from "react-icons/fi";
import useApiHost from "../../hooks/useApiHost";
import useGetDefaultPrinter from "../../hooks/useGetDefaultPrinter";
import ButtonComponent from "./Common/ButtonComponent";
import useBusinessInfo from "../../hooks/useBusinessInfo";
import TutorialTip from "../common/TutorialTip";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import {
  hasPosXReadingAccess,
  hasPosZReadingAccess,
} from "../../utils/posRoleAccess";
import {
  usePosDeveloperSession,
  usePosRoleAccessVersion,
} from "../../hooks/usePosRoleAccessConfig";
import { posAuthenticatedFetch } from "../../utils/posAuthenticatedFetch";
import { buildXPrintHtml, buildZPrintHtml } from "../../utils/BuildXZReadingHtml";
import { printWithPdfFallback } from "../../utils/printWithPdfFallback";

const DENOMINATIONS = [
  { key: "1000", label: "₱1,000", value: 1000 },
  { key: "500", label: "₱500", value: 500 },
  { key: "200", label: "₱200", value: 200 },
  { key: "100", label: "₱100", value: 100 },
  { key: "50", label: "₱50", value: 50 },
  { key: "20", label: "₱20", value: 20 },
  { key: "10", label: "₱10", value: 10 },
  { key: "5", label: "₱5", value: 5 },
  { key: "1", label: "₱1", value: 1 },
  { key: "0.25", label: "25¢", value: 0.25 },
  { key: "0.05", label: "5¢", value: 0.05 },
  { key: "0.01", label: "1¢", value: 0.01 },
];

const parseReadingResponse = async (response) => {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(
      `The POS reading server returned an empty response (${response.status}).`,
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `The POS reading server returned an invalid response (${response.status}).`,
    );
  }
};

export default function PosReadingModal({
  open = true,
  onClose = () => {},
  onZReadingPrinted = () => {},
  selectedCashier = "All Cashiers",
  categoryCode = "",
  unitCode = "",
  terminalNumber = "",
  shiftingDate = "",
  xEndpoint = "/api/generate_x_reading_pdf.php",
  zEndpoint = "/api/generate_z_reading_data.php",
}) {
  const apiHost = useApiHost();
  const defaultPrinterName = useGetDefaultPrinter();
  const { roles } = useZustandLoginCred();
  const roleAccessVersion = usePosRoleAccessVersion();
  const developerMode = usePosDeveloperSession();
  const canUseXReading = useMemo(
    () => hasPosXReadingAccess(roles, developerMode),
    [roles, roleAccessVersion, developerMode],
  );
  const canUseZReading = useMemo(
    () => hasPosZReadingAccess(roles, developerMode),
    [roles, roleAccessVersion, developerMode],
  );
  const [printerName, setPrinterName] = useState("");
  const [printers, setPrinters] = useState([]);

  const {
    businessInfo,
    isLoading: isBusInfoLoading,
    error: businessInfoError,
  } = useBusinessInfo();

  useEffect(() => {
    if (!open) return;

    const loadPrinters = async () => {
      try {
        const list = await window.electronAPI?.getPrinters?.();
        const safeList = Array.isArray(list) ? list : [];
        setPrinters(safeList);

        const resolvedPrinter =
          String(defaultPrinterName || "").trim() ||
          safeList.find((p) => p.isDefault)?.name ||
          "";

        setPrinterName(resolvedPrinter);
      } catch (error) {
        console.error("Failed to load printers:", error);
        setPrinters([]);
        setPrinterName(String(defaultPrinterName || "").trim());
      }
    };

    loadPrinters();
  }, [open, defaultPrinterName]);

  const [activeType, setActiveType] = useState(null);
  const [values, setValues] = useState({
    cashDrawerAmount: "",
    verifyAmount: "",
  });
  const [errors, setErrors] = useState({
    cashDrawerAmount: "",
    verifyAmount: "",
  });
  const [denomCounts, setDenomCounts] = useState({});
  const [cashierChoice, setCashierChoice] = useState(selectedCashier);
  const [cashierOptions, setCashierOptions] = useState([]);

  useEffect(() => {
    if (!open || !apiHost) return;

    const userId = localStorage.getItem("user_id") || "";

    fetch(
      `${apiHost}/api/get_shift_details.php?user_id=${encodeURIComponent(userId)}`,
    )
      .then((res) => res.json())
      .then((data) => {
        const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
        const options = accounts
          .filter((acc) =>
            ["0", "cashier"].includes(
              String(acc?.userRoleValue ?? acc?.userRole ?? "")
                .trim()
                .toLowerCase(),
            ),
          )
          .map((acc) => ({
            name: String(acc?.name || "").trim(),
            username: String(acc?.username || acc?.email || "").trim(),
          }))
          .filter((acc) => acc.name);

        setCashierOptions(options);
      })
      .catch((error) => {
        console.error("Failed to load cashier list:", error);
        setCashierOptions([]);
      });
  }, [open, apiHost]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isCheckingBlockers, setIsCheckingBlockers] = useState(false);
  const [blockerModal, setBlockerModal] = useState({
    open: false,
    title: "",
    message: "",
  });

  const parsedCashDrawer = useMemo(
    () => Number(values.cashDrawerAmount || 0),
    [values.cashDrawerAmount],
  );

  const parsedVerifyAmount = useMemo(
    () => Number(values.verifyAmount || 0),
    [values.verifyAmount],
  );

  const amountDifference = useMemo(
    () => parsedCashDrawer - parsedVerifyAmount,
    [parsedCashDrawer, parsedVerifyAmount],
  );

  const denomTotal = useMemo(
    () =>
      DENOMINATIONS.reduce(
        (sum, d) => sum + Number(denomCounts[d.key] || 0) * d.value,
        0,
      ),
    [denomCounts],
  );

  const normalizedShiftDate = useMemo(() => {
    return String(shiftingDate || "").split(" ")[0];
  }, [shiftingDate]);

  const readingDatabaseScope = () =>
    localStorage.getItem("posReadingDatabaseScope") === "report"
      ? "report"
      : "cnc";

  const resetForm = () => {
    setValues({
      cashDrawerAmount: "",
      verifyAmount: "",
    });
    setErrors({
      cashDrawerAmount: "",
      verifyAmount: "",
    });
    setDenomCounts({});
    setCashierChoice(selectedCashier);
  };

  const openBlockerModal = (title, message) => {
    setBlockerModal({
      open: true,
      title,
      message,
    });
  };

  const closeBlockerModal = () => {
    setBlockerModal({
      open: false,
      title: "",
      message: "",
    });
  };

  const handleCloseAll = () => {
    if (isPrinting) return;
    setActiveType(null);
    resetForm();
    closeBlockerModal();
    onClose();
  };

  const checkReadingBlockers = async () => {
    if (!normalizedShiftDate) {
      throw new Error("Shift date is missing.");
    }

    const response = await posAuthenticatedFetch(
      `${apiHost}/api/check_posreading_blockers.php`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction_date: normalizedShiftDate,
          category_code: categoryCode || "",
          unit_code: unitCode || "",
          terminal_number: localStorage.getItem("posTerminalNumber") || "1",
          readingDatabaseScope: readingDatabaseScope(),
        }),
      },
    );

    const result = await parseReadingResponse(response);

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to validate transactions.");
    }

    return result;
  };

  const handleOpenZReading = async () => {
    if (!canUseZReading) return;
    try {
      setIsCheckingBlockers(true);

      const result = await checkReadingBlockers();

      if (result.blocked) {
        openBlockerModal(
          "POS Reading Blocked",
          `There are ${result.totalTransactions} transaction(s) with remarks "Pending for Payment" or "Billed" for ${result.transactionDate}.`,
        );
        return;
      }

      setActiveType("z");
      resetForm();
    } catch (error) {
      console.error(error);
      openBlockerModal(
        "Validation Error",
        error.message || "Unable to validate transactions.",
      );
    } finally {
      setIsCheckingBlockers(false);
    }
  };

  const handleChange = (name, value) => {
    if (value === "") {
      setValues((prev) => ({ ...prev, [name]: "" }));
      setErrors((prev) => ({ ...prev, [name]: "" }));
      return;
    }

    const sanitized = value.replace(/[^0-9.]/g, "");
    const parts = sanitized.split(".");
    const normalized =
      parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : sanitized;

    setValues((prev) => ({ ...prev, [name]: normalized }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleDenomChange = (key, value) => {
    const digitsOnly = value.replace(/[^0-9]/g, "");
    setDenomCounts((prev) => ({ ...prev, [key]: digitsOnly }));
  };

  const applyDenomTotalToCashDrawer = () => {
    handleChange("cashDrawerAmount", denomTotal.toFixed(2));
  };

  const validate = () => {
    const nextErrors = {
      cashDrawerAmount: "",
      verifyAmount: "",
    };

    if (values.cashDrawerAmount === "") {
      nextErrors.cashDrawerAmount = "Cash drawer amount is required.";
    }

    if (values.verifyAmount === "") {
      nextErrors.verifyAmount = "Verify amount is required.";
    }

    if (
      values.cashDrawerAmount !== "" &&
      values.verifyAmount !== "" &&
      Number(values.cashDrawerAmount) !== Number(values.verifyAmount)
    ) {
      nextErrors.verifyAmount = "Verify amount must match cash drawer amount.";
    }

    setErrors(nextErrors);
    return !nextErrors.cashDrawerAmount && !nextErrors.verifyAmount;
  };

  const money = (value) =>
    Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const ensureReadingReady = () => {
    if (!validate()) return false;

    if (isBusInfoLoading) {
      openBlockerModal(
        "Business Info Loading",
        "Business information is still loading.",
      );
      return false;
    }

    if (businessInfoError) {
      openBlockerModal("Business Info Error", businessInfoError);
      return false;
    }

    return true;
  };

  const buildReadingRequestBody = (isZReading) => {
    const matchedCashierOption = cashierOptions.find(
      (opt) => opt.name === cashierChoice,
    );

    return {
      readingType: isZReading ? "Z" : "X",
      selectedCashier: isZReading ? "All Cashiers" : cashierChoice,
      selectedCashierUsername:
        !isZReading && matchedCashierOption
          ? matchedCashierOption.username
          : "",
      cashDrawerAmount: Number(values.cashDrawerAmount || 0),
      verifyAmount: Number(values.verifyAmount || 0),
      denominationBreakdown: DENOMINATIONS.reduce((acc, d) => {
        acc[d.key] = Number(denomCounts[d.key] || 0);
        return acc;
      }, {}),
      categoryCode: categoryCode || "",
      unitCode: unitCode || "",
      terminalNumber: localStorage.getItem("posTerminalNumber") || "1",
      corpName: businessInfo.corpName || "",
      shiftingDate: normalizedShiftDate,
      machineNumber: businessInfo.machineNumber || "",
      serialNumber: businessInfo.serialNumber || "",
      ptuNumber: businessInfo.posProviderPTUNo || "",
      ptuDateIssued: businessInfo.posProviderPTUDateIssued || "",
      readingDatabaseScope: readingDatabaseScope(),
      user_id: localStorage.getItem("user_id") || "",
      user_name: localStorage.getItem("Cashier") || "Store Crew",
      cashier_name: localStorage.getItem("username") || "Store Crew",
    };
  };

  const buildReadingPayload = (results) => ({
    ...results.data,
    companyName: businessInfo.companyName || "",
    storeName: businessInfo.storeName || "",
    corpName: businessInfo.corpName || "",
    address: businessInfo.address || "",
    tin: businessInfo.tin || "",
    machineNumber: businessInfo.machineNumber || "",
    serialNumber: businessInfo.serialNumber || "",
    terminalNumber: localStorage.getItem("posTerminalNumber") || "1",
    ptuNumber: businessInfo.posProviderPTUNo || "",
    ptuDateIssued: businessInfo.posProviderPTUDateIssued || "",
    posProviderName: businessInfo.posProviderName || "",
    posProviderAddress: businessInfo.posProviderAddress || "",
    posProviderTin: businessInfo.posProviderTin || "",
    posProviderBirAccreNo: businessInfo.posProviderBirAccreNo || "",
    posProviderAccreDateIssued:
      businessInfo.posProviderAccreDateIssued || "",
    summaryCashInDrawer: Number(values.cashDrawerAmount || 0),
    cashInDrawer: Number(values.cashDrawerAmount || 0),
    vatExemption:
      results.data?.vatExemption ??
      results.data?.lessVatExemption ??
      results.data?.vatExemptVat ??
      0,
  });

  const loadReadingPayload = async (isZReading) => {
    const endpoint = isZReading ? zEndpoint : xEndpoint;
    const response = await posAuthenticatedFetch(`${apiHost}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildReadingRequestBody(isZReading)),
    });

    const results = await parseReadingResponse(response);

    if (!response.ok || !results.success) {
      throw new Error(results.message || "Failed to load reading data.");
    }

    return buildReadingPayload(results);
  };

  const refreshAfterZReading = async () => {
    setActiveType(null);
    resetForm();
    onClose();

    try {
      await onZReadingPrinted();

      if (window.refreshOpenNewDayShift) {
        await window.refreshOpenNewDayShift();
      }

      if (window.refreshShiftPanel) {
        await window.refreshShiftPanel();
      }

      if (window.refreshLayoutShift) {
        await window.refreshLayoutShift();
      }

      if (window.refreshSwitchUserShift) {
        await window.refreshSwitchUserShift();
      }
    } catch (refreshError) {
      console.error("Shift refresh error:", refreshError);
    }
  };

  const handlePrint = async () => {
    if (
      (activeType === "x" && !canUseXReading) ||
      (activeType === "z" && !canUseZReading)
    ) {
      openBlockerModal(
        "Access Denied",
        "Your role does not have permission for this POS reading.",
      );
      return;
    }
    if (!ensureReadingReady()) return;

    try {
      setIsPrinting(true);

      const isZReading = activeType === "z";
      const payload = await loadReadingPayload(isZReading);

      const result = await printWithPdfFallback({
        attempt: () =>
          window.electronAPI.printEscposXzReading({
            payload,
            isZReading,
            printerName: printerName || defaultPrinterName || "",
          }),
        buildFallbackHtml: () =>
          isZReading ? buildZPrintHtml(payload) : buildXPrintHtml(payload),
        fileName: `${isZReading ? "Z" : "X"}-Reading-${payload?.reportDate || Date.now()}.pdf`,
      });

      if (result?.canceled) {
        return;
      }

      if (!result?.success) {
        throw new Error(result?.message || "Failed to print X/Z reading.");
      }

      if (result?.printFallback) {
        openBlockerModal(
          "Saved as PDF",
          `No printer available or a print error occurred — saved as PDF instead: ${result.filePath}`,
        );
      }

      if (isZReading) {
        await refreshAfterZReading();
      }
    } catch (error) {
      console.error(error);
      openBlockerModal(
        "Processing Error",
        error.message || "Something went wrong while printing.",
      );
    } finally {
      setIsPrinting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-4xl overflow-hidden rounded-[28px] border border-zinc-200 bg-[#eef2f8] p-8 shadow-[0_24px_70px_rgba(0,0,0,0.22)]"
        >
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <TutorialTip
              section="X Reading & Z Reading"
              title="How X-Reading & Z-Reading work"
            />

            <button
              type="button"
              onClick={handleCloseAll}
              disabled={isPrinting}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-zinc-600 shadow-sm transition hover:scale-105 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiX size={20} />
            </button>
          </div>

          <div className="mx-auto max-w-3xl pt-6">
            <h2 className="text-center text-4xl font-extrabold tracking-tight text-[#37578d]">
              POS Reading
            </h2>

            <div className="mt-12 grid gap-8">
              <ReadingCard
                title="X-Reading"
                iconClassName="bg-sky-100 text-sky-600"
                onClick={() => {
                  if (!canUseXReading) return;
                  setActiveType("x");
                  resetForm();
                }}
                disabled={isPrinting || !canUseXReading}
              />

              <ReadingCard
                title="Z-Reading"
                iconClassName="bg-orange-100 text-orange-500"
                onClick={handleOpenZReading}
                disabled={
                  isPrinting || isCheckingBlockers || !canUseZReading
                }
              />
            </div>

            <div className="mt-4 text-center text-sm text-zinc-500">
              {isCheckingBlockers
                ? "Checking pending transactions..."
                : isBusInfoLoading
                  ? "Loading business information..."
                  : normalizedShiftDate
                    ? `Shift Date: ${normalizedShiftDate}`
                    : "No shift date found."}
            </div>

            <div className="mt-2 text-center text-xs text-zinc-400">
              {businessInfo.companyName || ""}
            </div>

            <div className="mt-16 flex justify-center">
              <button
                type="button"
                onClick={handleCloseAll}
                disabled={isPrinting}
                className="min-w-[290px] rounded-[30px] bg-gradient-to-b from-[#4f6df5] to-[#3f5fe0] px-10 py-4 text-2xl font-extrabold text-white shadow-[0_14px_34px_rgba(63,95,224,0.28)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
              >
                Close
              </button>
            </div>
          </div>

          <AnimatePresence>
            {activeType && (
              <motion.div
                className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="w-full max-w-4xl max-h-[95vh] overflow-y-auto rounded-[28px] bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.30)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
                        POS Reading
                      </div>
                      <h3 className="mt-0.5 text-3xl font-bold text-zinc-900">
                        {activeType === "x" ? "X-Reading" : "Z-Reading"}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        Enter the cash drawer amount and verify it first.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (isPrinting) return;
                        setActiveType(null);
                        resetForm();
                      }}
                      disabled={isPrinting}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiX size={20} />
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-zinc-700">
                        Cash Denomination Count
                      </label>
                      <span className="text-sm font-semibold text-zinc-500">
                        Total: ₱ {money(denomTotal)}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {DENOMINATIONS.map((d) => (
                        <div
                          key={d.key}
                          className="rounded-xl border border-zinc-200 bg-white p-2"
                        >
                          <div className="text-xs font-semibold text-zinc-500">
                            {d.label}
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={denomCounts[d.key] || ""}
                            onChange={(e) =>
                              handleDenomChange(d.key, e.target.value)
                            }
                            disabled={isPrinting}
                            placeholder="0"
                            className="mt-1 h-11 w-full rounded-lg border border-zinc-200 px-2 text-base text-zinc-800 outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={applyDenomTotalToCashDrawer}
                      disabled={isPrinting}
                      className="theme-force-brand mt-3 rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Use Total as Cash Drawer Amount
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <AmountField
                      label="Cash Drawer Amount"
                      name="cashDrawerAmount"
                      value={values.cashDrawerAmount}
                      onChange={handleChange}
                      error={errors.cashDrawerAmount}
                      disabled={isPrinting}
                    />

                    <AmountField
                      label="Verify Amount"
                      name="verifyAmount"
                      value={values.verifyAmount}
                      onChange={handleChange}
                      error={errors.verifyAmount}
                      disabled={isPrinting}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3">
                    <span className="text-sm text-zinc-500">Difference</span>
                    <span
                      className={`text-base font-semibold ${
                        amountDifference === 0
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }`}
                    >
                      ₱{" "}
                      {Number.isFinite(amountDifference)
                        ? amountDifference.toFixed(2)
                        : "0.00"}
                    </span>
                  </div>

                  <div
                    className={`mt-4 grid gap-3 ${
                      activeType === "x" ? "grid-cols-2" : "grid-cols-1"
                    }`}
                  >
                    {activeType === "x" && (
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-zinc-700">
                          Cashier
                        </label>

                        <select
                          value={cashierChoice}
                          onChange={(e) => setCashierChoice(e.target.value)}
                          disabled={isPrinting}
                          className="h-14 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-base text-zinc-800 outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="All Cashiers">All Cashiers</option>
                          {cashierOptions.map((opt) => (
                            <option key={opt.name} value={opt.name}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-zinc-700">
                        Printer
                      </label>

                      <select
                        value={printerName}
                        onChange={(e) => setPrinterName(e.target.value)}
                        disabled={isPrinting}
                        className="h-14 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-base text-zinc-800 outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="">
                          {defaultPrinterName
                            ? `Default Printer (${defaultPrinterName})`
                            : "Default Printer"}
                        </option>
                        {printers.map((printer) => (
                          <option key={printer.name} value={printer.name}>
                            {printer.displayName || printer.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (isPrinting) return;
                        setActiveType(null);
                        resetForm();
                      }}
                      disabled={isPrinting}
                      className="rounded-[20px] bg-[#e5e7eb] px-8 py-4 text-base font-bold text-zinc-800 transition hover:bg-[#dcdfe4] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Back
                    </button>

                    <ButtonComponent
                      onClick={handlePrint}
                      isLoading={isPrinting}
                      disabled={isPrinting}
                      loadingText={
                        activeType === "z"
                          ? "Printing Z-Reading..."
                          : "Printing X-Reading..."
                      }
                      variant="primary"
                      icon={<FaPrint className="shrink-0" />}
                      fullWidth={false}
                      className="px-8 !py-4 text-base rounded-[20px] shadow-[0_12px_30px_rgba(63,95,224,0.28)] !mb-0"
                    >
                      Print Now
                    </ButtonComponent>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {blockerModal.open && (
              <motion.div
                className="absolute inset-0 z-[30] flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 16 }}
                  transition={{ duration: 0.2 }}
                  className="w-full max-w-2xl rounded-[30px] border border-white/70 bg-[#f7f8fb] p-8 shadow-[0_25px_60px_rgba(15,23,42,0.28)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[30px] font-extrabold tracking-tight text-[#1f2937]">
                        {blockerModal.title}
                      </div>
                      <div className="mt-4 max-w-[720px] text-[22px] leading-[1.7] text-[#202938]">
                        {blockerModal.title === "POS Reading Blocked"
                          ? "You cannot proceed with POS Reading yet."
                          : "Please check the message below."}
                      </div>
                      <div className="mt-8 max-w-[720px] text-[20px] leading-[1.8] text-[#202938]">
                        {blockerModal.message}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={closeBlockerModal}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-500 shadow-sm transition hover:scale-105 hover:text-zinc-800"
                    >
                      <FiX size={20} />
                    </button>
                  </div>

                  <div className="mt-10 flex justify-end">
                    <button
                      type="button"
                      onClick={closeBlockerModal}
                      className="min-w-[140px] rounded-[999px] border-[3px] border-[#5b57e6] bg-gradient-to-b from-[#5f6ff2] to-[#5448df] px-8 py-4 text-2xl font-extrabold text-white shadow-[0_14px_30px_rgba(84,72,223,0.30)] transition hover:brightness-110 active:scale-[0.99]"
                    >
                      OK
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ReadingCard({ title, onClick, iconClassName = "", disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex min-h-[124px] w-full items-center rounded-[20px] bg-white px-6 py-6 text-left shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(15,23,42,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div
        className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${iconClassName}`}
      >
        <FaCashRegister size={24} />
      </div>

      <div className="flex-1 px-5 text-center">
        <div className="text-[2rem] font-medium tracking-wide text-zinc-600">
          {title}
        </div>
      </div>
    </button>
  );
}

function AmountField({ label, name, value, onChange, error, disabled = false }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-zinc-700">
        {label}
      </label>

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
          ₱
        </span>

        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          disabled={disabled}
          placeholder="0.00"
          className={`h-14 w-full rounded-2xl border bg-white pl-10 pr-4 text-base text-zinc-800 outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${
            error
              ? "border-rose-400 focus:border-rose-500"
              : "border-zinc-200 focus:border-sky-400"
          }`}
        />
      </div>

      {error ? <p className="mt-1 text-xs text-rose-500">{error}</p> : null}
    </div>
  );
}
