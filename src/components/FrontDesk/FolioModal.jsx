/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaBan, FaCocktail, FaDoorOpen, FaEdit, FaMoneyBillWave, FaMoon, FaPrint, FaSpinner, FaTimesCircle } from "react-icons/fa";
import {
  formatDate,
  formatDateTime,
  frontDeskGet,
  frontDeskPost,
  getBusinessDate,
  groupCollections,
  nightsStayed,
  peso,
  printCollectionReceipt,
  printLedger,
  round2,
  runPrint,
} from "./frontDeskUtils";
import NightAuditModal from "./NightAuditModal";
import VoidCollectionModal from "./VoidCollectionModal";
import SettlementLines, { emptyLine, linesTotal, validateLines } from "./SettlementLines";
import { Button, ErrorBox, Label, Modal, Muted, StatusPill, fieldClass, fieldStyle } from "./FrontDeskUi";

/** Router state for /ordering: opens the room so outlet items can be charged to the folio. */
export const folioOrderState = (stay, roomChargeMop, label) => ({
  reservationOrder: {
    table: stay.room_name,
    guestCount: Math.max(1, Number(stay.guest_count) || 1),
    guestName: stay.guest_name,
    contactNumber: stay.guest_contact || "",
    specialRequest: `${label} · Folio ${stay.folio_no}`,
    paymentMode: roomChargeMop || "",
    paymentReference: roomChargeMop ? stay.folio_no : "",
    paymentAmount: "",
    reservationId: null,
    preOrder: null,
  },
});

