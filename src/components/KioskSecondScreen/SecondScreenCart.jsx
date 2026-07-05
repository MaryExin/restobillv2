import React, { useMemo, useState, useEffect, useRef } from "react";
import useApiHost from "../../hooks/useApiHost";

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatPeso = (v) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(v || 0));

// Auto-fit tiers: font + padding compress as item count grows
const getFitStyle = (count) => {
  if (count <= 6)  return { fontSize: "17px", padding: "11px 14px", flex: "0 1 auto", minHeight: 0 };
  if (count <= 10) return { fontSize: "15px", padding: "8px 14px",  flex: "0 1 auto", minHeight: 0 };
  if (count <= 15) return { fontSize: "13px", padding: "5px 12px",  flex: "1 1 auto", minHeight: 0 };
  if (count <= 22) return { fontSize: "11px", padding: "3px 10px",  flex: "1 1 auto", minHeight: 0 };
  if (count <= 32) return { fontSize: "10px", padding: "2px 8px",   flex: "1 1 auto", minHeight: 0 };
  if (count <= 45) return { fontSize: "9px",  padding: "1px 6px",   flex: "1 1 auto", minHeight: 0 };
  return                  { fontSize: "8px",  padding: "0.5px 4px", flex: "1 1 auto", minHeight: 0 };
};

// ── Sub-components (all locked to light mode) ─────────────────────────────────

