import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiGitBranch, FiRefreshCw, FiX } from "react-icons/fi";
import { useCustomSecuredMutation } from "../../hooks/useCustomSecuredMutation";
import { getOrderItemDisplayName } from "../../utils/orderItemDisplayName";
import { getSplitBillSelection } from "../../utils/splitBillSelection";

const peso = (value) => Number(value || 0).toLocaleString("en-PH", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const readSplitPreview = async (response) => {
  const body = (await response.text()).replace(/^\uFEFF/, "").trim();
  const status = response.status >= 400 ? ` (HTTP ${response.status})` : "";
  if (!body) {
    throw new Error(`Unable to load saved items${status}: the server returned an empty response. Refresh items to try again.`);
  }
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`Unable to load saved items${status}: the server did not return valid billing data. Refresh items to try again.`);
  }
  if (!response.ok || data?.status !== "success") {
    throw new Error(data?.message || `Unable to load items for splitting${status}.`);
  }
  return data;
};

export default function SplitBillModal({ transaction, apiHost, onClose, onSuccess }) {
  const [record, setRecord] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [reload, setReload] = useState(0);
  const submitting = useRef(false);
  const closeRef = useRef(null);
  const endpoint = `${apiHost || ""}${import.meta.env.VITE_POS_SPLIT_BILL_ENDPOINT || "/api/split_bill.php"}`;
  const { mutateAsync, isLoading: isSaving } = useCustomSecuredMutation(endpoint);
  const transactionId = transaction?.transaction_id;
  const categoryCode = transaction?.Category_Code || localStorage.getItem("posBusinessCategoryCode") || "";
  const unitCode = transaction?.Unit_Code || localStorage.getItem("posBusinessUnitCode") || "";

  useEffect(() => { closeRef.current?.focus(); }, []);

  useEffect(() => {
    const controller = new AbortController();
    setRecord(null);
    setQuantities({});
    setError("");
    setNeedsRefresh(false);
    setIsLoading(true);
    if (!apiHost || !transactionId || !categoryCode || !unitCode) {
      setError("The transaction or business details are missing. Reopen billing and try again.");
      setIsLoading(false);
      return () => controller.abort();
    }
    const params = new URLSearchParams({ transaction_id: transactionId, Category_Code: categoryCode, Unit_Code: unitCode });
    fetch(`${endpoint}?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(readSplitPreview)
      .then((data) => {
        if (!Array.isArray(data.items) || !data.transaction || !data.snapshot_token) throw new Error("Incomplete split details. Refresh and try again.");
        if (!controller.signal.aborted) setRecord(data);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message || "Unable to load items for splitting.");
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, [apiHost, endpoint, transactionId, categoryCode, unitCode, reload]);

  const items = record?.items || [];
  const selection = useMemo(() => getSplitBillSelection(items, quantities), [items, quantities]);
  const disabled = isSaving || isLoading || record?.can_split !== true || needsRefresh;
  const close = () => { if (!submitting.current) onClose(); };
  const handleDialogKeyDown = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll("button:not(:disabled), input:not(:disabled)")];
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && event.target === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && event.target === last) { event.preventDefault(); first.focus(); }
  };

  const submit = async () => {
    if (submitting.current || disabled || selection.error || !record?.snapshot_token) return;
    submitting.current = true;
    setError("");
    try {
      const response = await mutateAsync({
        transaction_id: transactionId,
        Category_Code: categoryCode,
        Unit_Code: unitCode,
        snapshot_token: record.snapshot_token,
        items: selection.items,
        user_id: localStorage.getItem("user_id") || "",
        user_name: localStorage.getItem("username") || transaction?.cashier || "System",
      });
      if (response?.status !== "success" || !response.transaction?.transaction_id || !response.source_transaction?.transaction_id) {
        throw new Error(response?.message || "The split could not be confirmed. Refresh the items before trying again.");
      }
      onSuccess(response);
    } catch (failure) {
      setError(failure?.name === "SyntaxError"
        ? "The server did not confirm the split. Refresh items to check the saved bill before trying again."
        : failure.message || "Unable to split this bill. Refresh the items before trying again.");
      // The request may have committed before a connection error. Never replay
      // the previous selection automatically against a changed source bill.
      setNeedsRefresh(true);
    } finally {
      submitting.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-[100100] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm font-[Poppins-Regular]">
      <section role="dialog" aria-modal="true" aria-labelledby="split-bill-title"
        onKeyDown={handleDialogKeyDown}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-softPrimary bg-medPrimary text-colorBrandLighter shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-softPrimary p-5">
          <div>
            <h2 id="split-bill-title" className="flex items-center gap-2 text-lg font-[Poppins-SemiBold]"><FiGitBranch /> Split bill</h2>
            <p className="mt-1 text-xs">Transaction {transactionId} · {transaction?.table_number || "Current room"}</p>
          </div>
          <button ref={closeRef} type="button" onClick={close} disabled={isSaving} aria-label="Close split bill"
            className="rounded-lg p-2 hover:bg-softPrimary disabled:opacity-50"><FiX size={20} /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <p className="text-sm">Choose the products and quantities for your friend's bill. They will move to a new transaction in the same room, with separate billing, payment and receipt.</p>
          <p className="rounded-lg border border-softPrimary bg-softPrimary/20 p-3 text-xs leading-relaxed">
            Saved extra charges stay on the original bill. Remove saved discounts before splitting, then apply discounts and review charges on each bill. Unsaved billing changes are not applied.
          </p>
          {error && <p role="alert" className="rounded-lg border border-redAccent p-3 text-sm text-redAccent">{error}</p>}
          {!isLoading && record?.can_split === false && <p role="alert" className="rounded-lg border border-redAccent p-3 text-sm text-redAccent">{record.reason || "This transaction cannot be split."}</p>}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-[Poppins-Medium]">Items on the original bill</p>
            <button type="button" onClick={() => setReload((value) => value + 1)} disabled={isLoading || isSaving}
              className="flex items-center gap-1.5 rounded-lg border border-softPrimary px-3 py-2 text-xs disabled:opacity-50"><FiRefreshCw /> Refresh items</button>
          </div>
          {isLoading ? <p role="status" className="py-8 text-center text-sm">Loading saved items…</p> : (
            <div className="space-y-2">
              {items.map((item) => {
                const id = String(item.ID);
                const checked = Object.prototype.hasOwnProperty.call(quantities, id);
                const name = getOrderItemDisplayName(item) || item.product_id;
                return (
                  <div key={id} className="flex flex-wrap items-center gap-3 rounded-xl border border-softPrimary p-3">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={checked} disabled={disabled} aria-label={`Move ${name}, item ${id}`}
                        className="mt-1 h-4 w-4 accent-[var(--color-brandPrimary)]"
                        onChange={(event) => setQuantities((current) => {
                          const next = { ...current };
                          if (event.target.checked) next[id] = String(item.sales_quantity);
                          else delete next[id];
                          return next;
                        })} />
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-[Poppins-Medium]">{name}</span>
                        {item.item_instruction && <span className="mt-0.5 block break-words text-xs">{item.item_instruction}</span>}
                        <span className="mt-1 block text-xs">{Number(item.sales_quantity)} available · ₱ {peso(item.selling_price)} each</span>
                      </span>
                    </label>
                    <label className="w-28 shrink-0 text-xs">Qty to move
                      <input type="number" min="0.0001" max={item.sales_quantity} step="0.0001" inputMode="decimal"
                        aria-label={`Quantity to move for ${name}, item ${id}`} value={checked ? quantities[id] : ""}
                        disabled={disabled || !checked}
                        onChange={(event) => setQuantities((current) => ({ ...current, [id]: event.target.value }))}
                        className="mt-1 w-full rounded-lg border border-softPrimary bg-softerPrimary px-2 py-2 text-sm disabled:opacity-40" />
                    </label>
                  </div>
                );
              })}
              {!items.length && record && <p className="py-5 text-center text-sm">No items are available to split.</p>}
            </div>
          )}
          {record && <div className="grid grid-cols-2 gap-3 rounded-xl border border-softPrimary p-4 text-sm">
            <div><p>Original bill items</p><p className="mt-1 font-[Poppins-SemiBold]">₱ {peso(selection.remainingSubtotal)}</p></div>
            <div><p>New bill items</p><p className="mt-1 font-[Poppins-SemiBold] text-colorBrand">₱ {peso(selection.movedSubtotal)}</p></div>
            <p className="col-span-2 text-xs">Item subtotals before discounts and extra charges.</p>
          </div>}
          {record?.can_split && selection.error && <p role="status" className="text-xs">{selection.error}</p>}
        </div>
        <footer className="flex gap-3 border-t border-softPrimary p-4">
          <button type="button" onClick={close} disabled={isSaving} className="flex-1 rounded-xl border border-softPrimary px-4 py-3 text-sm font-[Poppins-Medium] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={submit} disabled={disabled || Boolean(selection.error)}
            className="flex-1 rounded-xl bg-colorBrand px-4 py-3 text-sm font-[Poppins-SemiBold] text-colorBrandLighter disabled:cursor-not-allowed disabled:opacity-50">
            {isSaving ? "Splitting bill…" : "Create separate bill"}
          </button>
        </footer>
      </section>
    </div>
  );
}
