/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { COMP_TYPES, HOTEL_KIND, frontDeskGet, mopKind, peso } from "./frontDeskUtils";

// Payment screen pieces for the hotel modes of payment:
//   Charge to Room  -> pick the in-house guest (reference = folio no.)
//   City Ledger     -> pick the company account (reference = account code)
//   Complimentary   -> type, reason and an approving admin + password
// The backend (pos_payment_post_transaction.php + pos_hotel_ledger.php)
// checks all of these again.

export const EMPTY_COMPLIMENTARY = { comp_type: "", reason: "", approver_id: "", approver_password: "" };

export const hotelKindOf = mopKind;

export const usesHotelModes = (payments, modes) =>
  (payments || []).some((row) => mopKind(modes, row.payment_method) !== "");

export const usesComplimentary = (payments, modes) =>
  (payments || []).some((row) => mopKind(modes, row.payment_method) === HOTEL_KIND.COMPLIMENTARY);

/** First missing hotel detail on the payment rows, or "". */
export const hotelPaymentProblem = (payments, modes, complimentary) => {
  for (const row of payments || []) {
    const kind = mopKind(modes, row.payment_method);
    if (kind === HOTEL_KIND.ROOM_CHARGE && !row.payment_reference) return "Select the in-house guest for Charge to Room.";
    if (kind === HOTEL_KIND.CITY_LEDGER && !row.payment_reference) return "Select the company account for City Ledger.";
  }
  if (usesComplimentary(payments, modes)) {
    if (!complimentary?.comp_type) return "Select the complimentary type.";
    if (String(complimentary?.reason || "").trim().length < 3) return "Enter the reason for the complimentary.";
    if (!complimentary?.approver_id || !complimentary?.approver_password) return "Complimentary needs an admin's approval.";
  }
  return "";
};

/** In-house guests, company accounts and approvers; loaded only when a hotel mode is used. */
export const useHotelPaymentData = (apiHost, enabled) => {
  const [data, setData] = useState({ inHouse: [], accounts: [], approvers: [], loading: false, error: "" });
  useEffect(() => {
    if (!enabled || !apiHost) return undefined;
    let cancelled = false;
    setData((prev) => ({ ...prev, loading: true, error: "" }));
    Promise.all([
      frontDeskGet(apiHost, { view: "in_house" }),
      frontDeskGet(apiHost, { view: "approvers" }).catch(() => []),
    ])
      .then(([house, approvers]) => {
        if (cancelled) return;
        setData({
          inHouse: house?.in_house || [],
          accounts: house?.accounts || [],
          approvers: Array.isArray(approvers) ? approvers : [],
          loading: false,
          error: "",
        });
      })
      .catch((err) => {
        if (!cancelled) setData((prev) => ({ ...prev, loading: false, error: err.message }));
      });
    return () => {
      cancelled = true;
    };
  }, [apiHost, enabled]);
  return data;
};

/** Replaces the Reference input for a hotel mode of payment. */
export const HotelReferenceField = ({ kind, row, onReference, data, complimentary, setComplimentary, inputClass, invalidClass, disabled }) => {
  const missing = !row.payment_reference;
  const className = `h-12 w-full rounded-2xl px-4 text-sm outline-none ${missing ? invalidClass : inputClass}`;
  const label = (text) => (
    <label className={`mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] ${missing ? "text-red-500" : "text-slate-500"}`}>
      {text} <span className="text-red-500">*</span>
    </label>
  );

  if (kind === HOTEL_KIND.ROOM_CHARGE) {
    return (
      <>
        {label("In-house guest")}
        <select value={row.payment_reference || ""} disabled={disabled} onChange={(e) => onReference(e.target.value)} onClick={(e) => e.stopPropagation()} className={className}>
          <option value="">{data.loading ? "Loading guests…" : data.inHouse.length ? "Select room / guest" : "No checked-in guests"}</option>
          {data.inHouse.map((stay) => (
            <option key={stay.folio_no} value={stay.folio_no}>
              {stay.room_name} · {stay.guest_name} ({stay.folio_no}) · bal {peso(stay.balance)}
            </option>
          ))}
        </select>
        {data.error ? <p className="mt-1 text-[10px] font-bold text-red-500">{data.error}</p> : null}
      </>
    );
  }

  if (kind === HOTEL_KIND.CITY_LEDGER) {
    return (
      <>
        {label("Company account")}
        <select value={row.payment_reference || ""} disabled={disabled} onChange={(e) => onReference(e.target.value)} onClick={(e) => e.stopPropagation()} className={className}>
          <option value="">{data.loading ? "Loading accounts…" : data.accounts.length ? "Select company" : "No company accounts (Front Desk › City Ledger)"}</option>
          {data.accounts.map((account) => (
            <option key={account.account_code} value={account.account_code}>
              {account.company_name} ({account.account_code}) · bal {peso(account.balance)}
            </option>
          ))}
        </select>
        {data.error ? <p className="mt-1 text-[10px] font-bold text-red-500">{data.error}</p> : null}
      </>
    );
  }

  // Complimentary: the type is the row's reference; reason + approval below the row.
  return (
    <>
      {label("Complimentary type")}
      <select
        value={row.payment_reference || ""}
        disabled={disabled}
        onChange={(e) => {
          onReference(e.target.value);
          setComplimentary((prev) => ({ ...prev, comp_type: e.target.value }));
        }}
        onClick={(e) => e.stopPropagation()}
        className={className}
      >
        <option value="">Select type</option>
        {COMP_TYPES.map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
    </>
  );
};

/** Reason + approving admin for a Complimentary payment row. */
export const ComplimentaryApproval = ({ data, complimentary, setComplimentary, inputClass, disabled }) => {
  const set = (key) => (e) => setComplimentary((prev) => ({ ...prev, [key]: e.target.value }));
  const cls = `h-12 w-full rounded-2xl px-4 text-sm outline-none ${inputClass}`;
  return (
    <div className="grid gap-3 md:grid-cols-3" onClick={(e) => e.stopPropagation()}>
      <div className="md:col-span-3">
        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Reason *</label>
        <input type="text" maxLength={300} value={complimentary.reason} disabled={disabled} onChange={set("reason")} placeholder="e.g. VIP guest of the GM, service recovery" className={cls} />
      </div>
      <div className="md:col-span-2">
        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Approved by *</label>
        <select value={complimentary.approver_id} disabled={disabled} onChange={set("approver_id")} className={cls}>
          <option value="">{data.loading ? "Loading admins…" : "Select admin"}</option>
          {data.approvers.map((admin) => (
            <option key={admin.id} value={admin.id}>{admin.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Admin password *</label>
        <input type="password" autoComplete="new-password" value={complimentary.approver_password} disabled={disabled} onChange={set("approver_password")} className={cls} />
      </div>
    </div>
  );
};
