import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";

const ModalYesNoReusable = ({
  header = "Are you sure?",
  message = "Please confirm your action.",
  setYesNoModalOpen,
  id,
  triggerYesNoEvent,
  dataTour,
  dataTourBtn,
}) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const handleYes = () => {
    triggerYesNoEvent(id);
    setYesNoModalOpen(false);
  };

  const handleNo = () => {
    setYesNoModalOpen(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-[100000] flex items-center justify-center p-4 ${
          isDark ? "bg-black/70" : "bg-slate-900/40"
        }`}
      >
        <motion.div
          data-tour={dataTour}
          initial={{ scale: 0.95, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 10 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className={`w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl transition-colors ${
            isDark
              ? "border border-white/10 bg-slate-900"
              : "border border-slate-200 bg-white"
          }`}
        >
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

          <div className="flex gap-3">
            <motion.button
              onClick={handleYes}
              data-tour={dataTourBtn}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 rounded-2xl bg-blue-600 py-3 font-bold text-white transition hover:bg-blue-500"
            >
              Yes
            </motion.button>

            <motion.button
              onClick={handleNo}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex-1 rounded-2xl py-3 font-bold transition-colors ${
                isDark
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "bg-slate-200 text-slate-800 hover:bg-slate-300"
              }`}
            >
              No
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ModalYesNoReusable;
