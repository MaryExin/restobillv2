import React, { useEffect, useRef, useState } from "react";
import { FiCornerUpLeft, FiRefreshCw, FiX } from "react-icons/fi";
import { useCustomSecuredMutation } from "../../hooks/useCustomSecuredMutation";
import { getOrderItemDisplayName } from "../../utils/orderItemDisplayName";

const peso = (value) => Number(value || 0).toLocaleString("en-PH", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const readUnsplitPreview = async (response) => {
  const body = (await response.text()).replace(/^\uFEFF/, "").trim();
  const status = response.status >= 400 ? ` (HTTP ${response.status})` : "";
  if (!body) throw new Error(`Unable to load the split bill${status}: the server returned an empty response. Refresh details to try again.`);
  let data;
  try { data = JSON.parse(body); }
  catch { throw new Error(`Unable to load the split bill${status}: the server did not return valid billing data. Refresh details to try again.`); }
  if (!response.ok || data?.status !== "success") throw new Error(data?.message || `Unable to load the split bill${status}.`);
  return data;
};

export default function UnsplitBillModal({ transaction, apiHost, onClose, onSuccess }) {
  const [record, setRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [reload, setReload] = useState(0);
  const submitting = useRef(false);
  const closeRef = useRef(null);
  const endpoint = `${apiHost || ""}${import.meta.env.VITE_POS_UNSPLIT_BILL_ENDPOINT || "/api/unsplit_bill.php"}`;
  const { mutateAsync, isLoading: isSaving } = useCustomSecuredMutation(endpoint);
  const transactionId = transaction?.transaction_id;
  const categoryCode = transaction?.Category_Code || localStorage.getItem("posBusinessCategoryCode") || "";
  const unitCode = transaction?.Unit_Code || localStorage.getItem("posBusinessUnitCode") || "";

  useEffect(() => { closeRef.current?.focus(); }, []);

  useEffect(() => {
    const controller = new AbortController();
    setRecord(null);
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
      .then(readUnsplitPreview)
      .then((data) => {
        if (!data.transaction?.transaction_id || !Array.isArray(data.items)
          || (data.can_unsplit === true && (!data.source_transaction?.transaction_id || !data.snapshot_token))) {
          throw new Error("Incomplete split bill details. Refresh details to try again.");
        }
        if (!controller.signal.aborted) setRecord(data);
      })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message || "Unable to load the split bill."); })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => controller.abort();
  }, [apiHost, endpoint, transactionId, categoryCode, unitCode, reload]);

  const disabled = isSaving || isLoading || record?.can_unsplit !== true || needsRefresh;
  const close = () => { if (!submitting.current) onClose(); };
  const handleDialogKeyDown = (event) => {
    if (event.key === "Escape") { event.stopPropagation(); close(); }
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll("button:not(:disabled)")];
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && event.target === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && event.target === last) { event.preventDefault(); first.focus(); }
  };

  const submit = async () => {
    if (submitting.current || disabled || !record?.snapshot_token) return;
    submitting.current = true;
    setError("");
    try {
      const result = await mutateAsync({
        transaction_id: transactionId, Category_Code: categoryCode, Unit_Code: unitCode,
        snapshot_token: record.snapshot_token,
        user_id: localStorage.getItem("user_id") || "",
        user_name: localStorage.getItem("username") || transaction?.cashier || "System",
      });
      if (result?.status !== "success" || String(result.removed_transaction_id) !== String(transactionId)
        || !result.source_transaction?.transaction_id) {
        throw new Error(result?.message || "The unsplit could not be confirmed. Refresh details before trying again.");
      }
      onSuccess(result);
    } catch (failure) {
      setError(failure?.name === "SyntaxError"
        ? "The server did not confirm the unsplit. Refresh details to check the saved bills before trying again."
        : failure.message || "Unable to unsplit this bill. Refresh details before trying again.");
      setNeedsRefresh(true);
    } finally { submitting.current = false; }
  };

  return (
    <div className="fixed inset-0 z-[100100] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm font-[Poppins-Regular]">
      <section role="dialog" aria-modal="true" aria-labelledby="unsplit-bill-title" onKeyDown={handleDialogKeyDown}
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-softPrimary bg-medPrimary text-colorBrandLighter shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-softPrimary p-5">
          <div>
            <h2 id="unsplit-bill-title" className="flex items-center gap-2 text-lg font-[Poppins-SemiBold]"><FiCornerUpLeft /> Unsplit bill</h2>
            <p className="mt-1 text-xs">Split transaction {transactionId}</p>
          </div>
          <button ref={closeRef} type="button" aria-label="Close unsplit bill" onClick={close} disabled={isSaving}
            className="rounded-lg p-2 hover:bg-softPrimary disabled:opacity-50"><FiX size={20} /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <p className="text-sm">Return all products from this split bill to the original transaction and discard the separate unpaid bill.</p>
          {error && <p role="alert" className="rounded-lg border border-redAccent p-3 text-sm text-redAccent">{error}</p>}
          {!isLoading && record?.can_unsplit === false && <p role="alert" className="rounded-lg border border-redAccent p-3 text-sm text-redAccent">{record.reason || "This split bill cannot be undone."}</p>}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-[Poppins-Medium]">Products to return</p>
            <button type="button" onClick={() => setReload((value) => value + 1)} disabled={isLoading || isSaving}
              className="flex items-center gap-1.5 rounded-lg border border-softPrimary px-3 py-2 text-xs disabled:opacity-50"><FiRefreshCw /> Refresh details</button>
          </div>
          {isLoading ? <p role="status" className="py-8 text-center text-sm">Loading saved bills…</p> : record && (
            <>
              {record.source_transaction && <p className="rounded-lg border border-softPrimary p-3 text-sm">Original transaction: <strong className="font-[Poppins-SemiBold]">{record.source_transaction.transaction_id}</strong>
                {record.source_transaction.table_number && <span className="mt-1 block text-xs">{record.source_transaction.table_number}</span>}
              </p>}
              <div className="space-y-2">
                {record.items.map((item) => (
                  <div key={item.ID} className="flex items-start justify-between gap-3 rounded-xl border border-softPrimary p-3 text-sm">
                    <div className="min-w-0">
                      <p className="break-words font-[Poppins-Medium]">{getOrderItemDisplayName(item) || item.product_id}</p>
                      {item.item_instruction && <p className="mt-1 break-words text-xs">{item.item_instruction}</p>}
                      <p className="mt-1 text-xs">Qty {Number(item.sales_quantity)} · ₱ {peso(item.selling_price)} each</p>
                    </div>
                    <span className="shrink-0">₱ {peso(Number(item.sales_quantity) * Number(item.selling_price))}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs leading-relaxed">Both bills must still be unpaid. Only saved changes are included. Review and reprint the original bill after unsplitting.</p>
            </>
          )}
        </div>
        <footer className="flex gap-3 border-t border-softPrimary p-4">
          <button type="button" onClick={close} disabled={isSaving} className="flex-1 rounded-xl border border-softPrimary px-4 py-3 text-sm font-[Poppins-Medium] disabled:opacity-50">Keep split bill</button>
          <button type="button" onClick={submit} disabled={disabled}
            className="flex-1 rounded-xl bg-colorBrand px-4 py-3 text-sm font-[Poppins-SemiBold] text-colorBrandLighter disabled:cursor-not-allowed disabled:opacity-50">
            {isSaving ? "Unsplitting bill…" : "Unsplit bill"}
          </button>
        </footer>
      </section>
    </div>
  );
}
