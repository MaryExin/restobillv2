/**
 * Audit Trail — fire-and-forget activity logger.
 *
 * Writes to tbl_main_activity_logs via /api/pos_activity_logs.php.
 * Never throws — logging must never interrupt the main user flow.
 *
 * Usage:
 *   import { logActivity, LOG } from "../utils/logActivity";
 *
 *   // minimal
 *   logActivity(LOG.PAYMENT, "PROCESS PAYMENT", { transaction_id: 1000000099, amount: 450 });
 *
 *   // with branch context (pass when available)
 *   logActivity(LOG.VOID, "VOID TRANSACTION", { transaction_id: id }, { categoryCode, unitCode });
 */

import useZustandLoginCred from "../context/useZustandLoginCred";
import useZustandIMSBusunitCode from "../context/useZustandIMSBusunitCode";

// ── Activity type constants (type_of_activity column) ────────────────────────
export const LOG = Object.freeze({
  ORDER:       "POS ORDER",    // Creating orders, adding items to cart
  BILLING:     "POS BILLING",  // Printing / viewing bill statements
  PAYMENT:     "POS PAYMENT",  // Processing transactions, checkout
  VOID:        "POS VOID",     // Voiding items or orders
  REFUND:      "POS REFUND",   // Processing refunds
  SAVE:        "POS SETTINGS", // Settings updates, config saves, business info
  VIEW_REPORT: "POS REPORT",   // Viewing sales records, Z-reading, summaries
  EDIT:        "POS DATA",     // Modifying products, inventory, records
  DELETE:      "POS DATA",     // Deleting records or database items
  SHIFT:       "POS SHIFT",    // Opening / closing a shift
});

// ── Internal helpers ──────────────────────────────────────────────────────────

async function resolveApiHost() {
  try {
    if (window.appConfig?.getApiHost) {
      const host = await window.appConfig.getApiHost();
      return String(host || "").trim().replace(/\/+$/, "");
    }
    const res = await fetch("./ip.txt", { cache: "no-store" });
    return (await res.text()).trim().replace(/\/+$/, "");
  } catch {
    return "http://localhost";
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @param {string} typeOfActivity   - One of the LOG.* constants (type_of_activity)
 * @param {string} activityPerformed - Short verb phrase, e.g. "SAVE ORDER", "VOID TRANSACTION"
 * @param {object} [metadata={}]    - Any extra key/value pairs stored as JSON in values_of_data
 * @param {object} [ctx={}]         - Optional override: { categoryCode, unitCode }
 *
 * ctx values fall back to the active Zustand branch store when omitted.
 */
export async function logActivity(
  typeOfActivity,
  activityPerformed,
  metadata = {},
  ctx = {},
) {
  try {
    const { userId, firstName }            = useZustandLoginCred.getState();
    const { imsBusunitClass, imsBusunitCodeSelected } = useZustandIMSBusunitCode.getState();

    const categoryCode = ctx.categoryCode || imsBusunitClass          || "";
    const unitCode     = ctx.unitCode     || imsBusunitCodeSelected   || "0";

    const apiHost = await resolveApiHost();

    const valuesOfData = JSON.stringify({
      ...metadata,
      _logged_by: firstName || userId || "",
    });

    await fetch(`${apiHost}/api/pos_activity_logs.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_code:      categoryCode,
        unit_code:          unitCode,
        user_id:            userId            || "",
        user_name:          firstName         || "",
        type_of_activity:   typeOfActivity    || "",
        activity_performed: activityPerformed || "",
        values_of_data:     valuesOfData,
      }),
    });
  } catch {
    // Intentionally silent — logging must never break the main flow
  }
}
