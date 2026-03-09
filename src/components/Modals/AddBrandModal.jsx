import React from "react";
import { FiX, FiTag, FiCheck } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

export default function AddBrandModal({
  open,
  onClose,
  newBrand,
  setNewBrand,
  onSave,
}) {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
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
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-colorBrand">
                <FiTag className="w-6 h-6" />
                <h2 className="text-lg font-bold">Add Brand</h2>
              </div>
              <motion.button
                onClick={onClose}
                whileHover={{ rotate: 90 }}
                className="text-gray-500 hover:text-gray-800"
              >
                <FiX className="w-6 h-6" />
              </motion.button>
            </div>

            {/* Input + Save */}
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
                <input
                  type="text"
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                  placeholder="Enter brand name"
                  className="w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:border-colorBrand"
                />
                <FiTag className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </motion.div>

              <motion.button
                type="submit"
                className="flex w-full justify-center items-center gap-2 px-4 py-2 bg-gradient-to-br from-darkerPrimary via-darkPrimary to-medPrimary text-white rounded-lg shadow-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FiCheck className="w-5 h-5" />
                Save Brand
              </motion.button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
