"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  FiBriefcase,
  FiEdit3,
  FiX,
  FiLoader,
  FiSave,
  FiRefreshCw,
  FiCheckCircle,
  FiAlertTriangle,
  FiRotateCcw,
  FiShield,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import useBusinessInfo from "../../../hooks/useBusinessInfo";

const EMPTY_FORM = {
  companyName: "",
  storeName: "",
  corpName: "",
  address: "",
  tin: "",
  machineNumber: "",
  serialNumber: "",
  posProviderName: "",
  posProviderAddress: "",
  posProviderTin: "",
  posProviderBirAccreNo: "",
  posProviderAccreDateIssued: "",
  posProviderPTUNo: "",
  posProviderPTUDateIssued: "",
};

const PosBusinessInfoManager = ({ isDark, accent, getContrastText }) => {
  const { businessInfo, isLoading, error, refetchBusinessInfo } =
    useBusinessInfo();

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({
    type: "",
    message: "",
  });
  const [lastBackupPath, setLastBackupPath] = useState("");

  useEffect(() => {
    setFormData({
      companyName: businessInfo?.companyName || "",
      storeName: businessInfo?.storeName || "",
      corpName: businessInfo?.corpName || "",
      address: businessInfo?.address || "",
      tin: businessInfo?.tin || "",
      machineNumber: businessInfo?.machineNumber || "",
      serialNumber: businessInfo?.serialNumber || "",
      posProviderName: businessInfo?.posProviderName || "",
      posProviderAddress: businessInfo?.posProviderAddress || "",
      posProviderTin: businessInfo?.posProviderTin || "",
      posProviderBirAccreNo: businessInfo?.posProviderBirAccreNo || "",
      posProviderAccreDateIssued:
        businessInfo?.posProviderAccreDateIssued || "",
      posProviderPTUNo: businessInfo?.posProviderPTUNo || "",
      posProviderPTUDateIssued: businessInfo?.posProviderPTUDateIssued || "",
    });
  }, [businessInfo]);

  const theme = {
    panel: isDark
      ? "border-white/5 bg-white/[0.03]"
      : "border-slate-200 bg-white",
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-white/40" : "text-slate-500",
    input: isDark
      ? "bg-white/5 border-white/10 text-white"
      : "bg-slate-50 border-slate-200 text-slate-900",
    subPanel: isDark ? "bg-white/[0.04]" : "bg-slate-50",
  };

  const contrast = getContrastText ? getContrastText() : "#fff";

  const fields = [
    { id: "companyName", label: "Company Name" },
    { id: "storeName", label: "Store Name" },
    { id: "corpName", label: "Corporation Name" },
    { id: "address", label: "Address", multiline: true },
    { id: "tin", label: "TIN" },
    { id: "machineNumber", label: "Machine Number" },
    { id: "serialNumber", label: "Serial Number" },
    { id: "posProviderName", label: "POS Provider Name" },
    {
      id: "posProviderAddress",
      label: "POS Provider Address",
      multiline: true,
    },
    { id: "posProviderTin", label: "POS Provider TIN" },
    { id: "posProviderBirAccreNo", label: "BIR Accreditation No." },
    { id: "posProviderAccreDateIssued", label: "Accreditation Date Issued" },
    { id: "posProviderPTUNo", label: "PTU No." },
    { id: "posProviderPTUDateIssued", label: "PTU Date Issued" },
  ];

  const previewRows = useMemo(
    () => [
      formData.companyName || "COMPANY NAME",
      formData.storeName || "STORE NAME",
      formData.corpName || "CORPORATION NAME",
    ],
    [formData.companyName, formData.storeName, formData.corpName],
  );

  const resetFormToCurrent = () => {
    setFeedback({ type: "", message: "" });
    setFormData({
      companyName: businessInfo?.companyName || "",
      storeName: businessInfo?.storeName || "",
      corpName: businessInfo?.corpName || "",
      address: businessInfo?.address || "",
      tin: businessInfo?.tin || "",
      machineNumber: businessInfo?.machineNumber || "",
      serialNumber: businessInfo?.serialNumber || "",
      posProviderName: businessInfo?.posProviderName || "",
      posProviderAddress: businessInfo?.posProviderAddress || "",
      posProviderTin: businessInfo?.posProviderTin || "",
      posProviderBirAccreNo: businessInfo?.posProviderBirAccreNo || "",
      posProviderAccreDateIssued:
        businessInfo?.posProviderAccreDateIssued || "",
      posProviderPTUNo: businessInfo?.posProviderPTUNo || "",
      posProviderPTUDateIssued: businessInfo?.posProviderPTUDateIssued || "",
    });
  };

  const resetFormToDefaults = () => {
    setFeedback({ type: "", message: "" });
    setFormData(EMPTY_FORM);
  };

  const handleOpenModal = () => {
    setLastBackupPath("");
    setFeedback({ type: "", message: "" });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setFeedback({ type: "", message: "" });
    setLastBackupPath("");
    resetFormToCurrent();
  };

  const handleChange = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    setFeedback({ type: "", message: "" });
    setLastBackupPath("");

    if (!window?.appConfig?.saveBusinessInfo) {
      setFeedback({
        type: "error",
        message: "Save API is not available in Electron preload.",
      });
      return;
    }

    if (!String(formData.companyName || "").trim()) {
      setFeedback({
        type: "error",
        message: "Company Name is required.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const result = await window.appConfig.saveBusinessInfo(formData);

      if (!result?.success) {
        throw new Error(result?.message || "Failed to save business info.");
      }

      setLastBackupPath(result?.backupPath || "");
      await refetchBusinessInfo();

      setFeedback({
        type: "success",
        message: "Business information saved successfully.",
      });

      setTimeout(() => {
        setIsModalOpen(false);
      }, 900);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err?.message || "Failed to save business info.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaultsFile = async () => {
    setFeedback({ type: "", message: "" });
    setLastBackupPath("");

    if (!window?.appConfig?.resetBusinessInfoDefaults) {
      setFeedback({
        type: "error",
        message: "Reset defaults API is not available in Electron preload.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const result = await window.appConfig.resetBusinessInfoDefaults();

      if (!result?.success) {
        throw new Error(result?.message || "Failed to reset business info.");
      }

      setLastBackupPath(result?.backupPath || "");
      await refetchBusinessInfo();

      setFeedback({
        type: "success",
        message: "Business information reset to defaults.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err?.message || "Failed to reset business info.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <FiLoader className="animate-spin text-4xl" style={{ color: accent }} />
      </div>
    );
  }

  return (
    <div className="space-y-8 text-left">
      <div
        className={`flex flex-col items-center justify-between gap-12 rounded-[50px] border p-12 lg:flex-row ${theme.panel}`}
      >
        <div className="flex items-center gap-10">
          <div
            className="flex h-28 w-28 items-center justify-center rounded-[35px] shadow-2xl"
            style={{ backgroundColor: accent }}
          >
            <FiBriefcase size={40} color={contrast} />
          </div>
          <div>
            <h2
              className={`text-5xl font-black uppercase tracking-tighter ${theme.textPrimary}`}
            >
              Business Info
            </h2>
            <p
              className={`mt-2 text-[10px] font-black uppercase tracking-[0.5em] ${theme.textMuted}`}
            >
              Store Identity & Receipt Details
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={refetchBusinessInfo}
            className="rounded-[35px] px-8 py-5 font-black uppercase tracking-[0.25em] transition-transform hover:scale-105"
            style={{
              backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0",
              color: isDark ? "#fff" : "#0f172a",
            }}
          >
            <span className="inline-flex items-center gap-3">
              <FiRefreshCw />
              Refresh
            </span>
          </button>

          <button
            onClick={handleOpenModal}
            className="rounded-[35px] px-12 py-6 text-[12px] font-black uppercase tracking-[0.3em] transition-transform hover:scale-105"
            style={{ backgroundColor: accent, color: contrast }}
          >
            Edit Business Info
          </button>
        </div>
      </div>

      {error ? (
        <div
          className={`rounded-[32px] border p-6 text-sm font-bold ${theme.panel}`}
        >
          <span className="inline-flex items-center gap-3 text-rose-500">
            <FiAlertTriangle />
            {error}
          </span>
        </div>
      ) : null}

      <div className={`rounded-[40px] border p-8 ${theme.panel}`}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {fields.map((field) => (
            <div
              key={field.id}
              className={`rounded-[28px] p-6 ${theme.subPanel}`}
            >
              <div
                className={`text-[10px] font-black uppercase tracking-[0.28em] ${theme.textMuted}`}
              >
                {field.label}
              </div>
              <div
                className={`mt-3 break-words text-[13px] font-black ${theme.textPrimary}`}
              >
                {businessInfo?.[field.id] || "-"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 p-6 backdrop-blur-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`max-h-[95vh] w-full max-w-7xl overflow-y-auto rounded-[60px] p-16 ${
                isDark ? "bg-[#0b1222]" : "bg-white"
              }`}
            >
              <div className="mb-10 flex items-center justify-between">
                <h3
                  className={`text-4xl font-black uppercase tracking-tighter ${theme.textPrimary}`}
                >
                  Edit Business Info
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-3xl opacity-20 transition-opacity hover:opacity-100"
                  disabled={isSaving}
                >
                  <FiX />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-10 xl:grid-cols-12">
                <div className="space-y-6 xl:col-span-4">
                  <div className={`rounded-[36px] border p-8 ${theme.panel}`}>
                    <div
                      className={`text-[10px] font-black uppercase tracking-[0.35em] ${theme.textMuted}`}
                    >
                      Receipt Preview
                    </div>

                    <div className="mt-6 rounded-[28px] bg-white p-6 text-center text-black shadow-xl">
                      <div className="text-[18px] font-black leading-tight break-words">
                        {previewRows[0]}
                      </div>
                      <div className="mt-2 text-[13px] font-bold leading-tight break-words">
                        {previewRows[1]}
                      </div>
                      <div className="mt-1 text-[13px] font-bold leading-tight break-words">
                        {previewRows[2]}
                      </div>

                      <div className="my-5 border-t border-black" />

                      <div className="text-[18px] font-black">BILLING</div>
                    </div>
                  </div>

                  <div className={`rounded-[36px] border p-8 ${theme.panel}`}>
                    <div
                      className={`text-[10px] font-black uppercase tracking-[0.35em] ${theme.textMuted}`}
                    >
                      Safety
                    </div>

                    <div className="mt-5 space-y-4">
                      <div
                        className={`rounded-[24px] p-5 ${theme.subPanel} ${theme.textPrimary}`}
                      >
                        <div className="inline-flex items-center gap-3 text-[12px] font-black uppercase tracking-[0.25em]">
                          <FiShield />
                          Auto Backup
                        </div>
                        <p
                          className={`mt-3 text-[12px] font-bold ${theme.textMuted}`}
                        >
                          A backup copy is created before every save and before
                          reset to defaults.
                        </p>
                      </div>

                      {lastBackupPath ? (
                        <div className="rounded-[24px] border border-emerald-400/30 bg-emerald-500/10 p-5 text-emerald-500">
                          <div className="text-[11px] font-black uppercase tracking-[0.2em]">
                            Last Backup
                          </div>
                          <div className="mt-2 break-all text-[12px] font-bold">
                            {lastBackupPath}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-8">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {fields.map((field) => (
                      <div key={field.id} className="space-y-2 text-left">
                        <label className="ml-4 text-[9px] font-black uppercase tracking-widest opacity-40">
                          {field.label}
                        </label>
                        {field.multiline ? (
                          <textarea
                            value={formData[field.id]}
                            onChange={(e) =>
                              handleChange(field.id, e.target.value)
                            }
                            rows={4}
                            className={`w-full rounded-[25px] border p-5 text-[12px] font-bold outline-none ${theme.input}`}
                          />
                        ) : (
                          <input
                            type="text"
                            value={formData[field.id]}
                            onChange={(e) =>
                              handleChange(field.id, e.target.value)
                            }
                            className={`w-full rounded-[25px] border p-5 text-[12px] font-bold outline-none ${theme.input}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {feedback.message ? (
                    <div
                      className={`mt-8 rounded-[28px] border p-5 text-sm font-bold ${
                        feedback.type === "success"
                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-500"
                          : "border-rose-400/30 bg-rose-500/10 text-rose-500"
                      }`}
                    >
                      <span className="inline-flex items-center gap-3">
                        {feedback.type === "success" ? (
                          <FiCheckCircle />
                        ) : (
                          <FiAlertTriangle />
                        )}
                        {feedback.message}
                      </span>
                    </div>
                  ) : null}

                  <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <button
                      onClick={resetFormToCurrent}
                      disabled={isSaving}
                      className="rounded-[28px] px-6 py-5 text-[11px] font-black uppercase tracking-[0.25em] transition-transform hover:scale-[1.02]"
                      style={{
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.08)"
                          : "#e2e8f0",
                        color: isDark ? "#fff" : "#0f172a",
                      }}
                    >
                      <span className="inline-flex items-center gap-3">
                        <FiRotateCcw />
                        Reset Form
                      </span>
                    </button>

                    <button
                      onClick={resetFormToDefaults}
                      disabled={isSaving}
                      className="rounded-[28px] px-6 py-5 text-[11px] font-black uppercase tracking-[0.25em] transition-transform hover:scale-[1.02]"
                      style={{
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.08)"
                          : "#e2e8f0",
                        color: isDark ? "#fff" : "#0f172a",
                      }}
                    >
                      <span className="inline-flex items-center gap-3">
                        <FiEdit3 />
                        Blank Defaults
                      </span>
                    </button>

                    <button
                      onClick={handleResetDefaultsFile}
                      disabled={isSaving}
                      className="rounded-[28px] px-6 py-5 text-[11px] font-black uppercase tracking-[0.25em] transition-transform hover:scale-[1.02]"
                      style={{
                        backgroundColor: "#ef4444",
                        color: "#fff",
                      }}
                    >
                      <span className="inline-flex items-center gap-3">
                        <FiAlertTriangle />
                        File Reset Defaults
                      </span>
                    </button>
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="mt-6 w-full rounded-[35px] py-8 text-sm font-black uppercase tracking-[0.5em] shadow-2xl transition-all active:scale-95"
                    style={{ backgroundColor: accent, color: contrast }}
                  >
                    {isSaving
                      ? "Saving Business Info..."
                      : "Confirm & Save Business Info"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PosBusinessInfoManager;
