import React from "react";
import { motion } from "framer-motion";
import { FaSpinner } from "react-icons/fa";

const CircleSpinner = () => {
  return (
    <motion.div
      className="flex items-center justify-center"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
    >
      <FaSpinner className="w-6 h-6 text-colorBrand" />
    </motion.div>
  );
};

export default CircleSpinner;
