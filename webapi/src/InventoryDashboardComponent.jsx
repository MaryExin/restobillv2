import React, { useEffect, useState } from "react";
import { DataGrid, GridPagination } from "@mui/x-data-grid";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Label,
  BarChart,
  Legend,
  Bar,
  ResponsiveContainer,
} from "recharts";

import Favicon from "../../assets/logo.png";
import useCustomQuery from "../../hooks/useCustomQuery";
import ModalDashboardFilter from "../Modals/ModalDashboardFilter";
import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import { LinearProgress } from "@mui/material";

// Format Chart Labels

const CustomYAxisTick = ({ x, y, payload }) => {
  const valueInMillions = payload.value; // Convert to millions
  return (
    <text x={x} y={y} dy={-4} textAnchor="middle">
      {valueInMillions.toLocaleString("en-US", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 0, // Display zero decimal places
        maximumFractionDigits: 0,
      })}
    </text>
  );
};

// Format date today as month day year

const formatDate = (date) => {
  const options = { year: "numeric", month: "long", day: "numeric" };
  return date.toLocaleDateString("en-US", options);
};

// Get month in words
const getMonthInWords = (date) => {
  const options = { month: "long" };
  return date.toLocaleDateString("en-US", options).toUpperCase();
};

const formatDateToYearMonthDay = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getFullYear = (date) => {
  const year = date.getFullYear();
  return year;
};

const currentDate = new Date(Date.now());
const dateToday = formatDate(currentDate);
const monthInWords = getMonthInWords(currentDate);
const yearMonthDay = formatDateToYearMonthDay(currentDate);
const fullYear = getFullYear(currentDate);

