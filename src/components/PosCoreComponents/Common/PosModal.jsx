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
            readOnly = false,
            onDoubleClick,
          } = field;

          const value = field.value ?? values[name] ?? "";

          const baseInputStyles = `w-full rounded-[20px] border px-5 text-[16px] outline-none shadow-sm transition-all ${
            disabled
              ? "border-gray-200 bg-gray-100 text-gray-400"
              : "border-[#f0b06b] bg-white text-gray-700 focus:ring-2 focus:ring-[#f0b06b]/20"
          } ${icon ? "pl-12" : ""}`;

          return (
            <div key={name || index} className="flex flex-col">
              {label && (
                <label className="mb-2 ml-1 block text-[16px] font-semibold text-[#2e4a7d]">
                  {label}
                </label>
              )}

              <div className="relative">
                {icon && (
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-[#4d8df7]">
                    {icon}
                  </div>
                )}

                {type === "select" ? (
                  <select
                    value={value}
                    disabled={disabled}
                    onChange={(e) => handleFieldChange(name, e.target.value)}
                    className={`${baseInputStyles} h-[58px] appearance-none`}
                  >
                    <option value="">{placeholder || "Select option"}</option>
                    {options.map((opt, i) => {
                      const val = typeof opt === "object" ? opt.value : opt;
                      const lbl = typeof opt === "object" ? opt.label : opt;
                      return (
                        <option key={i} value={val}>
                          {lbl}
                        </option>
                      );
                    })}
                  </select>
                ) : type === "textarea" ? (
                  <textarea
                    value={value}
                    placeholder={placeholder}
                    disabled={disabled}
                    readOnly={readOnly}
                    onChange={(e) => handleFieldChange(name, e.target.value)}
                    onDoubleClick={onDoubleClick}
                    className={`${baseInputStyles} min-h-[180px] py-4 resize-none placeholder:text-gray-300`}
                  />
                ) : (
                  <input
                    type={type}
                    value={value}
                    placeholder={placeholder}
                    disabled={disabled}
                    readOnly={readOnly}
                    onChange={(e) => handleFieldChange(name, e.target.value)}
                    onDoubleClick={onDoubleClick}
                    className={`${baseInputStyles} h-[58px] placeholder:text-gray-300`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/30 backdrop-blur-[2px] p-4"
      onClick={handleBackdropClick}
    >
      <div
        className={`relative flex w-full flex-col overflow-hidden rounded-[24px] border border-white/50 bg-[#e9edf4] shadow-[0_20px_60px_rgba(0,0,0,0.2)] ${width} ${height} ${contentClassName}`}
      >
        {(title || subtitle || showCloseButton) && (
          <div className="relative flex-shrink-0 px-8 pt-8 pb-4">
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="absolute grid w-10 h-10 transition rounded-full shadow-sm right-6 top-6 place-items-center bg-white/80 text-slate-600 hover:bg-white hover:text-red-500"
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
          <div className="flex-shrink-0 px-8 pt-2 pb-8">
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

                const getVariantClasses = () => {
                  if (disabled || loading) {
                    return "bg-gray-300 text-white cursor-not-allowed";
                  }

                  switch (variant) {
                    case "secondary":
                      return "bg-blue-600 text-white shadow-md hover:scale-[1.02]";
                    case "danger":
                      return "bg-red-600 text-gray-100 shadow-md hover:scale-[1.02]";
                    default:
                      return "bg-blue-600  text-white shadow-md hover:scale-[1.02]";
                  }
                };

                return (
                  <button
                    key={index}
                    type={type}
                    disabled={disabled || loading}
                    onClick={onClick || onClose}
                    className={`min-w-[160px] h-[52px] rounded-full px-6 text-[18px] font-semibold transition active:scale-[0.98] ${getVariantClasses()} ${className}`}
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
