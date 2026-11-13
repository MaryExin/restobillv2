import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { FaArrowLeft, FaCheckCircle, FaClock, FaMinus, FaPlus, FaSearch, FaShoppingBag, FaUtensils, FaWifi } from "react-icons/fa";
import { refreshQrGuestMenu, requestQrGuest } from "../../hooks/useQrGuestApi";
import { canUseQrTable, estimateQrTotals, getQrContinuationProof, mergeQrReceiptUpdates, prepareQrSubmission, qrReceiptsToRefresh, qrRunningTotal, readQrDraft, writeQrDraft } from "../../utils/qrOrderDraft";

const money = (value) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value || 0));
const fieldClass = "mt-2 w-full rounded-xl border border-[var(--app-border-strong)] bg-[var(--color-darkPrimary)] p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brandPrimary)] disabled:opacity-60";
const buttonClass = "rounded-xl bg-[var(--color-brandPrimary)] px-5 py-3 font-[Poppins-SemiBold] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";
const panelClass = "rounded-3xl border border-[var(--app-border)] bg-[var(--color-darkPrimary)] p-5 sm:p-7";

function GuestSession({ table }) {
  const storageKey = `restobill:qr-order:${table || "counter"}`;
  const [draft, setDraft] = useState(() => readQrDraft(localStorage, storageKey, table));
  const [catalog, setCatalog] = useState(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [trackingError, setTrackingError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [reload, setReload] = useState(0);
  const [confirmNewVisit, setConfirmNewVisit] = useState(false);
  const [checkingTable, setCheckingTable] = useState(false);
  const submittingRef = useRef(false);
  const checkingTableRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const frozen = Boolean(draft.attempt) || submitting;
  const stage = draft.stage;
  const history = draft.history;
  const continuationProof = getQrContinuationProof(draft);
  const continuationKey = `${continuationProof.continuation_order_id || ""}:${continuationProof.continuation_tracking_token || ""}`;

  useEffect(() => { writeQrDraft(localStorage, storageKey, draft); }, [draft, storageKey]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, [stage]);

  useEffect(() => {
    const controller = new AbortController();
    let timer;
    let loading = false;
    setMenuLoading(true);
    const load = async () => {
      if (loading || controller.signal.aborted) return;
      loading = true;
      clearTimeout(timer);
      try {
        const { data } = await refreshQrGuestMenu(draftRef.current, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setCatalog(data);
        setMenuError("");
        setDraft((current) => ({
          ...current,
          history: mergeQrReceiptUpdates(current.history, [], data.continuation),
          order_type: data.order_type && !current.attempt && !current.history.length ? data.order_type : current.order_type,
        }));
      } catch (error) {
        if (!controller.signal.aborted) setMenuError(error.message);
      } finally {
        loading = false;
        if (!controller.signal.aborted) {
          setMenuLoading(false);
          timer = setTimeout(load, 15000);
        }
      }
    };
    load();
    window.addEventListener("focus", load);
    return () => { controller.abort(); clearTimeout(timer); window.removeEventListener("focus", load); };
  }, [draft.order_type, draft.table_number, reload, continuationKey, stage]);

  const pendingKey = history.filter((order) => order.receipt.status === "pending").map((order) => `${order.receipt.order_id}:${order.receipt.tracking_token}`).join("|");
  const trackingKey = qrReceiptsToRefresh(history).map((receipt) => `${receipt.order_id}:${receipt.tracking_token}`).join("|");
  useEffect(() => {
    if (!trackingKey) return;
    const controller = new AbortController();
    let timer;
    const poll = async () => {
      const results = await Promise.allSettled(trackingKey.split("|").map(async (entry) => {
        const [order_id, tracking_token] = entry.split(":");
        const result = await requestQrGuest("status", { params: { order_id, tracking_token }, signal: controller.signal });
        return { ...result, order_id };
      }));
      if (controller.signal.aborted) return;
      const updates = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
      setDraft((current) => ({ ...current, history: mergeQrReceiptUpdates(current.history, updates) }));
      setTrackingError(results.some((result) => result.status === "rejected") ? "Your orders were sent. Reconnecting for updates…" : "");
      timer = setTimeout(poll, 6000);
    };
    poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [trackingKey]);

  const products = useMemo(() => catalog?.products || [], [catalog]);
  const productMap = useMemo(() => new Map(products.map((product) => [product.product_id, product])), [products]);
  const categories = useMemo(() => ["All", ...new Set(products.map((product) => product.item_category || "Other"))], [products]);
  const filteredProducts = products.filter((product) => (category === "All" || (product.item_category || "Other") === category) && `${product.item_name} ${product.item_description || ""}`.toLowerCase().includes(search.toLowerCase()));
  const itemCount = draft.items.reduce((total, item) => total + item.quantity, 0);
  const totals = useMemo(() => estimateQrTotals(draft.items, products, catalog?.service_charge), [draft.items, products, catalog]);
  const missingProducts = draft.items.some((item) => !productMap.has(item.product_id));
  const validTable = canUseQrTable(catalog, draft.order_type, draft.table_number);
  const validService = catalog?.order_types.includes(draft.order_type);
  const canSubmit = Boolean(draft.items.length && catalog && validTable && validService && !missingProducts && !menuLoading && !menuError);
  const runningTotal = qrRunningTotal(history);
  const completedBill = ["paid", "closed"].includes(catalog?.continuation?.transaction_state);
  const tableUnavailable = draft.order_type === "DINE IN" && draft.table_number && catalog && !validTable;
  const tableUnavailableMessage = "This table already has an open bill or is unavailable. Choose another available table, or ask our staff for help.";

  const updateDraft = (values) => {
    if (frozen) return;
    setSubmitError("");
    setDraft((current) => ({ ...current, ...values }));
  };
  const goTo = (next) => updateDraft({ stage: next });
  const enterMenu = async (event) => {
    event?.preventDefault();
    if (checkingTableRef.current || frozen) return;
    checkingTableRef.current = true;
    setCheckingTable(true);
    setSubmitError("");
    try {
      const fresh = await refreshQrGuestMenu(draftRef.current, { refreshPending: true });
      setCatalog(fresh.data);
      setMenuError("");
      setDraft((current) => ({ ...current, history: mergeQrReceiptUpdates(current.history, fresh.updates, fresh.data.continuation) }));
      if (!canUseQrTable(fresh.data, draft.order_type, draft.table_number)) throw new Error(tableUnavailableMessage);
      if (!fresh.data.order_types.includes(draft.order_type)) throw new Error("This order type is unavailable. Please ask our staff for help.");
      setDraft((current) => ({ ...current, stage: "menu" }));
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      checkingTableRef.current = false;
      setCheckingTable(false);
    }
  };
  const changeQuantity = (product, adjustment) => {
    if (frozen) return;
    setDraft((current) => {
      const existing = current.items.find((item) => item.product_id === product.product_id);
      const quantity = Math.min(99, (existing?.quantity || 0) + adjustment);
      const remaining = current.items.filter((item) => item.product_id !== product.product_id);
      return { ...current, items: quantity <= 0 ? remaining : existing ? current.items.map((item) => item.product_id === product.product_id ? { ...item, quantity } : item) : [...remaining, { product_id: product.product_id, item_name: product.item_name, quantity, item_instruction: "" }] };
    });
  };
  const quantityControl = (product, quantity) => (
    <div className="flex shrink-0 items-center gap-3">
      <button type="button" disabled={frozen} onClick={() => changeQuantity(product, -1)} aria-label={`Remove one ${product.item_name}`} className="rounded-lg border border-[var(--app-border-strong)] p-3 disabled:opacity-40"><FaMinus size={10} /></button>
      <span className="min-w-[1ch] text-sm">{quantity}</span>
      <button type="button" disabled={frozen || !productMap.has(product.product_id) || quantity >= 99} onClick={() => changeQuantity(product, 1)} aria-label={`Add one ${product.item_name}`} className="rounded-lg bg-[var(--color-brandPrimary)] p-3 text-white disabled:opacity-40"><FaPlus size={10} /></button>
    </div>
  );

  const submitOrder = async (event) => {
    event.preventDefault();
    if (submittingRef.current || (!draft.attempt && !canSubmit)) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      let submissionDraft = draft;
      let submissionProducts = productMap;
      // An uncertain retry must reach idempotency lookup even if the table was
      // accepted/paid meanwhile. Only a new request needs fresh availability.
      if (!draft.attempt) {
        const fresh = await refreshQrGuestMenu(draft, { refreshPending: true });
        setCatalog(fresh.data);
        setMenuError("");
        setDraft((current) => ({ ...current, history: mergeQrReceiptUpdates(current.history, fresh.updates, fresh.data.continuation) }));
        if (!canUseQrTable(fresh.data, draft.order_type, draft.table_number)) throw new Error(tableUnavailableMessage);
        if (!fresh.data.order_types.includes(draft.order_type)) throw new Error("This order type is unavailable. Please ask our staff for help.");
        submissionProducts = new Map(fresh.data.products.map((product) => [product.product_id, product]));
        if (draft.items.some((item) => !submissionProducts.has(item.product_id))) throw new Error("An item is no longer available. Review your order before sending it again.");
        submissionDraft = { ...draft, history: fresh.history };
      }
      const attempt = prepareQrSubmission(submissionDraft, draft.attempt);
      const pending = {
        ...submissionDraft,
        attempt,
        stage: "review",
        // Keep displayed line estimates with the saved attempt; API prices remain authoritative.
        items: draft.attempt ? draft.items : draft.items.map((item) => ({ ...item, selling_price: Number(submissionProducts.get(item.product_id)?.selling_price || 0) })),
      };
      // Persist before sending so reloads and connection retries reuse this request id.
      if (!writeQrDraft(localStorage, storageKey, pending)) throw new Error("Allow browser storage before sending your order so a connection retry cannot create a duplicate.");
      setDraft(pending);
      const receipt = await requestQrGuest("submit", { body: attempt });
      if (!receipt?.order_id || !receipt?.tracking_token) throw new Error("We could not confirm the order. Retry below to check the same order.");
      setDraft((current) => ({
        ...current,
        history: [...current.history, { receipt, items: current.items, notes: attempt.notes, table_number: attempt.table_number, customer_head_count: attempt.customer_head_count, order_type: attempt.order_type }],
        items: [], attempt: null, notes: "", stage: "orders",
      }));
    } catch (error) {
      setSubmitError(error.message || "Connection lost. Retry below to check the same order.");
      if ([400, 422].includes(error.status) || ["TABLE_UNAVAILABLE", "INVALID_CONTINUATION"].includes(error.code)) {
        setDraft((current) => ({ ...current, attempt: null }));
        setReload((value) => value + 1);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  const locationLabel = draft.order_type === "DINE IN" ? draft.table_number || "Choose a table" : "Take out";

  return (
    <main className="min-h-screen bg-[var(--color-darkerPrimary)] pb-28 font-[Poppins-Regular] text-[var(--color-lighter)]">
      <header className="border-b border-[var(--app-border)] bg-[var(--color-darkPrimary)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3"><div className="rounded-2xl bg-[var(--color-brandPrimary)] p-3 text-white"><FaUtensils aria-hidden="true" /></div><div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.18em] text-[var(--app-muted-text)]">{stage === "welcome" ? "Welcome to" : "Order at your table"}</p><h1 className="break-words font-[Poppins-SemiBold] text-sm sm:text-lg">{catalog?.business_name || "Restobill ordering"}</h1></div></div>
          {history.length > 0 ? <button type="button" disabled={frozen} onClick={() => goTo("orders")} className="shrink-0 rounded-full border border-[var(--app-border-strong)] px-3 py-2 text-xs font-[Poppins-Medium] disabled:opacity-50">My orders ({history.length})</button> : <FaWifi className="shrink-0 text-[var(--color-brandPrimary)]" aria-label="Restaurant Wi-Fi ordering" />}
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-5 pt-7 sm:px-8">
        {menuError && stage !== "orders" && <div role="alert" className="mb-6 rounded-2xl border border-[var(--color-redaccent)] bg-[var(--color-darkPrimary)] p-5"><p className="text-sm">{menuError}</p><p className="mt-2 text-xs text-[var(--app-muted-text)]">Connect to the restaurant Wi-Fi and keep this page open.</p><button type="button" onClick={() => setReload((value) => value + 1)} className="mt-3 font-[Poppins-SemiBold] text-[var(--color-brandPrimary)]">Reload menu</button></div>}
        {submitError && stage !== "review" && <p role="alert" className="mb-5 text-sm text-[var(--color-redaccent)]">{submitError}</p>}
        {tableUnavailable && !draft.attempt && stage !== "welcome" && <div role="status" className="mb-6 rounded-2xl border border-[var(--color-redaccent)] bg-[var(--color-darkPrimary)] p-5"><p className="text-sm leading-6">{tableUnavailableMessage}</p><div className="mt-3 flex flex-wrap gap-5 text-xs font-[Poppins-SemiBold] text-[var(--color-brandPrimary)]"><button type="button" onClick={() => setReload((value) => value + 1)}>Refresh table availability</button>{!table && !history.length && <button type="button" onClick={() => goTo("welcome")}>Choose another table</button>}</div></div>}
        {completedBill && validTable && !draft.attempt && <p role="status" className="mb-6 rounded-2xl border border-[var(--app-border-strong)] bg-[var(--color-darkPrimary)] p-4 text-sm leading-6">Your previous bill is {catalog.continuation.transaction_state === "paid" ? "paid" : "closed"}. Any new orders will start a new bill when our staff accepts them.</p>}

        {stage === "welcome" && <section className="mx-auto max-w-lg py-6 sm:py-12">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--color-brandPrimary)]">Settle in. Order something good.</p>
          <h2 className="font-[Poppins-SemiBold] text-4xl leading-tight">Welcome to<br />your table.</h2>
          <p className="mb-8 mt-4 text-sm leading-7 text-[var(--app-muted-text)]">Tell us where you’re seated and how many are joining you. Our team will receive your order at the counter.</p>
          <form className={panelClass} onSubmit={enterMenu}>
            <fieldset disabled={frozen || checkingTable || Boolean(history.length)} className="space-y-5">
              {(catalog?.order_types.length || 0) > 1 && <label className="block text-xs font-[Poppins-Medium]">Order type<select value={draft.order_type} onChange={(event) => { updateDraft({ order_type: event.target.value }); setCategory("All"); }} className={fieldClass}>{catalog.order_types.map((type) => <option key={type} value={type}>{type === "DINE IN" ? "Dine in" : "Take out"}</option>)}</select></label>}
              {draft.order_type === "DINE IN" ? <label className="block text-sm font-[Poppins-Medium]">Table name / number<select required value={draft.table_number} disabled={Boolean(table)} onFocus={() => setReload((value) => value + 1)} onChange={(event) => updateDraft({ table_number: event.target.value })} className={fieldClass}><option value="">Select the table given by our staff</option>{table && !catalog?.tables.some((item) => item.table_name === table) && <option value={table}>{table} — unavailable</option>}{catalog?.tables.map((item) => <option key={item.table_name} value={item.table_name} disabled={!canUseQrTable(catalog, "DINE IN", item.table_name)}>{item.table_name}{item.can_continue === true ? " — your current bill" : item.available === true ? "" : " — occupied / unavailable"}</option>)}</select>{catalog && draft.table_number && !validTable && <span className="mt-2 block text-xs leading-5 text-[var(--color-redaccent)]">This table has an open bill or is unavailable. {table ? "Please ask our staff for help." : "Choose an available table."}</span>}</label> : <p className="text-sm font-[Poppins-Medium]">Take out order</p>}
              <label className="block text-sm font-[Poppins-Medium]">Number of guests (pax)<input type="number" inputMode="numeric" min={1} max={99} required value={draft.customer_head_count} onChange={(event) => updateDraft({ customer_head_count: event.target.value })} className={fieldClass} /></label>
            </fieldset>
            <button type="submit" disabled={!catalog || !validTable || !validService || menuLoading || checkingTable || Boolean(menuError)} className={`${buttonClass} mt-7 w-full`}>{checkingTable ? "Checking your table…" : menuLoading ? "Loading menu…" : "Start ordering"}</button>
            {draft.order_type === "DINE IN" && <button type="button" onClick={() => setReload((value) => value + 1)} className="mt-4 w-full text-xs text-[var(--color-brandPrimary)]">Refresh table availability</button>}
            <p className="mt-4 text-center text-xs leading-5 text-[var(--app-muted-text)]">Stay connected to the restaurant Wi-Fi.</p>
          </form>
        </section>}

        {stage !== "welcome" && <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button type="button" disabled={frozen} onClick={() => goTo(stage === "menu" && !history.length ? "welcome" : "menu")} className="flex items-center gap-2 text-xs font-[Poppins-Medium] disabled:opacity-50"><FaArrowLeft aria-hidden="true" />{stage === "menu" && !history.length ? "Table details" : "Back to menu"}</button>
          <span className="rounded-full border border-[var(--app-border-strong)] bg-[var(--color-darkPrimary)] px-4 py-2 text-xs font-[Poppins-Medium]">{locationLabel} · {draft.customer_head_count} {Number(draft.customer_head_count) === 1 ? "guest" : "guests"}</span>
        </div>}

        {stage === "menu" && <section aria-label="Menu">
          <h2 className="font-[Poppins-SemiBold] text-3xl">Our menu</h2>
          <p className="mb-6 mt-2 text-sm text-[var(--app-muted-text)]">A little something for everyone at the table.</p>
          <label className="relative block"><FaSearch className="absolute left-4 top-4 text-[var(--app-muted-text)]" aria-hidden="true" /><span className="sr-only">Search the menu</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search dishes…" className="w-full rounded-2xl border border-[var(--app-border-strong)] bg-[var(--color-darkPrimary)] py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brandPrimary)]" /></label>
          <div className="my-5 flex gap-2 overflow-x-auto pb-2" aria-label="Menu categories">{categories.map((name) => <button type="button" key={name} aria-pressed={category === name} onClick={() => setCategory(name)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-[Poppins-Medium] ${category === name ? "border-[var(--color-brandPrimary)] bg-[var(--color-brandPrimary)] text-white" : "border-[var(--app-border-strong)] bg-[var(--color-darkPrimary)]"}`}>{name}</button>)}</div>
          {menuLoading ? <p role="status" className="py-12 text-center text-sm text-[var(--app-muted-text)]">Loading today’s menu…</p> : !menuError && !filteredProducts.length ? <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] p-10 text-center text-sm text-[var(--app-muted-text)]">{products.length ? "No dishes match your search." : "The menu is not available yet. Please ask a member of staff."}</div> : !menuError && <div className="space-y-3">{filteredProducts.map((product) => {
            const quantity = draft.items.find((item) => item.product_id === product.product_id)?.quantity || 0;
            return <article key={product.product_id} className="rounded-2xl border border-[var(--app-border)] bg-[var(--color-darkPrimary)] p-5"><div className="flex items-start justify-between gap-4"><div><p className="mb-1 text-[10px] uppercase tracking-widest text-[var(--color-brandPrimary)]">{product.item_category || "From the menu"}</p><h3 className="font-[Poppins-SemiBold] text-base">{product.item_name}</h3></div><span className="shrink-0 font-[Poppins-SemiBold]">{money(product.selling_price)}</span></div><div className="mt-3 flex items-end justify-between gap-4"><p className="text-xs leading-6 text-[var(--app-muted-text)]">{product.item_description !== product.item_name ? product.item_description : product.unit_of_measure}</p>{quantity ? quantityControl(product, quantity) : <button type="button" disabled={frozen} onClick={() => changeQuantity(product, 1)} aria-label={`Add ${product.item_name}`} className="flex shrink-0 items-center gap-2 rounded-xl bg-[var(--color-brandPrimary)] px-4 py-2.5 text-xs font-[Poppins-SemiBold] text-white disabled:opacity-40"><FaPlus size={10} /> Add</button>}</div></article>;
          })}</div>}
        </section>}

        {stage === "review" && <section className="mx-auto max-w-2xl">
          <h2 className="mb-2 font-[Poppins-SemiBold] text-3xl">Review your order</h2>
          <p className="mb-6 text-sm text-[var(--app-muted-text)]">One last look before we send it to the team.</p>
          <form onSubmit={submitOrder} className={panelClass}>
            <div className="space-y-5">
              {!draft.items.length && <p className="py-6 text-center text-sm text-[var(--app-muted-text)]">Your order is empty. Add a dish from the menu.</p>}
              {draft.items.map((item) => {
                const product = productMap.get(item.product_id);
                return <div key={item.product_id} className="border-b border-[var(--app-border)] pb-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-[Poppins-Medium]">{product?.item_name || item.item_name}</p><p className="mt-1 text-xs text-[var(--app-muted-text)]">{product ? money(Number(product.selling_price) * item.quantity) : "Unavailable — remove to continue"}</p></div>{quantityControl(product || item, item.quantity)}</div><input type="text" maxLength={255} disabled={frozen} value={item.item_instruction} onChange={(event) => updateDraft({ items: draft.items.map((row) => row.product_id === item.product_id ? { ...row, item_instruction: event.target.value } : row) })} aria-label={`Instructions for ${product?.item_name || item.item_name}`} placeholder="Preferences for this dish (optional)" className="mt-3 w-full rounded-lg border border-[var(--app-border)] bg-transparent p-2.5 text-xs outline-none focus:ring-2 focus:ring-[var(--color-brandPrimary)]" /></div>;
              })}
            </div>
            <fieldset disabled={frozen} className="mt-6 space-y-4">
              <label className="block text-xs font-[Poppins-Medium]">Your name <span className="font-[Poppins-Regular] text-[var(--app-muted-text)]">(optional)</span><input type="text" autoComplete="given-name" maxLength={100} value={draft.customer_name} onChange={(event) => updateDraft({ customer_name: event.target.value })} className={fieldClass} placeholder="Name" /></label>
              <label className="block text-xs font-[Poppins-Medium]">Notes for the kitchen <span className="font-[Poppins-Regular] text-[var(--app-muted-text)]">(optional)</span><textarea maxLength={1000} rows={3} value={draft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} placeholder="Anything our team should know?" className={`${fieldClass} resize-y`} /></label>
            </fieldset>
            <div className="my-6 space-y-3 rounded-2xl bg-[var(--color-darkerPrimary)] p-4 text-sm">
              <div className="flex justify-between gap-4"><span>Subtotal</span><span>{missingProducts ? "—" : money(totals.subtotal)}</span></div>
              {totals.charges.map((charge, index) => <div key={`${charge.particulars}-${index}`} className="flex justify-between gap-4 text-xs text-[var(--app-muted-text)]"><span>{charge.particulars}{charge.rate_type === "Percentage" ? ` (${charge.rate}%)` : ""}</span><span>{money(charge.amount)}</span></div>)}
              {!totals.charges.length && <div className="flex justify-between gap-4 text-xs text-[var(--app-muted-text)]"><span>Service charge</span><span>{money(0)}</span></div>}
              <div className="flex justify-between gap-4 border-t border-[var(--app-border)] pt-3 font-[Poppins-SemiBold] text-lg"><span>Estimated total</span><span>{missingProducts ? "—" : money(totals.total)}</span></div>
            </div>
            <p className="mb-5 text-xs leading-6 text-[var(--app-muted-text)]">Our staff will accept your order and confirm the final bill. Payment is handled by the cashier.</p>
            {draft.attempt && !submitting && <p role="status" className="mb-4 rounded-xl border border-[var(--app-border-strong)] p-3 text-xs leading-6">We are waiting for confirmation of your last attempt. Retry this same order to check it safely. Please ask staff before placing another order on a different device.</p>}
            {submitError && <p role="alert" className="mb-4 text-sm text-[var(--color-redaccent)]">{submitError}</p>}
            <button type="submit" disabled={submitting || (!draft.attempt && !canSubmit)} className={`${buttonClass} w-full`}>{submitting ? "Placing your order…" : draft.attempt ? "Retry / check this order" : "Place order"}</button>
          </form>
        </section>}

        {stage === "orders" && <section className="mx-auto max-w-2xl">
          <div className="mb-5 flex items-center gap-3 text-[var(--color-brandPrimary)]"><FaCheckCircle size={26} aria-hidden="true" /><span className="text-xs uppercase tracking-widest">Your order has been sent</span></div>
          <h2 className="font-[Poppins-SemiBold] text-3xl">My orders</h2>
          <p className="mb-6 mt-3 text-sm leading-7 text-[var(--app-muted-text)]">Our team will review your order shortly. Feel free to add more — your table details stay with you.</p>
          {trackingError && <p role="status" className="mb-4 text-sm text-[var(--app-muted-text)]">{trackingError}</p>}
          <div className="space-y-4" aria-live="polite">{history.map((order, index) => <article key={order.receipt.order_id} className={panelClass}>
            <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-[Poppins-SemiBold]">Order {index + 1}</h3><p className="mt-1 text-[10px] uppercase tracking-widest text-[var(--app-muted-text)]">{String(order.receipt.order_id).slice(0, 8)}</p></div><span className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${order.receipt.status === "rejected" ? "border-[var(--color-redaccent)] text-[var(--color-redaccent)]" : "border-[var(--app-border-strong)] text-[var(--color-brandPrimary)]"}`}>{order.receipt.status === "accepted" ? <FaCheckCircle aria-hidden="true" /> : <FaClock aria-hidden="true" />}{order.receipt.status === "accepted" ? order.receipt.transaction_state === "paid" ? "Paid" : order.receipt.transaction_state === "closed" ? "Bill closed" : "Accepted" : order.receipt.status === "rejected" ? "Not accepted" : "Awaiting staff"}</span></div>
            <ul className="space-y-3">{order.items.map((item) => <li key={item.product_id}><div className="flex justify-between gap-4 text-sm"><p><span className="mr-3 font-[Poppins-SemiBold]">{item.quantity}×</span>{item.item_name}</p>{Number.isFinite(item.selling_price) && <span className="shrink-0">{money(item.selling_price * item.quantity)}</span>}</div>{item.item_instruction && <p className="ml-7 mt-1 text-xs text-[var(--app-muted-text)]">{item.item_instruction}</p>}</li>)}</ul>
            <p className="mt-3 text-[10px] text-[var(--app-muted-text)]">Item prices are estimates from the menu when you ordered.</p>
            {order.notes && <p className="mt-4 text-xs leading-6 text-[var(--app-muted-text)]">Kitchen notes: {order.notes}</p>}
            {order.receipt.status === "rejected" && <p className="mt-4 text-sm text-[var(--color-redaccent)]">{order.receipt.rejection_reason || "Please speak with our staff about this order."}</p>}
            <div className="mt-5 flex justify-between gap-4 border-t border-[var(--app-border)] pt-4 text-sm font-[Poppins-SemiBold]"><span>Order estimate</span><span>{money(order.receipt.total_amount)}</span></div>
            {Number(order.receipt.service_charge_amount) > 0 && <p className="mt-2 text-right text-xs text-[var(--app-muted-text)]">Includes {money(order.receipt.service_charge_amount)} service charge</p>}
          </article>)}</div>
          <div className="my-6 flex justify-between gap-5 rounded-2xl bg-[var(--color-darkPrimary)] p-5 font-[Poppins-SemiBold] text-lg"><span>Current order estimates</span><span>{money(runningTotal)}</span></div>
          <p className="mb-5 text-xs leading-6 text-[var(--app-muted-text)]">Includes pending and unpaid orders on this device. Paid, closed and rejected orders are excluded. Charges and discounts are recalculated on your combined bill; the cashier confirms the final amount.</p>
          <button type="button" disabled={checkingTable || frozen} className={`${buttonClass} flex w-full items-center justify-center gap-3`} onClick={enterMenu}><FaPlus aria-hidden="true" /> {checkingTable ? "Checking your table…" : "Add more orders"}</button>
          {!pendingKey && history.length > 0 && <div className="mt-6 text-center">
            {!confirmNewVisit ? <button type="button" onClick={() => setConfirmNewVisit(true)} className="text-xs underline underline-offset-4 text-[var(--app-muted-text)]">Start a new visit</button> : <div className="rounded-2xl border border-[var(--app-border-strong)] p-5 text-left">
              <p className="text-sm font-[Poppins-Medium]">Start a new visit?</p>
              <p className="mt-2 text-xs leading-6 text-[var(--app-muted-text)]">This clears the cart and order history on this device. Orders already sent to our staff stay unchanged.</p>
              <div className="mt-4 flex justify-end gap-3"><button type="button" onClick={() => setConfirmNewVisit(false)} className="rounded-xl border border-[var(--app-border-strong)] px-4 py-2 text-xs">Keep this visit</button><button type="button" className={`${buttonClass} text-xs`} onClick={() => { setDraft(readQrDraft({ getItem: () => null }, storageKey, table)); setConfirmNewVisit(false); setCategory("All"); setSearch(""); setSubmitError(""); setTrackingError(""); setReload((value) => value + 1); }}>Start new visit</button></div>
            </div>}
          </div>}
        </section>}
        <p className="mt-10 text-center text-xs text-[var(--app-muted-text)]">Ordering powered by Restobill</p>
      </div>
      {stage === "menu" && <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--app-border)] bg-[var(--color-darkPrimary)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><div className="mx-auto max-w-3xl"><button type="button" disabled={!itemCount || frozen} onClick={() => goTo("review")} className={`${buttonClass} flex w-full items-center justify-between gap-4`}><span className="flex items-center gap-2"><FaShoppingBag aria-hidden="true" /> Review order · {itemCount}</span><span>{missingProducts ? "Review items" : money(totals.total)}</span></button></div></div>}
    </main>
  );
}

export default function GuestOrdering() {
  const { search } = useLocation();
  const table = new URLSearchParams(search).get("table") || "";
  return <GuestSession key={table} table={table} />;
}
