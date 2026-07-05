import React, { useEffect, useState, useRef } from "react";
import useApiHost from "../../hooks/useApiHost";

const SLIDE_INTERVAL_MS = 8000;
const FADE_DURATION_MS  = 1000;

const Placeholder = () => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-black select-none">
    <div
      className="w-28 h-28 rounded-full flex items-center justify-center mb-8"
      style={{ background: "rgba(255,255,255,0.06)" }}
    >
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none"
        stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h.01M14 17h.01M17 14h.01M17 17h4" />
      </svg>
    </div>
    <p className="text-white/30 text-sm tracking-widest uppercase">
      Place banners in
    </p>
    <p className="text-white/60 text-base font-semibold mt-1 tracking-wider">
      htdocs / pos_second_screen
    </p>
  </div>
);

const KioskSecondScreen = () => {
  const apiHost   = useApiHost();
  const [images, setImages]         = useState([]);
  const [current, setCurrent]       = useState(0);
  const [visible, setVisible]       = useState(0);
  const [loading, setLoading]       = useState(true);
  const intervalRef = useRef(null);
  const fadeRef     = useRef(null);

  // ── Fetch image list ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!apiHost) return;

    fetch(`${apiHost}/api/pos_second_screen.php`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "success" && data.images.length > 0) {
          // Derive the server origin from apiHost (strips the /pos folder)
          const origin = new URL(apiHost).origin;
          setImages(
            data.images.map(
              (fname) => `${origin}${data.base_path}${fname}`,
            ),
          );
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [apiHost]);

  // ── Slideshow ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (images.length <= 1) return;

    intervalRef.current = setInterval(() => {
      // Fade out current, then swap index, then fade in
      setVisible(-1); // -1 = mid-transition (all invisible)
      fadeRef.current = setTimeout(() => {
        setCurrent((i) => (i + 1) % images.length);
        setVisible(0); // fade in
      }, FADE_DURATION_MS);
    }, SLIDE_INTERVAL_MS);

    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(fadeRef.current);
    };
  }, [images]);

  if (loading) {
    return <div className="fixed inset-0 bg-black" />;
  }

  if (images.length === 0) {
    return <Placeholder />;
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none">
      {images.map((src, idx) => {
        const offset = (idx - current + images.length) % images.length;
        const isActive = offset === 0;

        return (
          <img
            key={src}
            src={src}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: isActive && visible !== -1 ? 1 : 0,
              transition: `opacity ${FADE_DURATION_MS}ms ease-in-out`,
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* Dot indicators (only if more than one image) */}
      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {images.map((_, idx) => (
            <span
              key={idx}
              className="block rounded-full transition-all duration-500"
              style={{
                width:  idx === current ? 20 : 8,
                height: 8,
                background: idx === current
                  ? "rgba(255,255,255,0.9)"
                  : "rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default KioskSecondScreen;
