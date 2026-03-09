import React, { useEffect, useState } from "react";
import {
  HiX,
  HiPlus,
  HiTrash,
  HiIdentification,
  HiDocumentText,
  HiCash,
} from "react-icons/hi";
import { motion } from "framer-motion";
import ModalYesNoReusable from "./ModalYesNoReusable";
import { LinearProgress } from "@mui/material";
import Dropdown from "../Dropdown/Dropdown";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalPettyCash = ({
  setIsModalPettyCash,
  chartOfAccountsData,
  pettyCashFundMutate,
  cashTrackerData,
  readPettyCashFundMutate,
  readPettyCashFundIsLoading,
  readPettyCashFundData,
  pettyCashFundIsLoading,
  deletePettyCashFundMutate,
  resetSales,
  branchSelected,
  selectedPOS,
  setReturnmessage,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const [isYesNoModalOpen, setYesNoModalOpen] = useState(false);
  const [isDeleteYesNoModalOpen, setDeleteYesNoModalOpen] = useState(false);
  const [isNewTransaction, setIsNewTransaction] = useState(false);

  const [slCode, setSLCode] = useState("");
  const [slDescription, setSLDescription] = useState("");
  const [glCode, setGLCode] = useState("");
  const [reference, setReference] = useState("");
  const [particulars, setParticulars] = useState("");
  const [amount, setAmount] = useState(0);

  const [transactionId, setTransactionId] = useState(null);

  // Load existing petty cash fund
  useEffect(() => {
    if (cashTrackerData?.[0]?.cash_trans_id) {
      readPettyCashFundMutate({
        cashtransid: cashTrackerData[0].cash_trans_id,
      });
    }
  }, []);

  const handleReset = () => {
    setSLCode("");
    setSLDescription("");
    setGLCode("");
    setReference("");
    setParticulars("");
    setAmount(0);
    setIsNewTransaction(false);
  };

  const handleSubmission = () => {
    if (slCode && glCode && reference && particulars && amount > 0) {
      pettyCashFundMutate({
        slcode: slCode,
        glcode: glCode,
        particulars,
        amount,
        reference,
        cashtransid: cashTrackerData[0].cash_trans_id,
        busunit: branchSelected,
      });
      handleReset();
    } else {
      // alert("Fields should not be empty");
      setReturnmessage({
        choose: "error",
        message: "Fields should not be empty",
      });
    }
  };

  const handleDelete = () => {
    deletePettyCashFundMutate({ id: transactionId });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 px-3">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-br from-colorBrand to-colorBrandSecondary p-4">
            <h2 className="text-white text-lg font-semibold">Petty Cash</h2>
            <button
              onClick={() => {
                setIsModalPettyCash(false);
                resetSales();
              }}
            >
              <HiX className="w-6 h-6 text-white hover:text-gray-200" />
            </button>
          </div>

          {/* Loading Bar */}
          {(pettyCashFundIsLoading || readPettyCashFundIsLoading) && (
            <LinearProgress color="success" />
          )}

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Title & New Button */}
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-semibold text-zinc-700">
                Disbursements
              </h3>
              <button
                onClick={() => setIsNewTransaction(true)}
                className="flex items-center space-x-1 bg-colorBrandLighter text-colorBrand px-3 py-1 rounded-full hover:bg-[#f9d2cd] transition"
              >
                <HiPlus className="w-5 h-5" />
                <span className="text-sm font-medium">New</span>
              </button>
            </div>

            {/* New Transaction Form */}
            {isNewTransaction && (
              <div className="bg-[#f8f8f8] p-4 rounded-lg space-y-4 shadow">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Account */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <HiIdentification className="inline w-4 h-4 mr-1 text-colorBrand" />
                      Account
                    </label>
                    <Dropdown
                      label={""}
                      value={slDescription}
                      isRequired={false}
                      optionsList={chartOfAccountsData}
                      optionsField01={"slcode"}
                      optionsField02={"sl_description"}
                      concatID={true}
                      allowCustom={false}
                      onChange={(selectedID, selectedValue, e) => {
                        setSLCode(selectedID), setSLDescription(selectedValue);
                        const rec = chartOfAccountsData.find(
                          (c) => c.slcode === selectedID
                        );
                        setGLCode(rec?.glcode || "");
                      }}
                    />
                    {/* <select
                      value={slCode}
                      onChange={(e) => {
                        setSLCode(e.target.value);
                        const rec = chartOfAccountsData.find(
                          (c) => c.slcode === e.target.value
                        );
                        setGLCode(rec?.glcode || "");
                      }}
                      className="w-full border border-gray-200 rounded-lg p-2 focus:ring-colorBrand"
                    >
                      <option value="" disabled hidden>
                        Select…
                      </option>
                      {chartOfAccountsData
                        .sort((a, b) =>
                          a.sl_description.localeCompare(b.sl_description)
                        )
                        .map((c) => (
                          <option key={c.slcode} value={c.slcode}>
                            {c.sl_description}
                          </option>
                        ))}
                    </select> */}
                  </div>
                  {/* Reference */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <HiDocumentText className="inline w-4 h-4 mr-1 text-colorBrand" />
                      Reference
                    </label>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg p-2 focus:ring-colorBrand"
                      placeholder="Ref #"
                    />
                  </div>
                </div>

                {/* Particulars */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Particulars
                  </label>
                  <textarea
                    rows={2}
                    value={particulars}
                    onChange={(e) => setParticulars(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-2 focus:ring-colorBrand"
                    placeholder="Details…"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    <HiCash className="inline w-4 h-4 mr-1 text-colorBrand" />
                    Amount
                  </label>
                  <input
                    type="number"
                    onWheel={(e) => e.target.blur()}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-2 focus:ring-colorBrand"
                    placeholder="0.00"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setYesNoModalOpen(true)}
                    className="px-4 py-2 bg-gradient-to-br from-colorBrand to-colorBrandSecondary text-white rounded-lg hover:shadow-lg transition"
                  >
                    Submit
                  </button>
                </div>
              </div>
            )}

            {/* Existing Transactions Table */}
            <div className="overflow-auto bg-white rounded-md shadow-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-colorBrandLighter">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Account
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Reference
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Particulars
                    </th>
                    <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                      Amount
                    </th>
                    <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                      Delete
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {readPettyCashFundData?.map((pcf, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {pcf.sl_description}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {pcf.reference}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {pcf.particulars}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-center">
                        ₱{pcf.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <HiTrash
                          className="inline w-5 h-5 text-red-500 hover:text-red-700 cursor-pointer"
                          onClick={() => {
                            setTransactionId(pcf.seq);
                            setDeleteYesNoModalOpen(true);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Confirm Add */}
      {isYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirm Submission"
          message="Proceed with this disbursement?"
          setYesNoModalOpen={setYesNoModalOpen}
          triggerYesNoEvent={handleSubmission}
        />
      )}

      {/* Confirm Delete */}
      {isDeleteYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirm Deletion"
          message="Delete this transaction?"
          setYesNoModalOpen={setDeleteYesNoModalOpen}
          triggerYesNoEvent={handleDelete}
        />
      )}
    </>
  );
};

export default ModalPettyCash;
