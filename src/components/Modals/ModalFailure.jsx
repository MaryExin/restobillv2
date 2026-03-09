import React from "react";
import { motion } from "framer-motion";
import { MdWarning } from "react-icons/md";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalFailure = ({
  header,
  message,
  button,
  closeModal,
  setIsModalOpen,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        className="bg-white rounded-md shadow-lg border-t-8 border-red-500 w-11/12 max-w-md overflow-hidden"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        {/* Icon Header */}
        <div className="p-6 flex flex-col items-center">
          <motion.div
            className="w-16 h-16 flex items-center justify-center bg-[#fee2e2] rounded-md mb-4"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            <MdWarning className="w-8 h-8 text-red-500" />
          </motion.div>

          {/* Text Content */}
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            {header}
          </h2>
          <p className="text-gray-600 text-center mb-6">{message}</p>

          {/* Action Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsModalOpen(false)}
            className="px-6 py-2 bg-red-500 text-white rounded-md shadow-md hover:bg-red-600 transition"
          >
            {button}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default ModalFailure;
