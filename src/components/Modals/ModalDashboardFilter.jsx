import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { array } from "zod";
import { useCustomSecuredMutation } from "../../hooks/useCustomSecuredMutation";
import ModalYesNoReusable from "./ModalYesNoReusable";
import { parseMutationArgs } from "@tanstack/react-query";
import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import { LinearProgress } from "@mui/material";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import Dropdown from "../Dropdown/Dropdown";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalDashboardFilter = ({
  header,
  store,
  storeName,
  setStore,
  setStoreName,
  area,
  setArea,
  areaData,
  areaName,
  setAreaName,
  monthParams,
  setMonthParams,
  yearParams,
  years,
  setYearParams,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  dates,
  setDates,
  busUnitsData,
  handleDropDownReset,
  setIsModalFilterOpen,
  busunitSelected,
  setSelectedBusunit,
  busunitSelectedName,
  setSelectedBusunitName,
  filteredBusUnits,
  setFilteredBusUnits,
  searchType,
  searchstat,
  setSearchType,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const Logo = localStorage.getItem("apiendpoint") + import.meta.env.VITE_LOGO;
  const { toggleAuthToFalse, firstName, roles } = useZustandLoginCred();
  const roleCodes = roles.flatMap((group) => group.map((r) => r.rolename));

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen bg-zinc-800 bg-opacity-50">
      <div className="flex h-full justify-center pt-10 lg:ms-10 lg:px-10">
        <div className="flex w-full max-w-xl flex-col justify-center md:w-1/2">
          <div className="scale-90 lg:scale-100 -mt-24 lg:mt-20 flex h-auto flex-col overflow-y-auto rounded-xl bg-white shadow-2xl scrollbar">
            {/* Header */}
            <div className="flex w-full items-center justify-start rounded-t-lg bg-colorBrand px-5 py-1 text-xl font-semibold text-white">
              <img src={Logo} className="h-10" alt="Logo" />
              <p className="flex-grow -ms-14 text-white">{header}</p>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-6 h-6 cursor-pointer text-white hover:scale-90 duration-200"
                onClick={() => setIsModalFilterOpen(false)}
              >
                <path
                  fillRule="evenodd"
                  d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            {/* Top Filters */}
            <div className="flex w-full justify-evenly border border-colorBrand bg-white py-2 px-5 lg:px-0 items-center">
              <div className="flex w-full flex-col-reverse justify-around space-y-3 lg:flex-row-reverse lg:space-y-0 items-center">
                {/* Reset Button */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleDropDownReset()}
                    className="rounded-2xl bg-colorBrand px-4 py-2 text-white shadow-lg shadow-red-600 hover:scale-95 duration-300"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-6 w-6 text-white hover:-translate-y-1 duration-200"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>

                {/* Filter Type */}
                <div className="flex w-full lg:w-1/2 flex-col">
                  <p className="text-xs text-colorBrand">Filter Type</p>
                  <Dropdown
                    label=""
                    value={searchType}
                    isRequired={false}
                    optionsList={searchstat}
                    optionsField01="value"
                    optionsField02="value"
                    allowCustom={false}
                    enableBrandColor={true}
                    onChange={(value) => setSearchType(value)}
                  />
                </div>

                {/* Busunit */}
                <div className="flex flex-col w-full lg:w-1/3">
                  {/* <label className="text-xs text-medPrimary">Busunit</label> */}
                  <Dropdown
                    label="Business Unit"
                    value={storeName}
                    isRequired={false}
                    optionsList={
                      busUnitsData &&
                      busUnitsData.filter((u) =>
                        roleCodes.includes(u.busunitcode)
                      )
                    }
                    optionsField01="busunitcode"
                    optionsField02="name"
                    allowCustom={false}
                    onChange={(selectedID, selectedValue) => {
                      setStore(selectedID);
                      setStoreName(selectedValue);
                    }}
                  />
                </div>

                {/* Month */}
                <div className="flex w-full lg:w-auto flex-col">
                  <p className="text-xs text-colorBrand">Month</p>
                  <select
                    value={monthParams}
                    onChange={(e) => setMonthParams(e.target.value)}
                    className="block w-full rounded-lg border border-colorBrand bg-white px-1 py-2 text-sm focus:outline-none cursor-pointer"
                  >
                    <option value="" disabled hidden />
                    {dates?.map((date) => (
                      <option key={date} value={date}>
                        {date}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Year */}
                <div className="flex w-full lg:w-auto flex-col">
                  <p className="text-xs text-colorBrand">Year</p>
                  <select
                    value={yearParams}
                    onChange={(e) => setYearParams(e.target.value)}
                    className="block w-full rounded-lg border border-colorBrand bg-white px-1 py-2 text-sm focus:outline-none cursor-pointer"
                  >
                    <option value="" disabled hidden />
                    {years?.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Date Range */}
            <div className="flex w-full flex-col space-y-2 rounded-b-lg bg-white py-2 px-5 lg:flex-row lg:justify-end lg:space-x-5 lg:space-y-0">
              <div className="flex w-full lg:w-auto flex-col">
                <p className="text-xs text-colorBrand">From</p>
                <input
                  type="date"
                  className="w-full rounded-md border border-colorBrand px-3 py-2 focus:outline-none"
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="flex w-full lg:w-auto flex-col">
                <p className="text-xs text-colorBrand">To</p>
                <input
                  type="date"
                  className="w-full rounded-md border border-colorBrand px-3 py-2 focus:outline-none"
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            {/* Apply Filter Button */}
            <div className="flex justify-end px-5 pb-5">
              <button
                onClick={() => setIsModalFilterOpen(false)}
                className="mb-5 rounded-md bg-gradient-to-br from-[#B03C21] to-colorBrand px-4 py-2 text-white shadow-lg shadow-red-600 hover:scale-95 duration-200"
              >
                Filter
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalDashboardFilter;
