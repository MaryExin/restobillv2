import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiClock, FiArrowRight } from "react-icons/fi";
import { FaGift, FaRocket, FaCrown } from "react-icons/fa6";

const ModalTrialExpiration = ({
  header,
  message,
  button = "View Pricing Plans",
  route = "/pricing",
  setIsModalOpen,
}) => {
  const navigate = useNavigate();

  const handleAccept = () => {
    if (route) navigate(route);
    if (setIsModalOpen) setIsModalOpen(false);
  };

  const plans = [
    // {
    //   id: 0,
    //   title: "Trial Access",
    //   price: "FREE",
    //   subtext: "for 1 month",
    //   description: "Perfect para sa mga early adopters",
    //   icon: <FaGift className="w-8 h-8 text-white" />,
    //   gradient: "bg-slate-900/80 backdrop-blur-sm",
    //   features: [
    //     "Full access sa lahat ng features",
    //     "Priority customer support",
    //     "No credit card required",
    //     "Cancel anytime",
    //   ],
    //   button: "Start Free Trial",
    //   popular: true,
    //   buttonStyle: "bg-blue-600 hover:bg-blue-700",
    //   activeButton: false,
    // },
    {
      id: 1,
      title: "Pro Plan",
      price: "₱699",
      oldPrice: "₱1500/month",
      subtext: "/month",
      description: "50% OFF for 1 year!",
      icon: <FaRocket className="w-8 h-8 text-white" />,
      gradient: "from-slate-900 via-slate-800 to-slate-900",
      features: [
        "Core features access",
        "Email support",
        "Monthly reports",
        "Basic analytics",
      ],
      button: "Choose Pro",
      popular: false,
      buttonStyle: "bg-slate-700 hover:bg-slate-600",
      activeButton: true,
    },
    {
      id: 2,
      title: "Enterprise Plan",
      price: "",
      oldPrice: "",
      subtext: "",
      description: "",
      icon: <FaCrown className="w-8 h-8 text-white" />,
      gradient: "from-purple-900 via-indigo-900 to-violet-900",
      features: [
        "All Basic features",
        "Advanced analytics",
        "Priority support",
        "Custom integrations",
        "API access",
      ],
      button: "Choose Enterprise",
      popular: false,
      buttonStyle: "bg-purple-600 hover:bg-purple-700",
      activeButton: true,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsModalOpen?.(false)}
      />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative z-10 w-full max-w-5xl bg-gradient-to-br from-slate-900 via-gray-900 to-black border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-violet-500/20 to-blue-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10  md:p-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-center "
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl mb-6 border border-blue-500/30">
              <FiClock className="w-8 h-8 text-blue-500" />
            </div>
          </motion.div>

          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6 mb-8 text-center">
            <h3 className="text-lg font-semibold text-white mb-2">
              Your 1-Month Trial Has Ended
            </h3>
            <p className="text-gray-300 text-sm">
              Choose a plan below to continue enjoying full access to Lightem.
            </p>
          </div>

          {/* Pricing Plans */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10"
          >
            {plans.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1, duration: 0.4 }}
                whileHover={{ y: -6 }}
                className={`relative p-6 rounded-2xl shadow-lg border border-white/10 bg-gradient-to-br ${plan.gradient}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-white/10 rounded-lg">{plan.icon}</div>
                  {plan.popular && (
                    <span className="text-xs px-3 py-1 bg-blue-500/80 rounded-full text-white">
                      Popular
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-semibold text-white mb-1">
                  {plan.title}
                </h3>
                <p className="text-3xl font-bold text-white">
                  {plan.price}
                  <span className="text-base text-gray-400 font-normal ml-1">
                    {plan.subtext}
                  </span>
                </p>
                {plan.oldPrice && (
                  <p className="text-gray-500 text-sm line-through mb-2">
                    {plan.oldPrice}
                  </p>
                )}
                {plan.description && (
                  <p className="text-gray-300 text-sm mb-4">
                    {plan.description}
                  </p>
                )}

                <ul className="space-y-2 text-sm text-gray-200 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => navigate("/pricing-list")}
                  className={`w-full py-2.5 rounded-lg text-white font-medium transition-all duration-300 ${plan.buttonStyle}`}
                >
                  {plan.button}
                </button>
              </motion.div>
            ))}
          </motion.div>

          {/* Footer Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleAccept}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
            >
              <span>{button}</span>
              <FiArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsModalOpen?.(false)}
              className="flex-1 bg-gray-800/50 hover:bg-gray-800 text-gray-200 font-semibold py-3 px-6 rounded-xl border border-gray-700/50 transition-all duration-300"
            >
              Maybe Later
            </button>
          </div>

          {/* Footer Note */}
          <p className="text-center text-gray-400 text-xs mt-6">
            Need help choosing? Contact{" "}
            <a
              href="mailto:sales@lightem.com"
              className="text-blue-400 hover:text-blue-300"
            >
              lightemsolutionsinc@gmail.com
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default ModalTrialExpiration;
