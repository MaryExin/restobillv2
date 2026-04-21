import React from "react";
import { AnimatePresence, motion } from "framer-motion";

const ModalYesNoReusable = ({
  header = "Are you sure?",
  message = "Please confirm your action.",
  setYesNoModalOpen,
  id,
  triggerYesNoEvent,
  dataTour,
  dataTourBtn,
  yesLabel = "Yes",
  noLabel = "No",
}) => {
  const handleYes = () => {
    if (typeof triggerYesNoEvent === "function") {
      triggerYesNoEvent(id);
    }
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
        className="fixed inset-0 z-[100000] flex items-center justify-center p-4"
        style={{
          backgroundColor: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
        }}
      >
        <motion.div
          data-tour={dataTour}
          initial={{ scale: 0.95, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 10 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="w-full max-w-sm rounded-3xl border p-8 text-center shadow-2xl"
          style={{
            background: "var(--app-surface)",
            color: "var(--app-text)",
            borderColor: "var(--app-border)",
          }}
        >
          <div
            className="mx-auto mb-5 h-1.5 w-20 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, var(--app-accent), var(--app-accent-secondary))",
            }}
          />

          <h3 className="mb-2 text-xl font-black">{header}</h3>

          <p
            className="mb-6 text-sm"
            style={{ color: "var(--app-muted-text)" }}
          >
            {message}
          </p>

          <div className="flex gap-3">
            <motion.button
              onClick={handleYes}
              data-tour={dataTourBtn}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 rounded-2xl py-3 font-bold text-white"
              style={{
                background:
                  "linear-gradient(180deg, var(--app-accent), var(--app-accent-secondary))",
                boxShadow: "0 10px 24px var(--app-accent-glow)",
              }}
            >
              {yesLabel}
            </motion.button>

            <motion.button
              onClick={handleNo}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 rounded-2xl py-3 font-bold"
              style={{
                backgroundColor: "var(--app-surface-soft)",
                color: "var(--app-text)",
                border: "1px solid var(--app-border)",
              }}
            >
              {noLabel}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ModalYesNoReusable;
