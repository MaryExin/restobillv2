import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FaUtensils, FaReceipt, FaChartPie, FaCoins } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
import Background from "../../assets/background.png";
import Ordering from "../../assets/Ordering.jpg";
import Billing from "../../assets/Billing.jpg";
import { useTheme } from "../../context/ThemeContext";

const Home = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [dashboardPassword, setDashboardPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const menuOptions = [
    {
      id: "ordering",
      title: "Ordering",
      description: "Manage and create new customer orders efficiently.",
      image: Ordering,
      path: "/ordering",
      icon: <FaUtensils className="text-2xl mb-4" />,
      color: isDark ? "from-blue-600/80" : "from-blue-500/70",
    },
    {
      id: "billing",
      title: "Billing",
      description: "Process payments and generate billing transactions.",
      image: Billing,
      path: "/printbilling",
      icon: <FaReceipt className="text-2xl mb-4" />,
      color: isDark ? "from-indigo-600/80" : "from-indigo-500/70",
    },
    // {
    //   id: "payments",
    //   title: "Payment & Collections",
    //   description: "Process payment and collections",
    //   image: Billing,
    //   path: "/payments",
    //   icon: <FaCoins className="text-2xl mb-4" />,
    //   color: isDark ? "from-indigo-600/80" : "from-indigo-500/70",
    // },
    {
      id: "salesdashboard",
      title: "Sales Dashboard",
      description: "Sales Dashboard",
      image: Billing,
      path: "/salesdashboard",
      icon: <FaChartPie className="text-2xl mb-4" />,
      color: isDark ? "from-indigo-600/80" : "from-indigo-500/70",
    },
    {
      id: "transactionrecords",
      title: "Transaction Records",
      description: "Transaction Records",
      image: Billing,
      path: "/transactionrecords",
      icon: <FaChartPie className="text-2xl mb-4" />,
      color: isDark ? "from-indigo-600/80" : "from-indigo-500/70",
    },
  ];

  const handleCardClick = (item) => {
    if (item.id === "salesdashboard") {
      setShowPasswordModal(true);
      setDashboardPassword("");
      setPasswordError("");
      return;
    }

    navigate(item.path);
  };

  const handlePasswordSubmit = () => {
    if (dashboardPassword === "1234") {
      setShowPasswordModal(false);
      setDashboardPassword("");
      setPasswordError("");
      navigate("/salesdashboard");
      return;
    }

    setPasswordError("Incorrect password.");
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setDashboardPassword("");
    setPasswordError("");
  };

  return (
    <div
      className={`relative min-h-screen w-full overflow-hidden font-sans transition-colors duration-300 ${
        isDark ? "bg-[#020617]" : "bg-slate-100"
      }`}
    >
      <div
        className={`absolute inset-0 bg-cover bg-center blur-md scale-105 transition-transform duration-1000 ${
          isDark ? "opacity-40" : "opacity-20"
        }`}
        style={{ backgroundImage: `url(${Background})` }}
      />

      <div
        className={`absolute inset-0 ${
          isDark
            ? "bg-gradient-to-b from-slate-950/80 via-slate-950/90 to-slate-950"
            : "bg-gradient-to-b from-white/80 via-slate-100/90 to-slate-200"
        }`}
      />

      <div
        className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] ${
          isDark ? "bg-blue-600/20" : "bg-blue-400/20"
        }`}
      />
      <div
        className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] ${
          isDark ? "bg-indigo-600/20" : "bg-indigo-400/20"
        }`}
      />

      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4 ${
              isDark ? "bg-black/60" : "bg-slate-900/30"
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`w-full max-w-md rounded-[2rem] border p-6 shadow-2xl transition-colors ${
                isDark
                  ? "bg-slate-950 border-white/10"
                  : "bg-white border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2
                    className={`text-xl font-black ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Sales Dashboard
                  </h2>
                  <p
                    className={`text-sm ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Enter password to continue.
                  </p>
                </div>

                <button
                  onClick={handleClosePasswordModal}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isDark
                      ? "text-slate-400 hover:text-white hover:bg-slate-800"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <IoMdClose size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <input
                  type="password"
                  value={dashboardPassword}
                  onChange={(e) => {
                    setDashboardPassword(e.target.value);
                    setPasswordError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handlePasswordSubmit();
                  }}
                  placeholder="Enter password"
                  className={`w-full rounded-2xl px-5 py-4 focus:outline-none focus:ring-4 transition-colors ${
                    isDark
                      ? "bg-slate-900/50 border border-slate-800 text-white focus:ring-blue-500/10 focus:border-blue-500/40"
                      : "bg-slate-50 border border-slate-300 text-slate-900 focus:ring-blue-500/10 focus:border-blue-400"
                  }`}
                />

                {passwordError && (
                  <p className="text-red-400 text-sm">{passwordError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleClosePasswordModal}
                    className={`flex-1 rounded-2xl px-5 py-4 transition-all ${
                      isDark
                        ? "bg-slate-800 text-slate-300 hover:text-white"
                        : "bg-slate-200 text-slate-700 hover:text-slate-900"
                    }`}
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handlePasswordSubmit}
                    className={`flex-1 rounded-2xl px-5 py-4 font-bold transition-all ${
                      isDark
                        ? "bg-blue-600 text-white hover:bg-blue-500"
                        : "bg-blue-500 text-white hover:bg-blue-600"
                    }`}
                  >
                    Enter
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1
            className={`text-5xl md:text-7xl font-black tracking-tighter mb-4 ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            DASH<span className="text-blue-500">BOARD</span>
          </h1>
          <div className="h-1.5 w-24 bg-blue-600 mx-auto rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)]" />
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
          {menuOptions.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9, x: index === 0 ? -30 : 30 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{
                delay: 0.1 * index,
                type: "spring",
                stiffness: 100,
              }}
              onClick={() => handleCardClick(item)}
              className={`group relative aspect-[4/3] md:aspect-square rounded-[2.5rem] overflow-hidden cursor-pointer shadow-2xl transition-colors ${
                isDark ? "border border-white/10" : "border border-slate-200"
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                style={{ backgroundImage: `url(${item.image})` }}
              />

              <div
                className={`absolute inset-0 bg-gradient-to-t ${item.color} ${
                  isDark ? "to-slate-950/40" : "to-white/30"
                } opacity-80 transition-opacity group-hover:opacity-90`}
              />
              <div
                className={`absolute inset-0 border-2 border-transparent rounded-[2.5rem] transition-all duration-500 ${
                  isDark
                    ? "group-hover:border-blue-500/50"
                    : "group-hover:border-blue-400/60"
                }`}
              />

              <div
                className={`relative h-full flex flex-col justify-end p-8 md:p-12 ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                <motion.div
                  className={`backdrop-blur-md w-fit p-3 rounded-2xl mb-4 border ${
                    isDark
                      ? "bg-white/10 border-white/20"
                      : "bg-white/70 border-white/60"
                  }`}
                  whileHover={{ rotate: 10 }}
                >
                  {item.icon}
                </motion.div>

                <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-2">
                  {item.title}
                </h2>
                <p
                  className={`text-sm md:text-base opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500 max-w-xs font-medium ${
                    isDark ? "text-slate-200" : "text-slate-700"
                  }`}
                >
                  {item.description}
                </p>

                <div
                  className={`mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] transition-colors ${
                    isDark
                      ? "text-white/50 group-hover:text-white"
                      : "text-slate-600 group-hover:text-slate-900"
                  }`}
                >
                  Enter Module
                  <div
                    className={`h-[1px] w-8 transition-all group-hover:w-12 ${
                      isDark
                        ? "bg-white/20 group-hover:bg-white"
                        : "bg-slate-400 group-hover:bg-slate-900"
                    }`}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className={`mt-16 text-[10px] font-black uppercase tracking-[0.5em] ${
            isDark ? "text-slate-500" : "text-slate-600"
          }`}
        >
          POS System v2.0 • Management Console
        </motion.p>
      </div>
    </div>
  );
};

export default Home;
