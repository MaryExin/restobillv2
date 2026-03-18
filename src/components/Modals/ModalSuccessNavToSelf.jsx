import React from "react";
import ReactDOM from "react-dom";
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

  const modalContent = (
    <motion.div
      className="fixed inset-0 z-[9999] grid place-items-center bg-black/40 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border-t-8 border-colorBrand bg-white shadow-2xl"
        initial={{ y: 50, scale: 0.8 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 50, scale: 0.8 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        data-tour={dataTour}
      >
        <div className="flex flex-col items-center p-6 text-center">
          <motion.div
            className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-colorBrandLighter"
            initial={{ rotate: -180, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <FaCheckCircle className="h-12 w-12 text-colorBrand" />
          </motion.div>

          <motion.h2
            className="mb-2 text-2xl font-bold text-gray-800"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {header}
          </motion.h2>

          <motion.p
            className="mb-6 px-4 text-center text-gray-600"
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {message}
          </motion.p>

          <div data-tour={dataTourBtn}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="rounded-full bg-gradient-to-br from-colorBrand to-colorBrandTertiary px-8 py-3 text-white shadow-lg focus:outline-none"
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

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ModalSuccessNavToSelf;