const InventoryDashboardComponent = () => {
  const [store, setStore] = useState("");
  const [storeName, setStoreName] = useState("");
  const [area, setArea] = useState("");
  const [areaName, setAreaName] = useState("");
  const [monthParams, setMonthParams] = useState(monthInWords);
  const [yearParams, setYearParams] = useState(fullYear);
  const [dateFrom, setDateFrom] = useState(yearMonthDay);
  const [dateTo, setDateTo] = useState(yearMonthDay);
  const [selectedLevel, setSelectedLevel] = useState("STORE");
  const [filteredInventoryData, setFilteredInventoryData] = useState([]);

  const [isModalFilterOpen, setIsModalFilterOpen] = useState(false);

  const [isLoadingCSV, setCSVIsLoading] = useState(false);

  const [dates, setDates] = useState([
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ]);

  const [years, setYears] = useState([
    2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027,
    2028, 2029, 2030,
  ]);

  //Query busunits for form combo box

  const {
    data: busUnitsData,
    isLoading: busUnitsIsLoading,
    isError: busUnitsIsError,
    isSuccess: busUnitsIsSuccess,
    refetch: busUnitsRefetch,
  } = useCustomQuery(
    import.meta.env.VITE_PARAMS_BUSUNITS_READ_ENDPOINT,
    "busunits"
  );

  //Query area for form combo box

  const {
    data: areaData,
    isLoading: areaIsLoading,
    isError: areaIsError,
    isSuccess: areaIsSuccess,
    refetch: areaRefetch,
  } = useCustomQuery(import.meta.env.VITE_AREA_DATA_MUTATION_ENDPOINT, "area");

  //Array and Other Methods

  const handleDropDownReset = () => {
    setStore("");
    setArea("");
    setYearParams("");
    setMonthParams("");
  };

  //Mutation  hook for loading of sales data

  // Inventory Cost and Balance by Levels

  const {
    data: inventoryCostBalByLevelData,
    isLoading: inventoryCostBalByLevelIsLoading,
    isError: inventoryCostBalByLevelIsError,
    isSuccess: inventoryCostBalByLevelIsSuccess,
    mutate: inventoryCostBalByLevelMutate,
  } = useSecuredMutation(
    import.meta.env.VITE_READ_DASHBOARD_INVENTORY_PER_LEVEL_ENDPOINT,
    "POST"
  );

  useEffect(() => {
    if (inventoryCostBalByLevelData) {
      const filteredData = inventoryCostBalByLevelData.filter(
        (items) => items.level === selectedLevel
      );

      setFilteredInventoryData(filteredData);
    }
  }, [selectedLevel]);

  useEffect(() => {
    if (inventoryCostBalByLevelData) {
      // console.log("inventoryCostBalByLevelData");
      // console.log(inventoryCostBalByLevelData);
    }
  }, [inventoryCostBalByLevelData]);

  useEffect(() => {
    inventoryCostBalByLevelMutate({
      busunitcode: store,
      areacode: area,
      filter: "INVCOSTANDBALPERLEVEL",
    });
  }, [area, store]);

  const fetchCSVInventoryDownload = async () => {
    setCSVIsLoading(true);

    try {
      const response = await fetch(
        import.meta.env.VITE_CSV_INVENTORY_ENDPOINT,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + localStorage.getItem("access_token"),
          },
          body: JSON.stringify({
            busunitcode: store,
            areacode: area,
            datefrom: dateFrom,
            dateto: dateTo,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inventory.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setCSVIsLoading(false);
    }
  };

  return (
    <>
      {isModalFilterOpen && (
        <ModalDashboardFilter
          header={"Inventory Dashboard"}
          store={store}
          setStore={setStore}
          area={area}
          setArea={setArea}
          areaName={areaName}
          setAreaName={setAreaName}
          monthParams={monthParams}
          setMonthParams={setMonthParams}
          yearParams={yearParams}
          setYearParams={setYearParams}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          dates={dates}
          setDates={setDates}
          busUnitsData={busUnitsData}
          areaData={areaData}
          years={years}
          handleDropDownReset={handleDropDownReset}
          setIsModalFilterOpen={setIsModalFilterOpen}
          setStoreName={setStoreName}
        />
      )}
      <div className="flex flex-col w-full  lg:w-10/12 justify-center shadow-2xl rounded-lg">
        <div className="flex flex-col w-full h-auto pt-5 px-2 lg:p-5 rounded-md space-y-3">
          {/* Header Tab */}
          <div className=" flex flex-row w-full  justify-center items-center px-5 py-1 space-x-5  mt-5 shadow-lg shadow-zinc-400  bg-gradient-to-br from-darkerPrimary via-darkPrimary  to-medPrimary rounded-md">
            <div className="bg-white py-1 px-1 rounded-full">
              <img src={Favicon} className="h-10 w-auto self-start" />
            </div>

            <h1 className="self-center font-semibold text-white text-xl">
              Inventory Dashboard
            </h1>
          </div>
          {/* Loader */}
          <div className="h-2 w-full">
            {(inventoryCostBalByLevelIsLoading || isLoadingCSV) && (
              <LinearProgress color="success" />
            )}
          </div>
          {/* Filters */}
          <section className="hidden lg:block border border-t-zinc-100 rounded-lg  shadow-2xl py-3">
            {/* Sales Dropdown */}
            <div className="flex flex-row w-full justify-evenly items-center  bg-white py-2 px-5 lg:px-0">
              <div className="flex space-y-3 flex-col-reverse lg:flex-row-reverse justify-around w-full items-center">
                {/* Refresh Button */}
                <div className="flex flex-row justify-start space-x-2">
                  <button
                    onClick={() => handleDropDownReset()}
                    className="bg-darkerPrimary rounded-lg shadow-lg shadow-darkPrimary px-4 py-2 text-white hover:scale-95 duration-300"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-6 h-6 hover:text-softPrimary duration-200 hover:-translate-y-1  "
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
                {/* Store */}
                <div className="flex flex-col w-full lg:w-auto">
                  <p className="text-xs text-medPrimary">Store</p>
                  <select
                    value={store}
                    onChange={(e) => {
                      const selectedStoreCode = e.target.value;
                      setStore(selectedStoreCode);

                      // Find the corresponding store name from the busUnitsData array
                      const selectedStore = busUnitsData.find(
                        (bus) => bus.busunitcode === selectedStoreCode
                      );
                      if (selectedStore) {
                        const selectedStoreName = selectedStore.name;
                        setStoreName(selectedStoreName);
                      }
                    }}
                    className="text-sm pt-3 pb-2 px-5 block w-full rounded-lg border border-softPrimary bg-white z-1 focus:outline-none cursor-pointer"
                  >
                    <option value="" selected disabled hidden></option>
                    {Array.isArray(busUnitsData) &&
                      busUnitsData
                        // .filter((items) => items.class === "STORE")
                        .map((bus) => (
                          <option value={bus.busunitcode}>{bus.name}</option>
                        ))}
                  </select>
                </div>

                {/* Area */}
                <div className="flex flex-col w-full lg:w-auto">
                  <p className="text-xs text-medPrimary">Area</p>
                  <select
                    value={area}
                    onChange={(e) => {
                      const selectedAreaCode = e.target.value;
                      setArea(selectedAreaCode);
                      // Find the corresponding store name from the busUnitsData array
                      const selectedArea = areaData.find(
                        (area) => area.area_code === selectedAreaCode
                      );
                      if (selectedArea) {
                        const selectedAreaName = selectedArea.area_name;
                        setAreaName(selectedAreaName);
                      }
                    }}
                    className="text-sm pt-3 pb-2 px-5  block w-full rounded-lg border border-softPrimary z-1 focus:outline-none cursor-pointer"
                  >
                    <option value="" selected disabled hidden></option>
                    {Array.isArray(areaData) &&
                      areaData.map((area) => (
                        <option value={area.area_code}>{area.area_name}</option>
                      ))}
                  </select>
                </div>

                {/* Months */}
                <div className="flex flex-col w-full lg:w-auto">
                  <p className="text-xs text-medPrimary">Month</p>
                  <select
                    value={monthParams}
                    onChange={(e) => {
                      setMonthParams(e.target.value);
                    }}
                    className="text-sm pt-3 pb-2 px-1 block w-full rounded-lg border border-softPrimary z-1 focus:outline-none cursor-pointer"
                  >
                    <option value="" disabled hidden></option>
                    {dates &&
                      dates.map((date) => (
                        <option value={date} selected={date === monthParams}>
                          {date}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Years */}
                <div className="flex flex-col w-full lg:w-auto">
                  <p className="text-xs text-medPrimary">Year</p>
                  <select
                    value={yearParams}
                    onChange={(e) => {
                      setYearParams(e.target.value);
                    }}
                    className="text-sm pt-3 pb-2 px-1 block w-full rounded-lg border border-softPrimary z-1 focus:outline-none cursor-pointer"
                  >
                    <option value="" selected disabled hidden></option>
                    {years &&
                      years.map((year) => <option value={year}>{year}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* CSV */}
            <div className="flex flex-row w-full justify-end px-12">
              <button
                onClick={() => {
                  fetchCSVInventoryDownload();
                }}
                className="bg-darkerPrimary text-white px-2 py-1 rounded-md shadow-lg shadow-medPrimary"
              >
                CSV
              </button>
            </div>

            {/* Date Dropdown */}

            <div className="flex flex-col lg:flex-row w-full justify-center items-center lg:justify-end py-2 space-y-2 lg:space-x-5 px-5 rounded-b-lg">
              {/* Calendar */}
              <div className="flex flex-col w-full  lg:w-auto ">
                <p className="text-xs text-medPrimary">From</p>
                <input
                  type="date"
                  className="p-1 rounded-md border border-softPrimary"
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              {/* Calendar */}
              <div className="flex flex-col  w-full lg:w-auto">
                <p className="text-xs text-medPrimary">To</p>
                <input
                  type="date"
                  className="p-1 rounded-md border border-softPrimary"
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </section>
          {/* Inventory Cost and Balance and Notes */}
          <div className="flex flex-col lg:flex-row  justify-center overflow-hidden space-x-0  px-5">
            {/* Section 1 */}
            <div className="flex flex-col justify-end lg:justify-center w-full lg:w-1/2">
              {/* Total Cost and Balance of Inventory Per Department */}
              <div className="flex flex-col  ">
                <div className="flex flex-col  justify-center w-full  mt-2 space-y-2 px-3">
                  {/* STORES */}
                  <a
                    onClick={() => setSelectedLevel("STORE")}
                    className="group cursor-pointer "
                  >
                    <div
                      className={
                        selectedLevel === "STORE"
                          ? "flex flex-row justify-around items-center bg-softPrimary shadow-sm border border-pinkWhite p-5 rounded-lg w-full space-x-2 group-hover:scale-95 group-hover:opacity-80  duration-300"
                          : "flex flex-row justify-around items-center bg-white shadow-sm border border-pinkWhite p-5 rounded-lg w-full space-x-2 group-hover:scale-95 group-hover:opacity-80  duration-300"
                      }
                    >
                      {" "}
                      <div className="p-3 rounded-full shadow-xl shadow-darkPrimary bg-gradient-to-br from-darkerPrimary via-darkPrimary  to-medPrimary">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-6 h-6 text-white"
                        >
                          <path d="M5.223 2.25c-.497 0-.974.198-1.325.55l-1.3 1.298A3.75 3.75 0 007.5 9.75c.627.47 1.406.75 2.25.75.844 0 1.624-.28 2.25-.75.626.47 1.406.75 2.25.75.844 0 1.623-.28 2.25-.75a3.75 3.75 0 004.902-5.652l-1.3-1.299a1.875 1.875 0 00-1.325-.549H5.223z" />
                          <path
                            fillRule="evenodd"
                            d="M3 20.25v-8.755c1.42.674 3.08.673 4.5 0A5.234 5.234 0 009.75 12c.804 0 1.568-.182 2.25-.506a5.234 5.234 0 002.25.506c.804 0 1.567-.182 2.25-.506 1.42.674 3.08.675 4.5.001v8.755h.75a.75.75 0 010 1.5H2.25a.75.75 0 010-1.5H3zm3-6a.75.75 0 01.75-.75h3a.75.75 0 01.75.75v3a.75.75 0 01-.75.75h-3a.75.75 0 01-.75-.75v-3zm8.25-.75a.75.75 0 00-.75.75v5.25c0 .414.336.75.75.75h3a.75.75 0 00.75-.75v-5.25a.75.75 0 00-.75-.75h-3z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="flex flex-col justify-start">
                        <p className="text-zinc-600 font-semibold text-lg group-hover:text-darkerPrimary">
                          Stores
                        </p>
                        <p className="text-zinc-600 font-semibold text-sm group-hover:text-darkerPrimary">
                          Total Inventory Cost
                        </p>
                        <p className="text-xs text-zinc-500">{dateTo}</p>
                      </div>
                      <div>
                        <p className="text-darkerPrimary font-semibold text-xl group-hover:text-darkerPrimary">
                          ₱
                          {inventoryCostBalByLevelData &&
                            inventoryCostBalByLevelData
                              .reduce((acc, total) => {
                                if (total.level === "STORE") {
                                  return acc + total.running_cost_per_uom;
                                }
                                return acc;
                              }, 0)
                              .toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                        </p>
                      </div>
                    </div>
                  </a>
                  {/* COMMI */}
                  <a
                    onClick={() => setSelectedLevel("COMMI")}
                    className="group cursor-pointer "
                  >
                    <div
                      className={
                        selectedLevel === "COMMI"
                          ? "flex flex-row justify-around items-center bg-softPrimary shadow-sm border border-pinkWhite p-5 rounded-lg w-full space-x-2 group-hover:scale-95 group-hover:opacity-80  duration-300"
                          : "flex flex-row justify-around items-center bg-white shadow-sm border border-pinkWhite p-5 rounded-lg w-full space-x-2 group-hover:scale-95 group-hover:opacity-80  duration-300"
                      }
                    >
                      <div className="p-3 rounded-full shadow-xl shadow-zinc-400 bg-softPrimary">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-6 h-6 text-zinc-500"
                        >
                          <path d="M11.584 2.376a.75.75 0 01.832 0l9 6a.75.75 0 11-.832 1.248L12 3.901 3.416 9.624a.75.75 0 01-.832-1.248l9-6z" />
                          <path
                            fillRule="evenodd"
                            d="M20.25 10.332v9.918H21a.75.75 0 010 1.5H3a.75.75 0 010-1.5h.75v-9.918a.75.75 0 01.634-.74A49.109 49.109 0 0112 9c2.59 0 5.134.202 7.616.592a.75.75 0 01.634.74zm-7.5 2.418a.75.75 0 00-1.5 0v6.75a.75.75 0 001.5 0v-6.75zm3-.75a.75.75 0 01.75.75v6.75a.75.75 0 01-1.5 0v-6.75a.75.75 0 01.75-.75zM9 12.75a.75.75 0 00-1.5 0v6.75a.75.75 0 001.5 0v-6.75z"
                            clipRule="evenodd"
                          />
                          <path d="M12 7.875a1.125 1.125 0 100-2.25 1.125 1.125 0 000 2.25z" />
                        </svg>
                      </div>

                      <div className="flex flex-col justify-start">
                        <p className="text-zinc-600 font-semibold text-lg group-hover:text-orange-500">
                          Commissaries
                        </p>
                        <p className="text-zinc-600 font-semibold text-sm group-hover:text-orange-500">
                          Total Inventory Cost
                        </p>
                        <p className="text-xs text-zinc-500">{dateTo}</p>
                      </div>
                      <div>
                        <p className="text-orange-500 font-semibold text-xl group-hover:text-orange-500">
                          ₱
                          {inventoryCostBalByLevelData &&
                            inventoryCostBalByLevelData
                              .reduce((acc, total) => {
                                if (total.level === "COMMI") {
                                  return acc + total.running_cost_per_uom;
                                }
                                return acc;
                              }, 0)
                              .toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                        </p>
                      </div>
                    </div>
                  </a>
                  {/* DEPARTMENT */}
                  <a
                    onClick={() => setSelectedLevel("DEPARTMENT")}
                    className="group cursor-pointer"
                  >
                    <div
                      className={
                        selectedLevel === "DEPARTMENT"
                          ? "flex flex-row justify-around items-center bg-softPrimary shadow-sm border border-pinkWhite p-5 rounded-lg w-full space-x-2 group-hover:scale-95 group-hover:opacity-80  duration-300"
                          : "flex flex-row justify-around items-center bg-white shadow-sm border border-pinkWhite p-5 rounded-lg w-full space-x-2 group-hover:scale-95 group-hover:opacity-80  duration-300"
                      }
                    >
                      {" "}
                      <div className="p-3 rounded-full shadow-xl shadow-yellow-600 bg-gradient-to-br from-yellow-600 via-yellow-500  to-yellow-400">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-6 h-6 text-softerPrimary"
                        >
                          <path
                            fillRule="evenodd"
                            d="M3 2.25a.75.75 0 000 1.5v16.5h-.75a.75.75 0 000 1.5H15v-18a.75.75 0 000-1.5H3zM6.75 19.5v-2.25a.75.75 0 01.75-.75h3a.75.75 0 01.75.75v2.25a.75.75 0 01-.75.75h-3a.75.75 0 01-.75-.75zM6 6.75A.75.75 0 016.75 6h.75a.75.75 0 010 1.5h-.75A.75.75 0 016 6.75zM6.75 9a.75.75 0 000 1.5h.75a.75.75 0 000-1.5h-.75zM6 12.75a.75.75 0 01.75-.75h.75a.75.75 0 010 1.5h-.75a.75.75 0 01-.75-.75zM10.5 6a.75.75 0 000 1.5h.75a.75.75 0 000-1.5h-.75zm-.75 3.75A.75.75 0 0110.5 9h.75a.75.75 0 010 1.5h-.75a.75.75 0 01-.75-.75zM10.5 12a.75.75 0 000 1.5h.75a.75.75 0 000-1.5h-.75zM16.5 6.75v15h5.25a.75.75 0 000-1.5H21v-12a.75.75 0 000-1.5h-4.5zm1.5 4.5a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75h-.008a.75.75 0 01-.75-.75v-.008zm.75 2.25a.75.75 0 00-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 00.75-.75v-.008a.75.75 0 00-.75-.75h-.008zM18 17.25a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75h-.008a.75.75 0 01-.75-.75v-.008z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="flex flex-col justify-start">
                        <p className="text-zinc-600 font-semibold text-lg group-hover:text-yellow-600">
                          Departments
                        </p>
                        <p className="text-zinc-600 font-semibold text-sm group-hover:text-yellow-600">
                          Total Inventory Cost
                        </p>
                        <p className="text-xs text-zinc-500">{dateTo}</p>
                      </div>
                      <div>
                        <p className="text-yellow-600 font-semibold text-xl group-hover:text-yellow-600">
                          ₱
                          {inventoryCostBalByLevelData &&
                            inventoryCostBalByLevelData
                              .reduce((acc, total) => {
                                if (total.level === "DEPARTMENT") {
                                  return acc + total.running_cost_per_uom;
                                }
                                return acc;
                              }, 0)
                              .toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                        </p>
                      </div>
                    </div>
                  </a>
                  {/* SPOILAGE */}
                  <a
                    onClick={() => setSelectedLevel("SPOILAGE")}
                    className="group cursor-pointer "
                  >
                    <div
                      className={
                        selectedLevel === "SPOILAGE"
                          ? "flex flex-row justify-around items-center bg-softPrimary shadow-sm border border-pinkWhite p-5 rounded-lg w-full space-x-2 group-hover:scale-95 group-hover:opacity-80  duration-300"
                          : "flex flex-row justify-around items-center bg-white shadow-sm border border-pinkWhite p-5 rounded-lg w-full space-x-2 group-hover:scale-95 group-hover:opacity-80  duration-300"
                      }
                    >
                      {" "}
                      <div className="p-3 rounded-full shadow-xl shadow-darkPrimary bg-gradient-to-br from-darkerPrimary via-darkPrimary  to-medPrimary">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-6 h-6 text-white"
                        >
                          <path d="M5.223 2.25c-.497 0-.974.198-1.325.55l-1.3 1.298A3.75 3.75 0 007.5 9.75c.627.47 1.406.75 2.25.75.844 0 1.624-.28 2.25-.75.626.47 1.406.75 2.25.75.844 0 1.623-.28 2.25-.75a3.75 3.75 0 004.902-5.652l-1.3-1.299a1.875 1.875 0 00-1.325-.549H5.223z" />
                          <path
                            fillRule="evenodd"
                            d="M3 20.25v-8.755c1.42.674 3.08.673 4.5 0A5.234 5.234 0 009.75 12c.804 0 1.568-.182 2.25-.506a5.234 5.234 0 002.25.506c.804 0 1.567-.182 2.25-.506 1.42.674 3.08.675 4.5.001v8.755h.75a.75.75 0 010 1.5H2.25a.75.75 0 010-1.5H3zm3-6a.75.75 0 01.75-.75h3a.75.75 0 01.75.75v3a.75.75 0 01-.75.75h-3a.75.75 0 01-.75-.75v-3zm8.25-.75a.75.75 0 00-.75.75v5.25c0 .414.336.75.75.75h3a.75.75 0 00.75-.75v-5.25a.75.75 0 00-.75-.75h-3z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="flex flex-col justify-start">
                        <p className="text-zinc-600 font-semibold text-lg group-hover:text-darkerPrimary">
                          Spoilage
                        </p>
                        <p className="text-zinc-600 font-semibold text-sm group-hover:text-darkerPrimary">
                          Total Inventory Cost
                        </p>
                        <p className="text-xs text-zinc-500">{dateTo}</p>
                      </div>
                      <div>
                        <p className="text-darkerPrimary font-semibold text-xl group-hover:text-darkerPrimary">
                          ₱
                          {inventoryCostBalByLevelData &&
                            inventoryCostBalByLevelData
                              .reduce((acc, total) => {
                                if (total.level === "SPOILAGE") {
                                  return acc + total.running_cost_per_uom;
                                }
                                return acc;
                              }, 0)
                              .toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                        </p>
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            </div>
            {/* Section 2 */}
            <div className="flex flex-col h-[60vh]  overflow-y-auto scrollbar shadow-2xl p-5 rounded-md w-full lg:w-1/2 lg:space-y-3">
              <div className="flex flex-row justify-between items-center">
                <h1 className="text-md text-zinc-600 font-semibold">
                  Inventory Details
                </h1>
              </div>
              {/* Line Items */}
              {/* Total items ordered */}
              {inventoryCostBalByLevelData &&
                inventoryCostBalByLevelData
                  .filter((items) => items.level === selectedLevel)
                  .map((inv, index) => (
                    <a key={index} className="group cursor-pointer">
                      <div className="flex flex-row items-center   shadow-2xl p-5 rounded-lg w-full space-x-2 group-hover:scale-95 group-hover:opacity-90  duration-300">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-6 h-6 text-zinc-600"
                        >
                          <path
                            fillRule="evenodd"
                            d="M2.25 13.5a8.25 8.25 0 018.25-8.25.75.75 0 01.75.75v6.75H18a.75.75 0 01.75.75 8.25 8.25 0 01-16.5 0z"
                            clipRule="evenodd"
                          />
                          <path
                            fillRule="evenodd"
                            d="M12.75 3a.75.75 0 01.75-.75 8.25 8.25 0 018.25 8.25.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75V3z"
                            clipRule="evenodd"
                          />
                        </svg>

                        <div className="flex flex-col justify-start">
                          <p className="text-colorTextTPrimartext-zinc-500 font-semibold text-sm group-hover:text-darkPrimary">
                            {inv.description}
                          </p>
                          <p className="text-white px-2 py-1 shadow-lg shadow-zinc-400 rounded-lg bg-gradient-to-br from-darkerPrimary via-darkPrimary  to-medPrimary  font-semibold text-sm group-hover:text-white">
                            Bal: {`${inv.running_uom_val} ${inv.uom} `}
                          </p>
                          <p className="text-darkerPrimary px-2 py-1  font-semibold text-sm group-hover:text-darkPrimary">
                            Cost: ₱{inv.running_cost_per_uom}
                          </p>
                          <p className="text-darkerPrimary px-2 py-1  font-semibold text-sm group-hover:text-darkPrimary">
                            Min:{" "}
                            {inv.min_stock_level !== null
                              ? inv.min_stock_level
                              : 0}
                          </p>
                          {inv.running_uom_val > inv.min_stock_level ? (
                            <p className="bg-softPrimary shadow-lg rounded-full text-center text-zinc-600 w-fit px-1">
                              Safe stocks
                            </p>
                          ) : (
                            <p className="bg-red-500 shadow-lg rounded-full text-center text-white w-fit px-1">
                              Low stocks
                            </p>
                          )}
                        </div>
                      </div>
                    </a>
                  ))}
            </div>
          </div>

          <div className="flex flex-col justify-center w-full lg:px-24">
            {/* Bar Chart Sales by store YTD */}
            <div
              style={{ width: "auto", height: 350 }}
              className="flex flex-col justify-center items-center relative -mt-5"
            >
              <p className="absolute top-14 text-zinc-600 font-semibold text-sm">
                {selectedLevel} Inventory levels as of {monthParams}{" "}
                {yearParams}
              </p>
              <ResponsiveContainer width="100%" height="100%" className="mt-20">
                <BarChart
                  width={500}
                  height={250}
                  data={filteredInventoryData}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="description"
                    interval={1}
                    tick={{ angle: -45, fontSize: 10, dy: 10 }}
                  />
                  {/* <YAxis tick={<CustomYAxisTick />} /> */}
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      color: "white",
                      backgroundColor: "rgba(0, 0, 0, 0.8)",
                    }}
                    itemStyle={{ color: "white" }}
                    labelStyle={{ color: "white" }}
                  />
                  <Legend name="Custom Legend Text" />
                  <Bar dataKey={"running_uom_val"} fill="#305124" />
                  <Bar dataKey={"min_stock_level"} fill="#D0AF45" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
      <button
        className="lg:hidden fixed bottom-3 right-5 p-2 bg-gradient-to-br from-darkerPrimary via-darkPrimary  to-medPrimary
         rounded-md  shadow-lg shadow-zinc-400 z-50 hover:scale-95 duration-200"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-6 h-6 text-softerPrimary"
          onClick={() => setIsModalFilterOpen(true)}
        >
          <path
            fillRule="evenodd"
            d="M3.792 2.938A49.069 49.069 0 0112 2.25c2.797 0 5.54.236 8.209.688a1.857 1.857 0 011.541 1.836v1.044a3 3 0 01-.879 2.121l-6.182 6.182a1.5 1.5 0 00-.439 1.061v2.927a3 3 0 01-1.658 2.684l-1.757.878A.75.75 0 019.75 21v-5.818a1.5 1.5 0 00-.44-1.06L3.13 7.938a3 3 0 01-.879-2.121V4.774c0-.897.64-1.683 1.542-1.836z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </>
  );
};

export default InventoryDashboardComponent;
