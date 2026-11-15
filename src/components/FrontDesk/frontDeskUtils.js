import { printWithPdfFallback } from "../../utils/printWithPdfFallback.js";

// Shared helpers for the hotel front desk (in-house guests, Charge to Room,
// City Ledger, Complimentary). Backend: backend/api/pos_front_desk.php and
// backend/api/pos_hotel_ledger.php.

export const HOTEL_KIND = {
  ROOM_CHARGE: "ROOM_CHARGE",
  CITY_LEDGER: "CITY_LEDGER",
  COMPLIMENTARY: "COMPLIMENTARY",
};

export const COMP_TYPES = ["Guest Comp", "Officer's Check", "Staff Meal", "Management"];

export const frontDeskEndpoint = (apiHost) =>
  `${apiHost || ""}${import.meta.env.VITE_POS_FRONT_DESK_ENDPOINT || "/api/pos_front_desk.php"}`;

const authHeaders = (headers = {}) => {
  const next = { ...headers };
  const token = localStorage.getItem("access_token");
  if (token) next.Authorization = `Bearer ${token}`;
  return next;
};

/** GET pos_front_desk.php?view=...; throws with the server message on failure. */
export const frontDeskGet = async (apiHost, params) => {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${frontDeskEndpoint(apiHost)}?${query}`, {
    headers: authHeaders(),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || "Unable to load front desk data.");
  }
  return result.data;
};

/** POST {action, ...}; returns {message, data}; throws with the server message. */
export const frontDeskPost = async (apiHost, body) => {
  const response = await fetch(frontDeskEndpoint(apiHost), {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || "Unable to save.");
  }
  return { message: result.message || "Saved.", data: result.data };
};

/** The hotel kind of a mode of payment row ("" for ordinary modes). */
export const mopKind = (modes, method) => {
  const wanted = String(method || "").trim().toLowerCase();
  const entry = (Array.isArray(modes) ? modes : []).find(
    (mode) => String(mode?.mop || "").trim().toLowerCase() === wanted,
  );
  return String(entry?.mop_kind || "").trim().toUpperCase();
};

export const peso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

const pad = (value) => String(value).padStart(2, "0");

export const todayKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** "2026-11-15 18:16:40" -> "Nov 15, 2026 6:16 PM" */
export const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

/** Nights between check-in and today (or check-out), at least 1. */
export const nightsStayed = (checkInAt, checkOutAt) => {
  const start = new Date(String(checkInAt || "").replace(" ", "T"));
  const end = checkOutAt ? new Date(String(checkOutAt).replace(" ", "T")) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(1, Math.round((endDay - startDay) / 86400000));
};

/** Browser print of an HTML document (no Electron bridge: browser preview / dev). */
const printHtmlInFrame = (html) => {
  if (!html) return;
  const frame = document.createElement("iframe");
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } finally {
      setTimeout(() => frame.remove(), 1000);
    }
  }, 250);
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Prints a guest folio or a city ledger statement through a hidden iframe.
 * header: { title, lines: [[label, value]] }; charges / collections from the API.
 */
const buildLedgerHtml = ({ businessName, title, lines, charges, collections, balance }) => {
  const chargeRows = (charges || [])
    .filter((row) => row.status === "Active")
    .map(
      (row) => `<tr><td>${escapeHtml(formatDateTime(row.charged_at))}</td><td>${escapeHtml(row.description)}</td><td class="r">${escapeHtml(peso(row.amount))}</td></tr>`,
    )
    .join("");
  const collectionRows = (collections || [])
    .filter((row) => row.status === "Active")
    .map(
      (row) => `<tr><td>${escapeHtml(formatDateTime(row.collected_at))}</td><td>${escapeHtml(`${row.collection_no} · ${row.payment_method}${row.payment_reference ? ` (${row.payment_reference})` : ""}`)}</td><td class="r">${escapeHtml(peso(row.payment_amount))}</td></tr>`,
    )
    .join("");
  const totalCharges = (charges || []).filter((r) => r.status === "Active").reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalPaid = (collections || []).filter((r) => r.status === "Active").reduce((s, r) => s + Number(r.payment_amount || 0), 0);

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;margin:24px}
  h1{font-size:16px;margin:0 0 2px} h2{font-size:13px;margin:16px 0 6px}
  .muted{color:#555} table{width:100%;border-collapse:collapse} td,th{padding:4px 6px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}
  .r{text-align:right;white-space:nowrap} .total td{font-weight:bold;border-top:2px solid #111}
  .info td{border:none;padding:1px 6px 1px 0}
</style></head><body>
<h1>${escapeHtml(businessName || "")}</h1>
<div class="muted">${escapeHtml(title)} · printed ${escapeHtml(formatDateTime(new Date().toISOString().slice(0, 19).replace("T", " ")))}</div>
<table class="info" style="margin-top:10px">${(lines || []).map(([label, value]) => `<tr><td class="muted">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join("")}</table>
<h2>Charges</h2>
<table><tr><th>Date</th><th>Description</th><th class="r">Amount</th></tr>${chargeRows || '<tr><td colspan="3" class="muted">No charges</td></tr>'}
<tr class="total"><td colspan="2">Total charges</td><td class="r">${escapeHtml(peso(totalCharges))}</td></tr></table>
<h2>Payments</h2>
<table><tr><th>Date</th><th>Collection</th><th class="r">Amount</th></tr>${collectionRows || '<tr><td colspan="3" class="muted">No payments</td></tr>'}
<tr class="total"><td colspan="2">Total payments</td><td class="r">${escapeHtml(peso(totalPaid))}</td></tr></table>
<h2 class="r">Balance: ${escapeHtml(peso(balance))}</h2>
<p class="muted" style="margin-top:40px">Guest / Authorized signature: ______________________________</p>
</body></html>`;

  return html;
};

// ---------------------------------------------------------------------------
// Night audit: each room night is a real POS invoice (VAT-inclusive, 12%)
// paid with Charge to Room, so it shows in the X / Z readings and BIR sales.
// It goes through the same endpoints as the ordering + payment screens.
// ---------------------------------------------------------------------------

const posScope = () => ({
  categoryCode: localStorage.getItem("posBusinessCategoryCode") || "",
  unitCode: localStorage.getItem("posBusinessUnitCode") || "",
  terminalNumber: localStorage.getItem("posTerminalNumber") || "",
  cashier: localStorage.getItem("username") || localStorage.getItem("Cashier") || "Store Crew",
  userId: localStorage.getItem("user_id") || "0",
  email: localStorage.getItem("email") || "Store Crew",
});

/** Business date of the open shift (YYYY-MM-DD); throws when the day is not open. */
export const getBusinessDate = async (apiHost) => {
  const scope = posScope();
  const response = await fetch(`${apiHost}/api/get_open_shift_date.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Category_Code: scope.categoryCode,
      Unit_Code: scope.unitCode,
      terminal_number: scope.terminalNumber,
    }),
  });
  const data = await response.json().catch(() => ({}));
  const date = String(data?.selectedDate || data?.shiftDate || "").slice(0, 10);
  if (!response.ok || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Open the day (shift) first: room charges are invoiced on the open business date.");
  }
  return date;
};

