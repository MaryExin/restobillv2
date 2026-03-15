import React, { useMemo, useState } from "react";
import {
  FaFileAlt,
  FaTrash,
  FaUndo,
  FaEdit,
  FaSyncAlt,
  FaSearch,
  FaFilter,
} from "react-icons/fa";

// --- MGA IMPORT (FIXED PATHS) ---
import PosReports from "./PosReports"; 
import PosModal from "./Common/PosModal"; 

const sampleTransactions = [
  {
    id: 1,
    transactionId: "1000001265",
    invoiceNo: "0",
    transactionDate: "February 26, 2026 11:21 AM",
    transactionType: "PRODUCT",
    referenceTag: "Table 01",
    totalAmount: 1250,
    discount: 0,
    vatExemption: 0,
    otherCharges: 0,
    status: "pending",
  },
];

const peso = (value) =>
  `₱ ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const statusColors = {
  paid: "bg-[#2956c8]",
  pending: "bg-[#17951f]",
  voided: "bg-[#ff1f1f]",
};

export default function TransactionRecord() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  
  // Modal States
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [remarksValue, setRemarksValue] = useState("");
  const [modalData, setModalData] = useState({
    isOpen: false,
    title: "",
    type: "", 
    rowData: null,
  });

  const filteredTransactions = useMemo(() => {
    return sampleTransactions.filter((item) => {
      const matchesFilter =
        filter === "all" ? true : item.status.toLowerCase() === filter;

      const keyword = search.trim().toLowerCase();
      const matchesSearch =
        !keyword ||
        item.transactionId.toLowerCase().includes(keyword) ||
        item.invoiceNo.toLowerCase().includes(keyword) ||
        item.transactionDate.toLowerCase().includes(keyword) ||
        item.transactionType.toLowerCase().includes(keyword) ||
        item.referenceTag.toLowerCase().includes(keyword);

      return matchesFilter && matchesSearch;
    });
  }, [filter, search]);

  const totalTransactions = filteredTransactions.length;

  const totalSales = useMemo(() => {
    return filteredTransactions.reduce(
      (sum, item) => sum + Number(item.totalAmount || 0),
      0
    );
  }, [filteredTransactions]);

  // Handlers
  const handleOpenModal = (type, row) => {
    setRemarksValue(""); 
    setModalData({
      isOpen: true,
      title: type === "VOID" ? "Void Remarks" : "Refund Remarks",
      type: type,
      rowData: row,
    });
  };

  const handleCloseModal = () => {
    setModalData((prev) => ({ ...prev, isOpen: false }));
    setRemarksValue("");
  };

  const handleConfirmAction = () => {
    console.log(
      `Action: ${modalData.type}, ID: ${modalData.rowData?.transactionId}, Remarks: ${remarksValue}`
    );
    handleCloseModal();
  };

  const handleRefresh = () => console.log("Refresh records");
  const handleFilterClick = () => console.log("Open advanced filter");
  const handleEdit = (row) => console.log("Edit:", row);
  const handleView = (row) => console.log("View:", row);

  return (
    <div className="h-[calc(100vh-210px)] w-full overflow-hidden rounded-[8px] border border-slate-300 bg-[#efefef] shadow-[0_6px_18px_rgba(15,23,42,0.08)]">
      
      {/* 1. REPORTS MODAL */}
      <PosReports 
        open={isReportsOpen} 
        onClose={() => setIsReportsOpen(false)} 
      />

      {/* 2. VOID/REFUND REMARKS MODAL (PosModal) */}
      <PosModal
        open={modalData.isOpen}
        title={modalData.title}
        width="max-w-[500px]"
        height="min-h-[420px]"
        values={{ remarks: remarksValue }}
        onChange={(name, val) => setRemarksValue(val)}
        onClose={handleCloseModal}
        fields={[
          {
            name: "remarks",
            type: "textarea",
            placeholder: "Input Text Here...",
          },
        ]}
        buttons={[
          {
            label: "Cancel",
            variant: "secondary",
            onClick: handleCloseModal,
          },
          {
            label: "Continue",
            variant: "primary",
            onClick: handleConfirmAction,
          },
        ]}
      />

      <div className="flex flex-col h-full">
        {/* Header Section */}
        <div className="flex min-h-[40px] items-center justify-between bg-[#d96511] px-4 text-white">
          <div className="text-[18px] font-black tracking-tight uppercase">
            Transaction Records
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsReportsOpen(true)}
              className="h-[30px] rounded-full bg-white/20 px-4 text-[12px] font-bold text-white transition hover:bg-white/30"
            >
              CHOOSE REPORT
            </button>

            <div className="relative">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-[32px] min-w-[110px] rounded-[10px] border border-white/60 bg-white px-4 pr-8 text-[13px] font-semibold text-slate-700 outline-none"
              >
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="voided">Voided</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              className="grid h-[30px] w-[30px] place-items-center rounded-full text-white transition hover:bg-white/10"
              title="Refresh"
            >
              <FaSyncAlt className="text-[18px]" />
            </button>

            <button
              type="button"
              onClick={handleFilterClick}
              className="grid h-[30px] w-[30px] place-items-center rounded-full text-white transition hover:bg-white/10"
              title="Filter"
            >
              <FaFilter className="text-[17px]" />
            </button>

            <div className="relative">
              <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-300" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="h-[32px] w-[220px] rounded-full border border-white/60 bg-white pl-9 pr-4 text-[13px] text-slate-700 outline-none placeholder:text-slate-300"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="min-h-0 flex-1 overflow-auto bg-[#efefef]">
          <div className="min-w-[1180px]">
            <div className="grid grid-cols-[110px_1.1fr_0.9fr_1.9fr_1.2fr_1.2fr_1fr_0.8fr_1fr_1fr] border-b border-slate-300 bg-[#f6f6f8] px-3 py-2 text-[12px] font-black uppercase text-slate-700">
              <div>Actions</div>
              <div>Transaction ID</div>
              <div>Invoice#</div>
              <div>Transaction Date</div>
              <div>Transaction Type</div>
              <div>Reference/Tag</div>
              <div>Total Amount</div>
              <div>Discount</div>
              <div>VAT Exemption</div>
              <div>Other Charges</div>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="flex h-[360px] items-center justify-center text-[15px] font-semibold text-slate-400">
                No transaction records found.
              </div>
            ) : (
              filteredTransactions.map((row, index) => (
                <div
                  key={row.id}
                  className={`grid grid-cols-[110px_1.1fr_0.9fr_1.9fr_1.2fr_1.2fr_1fr_0.8fr_1fr_1fr] items-center border-b border-slate-200 px-3 py-2 text-[13px] text-slate-700 ${
                    index % 2 === 0 ? "bg-[#dcdaf1]" : "bg-[#ebe9f8]"
                  }`}
                >
                  <div className="flex items-center gap-2 pr-2">
                    <button
                      type="button"
                      onClick={() => handleView(row)}
                      className="grid h-[24px] w-[24px] place-items-center rounded-[4px] bg-[#8d37d8] text-white transition hover:brightness-110"
                      title="View"
                    >
                      <FaFileAlt className="text-[12px]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenModal("VOID", row)}
                      className="grid h-[24px] w-[24px] place-items-center rounded-[4px] bg-[#f15a24] text-white transition hover:brightness-110"
                      title="Delete / Void"
                    >
                      <FaTrash className="text-[12px]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenModal("REFUND", row)}
                      className="grid h-[24px] w-[24px] place-items-center rounded-[4px] bg-[#22b14c] text-white transition hover:brightness-110"
                      title="Refund"
                    >
                      <FaUndo className="text-[12px]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEdit(row)}
                      className="grid h-[24px] w-[24px] place-items-center rounded-[4px] bg-[#2d88d8] text-white transition hover:brightness-110"
                      title="Edit"
                    >
                      <FaEdit className="text-[12px]" />
                    </button>
                  </div>

                  <div className="font-medium">{row.transactionId}</div>
                  <div className="font-medium">{row.invoiceNo}</div>
                  <div className="font-medium">{row.transactionDate}</div>
                  <div className="font-medium">{row.transactionType}</div>
                  <div className="font-medium">{row.referenceTag}</div>
                  <div className="font-bold">{peso(row.totalAmount)}</div>
                  <div className="font-medium">{peso(row.discount)}</div>
                  <div className="font-medium">{peso(row.vatExemption)}</div>
                  <div className="font-medium">{peso(row.otherCharges)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Section */}
        <div className="border-t border-slate-300 bg-[#efefef] px-4 py-3">
          <div className="flex flex-wrap items-center gap-8 text-[12px] font-semibold">
            <div className="flex items-center gap-2 text-slate-600">
              <span className={`h-[12px] w-[12px] rounded-full ${statusColors.paid}`} />
              <span>Paid Transactions</span>
            </div>
            <div className="flex items-center gap-2 text-[#17951f]">
              <span className={`h-[12px] w-[12px] rounded-full ${statusColors.pending}`} />
              <span>Pending for Payment / Billed</span>
            </div>
            <div className="flex items-center gap-2 text-[#ff1f1f]">
              <span className={`h-[12px] w-[12px] rounded-full ${statusColors.voided}`} />
              <span>Voided / Refunded</span>
            </div>
          </div>

          <div className="flex items-end justify-between mt-3">
            <div className="text-[15px] font-black text-[#2e4a7d]">
              Total Transactions: <span className="ml-2 text-[18px]">{totalTransactions}</span>
            </div>
            <div className="text-right text-[15px] font-black text-[#2e4a7d]">
              Total Sales {peso(totalSales)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}