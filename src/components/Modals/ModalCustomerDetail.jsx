// ModalCustomerDetail.jsx
import React, { useEffect, useState, useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import { motion } from "framer-motion";
import { FaTimes, FaTag, FaCalendarAlt, FaSearch } from "react-icons/fa";
import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import { LinearProgress } from "@mui/material";
import { roundDecimals } from "../../constants/RoundDecimals";
import { useWindowSize } from "react-use";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const formatToShortDate = (inputDate) => {
  const months = [
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
  const [year, month, day] = inputDate.split("-");
  return `${months[+month - 1]} ${day}`;
};

export default function ModalCustomerDetail({
  setIsModalCustomerDetail,
  customerId,
}) {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  // ————— Hooks & state —————
  const { width } = useWindowSize(); // Must be inside the component
  // Now width will update on every resize, so we can recalc ROW_HEIGHT
  const ROW_HEIGHT = width < 768 ? 160 : 80;
  // (Feel free to adjust 100px if each mobile row needs more or less vertical space.)

  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filteredCategory, setFilteredCategory] = useState([]);

  const {
    data: customerDetailData,
    isLoading: customerDetailIsLoading,
    mutate: customerDetailMutate,
  } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_CUSTOMERS_PURCHASE_HISTORY_READ_MUTATION,
    "POST"
  );

  useEffect(() => {
    customerDetailMutate({ customerid: customerId });
  }, [customerId]);

  // ————— Filtered data (search + date range) —————
  const filteredData = useMemo(() => {
    if (!customerDetailData) return [];
    return customerDetailData.filter((item) => {
      const matchesSearch =
        searchTerm === "" ||
        item.productname.toLowerCase().includes(searchTerm.toLowerCase());
      const itemDate = new Date(item.transdate);
      const afterFrom = dateFrom === "" || itemDate >= new Date(dateFrom);
      const beforeTo = dateTo === "" || itemDate <= new Date(dateTo);
      return matchesSearch && afterFrom && beforeTo;
    });
  }, [customerDetailData, searchTerm, dateFrom, dateTo]);

  // ————— Build category list from filteredData —————
  useEffect(() => {
    const categories = [];
    (filteredData || []).forEach((item) => {
      if (!categories.includes(item.category)) {
        categories.push(item.category);
      }
    });
    setFilteredCategory(categories.sort((a, b) => a.localeCompare(b)));
  }, [filteredData]);

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-zinc-800 bg-opacity-75 z-50"
      />

      {/* Modal Container */}
      <div className="fixed inset-0 flex justify-center items-start pt-10 z-50 px-4 lg:px-0">
        <motion.div
          initial={{ y: -50, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -50, opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full md:w-3/4 lg:w-1/2 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="relative bg-gradient-to-br from-colorBrand to-colorBrandTertiary p-6 flex items-center justify-center">
            <motion.h2
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="text-2xl font-bold text-white flex items-center space-x-2"
            >
              <FaTag className="w-6 h-6 text-white" />
              <span>Purchase History</span>
            </motion.h2>
            <motion.div
              onClick={() => setIsModalCustomerDetail(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/30 cursor-pointer"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <FaTimes className="w-6 h-6 text-white" />
            </motion.div>
          </div>

          {/* Loading Bar */}
          {customerDetailIsLoading && (
            <div className="w-full">
              <LinearProgress color="primary" />
            </div>
          )}

          {/* Search & Date Filters */}
          <div className="flex flex-col lg:flex-row lg:justify-between items-center gap-4 p-4 border-b border-zinc-200">
            <div className="relative w-full lg:w-1/3">
              <FaSearch className="absolute top-3 left-3 text-zinc-400" />
              <input
                type="text"
                placeholder="Search product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-colorBrand"
              />
            </div>
            <div className="flex w-full lg:w-2/3 gap-4">
              <div className="flex-1">
                <label className="block text-sm text-zinc-600 mb-1">
                  Date From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-colorBrand"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-zinc-600 mb-1">
                  Date To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-colorBrand"
                />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <motion.h3
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="text-zinc-600 text-xl font-semibold"
            >
              Summary of Purchases
            </motion.h3>

            {filteredCategory.map((ctg, idx) => {
              const itemsForCategory = filteredData.filter(
                (item) => item.category === ctg
              );

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * idx, duration: 0.4 }}
                  className="border border-zinc-200 rounded-lg overflow-hidden"
                >
                  {/* Category Header */}
                  <motion.div
                    initial={{ backgroundColor: "#F3F4F6" }}
                    whileHover={{ backgroundColor: "#E5E7EB" }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center space-x-2 p-3 bg-zinc-100 cursor-default"
                  >
                    <FaTag className="w-5 h-5 text-colorBrand" />
                    <span className="font-semibold text-zinc-700">{ctg}</span>
                  </motion.div>

                  {/* Column Labels (desktop only) */}
                  <div className="hidden lg:flex text-xs text-zinc-600 bg-zinc-50 p-2">
                    <div className="w-36 text-left">Date</div>
                    <div className="w-48 text-left">Description</div>
                    <div className="w-20 text-left">SRP</div>
                    <div className="w-16 text-left">Qty</div>
                    <div className="w-32 text-left">Sales (VatEx)</div>
                    <div className="w-16 text-left">Vat</div>
                    <div className="w-24 text-left">Total</div>
                    <div className="w-20 text-left">UOM</div>
                  </div>

                  {/* Virtualized List for Category Items */}
                  <List
                    height={Math.min(itemsForCategory.length * ROW_HEIGHT, 300)}
                    itemCount={itemsForCategory.length}
                    itemSize={ROW_HEIGHT}
                    width="100%"
                    className="outline-none"
                  >
                    {({ index: rowIndex, style }) => {
                      const item = itemsForCategory[rowIndex];
                      return (
                        <motion.div
                          key={rowIndex}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            delay: 0.02 * rowIndex,
                            duration: 0.3,
                          }}
                          // whileHover={{ scale: 1.01 }}
                          style={style}
                          className="flex flex-col lg:flex-row items-start lg:items-center text-xs lg:space-x-3 px-3 py-2 hover:bg-zinc-50 cursor-pointer"
                        >
                          <div className="flex items-center w-full lg:w-36">
                            <FaCalendarAlt className="w-4 h-4 text-colorBrand mr-1" />
                            <span className="font-medium text-zinc-600">
                              {formatToShortDate(item.transdate)}
                            </span>
                          </div>
                          <div className="w-full lg:w-48 text-zinc-700 break-words">
                            {item.productname}
                          </div>
                          <div className="w-full lg:w-20 text-zinc-700">
                            {item.srp}
                          </div>
                          <div className="w-full lg:w-16 text-zinc-700">
                            {item.qty}
                          </div>
                          <div className="w-full lg:w-32 text-zinc-700">
                            {roundDecimals(item.total_sales - item.vat)}
                          </div>
                          <div className="w-full lg:w-16 text-zinc-700">
                            {item.vat}
                          </div>
                          <div className="w-full lg:w-24 text-zinc-700">
                            ₱{item.total_sales}
                          </div>
                          <div className="w-full lg:w-20 text-zinc-700">
                            {`${item.uomval} ${item.uom}`}
                          </div>
                        </motion.div>
                      );
                    }}
                  </List>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </>
  );
}