/**
 * Posts one room night: creates the order (save_order.php) and pays it with
 * Charge to Room (pos_payment_post_transaction.php, room_night prevents
 * double posting). Returns the invoice number.
 */
export const postRoomNight = async (apiHost, { stay, serviceDate, businessDate, product, roomChargeMop }) => {
  const scope = posScope();
  const amount = round2(stay.room_rate);
  if (!(amount > 0)) throw new Error(`${stay.room_name} has no room rate.`);
  if (!roomChargeMop) throw new Error("Turn on Charge to Room in Settings › Mode of Payment.");
  const nightLabel = formatDate(serviceDate);

  const form = new FormData();
  const fields = {
    transaction_id: Date.now(),
    Category_Code: scope.categoryCode,
    Unit_Code: scope.unitCode,
    transaction_type: "PRODUCT",
    transaction_date: businessDate,
    transaction_time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
    terminal_number: scope.terminalNumber,
    table_number: stay.room_name,
    order_type: product.order_type,
    customer_head_count: Math.max(1, Number(stay.guest_count) || 1),
    guest_name: stay.guest_name,
    guest_contact: stay.guest_contact || "",
    guest_request: `Room night ${nightLabel} · Folio ${stay.folio_no}`,
    guest_payment_mode: roomChargeMop,
    guest_payment_reference: stay.folio_no,
    guest_payment_amount: "",
    discount_type: "",
    payment_method: "",
    special_instructions: `Room night ${nightLabel} · Folio ${stay.folio_no}`,
    cashier: scope.cashier,
    user_id: scope.userId,
    user_name: scope.email,
    remarks: "Pending for Payment",
    order_status: "Pending",
    status: "Active",
    void_date: "",
    refund_date: "",
    cart_items: JSON.stringify([
      {
        product_id: product.product_id,
        sku: product.product_id,
        sales_quantity: 1,
        landing_cost: 0,
        unit_cost: 0,
        selling_price: amount,
        vatable: "Yes",
        isDiscountable: "No",
        order_status: "ACTIVE",
        item_instruction: "",
      },
    ]),
  };
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));

  const saveResponse = await fetch(`${apiHost}/api/save_order.php`, { method: "POST", body: form });
  const saved = await saveResponse.json().catch(() => ({}));
  const transactionId = saved?.transaction_id || saved?.data?.transaction_id;
  if (!saveResponse.ok || String(saved?.status || "").toLowerCase() === "error" || !transactionId) {
    throw new Error(saved?.message || `Could not create the room invoice for ${stay.room_name}.`);
  }

  const vatable = round2(amount / 1.12);
  const payResponse = await fetch(`${apiHost}/api/pos_payment_post_transaction.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction_id: transactionId,
      category_code: scope.categoryCode,
      unit_code: scope.unitCode,
      terminal_number: scope.terminalNumber,
      cashier: scope.cashier,
      user_name: scope.cashier,
      // No cart_items: the server checks the total against the saved bill item.
      discount_type: "No Discount",
      customer_head_count: Math.max(1, Number(stay.guest_count) || 1),
      customer_count_for_discount: 0,
      TotalSales: amount,
      Discount: 0,
      OtherCharges: 0,
      TotalAmountDue: amount,
      VATableSales: vatable,
      VATableSales_VAT: round2(amount - vatable),
      VATExemptSales: 0,
      VATExemptSales_VAT: 0,
      VATZeroRatedSales: 0,
      payment_amount: amount,
      payment_method: roomChargeMop,
      change_amount: 0,
      short_over: 0,
      payments: [{ payment_method: roomChargeMop, payment_amount: amount, payment_reference: stay.folio_no }],
      other_charges: [],
      room_night: { folio_no: stay.folio_no, service_date: serviceDate },
    }),
  });
  const paid = await payResponse.json().catch(() => ({}));
  if (!payResponse.ok || !paid?.success) {
    throw new Error(
      `${stay.room_name} ${nightLabel}: ${paid?.message || "payment failed"}. ` +
        `The order was saved as a pending bill on ${stay.room_name}; pay or void it from Payment.`,
    );
  }
  return paid.invoice_no;
};

/** Prints a collection receipt (CR) from its payment lines (same collection_no). */
const buildCollectionReceiptHtml = ({ businessName, lines, forLabel }) => {
  const active = (lines || []).filter(Boolean);
  if (!active.length) return "";
  const first = active[0];
  const total = active.reduce((sum, row) => sum + Number(row.payment_amount || 0), 0);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(first.collection_no)}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;margin:24px;max-width:420px}
h1{font-size:15px;margin:0}h2{font-size:14px;margin:12px 0 4px}table{width:100%;border-collapse:collapse}
td{padding:3px 0;border-bottom:1px dashed #ccc}.r{text-align:right}.muted{color:#555}.total td{font-weight:bold;border-top:2px solid #111;border-bottom:none}</style>
</head><body>
<h1>${escapeHtml(businessName || "")}</h1>
<h2>COLLECTION RECEIPT ${escapeHtml(first.collection_no)}</h2>
<div class="muted">${escapeHtml(formatDateTime(first.collected_at))}${first.status && first.status !== "Active" ? ` · ${escapeHtml(first.status.toUpperCase())}` : ""}</div>
<p>Received from: <b>${escapeHtml(forLabel || "")}</b></p>
<table>${active.map((row) => `<tr><td>${escapeHtml(row.payment_method)}${row.payment_reference ? ` (${escapeHtml(row.payment_reference)})` : ""}</td><td class="r">${escapeHtml(peso(row.payment_amount))}</td></tr>`).join("")}
<tr class="total"><td>Total</td><td class="r">${escapeHtml(peso(total))}</td></tr></table>
${first.remarks ? `<p class="muted">${escapeHtml(first.remarks)}</p>` : ""}
<p class="muted">Received by: ${escapeHtml(first.cashier || "")}</p>
<p class="muted" style="margin-top:28px">This is not an official receipt / sales invoice.</p>
</body></html>`;
  return html;
};

