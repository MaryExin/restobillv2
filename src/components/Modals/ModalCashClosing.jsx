import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { HiCash, HiCalculator, HiX } from "react-icons/hi";
import { LinearProgress } from "@mui/material";
import ModalYesNoReusable from "./ModalYesNoReusable";
import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalCashClosing = ({
  setIsModalIsCashClosing,
  branchSelected,
  salesSummaryData,
  cashTrackerData,
  giftCertificatesData,
  mopsummaryData,
  resetSales,
  resetQueries,
  setIsNewTransaction,
  readPettyCashFundMutate,
  readPettyCashFundIsLoading,
  readPettyCashFundData,
  paidCreditSalesData,
  selectedPOS,
  setReturnmessage,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const [cashCount, setCashCount] = useState(0);
  const [cashOpeningBal, setCashOpeningBal] = useState(0);
  const [netSalesBal, setNetSalesBal] = useState(0);
  const [otherMopBal, setOtherMopBal] = useState(0);
  const [otherExpenses, setOtherExpenses] = useState(0);
  const [paidCreditSales, setPaidCreditSales] = useState(0);
  const [isYesNoModalOpen, setYesNoModalOpen] = useState(false);

  // Compute balances
  useEffect(() => {
    if (cashTrackerData?.length) {
      const fd = cashTrackerData.filter((i) => i.poscode === selectedPOS);
      if (fd.length) setCashOpeningBal(fd[0].cash_opening_balance);
    }
    if (salesSummaryData?.length) {
      const fs = salesSummaryData.filter((i) => i.poscode === selectedPOS);
      setNetSalesBal(fs.reduce((acc, t) => acc + t.net_sales + t.total_vat, 0));
      setOtherMopBal(fs.reduce((acc, t) => acc + t.total_other_mop, 0));

      console.log(salesSummaryData);
    }
  }, [salesSummaryData, cashTrackerData, selectedPOS]);

  // Fetch petty cash
  useEffect(() => {
    if (cashTrackerData) {
      const fd = cashTrackerData.filter((i) => i.poscode === selectedPOS);
      if (fd.length)
        readPettyCashFundMutate({ cashtransid: fd[0].cash_trans_id });
    }
  }, [cashTrackerData, selectedPOS]);

  useEffect(() => {
    if (readPettyCashFundData) {
      const total = readPettyCashFundData.reduce((acc, t) => acc + t.amount, 0);
      setOtherExpenses(total);
    }
  }, [readPettyCashFundData]);

  useEffect(() => {
    if (paidCreditSalesData) {
      const fs = paidCreditSalesData.filter((i) => i.poscode === selectedPOS);
      setPaidCreditSales(fs.reduce((acc, t) => acc + t.amount, 0));
    }
  }, [paidCreditSalesData, selectedPOS]);

  // Mutations
  const {
    data: cashClosingData,
    isLoading: cashClosingIsLoading,
    isError: cashClosingIsError,
    isSuccess: cashClosingIsSuccess,
    mutate: cashClosingMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MUTATE_CASH_ENDING_ENDPOINT,
    "PATCH"
  );

  const handleSubmission = () => {
    const fd = cashTrackerData.filter((i) => i.poscode === selectedPOS);
    if (fd.length) {
      const id = fd[0].cash_trans_id;
      const ending =
        cashOpeningBal +
        netSalesBal +
        paidCreditSales -
        otherMopBal -
        otherExpenses;
      const variance = cashCount - ending;
      cashClosingMutate({
        cashclosing: parseFloat(ending).toFixed(2),
        cashcount: parseFloat(cashCount).toFixed(2),
        variance: parseFloat(variance).toFixed(2),
        cashtrackingid: id,
        busunitcode: branchSelected,
      });
    } else console.error("No matching cashTrackerData for POS");
  };

  useEffect(() => {
    if (cashClosingData?.message === "Success") {
      // alert("Cash closing successful");
      setReturnmessage({
        choose: "success",
        message: "Cash closing successful",
      });
      resetSales();
      resetQueries();
      // setIsNewTransaction(false);
      setIsModalIsCashClosing(false);
    }
  }, [cashClosingData]);

  // Computed values
  const ending =
    cashOpeningBal +
    netSalesBal +
    paidCreditSales -
    otherMopBal -
    otherExpenses;
  const variance = cashCount - ending;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-5 lg:px-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl lg:mt-10 shadow-xl w-full max-w-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex justify-between  items-center bg-gradient-to-br from-colorBrand to-colorBrandSecondary p-4">
            <h2 className="text-white text-lg font-semibold flex items-center space-x-2">
              <HiCash className="w-6 h-6" />
              <span>Cash Closing</span>
            </h2>
            <button
              onClick={() => {
                setIsModalIsCashClosing(false);
                resetSales();
              }}
            >
              <HiX className="w-6 h-6 text-white hover:text-gray-200" />
            </button>
          </div>

          {/* Loading */}
          {(cashClosingIsLoading || readPettyCashFundIsLoading) && (
            <LinearProgress color="success" />
          )}

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Summary Table */}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-colorBrandLighter">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                    Description
                  </th>
                  <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-2 text-gray-800">Cash Opening</td>
                  <td className="px-4 py-2 text-right">
                    ₱{cashOpeningBal.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-800">
                    Gross Sales (net discount)
                  </td>
                  <td className="px-4 py-2 text-right">
                    ₱{netSalesBal.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-800">Paid Credit Sales</td>
                  <td className="px-4 py-2 text-right">
                    ₱{paidCreditSales.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-800">Other MOP</td>
                  <td className="px-4 py-2 text-right">
                    ₱{otherMopBal.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-800">Other Expenses</td>
                  <td className="px-4 py-2 text-right">
                    ₱{otherExpenses.toFixed(2)}
                  </td>
                </tr>
                <tr className="bg-gray-100">
                  <td className="px-4 py-2 font-semibold">Cash Ending</td>
                  <td className="px-4 py-2 text-right font-semibold">
                    ₱{ending.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Count & Variance */}
            <table className="min-w-full divide-y divide-gray-200 mt-4">
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-2 text-gray-800">Total Cash Count</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      onWheel={(e) => e.target.blur()}
                      onChange={(e) => setCashCount(+e.target.value)}
                      className="w-full border border-gray-200 rounded-lg p-2 focus:ring-colorBrand"
                      placeholder="0.00"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-800">Variance</td>
                  <td className="px-4 py-2 text-right">
                    ₱{variance.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Submit */}
            <div className="flex justify-end">
              <button
                onClick={() => setYesNoModalOpen(true)}
                className="inline-flex items-center px-6 py-2 bg-gradient-to-br from-colorBrand to-colorBrandSecondary text-white rounded-full shadow hover:shadow-lg transition"
              >
                <HiCalculator className="w-5 h-5 mr-2" />
                Submit
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Confirmation Modal */}
      {isYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirm Cash Closing"
          message="Proceed with submitting your cash closing?"
          setYesNoModalOpen={setYesNoModalOpen}
          triggerYesNoEvent={handleSubmission}
        />
      )}
    </>
  );
};

export default ModalCashClosing;
