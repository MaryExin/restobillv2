import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  HiX,
  HiChartPie,
  HiPencilAlt,
  HiCash,
  HiOfficeBuilding,
  HiCollection,
  HiPlus,
} from "react-icons/hi";
import { LinearProgress } from "@mui/material";
import ModalYesNoReusable from "../Modals/ModalYesNoReusable";
import ModalSuccessNavToSelf from "../Modals/ModalSuccessNavToSelf";
import useCustomQuery from "../../hooks/useCustomQuery";
import { useCustomSecuredMutation } from "../../hooks/useCustomSecuredMutation";
import { useSecuredMutation } from "../../hooks/useSecuredMutation";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalDiscountSettings = ({ header, setIsModalDiscountSettingsOpen }) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [formData, setFormData] = useState({
    type: "",
    description: "",
    amount: "",
    tax: "",
    unit: "",
    build: "",
  });

  const { data: units } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_BUSINESS_UNITS_READ_ENDPOINT,
    "Business Unit"
  );
  const { data: builds } = useCustomQuery(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_PARAMS_DISTINCT_BUILDS_READ_ENDPOINT,
    "builds"
  );

  const { mutate: createDiscount, isLoading: creating } =
    useCustomSecuredMutation(
      localStorage.getItem("apiendpoint") +
        import.meta.env.VITE_MUTATE_DISCOUNT_ENDPOINT
    );
  const { mutate: updateDiscount, isLoading: updating } = useSecuredMutation(
    localStorage.getItem("apiendpoint") +
      import.meta.env.VITE_MUTATE_DISCOUNT_ENDPOINT,
    "PATCH"
  );

  const handleSave = () => {
    const payload = {
      discounttypes: formData.type,
      description: formData.description.toUpperCase(),
      Amount: formData.amount,
      taxtype: formData.tax,
      busiunit: formData.unit,
      buildcode: formData.build,
    };
    createDiscount(payload, { onSuccess: () => setShowSuccess(true) });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      {isConfirmOpen && (
        <ModalYesNoReusable
          header="Confirm"
          message="Save discount settings?"
          setYesNoModalOpen={setIsConfirmOpen}
          triggerYesNoEvent={handleSave}
        />
      )}
      {showSuccess && (
        <ModalSuccessNavToSelf
          header="Success"
          message="Discount settings saved"
          onClose={() => setShowSuccess(false)}
        />
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-br from-colorBrand to-colorBrandSecondary p-4">
          <h2 className="text-white text-lg font-semibold">{header}</h2>
          <button
            onClick={() => setIsModalDiscountSettingsOpen(false)}
            className="text-white hover:text-gray-200 transition"
          >
            <HiX className="w-6 h-6" />
          </button>
        </div>

        {(creating || updating) && <LinearProgress color="inherit" />}

        <div className="p-6 space-y-4">
          {/* Discount Type */}
          <div>
            <label className="flex items-center space-x-1 text-sm text-gray-600">
              <HiChartPie className="w-5 h-5 text-colorBrand" />
              <span>Discount Type</span>
            </label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
              className="mt-1 w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-colorBrand"
            >
              <option value="">Select type</option>
              <option value="PERCENTAGE">PERCENTAGE</option>
              <option value="LUMPSUM">LUMPSUM</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm text-gray-600">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="mt-1 w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-colorBrand"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="flex items-center space-x-1 text-sm text-gray-600">
              <HiCash className="w-5 h-5 text-colorBrand" />
              <span>Value</span>
            </label>
            <input
              type="number"
              onWheel={(e) => e.target.blur()}
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              className="mt-1 w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-colorBrand"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Tax Type */}
            <div>
              <label className="text-sm text-gray-600">Tax Type</label>
              <select
                value={formData.tax}
                onChange={(e) =>
                  setFormData({ ...formData, tax: e.target.value })
                }
                className="mt-1 w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-colorBrand"
              >
                <option value="">Select tax</option>
                <option value="VAT">VAT</option>
                <option value="VAT EXEMPT">VAT EXEMPT</option>
              </select>
            </div>

            {/* Business Unit */}
            <div>
              <label className="flex items-center space-x-1 text-sm text-gray-600">
                <HiOfficeBuilding className="w-5 h-5 text-colorBrand" />
                <span>Business Unit</span>
              </label>
              <select
                value={formData.unit}
                onChange={(e) =>
                  setFormData({ ...formData, unit: e.target.value })
                }
                className="mt-1 w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-colorBrand"
              >
                <option value="">Select unit</option>
                {units?.map((u) => (
                  <option key={u.busunitcode} value={u.busunitcode}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Build Product */}
          <div>
            <label className="flex items-center space-x-1 text-sm text-gray-600">
              <HiCollection className="w-5 h-5 text-colorBrand" />
              <span>Build Product</span>
            </label>
            <select
              value={formData.build}
              onChange={(e) =>
                setFormData({ ...formData, build: e.target.value })
              }
              className="mt-1 w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-colorBrand"
            >
              <option value="">Select build</option>
              {builds?.map((b) => (
                <option key={b.build_code} value={b.build_code}>
                  {b.desc}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsModalDiscountSettingsOpen(false)}
              className="px-5 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => setIsConfirmOpen(true)}
              className="flex items-center space-x-2 px-5 py-2 bg-gradient-to-br from-colorBrand to-colorBrandSecondary text-white rounded-lg hover:opacity-90 transition"
            >
              <HiPlus className="w-5 h-5" />
              <span>Save</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ModalDiscountSettings;
