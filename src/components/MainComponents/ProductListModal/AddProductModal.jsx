/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import {
  FaCheck,
  FaPlus,
  FaSpinner,
  FaTimes,
  FaExclamationTriangle,
} from "react-icons/fa";

const PRICING_MUTATION_PATH =
  import.meta.env.VITE_POS_PRICING_MUTATION_ENDPOINT || "/api/pricing_engine.php";
const SALES_TYPE_LIST_PATH = "/api/sales_type_list.php";

const EMPTY_FORM = {
  item_name: "",
  item_category: "",
  unit_of_measure: "PC",
  vatable: "Yes",
  isDiscountable: "Yes",
};

const authHeaders = (headers = {}) => {
  const next = { ...headers };
  const token = localStorage.getItem("access_token");
  if (token) next.Authorization = `Bearer ${token}`;
  return next;
};

/**
 * Add a product to the inventory masterlist and set its price per sales type
 * in one step (backend: pricing_engine.php, action "add" with `prices`).
 */
const AddProductModal = ({
  isOpen,
  onClose,
  onAdded,
  isDark,
  apiHost,
  categories = [],
  units = [],
}) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [salesTypes, setSalesTypes] = useState([]);
  const [salesTypesLoading, setSalesTypesLoading] = useState(false);
  // { [description]: { checked: boolean, price: string } }
  const [prices, setPrices] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // reset + load sales types every time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setForm(EMPTY_FORM);
    setPrices({});
    setError("");
    if (!apiHost) return;

    let cancelled = false;
    setSalesTypesLoading(true);
    fetch(`${apiHost}${SALES_TYPE_LIST_PATH}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const list = (Array.isArray(res?.data) ? res.data : [])
          .map((row) => String(row?.description || "").trim())
          .filter(Boolean);
        setSalesTypes(list);
      })
      .catch(() => {
        if (!cancelled) setSalesTypes([]);
      })
      .finally(() => {
        if (!cancelled) setSalesTypesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, apiHost]);

  const selectedLines = useMemo(
    () =>
      salesTypes
        .filter((type) => prices[type]?.checked)
        .map((type) => ({ sales_type: type, srp: prices[type]?.price ?? "" })),
    [salesTypes, prices],
  );

  if (!isOpen) return null;

  const theme = {
    panel: isDark ? "bg-slate-900 border-white/10" : "bg-white border-slate-200",
    title: isDark ? "text-white" : "text-slate-800",
    label: isDark ? "text-slate-400" : "text-slate-500",
    input: isDark
      ? "bg-slate-800 border-white/10 text-white focus:border-blue-500 placeholder:text-slate-500"
      : "bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500 placeholder:text-slate-400",
    row: isDark ? "border-white/10" : "border-slate-200",
    rowOn: isDark ? "border-blue-500/50 bg-blue-500/10" : "border-blue-400 bg-blue-50",
  };

  const inputClass = `w-full rounded-2xl border-2 px-4 py-3 text-sm font-bold outline-none transition-all ${theme.input}`;
  const labelClass = `mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] ${theme.label}`;

  const toggleType = (type) => {
    setError("");
    setPrices((prev) => ({
      ...prev,
      [type]: { checked: !prev[type]?.checked, price: prev[type]?.price ?? "" },
    }));
  };

  const setTypePrice = (type, value) => {
    setError("");
    setPrices((prev) => ({
      ...prev,
      [type]: { checked: true, price: value },
    }));
  };

  const copyFirstPriceToAll = () => {
    const firstPrice = selectedLines.find((line) => line.srp !== "")?.srp;
    if (!firstPrice) return;
    setPrices((prev) => {
      const next = { ...prev };
      selectedLines.forEach((line) => {
        next[line.sales_type] = { checked: true, price: firstPrice };
      });
      return next;
    });
  };

  const validate = () => {
    if (!form.item_name.trim()) return "Product name is required.";
    if (!form.item_category.trim()) return "Category is required.";
    if (selectedLines.length === 0) return "Select at least one sales type.";
    const bad = selectedLines.find(
      (line) => !(Number(line.srp) > 0),
    );
    if (bad) return `Enter a valid price for ${bad.sales_type}.`;
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const response = await fetch(`${apiHost}${PRICING_MUTATION_PATH}`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          action: "add",
          item_name: form.item_name.trim(),
          item_category: form.item_category.trim(),
          unit_of_measure: form.unit_of_measure.trim() || "PC",
          vatable: form.vatable,
          isDiscountable: form.isDiscountable,
          prices: selectedLines.map((line) => ({
            sales_type: line.sales_type,
            srp: Number(line.srp),
          })),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.status !== "success") {
        throw new Error(result?.message || "Failed to add product.");
      }
      onAdded?.({
        inv_code: result.inv_code,
        item_name: form.item_name.trim(),
        prices_added: result.prices_added ?? selectedLines.length,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to add product.");
    } finally {
      setIsSaving(false);
    }
  };

  const yesNo = (field, label) => (
    <div>
      <span className={labelClass}>{label}</span>
      <div className={`flex rounded-2xl border-2 p-1 ${theme.row}`}>
        {["Yes", "No"].map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, [field]: opt }))}
            className={`flex-1 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
              form[field] === opt
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                : theme.label
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className={`flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-[32px] border-2 shadow-2xl ${theme.panel}`}
      >
        {/* Header */}
        <div className={`flex items-start justify-between gap-4 border-b-2 px-7 py-5 ${theme.row}`}>
          <div>
            <h3 className={`text-lg font-black uppercase tracking-tight ${theme.title}`}>
              Add Product
            </h3>
            <p className={`mt-0.5 text-[11px] font-bold ${theme.label}`}>
              Saved to inventory and pricing for every sales type you select.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className={`rounded-xl border-2 p-2 transition-all ${theme.row} ${theme.label} hover:text-rose-500`}
          >
            <FaTimes size={12} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-7 py-6">
          <div>
            <label className={labelClass} htmlFor="add-product-name">
              Product Name
            </label>
            <input
              id="add-product-name"
              autoFocus
              type="text"
              maxLength={255}
              value={form.item_name}
              onChange={(e) => {
                setError("");
                setForm((prev) => ({ ...prev, item_name: e.target.value }));
              }}
              placeholder="e.g. Club Sandwich"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
            <div>
              <label className={labelClass} htmlFor="add-product-category">
                Category
              </label>
              <input
                id="add-product-category"
                type="text"
                list="add-product-category-options"
                value={form.item_category}
                onChange={(e) => {
                  setError("");
                  setForm((prev) => ({ ...prev, item_category: e.target.value.toUpperCase() }));
                }}
                placeholder="Pick or type a category"
                className={inputClass}
              />
              <datalist id="add-product-category-options">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelClass} htmlFor="add-product-uom">
                Unit
              </label>
              <input
                id="add-product-uom"
                type="text"
                list="add-product-uom-options"
                value={form.unit_of_measure}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, unit_of_measure: e.target.value.toUpperCase() }))
                }
                className={inputClass}
              />
              <datalist id="add-product-uom-options">
                {units.map((unit) => (
                  <option key={unit} value={unit} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {yesNo("vatable", "Vatable")}
            {yesNo("isDiscountable", "Discountable")}
          </div>

          {/* Sales types + prices */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className={labelClass + " !mb-0"}>Sales Type &amp; Price</span>
              {selectedLines.length > 1 && (
                <button
                  type="button"
                  onClick={copyFirstPriceToAll}
                  className="text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-600"
                >
                  Same price for all
                </button>
              )}
            </div>

            {salesTypesLoading ? (
              <div className={`flex items-center gap-2 py-6 text-xs font-bold ${theme.label}`}>
                <FaSpinner className="animate-spin" /> Loading sales types...
              </div>
            ) : salesTypes.length === 0 ? (
              <p className={`py-4 text-xs font-bold ${theme.label}`}>
                No sales types found.
              </p>
            ) : (
              <div className="space-y-2">
                {salesTypes.map((type) => {
                  const line = prices[type] || { checked: false, price: "" };
                  return (
                    <div
                      key={type}
                      className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2 transition-all ${
                        line.checked ? theme.rowOn : theme.row
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleType(type)}
                        className="flex flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 ${
                            line.checked
                              ? "border-blue-600 bg-blue-600 text-white"
                              : theme.row
                          }`}
                        >
                          {line.checked && <FaCheck size={9} />}
                        </span>
                        <span className={`text-xs font-black uppercase tracking-wide ${theme.title}`}>
                          {type}
                        </span>
                      </button>
                      <div className="relative w-32">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black ${theme.label}`}>
                          ₱
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={line.price}
                          onChange={(e) => setTypePrice(type, e.target.value)}
                          placeholder="0.00"
                          className={`w-full rounded-xl border-2 py-2 pl-7 pr-3 text-right text-sm font-black outline-none ${theme.input}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-2xl border-2 border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-500">
              <FaExclamationTriangle className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex gap-3 border-t-2 px-7 py-5 ${theme.row}`}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className={`flex-1 rounded-2xl border-2 py-3.5 text-[10px] font-black uppercase tracking-widest transition-all ${theme.row} ${theme.label}`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-60"
          >
            {isSaving ? <FaSpinner className="animate-spin" /> : <FaPlus />}
            {isSaving
              ? "Saving..."
              : `Add Product${selectedLines.length ? ` (${selectedLines.length} sales type${selectedLines.length > 1 ? "s" : ""})` : ""}`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddProductModal;
