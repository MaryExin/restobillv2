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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm lg:scale-125"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.55)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="overflow-hidden rounded-2xl p-[1px] shadow-2xl"
        style={{
          background:
            "linear-gradient(135deg, var(--app-accent), var(--app-accent-secondary))",
        }}
      >
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            backgroundColor: "var(--app-surface)",
            color: "var(--app-text)",
            border: "1px solid var(--app-border)",
          }}
        >
          <div
            className="relative h-32"
            style={{
              background:
                "linear-gradient(135deg, var(--app-accent), var(--app-accent-secondary))",
            }}
          >
            <div
              className="absolute -top-8 -left-8 h-24 w-24 animate-pulse rounded-full"
              style={{
                backgroundColor: "var(--app-surface-soft)",
                opacity: 0.35,
              }}
            />
            <div
              className="absolute -right-8 -bottom-8 h-28 w-28 rounded-full"
              style={{
                backgroundColor: "var(--app-bg)",
                opacity: 0.22,
              }}
            />

            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ rotate: -180, scale: 0, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="rounded-full p-4 shadow-lg"
                style={{
                  backgroundColor: "var(--app-surface)",
                  border: "1px solid var(--app-border)",
                }}
              >
                <FaCheckCircle
                  className="h-16 w-16"
                  style={{ color: "var(--app-accent)" }}
                />
              </motion.div>
            </div>
          </div>

          <div className="space-y-4 px-6 pt-20 pb-8 text-center">
            <h2
              className="text-3xl font-bold"
              style={{ color: "var(--app-text)" }}
            >
              {header}
            </h2>

            <p style={{ color: "var(--app-muted-text)" }}>{message}</p>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(route)}
              className="mt-4 inline-flex items-center space-x-2 rounded-full px-6 py-3 font-medium text-white shadow-lg transition"
              style={{
                background:
                  "linear-gradient(180deg, var(--app-accent) 0%, var(--app-accent-secondary) 100%)",
                boxShadow: "0 12px 28px var(--app-accent-glow)",
              }}
            >
              <span>{button}</span>
              <FaArrowRight className="h-5 w-5" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ModalSuccess;
