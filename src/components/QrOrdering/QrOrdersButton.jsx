import { lazy, Suspense, useState } from "react";
import { FaQrcode } from "react-icons/fa";
import useQrOrders from "../../hooks/useQrOrders";
import PosQuickActionTile from "../MainComponents/Common/PosQuickActionTile";

const QrOrdersInbox = lazy(() => import("./QrOrdersInbox"));

export default function QrOrdersButton({ tile = false, onAccepted }) {
  const [open, setOpen] = useState(false);
  const orders = useQrOrders();
  const count = orders.data?.orders?.length || 0;
  const label = `QR Orders${count ? ` (${count})` : ""}`;
  return <>
    {tile ? <PosQuickActionTile label={label} icon={<FaQrcode className="text-[28px] sm:text-[30px]" />} color="green" onClick={() => setOpen(true)} /> :
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-2xl border px-4 py-3 font-[Poppins-Medium]" style={{ background: "var(--color-darkPrimary)", color: "var(--color-lighter)", borderColor: "var(--color-brandPrimary)" }}><FaQrcode />{label}</button>}
    {open && <Suspense fallback={<p role="status" className="fixed bottom-4 right-4 z-[300000] rounded-xl bg-white p-4 text-black">Loading QR orders…</p>}>
      <QrOrdersInbox orders={orders} onClose={() => setOpen(false)} onAccepted={onAccepted} />
    </Suspense>}
  </>;
}
