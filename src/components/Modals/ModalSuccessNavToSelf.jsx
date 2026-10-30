import React, { useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { FaCheckCircle } from "react-icons/fa";
import useZustandAPIEndpoint from "../../context/useZustandAPIEndpoint";

const ModalSuccessNavToSelf = ({
  header = "Saved Successfully",
  message = "Your changes have been saved.",
  button = "OK",
  setIsModalOpen,
  resetForm,
  dataTour,
  dataTourBtn,
}) => {
  const { endpoint, setEndPoint } = useZustandAPIEndpoint();

  const handleClose = useCallback(() => {
    setIsModalOpen(false);
    resetForm && resetForm();
  }, [setIsModalOpen, resetForm]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose]);

  const modalContent = (
    <div
      className="ui-fade-in fixed inset-0 z-[340] flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.55)",
      }}
    >
      <div
        data-tour={dataTour}
        className="ui-scale-in w-full max-w-sm rounded-3xl border p-8 text-center shadow-2xl transition-colors"
        style={{
          borderColor: "var(--app-border)",
          backgroundColor: "var(--app-surface)",
          color: "var(--app-text)",
        }}
      >
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            backgroundColor: "var(--app-surface-soft)",
            color: "var(--app-accent)",
            border: "1px solid var(--app-border)",
          }}
        >
          <FaCheckCircle size={24} />
        </div>

        <h3
          className="mb-2 text-xl font-black"
          style={{ color: "var(--app-text)" }}
        >
          {header}
        </h3>

        <p className="mb-6 text-sm" style={{ color: "var(--app-muted-text)" }}>
          {message}
        </p>

        <div data-tour={dataTourBtn}>
          <button
            onClick={handleClose}
            className="hover:opacity-90 active:opacity-80 transition-opacity duration-150 w-full rounded-2xl py-3 font-bold text-white transition"
            style={{
              background:
                "linear-gradient(180deg, var(--app-accent) 0%, var(--app-accent-secondary) 100%)",
              boxShadow: "0 12px 28px var(--app-accent-glow)",
            }}
            autoFocus
          >
            {button}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ModalSuccessNavToSelf;
