import React, { useEffect, useState } from "react";
import { FiX, FiTag, FiCheck } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import { useCustomSecuredMutation } from "../../hooks/useCustomSecuredMutation";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalPricingCategory = ({ createPricing, isOpen, onClose }) => {
  const [priceName, setPriceName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [ownership, setOwnership] = useState("CompanyOwned");
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!priceName.trim()) {
      setErrorMessage("PRICE");
    } else {
      setConfirmOpen(true);
    }
  };

  const confirmCreate = () => {
    createPricing({
      pricingname: priceName.toUpperCase(),
      ownershiptype: ownership,
    });
    setPriceName("");
    setErrorMessage("");
    setConfirmOpen(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {isConfirmOpen && (
            <ModalYesNoReusable
              header="Confirm Add"
              message="Are you sure you want to add this category?"
              setYesNoModalOpen={setConfirmOpen}
              triggerYesNoEvent={confirmCreate}
            />
          )}

          <motion.div
            className="relative w-full max-w-sm p-6 bg-white rounded-2xl shadow-2xl"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-colorBrand">
                <FiTag className="w-6 h-6" />
                <h2 className="text-lg font-bold">New Pricing Type</h2>
              </div>
              <motion.button
                onClick={onClose}
                whileHover={{ rotate: 90 }}
                className="text-gray-500 hover:text-gray-800"
              >
                <FiX className="w-6 h-6" />
              </motion.button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <motion.div
                className="relative"
                whileFocusWithin={{ scale: 1.02 }}
              >
                <input
                  type="text"
                  value={priceName}
                  onChange={(e) => setPriceName(e.target.value)}
                  placeholder="Pricing Type Description"
                  className="w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:border-colorBrand"
                />
                <FiTag className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                {errorMessage === "PRICE" && (
                  <p className="mt-1 text-sm text-red-600">
                    Enter Pricing Type
                  </p>
                )}
              </motion.div>

              {/* Ownership Radio Group */}
              <div className="mb-8">
                <p className="text-gray-600 mb-2 font-medium">
                  Ownership Type Applicable
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Company Owned", value: "CompanyOwned" },
                    { label: "Franchisee", value: "Franchisee" },
                  ].map(({ label, value }) => {
                    const isSelected = ownership === value;
                    return (
                      <label
                        key={value}
                        htmlFor={value}
                        className={`
                  flex items-center justify-center cursor-pointer
                  px-1 py-2  text-xs lg:text-base rounded-lg border-2 transition
                  ${
                    isSelected
                      ? "bg-gradient-to-br from-colorBrand to-colorBrandSecondary text-white border-transparent shadow-lg"
                      : "bg-white text-gray-700 border-gray-200 hover:border-zinc-300"
                  }
                `}
                      >
                        <input
                          type="radio"
                          id={value}
                          name="ownership"
                          value={value}
                          className="sr-only"
                          checked={isSelected}
                          onChange={() => setOwnership(value)}
                        />
                        <span className="select-none">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <motion.button
                type="submit"
                className="flex w-full justify-center items-center gap-2 px-4 py-2 bg-gradient-to-br from-darkerPrimary via-darkPrimary to-medPrimary text-white rounded-lg shadow-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FiCheck className="w-5 h-5" />
                Add Type
              </motion.button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ModalPricingCategory;
