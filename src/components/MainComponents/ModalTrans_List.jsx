import React, { useState, useRef, useEffect } from "react";
import { useReactToPrint } from "react-to-print";
import {
  FiX,
  FiPrinter,
  FiClock,
  FiCheckCircle,
  FiPercent,
  FiGitBranch,
  FiCornerUpLeft,
} from "react-icons/fi";
import Receipt from "./Receipt";
import { useTheme } from "../../context/ThemeContext";
import useApiHost from "../../hooks/useApiHost";
import ModalDiscountTransaction from "./ModalDiscountTransaction";
import SplitBillModal from "./SplitBillModal";
import UnsplitBillModal from "./UnsplitBillModal";

const ModalTrans_List = ({
  tableselected,
  data = [],
  setshowtranslistpertable,
  dateFrom,
  onTransactionsChanged,
}) => {
  const apiHost = useApiHost();
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [detailedproduct, setdetailedproduct] = useState([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountTransaction, setDiscountTransaction] = useState(null);
  const [transactions, setTransactions] = useState(data);
  const [splitTransaction, setSplitTransaction] = useState(null);
  const [splitResult, setSplitResult] = useState(null);
  const [unsplitTransaction, setUnsplitTransaction] = useState(null);
  const [unsplitResult, setUnsplitResult] = useState(null);
  const componentRef = useRef(null);
  const refreshVersion = useRef(0);
  const { isDark } = useTheme();

  useEffect(() => { setTransactions(data); }, [data]);

  const refreshTransactions = () => {
    const version = ++refreshVersion.current;
    onTransactionsChanged?.();
    const params = new URLSearchParams({ date: dateFrom, table_number: tableselected });
    fetch(`${apiHost}/api/transactio_per_table.php?${params}`)
      .then(async (response) => {
        const refreshed = await response.json();
        if (version === refreshVersion.current && response.ok && (Array.isArray(refreshed) || Array.isArray(refreshed?.data))) {
          setTransactions(Array.isArray(refreshed) ? refreshed : refreshed.data);
        }
      })
      .catch((error) => console.error("Refresh split transactions failed:", error));
  };

  const closeStaleBill = () => {
    setShowDiscountModal(false);
    setDiscountTransaction(null);
    setSelectedTransaction(null);
    setdetailedproduct([]);
    setSplitTransaction(null);
    setUnsplitTransaction(null);
    setActiveTab("pending");
  };

  const onSplitSuccess = (result) => {
    const child = { ...result.transaction, split_source_transaction_id: result.source_transaction_id };
    closeStaleBill();
    setSplitResult({ ...result, transaction: child });
    setUnsplitResult(null);
    // Update immediately even if refreshing the table list fails afterward.
    setTransactions((current) => {
      const rows = Array.isArray(current) ? current : [];
      return [
        ...rows.filter((item) => String(item.transaction_id) !== String(result.source_transaction_id)
          && String(item.transaction_id) !== String(result.transaction_id)),
        { ...rows.find((item) => String(item.transaction_id) === String(result.source_transaction_id)), ...result.source_transaction },
        child,
      ];
    });
    refreshTransactions();
  };

  const onUnsplitSuccess = (result) => {
    closeStaleBill();
    setSplitResult(null);
    setUnsplitResult(result);
    setTransactions((current) => {
      const rows = Array.isArray(current) ? current : [];
      return [
        ...rows.filter((item) => String(item.transaction_id) !== String(result.removed_transaction_id)
          && String(item.transaction_id) !== String(result.source_transaction_id)),
        { ...rows.find((item) => String(item.transaction_id) === String(result.source_transaction_id)), ...result.source_transaction },
      ];
    });
    refreshTransactions();
  };

  const filteredData = Array.isArray(transactions)
    ? transactions.filter((item) =>
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
      <>
        <div
          className={(`fixed inset-0 z-[99999] flex items-center justify-center p-4 backdrop-blur-md ${
            isDark ? "bg-slate-950/80" : "bg-slate-200/70"
          }`) + " ui-fade-in"}
        >
          <div
            className={(`rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden transition-colors ${
              isDark
                ? "bg-slate-900 border border-white/10"
                : "bg-white border border-slate-200"
            }`) + " ui-scale-in"}
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
                {tableselected}
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
              {splitResult && (
                <div role="status" className="mb-4 rounded-xl border border-softPrimary p-3 text-sm font-[Poppins-Regular]">
                  <p>Bill split successfully. New transaction: {splitResult.transaction_id}.</p>
                  <button type="button" onClick={() => {
                    setDiscountTransaction(splitResult.transaction);
                    setShowDiscountModal(true);
                  }} className="mt-2 rounded-lg bg-colorBrand px-3 py-2 text-xs font-[Poppins-Medium] text-colorBrandLighter">
                    Bill new transaction
                  </button>
                  <button type="button" onClick={() => setUnsplitTransaction(splitResult.transaction)}
                    className="ml-2 mt-2 rounded-lg border border-softPrimary px-3 py-2 text-xs font-[Poppins-Medium]">
                    Unsplit
                  </button>
                </div>
              )}
              {unsplitResult && (
                <div role="status" className="mb-4 rounded-xl border border-softPrimary p-3 text-sm font-[Poppins-Regular]">
                  <p>Split bill {unsplitResult.removed_transaction_id} discarded. Products returned to transaction {unsplitResult.source_transaction_id}.</p>
                  <button type="button" onClick={() => {
                    setDiscountTransaction(unsplitResult.source_transaction);
                    setShowDiscountModal(true);
                  }} className="mt-2 rounded-lg bg-colorBrand px-3 py-2 text-xs font-[Poppins-Medium] text-colorBrandLighter">
                    Bill original transaction
                  </button>
                </div>
              )}
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
                    <div
                      key={item.transaction_id || index}
                      onClick={(e) => onOpenDiscountModal(item, e)}
                      className={(`group flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl transition-all cursor-pointer ${
                        isDark
                          ? "bg-slate-800/40 border border-white/5 hover:border-blue-500/50 hover:bg-slate-800"
                          : "bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-white"
                      }`) + " ui-slide-in-left"}
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

                      <div className="flex flex-wrap items-center gap-2">
                        {activeTab === "pending" && (
                          <>
                            {Number(item.split_source_transaction_id) > 0 && (
                              <button type="button" onClick={(event) => { event.stopPropagation(); setUnsplitTransaction(item); }}
                                className="flex items-center gap-1 rounded-xl border border-softPrimary px-2 py-3 text-xs text-colorBrand font-[Poppins-Medium]"
                                title={`Return all products to transaction ${item.split_source_transaction_id}`}>
                                <FiCornerUpLeft size={16} /> Unsplit
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(event) => { event.stopPropagation(); setSplitTransaction(item); }}
                              className="flex items-center gap-1 rounded-xl border border-softPrimary px-2 py-3 text-xs text-colorBrand font-[Poppins-Medium]"
                              title="Move selected products to a separate bill"
                            >
                              <FiGitBranch size={16} /> Split bill
                            </button>
                            <button
                              type="button"
                              onClick={(e) => onOpenDiscountModal(item, e)}
                              className="p-3 bg-amber-500/10 text-amber-500 rounded-xl hover:bg-amber-500 hover:text-white transition-all"
                              title="Add Discount"
                            >
                              <FiPercent size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
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
          </div>
        </div>
      </>

      <>
        {showDiscountModal && discountTransaction && (
          <ModalDiscountTransaction
            isOpen={showDiscountModal}
            onClose={() => setShowDiscountModal(false)}
            transaction={discountTransaction}
            apiHost={apiHost}
            isDark={isDark}
            dateFrom={dateFrom}
            onSplitRequest={activeTab === "pending" ? () => setSplitTransaction(discountTransaction) : undefined}
            onUnsplitRequest={activeTab === "pending" && Number(discountTransaction.split_source_transaction_id) > 0
              ? () => setUnsplitTransaction(discountTransaction) : undefined}
            billingNo={
              discountTransaction?.billing_no ||
              discountTransaction?.billingNo ||
              ""
            }
          />
        )}
      </>

      {splitTransaction && (
        <SplitBillModal transaction={splitTransaction} apiHost={apiHost}
          onClose={() => setSplitTransaction(null)} onSuccess={onSplitSuccess} />
      )}

      {unsplitTransaction && (
        <UnsplitBillModal transaction={unsplitTransaction} apiHost={apiHost}
          onClose={() => setUnsplitTransaction(null)} onSuccess={onUnsplitSuccess} />
      )}

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
