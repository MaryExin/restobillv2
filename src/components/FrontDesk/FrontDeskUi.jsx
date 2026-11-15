/* eslint-disable react/prop-types */
import { FaTimes } from "react-icons/fa";

// Small shared pieces for the front desk screens (same look as Room Service).

export const fieldClass =
  "w-full rounded-xl border px-3.5 py-2.5 font-[Poppins-Regular] text-[14px] outline-none";

export const fieldStyle = (invalid) => ({
  borderColor: invalid ? "#f43f5e" : "var(--app-border)",
  backgroundColor: "var(--app-surface)",
  color: "var(--app-text)",
});

export const Label = ({ htmlFor, children, hint }) => (
  <label
    htmlFor={htmlFor}
    className="mb-1.5 block font-[Poppins-SemiBold] text-[12px] uppercase tracking-[0.12em]"
    style={{ color: "var(--app-muted-text)" }}
  >
    {children}
    {hint ? (
      <span className="ml-1 font-[Poppins-Regular] normal-case tracking-normal">({hint})</span>
    ) : null}
  </label>
);

export const Card = ({ children, className = "" }) => (
  <section
    className={`rounded-2xl border p-5 ${className}`}
    style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-surface)" }}
  >
    {children}
  </section>
);

export const Button = ({ children, onClick, disabled, variant = "outline", type = "button", title, className = "" }) => {
  const styles = {
    primary: { backgroundColor: "var(--app-accent)", color: "#fff", borderColor: "var(--app-accent)" },
    danger: { backgroundColor: "transparent", color: "#be123c", borderColor: "rgba(244,63,94,0.45)" },
    outline: { backgroundColor: "var(--app-surface)", color: "var(--app-text)", borderColor: "var(--app-border)" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 font-[Poppins-SemiBold] text-[13px] transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={styles[variant] || styles.outline}
    >
      {children}
    </button>
  );
};

export const ErrorBox = ({ message }) =>
  message ? (
    <p
      className="rounded-xl border px-3.5 py-2.5 font-[Poppins-Medium] text-[13px]"
      style={{ color: "#be123c", borderColor: "rgba(244,63,94,0.35)", backgroundColor: "rgba(244,63,94,0.08)" }}
    >
      {message}
    </p>
  ) : null;

export const Modal = ({ title, subtitle, onClose, children, footer, width = "max-w-2xl", busy }) => (
  <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
    <div
      className={`flex max-h-[92vh] w-full ${width} flex-col overflow-hidden rounded-2xl border shadow-2xl`}
      style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-surface)", color: "var(--app-text)" }}
    >
      <div className="flex items-start justify-between gap-4 border-b px-5 py-4" style={{ borderColor: "var(--app-border)" }}>
        <div className="min-w-0">
          <h3 className="font-[Poppins-Bold] text-[18px] leading-tight">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 font-[Poppins-Regular] text-[13px]" style={{ color: "var(--app-muted-text)" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg border p-2 transition hover:opacity-80 disabled:opacity-50"
          style={{ borderColor: "var(--app-border)", color: "var(--app-muted-text)" }}
          aria-label="Close"
        >
          <FaTimes size={12} />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">{children}</div>
      {footer ? (
        <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-4" style={{ borderColor: "var(--app-border)" }}>
          {footer}
        </div>
      ) : null}
    </div>
  </div>
);

export const StatusPill = ({ status }) => {
  const tones = {
    "In-House": ["#047857", "rgba(16,185,129,0.14)"],
    "Checked Out": ["#475569", "rgba(100,116,139,0.14)"],
    Cancelled: ["#be123c", "rgba(244,63,94,0.12)"],
    Active: ["#047857", "rgba(16,185,129,0.14)"],
    Inactive: ["#475569", "rgba(100,116,139,0.14)"],
    Reversed: ["#be123c", "rgba(244,63,94,0.12)"],
  };
  const [color, background] = tones[status] || tones.Inactive;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 font-[Poppins-SemiBold] text-[11px]"
      style={{ color, backgroundColor: background }}
    >
      {status}
    </span>
  );
};

export const Muted = ({ children, className = "" }) => (
  <span className={`font-[Poppins-Regular] text-[13px] ${className}`} style={{ color: "var(--app-muted-text)" }}>
    {children}
  </span>
);
