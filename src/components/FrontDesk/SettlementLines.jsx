/* eslint-disable react/prop-types */
import { FaPlus, FaTrash } from "react-icons/fa";
import { HOTEL_KIND, mopKind, peso, round2 } from "./frontDeskUtils";
import { fieldClass, fieldStyle, Muted } from "./FrontDeskUi";

export const emptyLine = (method = "") => ({
  payment_method: method,
  payment_amount: "",
  payment_reference: "",
});

export const linesTotal = (lines) =>
  round2((lines || []).reduce((sum, line) => sum + Number(line.payment_amount || 0), 0));

/** First problem with the lines, or "" when they can be sent. */
export const validateLines = (lines, modes) => {
  const used = (lines || []).filter((line) => line.payment_method || line.payment_amount);
  if (used.length === 0) return "Add at least one payment.";
  for (const line of used) {
    if (!line.payment_method) return "Select the mode of payment.";
    if (!(Number(line.payment_amount) !== 0)) return `Enter the amount for ${line.payment_method}.`;
    const kind = mopKind(modes, line.payment_method);
    const entry = modes.find((mode) => mode.mop === line.payment_method);
    if (kind === HOTEL_KIND.CITY_LEDGER && !line.payment_reference) {
      return "Select the company account for City Ledger.";
    }
    if (kind === "" && Number(entry?.reference_On_Off) === 1 && !String(line.payment_reference || "").trim()) {
      return `Enter the reference number for ${line.payment_method}.`;
    }
  }
  return "";
};

/**
 * Payment lines for a collection (folio payment / check-out / company payment).
 * modes: settlement modes from the API; accounts: active city ledger accounts.
 */
const SettlementLines = ({ lines, onChange, modes, accounts = [], allowCityLedger, target, disabled }) => {
  const usableModes = modes.filter(
    (mode) => allowCityLedger || mode.mop_kind !== HOTEL_KIND.CITY_LEDGER,
  );
  const total = linesTotal(lines);
  const remaining = round2(Number(target || 0) - total);

  const update = (index, patch) =>
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  return (
    <div className="space-y-2.5">
      {lines.map((line, index) => {
        const kind = mopKind(modes, line.payment_method);
        const entry = modes.find((mode) => mode.mop === line.payment_method);
        const needsRef = kind === "" && Number(entry?.reference_On_Off) === 1;
        return (
          <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_130px_1fr_auto] sm:items-center">
            <select
              value={line.payment_method}
              disabled={disabled}
              onChange={(e) => update(index, { payment_method: e.target.value, payment_reference: "" })}
              className={fieldClass}
              style={fieldStyle(false)}
              aria-label="Mode of payment"
            >
              <option value="">Mode of payment</option>
              {usableModes.map((mode) => (
                <option key={mode.mop} value={mode.mop}>
                  {mode.mop}
                </option>
              ))}
            </select>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={line.payment_amount}
              disabled={disabled}
              onChange={(e) => update(index, { payment_amount: e.target.value })}
              placeholder="0.00"
              className={`${fieldClass} text-right`}
              style={fieldStyle(false)}
              aria-label="Amount"
            />
            {kind === HOTEL_KIND.CITY_LEDGER ? (
              <select
                value={line.payment_reference}
                disabled={disabled}
                onChange={(e) => update(index, { payment_reference: e.target.value })}
                className={fieldClass}
                style={fieldStyle(!line.payment_reference)}
                aria-label="Company account"
              >
                <option value="">Company account</option>
                {accounts.map((account) => (
                  <option key={account.account_code} value={account.account_code}>
                    {account.company_name} ({account.account_code})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                maxLength={100}
                value={line.payment_reference}
                disabled={disabled}
                onChange={(e) => update(index, { payment_reference: e.target.value })}
                placeholder={needsRef ? "Reference (required)" : "Reference"}
                className={fieldClass}
                style={fieldStyle(needsRef && !line.payment_reference)}
                aria-label="Reference"
              />
            )}
            <button
              type="button"
              disabled={disabled || lines.length === 1}
              onClick={() => onChange(lines.filter((_, i) => i !== index))}
              className="justify-self-end rounded-lg border p-2.5 transition hover:opacity-80 disabled:opacity-30"
              style={{ borderColor: "var(--app-border)", color: "#be123c" }}
              aria-label="Remove payment line"
            >
              <FaTrash size={11} />
            </button>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...lines, emptyLine()])}
          className="inline-flex items-center gap-1.5 font-[Poppins-SemiBold] text-[12px] disabled:opacity-50"
          style={{ color: "var(--app-accent)" }}
        >
          <FaPlus size={10} /> Split payment
        </button>
        {target !== undefined ? (
          <Muted>
            Total {peso(total)} ·{" "}
            {Math.abs(remaining) < 0.005 ? (
              <span style={{ color: "#047857" }}>exact</span>
            ) : remaining > 0 ? (
              <>
                remaining {peso(remaining)}{" "}
                <button
                  type="button"
                  disabled={disabled}
                  className="font-[Poppins-SemiBold] underline"
                  style={{ color: "var(--app-accent)" }}
                  onClick={() => {
                    const index = lines.findIndex((line) => !line.payment_amount);
                    const at = index >= 0 ? index : lines.length - 1;
                    update(at, { payment_amount: String(round2(Number(lines[at].payment_amount || 0) + remaining)) });
                  }}
                >
                  fill
                </button>
              </>
            ) : (
              <span style={{ color: "#be123c" }}>over by {peso(-remaining)}</span>
            )}
          </Muted>
        ) : null}
      </div>
    </div>
  );
};

export default SettlementLines;
