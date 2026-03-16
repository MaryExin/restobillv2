import React, { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReactToPrint } from "react-to-print";
import {
  FiX,
  FiPrinter,
  FiClock,
  FiCheckCircle,
  FiPercent,
} from "react-icons/fi";
import Receipt from "./Receipt";
import { useTheme } from "../../context/ThemeContext";
import useApiHost from "../../hooks/useApiHost";
import ModalDiscountTransaction from "./ModalDiscountTransaction";

const ModalTrans_List = ({
  tableselected,
  data = [],
  setshowtranslistpertable,
  dateFrom,
}) => {
  const apiHost = useApiHost();
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [detailedproduct, setdetailedproduct] = useState([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountTransaction, setDiscountTransaction] = useState(null);
  const componentRef = useRef(null);
  const { isDark } = useTheme();

  const filteredData = Array.isArray(data)
    ? data.filter((item) =>
        activeTab === "paid"
          ? item.remarks?.toLowerCase() === "paid"
          : item.remarks?.toLowerCase() !== "paid",
      )
    : [];

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: selectedTransaction?.transaction_id || "receipt",
    pageStyle: `
      @media print {
        @page { size: 80mm auto; margin: 0; }
        html, body {
          background: #ffffff !important;
          color: #000000 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-family: monospace;
          font-size: 12px;
          margin: 0;
          padding: 0;
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 2px 0; }
        hr { margin: 4px 0; border: 1px dashed #000; }
      }
    `,
    onAfterPrint: () => {
      // optional reset
    },
  });

  useEffect(() => {
    if (selectedTransaction && detailedproduct.length > 0) {
      const timer = setTimeout(() => {
        handlePrint?.();
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [selectedTransaction, detailedproduct]);

  const onTransactionClick = async (item) => {
    if (!apiHost) return;
    if (activeTab !== "pending") return;
    if (!item?.transaction_id) return;

    try {
      setIsLoadingDetails(true);

      const res = await fetch(
        `${apiHost}/api/bill_trans_per_table.php?transaction_id=${encodeURIComponent(
          item.transaction_id,
        )}`,
      );

      if (!res.ok) {
        throw new Error("Failed to fetch transaction details");
      }

      const responseData = await res.json();
      const details = Array.isArray(responseData) ? responseData : [];

      if (details.length === 0) {
        alert("No receipt details found for this transaction.");
        return;
      }

      setdetailedproduct(details);
      setSelectedTransaction(item);
    } catch (error) {
      console.error("Fetch error:", error);
      alert("Failed to load billing details.");
    } finally {
      setIsLoadingDetails(false);
    }
  };


  const onOpenDiscountModal = (item, e) => {
    e.stopPropagation();
    setDiscountTransaction(item);
    setShowDiscountModal(true);
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 backdrop-blur-md ${
            isDark ? "bg-slate-950/80" : "bg-slate-200/70"
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={`rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden transition-colors ${
              isDark
                ? "bg-slate-900 border border-white/10"
                : "bg-white border border-slate-200"
            }`}
          >
            <div
              className={`relative p-6 transition-colors ${
                isDark
                  ? "border-b border-white/5 bg-white/5"
                  : "border-b border-slate-200 bg-slate-50"
              }`}
            >
              <button
                onClick={() => setshowtranslistpertable(false)}
                className={`absolute right-6 top-6 p-2 rounded-full transition-all ${
                  isDark
                    ? "bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400"
                    : "bg-slate-100 hover:bg-red-100 hover:text-red-500 text-slate-500"
                }`}
              >
                <FiX size={20} />
              </button>

              <h2
                className={`text-2xl font-black tracking-tight ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Table {tableselected}
              </h2>

              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                Transaction History
              </p>
            </div>

            <div
              className={`p-2 flex gap-2 m-4 rounded-2xl transition-colors ${
                isDark
                  ? "bg-slate-950/50 border border-white/5"
                  : "bg-slate-50 border border-slate-200"
              }`}
            >
              <button
                onClick={() => setActiveTab("pending")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                  activeTab === "pending"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : isDark
                      ? "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <FiClock size={16} /> Pending
              </button>

              <button
                onClick={() => setActiveTab("paid")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                  activeTab === "paid"
                    ? "bg-green-600 text-white shadow-lg shadow-green-600/20"
                    : isDark
                      ? "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <FiCheckCircle size={16} /> Paid
              </button>
            </div>

            <div className="px-6 pb-8">
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {isLoadingDetails ? (
                  <div className="py-12 text-center">
                    <div
                      className={`inline-flex p-4 rounded-full mb-3 ${
                        isDark
                          ? "bg-slate-800/50 text-slate-600"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      <FiPrinter size={32} />
                    </div>
                    <p className="text-slate-500 font-medium italic">
                      Loading receipt details...
                    </p>
                  </div>
                ) : filteredData.length > 0 ? (
                  filteredData.map((item, index) => (
                    <motion.div
                      key={item.transaction_id || index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`group flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer ${
                        isDark
                          ? "bg-slate-800/40 border border-white/5 hover:border-blue-500/50 hover:bg-slate-800"
                          : "bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-white"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold uppercase tracking-tighter text-slate-500">
                          Order ID
                        </p>
                        <p
                          className={`font-mono font-medium ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}
                        >
                          {item.transaction_id}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {activeTab === "pending" && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => onOpenDiscountModal(item, e)}
                              className="p-3 bg-amber-500/10 text-amber-500 rounded-xl hover:bg-amber-500 hover:text-white transition-all"
                              title="Add Discount"
                            >
                              <FiPercent size={18} />
                            </button>

                            <div
                              onClick={() => onTransactionClick(item)}
                              className="p-3 bg-blue-500/10 text-blue-500 rounded-xl group-hover:bg-blue-500 group-hover:text-white transition-all"
                            >
                              <FiPrinter size={18} />
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="py-12 text-center">
                    <div
                      className={`inline-flex p-4 rounded-full mb-3 ${
                        isDark
                          ? "bg-slate-800/50 text-slate-600"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      <FiClock size={32} />
                    </div>
                    <p className="text-slate-500 font-medium italic">
                      No {activeTab} transactions found.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showDiscountModal && discountTransaction && (
      <ModalDiscountTransaction
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        transaction={discountTransaction}
        apiHost={apiHost}
        isDark={isDark}
        dateFrom={dateFrom}
        billingNo={
          discountTransaction?.billing_no ||
          discountTransaction?.billingNo ||
          ""
        }
      />
        )}
      </AnimatePresence>

      {selectedTransaction && detailedproduct.length > 0 && (
        <div style={{ display: "none" }}>
          <Receipt
            ref={componentRef}
            transaction={selectedTransaction}
            detailedproduct={detailedproduct}
          />
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDark ? "#1e293b" : "#cbd5e1"};
          border-radius: 10px;
        }
      `}</style>
    </>
  );
};

export default ModalTrans_List;
