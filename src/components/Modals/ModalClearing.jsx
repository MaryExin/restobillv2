import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { FiXCircle, FiCreditCard } from "react-icons/fi";

import ModalYesNoReusable from "./ModalYesNoReusable";
import { LinearProgress } from "@mui/material";
import Toast from "../Toasts/Toast";
import { yearMonthday } from "../../constants/DateConstants";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalClearing = ({
  setIsModalClearing,
  chartOfAccountsData,
  clearingReference,
  handleClearing,
  totalAmountToClear,
  clearingPayeeCode,
  busunitcode,
  suppliersData,
  setSupplierSlCode,
  isPcfParticulars,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const [isYesNoModalOpen, setYesNoModalOpen] = useState(false);
  const [slCode, setSLCode] = useState("");
  const [slDescription, setSLDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [particulars, setParticulars] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [paymentDate, setPaymentDate] = useState(yearMonthday);
  const [status, setStatus] = useState("");
  const [transactionDate, setTransactionDate] = useState(yearMonthday);
  const [isPosdatedCheck, setIsPosdatedCheck] = useState(false);
  const [pdcSLCode, setPdcSLCode] = useState("");
  const [pdcSLDescription, setPdcSLDescription] = useState("");

  const amountRef = useRef(null);
  const checkNoRef = useRef(null);

  // Disable Mouse Wheel to change the amount

  useEffect(() => {
    const inputEl = amountRef.current;
    if (!inputEl) return;

    function disableWheel(e) {
      e.preventDefault();
    }

    // Attach native listener with passive: false
    inputEl.addEventListener("wheel", disableWheel, { passive: false });
    return () => {
      inputEl.removeEventListener("wheel", disableWheel);
    };
  }, []);

  useEffect(() => {
    const inputEl = checkNoRef.current;
    if (!inputEl) return;

    function disableWheel(e) {
      e.preventDefault();
    }

    // Attach native listener with passive: false
    inputEl.addEventListener("wheel", disableWheel, { passive: false });
    return () => {
      inputEl.removeEventListener("wheel", disableWheel);
    };
  }, []);

  useEffect(() => {
    if (clearingPayeeCode) {
      if (isPcfParticulars === "For-Replenish") {
        setSupplierSlCode(40099);
      } else {
        const selected = suppliersData.find(
          (item) => item.supplier_code === clearingPayeeCode,
        );
        setSupplierSlCode(selected?.slcode ?? "");
      }
    }
  }, [clearingPayeeCode]);

  useEffect(() => {
    if (amount >= 0) {
      if (totalAmountToClear - parseFloat(amount).toFixed(2) !== 0) {
        setStatus("Partial");
      } else {
        setStatus("Paid");
      }
    }
  }, [amount]);

  useEffect(() => {
    if (paymentType && paymentType === "POSTDATED CHECK") {
      setIsPosdatedCheck(true);
    } else {
      setIsPosdatedCheck(false);
    }
  }, [paymentType]);

  const handleReset = () => {
    setSLCode(0);
    setSLDescription("");
    setPdcSLCode(0);
    setPdcSLDescription("");
    setAmount(0.0);
    setParticulars("");
    setPaymentReference("");
    setPaymentType("");
    setPaymentDate("");
    setStatus("");
    setIsPosdatedCheck(false);
  };

  const handleSubmission = () => {
    if (
      isPosdatedCheck &&
      parseFloat(amount).toFixed(2) - totalAmountToClear !== 0
    ) {
      alert("Partial postdated check is not supported");
      return;
    }

    if (parseFloat(amount).toFixed(2) > totalAmountToClear) {
      alert("Amount to pay should not be greater than total Payable");
    } else {
      if (
        isPosdatedCheck
          ? true
          : slCode !== "" &&
            slDescription !== "" &&
            particulars !== "" &&
            amount !== 0 &&
            paymentReference !== "" &&
            paymentType !== "" &&
            paymentDate !== ""
      ) {
        handleClearing(
          clearingReference,
          amount,
          paymentReference,
          paymentType,
          transactionDate,
          paymentDate,
          isPosdatedCheck ? 40098 : slCode,
          slDescription,
          particulars,
          status,
          clearingPayeeCode, //Supplier Code or Clearing if PCF Transaction
          busunitcode,
          pdcSLCode,
          pdcSLDescription,
        );
        handleReset();
        setIsModalClearing(false);
      } else {
        alert("Fields should not be empty");
      }
    }
  };

  return (
    <>
      <div className="h-screen w-screen bg-zinc-800 bg-opacity-50 fixed py-24 top-0 left-0 z-10">
        <div className="flex justify-center items-start lg:ms-10 lg:px-10 h-full">
          <div className="w-full md:w-1/2 scale-90 lg:scale-100 ">
            <div className="flex flex-col bg-slate-50 rounded-xl shadow-2xl h-[80vh]  overflow-y-auto scrollbar">
              {/* Header */}
              <div className="relative flex justify-center items-center bg-gradient-to-br from-colorBrand to-colorBrandSecondary rounded-t-xl p-5 text-white">
                <motion.div
                  onClick={() => setIsModalClearing(false)}
                  className="absolute right-4 top-4 cursor-pointer hover:scale-110 transition"
                  whileHover={{ rotate: 90 }}
                >
                  <FiXCircle size={28} />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <FiCreditCard size={48} />
                </motion.div>
              </div>

              {/* Main Form */}
              <div className="p-5 lg:px-12 space-y-5">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-semibold text-zinc-600">
                    Clearing transaction
                  </h1>
                  <span className="px-2 py-1 text-xs text-white bg-colorBrand rounded-full">
                    {clearingReference}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg space-y-7">
                  {/* Transaction Date */}
                  <div className="relative z-0 mb-7">
                    <input
                      type="date"
                      name="transactiondate"
                      defaultValue={transactionDate}
                      onChange={(e) => setTransactionDate(e.target.value)}
                      className="bg-white border pt-3 pb-2 px-5 block w-full appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200"
                    />
                    <label
                      htmlFor="transactiondate"
                      className="absolute duration-300 top-3 origin-0 text-gray-500"
                    >
                      Transaction Date
                    </label>
                  </div>

                  {/* Payment Type */}
                  <div className="w-full">
                    <label className="text-xs text-zinc-600">
                      Payment type
                    </label>
                    <select
                      value={paymentType}
                      onChange={(e) => setPaymentType(e.target.value)}
                      className="border text-sm pt-3 pb-2 px-5 block w-full bg-white cursor-pointer focus:outline-none"
                    >
                      <option value="" disabled hidden></option>
                      <option value="CASH">CASH</option>
                      <option value="DATED CHECK">DATED CHECK</option>
                      <option value="POSTDATED CHECK">POSTDATED CHECK</option>
                      <option value="BANK TRANSFER">BANK TRANSFER</option>
                    </select>
                  </div>

                  {/* ACCOUNT OR PDCS */}

                  {isPosdatedCheck ? (
                    <>
                      <div className="w-full">
                        <h1 className="py-2 border px-5 bg-slate-200">
                          ACCOUNTS PAYABLE - PDCs
                        </h1>
                      </div>

                      <div className="w-full">
                        <label className="text-xs text-zinc-600">
                          Bank Check issued
                        </label>
                        <select
                          value={pdcSLCode}
                          onChange={(e) => {
                            setPdcSLCode(e.target.value);
                            const chartClone = [...chartOfAccountsData];
                            const chart = chartClone.filter(
                              (items) => items.slcode === e.target.value,
                            );
                            setPdcSLDescription(chart[0].sl_description);
                          }}
                          className="border text-sm pt-3 pb-2 px-5 block w-full bg-white cursor-pointer focus:outline-none"
                        >
                          <option value="" disabled hidden></option>
                          {chartOfAccountsData
                            .sort((a, b) =>
                              a.sl_description.localeCompare(b.sl_description),
                            )
                            .map((sl, i) => (
                              <option key={i} value={sl.slcode}>
                                {sl.sl_description}
                              </option>
                            ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <div className="w-full">
                      <label className="text-xs text-zinc-600">Account</label>
                      <select
                        value={slCode}
                        onChange={(e) => {
                          setSLCode(e.target.value);
                          const chartClone = [...chartOfAccountsData];
                          const chart = chartClone.filter(
                            (items) => items.slcode === e.target.value,
                          );
                          setSLDescription(chart[0].sl_description);
                        }}
                        className="border text-sm pt-3 pb-2 px-5 block w-full bg-white cursor-pointer focus:outline-none"
                      >
                        <option value="" disabled hidden></option>
                        {chartOfAccountsData
                          .sort((a, b) =>
                            a.sl_description.localeCompare(b.sl_description),
                          )
                          .map((sl, i) => (
                            <option key={i} value={sl.slcode}>
                              {sl.sl_description}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {/* Payment Reference */}
                  <div className="relative z-0 mb-7">
                    <input
                      type="number"
                      name="reference"
                      defaultValue={paymentReference}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9-]/g, "");
                        setPaymentReference(value);
                      }}
                      className="bg-transparent pt-3 pb-2 px-5 block w-full rounded-lg appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border border-gray-200"
                      ref={checkNoRef}
                    />
                    <label
                      htmlFor="reference"
                      className="absolute duration-300 top-3 origin-0 text-gray-500"
                    >
                      Check or payment ref No.
                    </label>
                  </div>

                  {/* Payment Date */}
                  <div className="relative z-0 mb-7">
                    <input
                      type="date"
                      name="paymentdate"
                      defaultValue={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="bg-white border pt-3 pb-2 px-5 block w-full appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200"
                    />
                    <label
                      htmlFor="paymentdate"
                      className="absolute duration-300 top-3 origin-0 text-gray-500"
                    >
                      {isPosdatedCheck
                        ? "Postdated Check Date"
                        : "Payment Date"}
                    </label>
                  </div>

                  {/* Particulars */}
                  <div className="relative z-0 mb-7">
                    <textarea
                      name="particulars"
                      value={particulars}
                      onChange={(e) => setParticulars(e.target.value)}
                      className="border bg-transparent pt-3 pb-2 px-5 block w-full appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200"
                    />
                    <label
                      htmlFor="particulars"
                      className="absolute duration-300 top-3 origin-0 text-gray-500"
                    >
                      Particulars
                    </label>
                  </div>

                  {/* Amount */}
                  <div className="relative z-0 mb-7">
                    <input
                      type="number"
                      onWheel={(e) => e.target.blur()}
                      name="amount"
                      value={amount}
                      onChange={(e) =>
                        setAmount(e.target.value === "" ? "" : e.target.value)
                      }
                      ref={amountRef}
                      className="border bg-white pt-3 pb-2 px-5 block w-full rounded-lg appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200"
                    />
                    <label
                      htmlFor="amount"
                      className="absolute duration-300 top-3 origin-0 text-gray-500"
                    >
                      Amount to Clear
                    </label>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end">
                    <motion.button
                      onClick={() => setYesNoModalOpen(true)}
                      className="px-5 py-2 bg-gradient-to-br from-colorBrand via-colorBrandSecondary to-colorBrandTertiary text-white rounded hover:scale-95 transition"
                      whileHover={{ scale: 1.02 }}
                    >
                      Save
                    </motion.button>
                  </div>

                  <h1>Balance due:</h1>
                  {/* Balance Highlight */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                    className="flex items-center mt-4 bg-white border-2 border-colorBrand shadow-lg text-white px-4 py-2 rounded-lg w-auto mx-auto space-x-3 "
                  >
                    <FiCreditCard
                      className="text-softPrimary animate-pulse"
                      size={20}
                    />
                    <span className=" text-softPrimary">
                      ₱
                      {totalAmountToClear.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-softPrimary">-</span>
                    <span className=" text-softPrimary">
                      {parseFloat(amount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-softPrimary">=</span>
                    <span className="text-softPrimary font-semibold ">
                      ₱
                      {(totalAmountToClear - parseFloat(amount)).toLocaleString(
                        undefined,
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                      )}
                    </span>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Select yes to proceed or no to exit"
          setYesNoModalOpen={setYesNoModalOpen}
          triggerYesNoEvent={handleSubmission}
        />
      )}
    </>
  );
};

export default ModalClearing;
