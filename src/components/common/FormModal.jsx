import { motion, AnimatePresence } from "framer-motion";
import { IoMdClose } from "react-icons/io";

const FormModal = ({ isOpen, onClose, title, children, size = "lg" }) => {
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with blur effect */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className={`${sizeClasses[size]} w-full bg-white rounded-2xl shadow-2xl border border-border/50 overflow-hidden`}
            >
              {/* Header with gradient accent */}
              {title && (
                <div className="flex items-center justify-between p-6 border-b border-border/50 bg-gradient-to-r from-colorBrand to-colorBrandTertiary">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight text-white">
                      {title}
                    </h2>
                  </div>
                  <motion.button
                    onClick={onClose}
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Close modal"
                  >
                    <IoMdClose className="w-5 h-5" />
                  </motion.button>
                </div>
              )}

              {/* Content with smooth scrolling */}
              <div className="p-8 max-h-[calc(100vh-280px)] overflow-y-auto">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FormModal;
