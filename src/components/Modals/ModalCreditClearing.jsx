import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { array } from "zod";
import { useCustomSecuredMutation } from "../../hooks/useCustomSecuredMutation";
import ModalYesNoReusable from "./ModalYesNoReusable";
import { parseMutationArgs, useQueryClient } from "@tanstack/react-query";
import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import { LinearProgress } from "@mui/material";
import useCustomInfiniteQuery from "../../hooks/useCustomInfiniteQuery";
import useCustomQuery from "../../hooks/useCustomQuery";
import ModalSalesCreditPayment from "./ModalSalesCreditPayment";
import { useReactToPrint } from "react-to-print";
import ModalPrintInvoice from "./ModalPrintInvoice";
import { HiCreditCard, HiX } from "react-icons/hi";
import { HiSearch, HiPrinter, HiTrash } from "react-icons/hi";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const formatToShortDate = (inputDate) => {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const dateParts = inputDate.split("-");
  const year = dateParts[0];
  const monthIndex = parseInt(dateParts[1], 10) - 1; // Adjust month index to 0-based
  const day = dateParts[2];

  const formattedDate = `${months[monthIndex]} ${day}`;
  return formattedDate;
};

const ModalCreditClearing = ({
  setIsModalCreditClearing,
  branchSelected,
  busunits,
  resetSales,
  selectedPOS,
  setReturnmessage,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const [isYesNoModalOpen, setYesNoModalOpen] = useState(false);
  const [isModalSalesClearing, setIsModalSalesClearing] = useState(false);
  const [isModalPrint, setIsModalPrint] = useState(false);

  const [clearingReference, setClearingReference] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [busunitCode, setBusUnitCode] = useState("");

  const [totalAmountToClear, setTotalAmountToClear] = useState(0);

  const [mopId, setMopId] = useState("");

  const [searchParams, setSearchParams] = useState("");
  const [clearingTab, setClearingTab] = useState("");

  const [minFilter, setMinFilter] = useState(0);
  const [maxFilter, setMaxFilter] = useState(30);

  const [isSalesid, setIsSalesid] = useState(null);

  const queryClient = useQueryClient();

  // PRINTING HOOK
  const componentRef = useRef();

  // useReactToPrint hook
  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    // onAfterPrint: () => setIsModalYesNoSubmit(false),
  });

  const ComponentToPrint = React.forwardRef(({ text }, ref) => {
    return (
      <div ref={ref} className="flex flex-col px-1 w-full justify-center pt-2 ">
        <div className="w-full  px-5">{text}</div>
      </div>
    );
  });

  const handleSubmission = () => {
    updateCreditSalesMutate({
      moptransid: mopId,
    });
  };

  // Query BusUnits | Stores for role checking
  const {
    data: chartOfAccountsMap,
    isLoading: chartOfAccountsMapIsLoading,
    isError: chartOfAccountsMapIsError,
    isSuccess: chartOfAccountsMapIsSuccess,
    refetch: chartOfAccountsMapRefetch,
  } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_PARAMS_CHART_MAP_DATA_READ_ENDPOINT,
    "chartofaccountsmap"
  );

  const {
    data: chartOfAccountsData,
    isLoading: chartOfAccountsIsLoading,
    isError: chartOfAccountsIsError,
    isSuccess: chartOfAccountsIsSuccess,
    mutate: chartOfAccountsMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_FILTERED_CHART_OF_ACCOUNTS_READ_DATA_MUTATION,
    "POST"
  );

  // Filtered chart per selected busunit

  useEffect(() => {
    if (branchSelected) {
      //Get Filtered Chart of Accounts by Store selected
      if (chartOfAccountsMap) {
        const chartClone = [...chartOfAccountsMap];

        const filteredChart = chartClone.filter(
          (items) => items.busunituuid === branchSelected
        );

        chartOfAccountsMutate({
          charttype: filteredChart[0]?.chart_id,
        });
      }
    }
  }, [branchSelected]);

  // Query Sales On Credit
  const {
    data: salesOnCreditData,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    refetch,
  } = useCustomInfiniteQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_INFINITE_CREDIT_SALES_ENDPOINT,
    "salesoncredit",
    searchParams
  );

  useEffect(() => {
    fetchNextPage();
    queryClient.resetQueries({ queryKey: ["salesoncredit"] });
  }, [searchParams]);

  const handleSalesOnCreditReset = () => {
    queryClient.resetQueries({ queryKey: ["salesoncredit"] });
  };

  useEffect(() => {
    if (isSalesid !== null) {
      console.log("Fetching invoice data for sales id:", isSalesid);
      invoiceMutate({
        salesid: isSalesid,
      });
    } else {
      console.log("No sales id provided for fetching invoice data");
    }
  }, [isSalesid]);

  const {
    data: invoiceData,
    isLoading: invoiceIsLoading,
    isError: invoiceIsError,
    isSuccess: invoiceIsSuccess,
    mutate: invoiceMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MUTATE_READ_CREDIT_SALES_INVOICE_ENDPOINT,
    "POST"
  );

  useEffect(() => {
    if (invoiceData) {
      console.log("Invoice data:", invoiceData);
    }
  }, [invoiceData]);

  // Function to set salesid
  const handleClickSalesId = (salesId) => {
    setIsSalesid(salesId);
  };

  const {
    data: clearingData,
    isLoading: clearingIsLoading,
    isError: clearingIsError,
    isSuccess: clearingIsSuccess,
    mutate: clearingMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_SALES_CREDIT_CLEARING_TRANSACTIONS_ENDPOINT,
    "POST"
  );

  useEffect(() => {
    if (clearingData) {
      console.log(clearingData);
      if (clearingData.message === "Success") {
        // alert("Amount cleared successfully");
        setReturnmessage({
          choose: "success",
          message: "Amount cleared successfully",
        });
        refetch();
        invoiceMutate({
          salesid: isSalesid,
        });
      }
    }
  }, [clearingData]);

  const handleClearing = (
    salesReference,
    amount,
    payment_reference,
    payment_type,
    payment_date,
    slCode,
    slDescription,
    customername,
    customerid,
    busunitcode,
    particulars,
    status,
    atc,
    withHoldingTaxAmount,
    clearingCode,
    clearingDescription
  ) => {
    // clearingMutate
    clearingMutate({
      salesReference,
      amount,
      payment_reference,
      payment_type,
      payment_date,
      slCode,
      slDescription,
      customername,
      customerid,
      busunitcode,
      particulars,
      status,
      atc,
      withHoldingTaxAmount,
      clearingCode,
      clearingDescription,
    });
  };

  return (
    <>
      {/* Print */}

      {isModalSalesClearing && (
        <ModalSalesCreditPayment
          chartOfAccountsData={chartOfAccountsData}
          setIsModalSalesClearing={setIsModalSalesClearing}
          clearingReference={clearingReference}
          customerName={customerName}
          customerId={customerId}
          busunitCode={busunitCode}
          totalAmountToClear={totalAmountToClear}
          handleClearing={handleClearing}
        />
      )}

      <div className="h-screen w-screen bg-zinc-800 z-10 bg-opacity-50 fixed top-0 left-0">
        <div
          onClick={(e) => {
            if (e.target.id === "closingdiv") {
              setIsModalCreditClearing(false);
              resetSales();
            }
          }}
          id="closingdiv"
          className="flex flex-row justify-center lg:ms-10  lg:px-10 pt-10 h-screen z-20 bg-opacity-100"
        >
          <div
            onClick={(e) => {
              if (e.target.id === "closingmobilediv") {
                setIsModalCreditClearing(false);
                resetSales();
              }
            }}
            id="closingmobilediv"
            className="flex flex-col justify-center w-full md:w-1/2"
          >
            <div className="scale-90 lg:scale-100  flex flex-col lg:mt-20 h-auto pb-5 shadow-2xl  overflow-y-auto scrollbar rounded-xl bg-slate-50 z-20">
              <div className="bg-gradient-to-br from-colorBrand to-colorBrandSecondary flex items-center justify-between px-6 py-4 rounded-t-2xl">
                <motion.div
                  className="flex items-center space-x-3"
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <HiCreditCard className="w-8 h-8 text-white" />
                  {/* <h2 className="text-white text-xl font-semibold">
                    Credit Clearing
                  </h2> */}
                </motion.div>

                <button
                  onClick={() => setIsModalCreditClearing(false)}
                  className="text-white hover:text-gray-200 transition"
                >
                  <HiX className="w-6 h-6" />
                </button>
              </div>

              <div className="w-full h-3">
                {/* {(creditSalesIsLoading || updateCreditSalesIsLoading) && (
                  <LinearProgress color="success" />
                )} */}
              </div>

              {/* Main Form */}

              <div className="flex flex-col space-y-5 py-5 px-12">
                <div className="relative z-0 mb-5 w-full">
                  <h1 className="font-semibold text-2xl text-zinc-600 mb-3">
                    Credit Clearing
                  </h1>

                  {/* Body */}

                  {/* Section 2 */}
                  <section className="flex flex-col w-full">
                    {/* Search */}
                    <div className="relative z-0 self-end  mb-2 w-full lg:w-1/2 border border-zinc-400 rounded-lg">
                      <input
                        type="text"
                        name="searchparams"
                        value={searchParams}
                        placeholder=" "
                        autoComplete="off"
                        className="bg-transparent pt-3 pb-2 px-5 block w-full rounded-lg mt-0  appearance-none focus:outline-none focus:ring-0 focus:border-zinc-500 border-gray-200"
                        onChange={(e) => setSearchParams(e.target.value)}
                      />
                      <label
                        htmlFor="reference"
                        className="absolute duration-300 top-3 -z-1 origin-0 text-gray-500"
                      >
                        Search reference
                      </label>
                    </div>

                    <div className="flex flex-row justify-start px-2  mt-5">
                      <button
                        className={
                          clearingTab === "30"
                            ? "text-sm p-2 text-white bg-gradient-to-br from-colorBrand to-colorBrandTertiary"
                            : "text-sm border-zinc-300 border-b p-2 hover:bg-darkPrimary hover:text-white hover:duration-200"
                        }
                        onClick={() => {
                          setClearingTab("30");
                          setMinFilter(0);
                          setMaxFilter(30);
                          handleResetPage();
                        }}
                      >
                        0-30 days
                      </button>
                      <button
                        className={
                          clearingTab === "60"
                            ? "text-sm p-2 text-white bg-gradient-to-br from-colorBrand to-colorBrandTertiary"
                            : "text-sm border-zinc-300 border-b p-2 hover:bg-darkPrimary hover:text-white hover:duration-200"
                        }
                        onClick={() => {
                          setClearingTab("60");
                          setMinFilter(31);
                          setMaxFilter(60);
                        }}
                      >
                        31-60 days
                      </button>
                      <button
                        className={
                          clearingTab === "90"
                            ? "text-sm p-2 text-white bg-gradient-to-br from-colorBrand to-colorBrandTertiary"
                            : "text-sm border-zinc-300 border-b p-2 hover:bg-darkPrimary hover:text-white hover:duration-200"
                        }
                        onClick={() => {
                          setClearingTab("90");
                          setMinFilter(61);
                          setMaxFilter(90);
                        }}
                      >
                        61-90 days
                      </button>
                      <button
                        className={
                          clearingTab === "120"
                            ? "text-sm p-2 text-white bg-gradient-to-br from-colorBrand to-colorBrandTertiary"
                            : "text-sm border-zinc-300 border-b p-2 hover:bg-darkPrimary hover:text-white hover:duration-200"
                        }
                        onClick={() => {
                          setClearingTab("120");
                          setMinFilter(91);
                          setMaxFilter(120);
                        }}
                      >
                        91-120 days
                      </button>
                      <button
                        className={
                          clearingTab === "over"
                            ? "text-sm p-2 text-white bg-gradient-to-br from-colorBrand to-colorBrandTertiary"
                            : "text-sm border-zinc-300 border-b p-2 hover:bg-darkPrimary hover:text-white hover:duration-200"
                        }
                        onClick={() => {
                          setClearingTab("over");
                          setMinFilter(121);
                          setMaxFilter(9999999);
                        }}
                      >
                        over 120 days
                      </button>
                      <button
                        className={
                          clearingTab === "paid"
                            ? "text-sm p-2 text-white bg-gradient-to-br from-colorBrand to-colorBrandTertiary"
                            : "text-sm border-zinc-300 border-b p-2 hover:bg-darkPrimary hover:text-white hover:duration-200"
                        }
                        onClick={() => {
                          setClearingTab("paid");
                          setMinFilter(0);
                          setMaxFilter(0);
                        }}
                      >
                        Paid
                      </button>
                    </div>
                    {/* List of Clearing Items Section */}

                    <div className="flex flex-col mt-5">
                      <div className="lg:flex flex-col hidden  lg:flex-row font-semibold text-white justify-evenly items-center rounded-t-md  bg-colorBrand  px-3 py-3 duration-200 cursor-pointer">
                        <p>Date</p>
                        <p>Customer</p>
                        <p>Amount</p>
                        <p>Particulars</p>
                        <p>Clear</p>
                      </div>
                      {clearingTab !== "paid"
                        ? salesOnCreditData &&
                          salesOnCreditData.pages.map((page, index) => (
                            <React.Fragment key={index}>
                              {page.items
                                .filter(
                                  (items) =>
                                    parseInt(items.days_since_transdate) >=
                                      minFilter &&
                                    parseInt(items.days_since_transdate) <=
                                      maxFilter &&
                                    items.busunitcode === branchSelected &&
                                    items.net_total > 0
                                )
                                .map((credit, innerIndex) => (
                                  <div
                                    key={innerIndex}
                                    className="flex flex-col  bg-white mb-5  px-3 py-3 border hover:bg-colorBrandLighter duration-200 cursor-pointer"
                                  >
                                    <div className="self-end">
                                      <p className="text-colorBrand font-bold text-xs mb-2 rounded-sm px-1">
                                        {credit.sales_id}
                                      </p>
                                    </div>
                                    <div className="flex flex-col lg:flex-row justify-evenly items-center">
                                      <p className="text-zinc-600 text-sm rounded-full px-1">
                                        {formatToShortDate(credit.transdate)}
                                      </p>
                                      <p className="text-zinc-600 font-semibold text-sm rounded-full px-1">
                                        {credit.customername}
                                      </p>
                                      <p className="text-zinc-600 text-sm font-semibold rounded-full px-1">
                                        ₱
                                        {credit.net_total.toLocaleString(
                                          undefined,
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          }
                                        )}
                                      </p>
                                      <p className="font-extralight text-zinc-600 italic text-xs rounded-full px-1">
                                        {credit.description}
                                      </p>

                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        className="w-5 h-5 text-colorBrand hover:opacity-50 duration-200"
                                        onClick={() => {
                                          handleClickSalesId(credit.sales_id);
                                          setIsModalPrint(true);
                                          // console.log(branchSelected);
                                        }}
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z"
                                          clipRule="evenodd"
                                        />
                                        <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
                                      </svg>

                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        className="w-6 h-6 text-red-500 hover:opacity-50 duration-200"
                                        onClick={() => {
                                          setIsModalSalesClearing(true);
                                          setClearingReference(credit.sales_id);
                                          setCustomerName(credit.customername);
                                          setCustomerId(credit.customer_id);
                                          setBusUnitCode(credit.busunitcode);
                                          setTotalAmountToClear(
                                            credit.net_total
                                          );
                                        }}
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    </div>
                                  </div>
                                ))}
                            </React.Fragment>
                          ))
                        : salesOnCreditData &&
                          salesOnCreditData.pages.map((page, index) => (
                            <React.Fragment key={index}>
                              {page.items
                                .filter((items) => {
                                  return (
                                    items.busunitcode === branchSelected &&
                                    items.net_total === 0
                                  );
                                })
                                .map((credit, innerIndex) => (
                                  <div
                                    key={innerIndex}
                                    className="flex flex-col mt-1 rounded-md bg-white shadow-lg shadow-zinc-400 px-3 py-3 hover:bg-colorBrandLighter  duration-200 cursor-pointer"
                                  >
                                    <div className="self-end">
                                      <p className="  bg-colorBrand text-white text-xs mb-2 rounded-full px-1">
                                        {credit.sales_id}
                                      </p>
                                    </div>
                                    <div className="flex flex-col lg:flex-row justify-evenly items-center">
                                      <p className="text-zinc-600 text-sm rounded-full px-1">
                                        {formatToShortDate(credit.transdate)}
                                      </p>
                                      <p className="text-zinc-600 font-semibold text-sm rounded-full px-1">
                                        {credit.customername}
                                      </p>
                                      <p className="text-zinc-600 text-sm font-semibold rounded-full px-1">
                                        ₱
                                        {credit.principal.toLocaleString(
                                          undefined,
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          }
                                        )}
                                      </p>
                                      <p className="font-extralight text-zinc-600 italic text-xs rounded-full px-1">
                                        {credit.description}
                                      </p>

                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        className="w-5 h-5 text-colorBrand hover:opacity-50 duration-200"
                                        onClick={() => {
                                          handleClickSalesId(credit.sales_id);
                                          setIsModalPrint(true);
                                          // console.log(branchSelected);
                                        }}
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z"
                                          clipRule="evenodd"
                                        />
                                        <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
                                      </svg>
                                    </div>
                                  </div>
                                ))}
                            </React.Fragment>
                          ))}

                      <div className="flex flex-row-reverse w-full">
                        <button
                          className="ms-3 border  border-red-500 rounded-sm w-fit self-end bg-white p-2 hover:bg-red-500 hover:text-white duration-200"
                          onClick={handleSalesOnCreditReset}
                        >
                          Reset
                        </button>

                        <button
                          className="border  border-darkerPrimary rounded-sm w-fit self-end bg-white p-2 hover:bg-darkPrimary hover:text-white duration-200"
                          onClick={() => fetchNextPage()}
                          disabled={isFetchingNextPage}
                        >
                          {isFetchingNextPage ? "Loading..." : "See More..."}
                        </button>
                      </div>
                    </div>
                  </section>
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
      {isModalPrint && (
        <ModalPrintInvoice
          setIsModalPrint={setIsModalPrint}
          invoiceData={invoiceData}
          branchSelected={branchSelected}
          busunits={busunits}
          isSalesid={isSalesid}
        />
      )}
    </>
  );
};

export default ModalCreditClearing;
