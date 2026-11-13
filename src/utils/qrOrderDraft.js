import { calculateServiceChargeBase } from "./serviceChargeMath.js";

export function getQrContinuationProof(draft) {
  if (draft.order_type !== "DINE IN") return {};
  const previous = [...(draft.history || [])].reverse().find((order) =>
    order.order_type === "DINE IN" && order.table_number === draft.table_number &&
    order.receipt?.status === "accepted" && order.receipt.order_id && order.receipt.tracking_token,
  );
  return previous ? {
    continuation_order_id: previous.receipt.order_id,
    continuation_tracking_token: previous.receipt.tracking_token,
  } : {};
}

export function canUseQrTable(catalog, orderType, tableNumber) {
  if (orderType !== "DINE IN") return true;
  const table = catalog?.tables?.find((row) => row.table_name === tableNumber);
  // Availability and continuation are server decisions; saved table names grant no access.
  return table?.available === true || table?.can_continue === true;
}

const settledState = (state) => state === "paid" || state === "closed";

export function mergeQrReceiptUpdates(history, updates = [], continuation = null) {
  const byOrder = new Map(updates.map((receipt) => [receipt.order_id, receipt]));
  if (continuation) {
    const existing = byOrder.get(continuation.order_id) || {};
    byOrder.set(continuation.order_id, { ...existing, transaction_state: continuation.transaction_state, can_continue: continuation.can_continue });
  }
  const merged = history.map((order) => {
    const update = byOrder.get(order.receipt.order_id);
    if (!update || (order.receipt.status !== "pending" && update.status === "pending")) return order;
    const receipt = { ...order.receipt, ...update };
    // Ignore an older in-flight read which arrives after the bill was settled.
    if (settledState(order.receipt.transaction_state) && !settledState(receipt.transaction_state)) {
      receipt.transaction_state = order.receipt.transaction_state;
      receipt.can_continue = false;
    }
    return { ...order, receipt };
  });
  const transactionStates = new Map(merged.filter((order) => order.receipt.status === "accepted" && order.receipt.transaction_id && settledState(order.receipt.transaction_state))
    .map((order) => [String(order.receipt.transaction_id), order.receipt.transaction_state]));
  return merged.map((order) => transactionStates.has(String(order.receipt.transaction_id)) && order.receipt.status === "accepted"
    ? { ...order, receipt: { ...order.receipt, transaction_state: transactionStates.get(String(order.receipt.transaction_id)), can_continue: false } }
    : order);
}

export function qrRunningTotal(history) {
  return history.filter((order) => order.receipt.status !== "rejected" && !settledState(order.receipt.transaction_state))
    .reduce((total, order) => total + Number(order.receipt.total_amount || 0), 0);
}

export function qrReceiptsToRefresh(history) {
  const records = new Map();
  for (const order of history) {
    const receipt = order.receipt;
    if (receipt.status === "pending") records.set(`order:${receipt.order_id}`, receipt);
    else if (receipt.status === "accepted" && !settledState(receipt.transaction_state)) {
      // One receipt tracks a shared bill; do not poll every additional order separately.
      records.set(`transaction:${receipt.transaction_id || receipt.order_id}`, receipt);
    }
  }
  return [...records.values()];
}

export function estimateQrTotals(items, products, serviceCharge) {
  const catalog = new Map(products.map((product) => [product.product_id, product]));
  const lines = items.map((item) => ({ ...catalog.get(item.product_id), sales_quantity: item.quantity }));
  const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
  const subtotal = round(lines.reduce((total, item) => total + round(Number(item.selling_price || 0) * item.sales_quantity), 0));
  const base = calculateServiceChargeBase({ basis: serviceCharge?.basis, items: lines, grossTotal: subtotal });
  const charges = items.length && serviceCharge?.enabled ? (serviceCharge.charges || []).map((charge) => ({
    particulars: charge.particulars,
    rate_type: charge.rate_type,
    rate: Number(charge.amount),
    amount: round(charge.rate_type === "Percentage" ? base * Number(charge.amount) / 100 : Number(charge.amount)),
  })) : [];
  const serviceAmount = round(charges.reduce((total, charge) => total + charge.amount, 0));
  return { subtotal, charges, serviceAmount, total: round(subtotal + serviceAmount) };
}

// randomUUID is unavailable on many phones over LAN HTTP; getRandomValues works there.
export function createQrRequestId(cryptoSource = globalThis.crypto) {
  if (cryptoSource?.randomUUID) return cryptoSource.randomUUID();
  if (!cryptoSource?.getRandomValues) throw new Error("This browser cannot safely submit orders. Please use a current browser.");
  const bytes = cryptoSource.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function prepareQrSubmission(draft, existingAttempt, createId = createQrRequestId) {
  // Keep the exact payload after a timeout, even if catalog prices change meanwhile.
  if (existingAttempt) return existingAttempt;
  return {
    request_id: createId(),
    order_type: draft.order_type,
    table_number: draft.order_type === "DINE IN" ? draft.table_number : "",
    customer_name: draft.customer_name.trim(),
    customer_head_count: Number(draft.customer_head_count),
    notes: draft.notes.trim(),
    ...getQrContinuationProof(draft),
    items: draft.items.map(({ product_id, quantity, item_instruction }) => ({
      product_id,
      quantity,
      item_instruction: String(item_instruction || "").trim(),
    })),
  };
}

export function readQrDraft(storage, key, table = "") {
  const empty = { order_type: "DINE IN", table_number: table, customer_name: "", customer_head_count: 1, notes: "", items: [], attempt: null, history: [], stage: "welcome" };
  try {
    const saved = JSON.parse(storage.getItem(key));
    if (!saved || !Array.isArray(saved.items)) return empty;
    const history = Array.isArray(saved.history) ? saved.history.filter((order) => order?.receipt?.order_id && order.receipt.tracking_token && Array.isArray(order.items)) : [];
    return {
      ...empty,
      ...saved,
      history,
      stage: saved.attempt ? "review" : ["welcome", "menu", "review", "orders"].includes(saved.stage) ? saved.stage : "welcome",
      items: saved.items.filter((item) => typeof item?.product_id === "string" && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99),
    };
  } catch {
    return empty;
  }
}

export function writeQrDraft(storage, key, draft) {
  try {
    storage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}
