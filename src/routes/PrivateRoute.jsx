import React, { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import useZustandLoginCred from "../context/useZustandLoginCred";
import { FaBan } from "react-icons/fa";

const PrivateRoute = ({ routename }) => {
  const { isAuthenticated, roles } = useZustandLoginCred();
  const [role, setRole] = useState(null);

  useEffect(() => {
    if (Array.isArray(roles[0])) {
      const match = roles[0].find((r) => r.rolename === routename);
      if (match) setRole(match.rolename);
    }
  }, [roles, routename]);

  if (isAuthenticated && role === routename) {
    return <Outlet />;
  }

  // Animated Ban Icon variants
  const iconVariants = {
    hidden: { scale: 0 },
    visible: {
      scale: [1, 1.4, 1],
      rotate: [0, 15, -15, 0],
      transition: { duration: 1.2, repeat: Infinity },
    },
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-200 to-gray-100 px-10 lg:px-0">
      <motion.div
        className="max-w-md w-full bg-white p-8 rounded-md shadow-lg text-center relative overflow-hidden"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div
          className="absolute top-0 left-0 w-full h-2 bg-blue-700"
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 0.8 }}
        />
        <motion.div
          className="flex items-center justify-center w-20 h-20 mx-auto mb-4 bg-colorBrandLighter rounded-md"
          variants={iconVariants}
          initial="hidden"
          animate="visible"
        >
          <FaBan className="w-10 h-10 text-blue-700" />
        </motion.div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Oops!</h2>
        <p className="text-gray-600 mb-6">
          You don’t have access to{" "}
          <span className="font-semibold">{routename}</span>.
        </p>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Link
            to="/poscorehomescreen"
            className="inline-block px-6 py-2 bg-blue-700 text-white rounded-md shadow-md"
          >
            Take Me Home
          </Link>
        </motion.div>
        <div className="mt-4 text-sm text-gray-400">
          Need help? Contact support.
        </div>
      </motion.div>
    </div>
  );
};

export default PrivateRoute;
