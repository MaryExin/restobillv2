import React from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";

const PosModal = ({
  open,
  title = "",
  subtitle = "",
  fields = [],
  buttons = [],
  values = {},
  onChange,
  onClose,
  children,
  width = "max-w-[900px]",
  height = "min-h-[520px]",
  bodyClassName = "",
  contentClassName = "",
  showCloseButton = false,
  closeOnBackdrop = true,
}) => {
  if (!open) return null;

  const handleFieldChange = (name, value) => {
    if (onChange) onChange(name, value);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && closeOnBackdrop) {
      onClose?.();
    }
  };

  const renderFields = () => {
    return (
      <div className="space-y-6">
        {fields.map((field, index) => {
          const {
            name,
            label,
            type = "text",
            placeholder = "",
            options = [],
            icon = null,
            disabled = false,
          } = field;

          const value = values[name] ?? "";

          return (
            <div key={name || index}>
              {label && (
                <label className="mb-2 block text-[16px] font-semibold text-[#2e4a7d]">
                  {label}
                </label>
              )}

              {type === "select" ? (
                <div className="relative">
                  {icon && (
                    <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-[#4d8df7]">
                      {icon}
                    </div>
                  )}

                  <select
                    value={value}
                    disabled={disabled}
                    onChange={(e) => handleFieldChange(name, e.target.value)}
                    className={`h-[58px] w-full appearance-none rounded-full border px-5 text-[16px] outline-none shadow-sm ${
                      disabled
                        ? "border-gray-200 bg-gray-100 text-gray-400"
                        : "border-[#f0b06b] bg-white text-gray-700"
                    } ${icon ? "pl-12" : ""}`}
                  >
                    <option value="">{placeholder || "Select option"}</option>
                    {options.map((opt, i) => {
                      const optionValue =
                        typeof opt === "object" ? opt.value : opt;
                      const optionLabel =
                        typeof opt === "object" ? opt.label : opt;

                      return (
                        <option key={i} value={optionValue}>
                          {optionLabel}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div className="relative">
                  {icon && (
                    <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-[#4d8df7]">
                      {icon}
                    </div>
                  )}

                  <input
                    type={type}
                    value={value}
                    placeholder={placeholder}
                    disabled={disabled}
                    onChange={(e) => handleFieldChange(name, e.target.value)}
                    className={`h-[58px] w-full rounded-full border px-5 text-[16px] outline-none shadow-sm placeholder:text-gray-300 ${
                      disabled
                        ? "border-gray-200 bg-gray-100 text-gray-400"
                        : "border-[#f0b06b] bg-white text-gray-700"
                    } ${icon ? "pl-12" : ""}`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/25 backdrop-blur-[2px] p-4"
      onClick={handleBackdropClick}
    >
      <div
        className={`relative flex w-full flex-col overflow-hidden rounded-[24px] border border-white/50 bg-[#e9edf4] shadow-[0_20px_60px_rgba(0,0,0,0.18)] ${width} ${height} ${contentClassName}`}
      >
        {(title || subtitle || showCloseButton) && (
          <div className="relative flex-shrink-0 px-8 pt-8 pb-4">
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="absolute right-6 top-6 grid h-10 w-10 place-items-center rounded-full bg-white/80 text-slate-600 shadow-sm transition hover:bg-white"
              >
                <FiX className="text-[20px]" />
              </button>
            )}

            {title && (
              <h2 className="text-center text-[24px] font-bold text-[#2e4a7d] md:text-[30px]">
                {title}
              </h2>
            )}

            {subtitle && (
              <p className="mt-2 text-center text-[14px] text-slate-500">
                {subtitle}
              </p>
            )}
          </div>
        )}

        <div
          className={`min-h-0 flex-1 overflow-y-auto px-8 pb-6 ${bodyClassName}`}
        >
          {children ? children : renderFields()}
        </div>

        {buttons.length > 0 && (
          <div className="flex-shrink-0 px-8 pb-8 pt-2">
            <div className="flex flex-wrap justify-center gap-4">
              {buttons.map((button, index) => {
                const {
                  label,
                  onClick,
                  variant = "primary",
                  disabled = false,
                  loading = false,
                  type = "button",
                  className = "",
                } = button;

                const variantClasses =
                  variant === "secondary"
                    ? "bg-gradient-to-r from-pink-300 to-cyan-300 text-white"
                    : variant === "danger"
                      ? "bg-gradient-to-r from-red-400 to-pink-400 text-white"
                      : "bg-gradient-to-r from-pink-300 to-cyan-300 text-white";

                return (
                  <button
                    key={index}
                    type={type}
                    disabled={disabled || loading}
                    onClick={onClick || onClose}
                    className={`min-w-[160px] h-[52px] rounded-full px-6 text-[18px] font-semibold shadow-md transition hover:scale-[1.02] active:scale-[0.98] ${
                      disabled || loading
                        ? "cursor-not-allowed bg-gray-300 text-white"
                        : variantClasses
                    } ${className}`}
                  >
                    {loading ? "Please wait..." : label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default PosModal;
