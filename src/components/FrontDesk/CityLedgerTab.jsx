/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from "react";
import { FaBan, FaBuilding, FaEdit, FaMoneyBillWave, FaPlus, FaPrint, FaSpinner } from "react-icons/fa";
import {
  formatDateTime,
  frontDeskGet,
  frontDeskPost,
  groupCollections,
  peso,
  printCollectionReceipt,
  printLedger,
  runPrint,
} from "./frontDeskUtils";
import VoidCollectionModal from "./VoidCollectionModal";
import SettlementLines, { emptyLine, validateLines } from "./SettlementLines";
import { Button, Card, ErrorBox, Label, Modal, Muted, StatusPill, fieldClass, fieldStyle } from "./FrontDeskUi";

const EMPTY_ACCOUNT = {
  company_name: "",
  contact_person: "",
  contact_number: "",
  email: "",
  address: "",
  tin: "",
  credit_limit: "",
  status: "Active",
};

const AccountModal = ({ apiHost, account, onClose, onSaved }) => {
  const [form, setForm] = useState(() =>
    account
      ? Object.fromEntries(
          Object.keys(EMPTY_ACCOUNT).map((key) => [key, account[key] === null || account[key] === undefined ? "" : String(account[key])]),
        )
      : EMPTY_ACCOUNT,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (event) => {
    setError("");
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const submit = async () => {
    if (form.company_name.trim().length < 2) return setError("Enter the company name.");
    setBusy(true);
    try {
      const { message } = await frontDeskPost(apiHost, { action: "save_account", id: account?.id, ...form });
      onSaved(message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = (key, label, props = {}) => (
    <div className={props.wide ? "sm:col-span-2" : ""}>
      <Label htmlFor={`cl-${key}`} hint={props.hint}>{label}</Label>
      <input id={`cl-${key}`} value={form[key]} onChange={set(key)} maxLength={props.max || 150} type={props.type || "text"} placeholder={props.placeholder} className={fieldClass} style={fieldStyle(false)} />
    </div>
  );

  return (
    <Modal
      title={account ? `Edit ${account.account_code}` : "New City Ledger Account"}
      subtitle="A company whose bills are charged to its account and paid later."
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy ? <FaSpinner className="animate-spin" /> : null} Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {field("company_name", "Company name", { wide: true })}
        {field("contact_person", "Contact person", { hint: "optional" })}
        {field("contact_number", "Contact number", { hint: "optional", max: 30 })}
        {field("email", "Email", { hint: "optional", type: "email" })}
        {field("tin", "TIN", { hint: "optional", max: 30 })}
        {field("address", "Address", { hint: "optional", wide: true, max: 300 })}
        {field("credit_limit", "Credit limit", { hint: "blank = no limit", type: "number" })}
        <div>
          <Label htmlFor="cl-status">Status</Label>
          <select id="cl-status" value={form.status} onChange={set("status")} className={fieldClass} style={fieldStyle(false)}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive (cannot be charged)</option>
          </select>
        </div>
      </div>
      <ErrorBox message={error} />
    </Modal>
  );
};

const StatementModal = ({ apiHost, accountId, modes, terminalNumber, businessName, onClose, onEdit, onChanged }) => {
  const [statement, setStatement] = useState(null);
  const [error, setError] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [lines, setLines] = useState([emptyLine()]);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiding, setVoiding] = useState(null);

  const load = useCallback(async () => {
    try {
      setStatement(await frontDeskGet(apiHost, { view: "statement", account_id: accountId }));
    } catch (err) {
      setError(err.message);
    }
  }, [apiHost, accountId]);

  useEffect(() => {
    load();
  }, [load]);

  const account = statement?.account;
  const balance = Number(statement?.balance || 0);
  const settleModes = modes.filter((mode) => mode.mop_kind === "");

  const submit = async () => {
    const sendLines = lines.filter((line) => line.payment_method || line.payment_amount);
    const problem = validateLines(sendLines, settleModes);
    if (problem) return setError(problem);
    if (sendLines.some((line) => Number(line.payment_amount) <= 0)) return setError("Amounts must be greater than zero.");
    setBusy(true);
    setError("");
    try {
      const { message } = await frontDeskPost(apiHost, {
        action: "collect_account",
        account_id: accountId,
        payments: sendLines,
        terminal_number: terminalNumber,
        remarks,
      });
      setCollecting(false);
      onChanged(message);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const print = () =>
    runPrint(printLedger({
      businessName,
      title: `Statement of Account ${account.account_code}`,
      lines: [
        ["Company", account.company_name],
        ["Contact", [account.contact_person, account.contact_number, account.email].filter(Boolean).join(" · ") || "—"],
        ["Address", account.address || "—"],
        ["TIN", account.tin || "—"],
      ],
      charges: statement.charges,
      collections: statement.collections,
      balance,
    }));

  return (
    <Modal
      title={account ? account.company_name : "Statement"}
      subtitle={account ? `${account.account_code}${account.credit_limit ? ` · credit limit ${peso(account.credit_limit)}` : ""}` : ""}
      onClose={onClose}
      busy={busy}
      width="max-w-4xl"
      footer={
        !account ? null : collecting ? (
          <>
            <Button onClick={() => setCollecting(false)} disabled={busy}>Back</Button>
            <Button variant="primary" onClick={submit} disabled={busy}>
              {busy ? <FaSpinner className="animate-spin" /> : null} Save Payment
            </Button>
          </>
        ) : (
          <>
            <Button onClick={print}><FaPrint size={12} /> Print Statement</Button>
            <Button onClick={() => onEdit(account)}><FaEdit size={12} /> Edit</Button>
            <Button
              variant="primary"
              onClick={() => {
                setLines([{ ...emptyLine(settleModes[0]?.mop || ""), payment_amount: balance > 0 ? String(balance) : "" }]);
                setRemarks("");
                setError("");
                setCollecting(true);
              }}
            >
              <FaMoneyBillWave size={12} /> Receive Payment
            </Button>
          </>
        )
      }
    >
      {!statement ? (
        error ? <ErrorBox message={error} /> : <Muted className="flex items-center gap-2"><FaSpinner className="animate-spin" /> Loading…</Muted>
      ) : (
        <>
          <p className="font-[Poppins-Bold] text-[22px]">
            Balance <span style={{ color: balance > 0 ? "#be123c" : "#047857" }}>{peso(balance)}</span>
          </p>
          {collecting ? (
            <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: "var(--app-accent)" }}>
              <SettlementLines lines={lines} onChange={setLines} modes={settleModes} target={balance} disabled={busy} />
              <div>
                <Label htmlFor="cl-remarks" hint="optional">Remarks</Label>
                <input id="cl-remarks" maxLength={300} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. check no., OR no. of the company" className={fieldClass} style={fieldStyle(false)} />
              </div>
            </div>
          ) : null}
          <ErrorBox message={error} />
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--app-border)" }}>
            <table className="w-full min-w-[560px] text-left font-[Poppins-Regular] text-[13px]">
              <thead>
                <tr className="font-[Poppins-SemiBold] text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--app-muted-text)" }}>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Details</th>
                  <th className="px-3 py-2 text-right">Charge</th>
                  <th className="px-3 py-2 text-right">Payment</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...statement.charges.map((row) => ({ at: row.charged_at, row, type: "charge" })),
                  ...statement.collections.map((row) => ({ at: row.collected_at, row, type: "payment" })),
                ]
                  .sort((a, b) => String(a.at).localeCompare(String(b.at)))
                  .map(({ row, type }, i) => (
                    <tr key={`${type}-${row.ID}-${i}`} className="border-t" style={{ borderColor: "var(--app-border)", opacity: row.status === "Active" ? 1 : 0.5 }}>
                      <td className="px-3 py-2">{formatDateTime(type === "charge" ? row.charged_at : row.collected_at)}</td>
                      <td className="px-3 py-2">
                        {type === "charge"
                          ? row.description
                          : `${row.collection_no} · ${row.payment_method}${row.payment_reference ? ` (${row.payment_reference})` : ""}${row.remarks ? ` · ${row.remarks}` : ""}`}
                        {row.status !== "Active" ? <span className="ml-2"><StatusPill status={row.status === "Voided" ? "Reversed" : row.status} /></span> : null}
                        {type === "payment" ? (
                          <span className="ml-2 inline-flex gap-1.5 align-middle">
                            <button
                              type="button"
                              title="Print collection receipt"
                              onClick={() => {
                                const group = groupCollections(statement.collections).find((g) => g.collectionNo === row.collection_no);
                                runPrint(printCollectionReceipt({ businessName, lines: group?.lines || [row], forLabel: `${account.company_name} (${account.account_code})` }));
                              }}
                              className="rounded-md border p-1"
                              style={{ borderColor: "var(--app-border)" }}
                            >
                              <FaPrint size={9} />
                            </button>
                            {row.status === "Active" ? (
                              <button
                                type="button"
                                title="Void this payment"
                                onClick={() => setVoiding(groupCollections(statement.collections).find((g) => g.collectionNo === row.collection_no))}
                                className="rounded-md border p-1"
                                style={{ borderColor: "rgba(244,63,94,0.45)", color: "#be123c" }}
                              >
                                <FaBan size={9} />
                              </button>
                            ) : null}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right">{type === "charge" ? peso(row.amount) : ""}</td>
                      <td className="px-3 py-2 text-right">{type === "payment" ? peso(row.payment_amount) : ""}</td>
                    </tr>
                  ))}
                {statement.charges.length + statement.collections.length === 0 ? (
                  <tr className="border-t" style={{ borderColor: "var(--app-border)" }}>
                    <td colSpan={4} className="px-3 py-3" style={{ color: "var(--app-muted-text)" }}>No activity yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
      {voiding ? (
        <VoidCollectionModal
          apiHost={apiHost}
          collection={voiding}
          onClose={() => setVoiding(null)}
          onVoided={(message) => {
            setVoiding(null);
            onChanged(message);
            load();
          }}
        />
      ) : null}
    </Modal>
  );
};

/** Company balances by age: payments clear the oldest charges first. */
const AgingTable = ({ apiHost, reloadKey, onOpen }) => {
  const [aging, setAging] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    frontDeskGet(apiHost, { view: "aging" })
      .then((data) => {
        setAging(data);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, [apiHost, reloadKey]);
  const cols = [
    ["current", "0–30 days"],
    ["d31_60", "31–60"],
    ["d61_90", "61–90"],
    ["over_90", "Over 90"],
    ["balance", "Balance"],
  ];
  if (error) return <ErrorBox message={error} />;
  if (!aging) return <Muted className="flex items-center gap-2"><FaSpinner className="animate-spin" /> Loading…</Muted>;
  if (aging.rows.length === 0) return <Muted>No company balances.</Muted>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left font-[Poppins-Regular] text-[13px]">
        <thead>
          <tr className="font-[Poppins-SemiBold] text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--app-muted-text)" }}>
            <th className="px-3 py-2">Company</th>
            {cols.map(([key, label]) => (
              <th key={key} className="px-3 py-2 text-right">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {aging.rows.map((row) => (
            <tr key={row.id} onClick={() => onOpen(row.id)} className="cursor-pointer border-t hover:opacity-80" style={{ borderColor: "var(--app-border)" }}>
              <td className="px-3 py-2.5 font-[Poppins-SemiBold]">{row.company_name} <Muted>({row.account_code})</Muted></td>
              {cols.map(([key]) => (
                <td
                  key={key}
                  className={`px-3 py-2.5 text-right ${key === "balance" ? "font-[Poppins-SemiBold]" : ""}`}
                  style={{ color: (key === "d61_90" || key === "over_90") && row[key] > 0 ? "#be123c" : undefined }}
                >
                  {row[key] ? peso(row[key]) : "—"}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t-2 font-[Poppins-Bold]" style={{ borderColor: "var(--app-border)" }}>
            <td className="px-3 py-2.5">Total</td>
            {cols.map(([key]) => (
              <td key={key} className="px-3 py-2.5 text-right">{peso(aging.totals[key])}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const CityLedgerTab = ({ apiHost, modes, terminalNumber, businessName, onNotice, reloadKey }) => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null | {} (new) | account
  const [viewingId, setViewingId] = useState(null);
  const [showAging, setShowAging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAccounts(await frontDeskGet(apiHost, { view: "city_ledger" }));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiHost]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-[Poppins-SemiBold] text-[16px]"><FaBuilding /> Company Accounts</p>
          <Muted>Total receivable {peso(totalBalance)}</Muted>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAging((v) => !v)}>{showAging ? "Accounts" : "Aging"}</Button>
          <Button variant="primary" onClick={() => setEditing({})}><FaPlus size={11} /> New Account</Button>
        </div>
      </div>
      <ErrorBox message={error} />
      {showAging ? (
        <AgingTable apiHost={apiHost} reloadKey={reloadKey} onOpen={setViewingId} />
      ) : loading && accounts.length === 0 ? (
        <Muted className="flex items-center gap-2"><FaSpinner className="animate-spin" /> Loading…</Muted>
      ) : accounts.length === 0 ? (
        <Muted>No company accounts yet. Add one to use City Ledger as a mode of payment.</Muted>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left font-[Poppins-Regular] text-[13px]">
            <thead>
              <tr className="font-[Poppins-SemiBold] text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--app-muted-text)" }}>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Credit limit</th>
                <th className="px-3 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr
                  key={account.id}
                  onClick={() => setViewingId(account.id)}
                  className="cursor-pointer border-t transition hover:opacity-80"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <td className="px-3 py-2.5">{account.account_code}</td>
                  <td className="px-3 py-2.5 font-[Poppins-SemiBold]">{account.company_name}</td>
                  <td className="px-3 py-2.5">{[account.contact_person, account.contact_number].filter(Boolean).join(" · ")}</td>
                  <td className="px-3 py-2.5"><StatusPill status={account.status} /></td>
                  <td className="px-3 py-2.5 text-right">{account.credit_limit ? peso(account.credit_limit) : "—"}</td>
                  <td className="px-3 py-2.5 text-right font-[Poppins-SemiBold]" style={{ color: account.balance > 0 ? "#be123c" : undefined }}>
                    {peso(account.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <AccountModal
          apiHost={apiHost}
          account={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            onNotice(message);
            load();
          }}
        />
      ) : null}
      {viewingId && !editing ? (
        <StatementModal
          apiHost={apiHost}
          accountId={viewingId}
          modes={modes}
          terminalNumber={terminalNumber}
          businessName={businessName}
          onClose={() => setViewingId(null)}
          onEdit={(account) => setEditing(account)}
          onChanged={(message) => {
            onNotice(message);
            load();
          }}
        />
      ) : null}
    </Card>
  );
};

export default CityLedgerTab;
