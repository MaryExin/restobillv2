import { useState, useEffect, useRef, useCallback } from "react";
import {
  IoClose,
  IoCheckmarkCircle,
  IoWarning,
  IoInformationCircle,
  IoAlertCircle,
} from "react-icons/io5";

const Toast = ({ message, type = "info", duration = 4000, onClose }) => {
  const [showToast, setShowToast] = useState(true);
  const closedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const handleClose = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    setShowToast(false);
    onCloseRef.current?.();
  }, []);

  useEffect(() => {
    if (!showToast) return;
    const timer = setTimeout(handleClose, duration);

    return () => clearTimeout(timer);
  }, [duration, showToast, handleClose]);

  const getToastStyles = () => {
    const baseStyles = "backdrop-blur-md border shadow-lg";

    switch (type) {
      case "success":
        return `${baseStyles} bg-emerald-50/90 border-emerald-200 text-emerald-800`;
      case "error":
        return `${baseStyles} bg-red-50/90 border-red-200 text-red-800`;
      case "warning":
        return `${baseStyles} bg-amber-50/90 border-amber-200 text-amber-800`;
      default:
        return `${baseStyles} bg-blue-50/90 border-blue-200 text-blue-800`;
    }
  };

  const getIcon = () => {
    const iconProps = { size: 20, className: "flex-shrink-0" };

    switch (type) {
      case "success":
        return (
          <IoCheckmarkCircle {...iconProps} className="text-emerald-600" />
        );
      case "error":
        return <IoAlertCircle {...iconProps} className="text-red-600" />;
      case "warning":
        return <IoWarning {...iconProps} className="text-amber-600" />;
      default:
        return <IoInformationCircle {...iconProps} className="text-blue-600" />;
    }
  };

  return (
    <>
      {showToast && (
        <div
          className={"ui-slide-in-right " + (`
            fixed bottom-4 right-4 z-50 max-w-sm w-full
            ${getToastStyles()}
            rounded-xl p-4
            shadow-xl shadow-black/5
            hover:shadow-2xl hover:shadow-black/10
            transition-shadow duration-200
          `)}
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {getIcon()}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-relaxed">{message}</p>
            </div>

            <button
              onClick={handleClose}
              className="
                flex-shrink-0 p-1 rounded-lg
                hover:bg-black/5 active:bg-black/10
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
              "
              aria-label="Close notification"
            >
              <IoClose size={16} className="text-gray-500" />
            </button>
          </div>

          <div
            className="ui-toast-progress absolute bottom-0 left-0 h-1 w-full bg-current opacity-20 rounded-b-xl"
            style={{ "--ui-toast-duration": `${duration}ms` }}
          />
        </div>
      )}
    </>
  );
};

export default Toast;
