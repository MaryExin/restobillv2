import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import ModalYesNoReusable from "./ModalYesNoReusable";
import { LinearProgress, setRef } from "@mui/material";
import Toast from "../Toasts/Toast";
import Dropdown from "../Dropdown/Dropdown";
import useCustomQuery from "../../hooks/useCustomQuery";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalDisbursements = ({
  setIsModalDisbursements,
  chartOfAccountsData,
  busunitSelected,
  payee,
  suppliersData,
  handleTransaction,
  yearMonthday,
  handleDelete,
  particulars,
  reference,
  setReference,
  supplierTotal,
  transactionClass,
  transactionDate,
  setSupplierSlCode,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const [isYesNoModalOpen, setYesNoModalOpen] = useState(false);
  const [isDeleteYesNoModalOpen, setDeleteYesNoModalOpen] = useState(false);
  const [slCode, setSLCode] = useState("");
  const [supplierCode, setSupplierCode] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [slDescription, setSLDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [taxType, setTaxType] = useState("");
  const [VATABLEAmount, setVATABLEAmount] = useState(0);
  const [isComputeTax, setIsComputeTax] = useState(false);
  const [withHoldingTaxRate, setWithHoldingTaxRate] = useState(0);
  const [atc, setAtc] = useState("");
  const [isWithHoldingTax, setIsWithHoldingTax] = useState(false);
  const [withHoldingTaxAmount, setWithHoldingTaxAmount] = useState(0);
  const [modalParticulars, setModalParticulars] = useState("");
  const [isVatLocked, setIsVatLocked] = useState(false);

  const [transactionId, setTransactionId] = useState(0);
  const { userId, roles } = useZustandLoginCred();
  useEffect(() => {
    if (supplierTotal !== "") {
      setAmount(supplierTotal);
    }
    setSupplierCode(payee);
  }, []);

  useEffect(() => {
    if (suppliersData) {
      const selected = suppliersData.find(
        (item) => item.supplier_code === supplierCode,
      );

      setSupplierSlCode(selected?.slcode ?? "");
    }
  }, [supplierCode, payee]);

  useEffect(() => {
    setModalParticulars(particulars);
  }, [particulars]);

  // useEffect(() => {
  //   // alert(payee);

  //   setSupplierCode(payee);

  //   const rate = suppliersData.filter((items) => items.supplier_code === payee);

  //   setWithHoldingTaxRate(rate[0].whtx_rate);

  //   setAtc(rate[0].atc);
  // }, [payee]);

  const hasManualComputation = () => {
  return roles?.[0]?.some(
    (item) => item.rolename === "DISBURSEMENT-MANUAL-COMPUTATION"
  );
};


useEffect(() => {
  if (isComputeTax) {

    // ✅ ADD THIS LINE ONLY
    if (hasManualComputation()) return;

    if (taxType === "VATABLE") {
      setVATABLEAmount(((parseFloat(amount) / 1.12) * 0.12).toFixed(2));
      setAmount((parseFloat(amount) / 1.12).toFixed(2));
    }

    setIsVatLocked(true);
  }
}, [isComputeTax]);



  useEffect(() => {
    if (isWithHoldingTax || atc) {
      setWithHoldingTaxAmount(
        (parseFloat(amount) * withHoldingTaxRate).toFixed(2),
      );
      console.log(withHoldingTaxRate);
    }
  }, [isWithHoldingTax, atc]);

  const handleReset = () => {
    setSLCode("");
    setAmount(0);
    setTaxType("");
    setIsComputeTax(false);
    setVATABLEAmount(0);
    setWithHoldingTaxAmount(0);
    setWithHoldingTaxRate(0);
    setAtc("");
    setIsWithHoldingTax(false);
    setModalParticulars("");
    setSLDescription("");
    setIsVatLocked(false);
  };

  const handleSubmission = () => {
    if (
      slCode !== "" &&
      slDescription !== "" &&
      particulars !== "" &&
      amount !== 0 &&
      payee !== "" &&
      busunitSelected !== "" &&
      VATABLEAmount !== "" &&
      withHoldingTaxAmount !== ""
    ) {
      handleTransaction(
        transactionDate,
        slCode,
        slDescription,
        amount,
        transactionClass,
        modalParticulars.toUpperCase(),
        supplierCode,
        busunitSelected,
        "Unpaid",
        taxType,
        VATABLEAmount,
        withHoldingTaxAmount,
        reference,
        withHoldingTaxRate,
        atc,
      );

      handleReset();
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
      import.meta.env.VITE_PARAMS_ATC_TAX_CODE_ENDPOINT,
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
      <div className="h-screen w-screen bg-zinc-800 z-10 bg-opacity-50 fixed top-0 left-0">
        <div className="flex flex-row justify-center lg:ms-10  lg:px-10 pt-10 h-screen z-20 bg-opacity-100">
          <div className="flex flex-col justify-center w-full md:w-1/2">
            <div className="scale-90 lg:scale-100  flex flex-col lg:mt-5 h-auto pb-5 shadow-2xl  overflow-y-auto scrollbar rounded-xl bg-slate-50 z-20">
              <div className="flex flex-row relative justify-center text-white w-full  bg-gradient-to-br from-colorBrand to-colorBrandTertiary rounded-t-xl p-1">
                {/* Header  */}
                <div
                  onClick={() => {
                    setIsModalDisbursements(false);
                  }}
                  className="cursor-pointer absolute right-2 top-2 hover:scale-105 duration-300"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-10 h-10"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <motion.div
                  className="flex flex-row justify-center"
                  initial={{ opacity: 0, scale: 0, rotate: -180 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-10 h-10 text-white"
                  >
                    <path d="M4.5 3.75a3 3 0 00-3 3v.75h21v-.75a3 3 0 00-3-3h-15z" />
                    <path
                      fillRule="evenodd"
                      d="M22.5 9.75h-21v7.5a3 3 0 003 3h15a3 3 0 003-3v-7.5zm-18 3.75a.75.75 0 01.75-.75h6a.75.75 0 010 1.5h-6a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z"
                      clipRule="evenodd"
                    />
                  </svg>
                </motion.div>
              </div>

              <div className="w-full h-3">
                {/* {(pettyCashFundIsLoading || readPettyCashFundIsLoading) && (
                  <LinearProgress color="success" />
                )} */}
              </div>

              {/* Main Form */}

              <div className="flex flex-col space-y-5 py-5 px-5 lg:px-12">
                <div className="relative z-0 mb-5 w-full">
                  <div className="flex flex-row justify-between">
                    <h1 className="font-semibold text-2xl text-zinc-600 mb-3">
                      Disbursements transaction
                    </h1>
                  </div>

                  {/* Disbursements Transaction */}

                  <div className="flex flex-col space-y-4 w-full bg-colorBrandLighter p-3 mt-3 rounded-lg mb-3">
                    {/* slCodes */}
                    <div className="w-full">
                      <div className="">
                        <label className="text-xs text-zinc-600">Account</label>
                        <Dropdown
                          label={""}
                          value={slDescription}
                          isRequired={false}
                          optionsList={chartOfAccountsData}
                          optionsField01={"slcode"}
                          optionsField02={"sl_description"}
                          concatID={true}
                          allowCustom={false}
                          onChange={(selectedID, selectedValue) => {
                            (setSLCode(selectedID),
                              setSLDescription(selectedValue));
                          }}
                        />
                        {/* <select
                          value={slCode}
                          onChange={(e) => {
                            setSLCode(e.target.value);

                            const chartClone = [...chartOfAccountsData];
                            const chart = chartClone.filter(
                              (items) => items.slcode === e.target.value
                            );

                            setSLDescription(chart[0].sl_description);
                          }}
                          className="text-sm pt-3 pb-2 px-5 block w-full rounded-lg bg-white z-1 focus:outline-none cursor-pointer"
                        >
                          <option value="" selected disabled hidden></option>
                          {Array.isArray(chartOfAccountsData) &&
                            chartOfAccountsData
                              .sort((a, b) =>
                                a.sl_description.localeCompare(b.sl_description)
                              )
                              .map((slCode, index) => (
                                <option key={index} value={slCode.slcode}>
                                  {`${slCode.sl_description} | ${slCode.slcode}`}
                                </option>
                              ))}
                        </select> */}
                      </div>
                    </div>

                    {/* Supplier */}
                    <div className="w-full">
                      <div className="">
                        <label className="text-xs text-zinc-600">Payee</label>
                        <select
                          // value={supplierCode}
                          onChange={(e) => {
                            setSupplierCode(e.target.value);

                            const rate = suppliersData.filter(
                              (items) => items.supplier_code === e.target.value,
                            );

                            // setWithHoldingTaxRate(rate[0].whtx_rate);
                            // setAtc(rate[0].atc);
                          }}
                          className="text-sm pt-3 pb-2 px-5 block w-full rounded-lg bg-white z-1 focus:outline-none cursor-pointer"
                        >
                          <option value="" disabled hidden></option>
                          {suppliersData &&
                            suppliersData.map((supplier, index) => (
                              <option
                                key={index}
                                value={supplier.supplier_code}
                                selected={
                                  supplier.supplier_code === payee
                                    ? true
                                    : false
                                }
                              >
                                {`${supplier.supplier_name} | Whtx - ${
                                  supplier.whtx_rate * 100
                                }% `}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {/* Reference */}
                    <div className="relative z-0 mb-7">
                      <input
                        type="text"
                        name="reference"
                        defaultValue={reference}
                        placeholder=" "
                        autoComplete="off"
                        className="bg-white pt-3 pb-2 px-5 block w-full rounded-lg mt-0  appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200"
                      />
                      <label
                        htmlFor="reference"
                        className="absolute duration-300 top-3 z-1 origin-0 text-gray-500"
                      >
                        Reference
                      </label>
                    </div>

                    {/* Particulars */}
                    <div className="relative z-0 mb-7">
                      <textarea
                        type="text"
                        name="particulars"
                        value={modalParticulars}
                        placeholder=" "
                        autoComplete="off"
                        className="bg-white pt-3 pb-2 px-5 block w-full rounded-lg mt-0  appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200"
                        onChange={(e) => setModalParticulars(e.target.value)}
                      />
                      <label
                        htmlFor="particulars"
                        className="absolute duration-300 top-3 z-1 origin-0 text-gray-500"
                      >
                        Particulars
                      </label>
                    </div>

                    {/* VATABLE or Non VATABLE */}
                    <div className="w-full">
                      <div className="">
                        <label className="text-xs text-zinc-600">
                          Tax type
                        </label>
                        <select
                          value={taxType}
                          onChange={(e) => {
                            if (e.target.value === "VAT EXEMPT") {
                              setVATABLEAmount(0);
                              setIsComputeTax(false);
                            }
                            setTaxType(e.target.value);
                          }}
                          className="text-sm pt-3 pb-2 px-5 block w-full rounded-lg bg-white z-1 focus:outline-none cursor-pointer"
                        >
                          <option value="" selected disabled hidden></option>
                          <option value="VATABLE">VATABLE</option>
                          <option value="VAT EXEMPT">VAT EXEMPT</option>
                        </select>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="relative z-0 mb-7">
                      <input
                        type="number"
                        onWheel={(e) => e.target.blur()}
                        name="amount"
                        value={amount}
                        placeholder=" "
                        autoComplete="off"
                        className="bg-white pt-3 pb-2 px-5 block w-full rounded-lg mt-0  appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200"
                        onChange={(e) => {
                          if (e.target.value === "") {
                            setIsComputeTax(false);
                            setAmount("");
                            setVATABLEAmount(0);
                          } else {
                            setAmount(e.target.value);
                          }
                        }}
                        onBlur={() => setIsComputeTax(true)}
                      />
                      <label
                        htmlFor="amount"
                        className="absolute duration-300 top-3 z-1 origin-0 text-gray-500"
                      >
                        Gross amount (Include VAT if Vatable)
                      </label>
                    </div>

                    <div className="relative z-0 mb-7">
                      <input
                        type="number"
                        onWheel={(e) => e.target.blur()}
                        name="VATABLEamount"
                        value={VATABLEAmount}
                        placeholder=" "
                        autoComplete="off"
                        className="bg-white pt-3 pb-2 px-5 block w-full rounded-lg mt-0  appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200"
                        onChange={(e) => setVATABLEAmount(e.target.value)}
                      />
                      <label
                        htmlFor="VATABLEamount"
                        className="absolute duration-300 top-3 z-1 origin-0 text-gray-500"
                      >
                        VAT Amount
                      </label>
                    </div>

                    {/* <div className="flex flex-row space-x-2">
                      <input
                        onChange={(e) => {
                          e.target.checked
                            ? setIsWithHoldingTax(true)
                            : setIsWithHoldingTax(
                                false,
                                setWithHoldingTaxAmount(0)
                              );
                        }}
                        type="checkbox"
                        checked={isWithHoldingTax}
                      />
                      <p>Deduct withholding tax?</p>
                    </div> */}
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
                        onChange={(e) =>
                          setWithHoldingTaxAmount(e.target.value)
                        }
                      />
                      <label
                        htmlFor="withHoldingTaxAmount"
                        className="absolute duration-300 top-3 z-1 origin-0 text-gray-500"
                      >
                        Withholding tax
                      </label>
                    </div>

                    <div className="flex flex-row space-x-2 self-end">
                      <button
                        type="submit"
                        className="px-5 py-2 text-white bg-gradient-to-br from-colorBrand to-colorBrandTertiary rounded-sm shadow-darkPrimary hover:scale-95 duration-300 cursor-pointer"
                        onClick={() => handleSubmission()}
                      >
                        Add
                      </button>
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
          header={"Confirmation"}
          message={"Select yes to proceed or no to exit"}
          setYesNoModalOpen={setYesNoModalOpen}
          triggerYesNoEvent={handleSubmission}
        />
      )}

      {isDeleteYesNoModalOpen && (
        <ModalYesNoReusable
          header={"Confirmation"}
          message={"Select yes to proceed or no to exit"}
          setYesNoModalOpen={setDeleteYesNoModalOpen}
          triggerYesNoEvent={handleDelete}
        />
      )}
    </>
  );
};

export default ModalDisbursements;
