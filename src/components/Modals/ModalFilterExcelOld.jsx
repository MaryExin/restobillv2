import React, { useState, useEffect } from "react";
import useCustomQuery from "../../hooks/useCustomQuery";
import Dropdown from "../Dropdown/Dropdown";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import {
  downloadBlob,
  createAndDownloadCSV,
  createAndDownloadEmptyCSV,
} from "../Modals/utils/downloadHelper";
import { FiFilter, FiDownload } from "react-icons/fi";
import { motion } from "framer-motion";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

function ModalFilterExcel({ isOpen, onClose }) {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  // const [excelToken, setExcelToken] = useState("");
  const [busunitSelectedName, setSelectedBusunitName] = useState("");
  const [busUnitCode, setBusUnitCode] = useState("");
  const [datelastyearbeg, setdatelastyearbeg] = useState(""); // State for the start of last year
  const [datecurrentmodate, setdatecurrentmodate] = useState(""); // Current date input state
  const [isLoadingCSV, setCSVIsLoading] = useState(false);
  const [filteredBusUnits, setFilteredBusUnits] = useState(null);
  const [errorMessage, setErrorMessage] = useState(""); // State for error messages
  const { toggleAuthToFalse, firstName, roles } = useZustandLoginCred();

  // Query BusUnits | Stores for role checking
  const {
    data: busunits,
    isLoading: busunitsIsLoading,
    isError: busunitsIsError,
    isSuccess: busunitsIsSuccess,
    refetch: busunitsRefetch,
  } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_PARAMS_BUSUNITS_READ_ENDPOINT,
    "busunits"
  );

  useEffect(() => {
    if (Array.isArray(busunits) && busunits.length > 0) {
      const filteredRows = roles[0].reduce((acc, role) => {
        const matchingBusunit = busunits.find(
          (busunit) => busunit.busunitcode === role.rolename
        );
        if (matchingBusunit) {
          acc.push({ ...role, ...matchingBusunit });
        }
        return acc;
      }, []);
      setFilteredBusUnits(filteredRows);
    }
  }, [busunits]);

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
        datelastyearbeg: datelastyearbeg,
        datecurrentmodate: datecurrentmodate,
      });

      const urls = `${
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_ACCOUNTING_TRANSACTION_ENDPOINT
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
        datelastyearbeg: datelastyearbeg,
      });

      const urls = `${
        endpoint +
        import.meta.env.VITE_CSV_ACCOUNTING_TRANSACTION_START_ENDPOINT
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
        datecurrentmodate: datecurrentmodate,
      });

      const urls = `${
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_BUDGET_ENDPOINT
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
        datecurrentmodate: adjustedDate,
      });

      const urls = `${
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_LASTYEAR_ENDPOINT
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
        datecurrentmodate: datecurrentmodate,
      });

      const urls = `${
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_OPDAYS_ENDPOINT
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
        // datecurrentmodate: datecurrentmodate,
      });

      const urls = `${
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_USER_BUSUNIT_ENDPOINT
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
      const urls =
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_GLCODE_ENDPOINT;

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
      const urls =
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_LKP_SUPPLIER_ENDPOINT;

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
      const urls =
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_LKP_CUSTOMER_ENDPOINT;
      // 

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

  const fetchCSVlkp_expanded_map = async () => {
    setCSVIsLoading(true);
    setErrorMessage("");

    if (busUnitCode === "" || datecurrentmodate === "") {
      setErrorMessage("Please fill in all fields.");
      setCSVIsLoading(false);
      return;
    }

    try {
      const urls =
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_LKP_EXPANDED_ENDPOINT;
      // 

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
          createAndDownloadEmptyCSV("lkp_expanded_map.csv");
          return;
        }
      } else {
        const blob = await response.blob();
        downloadBlob(blob, "lkp_expanded_map.csv");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      // Create and download an empty CSV if an error occurs
      createAndDownloadEmptyCSV("lkp_expanded_map.csv");
    } finally {
      setCSVIsLoading(false);
    }
  };

  const fetchCSVlkp_slcodes = async () => {
    setCSVIsLoading(true);
    setErrorMessage("");

    if (busUnitCode === "" || datecurrentmodate === "") {
      setErrorMessage("Please fill in all fields.");
      setCSVIsLoading(false);
      return;
    }

    try {
      const urls =
        localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_CSV_LKP_SLCODES_ENDPOINT;
      // 

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
      // Create and download an empty CSV if an error occurs
      createAndDownloadEmptyCSV("lkp_slcodes.csv");
    } finally {
      setCSVIsLoading(false);
    }
  };

  // const fetchCSVtbl_upload_last_year = async () => {
  //   setCSVIsLoading(true);
  //   setErrorMessage("");

  //   if (busUnitCode === "" || datecurrentmodate === "") {
  //     setErrorMessage("Please fill in all fields.");
  //     setCSVIsLoading(false);
  //     return;
  //   }

  //   try {
  //     const urls =
  //       localStorage.getItem("apiendpoint") +
  //       import.meta.env.VITE_CSV_TBL_UPLOAD_LAST_YEAR_ENDPOINT;
  //     // 

  //     const response = await fetch(urls, {
  //       method: "GET",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: "Bearer " + localStorage.getItem("access_token"),
  //       },
  //     });

  //     if (!response.ok) {
  //       throw new Error("Network response was not ok");
  //     }

  //     const contentType = response.headers.get("content-type");
  //     if (contentType && contentType.includes("application/json")) {
  //       const data = await response.json();
  //       if (data.message === "Excel token required") {
  //         setErrorMessage("Token Not Valid");
  //         return;
  //       }
  //       // Handle other JSON responses if needed
  //       if (!data || Object.keys(data).length === 0) {
  //         // If there's no data, create an empty CSV
  //         createAndDownloadEmptyCSV("tbl_upload_last_year.csv");
  //         return;
  //       }
  //     } else {
  //       const blob = await response.blob();
  //       downloadBlob(blob, "tbl_upload_last_year.csv");
  //     }
  //   } catch (error) {
  //     console.error("Error fetching data:", error);
  //     // Create and download an empty CSV if an error occurs
  //     createAndDownloadEmptyCSV("tbl_upload_last_year.csv");
  //   } finally {
  //     setCSVIsLoading(false);
  //   }
  // };

  // const fetchCSVtbl_upload_op_days = async () => {
  //   setCSVIsLoading(true);
  //   setErrorMessage("");

  //   if (busUnitCode === "" || datecurrentmodate === "") {
  //     setErrorMessage("Please fill in all fields.");
  //     setCSVIsLoading(false);
  //     return;
  //   }

  //   try {
  //     const urls =
  //       localStorage.getItem("apiendpoint") +
  //       import.meta.env.VITE_CSV_TBL_UPLOAD_OP_DAYS_ENDPOINT;
  //     // 

  //     const response = await fetch(urls, {
  //       method: "GET",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: "Bearer " + localStorage.getItem("access_token"),
  //       },
  //     });

  //     if (!response.ok) {
  //       throw new Error("Network response was not ok");
  //     }

  //     const contentType = response.headers.get("content-type");
  //     if (contentType && contentType.includes("application/json")) {
  //       const data = await response.json();
  //       if (data.message === "Excel token required") {
  //         setErrorMessage("Token Not Valid");
  //         return;
  //       }
  //       // Handle other JSON responses if needed
  //       if (!data || Object.keys(data).length === 0) {
  //         // If there's no data, create an empty CSV
  //         createAndDownloadEmptyCSV("tbl_upload_op_days.csv");
  //         return;
  //       }
  //     } else {
  //       const blob = await response.blob();
  //       downloadBlob(blob, "tbl_upload_op_days.csv");
  //     }
  //   } catch (error) {
  //     console.error("Error fetching data:", error);
  //     // Create and download an empty CSV if an error occurs
  //     createAndDownloadEmptyCSV("tbl_upload_op_days.csv");
  //   } finally {
  //     setCSVIsLoading(false);
  //   }
  // };

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
      await fetchCSVlkp_expanded_map();
      await fetchCSVlkp_slcodes();
      
      

      
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
            <motion.h2
              className="flex items-center space-x-2 bg-colorBrand text-white p-3 rounded-2xl shadow-lg mb-4"
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 250, damping: 20 }}
              whileHover={{ scale: 1.02 }}
            >
              <motion.span
                className="p-1 bg-white/20 rounded-full"
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 5, ease: "linear" }}
              >
                <FiFilter className="w-6 h-6 text-white" />
              </motion.span>
              <span className="text-xl font-semibold">Filter Options</span>
            </motion.h2>

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
            </div>

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
                className="px-4 py-2 bg-gray-300 rounded-full  hover:bg-gray-400"
              >
                Cancel
              </button>
              <motion.button
                onClick={handleSequentialDownloads}
                className="flex items-center space-x-2 px-5 py-3 bg-gradient-to-br from-green-700 to-green-600 text-white rounded-full shadow-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                {isLoadingCSV ? (
                  <motion.span
                    className="flex items-center space-x-2"
                    animate={{ rotate: 360 }}
                    transition={{
                      repeat: Infinity,
                      duration: 1,
                      ease: "linear",
                    }}
                  >
                    <FiDownload className="w-5 h-5" />
                    <span>Loading...</span>
                  </motion.span>
                ) : (
                  <span className="flex items-center space-x-2">
                    <FiDownload className="w-5 h-5" />
                    <span>CSVs</span>
                  </span>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ModalFilterExcel;
