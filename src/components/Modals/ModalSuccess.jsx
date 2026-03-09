import React from "react";
import { useNavigate } from "react-router-dom";
import useZustandSideMenu from "../../context/useZustandSideMenu";
import { motion } from "framer-motion";
import { FaCheckCircle, FaArrowRight } from "react-icons/fa";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalSuccess = ({ header, message, button, route }) => {
  const navigate = useNavigate();
  const { isDesktopSideMenu } = useZustandSideMenu();
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black lg:scale-125 bg-opacity-60 backdrop-blur-sm">
      {/* Gradient border wrapper */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="bg-gradient-to-br from-green-400 to-green-600 p-1 rounded-2xl shadow-2xl"
      >
        <div className="bg-white rounded-2xl overflow-hidden relative">
          {/* Header with geometric shapes */}
          <div className="relative bg-gradient-to-br from-green-600 to-green-500 h-32 ">
            {/* Decorative circles */}
            <div className="absolute -top-8 -left-8 w-24 h-24 bg-green-300 rounded-full opacity-50 mix-blend-multiply animate-pulse" />
            <div className="absolute -bottom-8 -right-8 w-28 h-28 bg-green-700 rounded-full opacity-40 mix-blend-multiply" />
            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ rotate: -180, scale: 0, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="bg-white rounded-full p-4 shadow-lg"
              >
                <FaCheckCircle className="w-16 h-16 text-green-600" />
              </motion.div>
            </div>
          </div>

          {/* Body */}
          <div className="pt-20 pb-8 px-6 text-center space-y-4">
            <h2 className="text-3xl font-bold text-gray-800">{header}</h2>
            <p className="text-gray-600">{message}</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(route)}
              className="inline-flex items-center space-x-2 mt-4 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-full shadow-lg transition"
            >
              <span>{button}</span>
              <FaArrowRight className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ModalSuccess;
