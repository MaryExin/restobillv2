"use client";

import React, { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaCashRegister, FaPrint } from "react-icons/fa";
import { FiX } from "react-icons/fi";
import useApiHost from "../../hooks/useApiHost";

export default function PosReadingModal({
  open = true,
  onClose = () => {},
  onZReadingPrinted = () => {},
  selectedCashier = "All Cashiers",
  categoryCode = "",
  unitCode = "",
  terminalNumber = "",
  corpName = "",
  shiftingDate = "",
  xEndpoint = "/api/generate_x_reading_pdf.php",
  zEndpoint = "/api/generate_z_reading_data.php",
}) {
  const apiHost = useApiHost();
  const printFrameRef = useRef(null);

  const [activeType, setActiveType] = useState(null);
  const [values, setValues] = useState({
    cashDrawerAmount: "",
    verifyAmount: "",
  });
  const [errors, setErrors] = useState({
    cashDrawerAmount: "",
    verifyAmount: "",
  });
  const [isPrinting, setIsPrinting] = useState(false);
  const [isCheckingBlockers, setIsCheckingBlockers] = useState(false);

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

  const normalizedShiftDate = useMemo(() => {
    return String(shiftingDate || "").split(" ")[0];
  }, [shiftingDate]);

  const resetForm = () => {
    setValues({
      cashDrawerAmount: "",
      verifyAmount: "",
    });
    setErrors({
      cashDrawerAmount: "",
      verifyAmount: "",
    });
  };

  const handleCloseAll = () => {
    if (isPrinting || isCheckingBlockers) return;
    setActiveType(null);
    resetForm();
    onClose();
  };

  const checkReadingBlockers = async () => {
    if (!normalizedShiftDate) {
      throw new Error("Shift date is missing.");
    }

    const response = await fetch(
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
          terminal_number: terminalNumber || "1",
        }),
      },
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to validate transactions.");
    }

    return result;
  };

  const handleOpenReading = async (type) => {
    try {
      setIsCheckingBlockers(true);

      const result = await checkReadingBlockers();

      if (result.blocked) {
        alert(
          `You cannot proceed with POS Reading yet.\n\n` +
            `There are ${result.totalTransactions} transaction(s) with remarks ` +
            `"Pending for Payment" or "Billed" for ${result.transactionDate}.`,
        );
        return;
      }

      setActiveType(type);
      resetForm();
    } catch (error) {
      console.error(error);
      alert(error.message || "Unable to validate transactions.");
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

  const commonPrintStyles = `
    <style>
      @page {
        size: 80mm auto;
        margin: 0;
      }
      html, body {
        width: 80mm;
        margin: 0;
        padding: 0;
        background: #fff;
      }
      body {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 11px;
        color: #000;
      }
      .receipt {
        width: 72mm;
        margin: 0 auto;
        padding: 4mm 2mm 6mm;
        box-sizing: border-box;
      }
      .center { text-align: center; }
      .title { font-weight: 700; font-size: 14px; line-height: 1.2; }
      .subtitle { font-size: 10px; line-height: 1.3; }
      .line { border-top: 1px dashed #000; margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      td { padding: 1px 0; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
      .label { width: 62%; }
      .value { width: 38%; text-align: right; }
      .strong { font-weight: 700; }
    </style>
  `;

  const buildXPrintHtml = (data) => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>X Reading</title>
          ${commonPrintStyles}
        </head>
        <body>
          <div class="receipt">
            <div class="center">
              <div class="title">${data.corpName || ""}</div>
              <div class="subtitle">${data.businessUnitName || ""}</div>
              <div class="subtitle">${data.businessUnitAddress || ""}</div>
              <div class="subtitle">${data.tinLabel || ""}</div>
              <div class="subtitle">MIN: ${data.machineNumber || ""}</div>
              <div class="subtitle">S/N: ${data.serialNumber || ""}</div>
              <div class="subtitle">PTU No: ${data.ptuNumber || ""}</div>
              <div class="subtitle">PTU Date Issued: ${data.ptuDateIssued || ""}</div>
              <div class="title" style="margin-top:8px;">X-READING</div>
            </div>

            <div class="line"></div>
            <table>
              <tr><td class="label">Report Date</td><td class="value">${data.reportDate || ""}</td></tr>
              <tr><td class="label">Report Time</td><td class="value">${data.reportTime || ""}</td></tr>
              <tr><td class="label">Start Date/Time</td><td class="value">${data.startDateTime || ""}</td></tr>
              <tr><td class="label">End Date/Time</td><td class="value">${data.endDateTime || ""}</td></tr>
              <tr><td class="label">Cashier</td><td class="value">${data.cashier || ""}</td></tr>
              <tr><td class="label">Beg. INV.</td><td class="value">${data.begOR || ""}</td></tr>
              <tr><td class="label">End INV.</td><td class="value">${data.endOR || ""}</td></tr>
            </table>

            <div class="line"></div>
            <div class="strong">PAYMENTS</div>
            <table>
              <tr><td class="label">Opening Fund</td><td class="value">${money(data.openingFund)}</td></tr>
              <tr><td class="label">Cash</td><td class="value">${money(data.cash)}</td></tr>
              <tr><td class="label">Cheque</td><td class="value">${money(data.cheque)}</td></tr>
              <tr><td class="label">Credit Card</td><td class="value">${money(data.creditCard)}</td></tr>
              <tr><td class="label">Other Payments</td><td class="value">${money(data.otherPayments)}</td></tr>
              <tr><td class="label strong">Total Payments</td><td class="value strong">${money(data.totalPayments)}</td></tr>
              <tr><td class="label">Void</td><td class="value">${money(data.void)}</td></tr>
              <tr><td class="label">Refund</td><td class="value">${money(data.refund)}</td></tr>
              <tr><td class="label">Withdrawal</td><td class="value">${money(data.withdrawal)}</td></tr>
            </table>

            <div class="line"></div>
            <div class="strong">SUMMARY</div>
            <table>
              <tr><td class="label">Cash In Drawer</td><td class="value">${money(data.summaryCashInDrawer)}</td></tr>
              <tr><td class="label">Cheque</td><td class="value">${money(data.summaryCheque)}</td></tr>
              <tr><td class="label">Credit Card</td><td class="value">${money(data.summaryCreditCard)}</td></tr>
              <tr><td class="label">Other Payments</td><td class="value">${money(data.summaryOtherPayments)}</td></tr>
              <tr><td class="label">Opening Fund</td><td class="value">${money(data.summaryOpeningFund)}</td></tr>
              <tr><td class="label">Withdrawal</td><td class="value">${money(data.summaryWithdrawal)}</td></tr>
              <tr><td class="label">Payments Received</td><td class="value">${money(data.summaryPaymentsReceived)}</td></tr>
              <tr><td class="label strong">Short / Over</td><td class="value strong">${money(data.summaryShortOver)}</td></tr>
            </table>
          </div>
        </body>
      </html>
    `;
  };

  const buildZPrintHtml = (data) => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Z Reading</title>
          ${commonPrintStyles}
        </head>
        <body>
          <div class="receipt">
            <div class="center">
              <div class="title">${data.corpName || ""}</div>
              <div class="subtitle">${data.businessUnitName || ""}</div>
              <div class="subtitle">${data.businessUnitAddress || ""}</div>
              <div class="subtitle">${data.tinLabel || ""}</div>
              <div class="subtitle">MIN: ${data.machineNumber || ""}</div>
              <div class="subtitle">S/N: ${data.serialNumber || ""}</div>
              <div class="subtitle">PTU No: ${data.ptuNumber || ""}</div>
              <div class="subtitle">PTU Date Issued: ${data.ptuDateIssued || ""}</div>
              <div class="title" style="margin-top:8px;">Z-READING</div>
            </div>

            <div class="line"></div>
            <table>
              <tr><td class="label">Date Issued</td><td class="value">${data.reportDate || ""}</td></tr>
              <tr><td class="label">Time</td><td class="value">${data.reportTime || ""}</td></tr>
              <tr><td class="label">Beg SI No.</td><td class="value">${data.begSI || ""}</td></tr>
              <tr><td class="label">End SI No.</td><td class="value">${data.endSI || ""}</td></tr>
              <tr><td class="label">Beg Void No.</td><td class="value">${data.begVoid || ""}</td></tr>
              <tr><td class="label">End Void No.</td><td class="value">${data.endVoid || ""}</td></tr>
              <tr><td class="label">Beg Return No.</td><td class="value">${data.begReturn || ""}</td></tr>
              <tr><td class="label">End Return No.</td><td class="value">${data.endReturn || ""}</td></tr>
              <tr><td class="label">Reset Counter No.</td><td class="value">${data.resetCounterNo || 0}</td></tr>
              <tr><td class="label">Z Counter No.</td><td class="value">${data.zCounterNo || 0}</td></tr>
            </table>

            <div class="line"></div>
            <table>
              <tr><td class="label">Present Accum. Sales</td><td class="value">${money(data.presentAccumulatedSales)}</td></tr>
              <tr><td class="label">Previous Accum. Sales</td><td class="value">${money(data.previousAccumulatedSales)}</td></tr>
              <tr><td class="label">Sales for the Day</td><td class="value">${money(data.salesForTheDay)}</td></tr>
            </table>

            <div class="line"></div>
            <div class="strong">BREAKDOWN OF SALES</div>
            <table>
              <tr><td class="label">VATable Sales</td><td class="value">${money(data.vatableSales)}</td></tr>
              <tr><td class="label">VAT Amount</td><td class="value">${money(data.vatAmount)}</td></tr>
              <tr><td class="label">VAT-Exempt Sales</td><td class="value">${money(data.vatExemptSales)}</td></tr>
              <tr><td class="label">VAT Exempt VAT</td><td class="value">${money(data.vatExemptVat)}</td></tr>
              <tr><td class="label">Zero-Rated Sales</td><td class="value">${money(data.zeroRatedSales)}</td></tr>
              <tr><td class="label">Other Charges</td><td class="value">${money(data.otherCharges)}</td></tr>
            </table>

            <div class="line"></div>
            <table>
              <tr><td class="label">Gross Amount</td><td class="value">${money(data.grossAmount)}</td></tr>
              <tr><td class="label">Less Discount</td><td class="value">${money(data.lessDiscount)}</td></tr>
              <tr><td class="label">Less Return</td><td class="value">${money(data.lessReturn)}</td></tr>
              <tr><td class="label">Less Void</td><td class="value">${money(data.lessVoid)}</td></tr>
              <tr><td class="label">Less VAT Adjustment</td><td class="value">${money(data.lessVatAdjustment)}</td></tr>
              <tr><td class="label strong">Net Amount</td><td class="value strong">${money(data.netAmount)}</td></tr>
            </table>

            <div class="line"></div>
            <div class="strong">DISCOUNT SUMMARY</div>
            <table>
              <tr><td class="label">SC Disc</td><td class="value">${money(data.scDisc)}</td></tr>
              <tr><td class="label">PWD Disc</td><td class="value">${money(data.pwdDisc)}</td></tr>
              <tr><td class="label">NAAC Disc</td><td class="value">${money(data.naacDisc)}</td></tr>
              <tr><td class="label">Solo Parent Disc</td><td class="value">${money(data.soloParentDisc)}</td></tr>
              <tr><td class="label">Other Disc</td><td class="value">${money(data.otherDisc)}</td></tr>
            </table>

            <div class="line"></div>
            <div class="strong">SALES ADJUSTMENT</div>
            <table>
              <tr><td class="label">Void</td><td class="value">${money(data.salesAdjustmentVoid)}</td></tr>
              <tr><td class="label">Return</td><td class="value">${money(data.salesAdjustmentReturn)}</td></tr>
            </table>

            <div class="line"></div>
            <div class="strong">VAT ADJUSTMENT</div>
            <table>
              <tr><td class="label">SC Trans VAT Adj</td><td class="value">${money(data.scTransVatAdj)}</td></tr>
              <tr><td class="label">PWD Trans VAT Adj</td><td class="value">${money(data.pwdTransVatAdj)}</td></tr>
              <tr><td class="label">Reg Disc Trans VAT Adj</td><td class="value">${money(data.regDiscTransVatAdj)}</td></tr>
              <tr><td class="label">Zero Rated Trans VAT Adj</td><td class="value">${money(data.zeroRatedTransVatAdj)}</td></tr>
              <tr><td class="label">VAT on Return</td><td class="value">${money(data.vatOnReturn)}</td></tr>
              <tr><td class="label">Other VAT Adjustments</td><td class="value">${money(data.otherVatAdjustments)}</td></tr>
            </table>

            <div class="line"></div>
            <div class="strong">TRANSACTION SUMMARY</div>
            <table>
              <tr><td class="label">Cash In Drawer</td><td class="value">${money(data.cashInDrawer)}</td></tr>
              <tr><td class="label">Cheque</td><td class="value">${money(data.cheque)}</td></tr>
              <tr><td class="label">Credit Card</td><td class="value">${money(data.creditCard)}</td></tr>
              <tr><td class="label">Other Payments</td><td class="value">${money(data.otherPayments)}</td></tr>
              <tr><td class="label">Opening Fund</td><td class="value">${money(data.openingFund)}</td></tr>
              <tr><td class="label">Less Withdrawal</td><td class="value">${money(data.lessWithdrawal)}</td></tr>
              <tr><td class="label">Payments Received</td><td class="value">${money(data.paymentsReceived)}</td></tr>
              <tr><td class="label strong">Short / Over</td><td class="value strong">${money(data.shortOver)}</td></tr>
            </table>
          </div>
        </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    if (!validate()) return;

    try {
      setIsPrinting(true);

      const isZReading = activeType === "z";
      const endpoint = isZReading ? zEndpoint : xEndpoint;

      const response = await fetch(`${apiHost}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          readingType: isZReading ? "Z" : "X",
          selectedCashier,
          cashDrawerAmount: Number(values.cashDrawerAmount || 0),
          verifyAmount: Number(values.verifyAmount || 0),
          categoryCode,
          unitCode,
          terminalNumber: terminalNumber || "1",
          corpName,
          shiftingDate: normalizedShiftDate,
          machineNumber: "10000000001",
          serialNumber: "20000000001",
          ptuNumber: "00000000-000-0000000-00000",
          ptuDateIssued: "01/01/2023",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load reading data.");
      }

      const payload = {
        ...result.data,
        corpName: result.data?.corpName || corpName,
        machineNumber: result.data?.machineNumber || "10000000001",
        serialNumber: result.data?.serialNumber || "20000000001",
        terminalNumber: result.data?.terminalNumber || terminalNumber || "1",
        ptuNumber: result.data?.ptuNumber || "00000000-000-0000000-00000",
        ptuDateIssued: result.data?.ptuDateIssued || "01/01/2023",
        summaryCashInDrawer: Number(values.cashDrawerAmount || 0),
        cashInDrawer: Number(values.cashDrawerAmount || 0),
      };

      const printHtml = isZReading
        ? buildZPrintHtml(payload)
        : buildXPrintHtml(payload);

      if (!printFrameRef.current) {
        const frame = document.createElement("iframe");
        frame.style.position = "fixed";
        frame.style.right = "0";
        frame.style.bottom = "0";
        frame.style.width = "0";
        frame.style.height = "0";
        frame.style.border = "0";
        frame.setAttribute("aria-hidden", "true");
        document.body.appendChild(frame);
        printFrameRef.current = frame;
      }

      const frameWindow = printFrameRef.current.contentWindow;
      const frameDocument =
        printFrameRef.current.contentDocument || frameWindow?.document;

      if (!frameDocument) {
        throw new Error("Unable to prepare print document.");
      }

      frameDocument.open();
      frameDocument.write(printHtml);
      frameDocument.close();

      setTimeout(async () => {
        try {
          frameWindow?.focus();
          frameWindow?.print();

          if (isZReading) {
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
          }
        } catch (error) {
          console.error("Print error:", error);
          alert("Unable to open the print dialog.");
        } finally {
          setIsPrinting(false);
        }
      }, 400);
    } catch (error) {
      console.error(error);
      alert(error.message || "Something went wrong while printing.");
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
          className="relative w-full max-w-4xl overflow-hidden rounded-[24px] border border-zinc-200 bg-[#e9eef7] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.20)]"
        >
          <button
            type="button"
            onClick={handleCloseAll}
            disabled={isPrinting || isCheckingBlockers}
            className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-zinc-600 shadow-sm transition hover:scale-105 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiX size={20} />
          </button>

          <div className="mx-auto max-w-3xl pt-6">
            <h2 className="text-center text-4xl font-extrabold tracking-tight text-[#37578d]">
              POS Reading
            </h2>

            <div className="mt-12 grid gap-8">
              <ReadingCard
                title="X-Reading"
                iconClassName="bg-sky-100 text-sky-600"
                onClick={() => handleOpenReading("x")}
                disabled={isPrinting || isCheckingBlockers}
              />

              <ReadingCard
                title="Z-Reading"
                iconClassName="bg-orange-100 text-orange-500"
                onClick={() => handleOpenReading("z")}
                disabled={isPrinting || isCheckingBlockers}
              />
            </div>

            <div className="mt-4 text-center text-sm text-zinc-500">
              {isCheckingBlockers
                ? "Checking pending transactions..."
                : normalizedShiftDate
                  ? `Shift Date: ${normalizedShiftDate}`
                  : "No shift date found."}
            </div>

            <div className="mt-16 flex justify-center">
              <button
                type="button"
                onClick={handleCloseAll}
                disabled={isPrinting || isCheckingBlockers}
                className="min-w-[290px] rounded-full bg-gradient-to-r from-pink-400 via-[#c5a9d9] to-cyan-400 px-10 py-4 text-2xl font-extrabold text-white shadow-[0_10px_30px_rgba(56,189,248,0.25)] transition hover:scale-[1.02] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cancel
              </button>
            </div>
          </div>

          <AnimatePresence>
            {activeType && (
              <motion.div
                className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="w-full max-w-lg rounded-[28px] bg-white p-7 shadow-[0_24px_70px_rgba(15,23,42,0.30)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
                        POS Reading
                      </div>
                      <h3 className="mt-1 text-3xl font-bold text-zinc-900">
                        {activeType === "x" ? "X-Reading" : "Z-Reading"}
                      </h3>
                      <p className="mt-2 text-sm text-zinc-500">
                        Enter the cash drawer amount and verify it before
                        printing.
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
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiX size={18} />
                    </button>
                  </div>

                  <div className="mt-6 space-y-5">
                    <AmountField
                      label="Cash Drawer Amount"
                      name="cashDrawerAmount"
                      value={values.cashDrawerAmount}
                      onChange={handleChange}
                      error={errors.cashDrawerAmount}
                    />

                    <AmountField
                      label="Verify Amount"
                      name="verifyAmount"
                      value={values.verifyAmount}
                      onChange={handleChange}
                      error={errors.verifyAmount}
                    />
                  </div>

                  <div className="mt-5 rounded-2xl bg-zinc-50 p-4">
                    <div className="flex items-center justify-between text-sm text-zinc-500">
                      <span>Difference</span>
                      <span
                        className={`font-semibold ${
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
                  </div>

                  <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (isPrinting) return;
                        setActiveType(null);
                        resetForm();
                      }}
                      disabled={isPrinting}
                      className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Back
                    </button>

                    <button
                      type="button"
                      onClick={handlePrint}
                      disabled={isPrinting}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#37578d] to-[#5aa7e6] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <FaPrint className="shrink-0" />
                      {isPrinting ? "Preparing Print..." : "Print Now"}
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

function AmountField({ label, name, value, onChange, error }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-zinc-700">
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
          placeholder="0.00"
          className={`h-14 w-full rounded-2xl border bg-white pl-10 pr-4 text-base text-zinc-800 outline-none transition ${
            error
              ? "border-rose-400 focus:border-rose-500"
              : "border-zinc-200 focus:border-sky-400"
          }`}
        />
      </div>
      {error ? <p className="mt-2 text-sm text-rose-500">{error}</p> : null}
    </div>
  );
}
