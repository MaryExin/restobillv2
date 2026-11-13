import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { FiCheck, FiDownload, FiRefreshCw, FiWifi, FiX } from "react-icons/fi";
import { printQrOrder } from "../../utils/printQrOrder";

const money = (value) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value) || 0);
const surface = { background: "var(--color-darkPrimary)", color: "var(--color-lighter)", borderColor: "var(--color-softPrimary)" };
const primary = { background: "var(--color-brandPrimary)", color: "#fff" };

export default function QrOrdersInbox({ orders, onClose, onAccepted }) {
  const { data, error, isLoading, refetch, ready, host, hostError, connectHost, isConnecting, isMutating, decide } = orders;
  const [tab, setTab] = useState("orders");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [rejectingId, setRejectingId] = useState(null);
  const [reason, setReason] = useState("");
  const [selectedUrl, setSelectedUrl] = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [printJob, setPrintJob] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const deciding = useRef(false);
  const dialog = useRef(null);
  const qr = useRef(null);
  const pending = data?.orders || [];
  const urls = host?.urls || [];
  const baseUrl = urls.includes(selectedUrl) ? selectedUrl : urls[0] || "";
  const qrUrl = baseUrl ? `${baseUrl}${selectedTable ? `?table=${encodeURIComponent(selectedTable)}` : ""}` : "";
  const serverReady = host?.running && host?.configured && !host?.error;

  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const handleKeys = (event) => {
    if (event.key === "Escape" && !isMutating && !isPrinting) onClose();
    if (event.key !== "Tab") return;
    const controls = [...dialog.current.querySelectorAll("button:not(:disabled), a[href], input, select, textarea, [tabindex='0']")];
    const first = controls[0]; const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };

  const printAccepted = async (job) => {
    setIsPrinting(true);
    try {
      const result = await printQrOrder(job);
      if (result?.success && !result.partialPrint) {
        setPrintJob(null);
        const printedNotice = result.printFallback ? `Order saved. Printing was unavailable; the ticket was saved as PDF: ${result.filePath}` : `Transaction ${job.transactionId} saved and sent to the configured printers.`;
        setNotice(`${printedNotice}${job.requiresRebilling ? " Update the bill before taking payment." : ""}`);
      } else {
        setActionError(result?.partialPrint ? "The order is saved, but some printers failed. Check the tickets already printed before retrying." : result?.message || "The order is saved, but printing was not completed. You can retry printing below.");
      }
    } catch (failure) { setActionError(`The order is saved. ${failure.message || "Printing failed."}`); }
    finally { setIsPrinting(false); }
  };

  const handleDecision = async (action, order, shouldPrint = false) => {
    if (deciding.current || isPrinting) return;
    deciding.current = true;
    setActionError(""); setNotice("");
    try {
      const result = await decide(action, order.order_id, reason);
      setRejectingId(null); setReason("");
      setNotice(action === "accept" ? `${result.is_additional ? "Added to open" : "Accepted as new"} transaction ${result.transaction_id}. ${result.requires_rebilling ? "Update the bill before taking payment." : "Continue with the normal POS billing and payment screens."}` : "Order rejected. The customer can see the updated status.");
      if (action === "accept") {
        onAccepted?.(result);
        if (shouldPrint) {
          const job = { order, transactionId: result.transaction_id, printMode: result.is_additional ? "additional" : "new", requiresRebilling: result.requires_rebilling };
          setPrintJob(job);
          await printAccepted(job);
        }
      }
    } catch (failure) { setActionError(failure.message); }
    finally { deciding.current = false; }
  };

  const downloadQr = () => {
    const svg = qr.current?.querySelector("svg");
    if (!svg) return;
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
    const link = document.createElement("a"); link.href = url;
    link.download = `qr-order-${(selectedTable || "menu").replace(/[^a-z0-9-]/gi, "-")}.svg`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return createPortal(<div className="fixed inset-0 z-[300000] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm">
    <section ref={dialog} tabIndex={-1} onKeyDown={handleKeys} role="dialog" aria-modal="true" aria-labelledby="qr-inbox-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border shadow-2xl outline-none font-[Poppins-Regular]" style={surface}>
      <header className="flex items-start justify-between gap-4 border-b p-5" style={{ borderColor: surface.borderColor }}>
        <div><h2 id="qr-inbox-title" className="text-2xl font-[Poppins-Bold]">QR ordering</h2><p className="mt-1 text-sm opacity-70">{data?.business_name || host?.businessName || "Customer orders on your Wi-Fi"}</p></div>
        <button type="button" aria-label="Close QR orders" onClick={onClose} disabled={isMutating || isPrinting} className="rounded-full border p-3"><FiX /></button>
      </header>
      <nav className="flex gap-2 border-b px-5 py-3" style={{ borderColor: surface.borderColor }} aria-label="QR ordering sections">
        <button type="button" onClick={() => setTab("orders")} aria-pressed={tab === "orders"} className="rounded-xl px-4 py-2 font-[Poppins-Medium]" style={tab === "orders" ? primary : {}}>Pending orders ({pending.length})</button>
        <button type="button" onClick={() => setTab("server")} aria-pressed={tab === "server"} className="rounded-xl px-4 py-2 font-[Poppins-Medium]" style={tab === "server" ? primary : {}}>Wi-Fi & QR codes</button>
      </nav>
      <div className="min-h-0 overflow-y-auto p-5">
        {!ready && <p role="alert" className="mb-4">Sign in and select the POS branch to receive QR orders.</p>}
        {notice && <p role="status" className="mb-4 rounded-xl border p-4">{notice}</p>}
        {printJob && <button type="button" disabled={isPrinting || isMutating} onClick={() => printAccepted(printJob)} className="mb-4 rounded-xl border px-4 py-3 disabled:opacity-50">{isPrinting ? "Printing…" : `Retry printing transaction ${printJob.transactionId}`}</button>}
        {(actionError || error) && <p role="alert" className="mb-4 rounded-xl border p-4" style={{ color: "var(--color-redaccent)" }}>{actionError || error.message}</p>}
        {tab === "orders" ? <>
          <div className="mb-5 flex items-center justify-between gap-3"><p className="text-sm opacity-70">Review each order before adding it to the POS. An open shift is required.</p><button type="button" onClick={() => refetch()} disabled={isLoading} className="flex items-center gap-2 rounded-xl border px-3 py-2"><FiRefreshCw />Refresh</button></div>
          {isLoading && ready ? <p role="status">Loading orders…</p> : !error && !pending.length ? <div className="rounded-2xl border border-dashed py-16 text-center"><FiCheck className="mx-auto mb-3 text-3xl" /><h3 className="font-[Poppins-SemiBold]">You’re all caught up</h3><p className="mt-2 text-sm opacity-70">New QR orders appear here automatically.</p></div> : null}
          <div className="space-y-4">{pending.map((order) => <article key={order.order_id} className="rounded-2xl border p-5" style={{ borderColor: surface.borderColor }}>
            <div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-lg font-[Poppins-SemiBold]">{order.table_number || order.order_type} <span className="text-sm opacity-60">#{String(order.order_id).slice(0, 8)}</span></h3><p className="mt-1 text-sm opacity-70">{order.customer_name || "Guest"} · {order.customer_head_count} guest(s) · {order.order_type}</p><p className="mt-1 text-xs opacity-60">{order.created_at} (Manila)</p></div><div className="text-right"><strong className="text-xl font-[Poppins-Bold]">{money(order.total_amount)}</strong><p className="text-xs opacity-60">Estimated total</p></div></div>
            <ul className="my-4 space-y-2">{(order.items || []).map((item, index) => <li key={item.id || index}><div className="flex justify-between gap-4"><span>{item.quantity} × {item.item_name}</span><span>{money(Number(item.quantity) * Number(item.selling_price))}</span></div>{item.item_instruction && <p className="mt-1 text-sm opacity-60">{item.item_instruction}</p>}</li>)}</ul>
            {Number(order.service_charge_amount) > 0 && <p className="mb-3 text-right text-sm opacity-70">Subtotal {money(order.subtotal_amount)} + service charge {money(order.service_charge_amount)}</p>}{order.notes && <p className="mb-4 rounded-xl border p-3 text-sm">{order.notes}</p>}
            {rejectingId === order.order_id ? <div className="flex flex-wrap gap-2"><label className="flex-1 text-sm">Reason for rejection<input value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" style={surface} placeholder="Optional reason for the customer" /></label><button type="button" disabled={isMutating || isPrinting} onClick={() => handleDecision("reject", order)} className="self-end rounded-xl border px-4 py-2" style={{ color: "var(--color-redaccent)" }}>Confirm rejection</button><button type="button" disabled={isMutating || isPrinting} onClick={() => setRejectingId(null)} className="self-end px-3 py-2">Cancel</button></div> : <div className="flex justify-end gap-2"><button type="button" disabled={isMutating || isPrinting} onClick={() => { setRejectingId(order.order_id); setReason(""); }} className="rounded-xl border px-4 py-3 disabled:opacity-50">Reject</button><button type="button" disabled={isMutating || isPrinting} onClick={() => handleDecision("accept", order)} className="rounded-xl px-4 py-3 font-[Poppins-SemiBold] disabled:opacity-50" style={primary}>{isMutating ? "Please wait…" : "Accept into POS"}</button>{window.electronAPI?.printEscPos && <button type="button" disabled={isMutating || isPrinting} onClick={() => handleDecision("accept", order, true)} className="rounded-xl border px-4 py-3 font-[Poppins-SemiBold] disabled:opacity-50">Accept & print</button>}</div>}
          </article>)}</div>
        </> : <div className="grid gap-6 md:grid-cols-2">
          <div><h3 className="flex items-center gap-2 text-lg font-[Poppins-SemiBold]"><FiWifi />{serverReady ? "Ordering server is running" : "Ordering server setup"}</h3>
            <p className="mt-3 text-sm leading-relaxed opacity-70">Keep Restobill open on this computer. Customers connect to the same Wi-Fi and scan the QR code. Orders are saved to this POS database.</p>
            {!window.qrOrdering && <p className="mt-4 rounded-xl border p-4">Open the installed desktop app to host phone ordering. This browser can still review incoming orders.</p>}
            {(hostError || host?.error) && <p role="alert" className="mt-4" style={{ color: "var(--color-redaccent)" }}>{hostError || host.error}</p>}
            {window.qrOrdering && <button type="button" disabled={!ready || isConnecting || isMutating} onClick={connectHost} className="mt-4 rounded-xl border px-4 py-3 disabled:opacity-50">{isConnecting ? "Connecting…" : "Reconnect ordering server"}</button>}
            {serverReady && !urls.length && <p className="mt-4">Connect this computer to Wi-Fi or Ethernet to generate a customer link.</p>}
            {serverReady && urls.length > 0 && <>
              <label className="mt-5 block text-sm">Network address<select value={baseUrl} onChange={(e) => setSelectedUrl(e.target.value)} className="mt-2 w-full rounded-xl border p-3" style={surface}>{urls.map((url) => <option key={url} value={url}>{url.split("/#")[0]}</option>)}</select></label>
              <label className="mt-4 block text-sm">QR code for<select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)} className="mt-2 w-full rounded-xl border p-3" style={surface}><option value="">General menu — customer selects table</option>{(data?.tables || []).map((table) => <option key={table.table_name} value={table.table_name}>{table.table_name}</option>)}</select></label>
              <p className="mt-4 text-xs leading-relaxed opacity-70">Allow Restobill through the computer’s firewall on your private network (TCP {host.port}). Guest Wi-Fi must allow access to the POS computer. If the computer’s IP changes, regenerate the QR codes.</p>
            </>}
          </div>
          {serverReady && qrUrl && <div className="flex flex-col items-center rounded-2xl border p-5 text-center" style={{ borderColor: surface.borderColor }}><h3 className="font-[Poppins-SemiBold]">{selectedTable || "Scan to order"}</h3><div ref={qr} className="my-5 rounded-2xl bg-white p-4"><QRCodeSVG value={qrUrl} size={220} includeMargin level="M" /></div><a href={qrUrl} target="_blank" rel="noreferrer" className="max-w-full break-all text-sm underline">{qrUrl}</a><button type="button" onClick={downloadQr} className="mt-5 flex items-center gap-2 rounded-xl px-4 py-3" style={primary}><FiDownload />Save QR code</button><p className="mt-3 text-xs opacity-60">Download the SVG to print for your tables.</p></div>}
        </div>}
      </div>
    </section>
  </div>, document.body);
}
