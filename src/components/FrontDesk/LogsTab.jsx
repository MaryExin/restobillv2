/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import { FaPrint, FaSpinner } from "react-icons/fa";
import { formatDateTime, frontDeskGet, peso, printCollectionReceipt, runPrint, todayKey } from "./frontDeskUtils";
import { Card, ErrorBox, Label, Muted, StatusPill, fieldClass, fieldStyle } from "./FrontDeskUi";

// view: "collections" | "complimentary" | "stays"
const COLUMNS = {
  collections: [
    ["Date", (r) => formatDateTime(r.collected_at)],
    ["Collection", (r) => r.collection_no],
    ["For", (r) => (r.ledger_type === "FOLIO" ? `${r.folio_no} · ${r.room_name} · ${r.guest_name}` : `${r.account_code} · ${r.company_name}`)],
    ["Mode", (r) => `${r.payment_method}${r.payment_reference ? ` (${r.payment_reference})` : ""}`],
    ["Cashier", (r) => r.cashier],
    ["Status", (r) => (r.status === "Active" ? "" : <span title={r.void_reason || ""}><StatusPill status="Reversed" /> {r.void_reason || ""}</span>)],
    ["Amount", (r) => peso(r.payment_amount)],
  ],
  complimentary: [
    ["Date", (r) => formatDateTime(r.date_recorded)],
    ["Invoice", (r) => `#${r.invoice_no}`],
    ["Type", (r) => r.comp_type],
    ["Reason", (r) => [r.reason, r.guest_name].filter(Boolean).join(" · ")],
    ["Approved by", (r) => r.approved_by_name],
    ["Cashier", (r) => r.cashier],
    ["Status", (r) => <StatusPill status={r.status} />],
    ["Amount", (r) => peso(r.amount)],
  ],
  stays: [
    ["Folio", (r) => r.folio_no],
    ["Room", (r) => r.room_name],
    ["Guest", (r) => r.guest_name],
    ["Check-in", (r) => formatDateTime(r.check_in_at)],
    ["Check-out", (r) => formatDateTime(r.check_out_at)],
    ["By", (r) => r.checked_out_by],
    ["Status", (r) => <StatusPill status={r.status} />],
  ],
};

const TITLES = {
  collections: "Collections",
  complimentary: "Complimentary",
  stays: "Guest History",
};

const NOTES = {
  collections: "Folio and company payments. These are not sales — the sales were recorded when the bills were paid. Include cash collections in your cash count.",
  complimentary: "Bills paid with Complimentary, with the approving admin and the reason.",
  stays: "Checked-out and cancelled folios, by check-in date. Click a row to view or print the folio.",
};

const collectionLabel = (r) =>
  r.ledger_type === "FOLIO" ? `${r.guest_name} · ${r.room_name} · ${r.folio_no}` : `${r.company_name} (${r.account_code})`;

const LogsTab = ({ apiHost, view, reloadKey, onOpenStay, businessName }) => {
  const [from, setFrom] = useState(todayKey());
  const [to, setTo] = useState(todayKey());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await frontDeskGet(apiHost, { view, from, to }));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiHost, view, from, to]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const totals = useMemo(() => {
    if (view === "collections") {
      const byMode = {};
      rows.forEach((row) => {
        if (row.status !== "Active") return;
        byMode[row.payment_method] = (byMode[row.payment_method] || 0) + Number(row.payment_amount || 0);
      });
      return Object.entries(byMode);
    }
    if (view === "complimentary") {
      const byType = {};
      rows.forEach((row) => {
        if (row.status !== "Active") return;
        byType[row.comp_type] = (byType[row.comp_type] || 0) + Number(row.amount || 0);
      });
      return Object.entries(byType);
    }
    return [];
  }, [rows, view]);

  const columns = COLUMNS[view];

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-xl">
          <p className="font-[Poppins-SemiBold] text-[16px]">{TITLES[view]}</p>
          <Muted>{NOTES[view]}</Muted>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor={`${view}-from`}>From</Label>
            <input id={`${view}-from`} type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldClass} style={fieldStyle(false)} />
          </div>
          <div>
            <Label htmlFor={`${view}-to`}>To</Label>
            <input id={`${view}-to`} type="date" value={to} onChange={(e) => setTo(e.target.value)} className={fieldClass} style={fieldStyle(false)} />
          </div>
        </div>
      </div>

      {totals.length ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {totals.map(([label, amount]) => (
            <span key={label} className="rounded-full border px-3 py-1 font-[Poppins-SemiBold] text-[12px]" style={{ borderColor: "var(--app-border)" }}>
              {label}: {peso(amount)}
            </span>
          ))}
        </div>
      ) : null}

      <ErrorBox message={error} />
      {loading && rows.length === 0 ? (
        <Muted className="flex items-center gap-2"><FaSpinner className="animate-spin" /> Loading…</Muted>
      ) : rows.length === 0 ? (
        <Muted>Nothing for these dates.</Muted>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left font-[Poppins-Regular] text-[13px]">
            <thead>
              <tr className="font-[Poppins-SemiBold] text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--app-muted-text)" }}>
                {columns.map(([label], i) => (
                  <th key={label} className={`px-3 py-2 ${i === columns.length - 1 && view !== "stays" ? "text-right" : ""}`}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr
                  key={r}
                  onClick={view === "stays" ? () => onOpenStay(row.id) : undefined}
                  className={`border-t ${view === "stays" ? "cursor-pointer hover:opacity-80" : ""}`}
                  style={{ borderColor: "var(--app-border)", opacity: row.status && row.status !== "Active" && view !== "stays" ? 0.55 : 1 }}
                >
                  {columns.map(([label, render], i) => (
                    <td key={label} className={`px-3 py-2 align-top ${i === columns.length - 1 && view !== "stays" ? "text-right font-[Poppins-SemiBold]" : ""}`}>
                      {label === "Collection" ? (
                        <span className="inline-flex items-center gap-1.5">
                          {render(row)}
                          <button
                            type="button"
                            title="Print collection receipt"
                            onClick={() =>
                              runPrint(
                                printCollectionReceipt({
                                  businessName,
                                  lines: rows.filter((other) => other.collection_no === row.collection_no),
                                  forLabel: collectionLabel(row),
                                }),
                              )
                            }
                            className="rounded-md border p-1"
                            style={{ borderColor: "var(--app-border)" }}
                          >
                            <FaPrint size={9} />
                          </button>
                        </span>
                      ) : (
                        render(row)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

export default LogsTab;
