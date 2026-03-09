// HiTechFloatingMenu.jsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HiMenu,
  HiX,
  HiDocumentText,
  HiCreditCard,
  HiCash,
  HiChartBar,
  HiLockClosed,
} from "react-icons/hi";

export default function HiTechFloatingMenu({
  onSalesSummary,
  onCreditClearing,
  onPettyCash,
  onReports,
  onCashClosing,
  radius = 100, // how far out the desktop buttons go
}) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1024 : false
  );

  // keep track of screen size
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const menuItems = [
    {
      icon: <HiDocumentText />,
      action: onSalesSummary,
      label: "Sales Summary",
    },
    {
      icon: <HiCreditCard />,
      action: onCreditClearing,
      label: "Credit Clearing",
    },
    { icon: <HiCash />, action: onPettyCash, label: "Petty Cash" },
    { icon: <HiChartBar />, action: onReports, label: "Reports" },
    { icon: <HiLockClosed />, action: onCashClosing, label: "Cash Closing" },
  ];

  // desktop arc from –145° to –35°
  const startAngle = -145 * (Math.PI / 180);
  const endAngle = -35 * (Math.PI / 180);

  return (
    <div>
      <AnimatePresence>
        {open &&
          menuItems.map((item, i) => {
            let x = 0,
              y = 0;

            if (isMobile) {
              // on mobile stack them up vertically 60px apart
              const gap = radius * 0.6;
              x = 0;
              y = -(i + 1) * gap;
            } else {
              // on desktop spread in an arc
              const angle =
                startAngle +
                (i / (menuItems.length - 1)) * (endAngle - startAngle);
              x = Math.cos(angle) * radius;
              y = Math.sin(angle) * radius;
            }

            return (
              <motion.button
                key={item.label}
                initial={{ x: 0, y: 0, opacity: 0 }}
                animate={{ x, y, opacity: 1 }}
                exit={{ x: 0, y: 0, opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 450,
                  damping: 25,
                  delay: i * 0.05,
                }}
                onClick={() => {
                  item.action();
                  setOpen(false);
                }}
                aria-label={item.label}
                className="
                  fixed right-[81vw] lg:right-24 bottom-6 z-40
                  bg-white hover:bg-colorBrand hover:text-white
                  p-3 rounded-full
                  ring-1 ring-colorBrand
                    drop-shadow-[0_0_10px_rgba(0,0,0,0.6)]
                  text-darkPrimary
                  focus:outline-none 
                "
                style={{ transform: "translate(-50%, -50%)" }}
              >
                <span className="text-xl">{item.icon}</span>
              </motion.button>
            );
          })}
      </AnimatePresence>

      {/* main toggle */}
      <motion.button
        className="
          fixed right-[80vw] lg:right-24 bottom-6 z-50
          bg-gradient-to-br from-colorBrand via-colorBrandSecondary to-colorBrandTertiary
          p-4 rounded-full
          drop-shadow-[0_0_10px_rgba(0,0,0,0.6)]
          text-white
          focus:outline-none
        "
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.9 }}
        aria-label="Toggle menu"
      >
        {open ? <HiX className="w-6 h-6" /> : <HiMenu className="w-6 h-6" />}
      </motion.button>
    </div>
  );
}
