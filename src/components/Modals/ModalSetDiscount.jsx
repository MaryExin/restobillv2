import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { HiX, HiCog, HiChartPie, HiCash, HiPencilAlt } from "react-icons/hi";
import { roundDecimals } from "../../constants/RoundDecimals";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalSetDiscount = ({
  header,
  setIsModalDiscountsOpen,
  setIsModalDiscountSettingsOpen,
  discountData,
  setSelectedDiscount,
  selectedDiscount,
  discountedProduct,
  handleVatExemptDiscountTransactions,
  handleOtherDiscounts,
  showToast,
  setSalesSummary,
  salesSummary,
  salesNetTotal,
  totalVat,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();
  const [tabSelected, setTabSelected] = useState("Percentage");
  const [discountReference, setDiscountReference] = useState("");
  const [multiplier, setMultiplier] = useState(1);
  const [manualDiscount, setManualDiscount] = useState(0);
  const [isPercentageTotal, setIsPercentageTotal] = useState(false);

  const tabs = [
    { key: "Percentage", icon: HiChartPie },
    { key: "Lumpsum", icon: HiCash },
    { key: "Manual", icon: HiPencilAlt },
  ];

  const handleDiscountSetup = () => {
    if (
      selectedDiscount.tax_type === "VAT EXEMPT" &&
      tabSelected !== "Manual" &&
      tabSelected !== "Lumpsum"
    ) {
      const clone = [...salesSummary];
      const idx = clone.findIndex(
        (i) => i.inv_code === discountedProduct.build_code
      );
      if (idx !== -1) {
        if (clone[idx].qty > 1) {
          clone[idx].qty -= 1;
          clone[idx].total_sales -= discountedProduct.srp;
          clone[idx].total_cost -= discountedProduct.cost_per_uom;
          clone[idx].tax_type === "VATABLE"
            ? (clone[idx].vat -= roundDecimals(
                (discountedProduct.srp / 1.12) * 0.12
              ))
            : (clone[idx].vat = 0);
          clone[idx].tax_type === "VATABLE"
            ? (clone[idx].vat -= roundDecimals(
                (discountedProduct.srp / 1.12) * 0.12,
                2
              ))
            : (clone[idx].vat = clone[idx].vat);
        } else clone.splice(idx, 1);
      }
      setSalesSummary(clone);
      handleVatExemptDiscountTransactions(
        discountedProduct.build_code,
        discountedProduct.desc,
        discountedProduct.build_qty,
        discountedProduct.cost_per_uom,
        discountedProduct.uomval,
        discountedProduct.uom,
        discountedProduct.build_qty * discountedProduct.cost_per_uom,
        discountedProduct.srp,
        discountedProduct.tax_type === "VATABLE"
          ? discountedProduct.build_qty *
              roundDecimals(discountedProduct.srp / 1.12)
          : discountedProduct.build_qty * discountedProduct.srp,
        0,
        "VAT EXEMPT",
        selectedDiscount.discount_type_id,
        selectedDiscount.description,
        selectedDiscount.type === "PERCENTAGE"
          ? discountedProduct.tax_type === "VATABLE"
            ? roundDecimals(discountedProduct.srp / 1.12) *
              selectedDiscount.value
            : discountedProduct.srp * selectedDiscount.value
          : selectedDiscount.value,
        discountReference,
        selectedDiscount.slcode
      );
    } else {
      handleOtherDiscounts(
        tabSelected !== "Manual"
          ? selectedDiscount.discount_type_id
          : "DC-275f4db86834",
        tabSelected !== "Manual" ? selectedDiscount.description : "Manual",
        tabSelected !== "Manual"
          ? selectedDiscount.value * multiplier
          : roundDecimals(parseFloat(manualDiscount)),
        discountReference
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-br from-colorBrand to-colorBrandSecondary p-4">
          <div className="flex items-center space-x-2">
            <h2 className="text-white text-lg font-semibold">{header}</h2>
            <button
              onClick={() => setIsModalDiscountSettingsOpen(true)}
              className="text-white hover:text-gray-200 transition"
            >
              <HiCog className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={() => setIsModalDiscountsOpen(false)}
            className="text-white hover:text-gray-200 transition"
          >
            <HiX className="w-6 h-6" />
          </button>
        </div>
        {/* Tabs */}
        <div className="flex overflow-x-auto bg-white">
          {tabs.map(({ key, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTabSelected(key)}
              className={`group flex-1 flex items-center justify-center space-x-2 py-2 px-4 whitespace-nowrap transition-colors duration-200 ${
                tabSelected === key
                  ? "bg-gradient-to-br from-colorBrand/50 to-colorBrandLighter text-darkPrimary"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
              }`}
            >
              <Icon className="w-5 h-5 transform transition-transform duration-300 group-hover:rotate-12" />
              <span className="font-medium">{key}</span>
            </button>
          ))}
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleDiscountSetup();
          }}
          className="p-4 space-y-4 overflow-y-auto"
        >
          {/* Discount Selection / Manual */}
          {tabSelected !== "Manual" ? (
            <div className="space-y-1">
              <label className="text-sm text-gray-600">Discounts</label>
              <select
                onChange={(e) =>
                  setSelectedDiscount(JSON.parse(e.target.value))
                }
                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-colorBrand"
                defaultValue=""
              >
                <option value="" disabled hidden>
                  Select discount
                </option>
                {tabSelected === "Percentage"
                  ? discountData
                      .filter((d) => d.type === "PERCENTAGE")
                      .map((d, i) => (
                        <option key={i} value={JSON.stringify(d)}>
                          {d.description} - {d.value * 100}%
                        </option>
                      ))
                  : discountData
                      .filter((d) => d.type !== "PERCENTAGE")
                      .map((d, i) => (
                        <option key={i} value={JSON.stringify(d)}>
                          {d.description} - ₱{d.value}
                        </option>
                      ))}
              </select>
            </div>
          ) : (
            <>
              {/* Percentage toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">% Computation</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    onChange={(e) => setIsPercentageTotal(e.target.checked)}
                  />
                  <div className="w-12 h-6 bg-gray-200 rounded-full peer-checked:bg-colorBrand transition" />
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-6 transition" />
                </label>
              </div>
              {isPercentageTotal && (
                <div>
                  <label className="text-sm text-gray-600">Discount %</label>
                  <input
                    type="number"
                    onWheel={(e) => e.target.blur()}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (v >= 1) {
                        setManualDiscount(
                          +((v / 100) * (salesNetTotal - totalVat)).toFixed(2)
                        );
                      }
                    }}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-colorBrand"
                  />
                </div>
              )}
              <div>
                <label className="text-sm text-gray-600">Discount</label>
                <input
                  type="number"
                  onWheel={(e) => e.target.blur()}
                  value={manualDiscount}
                  onChange={(e) =>
                    setManualDiscount(parseFloat(e.target.value))
                  }
                  className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-colorBrand"
                />
              </div>
            </>
          )}

          {/* Reference */}
          <div>
            <label className="text-sm text-gray-600">Reference</label>
            <input
              type="text"
              value={discountReference}
              onChange={(e) => setDiscountReference(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-colorBrand"
            />
          </div>

          {/* Lumpsum Multiplier */}
          {tabSelected === "Lumpsum" && (
            <div>
              <label className="text-sm text-gray-600">Multiplier</label>
              <input
                type="number"
                onWheel={(e) => e.target.blur()}
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-colorBrand"
              />
              <p className="mt-2 text-right text-sm font-semibold text-gray-800">
                Total: ₱{selectedDiscount.value * multiplier}
              </p>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-gradient-to-br from-colorBrand to-colorBrandSecondary text-white px-6 py-2 rounded-full shadow-md hover:shadow-lg transition"
            >
              Submit
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default ModalSetDiscount;

//comment