const LedgerTable = ({ head, rows, empty }) => (
  <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--app-border)" }}>
    <table className="w-full min-w-[520px] text-left font-[Poppins-Regular] text-[13px]">
      <thead>
        <tr className="font-[Poppins-SemiBold] text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--app-muted-text)" }}>
          {head.map((cell, i) => (
            <th key={i} className={`px-3 py-2 ${i === head.length - 1 ? "text-right" : ""}`}>{cell}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr className="border-t" style={{ borderColor: "var(--app-border)" }}>
            <td colSpan={head.length} className="px-3 py-3" style={{ color: "var(--app-muted-text)" }}>{empty}</td>
          </tr>
        ) : (
          rows.map((cells, r) => (
            <tr key={r} className="border-t" style={{ borderColor: "var(--app-border)", opacity: cells.dim ? 0.5 : 1 }}>
              {cells.cols.map((cell, i) => (
                <td key={i} className={`px-3 py-2 align-top ${i === cells.cols.length - 1 ? "text-right font-[Poppins-SemiBold]" : ""}`}>{cell}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const FolioModal = ({ apiHost, stayId, setup, terminalNumber, businessName, onClose, onEdit, onChanged }) => {
  const navigate = useNavigate();
  const [folio, setFolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState(""); // "", "collect", "checkout", "cancel"
  const [lines, setLines] = useState([emptyLine()]);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [roomPosting, setRoomPosting] = useState(null); // null | {forCheckout}
  const [voiding, setVoiding] = useState(null); // collection group
  const [businessDate, setBusinessDate] = useState("");

  const modes = setup?.settlement_modes || [];
  const accounts = setup?.accounts || [];
  const roomChargeMop = setup?.special_mops?.ROOM_CHARGE || "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFolio(await frontDeskGet(apiHost, { view: "folio", id: stayId }));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiHost, stayId]);

  useEffect(() => {
    load();
  }, [load]);

  const stay = folio?.stay;
  const balance = Number(folio?.balance || 0);
  const inHouse = stay?.status === "In-House";

  // Check-out needs every room night invoiced first (rooms with a rate).
  const startCheckout = async () => {
    setError("");
    if (Number(stay?.room_rate || 0) > 0) {
      setBusy(true);
      try {
        const date = await getBusinessDate(apiHost);
        setBusinessDate(date);
        const plan = await frontDeskGet(apiHost, { view: "room_nights", date, id: stayId, for: "checkout" });
        if ((plan?.due || []).length) {
          setRoomPosting({ forCheckout: true });
          return;
        }
      } catch (err) {
        setError(err.message);
        return;
      } finally {
        setBusy(false);
      }
    }
    startMode("checkout");
  };

  const startMode = (next) => {
    setError("");
    setRemarks("");
    const first = modes[0]?.mop || "";
    if (next === "checkout") {
      setLines([{ ...emptyLine(first), payment_amount: balance !== 0 ? String(round2(balance)) : "" }]);
    } else {
      setLines([emptyLine(first)]);
    }
    setMode(next);
  };

  const submit = async () => {
    setError("");
    const sendLines = lines.filter((line) => line.payment_method || line.payment_amount);
    if (mode === "collect" || (mode === "checkout" && Math.abs(balance) >= 0.005)) {
      const problem = validateLines(sendLines, modes);
      if (problem) return setError(problem);
      const total = linesTotal(sendLines);
      if (mode === "checkout" && Math.abs(total - balance) >= 0.005) {
        return setError(`Payments (${peso(total)}) must equal the balance of ${peso(balance)}.`);
      }
    }
    setBusy(true);
    try {
      const body =
        mode === "cancel"
          ? { action: "cancel_stay", id: stayId }
          : {
              action: mode === "checkout" ? "check_out" : "collect",
              id: stayId,
              payments: mode === "checkout" && Math.abs(balance) < 0.005 ? [] : sendLines,
              terminal_number: terminalNumber,
              business_date: businessDate,
              remarks,
            };
      const { message } = await frontDeskPost(apiHost, body);
      setMode("");
      onChanged(message);
      if (mode === "checkout" || mode === "cancel") {
        onClose();
      } else {
        load();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const print = () =>
    runPrint(printLedger({
      businessName,
      title: `Guest Folio ${stay.folio_no}`,
      lines: [
        ["Guest", stay.guest_name],
        ["Room", stay.room_name],
        ["Check-in", formatDateTime(stay.check_in_at)],
        ["Check-out", stay.check_out_at ? formatDateTime(stay.check_out_at) : stay.expected_check_out ? `${formatDate(stay.expected_check_out)} (expected)` : "—"],
        ["Nights", String(nightsStayed(stay.check_in_at, stay.check_out_at))],
        ["Room rate", stay.room_rate ? `${peso(stay.room_rate)} / night` : "—"],
      ],
      charges: folio.charges,
      collections: folio.collections,
      balance,
    }));

  const goOrder = (label) => {
    onClose();
    navigate("/ordering", { state: folioOrderState(stay, roomChargeMop, label) });
  };

  const footer = !stay ? null : mode ? (
    <>
      <Button onClick={() => setMode("")} disabled={busy}>Back</Button>
      <Button variant={mode === "cancel" ? "danger" : "primary"} onClick={submit} disabled={busy}>
        {busy ? <FaSpinner className="animate-spin" /> : null}
        {mode === "collect" ? "Save Payment" : mode === "checkout" ? "Settle & Check Out" : "Cancel Check-in"}
      </Button>
    </>
  ) : (
    <>
      <Button onClick={print}><FaPrint size={12} /> Print Folio</Button>
      {inHouse ? (
        <>
          <Button onClick={() => onEdit(stay)}><FaEdit size={12} /> Edit / Move</Button>
          {folio.charges.length === 0 && folio.collections.length === 0 ? (
            <Button variant="danger" onClick={() => startMode("cancel")}><FaTimesCircle size={12} /> Cancel Check-in</Button>
          ) : null}
          <Button onClick={() => goOrder("Minibar")} disabled={!roomChargeMop} title={roomChargeMop ? "Open the room's order to post minibar items to this folio" : "Turn on Charge to Room in Mode of Payment"}>
            <FaCocktail size={12} /> Minibar
          </Button>
          {Number(stay.room_rate || 0) > 0 ? (
            <Button onClick={() => setRoomPosting({ forCheckout: false })} title="Invoice the room nights not yet posted">
              <FaMoon size={12} /> Room Charges
            </Button>
          ) : null}
          <Button onClick={() => startMode("collect")}><FaMoneyBillWave size={12} /> Collect / Deposit</Button>
          <Button variant="primary" onClick={startCheckout} disabled={busy}>
            {busy ? <FaSpinner className="animate-spin" /> : <FaDoorOpen size={12} />} Check Out
          </Button>
        </>
      ) : null}
    </>
  );

  return (
    <Modal
      title={stay ? `${stay.room_name} · ${stay.guest_name}` : "Guest Folio"}
      subtitle={stay ? `${stay.folio_no} · checked in ${formatDateTime(stay.check_in_at)} · ${nightsStayed(stay.check_in_at, stay.check_out_at)} night(s)` : ""}
      onClose={onClose}
      busy={busy}
      width="max-w-4xl"
      footer={footer}
    >
      {loading && !folio ? (
        <Muted className="flex items-center gap-2"><FaSpinner className="animate-spin" /> Loading folio…</Muted>
      ) : !stay ? (
        <ErrorBox message={error || "Folio not found."} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Status", <StatusPill key="s" status={stay.status} />],
              ["Charges", peso(folio.charges.filter((c) => c.status === "Active").reduce((s, c) => s + Number(c.amount), 0))],
              ["Payments", peso(folio.collections.filter((c) => c.status === "Active").reduce((s, c) => s + Number(c.payment_amount), 0))],
              ["Balance", <span key="b" style={{ color: balance > 0 ? "#be123c" : "#047857" }}>{peso(balance)}</span>],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--app-border)" }}>
                <p className="font-[Poppins-SemiBold] text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--app-muted-text)" }}>{label}</p>
                <p className="mt-0.5 font-[Poppins-Bold] text-[16px]">{value}</p>
              </div>
            ))}
          </div>

          {stay.notes || stay.guest_contact || stay.expected_check_out || stay.room_rate ? (
            <Muted>
              {[
                stay.room_rate ? `Rate ${peso(stay.room_rate)}/night` : "No room rate",
                stay.guest_contact,
                stay.expected_check_out ? `Check-out ${formatDate(stay.expected_check_out)}` : "",
                stay.notes,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Muted>
          ) : null}

          {mode === "collect" || mode === "checkout" ? (
            <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: "var(--app-accent)" }}>
              <p className="font-[Poppins-SemiBold] text-[14px]">
                {mode === "collect"
                  ? `Collect a payment — deposit, advance or partial (balance ${peso(balance)})`
                  : Math.abs(balance) < 0.005
                    ? "Nothing to pay — the guest can check out."
                    : balance < 0
                      ? `Refund the guest's credit of ${peso(-balance)} (enter it as a negative amount).`
                      : `Settle the balance of ${peso(balance)}. Use City Ledger to bill a company.`}
              </p>
              {mode === "collect" || Math.abs(balance) >= 0.005 ? (
                <SettlementLines
                  lines={lines}
                  onChange={setLines}
                  modes={modes}
                  accounts={accounts}
                  allowCityLedger={mode === "checkout" && balance > 0}
                  target={mode === "checkout" ? balance : undefined}
                  disabled={busy}
                />
              ) : null}
              <div>
                <Label htmlFor="fd-remarks" hint="optional">Remarks</Label>
                <input id="fd-remarks" maxLength={300} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={fieldClass} style={fieldStyle(false)} />
              </div>
            </div>
          ) : null}

          {mode === "cancel" ? (
            <ErrorBox message={`Cancel the check-in of ${stay.guest_name} in ${stay.room_name}? The room becomes available.`} />
          ) : null}

          <ErrorBox message={error} />

          <div className="space-y-2">
            <p className="font-[Poppins-SemiBold] text-[14px]">Charges</p>
            <LedgerTable
              head={["Date", "Description", "Posted by", "Amount"]}
              empty="No charges yet. Bills paid with Charge to Room appear here."
              rows={folio.charges.map((row) => ({
                dim: row.status !== "Active",
                cols: [
                  formatDateTime(row.charged_at),
                  <span key="d">
                    {row.description}
                    {row.status !== "Active" ? <span className="ml-2"><StatusPill status={row.status} /></span> : null}
                  </span>,
                  row.posted_by,
                  peso(row.amount),
                ],
              }))}
            />
          </div>
          <div className="space-y-2">
            <p className="font-[Poppins-SemiBold] text-[14px]">Payments</p>
            <LedgerTable
              head={["Date", "Collection", "Mode", "", "Amount"]}
              empty="No payments yet."
              rows={groupCollections(folio.collections).flatMap((group) =>
                group.lines.map((row, i) => ({
                  dim: row.status !== "Active",
                  cols: [
                    formatDateTime(row.collected_at),
                    <span key="n">
                      {row.collection_no}
                      {row.status !== "Active" ? <span className="ml-2"><StatusPill status={row.status === "Voided" ? "Reversed" : row.status} /></span> : null}
                      {row.void_reason ? <span className="block text-[11px]" style={{ color: "var(--app-muted-text)" }}>{row.void_reason}</span> : null}
                    </span>,
                    `${row.payment_method}${row.payment_reference ? ` (${row.payment_reference})` : ""}`,
                    i === 0 ? (
                      <span key="a" className="flex gap-1.5">
                        <button
                          type="button"
                          title="Print collection receipt"
                          onClick={() => runPrint(printCollectionReceipt({ businessName, lines: group.lines, forLabel: `${stay.guest_name} · ${stay.room_name} · ${stay.folio_no}` }))}
                          className="rounded-md border p-1.5"
                          style={{ borderColor: "var(--app-border)" }}
                        >
                          <FaPrint size={10} />
                        </button>
                        {inHouse && row.status === "Active" ? (
                          <button
                            type="button"
                            title="Void this payment"
                            onClick={() => setVoiding(group)}
                            className="rounded-md border p-1.5"
                            style={{ borderColor: "rgba(244,63,94,0.45)", color: "#be123c" }}
                          >
                            <FaBan size={10} />
                          </button>
                        ) : null}
                      </span>
                    ) : "",
                    peso(row.payment_amount),
                  ],
                })),
              )}
            />
          </div>
        </>
      )}
      {roomPosting ? (
        <NightAuditModal
          apiHost={apiHost}
          stayId={stayId}
          forCheckout={roomPosting.forCheckout}
          onClose={() => setRoomPosting(null)}
          onDone={() => {
            load();
            onChanged("Room charges posted.");
          }}
        />
      ) : null}
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

export default FolioModal;
