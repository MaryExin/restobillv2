"use client";
import { FiX, FiCheck } from "react-icons/fi";

export default function ReusableAddModal({
  open,
  onClose,
  value,
  setValue,
  onSave,
  title = "Add Item",
  buttonText = "Save",
  placeholder = "Enter value",
  icon: IconComponent = FiX,
  showCheckbox = false,
  checkboxLabel = "",
  checkboxValue = false,
  setCheckboxValue = null,
  dataTour = "",
  dataTourField = "",
  dataTourBtn = "",
}) {
  const storedFirstTime = localStorage.getItem("isFirstTimeLogin");
  return (
    <>
      {open && (
        <div
          className="ui-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
        >
          <div
            className="ui-enter relative w-full max-w-sm p-6 bg-white rounded-2xl shadow-2xl"
            data-tour={dataTour}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-colorBrand">
                <IconComponent className="w-6 h-6" />
                <h2 className="text-lg font-bold">{title}</h2>
              </div>
              {storedFirstTime !== "True" && (
                <button
                  onClick={onClose}
                  className="hover:opacity-90 transition-opacity duration-150 text-gray-500 hover:text-gray-800"
                >
                  <FiX className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Input + Checkbox + Save */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSave();
              }}
              className="space-y-4"
            >
              <div
                className="relative"
                whileFocusWithin={{ scale: 1.02 }}
              >
                <div data-tour={dataTourField}>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:border-colorBrand"
                  />
                </div>
                <IconComponent className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>

              {showCheckbox && setCheckboxValue && (
                <div
                  className="hover:opacity-90 transition-opacity duration-150 relative flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 hover:border-blue-300 transition-all cursor-pointer group"
                  onClick={() => setCheckboxValue(!checkboxValue)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {/* Custom checkbox */}
                    <div
                      className={"active:opacity-80 transition-opacity duration-150 " + (`relative w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        checkboxValue
                          ? "bg-gradient-to-br from-blue-500 to-indigo-600 border-blue-600 shadow-md"
                          : "bg-white border-blue-300 group-hover:border-blue-400"
                      }`)}
                    >
                      {checkboxValue && (
                        <div className="ui-scale-in"
                        >
                          <FiCheck className="w-3 h-3 text-white font-bold" />
                        </div>
                      )}
                    </div>

                    {/* Label */}
                    <label
                      htmlFor="modal-checkbox"
                      className="text-sm font-semibold text-gray-700 cursor-pointer select-none group-hover:text-gray-900 transition-colors"
                    >
                      {checkboxLabel}
                    </label>
                  </div>

                  {/* Status indicator */}
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full transition-all ${
                      checkboxValue
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {checkboxValue ? "Yes" : "No"}
                  </span>

                  {/* Hidden input for form compatibility */}
                  <input
                    type="checkbox"
                    id="modal-checkbox"
                    checked={checkboxValue}
                    onChange={(e) => setCheckboxValue(e.target.checked)}
                    className="sr-only"
                    aria-label={checkboxLabel}
                  />
                </div>
              )}

              <button
                type="submit"
                className="hover:opacity-90 active:opacity-80 transition-opacity duration-150 flex w-full justify-center items-center gap-2 px-4 py-2 bg-gradient-to-br from-darkerPrimary via-darkPrimary to-medPrimary text-white rounded-lg shadow-lg"
                data-tour={dataTourBtn}
              >
                <FiCheck className="w-5 h-5" />
                {buttonText}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
