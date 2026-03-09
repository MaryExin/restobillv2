import React from "react";
import useZustandSideMenu from "../../context/useZustandSideMenu";
import {
  BsFileText,
  BsCheckCircleFill,
  BsClockFill,
  BsExclamationCircleFill,
} from "react-icons/bs";
import useZustandAPIEndpoint from "../context/useZustandAPIEndpoint";

const STATUS_STYLES = {
  Approved: "bg-green-100 text-green-700",
  Pending: "bg-yellow-100 text-yellow-700",
  Skipped: "bg-red-100   text-red-700",
  Delivered: "bg-green-100 text-green-700",
  ForDispatch: "bg-yellow-100 text-yellow-700",
  Shipped: "bg-amber-600 text-white",
  Unpaid: "bg-yellow-500 text-zinc-700",
  Partial: "bg-green-500 text-zinc-700",
  Paid: "bg-green-700 text-white",
  // add any others you need
};

export default function SummaryCard({
  item,
  codePrefix, // e.g. "PR", "PO", "PD", "DL", "BL"
  dateField, // e.g. "pr_created_date", "production_started", "date_requested", "billing_date"
  approvedField, // e.g. "pr_approved_date", "production_completed", "date_delivered"
  statusField, // e.g. "pr_status", "po_status", "production_status", "delivery_status", "billing_status"
  onClick,
  extraFooter, // render any extra footer lines (e.g. approved-by)
}) {
  const code = item.prd_queue_code.trim();
  const status = item[statusField];
  const badgeClass = STATUS_STYLES[status] || "bg-gray-100 text-gray-700";

  const { endpoint, setEndPoint } = useZustandAPIEndpoint();

  return (
    <div
      onClick={onClick}
      className="relative m-2 bg-white rounded-2xl shadow-lg hover:shadow-xl transition transform hover:-translate-y-1 cursor-pointer border border-gray-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <BsFileText className="text-blue-600" size={20} />
          </div>
          <h3 className="text-lg font-semibold">
            {codePrefix}-{code}
          </h3>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${badgeClass}`}
        >
          {status}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-2 text-gray-600 text-sm">
        <div>
          <strong>Requested:</strong> {item[dateField]}
        </div>
        {item[approvedField] && (
          <div>
            <strong>Approved:</strong> {item[approvedField]}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl text-gray-700 text-sm space-y-1">
        <div>
          <strong>Requested by:</strong> {item.orderedbyname}
        </div>
        <div>
          <strong>Payee:</strong> {item.payeename}
        </div>
        <div>
          <strong>Prepared by:</strong> {item.full_name}
        </div>
        {extraFooter}
      </div>
    </div>
  );
}
