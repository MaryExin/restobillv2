import React from "react";
import { motion } from "framer-motion";
import { FaCheckCircle } from "react-icons/fa";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalSuccessNavToSelf = ({
  header,
  message,
  button,
  setIsModalOpen,
  resetForm,
  dataTour,
  dataTourBtn,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Animated Modal Container */}
      <motion.div
        className="relative bg-white rounded-2xl shadow-2xl border-t-8 border-colorBrand w-11/12 max-w-md overflow-hidden"
        initial={{ y: 50, scale: 0.8 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 50, scale: 0.8 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        data-tour={dataTour}
      >
        {/* Icon & Header */}
        <div className="flex flex-col items-center p-6">
          <motion.div
            className="w-20 h-20 bg-colorBrandLighter rounded-full flex items-center justify-center mb-4"
            initial={{ rotate: -180, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <FaCheckCircle className="w-12 h-12 text-colorBrand" />
          </motion.div>
          <motion.h2
            className="text-2xl font-bold text-gray-800 mb-2"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {header}
          </motion.h2>
          <motion.p
            className="text-gray-600 text-center mb-6 px-4"
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {message}
          </motion.p>

          {/* Button */}
          <div data-tour={dataTourBtn} className="p-5">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3 bg-gradient-to-br from-colorBrand to-colorBrandTertiary text-white rounded-full shadow-lg focus:outline-none"
              onClick={() => {
                setIsModalOpen(false);
                resetForm && resetForm();
              }}
            >
              {button}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ModalSuccessNavToSelf;
