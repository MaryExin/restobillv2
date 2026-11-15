/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { FaSpinner } from "react-icons/fa";
import { frontDeskGet, frontDeskPost, peso } from "./frontDeskUtils";
import { Button, ErrorBox, Label, Modal, fieldClass, fieldStyle } from "./FrontDeskUi";

/** Voids a wrong folio / company payment (all lines of one collection number). Needs an admin. */
const VoidCollectionModal = ({ apiHost, collection, onClose, onVoided }) => {
  const [approvers, setApprovers] = useState([]);
  const [form, setForm] = useState({ reason: "", approver_id: "", approver_password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    frontDeskGet(apiHost, { view: "approvers" })
      .then((rows) => setApprovers(Array.isArray(rows) ? rows : []))
      .catch((err) => setError(err.message));
  }, [apiHost]);

  const total = collection.lines.reduce((sum, row) => sum + Number(row.payment_amount || 0), 0);
  const set = (key) => (e) => {
    setError("");
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const submit = async () => {
    if (form.reason.trim().length < 3) return setError("Enter the reason.");
    if (!form.approver_id || !form.approver_password) return setError("An admin must approve the void.");
    setBusy(true);
    try {
      const { message } = await frontDeskPost(apiHost, {
        action: "void_collection",
        collection_no: collection.collectionNo,
        ...form,
      });
      onVoided(message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Void ${collection.collectionNo}`}
      subtitle={`${collection.lines.map((row) => row.payment_method).join(" + ")} · ${peso(total)}. The amount goes back to the balance.`}
      onClose={onClose}
      busy={busy}
      width="max-w-lg"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="danger" onClick={submit} disabled={busy}>
            {busy ? <FaSpinner className="animate-spin" /> : null} Void Payment
          </Button>
        </>
      }
    >
      <div>
        <Label htmlFor="vc-reason">Reason</Label>
        <input id="vc-reason" autoFocus maxLength={300} value={form.reason} onChange={set("reason")} placeholder="e.g. wrong amount, wrong folio" className={fieldClass} style={fieldStyle(false)} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="vc-admin">Approved by</Label>
          <select id="vc-admin" value={form.approver_id} onChange={set("approver_id")} className={fieldClass} style={fieldStyle(false)}>
            <option value="">Select admin</option>
            {approvers.map((admin) => (
              <option key={admin.id} value={admin.id}>{admin.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="vc-pass">Admin password</Label>
          <input id="vc-pass" type="password" autoComplete="new-password" value={form.approver_password} onChange={set("approver_password")} className={fieldClass} style={fieldStyle(false)} />
        </div>
      </div>
      <ErrorBox message={error} />
    </Modal>
  );
};

export default VoidCollectionModal;
