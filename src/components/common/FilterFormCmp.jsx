import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoMdClose } from "react-icons/io";
import { FaFilter } from "react-icons/fa";
import Dropdown from "../Dropdown/Dropdown";

export const FilterFormCmp = ({ title, date, options = [], buttons = [] }) => {
  const [showFilters, setShowFilters] = useState(false);
  const [alignLeft, setAlignLeft] = useState(false);
  const buttonRef = useRef(null);

  // Auto-detect if button is near the right edge
  useEffect(() => {
    if (showFilters && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const distanceFromRight = viewportWidth - rect.right;
      // if button is within 350px of the right edge, open dropdown to the left
      setAlignLeft(distanceFromRight < 350);
    }
  }, [showFilters]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target) &&
        !e.target.closest(".filter-dropdown")
      ) {
        setShowFilters(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={buttonRef}>
      {/* Filter Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowFilters((prev) => !prev)}
        className="py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex gap-2 items-center group"
      >
        <FaFilter className="text-sm group-hover:rotate-12 transition-transform duration-300" />
        <span className="hidden sm:inline font-medium">Filter</span>
      </motion.button>

      {/* Dropdown Form */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 8, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`filter-dropdown absolute mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 min-w-[300px] md:min-w-[700px] max-w-4xl
              ${alignLeft ? "right-0" : "left-0"}`}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-colorBrand via-medPrimary to-softPrimary p-6 text-white rounded-t-2xl">
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowFilters(false)}
                className="absolute right-2 top-2 p-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full transition-all duration-200"
              >
                <IoMdClose className="text-lg" />
              </motion.button>

              <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-1">{title}</h2>
              {date && !isNaN(new Date(date).getTime()) && (
                <p className="text-blue-100 text-sm">
                  {new Date(date).toLocaleDateString("en-PH", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}

              </div>
            </div>

            {/* Form Fields */}
            <div className="p-6">
              <div className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-3 mb-6">
                {options.map((option, index) => (
                  <motion.div
                    key={option.key || index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    {option.type === "date" || option.type === "text" ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {option.label}
                        </label>
                        <input
                          type={option.type}
                          value={option.value}
                          onChange={option.handleChange}
                          className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3 px-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all duration-200"
                        />
                      </div>
                    ) : null}

                    {option.type === "dropdown" && (
                      <Dropdown
                        label={option.label}
                        value={option.value}
                        optionsList={option.optionsList}
                        optionsField01={option.optionsField01}
                        optionsField02={option.optionsField02}
                        onChange={option.handleChange}
                        allowCustom={option.allowCustom ?? false}
                        isRequired={option.isRequired ?? false}
                      />
                    )}

                    {option.type === "select" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {option.label}
                        </label>
                        <select
                          value={option.value}
                          onChange={option.handleChange}
                          className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 appearance-none"
                        >
                          {option.allowEmpty !== false && (
                            <option value="" disabled hidden>
                              Select {option.label}
                            </option>
                          )}
                          {option.optionsList?.map((item, i) => {
                            const value = option.optionsField01
                              ? item[option.optionsField01]
                              : item;
                            const label = option.optionsField02
                              ? item[option.optionsField02]
                              : item;
                            return (
                              <option key={i} value={value}>
                                {label}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Buttons */}
              <div className="flex flex-wrap gap-3 justify-end pt-4 border-t border-gray-100">
                {buttons.map((btn, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={btn.onClick}
                    className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md ${
                      btn.variant === "primary"
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {btn.icon && <span className="text-sm">{btn.icon}</span>}
                    <span>{btn.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Accent */}
            <div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 rounded-b-2xl"></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
