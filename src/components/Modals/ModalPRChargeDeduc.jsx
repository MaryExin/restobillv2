import React, { useEffect, useState } from "react";
import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import useCustomQuery from "../../hooks/useCustomQuery";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import ModalYesNoReusable from "./ModalYesNoReusable";
import "../../fonts/font-style.css";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalPRChargeDeduc = ({
  setshowchargesdeduc,
  listofcharge,
  setlistofcharge,
  settriggertosavecharge,
  transactionno,
  particulars,
  amount,
  setparticulars,
  setamount,
  baseAmount,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const [percent, setpercent] = useState(false);

  const addchargededuc = () => {
    if (particulars && amount) {
      let computedAmount = amount;

      // If percent mode is on, compute the amount
      if (percent) {
        const numeric = parseFloat(amount);
        const base = parseFloat(baseAmount);
        if (!isNaN(numeric) && !isNaN(base)) {
          computedAmount = ((numeric / 100) * base).toFixed(2);
        }
      }

      const newCharge = {
        transaction_id: transactionno,
        particulars: particulars + (percent ? ` (${amount}%)` : ""),
        amount: computedAmount,
      };

      if (listofcharge.length === 0) {
        setlistofcharge([newCharge]);
      } else {
        setlistofcharge((prevData) => [...prevData, newCharge]);
      }

      setparticulars("");
      setamount("");
      setpercent(false); // Optionally reset percent mode after adding
    }
  };

  const removechargededuc = (indexnum) => {
    setlistofcharge((prevData) =>
      prevData.filter((_, index) => index !== indexnum)
    );
  };

  return (
    <>
      <div className="h-screen w-screen pt-20 bg-zinc-800 z-20 bg-opacity-50 fixed top-0 left-0 px-5 lg:px-0">
        <div
          id="closingdiv"
          className="flex flex-row justify-center p-5 pt-20 lg:ms-10 lg:px-10 lg:pt-10 h-screen z-20 bg-opacity-100"
        >
          <div className="flex flex-col justify-start w-full lg:w-1/2 ">
            <div className="lg:scale-100  flex flex-col scrollbar  overflow-y-auto  lg:mt-3 h-auto pb-5 shadow-2xl rounded-xl bg-slate-50 z-20">
              <div className="flex flex-row relative justify-center text-white w-full  bg-gradient-to-br from-colorBrand   to-colorBrandSecondary rounded-t-xl p-1"></div>
              {/* Header Section */}
              <div className="flex flex-col space-y-5 p-5 px-10 w-full">
                <div className="flex flex-col items-start w-full space-y-3">
                  <h1 className="font-semibold text-xs lg:text-sm text-zinc-600">
                    Transaction Id: {transactionno}
                    <span className="text-darkerPrimary text-xs lg:text-sm font-thin">
                      {/* {productItems[0].prd_queue_code} */}
                    </span>
                  </h1>
                </div>
              </div>
              <div className="flex flex-col space-y-1 p-5 px-10 w-full">
                <div className="lg:flex flex-col lg:flex-row hidden space-x-2 items-start lg:items-center text-zinc-600 justify-start lg:justify-between cursor-pointer py-2 px-3  lg:w-full bg-white shadow-lg rounded-sm ">
                  <input
                    value={particulars}
                    onChange={(e) => setparticulars(e.target.value)}
                    className="flex-1 border-2 rounded-sm"
                  />
                  <input
                    value={amount}
                    onChange={(e) => setamount(e.target.value)}
                    className="flex w-24 text-center border-2 rounded-sm"
                  />
                  <button
                    onClick={() => setpercent(!percent)}
                    className={`focus:outline-none text-white ${
                      percent ? "bg-green-700" : "bg-yellow-600"
                    } font-medium rounded-lg text-sm px-5 py-1`}
                  >
                    %
                  </button>
                  <div className="flex w-24 justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      className="w-7 h-7 text-green-500"
                      onClick={() => addchargededuc()}
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="lg:flex flex-col lg:flex-row hidden  items-start lg:items-center text-zinc-600 justify-start lg:justify-between cursor-pointer py-2 px-3  lg:w-full bg-white shadow-lg rounded-sm ">
                  <div className="flex-1">
                    <p>Description</p>
                  </div>
                  <p className="flex w-24 justify-center">Amount</p>
                  <p className="flex w-24 justify-center"></p>
                </div>
                <div className="h-60 overflow-y-auto space-y-1">
                  {listofcharge &&
                    listofcharge.map((item, index) => (
                      <div className="lg:flex flex-col lg:flex-row hidden  items-start lg:items-center text-zinc-600 justify-start lg:justify-between cursor-pointer py-2 px-3  lg:w-full bg-white shadow-lg rounded-sm ">
                        <>
                          <div className="flex-1">
                            <p>{item.particulars}</p>
                          </div>
                          <p className="flex w-24 justify-center">
                            {item.amount}
                          </p>
                          <div className="flex w-24 justify-center">
                            <svg
                              xmlns="httdiv://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke-width="1.5"
                              stroke="currentColor"
                              className="w-7 h-7 text-red-500"
                              onClick={() => removechargededuc(index)}
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M15 12H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                              />
                            </svg>
                          </div>
                        </>
                      </div>
                    ))}
                </div>

                <div className="flex flex-row w-full px-5 pt-4 space-x-3 justify-end">
                  <div className="">
                    <button
                      onClick={() => {
                        settriggertosavecharge(true);
                        setshowchargesdeduc(false);
                      }}
                      className="self-start bg-green-700  py-1 px-5 rounded-sm text-white  hover:scale-95 duration-200"
                    >
                      Save
                    </button>
                  </div>

                  <div className="">
                    <button
                      onClick={() => {
                        setshowchargesdeduc(false);
                      }}
                      className="self-start bg-red-500 py-1 px-5 rounded-sm text-white  hover:scale-95 duration-200"
                    >
                      Close
                    </button>
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

export default ModalPRChargeDeduc;
