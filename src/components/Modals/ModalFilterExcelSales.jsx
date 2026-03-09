import React, { useState, useEffect } from "react";
import useCustomQuery from "../../hooks/useCustomQuery";
import Dropdown from "../Dropdown/Dropdown";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

function ModalFilterExcelSales({ isOpen, onClose }) {
  // const [excelToken, setExcelToken] = useState("");
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const [busunitSelectedClass, setSelectedBusunitName] = useState("");
  const [busUnitClass, setBusUnitClass] = useState("");

  const [datecurrentmodate, setdatecurrentmodate] = useState(""); // Current date input state
  const [isLoadingCSV, setCSVIsLoading] = useState(false);
  const [filteredBusUnits, setFilteredBusUnits] = useState(null);
  const [errorMessage, setErrorMessage] = useState(""); // State for error messages
  const { toggleAuthToFalse, firstName, roles } = useZustandLoginCred();
  const values = [
    { display: "Franchisee", value: "STORE" },
    { display: "Warehouse", value: "COMMI" },
  ];
  const fetchCSVSales = async () => {
    setCSVIsLoading(true);
    setErrorMessage("");

    try {
      const queryParams = new URLSearchParams({
        // exceltoken: excelToken,
        busunitclass: busUnitClass,
        Date: datecurrentmodate,
      });

      const urls = `${
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_SALES_PER_BRANCH_ENDPOINT
      }?${queryParams.toString()}`;

      const response = await fetch(urls, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("access_token"),
        },
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      // Get the response as text since it's already in CSV format
      const data = await response.text();

      // Parse the CSV text into rows
      const rows = data.split("\n");

      // Get headers from the first row and clean them
      const headers = rows[0].split("\t").map((header) => header.trim());

      // Process the remaining rows
      const processedRows = rows.slice(1).map((row) => {
        const values = row.split("\t");
        // Ensure each row has the same number of columns as headers
        while (values.length < headers.length) {
          values.push(""); // Add empty values for missing columns
        }
        return values.join("\t");
      });

      // Combine headers and processed rows
      const csvContent = [rows[0], ...processedRows].join("\n");

      // Create and download the CSV file
      createAndDownloadCSV(csvContent, "Monthly_sales.csv");
    } catch (error) {
      console.error("Error fetching data:", error);
      setErrorMessage(`Error: ${error.message}`);
      createAndDownloadCSV("No data available", "empty_monthly_sales.csv");
    } finally {
      setCSVIsLoading(false);
    }
  };
  const createAndDownloadCSV = (csvContent, fileName) => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-800 bg-opacity-50 p-10">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">Filter Options</h2>

            <div className="mb-4">
              <label className="block text-gray-700">Class</label>
              <Dropdown
                label={""}
                value={busunitSelectedClass}
                isRequired={false}
                optionsList={values}
                optionsField01={"value"}
                optionsField02={"display"}
                allowCustom={false}
                enableBrandColor={false}
                onChange={(value, display) => {
                  setBusUnitClass(value), setSelectedBusunitName(display);
                }}
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700">Date</label>
              <input
                type="date"
                value={datecurrentmodate}
                onChange={(e) => setdatecurrentmodate(e.target.value)}
                className="mt-1 p-2 w-full border border-gray-300 rounded"
              />
            </div>

            {errorMessage && ( // Display error message if there's an error
              <div className="mb-4 text-red-600">{errorMessage}</div>
            )}

            <div className="flex justify-end space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  fetchCSVSales();
                }}
                className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-600"
              >
                {isLoadingCSV ? "Loading..." : "Download CSVs"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ModalFilterExcelSales;
