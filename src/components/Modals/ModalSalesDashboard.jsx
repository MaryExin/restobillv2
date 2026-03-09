import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const backdropVariant = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
  };
  const panelVariant = {
    hidden: { y: "-10%", opacity: 0 },
    visible: {
      y: "0%",
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 25 },
    },
    exit: { y: "10%", opacity: 0, transition: { duration: 0.2 } },
  };
  const listVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } },
  };
  const itemVariant = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-30 flex items-center justify-center"
        initial="hidden"
        animate="visible"
        exit="hidden"
        variants={backdropVariant}
        style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      >
        <motion.div
          className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-2xl mx-4"
          variants={panelVariant}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* Header */}
          <div className="relative bg-gradient-to-br from-colorBrand to-colorBrandSecondary p-6">
            <motion.div
              onClick={() => setIsModalSalesDashboard(false)}
              className="absolute top-4 right-4 text-white cursor-pointer"
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
            >
              <FiXCircle className="w-8 h-8" />
            </motion.div>
            <motion.div
              className="flex items-center justify-center space-x-3"
              initial={{ scale: 0, rotate: -180, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ duration: 0.6, type: "spring", stiffness: 200 }}
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
            </motion.div>
          </div>

          {/* Content */}
          <motion.div
            className="p-6 space-y-4 max-h-[60vh] overflow-auto scrollbar"
            initial="hidden"
            animate="visible"
            variants={listVariants}
          >
            {/* Column Headings */}
            <motion.div
              className="grid grid-cols-4 gap-4 text-gray-600 font-medium"
              variants={itemVariant}
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
            </motion.div>

            {/* Rows */}
            {data
              ?.filter((item) =>
                filter === "countofstoresopen"
                  ? item.storestatus === "OPEN"
                  : item.storestatus === "CLOSED"
              )
              .map((row, idx) => (
                <motion.div
                  key={idx}
                  className="grid grid-cols-4 gap-4 items-center bg-white p-4 rounded-lg shadow hover:shadow-lg transition"
                  variants={itemVariant}
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
                </motion.div>
              ))}
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ModalSalesDashboard;
