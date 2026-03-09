import React, { useState, useEffect } from "react";
import useCustomQuery from "../../hooks/useCustomQuery";
import Dropdown from "../Dropdown/Dropdown";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import {
  downloadBlob,
  createAndDownloadCSV,
  createAndDownloadEmptyCSV,
} from "../Modals/utils/downloadHelper";

function ModalFilterExcel({ isOpen, onClose }) {
  // const [excelToken, setExcelToken] = useState("");
  const [busunitSelectedName, setSelectedBusunitName] = useState("");
  const [busUnitCode, setBusUnitCode] = useState("");
  const [filterOptions, setFilterOptions] = useState("");
  const [datelastyearbeg, setdatelastyearbeg] = useState(""); // State for the start of last year
  const [datecurrentmodate, setdatecurrentmodate] = useState(""); // Current date input state
  const [isLoadingCSV, setCSVIsLoading] = useState(false);
  const [filteredBusUnits, setFilteredBusUnits] = useState(null);
  const [errorMessage, setErrorMessage] = useState(""); // State for error messages
  const { toggleAuthToFalse, firstName, roles } = useZustandLoginCred();

  // Query BusUnits | Stores for role checking

    const { data: busunits, isLoading: busunitsIsLoading } = useCustomQuery(
      localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_PARAMS_FILTER_EXCEL_ENDPOINT,
      "busunits"
    );



  // const {
  //   data: busunits,
  //   isLoading: busunitsIsLoading,
  //   isError: busunitsIsError,
  //   isSuccess: busunitsIsSuccess,
  //   refetch: busunitsRefetch,
  // } = useCustomQuery(
  //   import.meta.env.VITE_PARAMS_BUSUNITS_READ_ENDPOINT,
  //   "busunits"
  // );
  const filteroptions = [
    { value: "Area", key: "area_name" , code: "areacode" },
    { value: "Corporation", key: "corp_name" , code: "corpcode"},
    { value: "Brand", key: "brand_name" , code: "brandcode"},
    { value: "Busunit", key: "name" , code: "busunitcode"},
  ];

  const [selectedFilter, setSelectedFilter] = useState("Busunit"); // Default filter
  const [filteredOptions, setFilteredOptions] = useState([]);

//  useEffect(() => {
//   if (Array.isArray(busunits) && busunits.length > 0) {
//     const selectedKey = filteroptions.find(
//       (opt) => opt.value === selectedFilter
//     )?.key;

//     if (selectedKey) {
//       const filteredRows = roles[0].reduce((acc, role) => {
//         const matchingBusunit = busunits.find(
//           (busunit) => busunit.busunitcode === role.rolename
//         );

//         if (matchingBusunit) {
//           acc.push(matchingBusunit); // Keep all properties of matchingBusunit
//         }
//         return acc;
//       }, []);

//       setFilteredBusUnits(filteredRows);
//       console.log(filteredRows);
//     }
//   }
// }, [busunits, selectedFilter]);

 const handleFilterChange = (selectedID, selectedValue) => {
    setFilterOptions(selectedID);
    setSelectedFilter("");
    const selectedKey = filteroptions.find((opt) => opt.value === selectedValue)?.key;
    const selectedCode = filteroptions.find((opt) => opt.value === selectedValue)?.code;
    
    
    if (selectedKey) {
  const uniqueOptions = Array.from(new Set(busunits.map((item) => item[selectedKey])));
  const uniqueOptions1 = Array.from(new Set(busunits.map((item) => item[selectedCode])));

  // Combine display value with code:
  const combinedOptions = busunits.map((item) => ({
    value: item[selectedKey],
    code: item[selectedCode],
  }));

  // Remove duplicates by value:
  const uniqueCombined = Array.from(
    new Map(combinedOptions.map(item => [item.value, item])).values()
  );

  setFilteredOptions(uniqueCombined.map((option) => ({
    value: option.value,
    key: option.value, // if needed
    code: option.code
  })));
    }

  };


  useEffect(() => {
    const currentDate = new Date(datecurrentmodate);
    if (!isNaN(currentDate.getTime())) {
      const lastYearBeg = new Date(currentDate.getFullYear() - 2, 0, 1); // January 1 of last year
      // Set the state in YYYY-MM-DD format
      setdatelastyearbeg(lastYearBeg.toLocaleDateString("en-CA")); // This gives YYYY-MM-DD format
    } else {
      setdatelastyearbeg(""); // Reset if the date is invalid
    }
  }, [datecurrentmodate]);

  const fetchCSVAccountingDownload = async () => {
    setCSVIsLoading(true);
    setErrorMessage("");

    if (busUnitCode === "" || datecurrentmodate === "") {
      setErrorMessage("Please fill in all fields.");
      setCSVIsLoading(false);
      return;
    }

    try {
      const queryParams = new URLSearchParams({
        // exceltoken: excelToken,
        busunitcode: busUnitCode,
        filterOptions: filterOptions,
        datelastyearbeg: datelastyearbeg,
        datecurrentmodate: datecurrentmodate,
      });

      const urls = `${
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_ACCOUNTING_TRANSACTION_ENDPOINT
      }?${queryParams.toString()}`;
      console.log(urls);

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

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.message === "Excel token required") {
          setErrorMessage("Token Not Valid");
          return;
        }
        // Handle other JSON responses if needed
      } else {
        const blob = await response.blob();
        downloadBlob(blob, "tbl_accountingtransactions.csv");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setErrorMessage("Error fetching data. Please try again.");
    } finally {
      setCSVIsLoading(false);
    }
  };
  const fetchCSVAllAccountingDownload = async () => {
    setCSVIsLoading(true);
    setErrorMessage("");

    if (busUnitCode === "" || datecurrentmodate === "") {
      setErrorMessage("Please fill in all fields.");
      setCSVIsLoading(false);
      return;
    }

    try {
      const queryParams = new URLSearchParams({
        // exceltoken: excelToken,
        datefrom: datelastyearbeg,
        dateto: datecurrentmodate,
      });

      const urls = `${
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_ALL_ACCOUNTING_TRANSACTION_ENDPOINT
      }?${queryParams.toString()}`;
      console.log(urls);

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

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json(); // Assuming the response is JSON

        // Create CSV content
        const csvRows = [];
        const headers = ["busunitcode", "transdate", "glcode", "amount"]; // Define headers
        csvRows.push(headers.join(",")); // Add headers to the first row

        for (const row of data) {
          const values = headers.map((header) => {
            const escaped = ("" + row[header]).replace(/"/g, '""'); // Escape quotes
            return `"${escaped}"`; // Wrap each value in quotes
          });
          csvRows.push(values.join(",")); // Join values to form a CSV row
        }

        const csvString = csvRows.join("\n"); // Join all rows with newline
        const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
        downloadBlob(blob, "tbl_all_accountingtransactions.csv");
      } else {
        const blob = await response.blob();
        downloadBlob(blob, "tbl_all_accountingtransactions.csv");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setErrorMessage("Error fetching data. Please try again.");
    } finally {
      setCSVIsLoading(false);
    }
  };
  const fetchCSVAStartccountingDownload = async () => {
    setCSVIsLoading(true);
    setErrorMessage("");

    if (busUnitCode === "" || datecurrentmodate === "") {
      setErrorMessage("Please fill in all fields.");
      setCSVIsLoading(false);
      return;
    }

    try {
      const queryParams = new URLSearchParams({
        // exceltoken: excelToken,
        busunitcode: busUnitCode,
        filterOptions: filterOptions,
        datelastyearbeg: datelastyearbeg,
      });

      const urls = `${
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_ACCOUNTING_TRANSACTION_START_ENDPOINT
      }?${queryParams.toString()}`;
      console.log(urls);

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

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.message === "Excel token required") {
          setErrorMessage("Token Not Valid");
          return;
        }
        // Handle other JSON responses if needed
        if (!data || Object.keys(data).length === 0) {
          // If there's no data, create an empty CSV
          createAndDownloadEmptyCSV("tbl_beg_accountingtransactions.csv");
          return;
        }
      } else {
        const blob = await response.blob();
        downloadBlob(blob, "tbl_beg_accountingtransactions.csv");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      // Create and download an empty CSV if an error occurs
      createAndDownloadEmptyCSV("tbl_beg_accountingtransactions.csv");
    } finally {
      setCSVIsLoading(false);
    }
  };
  const fetchCSVAbudgetDownload = async () => {
    setCSVIsLoading(true);
    setErrorMessage("");

    if (busUnitCode === "" || datecurrentmodate === "") {
      setErrorMessage("Please fill in all fields.");
      setCSVIsLoading(false);
      return;
    }

    try {
      const queryParams = new URLSearchParams({
        // exceltoken: excelToken,
        busunitcode: busUnitCode,
        filterOptions: filterOptions,
        datecurrentmodate: datecurrentmodate,
      });

      const urls = `${
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_BUDGET_ENDPOINT
      }?${queryParams.toString()}`;
      console.log(urls);

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

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.message === "Excel token required") {
          setErrorMessage("Token Not Valid");
          return;
        }
        // Handle other JSON responses if needed
        if (!data || Object.keys(data).length === 0) {
          // If there's no data, create an empty CSV
          createAndDownloadEmptyCSV("tbl_upload_budget.csv");
          return;
        }
      } else {
        const blob = await response.blob();
        downloadBlob(blob, "tbl_upload_budget.csv");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      // Create and download an empty CSV if an error occurs
      createAndDownloadEmptyCSV("tbl_upload_budget.csv");
    } finally {
      setCSVIsLoading(false);
    }
  };
  const fetchCSVAuploadlastyearDownload = async () => {
    setCSVIsLoading(true);
    setErrorMessage("");

    if (busUnitCode === "" || datecurrentmodate === "") {
      setErrorMessage("Please fill in all fields.");
      setCSVIsLoading(false);
      return;
    }

    try {
      const currentDate = new Date(datecurrentmodate);
      currentDate.setFullYear(currentDate.getFullYear() - 1);
      const adjustedDate = currentDate.toISOString().split("T")[0]; // Format as YYYY-MM-DD

      const queryParams = new URLSearchParams({
        // exceltoken: excelToken,
        busunitcode: busUnitCode,
        filterOptions: filterOptions,
        datecurrentmodate: adjustedDate,
      });

      const urls = `${
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_LASTYEAR_ENDPOINT
      }?${queryParams.toString()}`;
      console.log(urls);

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

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.message === "Excel token required") {
          setErrorMessage("Token Not Valid");
          return;
        }
        // Handle other JSON responses if needed
        if (!data || Object.keys(data).length === 0) {
          // If there's no data, create an empty CSV
          createAndDownloadEmptyCSV("tbl_upload_last_year.csv");
          return;
        }
      } else {
        const blob = await response.blob();
        downloadBlob(blob, "tbl_upload_last_year.csv");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      // Create and download an empty CSV if an error occurs
      createAndDownloadEmptyCSV("tbl_upload_last_year.csv");
    } finally {
      setCSVIsLoading(false);
    }
  };
  const fetchCSVAopdaysDownload = async () => {
    setCSVIsLoading(true);
    setErrorMessage("");

    if (busUnitCode === "" || datecurrentmodate === "") {
      setErrorMessage("Please fill in all fields.");
      setCSVIsLoading(false);
      return;
    }

    try {
      const queryParams = new URLSearchParams({
        // exceltoken: excelToken,
        busunitcode: busUnitCode,
        filterOptions: filterOptions,
        datecurrentmodate: datecurrentmodate,
      });

      const urls = `${
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_OPDAYS_ENDPOINT
      }?${queryParams.toString()}`;
      console.log(urls);

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

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.message === "Excel token required") {
          setErrorMessage("Token Not Valid");
          return;
        }
        // Handle other JSON responses if needed
        if (!data || Object.keys(data).length === 0) {
          // If there's no data, create an empty CSV
          createAndDownloadEmptyCSV("tbl_upload_op_days.csv");
          return;
        }
      } else {
        const blob = await response.blob();
        downloadBlob(blob, "tbl_upload_op_days.csv");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      // Create and download an empty CSV if an error occurs
      createAndDownloadEmptyCSV("tbl_upload_op_days.csv");
    } finally {
      setCSVIsLoading(false);
    }
  };
  const fetchCSVAuserbusunitDownload = async () => {
    setCSVIsLoading(true);
    setErrorMessage("");

    if (busUnitCode === "" || datecurrentmodate === "") {
      setErrorMessage("Please fill in all fields.");
      setCSVIsLoading(false);
      return;
    }

    try {
      const queryParams = new URLSearchParams({
        // exceltoken: excelToken,
        busunitcode: busUnitCode,
         filterOptions: filterOptions,
        // datecurrentmodate: datecurrentmodate,
      });

      const urls = `${
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_USER_BUSUNIT_ENDPOINT
      }?${queryParams.toString()}`;
      console.log(urls);

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

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.message === "Excel token required") {
          setErrorMessage("Token Not Valid");
          return;
        }
        // Handle other JSON responses if needed
        if (!data || Object.keys(data).length === 0) {
          // If there's no data, create an empty CSV
          createAndDownloadEmptyCSV("tbl_user_busunit.csv");
          return;
        }
      } else {
        const blob = await response.blob();
        downloadBlob(blob, "tbl_user_busunit.csv");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      // Create and download an empty CSV if an error occurs
      createAndDownloadEmptyCSV("tbl_user_busunit.csv");
    } finally {
      setCSVIsLoading(false);
    }
  };
  const fetchCSVGlCode = async () => {
    setCSVIsLoading(true);
    setErrorMessage("");

    try {
      const urls = localStorage.getItem("apiendpoint") + import.meta.env.VITE_CSV_GLCODE_ENDPOINT;

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

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.message === "Excel token required") {
          setErrorMessage("Token Not Valid");
          return;
        }
        // Handle other JSON responses if needed
        if (!data || Object.keys(data).length === 0) {
          // If there's no data, create an empty CSV
          createAndDownloadEmptyCSV("tbl_glcodes.csv");
          return;
        }
      } else {
        const blob = await response.blob();
        downloadBlob(blob, "tbl_glcodes.csv");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setErrorMessage(`Error: ${error.message}`);
      createAndDownloadCSV("No data available", "empty_glcodes.csv");
    } finally {
      setCSVIsLoading(false);
    }
  };
  const fetchCSVChartofAccounts = async () => {
    setCSVIsLoading(true);
    setErrorMessage("");

    try {
      const queryParams = new URLSearchParams({
        // exceltoken: excelToken,
        busunitcode: busUnitCode,
        // datecurrentmodate: datecurrentmodate,
      });
      const urls = `${
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_CHARTOFACCOUNTS_ENDPOINT
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

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.message === "Excel token required") {
          setErrorMessage("Token Not Valid");
          return;
        }
        // Handle other JSON responses if needed
        if (!data || Object.keys(data).length === 0) {
          // If there's no data, create an empty CSV
          createAndDownloadEmptyCSV("tbl_chartofaccounts.csv");
          return;
        }
      } else {
        const blob = await response.blob();
        downloadBlob(blob, "tbl_chartofaccounts.csv");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setErrorMessage(`Error: ${error.message}`);
      createAndDownloadCSV("No data available", "empty_chartofaccounts.csv");
    } finally {
      setCSVIsLoading(false);
    }
  };
  const fetchCSVlkp_supplier = async () => {
    setCSVIsLoading(true);
    setErrorMessage("");

    if (busUnitCode === "" || datecurrentmodate === "") {
      setErrorMessage("Please fill in all fields.");
      setCSVIsLoading(false);
      return;
    }

    try {
      const urls = localStorage.getItem("apiendpoint") + import.meta.env.VITE_CSV_LKP_SUPPLIER_ENDPOINT;

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

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.message === "Excel token required") {
          setErrorMessage("Token Not Valid");
          return;
        }
        // Handle other JSON responses if needed
        if (!data || Object.keys(data).length === 0) {
          // If there's no data, create an empty CSV
          createAndDownloadEmptyCSV("lkp_supplier.csv");
          return;
        }
      } else {
        const blob = await response.blob();
        downloadBlob(blob, "lkp_supplier.csv");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      // Create and download an empty CSV if an error occurs
      createAndDownloadEmptyCSV("lkp_supplier.csv");
    } finally {
      setCSVIsLoading(false);
    }
  };
  const fetchCSVlkp_customer = async () => {
    setCSVIsLoading(true);
    setErrorMessage("");

    if (busUnitCode === "" || datecurrentmodate === "") {
      setErrorMessage("Please fill in all fields.");
      setCSVIsLoading(false);
      return;
    }

    try {
      const urls = localStorage.getItem("apiendpoint") + import.meta.env.VITE_CSV_LKP_CUSTOMER_ENDPOINT;
      // console.log(urls);

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

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.message === "Excel token required") {
          setErrorMessage("Token Not Valid");
          return;
        }
        // Handle other JSON responses if needed
        if (!data || Object.keys(data).length === 0) {
          // If there's no data, create an empty CSV
          createAndDownloadEmptyCSV("lkp_customer.csv");
          return;
        }
      } else {
        const blob = await response.blob();
        downloadBlob(blob, "lkp_customer.csv");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      // Create and download an empty CSV if an error occurs
      createAndDownloadEmptyCSV("lkp_customer.csv");
    } finally {
      setCSVIsLoading(false);
    }
  };
  const fetchCSVExpandedAccounts = async () => {
    setCSVIsLoading(true);
    setErrorMessage("");

    try { 
      const urls = localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_LKP_EXPANDED_PNL_ACCOUNTS
      ;

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

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.message === "Excel token required") {
          setErrorMessage("Token Not Valid");
          return;
        }
        // Handle other JSON responses if needed
        if (!data || Object.keys(data).length === 0) {
          // If there's no data, create an empty CSV
          createAndDownloadEmptyCSV("tbl_chartofaclkp_expanded_mapcounts.csv");
          return;
        }
      } else {
        const blob = await response.blob();
        downloadBlob(blob, "lkp_expanded_map.csv");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setErrorMessage(`Error: ${error.message}`);
      createAndDownloadCSV("No data available", "empty_lkp_expanded_map.csv");
    } finally {
      setCSVIsLoading(false);
    }
  };

  const fetchCSVlkpSlCodes = async () => {
    setCSVIsLoading(true);
    setErrorMessage("");

    try { 
      const urls = localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_LKP_SLCODES_ENDPOINT
      ;

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

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.message === "Excel token required") {
          setErrorMessage("Token Not Valid");
          return;
        }
        // Handle other JSON responses if needed
        if (!data || Object.keys(data).length === 0) {
          // If there's no data, create an empty CSV
          createAndDownloadEmptyCSV("lkp_slcodes.csv");
          return;
        }
      } else {
        const blob = await response.blob();
        downloadBlob(blob, "lkp_slcodes.csv");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setErrorMessage(`Error: ${error.message}`);
      createAndDownloadCSV("No data available", "lkp_slcodes.csv");
    } finally {
      setCSVIsLoading(false);
    }
  }


  const handleSequentialDownloads = async () => {
    try {
      await fetchCSVAccountingDownload();
      await fetchCSVAllAccountingDownload();
      await fetchCSVAStartccountingDownload();
      await fetchCSVAbudgetDownload();
      await fetchCSVAuploadlastyearDownload();
      await fetchCSVAopdaysDownload();
      await fetchCSVAuserbusunitDownload();
      await fetchCSVGlCode();
      await fetchCSVChartofAccounts();
      await fetchCSVlkp_supplier();
      await fetchCSVlkp_customer();
      await fetchCSVExpandedAccounts();
      await fetchCSVlkpSlCodes();
    } catch (error) {
      console.error("Error during sequential downloads:", error);
      setErrorMessage("Error during downloads. Please try again.");
    } finally {
      setCSVIsLoading(false);
    }
  };
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-800 bg-opacity-50 p-10">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">Filter Options</h2>
            {/* <div className="mb-4">
              <label className="block text-gray-700">Excel Token</label>
              <input
                type="text"
                value={excelToken}
                onChange={(e) => setExcelToken(e.target.value)}
                className="mt-1 p-2 w-full border border-gray-300 rounded"
                placeholder="Enter Excel Token"
              />
            </div> */}
            <div className="mb-4">
              <label className="block text-gray-700">Category</label>
              <Dropdown
                label={""}
                value={filterOptions}
                isRequired={false}
                optionsList={filteroptions}
                optionsField01={"value"}
                optionsField02={"value"}
                allowCustom={false}
                enableBrandColor={false}
                onChange={handleFilterChange}
              />
            </div>
           {filterOptions.length > 0 && (
            <div className="mb-4">
              <label className="block text-gray-700">Select {filterOptions}</label>
              <Dropdown
                label=""
                value={selectedFilter}
                isRequired={false}
                optionsList={filteredOptions}
                optionsField01="value"
                optionsField02="value"
                allowCustom={false}
                enableBrandColor={false}
              onChange={(selectedValue) => {
  setSelectedFilter(selectedValue);
  const selectedOption = filteredOptions.find(opt => opt.value === selectedValue);
  setBusUnitCode(selectedOption?.code); // Set the bus unit code based on the selected option
}}

              />
            </div>
          )}

            {/* <div className="mb-4">
              <label className="block text-gray-700">Business Unit Code</label>
              <Dropdown
                label={""}
                value={busunitSelectedName}
                isRequired={false}
                optionsList={filteredBusUnits}
                optionsField01={"busunitcode"}
                optionsField02={"name"}
                allowCustom={false}
                enableBrandColor={false}
                onChange={(selectedID, selectedValue) => {
                  setBusUnitCode(selectedID),
                    setSelectedBusunitName(selectedValue);
                }}
              />
            </div> */}
            <div className="mb-4">
              <label className="block text-gray-700">
                Date Last Year Beginning
              </label>
              <input
                type="date"
                value={datelastyearbeg}
                onChange={(e) => setdatelastyearbeg(e.target.value)}
                className="mt-1 p-2 w-full border border-gray-300 rounded"
                disabled // Disable this input as it auto-populates
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700">Date Current Month</label>
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
                onClick={handleSequentialDownloads}
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

export default ModalFilterExcel;
