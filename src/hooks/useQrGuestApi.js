export async function requestQrGuest(action, { params, body, signal } = {}) {
  const query = new URLSearchParams(params || {}).toString();
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 15000);
  try {
    const response = await fetch(`/qr-api/${action}${query ? `?${query}` : ""}`, {
      method: body ? "POST" : "GET",
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("The ordering server did not respond. Stay on the restaurant Wi-Fi and try again.");
    }
    if (!response.ok || result.success !== true) {
      const error = new Error(result.message || "Ordering is temporarily unavailable. Please ask a member of staff.");
      error.status = response.status;
      error.code = result.code;
      throw error;
    }
    return result.data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The connection timed out. Stay on the restaurant Wi-Fi and try again.");
    if (error instanceof TypeError) throw new Error("Connection lost. Stay on the restaurant Wi-Fi and try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
import { getQrContinuationProof, mergeQrReceiptUpdates } from "../utils/qrOrderDraft.js";


export async function refreshQrGuestMenu(draft, { signal, refreshPending = false, request = requestQrGuest } = {}) {
  let updates = [];
  if (refreshPending) {
    // The first QR order may have been accepted since the last status poll.
    // Verify it before requesting permission to continue an occupied table.
    updates = await Promise.all((draft.history || []).filter((order) => order.receipt.status === "pending")
      .map((order) => request("status", { params: { order_id: order.receipt.order_id, tracking_token: order.receipt.tracking_token }, signal })));
  }
  const history = mergeQrReceiptUpdates(draft.history || [], updates);
  const data = await request("menu", { params: { order_type: draft.order_type, ...getQrContinuationProof({ ...draft, history }) }, signal });
  if (!Array.isArray(data?.products) || !Array.isArray(data?.tables) || !Array.isArray(data?.order_types)) {
    throw new Error("The menu could not be loaded. Please ask a member of staff.");
  }
  return { data, updates, history: mergeQrReceiptUpdates(history, [], data.continuation) };
}
