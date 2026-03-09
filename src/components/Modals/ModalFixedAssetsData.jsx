import React, { useEffect } from "react";
import useCustomAgingInfiniteQuery from "../../hooks/useCustomAgingInfiniteQuery";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalFixedAssetsData = ({
  setIsFixedAssetsData,
  busunitSelected,
  description,
}) => {
  const {
    data: fixedAssetsData,
    isFetchingNextPage: fixedAssetsisFetchingNextPage,
    fetchNextPage: fixedAssetsfetchNextPage,
    hasNextPage: fixedAssetshasNextPage, // To check if more data is available
    refetch: fixedAssetsDataRefetch,
  } = useCustomAgingInfiniteQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_INFINITE_READ_FIXED_ASSET_DATA_ENDPOINT, // URL
    "fixedassetdata", // Query key
    description, // Search (description)
    0, // Min value (set to 0)
    0, // Max value (set to 0)
    busunitSelected // Business unit code
  );
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Initial data fetch; runs once on mount
    fixedAssetsDataRefetch();
    queryClient.resetQueries({ queryKey: ["fixedassetdata"] }); // Correct key to avoid mis-resetting
  }, [queryClient, fixedAssetsDataRefetch]); // Add necessary dependencies

  return (
    <div className="fixed top-0 left-0 z-20 w-screen h-screen bg-zinc-800 bg-opacity-50 flex items-center justify-center">
      <div className="w-full max-w-3xl p-4">
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-br from-darkerPrimary via-darkPrimary to-medPrimary p-6 text-center text-white rounded-t-lg">
            <motion.h1
              className="text-2xl font-semibold"
              initial={{ opacity: 0, scale: 0, rotate: -180 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.5 }}
            >
              Fixed Assets Data
            </motion.h1>
          </div>

          <div className="p-6 space-y-4">
            <div className="lg:flex hidden flex-col lg:flex-row font-semibold text-zinc-600 justify-evenly items-center bg-white border py-3 hover:scale-95 hover:bg-softPrimary duration-200 cursor-pointer">
              <p className="text-center w-2/12">Class</p>
              <p className="text-center w-3/12">Description</p>
              <p className="text-center w-1/12">Qty</p>
              <p className="text-center w-1/12">Useful Life</p>
              <p className="text-center w-2/12">Purchase Date</p>
              <p className="text-center w-2/12">Residual Value</p>
              <p className="text-center w-3/12">Total Carrying Value</p>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-4">
              {fixedAssetsData &&
                fixedAssetsData.pages.map((page, index) => (
                  <React.Fragment key={index}>
                    {page.items.map((item, itemIndex) => (
                      <div
                        key={`${item.id}-${itemIndex}`} // Ensure unique keys, use item.id if available
                        className="flex flex-col lg:flex-row justify-between items-center bg-white border border-gray-200 rounded-lg shadow-sm p-4 hover:scale-95 hover:bg-softPrimary duration-200 cursor-pointer"
                      >
                        <p className="text-center text-darkerPrimary text-sm w-2/12">
                          {item.class}
                        </p>
                        <p className="text-center text-zinc-600 text-sm w-3/12 font-medium">
                          {item.description}
                        </p>
                        <p className="text-center text-darkerPrimary text-sm w-1/12">
                          {item.quantity}
                        </p>
                        <p className="text-center text-darkerPrimary text-sm w-1/12">
                          {item.usefullifeinmos}
                        </p>
                        <p className="text-center text-zinc-600 text-sm w-2/12">
                          {item.purchasedate}
                        </p>
                        <p className="text-center text-zinc-600 text-sm italic w-2/12">
                          {parseFloat(item.residualvalue).toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </p>
                        <p className="text-center text-zinc-600 text-sm italic w-3/12">
                          {parseFloat(item.total_carrying_value).toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </p>
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              <button
                className="flex border border-darkerPrimary rounded-sm w-fit self-end bg-white p-2 hover:bg-darkPrimary hover:text-white duration-200"
                onClick={() => fixedAssetsfetchNextPage()} // Fetch next page without replacing data
                disabled={
                  !fixedAssetshasNextPage || fixedAssetsisFetchingNextPage
                }
              >
                {fixedAssetsisFetchingNextPage ? "Loading..." : "See More..."}
              </button>
            </div>

            <div className="flex justify-center mt-6">
              <button
                type="button"
                className="px-6 py-2 bg-red-500 text-white rounded-md hover:scale-95 duration-300"
                onClick={() => setIsFixedAssetsData(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalFixedAssetsData;
