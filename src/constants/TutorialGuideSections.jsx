import {
  FiLogIn,
  FiShoppingCart,
  FiCreditCard,
  FiPackage,
  FiClipboard,
  FiBarChart2,
  FiRefreshCw,
  FiSettings,
} from "react-icons/fi";

export const GUIDE_SECTIONS = [
  {
    icon: FiLogIn,
    title: "Getting Started",
    steps: [
      "Log in using your assigned username and password.",
      "From the Home screen, tap \"Open New Day\" before taking any orders — this starts your shift.",
      "Your terminal number and shift status are shown at the top of the screen.",
    ],
  },
  {
    icon: FiShoppingCart,
    title: "Taking a New Order",
    steps: [
      "Go to \"New Transaction\" to start taking a customer's order.",
      "Select items from the product list and adjust the quantity for each.",
      "Apply discounts if applicable, then proceed to \"Billing\" to review the order.",
    ],
  },
  {
    icon: FiCreditCard,
    title: "Billing & Payment",
    steps: [
      "\"Billing\" shows the full order summary and total before payment.",
      "Go to \"Payment\" to choose the mode of payment and complete the transaction.",
      "A receipt can be printed once the payment is confirmed.",
    ],
  },
  {
    icon: FiPackage,
    title: "Managing Products",
    steps: [
      "Use \"Product List\" to view, add, or edit products and their prices.",
      "\"Product & Price Syncing\" updates your terminal with the latest product and price changes.",
    ],
  },
  {
    icon: FiClipboard,
    title: "Transaction Records",
    steps: [
      "\"Registry Sales\" lists every transaction made during the current shift.",
      "Use it to review, void, or reprint past transactions.",
    ],
  },
  {
    icon: FiBarChart2,
    title: "POS Reports",
    steps: [
      "Open \"POS Reports\" to view Daily Sales, Hourly Sales, the Sales Dashboard, and other report modules.",
      "Reports summarize sales activity for the current day or a selected date range.",
    ],
  },
  {
    icon: FiRefreshCw,
    title: "X Reading & Z Reading",
    steps: [
      "\"X Reading\" gives a mid-shift sales summary without closing the shift.",
      "\"Z Reading\" closes and finalizes the shift, locking in the day's sales.",
    ],
  },
  {
    icon: FiSettings,
    title: "Settings Center",
    steps: [
      "Open Settings to manage your account, printers, discounts, and other configurations.",
    ],
  },
];
