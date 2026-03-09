import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaQuestionCircle } from "react-icons/fa";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalYesNoReusable = ({
  header,
  message,
  setYesNoModalOpen,
  id,
  triggerYesNoEvent,
  dataTour,
  dataTourBtn,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const handleYes = () => {
    triggerYesNoEvent(id);
    setYesNoModalOpen(false);
  };
  const handleNo = () => setYesNoModalOpen(false);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[999999] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Gradient border */}
        <motion.div
          data-tour={dataTour}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="bg-gradient-to-br from-colorBrand to-colorBrandSecondary p-1 rounded-2xl shadow-2xl"
        >
          <div className="bg-white rounded-2xl overflow-hidden w-[90vw] max-w-md">
            {/* Header with shapes */}
            <div className="relative bg-gradient-to-br from-colorBrand to-colorBrandSecondary h-32">
              <div className="absolute -top-8 -left-8 w-24 h-24 bg-colorBrandLighter rounded-full opacity-50 mix-blend-multiply animate-pulse" />
              <div className="absolute -bottom-8 -right-8 w-28 h-28 bg-colorBrandLighter rounded-full opacity-40 mix-blend-multiply" />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  initial={{ rotate: -180, scale: 0, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="bg-white rounded-full p-4 shadow-lg"
                >
                  <FaQuestionCircle className="w-16 h-16 text-colorBrand" />
                </motion.div>
              </div>
            </div>

            {/* Content */}
            <div className="pt-20 pb-6 px-6 text-center space-y-4">
              <h2 className="text-2xl font-bold text-gray-800">{header}</h2>
              <p className="text-gray-600">{message}</p>

              <div className="flex justify-center gap-4 mt-4">
                <motion.button
                  onClick={handleYes}
                  data-tour={dataTourBtn}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-flex items-center px-6 py-2 bg-colorBrand hover:bg-colorBrandSecondary text-white font-medium rounded-full shadow-lg transition"
                >
                  Yes
                </motion.button>
                <motion.button
                  onClick={handleNo}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-flex items-center px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium rounded-full shadow-lg transition"
                >
                  No
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ModalYesNoReusable;
