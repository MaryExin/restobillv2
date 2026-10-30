import React, { useEffect, useState } from "react";
import {
  FiXCircle,
  FiShoppingBag as FiStore,
  FiClock,
  FiUser,
  FiCheckCircle,
} from "react-icons/fi";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const formatToTime12Hour = (inputDate) => {
  // Parse the input date string
  const date = new Date(inputDate);

  // Get the components of the date
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");

  // Determine AM or PM
  const amOrPm = hours >= 12 ? "PM" : "AM";

  // Convert to 12-hour format
  const formattedHours = hours % 12 === 0 ? 12 : hours % 12;

  // Construct the formatted time string
  const formattedTime = `${formattedHours}:${minutes} ${amOrPm}`;

  return formattedTime;
};

const formatToMonthDay = (inputDate) => {
  // Parse the input date string
  const date = new Date(inputDate);

  // Define month names
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // Get the components of the date
  const month = monthNames[date.getMonth()];
  const day = date.getDate();

  // Construct the formatted month-day string
  const formattedMonthDay = `${month} ${day}`;

  return formattedMonthDay;
};

const ModalSalesDashboard = ({ setIsModalSalesDashboard, filter, data }) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  // Animation variants

  return (
    <>
      <div
        className="ui-enter fixed inset-0 z-30 flex items-center justify-center"
        style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      >
        <div
          className="ui-scale-in bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-2xl mx-4"
        >
          {/* Header */}
          <div className="relative bg-gradient-to-br from-colorBrand to-colorBrandSecondary p-6">
            <div
              onClick={() => setIsModalSalesDashboard(false)}
              className="hover:opacity-90 active:opacity-80 transition-opacity duration-150 absolute top-4 right-4 text-white cursor-pointer"
            >
              <FiXCircle className="w-8 h-8" />
            </div>
            <div
              className="ui-scale-in flex items-center justify-center space-x-3"
            >
              {filter === "countofstoresopen" ? (
                <FiCheckCircle className="text-white w-10 h-10" />
              ) : (
                <FiStore className="text-white w-10 h-10" />
              )}
              <h2 className="text-white text-2xl font-bold">
                {filter === "countofstoresopen"
                  ? "Open Cashiers"
                  : "Closed Busunits"}
              </h2>
            </div>
          </div>

          {/* Content */}
          <div
            className="ui-enter p-6 space-y-4 max-h-[60vh] overflow-auto scrollbar"
          >
            {/* Column Headings */}
            <div
              className="ui-enter grid grid-cols-4 gap-4 text-gray-600 font-medium"
            >
              {filter === "countofstoresopen" ? (
                <>
                  {" "}
                  <span>Store</span>
                  <span>Date</span>
                  <span>Cashier</span>
                  <span>Time</span>{" "}
                </>
              ) : (
                <>
                  {" "}
                  <span>Store</span>
                  <span>Status</span>
                  <span></span>
                  <span></span>{" "}
                </>
              )}
            </div>

            {/* Rows */}
            {data
              ?.filter((item) =>
                filter === "countofstoresopen"
                  ? item.storestatus === "OPEN"
                  : item.storestatus === "CLOSED"
              )
              .map((row, idx) => (
                <div
                  key={idx}
                  className="ui-enter grid grid-cols-4 gap-4 items-center bg-white p-4 rounded-lg shadow hover:shadow-lg transition"
                >
                  <div className="flex items-center space-x-2">
                    <FiStore className="text-colorBrand w-5 h-5" />
                    <span className="font-semibold">{row.name}</span>
                  </div>
                  {filter === "countofstoresopen" ? (
                    <>{formatToMonthDay(row.transdate)}</>
                  ) : (
                    <span className="text-red-500">{row.storestatus}</span>
                  )}
                  {filter === "countofstoresopen" ? (
                    <div className="flex items-center space-x-2">
                      <FiUser className="w-5 h-5 text-gray-500" />
                      <span>{row.employeename}</span>
                    </div>
                  ) : (
                    <span></span>
                  )}
                  {filter === "countofstoresopen" ? (
                    <div className="flex items-center space-x-2">
                      <FiClock className="w-5 h-5 text-gray-500" />
                      <span>{formatToTime12Hour(row.opening_time)}</span>
                    </div>
                  ) : (
                    <span></span>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalSalesDashboard;
