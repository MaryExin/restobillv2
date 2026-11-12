import React, { useEffect, useState } from "react";
import { FaArrowDown, FaArrowUp, FaPlus, FaTimes, FaTrash } from "react-icons/fa";
import "../../../fonts/font-style.css";
import { useCustomSecuredMutation } from "../../../hooks/useCustomSecuredMutation";
import { posAuthenticatedFetch } from "../../../utils/posAuthenticatedFetch";
import { normalizeOptionGroups, productOptionsEndpoint } from "../../../utils/productOptions";

// Common groups a staff member can add with one tap.
const PRESETS = [
  { label: "Rice", group: { group_name: "Rice", select_type: "single", options: "Garlic rice, Plain rice", default_option: "Garlic rice" } },
  { label: "Egg", group: { group_name: "Egg", select_type: "single", options: "Sunny side up, Over easy, Scrambled, Well done", default_option: "Sunny side up" } },
  { label: "Cooking", group: { group_name: "Cooking", select_type: "single", options: "Regular, Crispy, Well done", default_option: "Regular" } },
  { label: "Spice", group: { group_name: "Spice", select_type: "single", options: "Regular, Mild, Spicy, Extra spicy", default_option: "Regular" } },
  { label: "Dipping sauce", group: { group_name: "Dipping sauce", select_type: "single", options: "Soy & calamansi, Spicy vinegar, Both", default_option: "Soy & calamansi" } },
  { label: "Sugar", group: { group_name: "Sugar", select_type: "single", options: "Regular, Less sugar, No sugar, Extra sugar", default_option: "Regular" } },
  { label: "Ice", group: { group_name: "Ice", select_type: "single", options: "Regular ice, Less ice, No ice", default_option: "Regular ice" } },
  { label: "Remove", group: { group_name: "Remove", select_type: "multi", options: "No onion, No tomato, No garlic", default_option: "" } },
];

const splitOptions = (text) =>
  Array.from(new Set(String(text || "").split(",").map((item) => item.trim()).filter(Boolean)));

const toEditable = (groups) =>
  groups.map((group) => ({
    group_name: group.group_name,
    select_type: group.select_type,
    options: group.options.join(", "),
    default_option: group.default_option || "",
  }));

/**
 * Edits the suggested options of one product. A product without groups of
 * its own uses its category's defaults; the editor can customize the item
 * (saves product rows) or edit the category defaults for every item in it.
 */
