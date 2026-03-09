import React, { createContext, useContext, useState, useCallback } from "react";
import Toast from "../components/Toasts/Toast";

const ToastContext = createContext();

export const useExecuteToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useExecuteToast must be used within a ToastProvider.");
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const executeToast = useCallback(
    (message, duration = 3000, type = "info") => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, message, duration, type }]);
    },
    []
  );

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ executeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-[100]">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            duration={toast.duration}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
