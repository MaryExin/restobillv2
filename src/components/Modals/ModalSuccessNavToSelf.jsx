import React, { useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { motion } from "framer-motion";
import { FaCheckCircle } from "react-icons/fa";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";
import { useTheme } from "../../context/ThemeContext";

const ModalSuccessNavToSelf = ({
  header = "Saved Successfully",
  message = "Your changes have been saved.",
  button = "OK",
  setIsModalOpen,
  resetForm,
  dataTour,
  dataTourBtn,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const { theme } = useTheme();

  const isDark = theme === "dark";

  const handleClose = useCallback(() => {
    setIsModalOpen(false);
    resetForm && resetForm();
  }, [setIsModalOpen, resetForm]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose]);

  const modalContent = (
    <motion.div
      className={`fixed inset-0 z-[340] flex items-center justify-center p-4 ${
        isDark ? "bg-black/70" : "bg-slate-900/40"
      }`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        data-tour={dataTour}
        className={`w-full max-w-sm rounded-3xl border p-8 text-center shadow-2xl transition-colors ${
          isDark
            ? "border-white/10 bg-slate-900"
            : "border-slate-200 bg-white"
        }`}
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
          <FaCheckCircle size={24} />
        </div>

        <h3
          className={`mb-2 text-xl font-black ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          {header}
        </h3>

        <p
          className={`mb-6 text-sm ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          {message}
        </p>

        <div data-tour={dataTourBtn}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleClose}
            className="w-full rounded-2xl bg-blue-600 py-3 font-bold text-white transition hover:bg-blue-500"
            autoFocus
          >
            {button}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ModalSuccessNavToSelf;