/** Group collection rows by collection number (one receipt each). */
export const groupCollections = (rows) => {
  const map = new Map();
  (rows || []).forEach((row) => {
    if (!map.has(row.collection_no)) map.set(row.collection_no, []);
    map.get(row.collection_no).push(row);
  });
  return [...map.entries()].map(([collectionNo, lines]) => ({ collectionNo, lines }));
};

// ---------------------------------------------------------------------------
// Printing: ESC/POS on the receipt printer (Electron, print-escpos-front-desk).
// The HTML versions above are only used when there is no Electron bridge
// (browser preview / dev), since then there is no printer to send to.
// ---------------------------------------------------------------------------

const amount = (value) =>
  Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * ESC/POS on the receipt printer; when no printer answers, the same document
 * is saved as a PDF (printWithPdfFallback, like the receipts).
 */
const sendEscPos = async (doc, buildHtml, fileName) => {
  const result = await printWithPdfFallback({
    attempt: () => window.electronAPI.printEscPosFrontDesk(doc),
    buildFallbackHtml: buildHtml,
    fileName,
  });
  if (result?.success || result?.canceled) return result;
  throw new Error(
    result?.pdfFallbackError || result?.message || result?.originalMessage || "Printing failed. Check the receipt printer.",
  );
};

const hasEscPos = () => typeof window !== "undefined" && Boolean(window.electronAPI?.printEscPosFrontDesk);

