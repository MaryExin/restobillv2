"use client";
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { FiXCircle, FiCreditCard, FiCheck, FiList } from "react-icons/fi";
import ModalYesNoReusable from "./ModalYesNoReusable";
import { yearMonthday } from "../../constants/DateConstants";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalMultipleClearing = ({
  setIsModalClearing,
  chartOfAccountsData,
  clearingReferences, // Array with reference, amount, busunitcode, payeecode
  handleClearing,
  suppliersData,
  setSupplierSlCode,
  isPcfParticulars,
  setSelectedReferencesclear,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const [isYesNoModalOpen, setYesNoModalOpen] = useState(false);

  // Single payment form fields
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

  console.log(clearingReferences);

  // Add this new state after the existing states
  const [mainBusUnitCode, setMainBusUnitCode] = useState("");

  // Selected references state - now includes busunitcode, amount, payeecode
  // FIX: Add unique identifier for each reference
  const [selectedReferences, setSelectedReferences] = useState(
    clearingReferences.map((ref, index) => ({
      ...ref,
      uniqueId: ref.id || `ref-${index}`, // Create unique identifier
      selected: true,
      // Ensure all required fields are present
      amount: ref.amount || 0,
      busunitcode: ref.busunitcode || "",
      name: ref.name || "",
      payeecode: ref.payeecode || "",
      reference: ref.reference || "",
      description: ref.description || "",
    }))
  );

  const amountRef = useRef(null);
  const checkNoRef = useRef(null);

  // Disable Mouse Wheel to change the amount
  useEffect(() => {
    const inputEl = amountRef.current;
    if (!inputEl) return;

    function disableWheel(e) {
      e.preventDefault();
    }

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

    inputEl.addEventListener("wheel", disableWheel, { passive: false });
    return () => {
      inputEl.removeEventListener("wheel", disableWheel);
    };
  }, []);

  // Set supplier SL code based on payee codes (using first selected reference's payeecode)
  useEffect(() => {
    const firstSelectedRef = selectedReferences.find((ref) => ref.selected);
    if (firstSelectedRef?.payeecode) {
      if (isPcfParticulars === "For-Replenish") {
        setSupplierSlCode(40099);
      } else {
        const selected = suppliersData.find(
          (item) => item.supplier_code === firstSelectedRef.payeecode
        );
        setSupplierSlCode(selected?.slcode ?? "");
      }
    }
  }, [selectedReferences, isPcfParticulars, suppliersData, setSupplierSlCode]);

  // Calculate total amount from selected references
  const getTotalAmountToClear = () => {
    return selectedReferences
      .filter((ref) => ref.selected)
      .reduce((total, ref) => total + Number.parseFloat(ref.amount || 0), 0);
  };

  // Get unique payee codes from selected references
  const getUniquePayeeCodes = () => {
    const selectedRefs = selectedReferences.filter((ref) => ref.selected);
    return [
      ...new Set(selectedRefs.map((ref) => ref.payeecode).filter(Boolean)),
    ];
  };

  // Get unique business unit codes from selected references - FIXED
  const getUniqueBusUnitCodes = () => {
    const selectedRefs = selectedReferences.filter((ref) => ref.selected);
    const uniqueBusUnits = [];
    const seenCodes = new Set();

    selectedRefs.forEach((ref) => {
      if (ref.busunitcode && !seenCodes.has(ref.busunitcode)) {
        seenCodes.add(ref.busunitcode);
        uniqueBusUnits.push({
          busunitcode: ref.busunitcode,
          name: ref.name, // Use name if available, otherwise use code
        });
      }
    });

    return uniqueBusUnits;
  };

  useEffect(() => {
    const totalAmount = getTotalAmountToClear();
    if (amount >= 0) {
      if (totalAmount - Number.parseFloat(amount).toFixed(2) !== 0) {
        setStatus("Partial");
      } else {
        setStatus("Paid");
      }
    }
  }, [amount, selectedReferences]);

  useEffect(() => {
    if (paymentType && paymentType === "POSTDATED CHECK") {
      setIsPosdatedCheck(true);
    } else {
      setIsPosdatedCheck(false);
    }
  }, [paymentType]);

  // Add this useEffect after the existing useEffects - FIXED
  useEffect(() => {
    const uniqueBusUnits = getUniqueBusUnitCodes();
    if (uniqueBusUnits.length > 0 && !mainBusUnitCode) {
      setMainBusUnitCode(uniqueBusUnits[0].busunitcode); // Set first business unit code as default
    }
  }, [selectedReferences, mainBusUnitCode]);

  // FIX: Toggle reference selection using uniqueId
  const toggleReferenceSelection = (uniqueId) => {
    setSelectedReferences((prev) =>
      prev.map((ref) =>
        ref.uniqueId === uniqueId ? { ...ref, selected: !ref.selected } : ref
      )
    );
  };

  // Select/Deselect all references
  const toggleAllReferences = () => {
    const allSelected = selectedReferences.every((ref) => ref.selected);
    setSelectedReferences((prev) =>
      prev.map((ref) => ({ ...ref, selected: !allSelected }))
    );
  };

  const handleReset = () => {
    setSLCode("");
    setSLDescription("");
    setPdcSLCode("");
    setPdcSLDescription("");
    setAmount(0.0);
    setParticulars("");
    setPaymentReference("");
    setPaymentType("");
    setPaymentDate(yearMonthday);
    setStatus("");
    setIsPosdatedCheck(false);
    setTransactionDate(yearMonthday);
    setSelectedReferencesclear([]);
    setMainBusUnitCode(""); // Add this line
  };

  const handleSubmission = () => {
    const selectedRefs = selectedReferences.filter((ref) => ref.selected);
    const totalAmountToClear = getTotalAmountToClear();

    if (selectedRefs.length === 0) {
      alert("Please select at least one reference to clear");
      return;
    }

    if (!mainBusUnitCode) {
      alert("Please select a main business unit for the payment");
      return;
    }

    if (
      isPosdatedCheck &&
      Number.parseFloat(amount).toFixed(2) - totalAmountToClear !== 0
    ) {
      alert("Partial postdated check is not supported");
      return;
    }

    if (Number.parseFloat(amount).toFixed(2) > totalAmountToClear) {
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
        // Create array of clearing data for all selected references
        const clearingArray = selectedRefs.map((ref) => {
          // Calculate proportional amount for each reference
          const proportionalAmount = (ref.amount / totalAmountToClear) * amount;

          return {
            disbursementReference: ref.reference,
            amount: proportionalAmount,
            totalAmount: amount,
            payment_reference: paymentReference,
            payment_type: paymentType,
            transaction_date: transactionDate,
            payment_date: paymentDate,
            slCode: isPosdatedCheck ? 40098 : slCode,
            slDescription,
            particulars,
            status,
            supplierCode: ref.payeecode,
            busunitcode: mainBusUnitCode, // Use the selected main business unit for all
            originalBusUnitCode: ref.busunitcode, // Keep original for reference
            pdcSLCode,
            pdcSLDescription,
          };
        });

        // Send the entire array to handleClearing
        handleClearing(clearingArray);
        // console.log("Clearing Data  Array:", clearingArray);
        handleReset();

        setIsModalClearing(false);
      } else {
        alert("Fields should not be empty");
      }
    }
  };

  const selectedCount = selectedReferences.filter((ref) => ref.selected).length;
  const totalAmountToClear = getTotalAmountToClear();
  const uniquePayeeCodes = getUniquePayeeCodes();
  const uniqueBusUnitCodes = getUniqueBusUnitCodes();

  // Helper function to get the display name for a business unit
  const getBusUnitDisplayName = (busunitcode) => {
    const busUnit = uniqueBusUnitCodes.find(
      (unit) => unit.busunitcode === busunitcode
    );
    return busUnit?.name || busunitcode;
  };

  return (
    <>
      <div className="h-screen w-screen bg-zinc-800 bg-opacity-50 fixed py-24 top-0 left-0 z-10">
        <div className="flex justify-center items-start lg:ms-10 lg:px-10 h-full">
          <div className="w-full md:w-4/5 lg:w-3/4 scale-90 lg:scale-100">
            <div className="flex flex-col bg-slate-50 rounded-xl shadow-2xl h-[80vh] overflow-y-auto scrollbar">
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
                    Bulk Clearing Payment
                  </h1>
                  <span className="px-2 py-1 text-xs text-white bg-colorBrand rounded-full">
                    {selectedCount} of {clearingReferences.length} selected
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg space-y-7">
                  {/* References Selection */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h2 className="text-lg font-semibold text-zinc-600 flex items-center gap-2">
                        <FiList size={20} />
                        Clearing References
                      </h2>
                      <motion.button
                        onClick={toggleAllReferences}
                        className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
                        whileHover={{ scale: 1.02 }}
                      >
                        {selectedReferences.every((ref) => ref.selected)
                          ? "Deselect All"
                          : "Select All"}
                      </motion.button>
                    </div>

                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="p-3 text-left">Select</th>
                            <th className="p-3 text-left">Reference</th>
                            <th className="p-3 text-left">Description</th>
                            <th className="p-3 text-left">Payee Code</th>
                            <th className="p-3 text-left">Bus Unit</th>
                            <th className="p-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedReferences.map((ref, index) => (
                            <motion.tr
                              key={ref.uniqueId}
                              className={`border-t hover:bg-gray-50 ${
                                ref.selected ? "bg-blue-50" : ""
                              }`}
                              whileHover={{ backgroundColor: "#f9fafb" }}
                            >
                              <td className="p-3">
                                <motion.div
                                  className={`w-5 h-5 rounded border-2 cursor-pointer flex items-center justify-center ${
                                    ref.selected
                                      ? "bg-colorBrand border-colorBrand text-white"
                                      : "border-gray-300"
                                  }`}
                                  onClick={() =>
                                    toggleReferenceSelection(ref.uniqueId)
                                  }
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  {ref.selected && <FiCheck size={12} />}
                                </motion.div>
                              </td>
                              <td className="p-3 font-medium">
                                {ref.reference}
                              </td>
                              <td className="p-3 text-gray-600">
                                {ref.description || "N/A"}
                              </td>
                              <td className="p-3 text-gray-600">
                                {ref.payeecode || "N/A"}
                              </td>
                              <td className="p-3 text-gray-600">
                                {ref.name || ref.busunitcode || "N/A"}
                              </td>
                              <td className="p-3 text-right font-medium">
                                ₱
                                {Number.parseFloat(
                                  ref.amount || 0
                                ).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Selected Summary */}
                    <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-blue-700">
                          Selected References: {selectedCount}
                        </span>
                        <span className="text-blue-700 font-semibold">
                          Total: ₱
                          {totalAmountToClear.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      {/* Show unique payee codes and business units */}
                      {selectedCount > 0 && (
                        <div className="text-xs text-blue-600 space-y-1">
                          <div>
                            <strong>Payee Codes:</strong>{" "}
                            {uniquePayeeCodes.length > 0
                              ? uniquePayeeCodes.join(", ")
                              : "None"}
                          </div>
                          <div>
                            <strong>Business Units:</strong>{" "}
                            {uniqueBusUnitCodes.length > 0
                              ? uniqueBusUnitCodes
                                  .map((unit) => unit.name)
                                  .join(", ")
                              : "None"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Main Business Unit Selection */}
                  {selectedCount > 0 && uniqueBusUnitCodes.length > 1 && (
                    <div className="space-y-4">
                      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                        <h3 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
                          <FiList size={16} />
                          Select Main Business Unit for Payment
                        </h3>
                        <p className="text-sm text-yellow-700 mb-3">
                          Multiple business units detected. Please select which
                          business unit will accommodate this payment.
                        </p>
                        <div className="w-full">
                          <label className="text-xs text-yellow-700 font-medium">
                            Main Business Unit
                          </label>
                          <select
                            value={mainBusUnitCode}
                            onChange={(e) => setMainBusUnitCode(e.target.value)}
                            className="border border-yellow-300 text-sm pt-3 pb-2 px-5 block w-full bg-white cursor-pointer focus:outline-none focus:border-yellow-500 rounded"
                          >
                            <option value="" disabled>
                              Select main business unit...
                            </option>
                            {uniqueBusUnitCodes.map((busUnit, index) => (
                              <option key={index} value={busUnit.busunitcode}>
                                {busUnit.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {mainBusUnitCode && (
                          <div className="mt-2 text-xs text-yellow-600">
                            <strong>Selected:</strong>{" "}
                            {getBusUnitDisplayName(mainBusUnitCode)} will be
                            used for all payment entries
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Show single business unit info when only one exists */}
                  {selectedCount > 0 && uniqueBusUnitCodes.length === 1 && (
                    <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700">
                        <FiCheck size={16} />
                        <span className="text-sm font-medium">
                          Single Business Unit:{" "}
                          <strong>{uniqueBusUnitCodes[0].name}</strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Transaction Date */}
                  <div className="relative z-0 mb-7">
                    <input
                      type="date"
                      name="transactiondate"
                      value={transactionDate}
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
                              (items) => items.slcode === e.target.value
                            );
                            setPdcSLDescription(chart[0]?.sl_description || "");
                          }}
                          className="border text-sm pt-3 pb-2 px-5 block w-full bg-white cursor-pointer focus:outline-none"
                        >
                          <option value="" disabled hidden></option>
                          {chartOfAccountsData
                            .sort((a, b) =>
                              a.sl_description.localeCompare(b.sl_description)
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
                            (items) => items.slcode === e.target.value
                          );
                          setSLDescription(chart[0]?.sl_description || "");
                        }}
                        className="border text-sm pt-3 pb-2 px-5 block w-full bg-white cursor-pointer focus:outline-none"
                      >
                        <option value="" disabled hidden></option>
                        {chartOfAccountsData
                          .sort((a, b) =>
                            a.sl_description.localeCompare(b.sl_description)
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
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
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
                      value={paymentDate}
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
                      Total Payment Amount
                    </label>
                  </div>

                  {/* Auto-fill button for total amount */}
                  <div className="flex justify-center">
                    <motion.button
                      onClick={() => setAmount(totalAmountToClear)}
                      className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
                      whileHover={{ scale: 1.02 }}
                    >
                      Pay Full Amount (₱
                      {totalAmountToClear.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      )
                    </motion.button>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end">
                    <motion.button
                      onClick={() => setYesNoModalOpen(true)}
                      className="px-5 py-2 bg-gradient-to-br from-colorBrand via-colorBrandSecondary to-colorBrandTertiary text-white rounded hover:scale-95 transition"
                      whileHover={{ scale: 1.02 }}
                      disabled={selectedCount === 0}
                    >
                      Pay {selectedCount} Reference
                      {selectedCount !== 1 ? "s" : ""}
                    </motion.button>
                  </div>

                  <h1>Balance due:</h1>
                  {/* Balance Highlight */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                    className="flex items-center mt-4 bg-white border-2 border-colorBrand shadow-lg text-white px-4 py-2 rounded-lg w-auto mx-auto space-x-3"
                  >
                    <FiCreditCard
                      className="text-softPrimary animate-pulse"
                      size={20}
                    />
                    <span className="text-softPrimary">
                      ₱
                      {totalAmountToClear.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-softPrimary">-</span>
                    <span className="text-softPrimary">
                      {Number.parseFloat(amount || 0).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}
                    </span>
                    <span className="text-softPrimary">=</span>
                    <span className="text-softPrimary font-semibold">
                      ₱
                      {(
                        totalAmountToClear - Number.parseFloat(amount || 0)
                      ).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </motion.div>

                  {/* Detailed Breakdown */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-zinc-600 mb-3">
                      Payment Breakdown
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Selected References:</span>
                        <span className="font-medium">{selectedCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Amount Due:</span>
                        <span className="font-medium">
                          ₱
                          {totalAmountToClear.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Payment Amount:</span>
                        <span className="font-medium">
                          ₱
                          {Number.parseFloat(amount || 0).toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span>Status:</span>
                        <span
                          className={`font-medium ${
                            status === "Paid"
                              ? "text-green-600"
                              : "text-orange-600"
                          }`}
                        >
                          {status || "Pending"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Unique Payees:</span>
                        <span className="font-medium">
                          {uniquePayeeCodes.length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Source Business Units:</span>
                        <span className="font-medium">
                          {uniqueBusUnitCodes.length}
                        </span>
                      </div>
                      {mainBusUnitCode && (
                        <div className="flex justify-between bg-blue-50 -mx-2 px-2 py-1 rounded">
                          <span className="font-medium text-blue-700">
                            Main Business Unit:
                          </span>
                          <span className="font-medium text-blue-700">
                            {getBusUnitDisplayName(mainBusUnitCode)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message={`Are you sure you want to pay ${selectedCount} clearing reference${
            selectedCount !== 1 ? "s" : ""
          } with a total amount of ₱${Number.parseFloat(
            amount || 0
          ).toLocaleString()}? This will affect ${
            uniquePayeeCodes.length
          } payee(s) from ${
            uniqueBusUnitCodes.length
          } business unit(s) and will be processed under main business unit: ${getBusUnitDisplayName(
            mainBusUnitCode
          )}.`}
          setYesNoModalOpen={setYesNoModalOpen}
          triggerYesNoEvent={handleSubmission}
        />
      )}
    </>
  );
};

export default ModalMultipleClearing;
