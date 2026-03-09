import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FiX } from "react-icons/fi";
import { useCustomSecuredMutation } from "../../hooks/useCustomSecuredMutation";
import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import ModalSuccessNavToSelf from "../Modals/ModalSuccessNavToSelf";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalClass = ({
  setIsClass,
  setIsmodule,
  classDataRefetch,
  mutation,
  title,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const [type, setType] = useState("");
  const [isSuccessModal, setSuccessModal] = useState(false);
  const [isYesNoModalOpen, setYesNoModalOpen] = useState(false);

  const { data: classtypeMutateData, mutate: classtypeMutate } =
    useCustomSecuredMutation(mutation);

  const handleFormSubmit = () => {
    if (!type.trim()) {
      alert(`Input ${title} Type!`);
    } else {
      classtypeMutate({ className: type, module: setIsmodule });
    }
  };

  useEffect(() => {
    if (classtypeMutateData?.message === "Success") {
      setSuccessModal(true);
      setType("");
      classDataRefetch();
    }
  }, [classtypeMutateData, classDataRefetch]);

  return (
    <>
      {/* Success Feedback */}
      {isSuccessModal && (
        <ModalSuccessNavToSelf
          header="Success"
          message={`${title} Type has been added`}
          button="Accept"
          setIsModalOpen={setSuccessModal}
        />
      )}

      {/* Confirm Dialog */}
      {isYesNoModalOpen && (
        <ModalYesNoReusable
          header="Confirm"
          message="Proceed with submission?"
          setYesNoModalOpen={setYesNoModalOpen}
          triggerYesNoEvent={handleFormSubmit}
        />
      )}

      {/* Backdrop and Modal */}
      <div className="fixed inset-0 z-40 bg-zinc-900 bg-opacity-50 flex items-center justify-center">
        <motion.div
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          {/* Header */}
          <div className="relative bg-gradient-to-br from-colorBrand to-colorBrandTertiary p-4 flex items-center justify-center">
            <h2 className="text-xl font-semibold text-white">Add {title}</h2>
            <button
              onClick={() => setIsClass(false)}
              className="absolute top-3 right-3 text-white p-1 bg-colorBrandLighter rounded-full hover:bg-colorBrandLighter transition"
              aria-label="Close modal"
            >
              <FiX size={20} />
            </button>
            {/* Accent circle */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white opacity-10 rounded-full"></div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <label className="block text-sm font-medium text-zinc-700">
              {title} Type
            </label>
            <input
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder={`Enter ${title} Type`}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-colorBrand focus:border-colorBrand"
            />

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setYesNoModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-br from-colorBrand to-colorBrandTertiary text-white rounded-lg shadow hover:scale-95 transition"
              >
                Add
              </button>
              <button
                onClick={() => setIsClass(false)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg shadow hover:scale-95 transition"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default ModalClass;
