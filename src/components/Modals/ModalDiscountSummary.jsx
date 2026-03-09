import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import ModalYesNoReusable from "./ModalYesNoReusable";
import { LinearProgress, setRef } from "@mui/material";
import Toast from "../Toasts/Toast";
import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import DisbursementVoucher from "../Printables/DisbursementVoucher";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalDiscountSummary = ({
  setIsModalDiscountSummary,
  cashTransId,
  setTransId,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const { userId } = useZustandLoginCred();

  const {
    data: discountSummaryData,
    isLoading: discountSummaryDataIsLoading,
    isError: discountSummaryDataIsError,
    isSuccess: discountSummaryDataIsSuccess,
    mutate: discountSummaryDataMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MUTATE_READ_CASHIERING_DISCOUNT_REPORT,
    "POST"
  );

  useEffect(() => {
    if (cashTransId !== "") {
      discountSummaryDataMutate({
        cashtransid: cashTransId,
      });
    }
  }, [cashTransId]);

  return (
    <>
      <div className="h-screen w-screen bg-zinc-800 z-10 bg-opacity-50 fixed top-0 left-0">
        <div className="flex flex-row justify-center lg:ms-10  lg:px-10 pt-10 h-screen z-20 bg-opacity-100">
          <div className="flex flex-col justify-center w-full md:w-1/2">
            <div className="scale-90 lg:scale-100  flex flex-col lg:mt-5 h-auto pb-5 shadow-2xl  overflow-y-auto scrollbar rounded-xl bg-slate-50 z-20">
              <div className="flex flex-row py-6 relative justify-center text-white w-full  bg-gradient-to-br from-darkerPrimary via-darkPrimary  to-medPrimary rounded-t-xl p-5">
                {/* Header  */}
                <div
                  onClick={() => {
                    setTransId(0, setIsModalDiscountSummary(false));
                  }}
                  className="cursor-pointer absolute right-2 top-1 hover:scale-105 duration-300"
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
              </div>

              <div className="w-full h-3">
                {discountSummaryDataIsLoading && (
                  <LinearProgress color="success" />
                )}
              </div>

              {/* Main Form */}

              <div className="flex flex-col space-y-5 py-5 px-5 lg:px-12">
                <h1
                  className="text-xl text-zinc-600"
                  style={{ fontFamily: "Raleway-bold" }}
                >
                  Discount Summary:
                </h1>
                {/* Start of Map */}
                <div className="flex flex-col font-semibold text-zinc-600  cursor-pointer">
                  <div className="flex flex-row mb-2 border-b">
                    <p className="lg:w-56 text-center">Discount Type</p>
                    <p className="lg:w-32 text-center">Amount</p>
                    <p className="lg:w-32 text-center">Reference</p>
                  </div>
                  {discountSummaryData &&
                    discountSummaryData.map((item, index) => (
                      <div key={index} className="flex flex-row border-b p-1">
                        <p className="lg:w-56 text-center items-center">
                          {item.description}
                        </p>
                        <p className="lg:w-32 text-center items-center">
                          {item.discount_amount}
                        </p>
                        <p className="lg:w-32 text-center items-center">
                          {item.discount_ref_no}
                        </p>
                      </div>
                    ))}
                  <div className="flex flex-row mb-2 border-b">
                    <p className="lg:w-56 text-center">TOTAL</p>
                    <p className="lg:w-32 text-center poppins-black">
                      {discountSummaryData?.reduce((acc, total) => {
                        return acc + total.discount_amount;
                      }, 0)}
                    </p>
                    <p className="lg:w-32 text-center"></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalDiscountSummary;
