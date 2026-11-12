import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaEdit, FaMinus, FaPlus, FaSearch, FaTimes, FaUtensils } from "react-icons/fa";
import { FiX } from "react-icons/fi";
import "../../fonts/font-style.css";
import ProductOptionChips from "../MainComponents/Common/ProductOptionChips";
import { useTheme } from "../../context/ThemeContext";
import {
  buildOptionMaps,
  composeOptionInstruction,
  defaultOptionSelections,
  parseOptionInstruction,
  productOptionsEndpoint,
  resolveOptionGroups,
} from "../../utils/productOptions";

const peso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MAX_LINES = 50;

const fetchMenu = async ({ apiHost, scope, salesType, search, codes, signal }) => {
  const response = await fetch(`${apiHost}/api/get_pricing_selection.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category_code: scope?.category_code || "",
      unit_code: scope?.unit_code || "",
      sales_type: salesType,
      ...(codes ? { codes } : { search, limit: 40 }),
    }),
    signal,
  });
  const result = await response.json();
  if (result?.status !== "success") {
    throw new Error(result?.message || "Could not load the menu.");
  }
  return Array.isArray(result.products) ? result.products : [];
};

/**
 * Optional pre-order for a reservation. value = { salesType, items:
 * [{ product_id, item_name, quantity, price }] }. Prices are only an
 * estimate here; the order screen re-reads current prices.
 */
const PreOrderPicker = ({ apiHost, scope, salesTypes = [], suggestedSalesType = "", value, onChange, startExpanded = false }) => {
  const items = value?.items || [];
  const salesType = value?.salesType || "";
  const [expanded, setExpanded] = useState(startExpanded || items.length > 0);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [notice, setNotice] = useState("");
  const latestItems = useRef(items);
  latestItems.current = items;
  const { theme } = useTheme();
  const isDark = theme === "dark";
  // Suggested options per product (Rice, Egg, Cooking...) and a free-text
  // note, saved on the item as its special instruction. The same "Item
  // Instruction" modal as the ordering screen: it opens right after an item
  // with option groups is added ("add" mode, Skip keeps the item) or from
  // the note button on a pre-order line ("edit" mode).
  const [optionMaps, setOptionMaps] = useState(null);
  const [instructionItem, setInstructionItem] = useState(null);
  const [instructionSelections, setInstructionSelections] = useState({});
  const [instructionText, setInstructionText] = useState("");
  const [instructionMode, setInstructionMode] = useState("edit");
  const [askOptionsOnAdd, setAskOptionsOnAdd] = useState(() => {
    try {
      return localStorage.getItem("posAskItemOptions") !== "false";
    } catch {
      return true;
    }
  });

  const canSearch = Boolean(apiHost && scope?.unit_code && salesType);

  const scopeCategoryCode = scope?.category_code || "";
  const scopeUnitCode = scope?.unit_code || "";
  useEffect(() => {
    if (!expanded || !apiHost || optionMaps) return undefined;
    let cancelled = false;
    const params = new URLSearchParams({ category_code: scopeCategoryCode, unit_code: scopeUnitCode });
    fetch(`${productOptionsEndpoint(apiHost)}?${params.toString()}`)
      .then((response) => response.json())
      .then((result) => {
        if (!cancelled) setOptionMaps(buildOptionMaps(result?.success ? result?.data : null));
      })
      .catch(() => {
        if (!cancelled) setOptionMaps({ byProduct: {}, byCategory: {} });
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, apiHost, optionMaps, scopeCategoryCode, scopeUnitCode]);

  // Default the service type from the assigned room (e.g. Bar 01 -> BAR).
  useEffect(() => {
    if (expanded && !salesType && (suggestedSalesType || salesTypes[0]?.sales_type)) {
      onChange({ salesType: suggestedSalesType || salesTypes[0].sales_type, items });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, salesType, suggestedSalesType, salesTypes]);

  // Menu search for the chosen service type.
  useEffect(() => {
    if (!expanded || !canSearch) {
      setResults([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        setResults(await fetchMenu({ apiHost, scope, salesType, search: search.trim(), signal: controller.signal }));
      } catch (error) {
        if (error?.name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [expanded, canSearch, apiHost, scope, salesType, search]);

  const changeSalesType = async (nextSalesType) => {
    setNotice("");
    const current = latestItems.current;
    if (current.length === 0) {
      onChange({ salesType: nextSalesType, items: current });
      return;
    }
    try {
      const products = await fetchMenu({
        apiHost,
        scope,
        salesType: nextSalesType,
        codes: current.map((item) => item.product_id),
      });
      const priceById = new Map(products.map((p) => [String(p.product_id), Number(p.selling_price || 0)]));
      const kept = current
        .filter((item) => priceById.has(String(item.product_id)))
        .map((item) => ({ ...item, price: priceById.get(String(item.product_id)) }));
      const removed = current.filter((item) => !priceById.has(String(item.product_id)));
      if (removed.length) {
        setNotice(`Removed (not on the ${nextSalesType} menu): ${removed.map((item) => item.item_name).join(", ")}`);
      }
      onChange({ salesType: nextSalesType, items: kept });
    } catch {
      setNotice("Could not check prices for that service type. Try again.");
    }
  };

  const addItem = (product) => {
    setNotice("");
    const id = String(product.product_id);
    const existing = items.find((item) => String(item.product_id) === id);
    if (!existing && items.length >= MAX_LINES) {
      setNotice(`A pre-order can have up to ${MAX_LINES} different items.`);
      return;
    }
    const line = {
      product_id: id,
      item_name: product.item_name,
      quantity: 1,
      price: Number(product.selling_price || 0),
      item_category: product.item_category || "",
      item_instruction: "",
    };
    const next = existing
      ? items.map((item) =>
          String(item.product_id) === id ? { ...item, quantity: Math.min(999, item.quantity + 1) } : item,
        )
      : [...items, line];
    onChange({ salesType, items: next });
    // Like the ordering screen: a new item with suggested options opens the
    // option picker right away (Skip keeps the item with no note).
    if (!existing && askOptionsOnAdd && resolveOptionGroups(optionMaps, id, line.item_category).length > 0) {
      openInstructionModal(line, "add");
    }
  };

  const setQuantity = (productId, quantity) => {
    const next = items
      .map((item) =>
        String(item.product_id) === String(productId)
          ? { ...item, quantity: Math.max(0, Math.min(999, quantity)) }
          : item,
      )
      .filter((item) => item.quantity > 0);
    onChange({ salesType, items: next });
  };

  const setInstruction = (productId, instruction) => {
    onChange({
      salesType,
      items: latestItems.current.map((item) =>
        String(item.product_id) === String(productId) ? { ...item, item_instruction: instruction } : item,
      ),
    });
  };

  const openInstructionModal = (item, mode = "edit") => {
    const groups = resolveOptionGroups(optionMaps, item.product_id, item.item_category);
    const parsed = parseOptionInstruction(groups, item.item_instruction);
    setInstructionItem(item);
    setInstructionSelections(parsed.selections);
    setInstructionText(parsed.freeText);
    setInstructionMode(mode);
  };

  const closeInstructionModal = () => {
    setInstructionItem(null);
    setInstructionSelections({});
    setInstructionText("");
    setInstructionMode("edit");
  };

  const instructionGroups = instructionItem
    ? resolveOptionGroups(optionMaps, instructionItem.product_id, instructionItem.item_category)
    : [];

  const saveInstruction = () => {
    if (!instructionItem) return;
    setInstruction(
      instructionItem.product_id,
      composeOptionInstruction(instructionGroups, instructionSelections, instructionText),
    );
    closeInstructionModal();
  };

  // Skip on a just-added item keeps it with no note; Cancel on an edit
  // leaves the line unchanged.
  const skipInstruction = () => {
    if (instructionMode === "add") setInstruction(instructionItem.product_id, "");
    closeInstructionModal();
  };

  const rememberAskOptionsOnAdd = (checked) => {
    setAskOptionsOnAdd(checked);
    try {
      localStorage.setItem("posAskItemOptions", checked ? "true" : "false");
    } catch {
      /* storage unavailable */
    }
  };

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0),
    [items],
  );

  const box = { borderColor: "var(--app-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 font-[Poppins-SemiBold] text-[13px] transition hover:opacity-85"
        style={{ borderColor: "var(--app-border)", color: "var(--app-accent)" }}
      >
        <FaUtensils className="text-[12px]" /> Add pre-order (optional)
      </button>
    );
  }

  return (
    <div className="rounded-2xl border p-3.5" style={{ borderColor: "var(--app-border)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={salesType}
          onChange={(event) => changeSalesType(event.target.value)}
          aria-label="Service type for the pre-order"
          className="rounded-xl border px-3 py-2 font-[Poppins-Medium] text-[13px] outline-none"
          style={box}
        >
          {salesTypes.map((type) => (
            <option key={type.sales_type_id} value={type.sales_type}>
              {type.sales_type}
            </option>
          ))}
        </select>
        <div className="relative min-w-[180px] flex-1">
          <FaSearch
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px]"
            style={{ color: "var(--app-muted-text)" }}
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search the menu"
            aria-label="Search the menu"
            className="w-full rounded-xl border py-2 pl-8 pr-3 font-[Poppins-Regular] text-[13px] outline-none"
            style={box}
          />
        </div>
      </div>

      <div
        className="mt-2.5 max-h-44 overflow-y-auto rounded-xl border"
        style={{ borderColor: "var(--app-border)" }}
        aria-label="Menu results"
      >
        {isSearching && results.length === 0 ? (
          <p className="px-3 py-3 font-[Poppins-Regular] text-[12px]" style={{ color: "var(--app-muted-text)" }}>
            Loading menu…
          </p>
        ) : results.length === 0 ? (
          <p className="px-3 py-3 font-[Poppins-Regular] text-[12px]" style={{ color: "var(--app-muted-text)" }}>
            {canSearch ? "No items found." : "Select a service type to see the menu."}
          </p>
        ) : (
          results.map((product) => (
            <button
              key={product.product_id}
              type="button"
              onClick={() => addItem(product)}
              className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left transition last:border-b-0 hover:opacity-80"
              style={{ borderColor: "var(--app-border)" }}
            >
              <span className="min-w-0">
                <span className="block truncate font-[Poppins-Medium] text-[13px]">{product.item_name}</span>
                <span className="block truncate font-[Poppins-Regular] text-[11px]" style={{ color: "var(--app-muted-text)" }}>
                  {product.item_category}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 font-[Poppins-SemiBold] text-[13px]">
                {peso(product.selling_price)}
                <FaPlus className="text-[11px]" style={{ color: "var(--app-accent)" }} />
              </span>
            </button>
          ))
        )}
      </div>

      {notice ? (
        <p className="mt-2 font-[Poppins-Medium] text-[12px]" style={{ color: "#b45309" }}>
          {notice}
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 font-[Poppins-SemiBold] text-[12px] uppercase tracking-[0.08em]" style={{ color: "var(--app-muted-text)" }}>
            Pre-order · {items.length} item{items.length === 1 ? "" : "s"}
          </p>
          <ul className="space-y-1.5">
            {items.map((item) => {
              const summary = String(item.item_instruction || "").replace(/\n+/g, " · ").trim();
              return (
              <li key={item.product_id} className="rounded-xl border px-2 py-1.5" style={{ borderColor: "var(--app-border)" }}>
                <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-[Poppins-Medium] text-[13px]">{item.item_name}</span>
                  <span className="font-[Poppins-Regular] text-[11px]" style={{ color: "var(--app-muted-text)" }}>
                    {peso(item.price)} each
                  </span>
                  {summary ? (
                    <span
                      className="block truncate font-[Poppins-Regular] text-[11px]"
                      style={{ color: "var(--app-accent)" }}
                      title={summary}
                    >
                      {summary}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(item.product_id, item.quantity - 1)}
                  aria-label={`Less ${item.item_name}`}
                  className="grid h-8 w-8 place-items-center rounded-lg border"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <FaMinus className="text-[10px]" />
                </button>
                <span className="w-7 text-center font-[Poppins-SemiBold] text-[13px]">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(item.product_id, item.quantity + 1)}
                  aria-label={`More ${item.item_name}`}
                  className="grid h-8 w-8 place-items-center rounded-lg border"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <FaPlus className="text-[10px]" />
                </button>
                <span className="w-20 text-right font-[Poppins-SemiBold] text-[13px]">
                  {peso(item.price * item.quantity)}
                </span>
                <button
                  type="button"
                  onClick={() => openInstructionModal(item, "edit")}
                  aria-label={`Instruction for ${item.item_name}`}
                  title="Add instruction"
                  className="grid h-8 w-8 place-items-center rounded-lg transition hover:opacity-70"
                  style={{ color: summary ? "var(--app-accent)" : "var(--app-muted-text)" }}
                >
                  <FaEdit className="text-[14px]" />
                </button>
                <button
                  type="button"
                  onClick={() => setQuantity(item.product_id, 0)}
                  aria-label={`Remove ${item.item_name}`}
                  className="grid h-8 w-8 place-items-center rounded-lg"
                  style={{ color: "#be123c" }}
                >
                  <FaTimes className="text-[11px]" />
                </button>
                </div>
              </li>
              );
            })}
          </ul>
          <div className="mt-2.5 flex items-center justify-between border-t pt-2.5" style={{ borderColor: "var(--app-border)" }}>
            <span className="font-[Poppins-Regular] text-[12px]" style={{ color: "var(--app-muted-text)" }}>
              Estimate · final prices are checked when the order opens
            </span>
            <span className="font-[Poppins-Bold] text-[15px]">{peso(total)}</span>
          </div>
        </div>
      ) : (
        <p className="mt-2 font-[Poppins-Regular] text-[12px]" style={{ color: "var(--app-muted-text)" }}>
          Tap an item to add it. The order will be filled in when you press “Order”.
        </p>
      )}

      {instructionItem ? (
        <div
          className={`fixed inset-0 z-[360] flex items-center justify-center p-4 ui-fade-in ${
            isDark ? "bg-black/70" : "bg-slate-900/40"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Item Instruction"
        >
          <div
            className={`w-full max-w-md rounded-3xl p-6 shadow-2xl transition-colors ui-scale-in ${
              isDark ? "bg-slate-900 border border-white/10" : "bg-white border border-slate-200"
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className={`text-lg font-black ${isDark ? "text-white" : "text-slate-900"}`}>Item Instruction</h3>
              <button
                type="button"
                onClick={skipInstruction}
                aria-label="Close"
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                  isDark ? "bg-white/10 text-slate-300 hover:bg-white/20" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="mb-4">
              <p className={`mb-2 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>Product</p>
              <div
                className={`rounded-2xl p-3 font-semibold transition-colors ${
                  isDark ? "bg-white/5 border border-white/10 text-white" : "bg-slate-50 border border-slate-200 text-slate-900"
                }`}
              >
                {instructionItem.item_name}
              </div>
            </div>

            {instructionGroups.length > 0 ? (
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>Suggested options</p>
                  <button
                    type="button"
                    onClick={() => setInstructionSelections(defaultOptionSelections(instructionGroups))}
                    className={`text-[11px] font-semibold ${
                      isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Reset to default
                  </button>
                </div>
                <ProductOptionChips
                  groups={instructionGroups}
                  selections={instructionSelections}
                  onChange={setInstructionSelections}
                  isDark={isDark}
                />
                <p className={`mt-2 text-[11px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  Default choices are the usual serving; only changes are printed on the ticket.
                </p>
              </div>
            ) : null}

            <div className="mb-5">
              <label className={`mb-2 block text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {instructionGroups.length > 0 ? "Other request (optional)" : "Special instruction"}
              </label>
              <textarea
                rows={instructionGroups.length > 0 ? 2 : 5}
                maxLength={300}
                value={instructionText}
                onChange={(event) => setInstructionText(event.target.value)}
                placeholder="Example: no onions, extra spicy, less ice..."
                className={`w-full resize-none rounded-2xl p-4 text-sm outline-none transition-colors ${
                  isDark
                    ? "bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/50"
                    : "bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-400"
                }`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={saveInstruction}
                className="w-full rounded-2xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-500"
              >
                {instructionMode === "add" ? "Add to order" : "Save"}
              </button>
              <button
                type="button"
                onClick={skipInstruction}
                className={`w-full rounded-2xl py-3 font-bold transition-colors ${
                  isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-slate-200 text-slate-800 hover:bg-slate-300"
                }`}
              >
                {instructionMode === "add" ? "Skip" : "Cancel"}
              </button>
            </div>

            {instructionGroups.length > 0 ? (
              <label
                className={`mt-3 flex cursor-pointer items-center gap-2 text-[11px] ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <input
                  type="checkbox"
                  checked={askOptionsOnAdd}
                  onChange={(event) => rememberAskOptionsOnAdd(event.target.checked)}
                />
                Ask for options when adding items
              </label>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PreOrderPicker;
