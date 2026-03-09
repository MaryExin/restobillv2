import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { HiX, HiTrash, HiViewList, HiTag, HiCreditCard } from "react-icons/hi";
import { TiArrowBack } from "react-icons/ti";
import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import { LinearProgress } from "@mui/material";
import ModalYesNoReusable from "./ModalYesNoReusable";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalSalesSummary = ({
  setIsModalSalesSummaryOpen,
  salesSummaryData,
  salesId,
  branchSelected,
  voidSalesData,
  resetQueries,
  resetSales,
  selectedPOS,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const [isSalesPerTransaction, setIsSalesPerTransaction] = useState(false);
  const [voidId, setVoidId] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const {
    data: salesPerTransactionData,
    isLoading: salesPerTransactionIsLoading,
    mutate: salesPerTransactionMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_READ_SALES_PER_TRANSACTION_DATA_ENDPOINT,
    "POST"
  );

  useEffect(() => {
    if (salesPerTransactionData) setIsSalesPerTransaction(true);
  }, [salesPerTransactionData]);

  useEffect(() => {
    if (salesId !== undefined) {
      salesPerTransactionMutate({ sales_summary_id: salesId });
    }
  }, [salesId]);

  const {
    data: voidData,
    isLoading: voidIsLoading,
    mutate: voidMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MUTATE_VOID_SALES_ENDPOINT,
    "PATCH"
  );

  const handleVoid = () => voidMutate({ type: "cashier", salesid: voidId });

  useEffect(() => {
    if (voidData) {
      alert(`Requested to delete ${voidId}`);
      resetQueries();
      resetSales();
      setIsModalSalesSummaryOpen(false);
    }
  }, [voidData]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      {isConfirmOpen && (
        <ModalYesNoReusable
          header="Confirmation"
          message="Request to delete this record?"
          setYesNoModalOpen={setIsConfirmOpen}
          triggerYesNoEvent={handleVoid}
        />
      )}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-br from-colorBrand to-colorBrandSecondary p-4">
          <h2 className="text-white text-lg font-semibold">Sales Summary</h2>
          <button
            onClick={() => setIsModalSalesSummaryOpen(false)}
            className="text-white hover:text-gray-200 transition"
          >
            <HiX className="w-6 h-6" />
          </button>
        </div>

        {/* Loading */}
        {(salesPerTransactionIsLoading || voidIsLoading) && (
          <LinearProgress color="inherit" />
        )}

        <div className="p-4 space-y-6 overflow-y-auto max-h-[80vh]">
          {isSalesPerTransaction ? (
            <>
              {/* Sales per Transaction Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="flex items-center text-md text-zinc-600 font-semibold mb-2">
                    <HiViewList className="w-5 h-5 mr-2 text-colorBrand" />
                    Sales per Transaction
                  </h3>
                  <button
                    className="mx-1 flex text-md text-zinc-600 font-semibold"
                    onClick={() => setIsSalesPerTransaction(false)}
                  >
                    <TiArrowBack className="w-6 h-6 text-colorBrand" />
                    Back
                  </button>
                </div>

                <div className="overflow-auto bg-white rounded-md shadow-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-colorBrandLighter">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                          Name
                        </th>
                        <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                          Date
                        </th>
                        <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                          Qty
                        </th>
                        <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                          UOM
                        </th>
                        <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                          SRP Vat Inc
                        </th>
                        <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                          VAT
                        </th>
                        <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                          TTL Vat Inc
                        </th>
                        {/* <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                          Delete
                        </th> */}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {salesPerTransactionData.salesdata.map((item, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {item.description}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">
                            {item.transdate}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">
                            {item.qty}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">{`${item.uomval} ${item.uom}`}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">
                            {item.total_sales}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">
                            {item.vat}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">
                            {item.total_sales}
                          </td>
                          {/* <td className="px-4 py-2 text-center">
                            <HiTrash
                              onClick={() => {
                                setVoidId(item.sales_id);
                                setIsConfirmOpen(true);
                              }}
                              className="w-5 h-5 text-red-500 hover:text-red-700 cursor-pointer"
                            />
                          </td> */}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Discounts Summary Table */}
              <div>
                <h3 className="flex items-center text-md text-zinc-600 font-semibold mb-2">
                  <HiTag className="w-5 h-5 mr-2 text-colorBrand" />
                  Discounts summary
                </h3>
                <div className="overflow-auto bg-white rounded-md shadow-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-colorBrandLighter">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                          Name
                        </th>
                        <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                          Date
                        </th>
                        <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                          TTL
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {salesPerTransactionData.discountsdata.map((d, j) => (
                        <tr key={j} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {d.description}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">
                            {d.transdate}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">
                            {d.amount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payments Summary Table */}
              <div>
                <h3 className="flex items-center text-md text-zinc-600 font-semibold mb-2">
                  <HiCreditCard className="w-5 h-5 mr-2 text-colorBrand" />
                  Payments summary
                </h3>
                <div className="overflow-auto bg-white rounded-md shadow-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-colorBrandLighter">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                          Name
                        </th>
                        <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                          Date
                        </th>
                        <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                          TTL
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {salesPerTransactionData.mopData.map((m, k) => (
                        <tr key={k} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {m.description}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">
                            {m.transdate}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">
                            {m.amount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* Sales Summary Listing */
            <div>
              <h3 className="flex items-center text-md text-zinc-600 font-semibold mb-2">
                <HiViewList className="w-5 h-5 mr-2 text-colorBrand" />
                Sales Summary
              </h3>
              <div className="overflow-auto bg-white rounded-md shadow-md">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-colorBrandLighter">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                        Sales ID
                      </th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                        Ttl Sales Vat ex
                      </th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                        Ttl Vat
                      </th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                        Ttl Disc
                      </th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                        Net Sls
                      </th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                        Ttl Other Mop
                      </th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                        Cash rc
                      </th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                        Change
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {salesSummaryData
                      .filter((item) => item.poscode === selectedPOS)
                      .map((data, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() =>
                            salesPerTransactionMutate({
                              sales_summary_id: data.sales_id,
                            })
                          }
                        >
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {data.sales_id}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">
                            {data.total_sales}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">
                            {data.total_vat}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">
                            {data.total_discounts}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">
                            {data.net_sales}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">
                            {data.total_other_mop}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">
                            {data.cash_received}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">
                            {data.change}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-center">
                            {voidSalesData &&
                            voidSalesData.findIndex(
                              (item) => item.sales_id === data.sales_id
                            ) !== -1 ? (
                              // Void status Pending

                              <div className="flex flex-col lg:flex-row space-x-2 items-center">
                                <div className=" text-white px-2 py-1 rounded-md  duration-300">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className="w-6 h-6 text-yellow-700 hover:opacity-70 duration-300 cursor-pointer bg-yellow-200 shadow-lg shadow-zinc-400 rounded-md p-1"
                                    onClick={() => alert("Void for approval")}
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </div>
                              </div>
                            ) : (
                              //For void
                              <div className="flex flex-col lg:flex-row space-x-2 items-center">
                                <div className=" text-white px-2 py-1 rounded-md  duration-300">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className="w-6 h-6 text-red-500 hover:opacity-70 duration-300 cursor-pointer bg-red-200 shadow-lg shadow-zinc-400 rounded-md p-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setVoidId(data.sales_id); // First set the void ID
                                      setIsConfirmOpen(true); // Then open the modal
                                    }}
                                  >
                                    <path d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v.75c0 1.036.84 1.875 1.875 1.875h17.25c1.035 0 1.875-.84 1.875-1.875v-.75C22.5 3.839 21.66 3 20.625 3H3.375z" />
                                    <path
                                      fillRule="evenodd"
                                      d="M3.087 9l.54 9.176A3 3 0 006.62 21h10.757a3 3 0 002.995-2.824L20.913 9H3.087zm6.133 2.845a.75.75 0 011.06 0l1.72 1.72 1.72-1.72a.75.75 0 111.06 1.06l-1.72 1.72 1.72 1.72a.75.75 0 11-1.06 1.06L12 15.685l-1.72 1.72a.75.75 0 11-1.06-1.06l1.72-1.72-1.72-1.72a.75.75 0 010-1.06z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ModalSalesSummary;
