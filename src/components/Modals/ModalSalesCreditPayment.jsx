import React, { useEffect, useRef, useState } from "react";
import {
  HiX,
  HiCash,
  HiCreditCard,
  HiCalendar,
  HiIdentification,
} from "react-icons/hi";
import { motion } from "framer-motion";
import ModalYesNoReusable from "./ModalYesNoReusable";
import useCustomQuery from "../../hooks/useCustomQuery";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalSalesCreditPayment = ({
  setIsModalSalesClearing,
  chartOfAccountsData,
  clearingReference,
  handleClearing,
  totalAmountToClear,
  resetSales,
  customerName,
  customerId,
  busunitCode,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const [isYesNoModalOpen, setYesNoModalOpen] = useState(false);
  const [slCode, setSLCode] = useState("");
  const [clearingCode, setClearingCode] = useState("");
  const [clearingDescription, setClearingDescription] = useState("");
  const [slDescription, setSLDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [particulars, setParticulars] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [status, setStatus] = useState("");
  const [withHoldingTaxRate, setWithHoldingTaxRate] = useState(0);
  const [atc, setAtc] = useState("");
  const [isWithHoldingTax, setIsWithHoldingTax] = useState(false);
  const [withHoldingTaxAmount, setWithHoldingTaxAmount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [firstamount, setfirstamount] = useState(0);

  const checkRef = useRef(null);

  // Disable Mouse Wheel to change the amount

  useEffect(() => {
    const inputEl = checkRef.current;
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
    if (amount >= 0) {
      setStatus(
        totalAmountToClear -
          (parseFloat(amount) + parseFloat(withHoldingTaxAmount)).toFixed(2) !==
          0
          ? "Partial"
          : "Paid"
      );
    }
    if (isTyping) {
      setAtc("");
      setWithHoldingTaxAmount(0);
      setfirstamount(amount);
      setIsTyping(false); // reset
    }
  }, [amount]);

  useEffect(() => {
    setAmount(firstamount);
    setWithHoldingTaxAmount(0);
  }, [atc]);

  useEffect(() => {
    if (isWithHoldingTax || atc) {
      setWithHoldingTaxAmount(
        (parseFloat(amount) * withHoldingTaxRate).toFixed(2)
      );
      console.log(withHoldingTaxRate);
    }
  }, [isWithHoldingTax, atc]);

  useEffect(() => {
    if (withHoldingTaxAmount) {
      const whtx = (parseFloat(amount) * withHoldingTaxRate).toFixed(2);

      setAmount((parseFloat(amount) - parseFloat(whtx)).toFixed(2));
    }
  }, [withHoldingTaxAmount]);

  const handleReset = () => {
    setSLCode("");
    setSLDescription("");
    setAmount(0);
    setParticulars("");
    setPaymentReference("");
    setPaymentType("");
    setPaymentDate("");
    setStatus("");
    setWithHoldingTaxAmount(0);
    setWithHoldingTaxRate(0);
    setAtc("");
    setIsWithHoldingTax(false);
  };

  const handleSubmission = () => {
    if (
      (slCode || paymentType === "POSTDATED CHECK") &&
      (slDescription || paymentType === "POSTDATED CHECK") &&
      particulars &&
      amount > 0 &&
      paymentReference &&
      paymentType &&
      paymentDate
    ) {
      handleClearing(
        clearingReference,
        amount,
        paymentReference,
        paymentType,
        paymentDate,
        paymentType === "POSTDATED CHECK" ? 12099 : slCode,
        slDescription,
        customerName,
        customerId,
        busunitCode,
        particulars,
        status,
        atc,
        withHoldingTaxAmount,
        clearingCode,
        clearingDescription
      );
      handleReset();
      setIsModalSalesClearing(false);
    } else {
      alert("Fields should not be empty");
    }
  };

  const {
    data: atcData,
    isLoading: atcIsLoading,
    isError: atcIsError,
    isSuccess: atcIsSuccess,
    refetch: atcRefetch,
  } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_PARAMS_ATC_TAX_CODE_ENDPOINT
  );
  const [distinctTaxRates, setDistinctTaxRates] = useState([]);

  useEffect(() => {
    if (atcIsSuccess && atcData) {
      // Map through all ATC data and convert taxrate to decimal
      const allDataWithDecimalTaxRate = atcData.map((item) => ({
        ...item,
        taxrates: parseFloat(item.taxrate) / 100, // Convert taxrate to decimal
      }));
      // console.log(allDataWithDecimalTaxRate);
      // Update the state with the full dataset
      setDistinctTaxRates(allDataWithDecimalTaxRate);
    }
  }, [atcData, atcIsSuccess]);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-3 ">
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="bg-white hadow-xl w-full max-w-lg lg:mt-[10vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-br  from-colorBrand to-colorBrandSecondary p-4 ">
            <h2 className="text-white text-lg font-semibold">
              Clearing Transaction
            </h2>
            <button
              onClick={() => setIsModalSalesClearing(false)}
              className="text-white hover:text-gray-200"
            >
              <HiX className="w-6 h-6" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
            {/* Reference & Amount */}
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <HiIdentification className="w-5 h-5 text-colorBrand" />
                <span className="font-medium">Ref:</span>
                <span className="font-semibold">{clearingReference}</span>
              </div>
              <div className="flex items-center space-x-2 text-xl">
                <HiCash className="w-6 h-6 text-softPrimary" />
                <span className="font-semibold">
                  ₱{totalAmountToClear.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="bg-[#f8f7f5] p-4 rounded-lg space-y-4 ">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <HiCash className="inline w-4 h-4 mr-1 text-colorBrand" />
                  Payment Type
                </label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-colorBrand"
                >
                  <option value="" disabled hidden>
                    Select type
                  </option>
                  <option value="CASH">CASH</option>
                  <option value="DATED CHECK">DATED CHECK</option>
                  <option value="ONLINE TRANSFER">ONLINE TRANSFER</option>
                  <option value="POSTDATED CHECK">POSTDATED CHECK</option>
                </select>
              </div>
              {/* Account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <HiCreditCard className="inline w-4 h-4 mr-1 text-colorBrand" />
                  Account
                </label>

                {paymentType !== "POSTDATED CHECK" ? (
                  <select
                    value={slCode}
                    onChange={(e) => {
                      setSLCode(e.target.value);
                      const chart = chartOfAccountsData.find(
                        (c) => c.slcode === e.target.value
                      );
                      setSLDescription(chart?.sl_description || "");
                    }}
                    className="w-full border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-colorBrand"
                  >
                    <option value="" disabled hidden>
                      Select account
                    </option>
                    {chartOfAccountsData
                      ?.filter((c) =>
                        ["100", "110"].includes(c.slcode.slice(0, 3))
                      )
                      .sort((a, b) =>
                        a.sl_description.localeCompare(b.sl_description)
                      )
                      .map((c, i) => (
                        <option key={i} value={c.slcode}>
                          {c.sl_description}
                        </option>
                      ))}
                  </select>
                ) : (
                  <>
                    <h1 className="w-full rounded-md p-3 bg-gray-200">
                      ACCOUNTS RECEIVABLE - PDCS
                    </h1>

                    <select
                      value={clearingCode}
                      onChange={(e) => {
                        setClearingCode(e.target.value);
                        const chart = chartOfAccountsData.find(
                          (c) => c.slcode === e.target.value
                        );
                        setClearingDescription(chart?.sl_description || "");
                      }}
                      className="mt-5 w-full border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-colorBrand"
                    >
                      <option value="" disabled hidden>
                        Select account
                      </option>
                      {chartOfAccountsData
                        .filter((c) =>
                          ["100", "110"].includes(c.slcode.slice(0, 3))
                        )
                        .sort((a, b) =>
                          a.sl_description.localeCompare(b.sl_description)
                        )
                        .map((c, i) => (
                          <option key={i} value={c.slcode}>
                            {c.sl_description}
                          </option>
                        ))}
                    </select>
                  </>
                )}
              </div>

              {/* {slDescription && (
                  <p className="text-xs text-gray-500 mt-1">{slDescription}</p>
                )} */}

              {/* Payment Type & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <HiIdentification className="inline w-4 h-4 mr-1 text-colorBrand" />
                    Check or Payment ref No.
                  </label>
                  <input
                    type="number"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-colorBrand"
                    placeholder="Enter reference"
                    ref={checkRef}
                  />
                </div>
              </div>

              {/* Date & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <HiCalendar className="inline w-4 h-4 mr-1 text-colorBrand" />
                    {paymentType === "POSTDATED CHECK"
                      ? "Postdate Checkdate"
                      : "Payment Date"}
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-colorBrand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <HiCash className="inline w-4 h-4 mr-1 text-colorBrand" />
                    Amount to Clear
                  </label>
                  <input
                    type="number"
                    onWheel={(e) => e.target.blur()}
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setIsTyping(true);
                    }}
                    className="w-full border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-colorBrand"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Particular */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <HiCreditCard className="inline w-4 h-4 mr-1 text-colorBrand" />
                  Particulars
                </label>
                <textarea
                  value={particulars}
                  onChange={(e) => setParticulars(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-colorBrand"
                  rows={3}
                  placeholder="Enter details..."
                />
              </div>

              <div className="w-full">
                <select
                  onChange={(e) => {
                    const selectedOption = e.target.value
                      ? JSON.parse(e.target.value)
                      : { atc: "", taxrate: 0, taxrates: 0 }; // Set default as blank or 0
                    setAtc(selectedOption.atc);
                    setWithHoldingTaxRate(selectedOption.taxrates);
                  }}
                  className="bg-white pt-3 pb-2 px-5 block w-full rounded-lg mt-0  appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200"
                >
                  {/* Blank Option */}
                  <option
                    value={JSON.stringify({
                      atc: "",
                      taxrate: 0,
                      taxrates: 0,
                    })}
                    selected
                  >
                    Select an option for ATC
                  </option>

                  {distinctTaxRates.map((option, index) => (
                    <option
                      key={index}
                      value={JSON.stringify({
                        atc: option.atc,
                        taxrate: option.taxrate,
                        taxrates: option.taxrates,
                      })}
                    >
                      {option.atc} - {option.taxrate}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative z-0 mb-7">
                <input
                  type="number"
                  onWheel={(e) => e.target.blur()}
                  name="withHoldingTaxAmount"
                  value={withHoldingTaxAmount}
                  placeholder=" "
                  autoComplete="off"
                  className="bg-white pt-3 pb-2 px-5 block w-full rounded-lg mt-0  appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200"
                  onChange={(e) => setWithHoldingTaxAmount(e.target.value)}
                />
                <label
                  htmlFor="withHoldingTaxAmount"
                  className="absolute duration-300 top-3 z-1 origin-0 text-gray-500"
                >
                  Withholding tax
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  handleReset();
                  resetSales();
                  setIsModalSalesClearing(false);
                }}
                className="px-5 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => setYesNoModalOpen(true)}
                className="px-5 py-2 bg-gradient-to-br from-colorBrand to-colorBrandSecondary text-white rounded-lg hover:shadow-lg transition"
              >
                Save
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {isYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirm Clearing"
          message="Proceed with payment clearing?"
          setYesNoModalOpen={setYesNoModalOpen}
          triggerYesNoEvent={handleSubmission}
        />
      )}
    </>
  );
};

export default ModalSalesCreditPayment;
