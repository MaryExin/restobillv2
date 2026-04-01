import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  FaPrint,
  FaTimes,
  FaSyncAlt
} from "react-icons/fa";

function ReprintModal({
  isOpen,
  onClose,
  categoryCode,
  unitCode,
  terminalNumber,
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const fetchReprint = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/z-reading.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryCode,
          unitCode,
          terminalNumber,
          isReprint: true, // 🔥 trigger reprint mode
        }),
      });

      const json = await res.json();

      if (json.success) {
        setData(json.data);
      } else {
        setError(json.message || "Failed to load data");
      }
    } catch (err) {
      console.error(err);
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReprint();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[420px] max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-5">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold tracking-wide">
            Reprint Z Reading
          </h2>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-500"
          >
            <FaTimes />
          </button>
        </div>

        {/* BODY */}
        {loading ? (
          <div className="py-10 text-center animate-pulse">
            Loading...
          </div>
        ) : error ? (
          <div className="py-6 text-center text-red-500">
            {error}

            <div className="mt-3">
              <button
                onClick={fetchReprint}
                className="flex items-center gap-2 px-3 py-1 mx-auto text-white bg-blue-500 rounded"
              >
                <FaSyncAlt /> Retry
              </button>
            </div>
          </div>
        ) : data ? (
          <div className="space-y-2 text-sm">

            {/* DATE */}
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span>{data.reportDate}</span>
            </div>

            <hr />

            {/* SALES */}
            <div className="flex justify-between">
              <span>Gross Sales</span>
              <span>{Number(data.grossAmount).toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span>Discount</span>
              <span>{Number(data.lessDiscount).toFixed(2)}</span>
            </div>

            <div className="flex justify-between font-bold text-green-600">
              <span>Net Sales</span>
              <span>{Number(data.netAmount).toFixed(2)}</span>
            </div>

            <hr />

            {/* CASH */}
            <div className="flex justify-between">
              <span>Cash Sales</span>
              <span>{Number(data.cash).toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span>Opening Fund</span>
              <span>{Number(data.openingFund).toFixed(2)}</span>
            </div>

            <div className="flex justify-between font-semibold">
              <span>Short / Over</span>
              <span>{Number(data.shortOver).toFixed(2)}</span>
            </div>

            <hr />

            {/* OR */}
            <div className="flex justify-between">
              <span>Beginning OR</span>
              <span>{data.begOR}</span>
            </div>

            <div className="flex justify-between">
              <span>Ending OR</span>
              <span>{data.endOR}</span>
            </div>

          </div>
        ) : (
          <div className="py-6 text-center">No Data</div>
        )}

        {/* FOOTER */}
        <div className="flex justify-end gap-2 mt-5">

          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
          >
            Close
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-1 text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            <FaPrint /> Print
          </button>

        </div>

      </div>
    </div>,
    document.body
  );
}

export default ReprintModal;