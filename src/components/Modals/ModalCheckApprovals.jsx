import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import ModalYesNoReusable from "./ModalYesNoReusable";
import { LinearProgress } from "@mui/material";
import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalCheckApprovals = ({
  route,
  busunitcode,
  setIsModalApproval,
  references,
  handleNetClearingAccountsReset,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const { userId } = useZustandLoginCred();

  const [isYesNoModalOpen, setYesNoModalOpen] = useState(false);
  const [approvalData, setApprovalData] = useState([]);
  const [actionType, setActionType] = useState("");
  const [selectedApprover, setSelectedApprover] = useState(null);
  const [approvalId, setApprovalId] = useState("");
  const [approvalSeq, setApprovalSeq] = useState("");
  const [approvalHistoryId, setApprovalHistoryId] = useState("");
  const [approvalDescription, setApprovalDescription] = useState("");
  const [empId, setEmpId] = useState("");

  const {
    data: approversData,
    isLoading: approversDataIsLoading,
    mutate: approversDataMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MUTATE_READ_APPROVAL_DETAILS_ENDPOINT,
    "POST"
  );

  useEffect(() => {
    if (references && references.length > 0) {
      approversDataMutate({
        route: route,
        busunitcode: busunitcode,
        references: references,
      });
    }
  }, []);

  useEffect(() => {
    if (approversData) {
      setApprovalData(approversData);
    }
  }, [approversData]);

  const { mutate: approveTransactionMutate } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MUTATE_APPROVE_TRANSACTION_ENDPOINT,
    "POST"
  );

  const handleAction = (approverId, type) => {
    setSelectedApprover(approverId);
    setActionType(type);
    setYesNoModalOpen(true);
  };

  // const handleIndividualAction = (approval, type) => {
  //   setApprovalId(approval.approvalid);
  //   setApprovalSeq(approval.approvalseq);
  //   setApprovalHistoryId(approval.approvalhistoryid);
  //   setApprovalDescription(
  //     type === "approve" ? approval.approvaldescription : "Voided"
  //   );
  //   setEmpId(approval.empid);
  //   setActionType(type);
  //   setYesNoModalOpen(true);
  // };
  const handleSubmission = () => {
    if (selectedApprover) {
      // Bulk action for a specific approver
      const approverData = approvalData.find(
        (item) => item.approvalid === selectedApprover
      );

      if (approverData) {
        const approvalsToProcess = approvalData.filter(
          (approval) =>
            approval.approvalhistoryid === null && approval.empid === userId
        );

        if (approvalsToProcess.length > 0) {
          // Sequence validation
          const approvedSequences = [0];
          const allSequences = [0];

          approvalData.forEach((item) => {
            if (item.approvalhistoryid !== null) {
              approvedSequences.push(item.approvalseq); // Keep this as is if approvalseq is the correct name
            }
          });

          approvalData.forEach((item) => {
            allSequences.push(item.approvalseq); // Keep this as is if approvalseq is the correct name
          });

          // Check if each approval in approvalsToProcess has the correct sequence
          const invalidSequence = approvalsToProcess.some(
            (approval) => !approvedSequences.includes(approval.approvalseq - 1) // Correct the sequence check
          );

          if (invalidSequence) {
            alert("All preceding approvals must be completed first.");
            return;
          }

          const largestSeq = Math.max(...allSequences);

          let isLargest;

          // Ensure you're using the correct property name here
          if (largestSeq === approvalsToProcess[0].approvalseq) {
            // Correct this to match your property name
            isLargest = true;
          } else {
            isLargest = false;
          }

          console.log(largestSeq, " ", approvalsToProcess[0].approvalseq);

          // Proceed with approvals processing
          Promise.all(
            approvalsToProcess.map((approval) =>
              approveTransactionMutate({
                references: references,
                approvalid: approval.approvalid,
                approvaldescription:
                  actionType === "approve"
                    ? isLargest
                      ? "Posted"
                      : approval.approvaldescription
                    : "Voided",
              })
            )
          )
            .then(() => {
              alert(
                `All selected transactions for this approver have been ${
                  actionType === "approve" ? "approved" : "voided"
                } successfully.`
              );
              handleNetClearingAccountsReset();
              setIsModalApproval(false);
            })
            .catch((error) => {
              console.error("Error processing approvals:", error);
              alert("An error occurred while processing approvals.");
            });
        } else {
          alert("No approvals to process for the selected approver.");
        }
      } else {
        alert("Approver data is missing or invalid.");
      }
    } else {
      alert("No approver selected.");
    }

    // Reset states
    resetApprovalStates();
  };

  // Helper function to reset states
  const resetApprovalStates = () => {
    setSelectedApprover(null);
    setActionType("");
    setApprovalId("");
    setApprovalSeq("");
    setApprovalHistoryId("");
    setApprovalDescription("");
    setEmpId("");
    setYesNoModalOpen(false);
  };

  return (
    <>
      <div className="h-screen w-screen bg-zinc-800 z-10 bg-opacity-50 fixed top-0 left-0">
        <div className="flex flex-row justify-center lg:ms-10 lg:px-10 pt-10 h-screen z-20 bg-opacity-100">
          <div className="flex flex-col justify-center w-full md:w-1/2">
            <div className="scale-90 lg:scale-100 flex flex-col lg:mt-5 h-auto pb-5 shadow-2xl overflow-y-auto scrollbar rounded-xl bg-slate-50 z-20">
              <div className="flex flex-row py-6 relative justify-center text-white w-full bg-gradient-to-br from-darkerPrimary via-darkPrimary to-medPrimary rounded-t-xl p-5">
                <div
                  onClick={() => setIsModalApproval(false)}
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
                <h2 className="text-2xl font-bold">Approval Summary</h2>
              </div>

              <div className="w-full h-3">
                {approversDataIsLoading && <LinearProgress color="success" />}
              </div>

              <div className="flex flex-col space-y-5 py-5 px-5 lg:px-12">
                {approvalData &&
                  approvalData.map((item, index) => (
                    <div
                      key={index}
                      className="border p-4 rounded-lg shadow-md"
                    >
                      {/* <h2 className="font-bold text-xl mb-4">
                      Reference: {item.reference}
                    </h2> */}

                      <div
                        // key={approvalIndex}
                        className="mb-4 p-3 bg-gray-100 rounded-md"
                      >
                        <p className="text-lg font-semibold mb-2">
                          {item.approvaldescription}
                        </p>
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{item.approvername}</p>
                            <p className="text-sm text-gray-600">
                              {item.position}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {item.approvalhistoryid === null ? (
                              <>
                                <button
                                  onClick={() =>
                                    handleAction(item.approvalid, "approve")
                                  }
                                  className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                                >
                                  Approve All
                                </button>
                                <button
                                  onClick={() =>
                                    handleAction(item.approvalid, "void")
                                  }
                                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                >
                                  Void All
                                </button>
                              </>
                            ) : (
                              <span className="text-green-500">Approved</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isYesNoModalOpen && (
        <ModalYesNoReusable
          header={"Confirmation"}
          message={`Are you sure you want to ${actionType} ${
            selectedApprover ? "all transactions" : "this transaction"
          }?`}
          setYesNoModalOpen={setYesNoModalOpen}
          triggerYesNoEvent={handleSubmission}
        />
      )}
    </>
  );
};

export default ModalCheckApprovals;
