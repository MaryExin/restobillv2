// ProductImage.jsx
import React from "react";

export default function ProductImage({
  src,
  alt = "",
  className = "",
  wrapperClassName = "",
  fallbackSrc = "/logo.png",

  // ✅ new: for above-the-fold / important images
  priority = false,

  // ✅ new: don't shimmer forever
  maxWaitMs = 6000,
}) {
  const [loaded, setLoaded] = React.useState(false);
  const [displaySrc, setDisplaySrc] = React.useState(fallbackSrc);

  React.useEffect(() => {
    let cancelled = false;

    // reset state for new src
    setLoaded(false);

    // if src is empty/null, just show fallback immediately
    if (!src) {
      setDisplaySrc(fallbackSrc);
      setLoaded(true);
      return;
    }

    const img = new Image();

    // ✅ hint browser for priority loads
    // (supported in Chromium; safe to set)
    img.fetchPriority = priority ? "high" : "low";

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      // ✅ stop shimmer after max wait and show fallback
      setDisplaySrc(fallbackSrc);
      setLoaded(true);
    }, maxWaitMs);

    img.onload = () => {
      if (cancelled) return;
      window.clearTimeout(timeoutId);
      setDisplaySrc(src);
      setLoaded(true);
    };

    img.onerror = () => {
      if (cancelled) return;
      window.clearTimeout(timeoutId);
      setDisplaySrc(fallbackSrc);
      setLoaded(true);
    };

    // start preload
    img.src = src;

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [src, fallbackSrc, priority, maxWaitMs]);

  return (
    <div
      className={[
        "relative w-full h-40 overflow-hidden",
        "bg-zinc-100/70 flex items-center justify-center",
        wrapperClassName,
      ].join(" ")}
    >
      {/* shimmer (below) */}
      {!loaded && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-zinc-200/80" />
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.1s_infinite] bg-gradient-to-r from-transparent via-white/75 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />
        </div>
      )}

      {/* image (above) */}
      <img
        src={displaySrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchpriority={priority ? "high" : "low"}
        className={[
          "relative z-10 w-full h-full object-cover transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0",
          className,
        ].join(" ")}
        draggable={false}
      />

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(120%); }
        }
        .animate-\\[shimmer_1\\.1s_infinite\\] {
          animation: shimmer 1.1s linear infinite;
        }
      `}</style>
    </div>
  );
}
