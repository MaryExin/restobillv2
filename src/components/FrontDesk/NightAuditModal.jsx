/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import { FaCheckCircle, FaExclamationTriangle, FaMoon, FaSpinner } from "react-icons/fa";
import { formatDate, frontDeskGet, getBusinessDate, peso, postRoomNight } from "./frontDeskUtils";
import { Button, ErrorBox, Modal, Muted } from "./FrontDeskUi";

/**
 * Posts unposted room nights as POS invoices charged to the folios.
 * stayId: only that guest (folio "Post Room Charges"); forCheckout: nights a
 * guest leaving today must have paid for. Without stayId: every in-house guest
 * through the business date (night audit).
 */
const NightAuditModal = ({ apiHost, stayId, forCheckout, onClose, onDone }) => {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({}); // key -> {status, message}

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const businessDate = await getBusinessDate(apiHost);
        const params = { view: "room_nights", date: businessDate };
        if (stayId) params.id = stayId;
        if (forCheckout) params.for = "checkout";
        const data = await frontDeskGet(apiHost, params);
        if (!cancelled) setPlan(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiHost, stayId, forCheckout]);

  const jobs = useMemo(
    () =>
      (plan?.due || []).flatMap((stay) =>
        stay.nights.map((night) => ({ key: `${stay.folio_no}|${night}`, stay, night })),
      ),
    [plan],
  );
  const total = jobs.reduce((sum, job) => sum + Number(job.stay.room_rate || 0), 0);
  const doneCount = Object.values(progress).filter((p) => p.status === "done").length;
  const failed = Object.values(progress).filter((p) => p.status === "error");
  const finished = jobs.length > 0 && Object.keys(progress).length === jobs.length && !busy;

  const run = async () => {
    setBusy(true);
    setError("");
    for (const job of jobs) {
      if (progress[job.key]?.status === "done") continue;
      setProgress((prev) => ({ ...prev, [job.key]: { status: "running" } }));
      try {
        const invoice = await postRoomNight(apiHost, {
          stay: job.stay,
          serviceDate: job.night,
          businessDate: plan.business_date,
          product: plan.product,
          roomChargeMop: plan.room_charge_mop,
        });
        setProgress((prev) => ({ ...prev, [job.key]: { status: "done", message: `Invoice #${invoice}` } }));
      } catch (err) {
        setProgress((prev) => ({ ...prev, [job.key]: { status: "error", message: err.message } }));
      }
    }
    setBusy(false);
    onDone?.();
  };

  return (
    <Modal
      title={stayId ? "Post Room Charges" : "Night Audit"}
      subtitle={
        plan
          ? `Business date ${formatDate(plan.business_date)} · each room night becomes a POS invoice charged to the folio (shows in the X / Z reading).`
          : "Room nights are invoiced on the open business date."
      }
      onClose={onClose}
      busy={busy}
      width="max-w-3xl"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>{finished ? "Done" : "Cancel"}</Button>
          {!finished ? (
            <Button variant="primary" onClick={run} disabled={busy || jobs.length === 0}>
              {busy ? <FaSpinner className="animate-spin" /> : <FaMoon size={12} />}
              {busy ? `Posting ${doneCount + failed.length + 1} of ${jobs.length}…` : `Post ${jobs.length} night(s) · ${peso(total)}`}
            </Button>
          ) : null}
        </>
      }
    >
      <ErrorBox message={error} />
      {!plan && !error ? (
        <Muted className="flex items-center gap-2"><FaSpinner className="animate-spin" /> Checking room nights…</Muted>
      ) : null}
      {plan ? (
        <>
          {jobs.length === 0 ? (
            <p className="flex items-center gap-2 font-[Poppins-SemiBold] text-[14px]" style={{ color: "#047857" }}>
              <FaCheckCircle /> All room nights are posted.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--app-border)" }}>
              <table className="w-full min-w-[520px] text-left font-[Poppins-Regular] text-[13px]">
                <thead>
                  <tr className="font-[Poppins-SemiBold] text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--app-muted-text)" }}>
                    <th className="px-3 py-2">Room</th>
                    <th className="px-3 py-2">Guest</th>
                    <th className="px-3 py-2">Night</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const state = progress[job.key];
                    return (
                      <tr key={job.key} className="border-t" style={{ borderColor: "var(--app-border)" }}>
                        <td className="px-3 py-2">{job.stay.room_name}</td>
                        <td className="px-3 py-2">{job.stay.guest_name} <Muted>({job.stay.folio_no})</Muted></td>
                        <td className="px-3 py-2">{formatDate(job.night)}</td>
                        <td className="px-3 py-2 text-[12px]">
                          {!state ? (
                            <Muted>To post</Muted>
                          ) : state.status === "running" ? (
                            <FaSpinner className="animate-spin" />
                          ) : state.status === "done" ? (
                            <span style={{ color: "#047857" }}>{state.message}</span>
                          ) : (
                            <span style={{ color: "#be123c" }}>{state.message}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-[Poppins-SemiBold]">{peso(job.stay.room_rate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {plan.no_rate?.length ? (
            <p className="flex items-start gap-2 font-[Poppins-Medium] text-[12px]" style={{ color: "#b45309" }}>
              <FaExclamationTriangle className="mt-0.5 shrink-0" />
              No room rate (nothing posted): {plan.no_rate.map((s) => `${s.room_name} · ${s.guest_name}`).join(", ")}. Set the rate with Edit if the room is not complimentary.
            </p>
          ) : null}
          {failed.length ? <ErrorBox message={`${failed.length} night(s) were not posted — see the list. You can run it again.`} /> : null}
        </>
      ) : null}
    </Modal>
  );
};

export default NightAuditModal;
