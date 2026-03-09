import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import useZustandSideMenu from "../../context/useZustandSideMenu";
import ModalYesNoReusable from "./ModalYesNoReusable";
import { FaCashRegister } from "react-icons/fa";
import ModalSuccessNavToSelf from "./ModalSuccessNavToSelf";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalSetCashBalance = ({
  header,
  setIsModalCashTrackerOpen,
  resetQueries,
  cashBalanceData,
  cashBalanceMutate,
  busunitcode,
  poscode,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const [isYesNoModalOpen, setYesNoModalOpen] = useState(false);
  const [cashBalance, setCashBalance] = useState(0);
  const [submissionOngoing, setSubmissionOngoing] = useState(false);
  const [showhidesuccess, setshowhidesuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (cashBalanceData && submissionOngoing) {
      if (cashBalanceData.message === "Success") {
        // setIsModalCashTrackerOpen(false);
        setshowhidesuccess(true);
        // alert(`Setup ${header} success`);
        resetQueries();
        setSubmissionOngoing(false);
      }
    }
  }, [
    cashBalanceData,
    submissionOngoing,
    // resetQueries,
    // setIsModalCashTrackerOpen,
    // header,
  ]);

  const closemodal = () => {
    setIsModalCashTrackerOpen(false);
    setshowhidesuccess(false);
  };

  const handleSubmission = () => {
    // if (cashBalance <= 0) {
    //   alert("Cash balance should be greater than zero");
    // } else {
    setSubmissionOngoing(true);
    cashBalanceMutate({
      type: header.includes("Opening") ? "cashOpening" : "cashClosing",
      cashbalance: cashBalance,
      busunitcode,
      poscode,
    });
    // }
  };

  const handleClose = () => setIsModalCashTrackerOpen(false);

  return (
    <>
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Lightem Modal wrapper with red motif */}
          <motion.div
            className="bg-gradient-to-br from-colorBrand to-colorBrandSecondary p-1 rounded-2xl shadow-2xl"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className="bg-white rounded-2xl overflow-hidden w-[90vw] max-w-md">
              {/* Header with geometric shapes and cash icon */}
              <div className="relative bg-gradient-to-br from-colorBrand to-colorBrandSecondary h-32">
                <div className="absolute -top-8 -left-8 w-24 h-24 bg-colorBrandLighter rounded-full opacity-50 mix-blend-multiply animate-pulse" />
                <div className="absolute -bottom-8 -right-8 w-28 h-28 bg-colorBrandLighter rounded-full opacity-40 mix-blend-multiply" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    initial={{ rotate: -180, scale: 0, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className="bg-white rounded-full p-4 shadow-lg cursor-pointer"
                    onClick={handleClose}
                  >
                    <FaCashRegister className="w-16 h-16 text-colorBrand" />
                  </motion.div>
                </div>
              </div>

              {/* Body */}
              <div className="pt-20 pb-6 px-6 text-center space-y-4">
                <h2 className="text-2xl font-bold text-gray-800">{header}</h2>
                <p className="text-gray-600">Enter amount below to confirm</p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setYesNoModalOpen(true);
                  }}
                  className="space-y-6"
                >
                  <div className="text-left">
                    <label className="block mb-2 text-gray-700 font-medium">
                      Total {header}
                    </label>
                    <input
                      type="number"
                      onWheel={(e) => e.target.blur()}
                      onChange={(e) =>
                        setCashBalance(parseFloat(e.target.value))
                      }
                      className="w-full px-4 py-2 border border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-colorBrand"
                      required
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="w-full inline-flex justify-center items-center px-6 py-3 bg-colorBrand hover:bg-colorBrandSecondary text-white font-medium rounded-full shadow-lg transition"
                  >
                    Submit
                  </motion.button>
                </form>

                {/* Yes/No Modal */}
                {isYesNoModalOpen && (
                  <ModalYesNoReusable
                    header="Confirmation"
                    message="Proceed with this cash balance?"
                    setYesNoModalOpen={setYesNoModalOpen}
                    id="confirm"
                    triggerYesNoEvent={handleSubmission}
                  />
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
      {showhidesuccess && (
        <>
          <ModalSuccessNavToSelf
            header={"Success"}
            message={`Setup ${header} success`}
            button={"Save"}
            setIsModalOpen={closemodal}
          />
        </>
      )}
    </>
  );
};

export default ModalSetCashBalance;
