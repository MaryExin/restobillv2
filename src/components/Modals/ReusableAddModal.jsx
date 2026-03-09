"use client";
import { FiX, FiCheck } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

export default function ReusableAddModal({
  open,
  onClose,
  value,
  setValue,
  onSave,
  title = "Add Item",
  buttonText = "Save",
  placeholder = "Enter value",
  icon: IconComponent = FiX,
  showCheckbox = false,
  checkboxLabel = "",
  checkboxValue = false,
  setCheckboxValue = null,
  dataTour = "",
  dataTourField = "",
  dataTourBtn = "",
}) {
  const storedFirstTime = localStorage.getItem("isFirstTimeLogin");
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-sm p-6 bg-white rounded-2xl shadow-2xl"
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            data-tour={dataTour}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-colorBrand">
                <IconComponent className="w-6 h-6" />
                <h2 className="text-lg font-bold">{title}</h2>
              </div>
              {storedFirstTime !== "True" && (
                <motion.button
                  onClick={onClose}
                  whileHover={{ rotate: 90 }}
                  className="text-gray-500 hover:text-gray-800"
                >
                  <FiX className="w-6 h-6" />
                </motion.button>
              )}
            </div>

            {/* Input + Checkbox + Save */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSave();
              }}
              className="space-y-4"
            >
              <motion.div
                className="relative"
                whileFocusWithin={{ scale: 1.02 }}
              >
                <div data-tour={dataTourField}>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:border-colorBrand"
                  />
                </div>
                <IconComponent className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </motion.div>

              {showCheckbox && setCheckboxValue && (
                <motion.div
                  className="relative flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 hover:border-blue-300 transition-all cursor-pointer group"
                  whileHover={{ backgroundColor: "#e8f0ff" }}
                  onClick={() => setCheckboxValue(!checkboxValue)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {/* Custom checkbox */}
                    <motion.div
                      className={`relative w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        checkboxValue
                          ? "bg-gradient-to-br from-blue-500 to-indigo-600 border-blue-600 shadow-md"
                          : "bg-white border-blue-300 group-hover:border-blue-400"
                      }`}
                      whileTap={{ scale: 0.9 }}
                    >
                      {checkboxValue && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 200 }}
                        >
                          <FiCheck className="w-3 h-3 text-white font-bold" />
                        </motion.div>
                      )}
                    </motion.div>

                    {/* Label */}
                    <label
                      htmlFor="modal-checkbox"
                      className="text-sm font-semibold text-gray-700 cursor-pointer select-none group-hover:text-gray-900 transition-colors"
                    >
                      {checkboxLabel}
                    </label>
                  </div>

                  {/* Status indicator */}
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full transition-all ${
                      checkboxValue
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {checkboxValue ? "Yes" : "No"}
                  </span>

                  {/* Hidden input for form compatibility */}
                  <input
                    type="checkbox"
                    id="modal-checkbox"
                    checked={checkboxValue}
                    onChange={(e) => setCheckboxValue(e.target.checked)}
                    className="sr-only"
                    aria-label={checkboxLabel}
                  />
                </motion.div>
              )}

              <motion.button
                type="submit"
                className="flex w-full justify-center items-center gap-2 px-4 py-2 bg-gradient-to-br from-darkerPrimary via-darkPrimary to-medPrimary text-white rounded-lg shadow-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                data-tour={dataTourBtn}
              >
                <FiCheck className="w-5 h-5" />
                {buttonText}
              </motion.button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