/** Guest folio / city ledger statement. Resolves when printed; rejects with the printer error. */
export const printLedger = async ({ businessName, title, lines, charges, collections, balance }) => {
  const buildHtml = () => buildLedgerHtml({ businessName, title, lines, charges, collections, balance });
  if (!hasEscPos()) return printHtmlInFrame(buildHtml());
  const activeCharges = (charges || []).filter((row) => row.status === "Active");
  const activePayments = (collections || []).filter((row) => row.status === "Active");
  return sendEscPos({
    title: String(title || "").toUpperCase(),
    subtitle: `Printed ${formatDateTime(new Date().toISOString().slice(0, 19).replace("T", " "))}`,
    infoRows: lines || [],
    sections: [
      {
        title: "CHARGES",
        emptyText: "No charges",
        rows: activeCharges.map((row) => [`${formatDate(row.charged_at)} ${row.description}`, amount(row.amount)]),
        total: ["Total charges", amount(activeCharges.reduce((sum, row) => sum + Number(row.amount || 0), 0))],
      },
      {
        title: "PAYMENTS",
        emptyText: "No payments",
        rows: activePayments.map((row) => [
          `${formatDate(row.collected_at)} ${row.collection_no} ${row.payment_method}${row.payment_reference ? ` (${row.payment_reference})` : ""}`,
          amount(row.payment_amount),
        ]),
        total: ["Total payments", amount(activePayments.reduce((sum, row) => sum + Number(row.payment_amount || 0), 0))],
      },
    ],
    highlight: ["BALANCE", amount(balance)],
    signature: true,
    signatureLabel: "Guest / Authorized signature",
  }, buildHtml, `${String(title || "folio").replace(/[^A-Za-z0-9-]+/g, "_")}.pdf`);
};

/** Collection receipt (all lines of one collection number). */
export const printCollectionReceipt = async ({ businessName, lines, forLabel }) => {
  const rows = (lines || []).filter(Boolean);
  if (!rows.length) return undefined;
  const buildHtml = () => buildCollectionReceiptHtml({ businessName, lines: rows, forLabel });
  if (!hasEscPos()) return printHtmlInFrame(buildHtml());
  const first = rows[0];
  const total = rows.reduce((sum, row) => sum + Number(row.payment_amount || 0), 0);
  return sendEscPos({
    title: `COLLECTION RECEIPT ${first.collection_no}`,
    subtitle: first.status && first.status !== "Active" ? `*** ${String(first.status).toUpperCase()} ***` : "",
    infoRows: [
      ["Date", formatDateTime(first.collected_at)],
      ["Received from", forLabel || ""],
      ["Received by", first.cashier || ""],
      ...(first.void_reason ? [["Void reason", first.void_reason]] : []),
    ],
    sections: [
      {
        title: "PAYMENT",
        rows: rows.map((row) => [
          `${row.payment_method}${row.payment_reference ? ` (${row.payment_reference})` : ""}`,
          amount(row.payment_amount),
        ]),
      },
    ],
    highlight: ["TOTAL RECEIVED", amount(total)],
    notes: [first.remarks ? `Remarks: ${first.remarks}` : "", "This is not an official receipt / sales invoice."].filter(Boolean),
    signature: true,
    signatureLabel: "Received by",
  }, buildHtml, `${rows[0].collection_no}.pdf`);
};

/** Runs a print and shows the printer error, if any. */
export const runPrint = (promise) =>
  Promise.resolve(promise).catch((err) => {
    window.alert(err?.message || "Printing failed.");
  });
