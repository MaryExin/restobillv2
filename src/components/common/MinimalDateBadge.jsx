import { useState, useEffect } from "react";
import { FaLocationDot } from "react-icons/fa6";
import { FiCalendar } from "react-icons/fi";

export default function MinimalDateBadge({
  variant = "default",
  size = "md",
  locale = "en-US",
  showIcon = true,
  className = "",
  formatOptions = { month: "short", day: "numeric", year: "numeric" },
  businessUnit,
  filterDate,
}) {
  const [currentDate, setCurrentDate] = useState(
    filterDate ? new Date(filterDate) : new Date()
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const timeUntilMidnight = tomorrow.getTime() - now.getTime();

    const timeout = setTimeout(() => {
      setCurrentDate(new Date());
      const interval = setInterval(() => {
        setCurrentDate(new Date());
      }, 24 * 60 * 60 * 1000);
      return () => clearInterval(interval);
    }, timeUntilMidnight);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (filterDate) {
      setCurrentDate(new Date(filterDate));
    }
  }, [filterDate]);

  if (!mounted) {
    return (
      <div className="animate-pulse bg-gray-200 rounded-full h-8 w-32"></div>
    );
  }

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const variantClasses = {
    default:
      "bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100",
    outlined: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50",
    gradient:
      "bg-gradient-to-r from-blue-500 to-purple-600 border border-transparent text-white shadow-sm hover:from-blue-600 hover:to-purple-700",
    compact:
      "bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200",
  };

  const separatorColors = {
    default: "bg-blue-300/60",
    outlined: "bg-gray-300/60",
    gradient: "bg-white/40",
    compact: "bg-gray-400/60",
  };

  const formattedDate = currentDate.toLocaleDateString(locale, formatOptions);

  return (
    <div
      className={`
        inline-flex items-center border rounded-full font-medium transition-all duration-200 ease-in-out shadow-sm
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
      role="img"
    >
      {businessUnit && (
        <>
          {showIcon && (
            <FaLocationDot
              className={`${iconSizes[size]} flex-shrink-0`}
              aria-hidden="true"
            />
          )}
          <span className="truncate">{businessUnit}</span>

          <span
            className={`mx-3 h-10 w-px rounded-full ${separatorColors[variant]}`}
          />
        </>
      )}

      {showIcon && (
        <FiCalendar
          className={`${iconSizes[size]} flex-shrink-0`}
          aria-hidden="true"
        />
      )}
      <span className="truncate">{formattedDate}</span>
    </div>
  );
}