const CartPanel = ({ groupedItems, totalItems, totalPrice, count }) => {
  const style = getFitStyle(count);
  return (
    <div className="w-1/2 h-full flex flex-col bg-white border-r border-slate-200/80 overflow-hidden">
      {/* Header */}
      <div className="flex items-end justify-between px-6 pt-5 pb-3 flex-shrink-0">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-600 mb-0.5">
            Order Details
          </p>
          <h1 className="text-2xl italic font-black leading-none tracking-tight uppercase text-slate-900">
            Current Cart
          </h1>
        </div>
        <span className="bg-cyan-500 text-white text-[10px] font-black px-3 py-1 rounded-full">
          {totalItems} ITEMS
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-12 gap-1 px-5 pb-2 text-[9px] font-black uppercase tracking-widest text-slate-400 flex-shrink-0 border-b border-slate-100">
        <div className="col-span-7">Description</div>
        <div className="col-span-2 text-center">Qty</div>
        <div className="col-span-3 text-right">Price</div>
      </div>

      {/* Items — flex-1 + overflow-hidden = auto-compress */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {groupedItems.map((item, idx) => (
          <React.Fragment key={item.lineId || idx}>
            <div
              className="grid grid-cols-12 gap-1 items-start border-b border-slate-100 hover:bg-slate-50/60"
              style={{ ...style, paddingLeft: "20px", paddingRight: "20px" }}
            >
              <div className="col-span-7 font-semibold leading-snug uppercase text-slate-800 break-words whitespace-normal pt-0.5">
                {item.name || item.code}
              </div>
              <div className="col-span-2 text-center font-black text-cyan-600">
                {item.quantity}
              </div>
              <div className="col-span-3 text-right font-bold text-slate-700 tracking-tight">
                {formatPeso(Number(item.quantity) * Number(item.price))}
              </div>
            </div>
            {item.children.map((addon, ai) => (
              <div
                key={addon.lineId || `${idx}-${ai}`}
                className="grid grid-cols-12 gap-1 items-start border-b border-slate-50 bg-slate-50/40"
                style={{
                  fontSize: `calc(${style.fontSize} * 0.85)`,
                  padding: `calc(${style.padding.split(" ")[0]} * 0.7) 24px`,
                  flex: style.flex,
                  minHeight: style.minHeight,
                }}
              >
                <div className="col-span-7 italic font-medium leading-snug uppercase text-cyan-600/80 break-words whitespace-normal pt-0.5">
                  + {addon.name || addon.code}
                </div>
                <div className="col-span-2 text-center font-bold text-slate-500">{addon.quantity}</div>
                <div className="col-span-3 text-right font-bold text-slate-500 tracking-tight">
                  {formatPeso(Number(addon.quantity) * Number(addon.price))}
                </div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* Total */}
      <div className="flex-shrink-0 mx-4 mb-4 mt-3 rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Total Payable
          </span>
          <span className="text-3xl font-black tracking-tighter text-emerald-700">
            {formatPeso(totalPrice)}
          </span>
        </div>
      </div>
    </div>
  );
};

const QRPanel = ({ paymentMethod, serverOrigin }) => {
  const normalized = paymentMethod
    ? String(paymentMethod).toUpperCase().replace(/\s+/g, "_")
    : null;

  const [src, setSrc] = useState(null);
  const triedJpg = useRef(false);

  useEffect(() => {
    if (!normalized || !serverOrigin) { setSrc(null); return; }
    triedJpg.current = false;
    setSrc(`${serverOrigin}/pos_second_screen/${normalized}_QR.png`);
  }, [normalized, serverOrigin]);

  const onError = () => {
    if (!triedJpg.current) {
      triedJpg.current = true;
      setSrc(`${serverOrigin}/pos_second_screen/${normalized}_QR.jpg`);
    } else {
      setSrc(null);
    }
  };

  return (
    <div className="w-1/2 h-full bg-slate-50 flex flex-col items-center justify-center gap-5 px-8 py-6">
      <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">
        {paymentMethod || "Payment"} · Scan to Pay
      </p>

      {src ? (
        <div className="bg-white rounded-[2rem] p-5 shadow-xl ring-1 ring-slate-200">
          <img
            src={src}
            alt={`${paymentMethod} QR`}
            draggable={false}
            className="w-64 h-64 object-contain select-none"
            onError={onError}
          />
        </div>
      ) : (
        <div className="w-64 h-64 rounded-[2rem] border-2 border-dashed border-slate-300 flex items-center justify-center">
          <p className="text-[10px] uppercase tracking-widest text-slate-300 text-center leading-relaxed px-6">
            Place<br />{normalized || "METHOD"}_QR.png<br />in htdocs/pos_second_screen/
          </p>
        </div>
      )}

      <div className="text-center">
        <p className="text-2xl font-black italic tracking-tight uppercase text-cyan-600 animate-pulse">
          {paymentMethod}
        </p>
        <p className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-400 mt-1">
          QR Code
        </p>
      </div>
    </div>
  );
};

const PromoPanel = ({ imageUrl, imageError, onImageError, fullWidth = false }) => (
  <div
    className={`${fullWidth ? "w-full" : "w-1/2"} h-full relative bg-slate-100 flex items-center justify-center overflow-hidden`}
  >
    {!imageError ? (
      <img
        src={imageUrl}
        alt="Promotion"
        draggable={false}
        className="w-full h-full object-cover select-none"
        onError={onImageError}
      />
    ) : (
      <div className="text-4xl font-black italic uppercase text-slate-300 tracking-widest text-center">
        Store Promo
      </div>
    )}
  </div>
);

const BottomBar = ({ tickerText, currentTime }) => (
  <div className="flex-shrink-0 bg-white shadow-[0_-2px_16px_rgba(15,23,42,0.06)]">
    <div className="h-px w-full bg-slate-200 relative overflow-hidden">
      <div className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-scan" />
    </div>
    <div className="h-14 flex items-center overflow-hidden">
      {/* Welcome chip */}
      <div className="flex-shrink-0 h-full px-8 flex items-center bg-cyan-500 relative z-10">
        <span className="text-[16px] font-black italic uppercase tracking-tighter text-white">WELCOME</span>
        <div className="absolute top-0 -right-3.5 h-full w-3.5 text-cyan-500">
          <svg viewBox="0 0 20 100" className="h-full fill-current"><path d="M0 0 L20 50 L0 100 Z" /></svg>
        </div>
      </div>
      {/* Centered ticker — same pulse as idle "Ready to serve you" */}
      <div className="flex-1 flex items-center justify-center px-6 overflow-hidden">
        <p className="animate-pulse text-[22px] font-black uppercase tracking-wider text-cyan-600 truncate">
          {tickerText}
        </p>
      </div>
      {/* Clock */}
      <div className="flex-shrink-0 px-7 border-l border-slate-100 text-right">
        <p className="text-[18px] font-black italic leading-none text-slate-800">
          {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
          {currentTime.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
        </p>
      </div>
    </div>
  </div>
);

const GlobalStyles = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    @keyframes scan { 0%{transform:translateX(-100%)} 100%{transform:translateX(300%)} }
    .animate-scan { animation: scan 4s cubic-bezier(0.4,0,0.6,1) infinite; }
  `}} />
);

// ── Main Component ────────────────────────────────────────────────────────────

const SecondScreenCart = () => {
  // Separate: cart data vs. display phase
  const [ipcCart, setIpcCart] = useState(null);
  const [screenPhase, setScreenPhase] = useState("idle"); // "idle" | "transaction" | "payment"
  const [activePaymentMethod, setActivePaymentMethod] = useState(null);

  // Force fullscreen on mount (Electron already sets it; browser API is the fallback)
  useEffect(() => {
    const go = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen({ navigationUI: "hide" });
        }
      } catch {}
    };
    go();
  }, []);

  // IPC listener — split phase from cart data
  useEffect(() => {
    if (!window.kioskAPI?.onCartUpdate) return;
    const handler = (data) => {
      setImageBust(new Date().getTime());
      setImageError(false);
      if (data?.phase === "payment") {
        setScreenPhase("payment");
        setActivePaymentMethod(data?.paymentMethod || null);
        // If items were sent with the QR payload, update the cart panel too
        if (Array.isArray(data?.items) && data.items.length > 0) {
          setIpcCart((prev) => ({ ...(prev || {}), items: data.items }));
        }
      } else {
        // "transaction" or "idle" (isClear / empty items)
        setIpcCart(data);
        const hasItems = Array.isArray(data?.items) && data.items.length > 0;
        setScreenPhase(hasItems ? "transaction" : "idle");
        setActivePaymentMethod(null);
      }
    };
    window.kioskAPI.onCartUpdate(handler);
    return () => window.kioskAPI.offCartUpdate?.(handler);
  }, []);

  const apiHost = useApiHost();
  const serverOrigin = useMemo(() => {
    if (!apiHost) return "http://localhost";
    try { return new URL(apiHost).origin; } catch { return "http://localhost"; }
  }, [apiHost]);

  const [imageBust, setImageBust] = useState(() => new Date().getTime());
  const displayImageUrl = useMemo(
    () => `${serverOrigin}/pos_second_screen/display.jpg?t=${imageBust}`,
    [serverOrigin, imageBust],
  );
  const API_URL   = `${serverOrigin}/api/get_announcement.php`;

  const safeItems = Array.isArray(ipcCart?.items) ? ipcCart.items : [];

  const totalItems = useMemo(() => safeItems.reduce((s, i) => s + Number(i.quantity || 0), 0), [safeItems]);
  const totalPrice = useMemo(() => safeItems.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.price || 0), 0), [safeItems]);

  const groupedItems = useMemo(() => {
    const groups = [];
    safeItems.forEach((item) => {
      const isAddon =
        item.isAddOn ||
        (item.category && String(item.category).toUpperCase().includes("ADD ON")) ||
        (item.name && String(item.name).toUpperCase().includes("ADD-ON"));
      if (isAddon && groups.length > 0) {
        groups[groups.length - 1].children.push(item);
      } else {
        groups.push({ ...item, children: [] });
      }
    });
    return groups;
  }, [safeItems]);

  const [tickerText, setTickerText] = useState("Welcome to our store! Happy to serve you.");

  // Load announcement from DB
  useEffect(() => {
    if (!apiHost) return;
    fetch(`${apiHost}/pos_second_screen_settings.php`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const text = data?.data?.announcement;
        if (text) setTickerText(text);
      })
      .catch(() => {});
  }, [apiHost]);
  const [imageError, setImageError] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showSuccess, setShowSuccess] = useState(false);
  const prevCount = useRef(0);

  useEffect(() => { setImageError(false); }, [serverOrigin, imageBust]);

  useEffect(() => {
    const refreshImage = () => {
      setImageBust(new Date().getTime());
      setImageError(false);
    };
    const handleStorage = (event) => {
      if (
        event.key === "pos-second-screen-image-bust" ||
        event.key === "pos-layout-mode-bust"
      ) {
        refreshImage();
      }
    };

    window.addEventListener("pos-second-screen-image-updated", refreshImage);
    window.addEventListener("pos-layout-mode-changed", refreshImage);
    window.addEventListener("storage", handleStorage);

    let channel = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel("pos-second-screen");
      channel.onmessage = (event) => {
        if (
          event?.data?.type === "display-image-updated" ||
          event?.data?.type === "layout-mode-changed"
        ) {
          refreshImage();
        }
      };
    }

    return () => {
      window.removeEventListener("pos-second-screen-image-updated", refreshImage);
      window.removeEventListener("pos-layout-mode-changed", refreshImage);
      window.removeEventListener("storage", handleStorage);
      channel?.close();
    };
  }, []);

  useEffect(() => {
    const count = safeItems.length;
    // Only show success when a completed order clears (not a manual clear)
    if (prevCount.current > 0 && count === 0 && !ipcCart?.isClear) {
      setShowSuccess(true);
      const t = setTimeout(() => setShowSuccess(false), 8000);
      return () => clearTimeout(t);
    }
    if (count > 0 || ipcCart?.isClear) setShowSuccess(false);
    prevCount.current = count;
  }, [safeItems.length, ipcCart?.isClear]);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!serverOrigin) return;
    const fetch_ = async () => {
      try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`);
        if (res.ok) { const d = await res.json(); if (d?.message) setTickerText(d.message); }
      } catch {}
    };
    fetch_();
    const id = setInterval(fetch_, 5000);
    return () => clearInterval(id);
  }, [API_URL, serverOrigin]);

  // ── Render ────────────────────────────────────────────────────────────────

  // IDLE — full display.jpg with optional success splash
  if (screenPhase === "idle") {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col relative select-none font-sans bg-slate-50 text-slate-900">
        <div className="flex-1 relative min-h-0">
          <PromoPanel imageUrl={displayImageUrl} imageError={imageError} onImageError={() => setImageError(true)} fullWidth />
          {/* Idle overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-[1px]">
            <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-[3rem] px-14 py-10 text-center shadow-2xl">
              {showSuccess ? (
                <>
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center">
                    <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-4xl italic font-black tracking-tight uppercase text-emerald-600 mb-2">Order Placed!</p>
                  <p className="text-lg font-medium text-slate-600">Thank you! Your order is being prepared.</p>
                </>
              ) : (
                <p className="text-2xl font-light tracking-[0.45em] uppercase text-slate-600 animate-pulse">
                  Ready to serve you
                </p>
              )}
            </div>
          </div>
        </div>
        <BottomBar tickerText={tickerText} currentTime={currentTime} />
        <GlobalStyles />
      </div>
    );
  }

  // TRANSACTION — 50/50: cart left, display.jpg right
  if (screenPhase === "transaction") {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col relative select-none font-sans bg-slate-50 text-slate-900">
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <CartPanel
            groupedItems={groupedItems}
            totalItems={totalItems}
            totalPrice={totalPrice}
            count={safeItems.length}
          />
          <PromoPanel imageUrl={displayImageUrl} imageError={imageError} onImageError={() => setImageError(true)} />
        </div>
        <BottomBar tickerText={tickerText} currentTime={currentTime} />
        <GlobalStyles />
      </div>
    );
  }

  // PAYMENT — 50/50: cart left, QR code right
  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col relative select-none font-sans bg-slate-50 text-slate-900">
      {/* Accent stripe */}
      <div className="flex-shrink-0 h-1" style={{ background: "linear-gradient(90deg,#10b981,#06b6d4,#8b5cf6)" }} />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <CartPanel
          groupedItems={groupedItems}
          totalItems={totalItems}
          totalPrice={totalPrice}
          count={safeItems.length}
        />
        <QRPanel paymentMethod={activePaymentMethod} serverOrigin={serverOrigin} />
      </div>
      <BottomBar tickerText={tickerText} currentTime={currentTime} />
      <GlobalStyles />
    </div>
  );
};

export default SecondScreenCart;
