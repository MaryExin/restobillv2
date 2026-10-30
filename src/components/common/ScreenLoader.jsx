const ScreenLoader = () => (
  <div
    role="status"
    aria-live="polite"
    className="flex min-h-screen items-center justify-center font-[Poppins-Regular]"
    style={{
      backgroundColor: "var(--color-darkerPrimary)",
      color: "var(--color-lighter)",
    }}
  >
    Loading…
  </div>
);

export default ScreenLoader;
