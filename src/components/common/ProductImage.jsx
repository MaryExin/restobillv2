import React from "react";

const ProductImage = React.memo(function ProductImage({
  src,
  alt = "",
  className = "",
  wrapperClassName = "",
  fallbackSrc = "/richwell-icon.png",
  priority = false,
}) {
  return (
    <div
      className={[
        "relative w-full h-40 overflow-hidden",
        "bg-zinc-100/70 flex items-center justify-center",
        wrapperClassName,
      ].join(" ")}
    >
      {/* Let Chromium schedule offscreen images instead of preloading every card. */}
      <img
        key={`${src || ""}|${fallbackSrc}`}
        src={src || fallbackSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchpriority={priority ? "high" : "low"}
        className={`relative z-10 w-full h-full object-cover ${className}`}
        onError={(event) => {
          const image = event.currentTarget;
          // A failed fallback must not trigger an endless retry loop.
          if (image.getAttribute("src") !== fallbackSrc) {
            image.src = fallbackSrc;
          }
        }}
        draggable={false}
      />
    </div>
  );
});

export default ProductImage;
