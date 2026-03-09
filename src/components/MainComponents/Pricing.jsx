import { useState } from "react";
import {
  FaCheck,
  FaStar,
  FaGift,
  FaCrown,
  FaRocket,
  FaLock,
  FaTimes,
  FaUser,
  FaEnvelope,
  FaCreditCard,
  FaCalendarAlt,
  FaShieldAlt,
  FaPhoneAlt,
  FaBuilding,
} from "react-icons/fa";
import { FiCalendar } from "react-icons/fi";
import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import { useNavigate } from "react-router-dom";
import useZustandLoginCred from "../../context/useZustandLoginCred";
import { motion } from "framer-motion";
import { useExecuteToast } from "../../context/ToastContext";

export default function Pricing() {
  const HeroImage = import.meta.env.VITE_HERO_IMAGE_BACKGROUND;
  const [subscription, setSubscription] = useState(null);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    companyName: "",
    position: "",
    contactNumber: "",
    businessType: "",
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    billingAddress: "",
    bookKeeper: "",
  });

  const plans = [
    {
      id: 0,
      title: "Trial Access",
      price: "FREE",
      subtext: "for 1 months",
      description: "Perfect para sa mga early adopters",
      icon: <FaGift className="w-8 h-8 text-white" />,
      gradient: "bg-slate-900/80 backdrop-blur-sm",
      features: [
        "Full access sa lahat ng features",
        "Priority customer support",
        "No credit card required",
        "Cancel anytime",
      ],
      button: "Start Free Trial",
      popular: true,
      buttonStyle: "bg-blue-600 hover:bg-blue-700",
      activeButton: false,
    },
    {
      id: 1,
      title: "Pro Plan",
      price: "₱699",
      oldPrice: "1500/month",
      subtext: "/month",
      description: "50% OFF for 1 year!",
      icon: <FaRocket className="w-8 h-8 text-white" />,
      gradient: "from-slate-900 via-slate-800 to-slate-900",
      features: [
        "5 Concurrent Users",
        "Inventory Module",
        "Sales Module",
        "Accounting Module",
        "3 Business Units/Stores",
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const { data, mutate: postData } = useSecuredMutation(
    import.meta.env.VITE_CLIENT_PLAN_ENDPOINT,
    "POST"
  );
  const { executeToast } = useExecuteToast();

  const closeForm = () => {
    setSubscription(null);
    setFormData({
      fullName: "",
      email: "",
      companyName: "",
      position: "",
      contactNumber: "",
      businessType: "",
      cardNumber: "",
      expiryDate: "",
      cvv: "",
      billingAddress: "",
      bookKeeper: "",
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let newForm = {
      ...formData,
      clientPlan: subscription,
    };

    postData(
      {
        data: newForm,
      },
      {
        onSuccess: (userRes) => {
          executeToast(userRes.message, 4000, "success");
          closeForm();
        },
        onError: (err) => {
          executeToast(err.message, 4000, "error");
        },
      }
    );
  };

  const selectedPlan = plans.find((plan) => plan.id === subscription);
  const navigate = useNavigate();
  const Logo = import.meta.env.VITE_LOGO;
  const { isAuthenticated } = useZustandLoginCred();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <>
        {/* Backdrop */}
        <div className="absolute w-full top-0 z-20">
          <nav className="flex items-center px-6 py-3 max-w-7xl mx-auto">
            <div
              onClick={() => navigate("/")}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center  gap-2">
                <img src={Logo} width={50} />
                <h1 className="poppins-black text-md font-semibold drop-shadow-xl text-center">
                  LIGHTEM
                </h1>
              </div>
              <a
                onClick={
                  isAuthenticated
                    ? () => navigate("/login")
                    : () => navigate("/dashboardmain")
                }
                className="cursor-pointer  border-2 text-white px-5 rounded-full border-white  hover:text-blue-300 hover:text-lg duration-300"
              >
                {isAuthenticated ? "Login" : "Main"}
              </a>
            </div>
          </nav>
        </div>
        <div
          className={`${
            subscription === null
              ? ""
              : "fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          } transition-opacity duration-300`}
          onClick={closeForm}
        />

        {/* Sliding Form */}
        <div
          className={`fixed top-0 left-0 h-full w-full max-w-md bg-slate-900 z-50 transform transition-transform duration-300 ease-in-out ${
            subscription !== null ? "translate-x-0" : "-translate-x-full"
          } shadow-2xl border-r border-slate-700`}
        >
          <div className="p-6 h-full overflow-y-auto">
            {/* Form Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {selectedPlan?.icon}
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {selectedPlan?.title}
                  </h2>
                  <p className="text-sm text-slate-400">
                    Complete your subscription
                  </p>
                </div>
              </div>
              <button
                onClick={closeForm}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <FaTimes className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Plan Summary */}
            <div className="bg-slate-800/50 rounded-lg p-4 mb-6 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300">Plan:</span>
                <span className="font-semibold text-white">
                  {selectedPlan?.title}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Price:</span>
                <span className="font-bold text-2xl text-blue-400">
                  {selectedPlan?.price}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <FaUser className="inline w-4 h-4 mr-2" />
                  Full Name
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <FaEnvelope className="inline w-4 h-4 mr-2" />
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <FaBuilding className="inline w-4 h-4 mr-2" />
                  Company Name
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your company name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <FaUser className="inline w-4 h-4 mr-2" />
                  Position
                </label>
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your position"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <FaPhoneAlt className="inline w-4 h-4 mr-2" />
                  Contact Number
                </label>
                <input
                  type="tel"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your contact number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <FaBuilding className="inline w-4 h-4 mr-2" />
                  Business Type
                </label>
                <input
                  type="text"
                  name="businessType"
                  value={formData.businessType}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Retail, Manufacturing, Services"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  <FaBuilding className="inline w-4 h-4 mr-2 text-blue-400" />
                  Do you or your team have a bookkeeper?
                </label>

                <div className="flex gap-3">
                  {["Yes", "No"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        handleInputChange({
                          target: { name: "bookKeeper", value: option },
                        })
                      }
                      className={`w-full px-4 py-3 rounded-lg font-medium transition-all duration-300 border
          ${
            formData.bookKeeper === option
              ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20 scale-[1.02]"
              : "bg-slate-800 text-slate-300 border-slate-600 hover:border-blue-500 hover:text-blue-400"
          }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {selectedPlan?.id !== 0 && (
                <>
                  <div className="pt-4 border-t border-slate-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                      <FaCreditCard className="w-5 h-5 mr-2 text-blue-400" />
                      Payment Information
                    </h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Card Number
                    </label>
                    <input
                      type="text"
                      name="cardNumber"
                      value={formData.cardNumber}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="1234 5678 9012 3456"
                      maxLength="19"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        <FaCalendarAlt className="inline w-4 h-4 mr-2" />
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        name="expiryDate"
                        value={formData.expiryDate}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="MM/YY"
                        maxLength="5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        <FaShieldAlt className="inline w-4 h-4 mr-2" />
                        CVV
                      </label>
                      <input
                        type="text"
                        name="cvv"
                        value={formData.cvv}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="123"
                        maxLength="4"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Billing Address
                    </label>
                    <textarea
                      name="billingAddress"
                      value={formData.billingAddress}
                      onChange={handleInputChange}
                      required
                      rows="3"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="Enter your billing address"
                    />
                  </div>
                </>
              )}

              <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 mt-6">
                <div className="flex items-start gap-3">
                  <FaShieldAlt className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-blue-300 mb-1">
                      Secure Payment
                    </h4>
                    <p className="text-sm text-blue-200">
                      Your payment information is encrypted and secure. We use
                      industry-standard security measures.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 mt-6 ${selectedPlan?.buttonStyle} hover:scale-105`}
              >
                {selectedPlan?.id === 0
                  ? "Start Free Trial"
                  : `Subscribe to ${selectedPlan?.title}`}
              </button>

              <button
                type="button"
                onClick={closeForm}
                className="w-full py-3 px-6 rounded-xl font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-300 border border-slate-600"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      </>

      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.09]"
          style={{ backgroundImage: `url(${HeroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-indigo-600/10 to-purple-600/20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(99,102,241,0.15),transparent_50%)]"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 backdrop-blur-sm border border-blue-500/30 text-blue-300 px-6 py-3 rounded-full text-sm font-medium mb-8 shadow-lg">
              <FaGift className="w-4 h-4" />
              Limited-Time Intro Price
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-full blur-xl"></div>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-8 text-balance">
              Unlock Premium Features with Our{" "}
              <span className="text-blue-400 bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400  [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] [background-clip:text]">
                Introductory Offer!
              </span>
            </h1>

            <p className="text-2xl md:text-3xl text-slate-300 mb-12 text-balance font-light">
              1 Month Free + 50% Off for 1 Year!
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 mb-16">
              <div className="flex items-center gap-2 text-blue-300 font-semibold">
                <FaStar className="w-5 h-5 text-yellow-400" />
                <span>Exclusive offer for first time user</span>
              </div>
            </div>

            <div className="flex gap-6 max-w-4xl mx-auto justify-center">
              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <FaLock className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-white">Secure Platform</h3>
                  <p className="text-sm text-slate-400">
                    Enterprise-grade security
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                  <FaRocket className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-white">Fast Performance</h3>
                  <p className="text-sm text-slate-400">
                    Lightning-fast speeds
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid md:grid-cols-3 gap-8 w-full">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`group relative bg-gradient-to-br ${plan.gradient} rounded-3xl p-8 shadow-xl transition-all duration-300 border border-slate-700/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.6)]`}
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl blur opacity-5 group-hover:opacity-10 transition duration-300 pointer-events-none"></div>

              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-xs font-semibold px-4 py-1 rounded-full shadow-md">
                  Most Popular
                </div>
              )}

              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                {plan.icon}
              </div>
              <h3 className="text-2xl font-bold text-center mb-4">
                {plan.title}
              </h3>

              <div className="text-center mb-2">
                {plan.oldPrice && (
                  <div className="text-slate-400 line-through text-sm mb-1">
                    {plan.oldPrice}
                  </div>
                )}
                <span className="text-5xl font-extrabold">{plan.price}</span>
                <span className="ml-2 text-lg text-slate-300">
                  {plan.subtext}
                </span>
              </div>

              <p className="text-center text-blue-200 font-medium mb-6">
                {plan.description}
              </p>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <FaCheck className="w-3 h-3 text-white" />
                    </div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <motion.button
                onClick={() => setSubscription(plan.id)}
                disabled={plan.activeButton}
                whileHover={!plan.activeButton ? { scale: 1.05 } : {}}
                whileTap={!plan.activeButton ? { scale: 0.95 } : {}}
                className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 relative overflow-hidden group ${
                  plan.activeButton
                    ? "bg-gradient-to-r from-gray-700 to-gray-800 text-gray-400 cursor-not-allowed shadow-sm border-2 border-dashed border-gray-600"
                    : `${plan.buttonStyle} hover:shadow-xl active:shadow-md`
                }`}
              >
                {plan.activeButton && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                )}

                <span
                  className={`relative z-10 flex items-center justify-center gap-2 ${
                    plan.activeButton ? "text-gray-400" : "text-white"
                  }`}
                >
                  {plan.activeButton ? (
                    <>
                      <div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center">
                        <svg
                          className="w-3 h-3"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <span className="line-through opacity-75">
                        {plan.button}
                      </span>
                    </>
                  ) : (
                    plan.button
                  )}
                </span>
              </motion.button>
            </div>
          ))}
        </div>

        <div className="mt-20 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 rounded-3xl blur-xl"></div>
          <div className="relative bg-gradient-to-r from-slate-900/80 to-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-3xl p-12 text-center shadow-2xl">
            <h3 className="text-4xl font-bold text-white mb-6">
              Limited-Time Introductory Offer
            </h3>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Be part of our exclusive community! Get 1 month completely free,
              then enjoy 50% off your entire first year. This special offer is
              available only to first-time users.
            </p>
            <div className="grid md:grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                  <FaCheck className="w-6 h-6 text-white" />
                </div>
                <span className="text-slate-300 font-medium">
                  No setup fees
                </span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                  <FaCheck className="w-6 h-6 text-white" />
                </div>
                <span className="text-slate-300 font-medium">
                  Cancel anytime
                </span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                  <FaCheck className="w-6 h-6 text-white" />
                </div>
                <span className="text-slate-300 font-medium">
                  Money-back guarantee
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-slate-900/50 backdrop-blur-sm border-t border-slate-700/50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-white mb-4">
                Ready to get started?
              </h3>
              <p className="text-slate-300 mb-6">
                Questions? Contact our support team at{" "}
                <a
                  href="mailto:support@example.com"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  lightemsolutionsinc@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-white/10 text-center text-sm text-white relative z-10">
          &copy; {new Date().getFullYear()} Lightem Systems. All rights
          reserved.
        </div>
      </footer>
    </div>
  );
}
