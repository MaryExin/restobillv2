import React from "react";

const ButtonComponent = ({
  children,
  onClick,
  disabled = false,
  isLoading = false,
  icon = null,
  loadingText = "Processing...",
  className = "",
  type = "button",
  variant = "primary",
  fullWidth = true,
}) => {
  const isDisabled = disabled || isLoading;

  const baseClass = `py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg transition ${
    fullWidth ? "w-full" : ""
  }`;

  const variantClassMap = {
    primary: isDisabled
      ? "bg-blue-400 text-white cursor-not-allowed opacity-80"
      : "bg-blue-600 text-white hover:bg-blue-500",
    success: isDisabled
      ? "bg-emerald-400 text-gray-100 cursor-not-allowed opacity-80"
      : "bg-emerald-600 text-gray-100 hover:bg-emerald-500",
    danger: isDisabled
      ? "bg-red-400 text-white cursor-not-allowed opacity-80"
      : "bg-red-600 text-white hover:bg-red-500",
    warning: isDisabled
      ? "bg-yellow-300 text-yellow-900 cursor-not-allowed opacity-80"
      : "bg-yellow-500 text-yellow-950 hover:bg-yellow-400",
    secondary: isDisabled
      ? "bg-slate-300 text-gray-100 cursor-not-allowed opacity-80"
      : "bg-slate-600 text-gray-100 hover:bg-slate-500",
    dark: isDisabled
      ? "bg-slate-700 text-slate-300 cursor-not-allowed opacity-80"
      : "bg-slate-900 text-white hover:bg-slate-800",
  };

  const variantClass = variantClassMap[variant] || variantClassMap.primary;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`${baseClass} ${variantClass} ${className} mb-3`}
    >
      {isLoading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          {icon}
          <span>{children}</span>
        </>
      )}
    </button>
  );
};

export default ButtonComponent;
