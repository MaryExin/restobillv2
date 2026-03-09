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

const ModalApprovals = ({
  //Approval For Accounting Entries
  route,
  busunitcode,
  setIsModalApproval,
  triggerApproval,
  reference,
  approvalstatus,
  handleNetClearingAccountsReset,
  setReturnmessage,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const { userId } = useZustandLoginCred();

  const [isYesNoModalOpen, setYesNoModalOpen] = useState(false);
  const [approvalId, setApprovalId] = useState("");
  const [approvalSeq, setApprovalSeq] = useState("");
  const [approvalHistoryId, setApprovalHistoryId] = useState("");
  const [approvalDescription, setApprovalDescription] = useState("");
  const [empId, setEmpId] = useState("");

  useEffect(() => {
    if (approvalHistoryId) {
      // console.log(approvalHistoryId);
    }
  }, [approvalHistoryId]);

  const {
    data: approversData,
    isLoading: approversDataIsLoading,
    isError: approversDataIsError,
    isSuccess: approversDataIsSuccess,
    mutate: approversDataMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MUTATE_READ_APPROVAL_DETAILS_ENDPOINT,
    "POST"
  );

  useEffect(() => {
    approversDataMutate({
      route: route,
      busunitcode: busunitcode,
      reference: reference,
    });
  }, []);

  useEffect(() => {
    if (approversData) {
      // console.log(approversData);
    }
  }, [approversData]);

  const {
    data: approveTransaction,
    isLoading: approveTransactionIsLoading,
    isError: approveTransactionIsError,
    isSuccess: approveTransactionIsSuccess,
    mutate: approveTransactionMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MUTATE_APPROVE_TRANSACTION_ENDPOINT,
    "POST"
  );

  useEffect(() => {
    if (approveTransaction) {
      // console.log(approveTransaction);
      if (approveTransaction.message === "Success") {
        setReturnmessage({
          choose: "success",
          message: "Transaction was approved",
        });
        handleNetClearingAccountsReset();
        setIsModalApproval(false);
      } else {
        setIsModalApproval(false);
      }
    }
  }, [approveTransaction]);

  const handleSubmission = () => {
    // Check Sequence Approval

    if (empId === userId) {
      const approvedSequences = [0];
      const allSequences = [];

      if (approversData) {
        approversData.forEach((item) => {
          if (item.approvalhistoryid !== null) {
            approvedSequences.push(item.approvalseq);
          }
        });

        approversData.forEach((item) => {
          allSequences.push(item.approvalseq);
        });
      }

      if (!approvedSequences.includes(approvalSeq - 1)) {
        setReturnmessage({
          choose: "error",
          message: `Approval ${approvalSeq - 1} should be initiated first`,
        });
      } else {
        const largestSeq = Math.max(...allSequences);

        let isLargest;

        if (largestSeq === approvalSeq) {
          isLargest = true;
        } else {
          isLargest = false;
        }
        if (approvalDescription == "Voided") {
          approveTransactionMutate({
            reference: reference,
            approvalid: approvalId,
            approvaldescription: approvalDescription, //Status
          });
        } else {
          approveTransactionMutate({
            reference: reference,
            approvalid: approvalId,
            approvaldescription: isLargest ? "Posted" : approvalDescription, //Status
          });
        }
      }
    } else {
      setReturnmessage({
        choose: "error",
        message: "You are not authorized to approve this transaction",
      });
    }

    // Reset

    setApprovalHistoryId("");
    setApprovalId("");
    setApprovalSeq("");
    setApprovalDescription("");
    setEmpId("");
  };
  //  console.log(approvalstatus);
  return (
    <>
      <div className="h-screen w-screen bg-gray-800 z-10 bg-opacity-50 fixed top-0 left-0">
        <div className="flex flex-row justify-center lg:ms-10  lg:px-10 pt-10 h-screen z-20 bg-opacity-100">
          <div className="flex flex-col justify-center w-full md:w-1/2">
            <div className="scale-90 lg:scale-100  flex flex-col lg:mt-5 h-auto pb-5 shadow-2xl  overflow-y-auto scrollbar rounded-xl bg-slate-50 z-20">
              <div className="flex flex-row py-6 relative justify-center text-white w-full  bg-gradient-to-br from-colorBrand   to-colorBrandSecondary rounded-t-xl p-5">
                {/* Header  */}
                <div
                  onClick={() => {
                    setIsModalApproval(false);
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
                {/* <motion.div
                  className="flex flex-row justify-center"
                  initial={{ opacity: 0, scale: 0, rotate: -180 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-24 h-24 text-white"
                  >
                    <path d="M4.5 3.75a3 3 0 00-3 3v.75h21v-.75a3 3 0 00-3-3h-15z" />
                    <path
                      fillRule="evenodd"
                      d="M22.5 9.75h-21v7.5a3 3 0 003 3h15a3 3 0 003-3v-7.5zm-18 3.75a.75.75 0 01.75-.75h6a.75.75 0 010 1.5h-6a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z"
                      clipRule="evenodd"
                    />
                  </svg>
                </motion.div> */}
              </div>

              <div className="w-full h-3">
                {approversDataIsLoading && <LinearProgress color="success" />}
              </div>

              {/* Main Form */}

              <div className="flex flex-col space-y-5 py-5 px-5 lg:px-12">
                <h1
                  className="text-xl text-zinc-600"
                  style={{ fontFamily: "Poppins-ExtraBold" }}
                >
                  Approval Summary:
                </h1>
                {/* Start of Map */}
                <div className="flex flex-col font-semibold text-zinc-600  cursor-pointer">
                  {approversData &&
                    approversData.map((item) => (
                      <>
                        <div className="border p-2 hover:scale-95 hover:bg-colorBrandLighter duration-200 ">
                          <p className="text-zinc-600 font-semibold mb-3">
                            {item.approvaldescription}
                          </p>
                          <div className="flex flex-row justify-between">
                            <div className="flex flex-col">
                              <p className="border-b">{item.approvername}</p>
                              <p className="">{item.position}</p>
                            </div>
                            {approvalstatus != "Voided" ? (
                              <div className="flex ">
                                <div className="relative group">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className={
                                      item.approvalhistoryid === null
                                        ? "w-8 h-8 text-red-500 hover:opacity-50 duration-200"
                                        : "w-8 h-8 text-green-700 hover:opacity-50 duration-200"
                                    }
                                    onClick={() => {
                                      item.approvalhistoryid === null
                                        ? setApprovalId(
                                            item.approvalid,
                                            setApprovalSeq(
                                              item.approvalseq,
                                              setApprovalHistoryId(
                                                item.approvalhistoryid,
                                                setApprovalDescription(
                                                  item.approvaldescription,
                                                  setEmpId(
                                                    item.empid,
                                                    setYesNoModalOpen(true)
                                                  )
                                                )
                                              )
                                            )
                                          )
                                        : setReturnmessage({
                                            choose: "success",
                                            message: "Already approved",
                                          });
                                    }}
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-green-700 text-white text-xs rounded py-1 px-2 z-10">
                                    Approve
                                  </div>
                                </div>
                                {item.approvalhistoryid === null ? (
                                  <div className=" relative group">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                      className={
                                        item.approvalhistoryid === null
                                          ? "w-8 h-8 text-red-500 hover:opacity-50 duration-200"
                                          : "w-8 h-8 text-green-700 hover:opacity-50 duration-200"
                                      }
                                      onClick={() => {
                                        item.approvalhistoryid === null
                                          ? setApprovalId(
                                              item.approvalid,
                                              setApprovalSeq(
                                                item.approvalseq,
                                                setApprovalHistoryId(
                                                  item.approvalhistoryid,
                                                  setApprovalDescription(
                                                    "Voided",
                                                    setEmpId(
                                                      item.empid,
                                                      setYesNoModalOpen(true)
                                                    )
                                                  )
                                                )
                                              )
                                            )
                                          : setReturnmessage({
                                              choose: "success",
                                              message: "Already approved",
                                            });
                                      }}
                                    >
                                      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm3.707 10.293a1 1 0 01-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 01-1.414-1.414L8.586 10 6.293 7.707a1 1 0 011.414-1.414L10 8.586l2.293-2.293a1 1 0 011.414 1.414L11.414 10l2.293 2.293z" />
                                    </svg>
                                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-green-700 text-white text-xs rounded py-1 px-2 z-10">
                                      Void
                                    </div>
                                  </div>
                                ) : (
                                  <div></div>
                                )}
                              </div>
                            ) : (
                              <div className="bg-red-500 text-white flex items-center p-1 rounded-xl px-2">
                                Voided
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ))}
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
    </>
  );
};

export default ModalApprovals;
