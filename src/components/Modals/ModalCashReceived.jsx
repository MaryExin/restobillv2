import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaCashRegister, FaTimes } from "react-icons/fa";
import { FiArrowLeft } from "react-icons/fi";
import { set } from "lodash";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalCashReceived = ({
  setIsModalOpen,
  setIsModalCashTrackerOpen,
  setIsPayment,
  salesNetTotal,
  mopData,
  giftCertificatesData,
  handlePaymentSummary,
  handlePaymentSummaryDelete,
  handleTotalPayment,
  paymentSummary,
  totalPayment,
  customerId,
  customerName,
  setIsSubmit,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const [mop, setMop] = useState({});
  const [gcs, setGcs] = useState({});
  const [isGCSelected, setIsGCSelected] = useState(false);
  const [amountTendered, setAmountTendered] = useState(0);
  const [paymentRef, setPaymentRef] = useState("");

  useEffect(() => {
    if (mop.description === "CREDIT") {
      if (!customerId) {
        alert("Select a Customer for CREDIT terms");
        setIsModalOpen(false);
      } else {
        setPaymentRef(customerId);
      }
    }
  }, [mop, customerId, setIsModalOpen]);

  const handleAdd = () => {
    if (
      mop.description &&
      ((mop.description !== "GIFT CERT" &&
        mop.description !== "CREDIT" &&
        amountTendered > 0 &&
        paymentRef) ||
        (mop.description === "GIFT CERT" && isGCSelected && paymentRef) ||
        (mop.description === "CREDIT" && amountTendered > 0 && paymentRef))
    ) {
      if (mop.description === "GIFT CERT") {
        handlePaymentSummary(
          gcs.gift_card_type_id,
          gcs.description,
          gcs.value,
          paymentRef,
          "Paid"
        );
      } else {
        handlePaymentSummary(
          mop.mop_id,
          mop.description,
          mop.slcode,
          amountTendered,
          paymentRef,
          mop.description === "CREDIT" ? "Unpaid" : "Paid"
        );
      }
      handleTotalPayment();
      // reset
      setMop({});
      setGcs({});
      setIsGCSelected(false);
      setAmountTendered(0);
      setPaymentRef("");
    } else {
      alert("Please fill out all required fields");
    }
  };

  const handleClose = () => {
    setIsPayment(true);

    setIsModalOpen(false);
    setIsModalCashTrackerOpen(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="bg-gradient-to-br from-colorBrand to-colorBrandSecondary p-1 rounded-2xl shadow-2xl w-[90vw] max-w-2xl"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <div className="bg-white rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="relative bg-gradient-to-br from-colorBrand to-colorBrandSecondary h-32">
              <div className="absolute -top-8 -left-8 w-24 h-24 bg-colorBrandLighter rounded-full opacity-50 mix-blend-multiply animate-pulse" />
              <div className="absolute -bottom-8 -right-8 w-28 h-28 bg-colorBrandLighter rounded-full opacity-40 mix-blend-multiply" />
              <div className="absolute inset-0 flex items-center justify-between px-4">
                <motion.div
                  className="bg-white rounded-full p-4 shadow-lg"
                  initial={{ rotate: -180, scale: 0, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                >
                  <FaCashRegister className="w-16 h-16 text-colorBrand" />
                </motion.div>
                <button onClick={() => handleClose()} className="text-white">
                  <FaTimes className="w-8 h-8" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-auto">
              {/* MOP Selector */}
              <div className="space-y-4">
                <label className="block font-medium text-gray-700">
                  Mode of Payment
                </label>
                <select
                  value={JSON.stringify(mop)}
                  onChange={(e) => setMop(JSON.parse(e.target.value))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-colorBrand"
                >
                  <option value="">Select MOP</option>
                  {mopData.map((m, i) => (
                    <option key={i} value={JSON.stringify(m)}>
                      {`${m.description} - ${m.account_no}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gift Certificate Flow */}
              {mop.description === "GIFT CERT" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-gray-700">
                      Gift Certificate
                    </label>
                    <select
                      onChange={(e) => {
                        setGcs(JSON.parse(e.target.value));
                        setIsGCSelected(true);
                      }}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-colorBrand"
                    >
                      <option value="" disabled hidden>
                        Select GC
                      </option>
                      {giftCertificatesData.map((gc, i) => (
                        <option
                          key={i}
                          value={JSON.stringify(gc)}
                        >{`${gc.description} - ₱${gc.value}`}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700">
                      GC Reference No.
                    </label>
                    <input
                      type="text"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-colorBrand"
                    />
                  </div>
                </div>
              )}

              {/* Standard Flow */}
              {mop.description !== "GIFT CERT" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-gray-700">
                      Amount Received
                    </label>
                    <input
                      type="number"
                      onWheel={(e) => e.target.blur()}
                      value={amountTendered}
                      onChange={(e) =>
                        setAmountTendered(parseFloat(e.target.value))
                      }
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-colorBrand"
                    />
                  </div>
                  <div>
                    {mop.description === "CREDIT" ? (
                      <>
                        <label className="block font-medium text-gray-700">
                          Customer
                        </label>
                        <p className="text-gray-700">{customerName}</p>
                      </>
                    ) : (
                      <>
                        <label className="block font-medium text-gray-700">
                          Payment Reference
                        </label>
                        <input
                          type="text"
                          value={paymentRef}
                          onChange={(e) => setPaymentRef(e.target.value)}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-colorBrand"
                        />
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Add Button */}
              <button
                onClick={handleAdd}
                className="w-full py-3 bg-colorBrand hover:bg-colorBrandSecondary text-white font-medium rounded-full transition"
              >
                Add Payment
              </button>

              {/* Payment Summary List */}
              <div className="space-y-3">
                {paymentSummary.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-gray-100 rounded-lg"
                  >
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handlePaymentSummaryDelete(i)}>
                        <FaTimes className="w-5 h-5 text-red-500" />
                      </button>
                      <span className="bg-colorBrand text-white px-2 py-1 rounded">
                        {p.mop_description}
                      </span>
                    </div>
                    <span className="font-semibold text-gray-800">
                      ₱
                      {p.amount_tendered.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mt-6 space-y-2">
                <div className="flex justify-between">
                  <span>Total Tendered:</span>
                  <span>
                    ₱
                    {totalPayment.toLocaleString({
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Bill:</span>
                  <span className="text-red-500">
                    ₱
                    {salesNetTotal.toLocaleString({
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between bg-gradient-to-br from-colorBrand to-colorBrandSecondary text-white px-4 py-2 rounded-lg">
                  <span>Change:</span>
                  <span>
                    ₱
                    {(totalPayment - salesNetTotal).toLocaleString({
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Back Button */}
              {paymentSummary?.length > 0 && (
                <div className="flex flex-row items-end w-full justify-end">
                  <button
                    onClick={() => {
                      setIsSubmit(true);
                      handleClose();
                    }}
                    className="w-fit self-end  mb-5 p-3 bg-gradient-to-tr from-medPrimary to bg-medPrimary/70 hover:bg-medPrimary/50 text-white font-medium rounded-full flex items-center justify-center space-x-2 transition"
                  >
                    <FiArrowLeft className="w-5 h-5 animate-pulse" />
                    <span>Submit</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ModalCashReceived;