const ProductOptionsModal = ({ product, onClose, onSaved, apiHost, isDark = false }) => {
  const category = String(product?.item_category || "").trim();
  const [mode, setMode] = useState("product"); // "product" | "category"
  const [groups, setGroups] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [categoryGroups, setCategoryGroups] = useState([]);
  const [source, setSource] = useState("none"); // what the ordering screen uses now
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const { mutate: saveOptions, isLoading: isSaving } = useCustomSecuredMutation(
    productOptionsEndpoint(apiHost),
  );

  useEffect(() => {
    if (!product?.product_id || !apiHost) return undefined;
    let cancelled = false;
    setIsLoading(true);
    setError("");
    (async () => {
      try {
        const params = new URLSearchParams({ product_id: product.product_id, item_category: category });
        const response = await posAuthenticatedFetch(`${productOptionsEndpoint(apiHost)}?${params.toString()}`);
        const result = await response.json();
        if (cancelled) return;
        const own = normalizeOptionGroups(result?.data?.groups);
        const defaults = normalizeOptionGroups(result?.data?.category_groups);
        setProductGroups(own);
        setCategoryGroups(defaults);
        setSource(own.length ? "product" : defaults.length ? "category" : "none");
        setMode("product");
        // Start from what the cashier currently sees for this item.
        setGroups(toEditable(own.length ? own : defaults));
      } catch {
        if (!cancelled) setError("Could not load the current options.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product?.product_id, category, apiHost]);

  if (!product) return null;

  const switchMode = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setError("");
    setGroups(toEditable(nextMode === "category" ? categoryGroups : productGroups.length ? productGroups : categoryGroups));
  };

  const updateGroup = (index, patch) =>
    setGroups((prev) => prev.map((group, i) => (i === index ? { ...group, ...patch } : group)));
  const removeGroup = (index) => setGroups((prev) => prev.filter((_, i) => i !== index));
  const moveGroup = (index, delta) =>
    setGroups((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const addGroup = (preset) =>
    setGroups((prev) => [
      ...prev,
      preset || { group_name: "", select_type: "single", options: "", default_option: "" },
    ]);

  const submit = (payloadGroups) => {
    const target = mode === "category" ? { item_category: category } : { product_id: product.product_id };
    saveOptions(
      { ...target, groups: payloadGroups },
      {
        onSuccess: (result) => {
          if (result?.success) {
            onSaved?.({
              productId: product.product_id,
              itemCategory: mode === "category" ? category : "",
              groups: normalizeOptionGroups(result?.data?.groups),
            });
            onClose();
          } else {
            setError(result?.message || "Could not save the options.");
          }
        },
        onError: () => setError("Could not reach the POS server."),
      },
    );
  };

  const handleSave = () => {
    setError("");
    const payloadGroups = [];
    for (const group of groups) {
      const name = group.group_name.trim();
      const options = splitOptions(group.options);
      if (!name) {
        setError("Every group needs a name.");
        return;
      }
      if (options.length === 0) {
        setError(`"${name}" needs at least one option (separate options with commas).`);
        return;
      }
      const defaultOption = group.select_type === "single" && options.includes(group.default_option) ? group.default_option : "";
      payloadGroups.push({ group_name: name, select_type: group.select_type, options, default_option: defaultOption });
    }
    submit(payloadGroups);
  };

  // Removes the item's own rows so it follows the category defaults again.
  const handleUseCategoryDefaults = () => {
    setError("");
    submit([]);
  };

  const field = `w-full rounded-xl border px-3 py-2 text-[13px] outline-none ${
    isDark ? "border-white/10 bg-white/5 text-white placeholder:text-slate-500" : "border-slate-300 bg-white text-slate-900"
  }`;
  const tab = (active) =>
    `rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
      active
        ? "bg-[var(--app-accent)] text-[#fff]"
        : isDark
          ? "bg-white/10 text-slate-300"
          : "bg-slate-100 text-slate-600"
    }`;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-sm ${isDark ? "bg-black/70" : "bg-slate-900/40"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border shadow-2xl ${
          isDark ? "border-white/10 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <div className={`flex items-start justify-between gap-3 border-b px-6 py-4 ${isDark ? "border-white/10" : "border-slate-200"}`}>
          <div className="min-w-0">
            <p className="font-[Poppins-SemiBold] text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--app-accent)" }}>
              Suggested options
            </p>
            <h2 className="truncate font-[Poppins-Bold] text-[18px]">{product.item_name}</h2>
            <p className={`text-[12px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Shown as chips when this item is added to an order. Mark the usual serving as default; only changes print on the ticket.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${isDark ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-600"}`}
          >
            <FaTimes />
          </button>
        </div>

        {category ? (
          <div className={`flex flex-wrap items-center gap-2 border-b px-6 py-3 ${isDark ? "border-white/10" : "border-slate-200"}`}>
            <button type="button" className={tab(mode === "product")} onClick={() => switchMode("product")}>
              This item only
            </button>
            <button type="button" className={tab(mode === "category")} onClick={() => switchMode("category")}>
              All {category} items
            </button>
            <span className={`ml-auto text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {source === "product"
                ? "This item has its own options."
                : source === "category"
                  ? `Using the ${category} defaults.`
                  : "No suggestions yet."}
            </span>
          </div>
        ) : null}

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {mode === "category" ? (
            <p className={`rounded-2xl px-4 py-2.5 text-[12px] ${isDark ? "bg-amber-400/10 text-amber-200" : "bg-amber-50 text-amber-700"}`}>
              These defaults apply to every {category} item that has no options of its own, including items added later.
            </p>
          ) : null}

          {isLoading ? (
            <p className={`py-8 text-center text-[13px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Loading…</p>
          ) : groups.length === 0 ? (
            <p className={`rounded-2xl border border-dashed px-4 py-6 text-center text-[13px] ${isDark ? "border-white/15 text-slate-400" : "border-slate-300 text-slate-500"}`}>
              No options yet. Add a group below (e.g. Rice, Egg, Sugar).
            </p>
          ) : (
            groups.map((group, index) => {
              const options = splitOptions(group.options);
              return (
                <div key={index} className={`rounded-2xl border p-3.5 ${isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"}`}>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
                    <input
                      type="text"
                      value={group.group_name}
                      maxLength={60}
                      onChange={(event) => updateGroup(index, { group_name: event.target.value })}
                      placeholder="Group name (e.g. Egg)"
                      className={field}
                    />
                    <select
                      value={group.select_type}
                      onChange={(event) =>
                        updateGroup(index, {
                          select_type: event.target.value,
                          default_option: event.target.value === "multi" ? "" : group.default_option,
                        })
                      }
                      className={field}
                    >
                      <option value="single">Choose one</option>
                      <option value="multi">Choose many</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => moveGroup(index, -1)} aria-label="Move up" className={`grid h-9 w-9 place-items-center rounded-lg ${isDark ? "bg-white/10" : "bg-white border border-slate-200"}`}>
                        <FaArrowUp className="text-[11px]" />
                      </button>
                      <button type="button" onClick={() => moveGroup(index, 1)} aria-label="Move down" className={`grid h-9 w-9 place-items-center rounded-lg ${isDark ? "bg-white/10" : "bg-white border border-slate-200"}`}>
                        <FaArrowDown className="text-[11px]" />
                      </button>
                      <button type="button" onClick={() => removeGroup(index)} aria-label="Remove group" className="grid h-9 w-9 place-items-center rounded-lg text-rose-500">
                        <FaTrash className="text-[11px]" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={group.options}
                    onChange={(event) => updateGroup(index, { options: event.target.value })}
                    placeholder="Options, separated by commas (e.g. Sunny side up, Scrambled)"
                    className={`${field} mt-2`}
                  />
                  {group.select_type === "single" ? (
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-[11px] font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>Default</span>
                      <select
                        value={options.includes(group.default_option) ? group.default_option : ""}
                        onChange={(event) => updateGroup(index, { default_option: event.target.value })}
                        className={`${field} max-w-xs`}
                      >
                        <option value="">No default (always ask)</option>
                        {options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => addGroup()}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold text-[#fff]"
              style={{ backgroundColor: "var(--app-accent)" }}
            >
              <FaPlus className="text-[10px]" /> Add group
            </button>
            <span className={`text-[11px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>Quick add:</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => addGroup({ ...preset.group })}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isDark ? "border-white/15 text-slate-300" : "border-slate-300 text-slate-600"}`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {error ? <p className="text-[13px] font-semibold text-rose-500">{error}</p> : null}
        </div>

        <div className={`flex flex-wrap gap-3 border-t px-6 py-4 ${isDark ? "border-white/10" : "border-slate-200"}`}>
          {mode === "product" && source === "product" && categoryGroups.length > 0 ? (
            <button
              type="button"
              onClick={handleUseCategoryDefaults}
              disabled={isSaving}
              title={`Remove this item's own options and follow the ${category} defaults`}
              className={`rounded-xl border px-4 py-3 text-[13px] font-bold ${isDark ? "border-white/15 text-slate-300" : "border-slate-300 text-slate-600"}`}
            >
              Use category defaults
            </button>
          ) : null}
          <button type="button" onClick={onClose} disabled={isSaving} className={`flex-1 rounded-xl border px-4 py-3 text-[14px] font-bold ${isDark ? "border-white/15" : "border-slate-300"}`}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={isSaving || isLoading} className="flex-[2] rounded-xl px-4 py-3 text-[14px] font-bold text-[#fff] disabled:opacity-60" style={{ backgroundColor: "var(--app-accent)" }}>
            {isSaving ? "Saving…" : mode === "category" ? `Save ${category} defaults` : "Save for this item"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductOptionsModal;
