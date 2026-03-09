import { motion } from "framer-motion";

export default function ModalRedirect({ countdown, header, body }) {
  return (
    <>
      <motion.div
        className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center relative"
          initial={{ scale: 0.8, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 120 }}
        >
          <h2 className="text-xl font-bold text-gray-800 mb-2">{header}</h2>
          <p className="text-gray-500 mb-6">{body}</p>
          <div className="flex justify-center items-center mb-4">
            <motion.div
              key={countdown}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.3 }}
              className="text-5xl font-bold text-colorBrand"
            >
              {countdown}
            </motion.div>
          </div>
          <p className="text-sm text-gray-400">Redirecting shortly...</p>
        </motion.div>
      </motion.div>
    </>
  );
}
