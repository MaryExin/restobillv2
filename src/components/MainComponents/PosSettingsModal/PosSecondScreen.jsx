import React, { useState, useEffect, useRef } from "react";
import { FiMonitor, FiUpload, FiMessageSquare, FiCheck, FiAlertCircle, FiImage } from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";

const broadcastDisplayImageUpdated = () => {
  const token = String(new Date().getTime());
  window.dispatchEvent(new CustomEvent("pos-second-screen-image-updated"));
  localStorage.setItem("pos-second-screen-image-bust", token);

  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel("pos-second-screen");
    channel.postMessage({ type: "display-image-updated", token });
    channel.close();
  }
};

const PosSecondScreen = ({ isDark, accent = "#3b82f6" }) => {
  const apiHost = useApiHost();

  // ── Announcement ───────────────────────────────────────────────────────────
  const [announcement, setAnnouncement] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  // ── Image upload ───────────────────────────────────────────────────────────
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!apiHost) return;
    fetch(`${apiHost}/api/pos_second_screen_settings.php`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.data?.announcement != null) {
          setAnnouncement(data.data.announcement);
        }
      })
      .catch(() => {});
  }, [apiHost]);

  const handleSaveAnnouncement = async () => {
    if (!apiHost) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const r = await fetch(`${apiHost}/api/pos_second_screen_settings.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcement }),
      });
      const data = await r.json();
      setSaveMsg({ ok: !!data?.success, text: data?.message || (data?.success ? "Saved!" : "Failed.") });
    } catch {
      setSaveMsg({ ok: false, text: "Network error." });
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadMsg(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadMsg(null);
  };

  const handleUpload = async () => {
    if (!apiHost || !selectedFile) return;
    setUploading(true);
    setUploadMsg(null);
    const formData = new FormData();
    formData.append("display_image", selectedFile);
    try {
      const r = await fetch(`${apiHost}/api/pos_second_screen_settings.php`, {
        method: "POST",
        body: formData,
      });
      const data = await r.json();
      if (data?.success) {
        broadcastDisplayImageUpdated();
        setUploadMsg({ ok: true, text: "Display image updated." });
        setSelectedFile(null);
      } else {
        setUploadMsg({ ok: false, text: data?.message || "Upload failed." });
      }
    } catch {
      setUploadMsg({ ok: false, text: "Network error." });
    } finally {
      setUploading(false);
    }
  };

  const label = isDark ? "#f8fafc" : "#0f172a";
  const sub   = isDark ? "#94a3b8" : "#64748b";
  const card  = isDark ? "bg-slate-800 border-white/8" : "bg-slate-50 border-slate-200";
  const input = isDark
    ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
    : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400";

  return (
    <div className="p-6 max-w-lg space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${accent}20` }}>
          <FiMonitor size={20} style={{ color: accent }} />
        </div>
        <div>
          <h2 className="text-lg font-black" style={{ color: label }}>
            Second Screen Settings
          </h2>
          <p className="text-[12px]" style={{ color: sub }}>
            Manage what appears on the customer-facing display.
          </p>
        </div>
      </div>

      {/* ── Display Image ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FiImage size={15} style={{ color: accent }} />
          <h3 className="text-sm font-black uppercase tracking-widest" style={{ color: label }}>
            Display Image
          </h3>
        </div>
        <p className="text-[12px] mb-3" style={{ color: sub }}>
          Upload a new promo or display image. It replaces <code className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">display.jpg</code> on the second screen.
        </p>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 min-h-[160px] ${
            isDark ? "border-slate-600 hover:border-slate-400 bg-slate-800/50" : "border-slate-300 hover:border-slate-400 bg-slate-50"
          }`}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full max-h-[200px] object-cover rounded-[14px]"
            />
          ) : (
            <>
              <FiUpload size={28} style={{ color: sub }} />
              <p className="text-sm font-semibold" style={{ color: sub }}>
                Drag & drop or <span style={{ color: accent }}>click to browse</span>
              </p>
              <p className="text-[11px]" style={{ color: sub }}>
                JPG, PNG, WebP — max 10 MB
              </p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {selectedFile && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[12px] truncate" style={{ color: sub }}>
              {selectedFile.name}
            </p>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex-shrink-0 px-5 py-2.5 rounded-xl text-xs font-black text-white transition disabled:opacity-50"
              style={{ backgroundColor: accent }}
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>
        )}

        {uploadMsg && (
          <div className={`mt-3 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold ${
            uploadMsg.ok
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-red-500/10 text-red-500"
          }`}>
            {uploadMsg.ok ? <FiCheck size={15} /> : <FiAlertCircle size={15} />}
            {uploadMsg.text}
          </div>
        )}
      </section>

      {/* Divider */}
      <div className={`h-px ${isDark ? "bg-white/8" : "bg-slate-200"}`} />

      {/* ── Announcement Text ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FiMessageSquare size={15} style={{ color: accent }} />
          <h3 className="text-sm font-black uppercase tracking-widest" style={{ color: label }}>
            Announcement Text
          </h3>
        </div>
        <p className="text-[12px] mb-3" style={{ color: sub }}>
          Shown at the bottom ticker of the second screen. Keep it short and welcoming.
        </p>

        <textarea
          value={announcement}
          onChange={(e) => { setAnnouncement(e.target.value); setSaveMsg(null); }}
          maxLength={500}
          rows={3}
          placeholder="e.g. Welcome to our store! Happy to serve you."
          className={`w-full resize-none rounded-2xl border px-4 py-3 text-sm transition focus:outline-none focus:ring-2 ${input}`}
          style={{ "--tw-ring-color": accent }}
        />

        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px]" style={{ color: sub }}>
            {announcement.length}/500
          </span>
          <button
            onClick={handleSaveAnnouncement}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl text-xs font-black text-white transition disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {saving ? "Saving…" : "Save Announcement"}
          </button>
        </div>

        {saveMsg && (
          <div className={`mt-3 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold ${
            saveMsg.ok
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-red-500/10 text-red-500"
          }`}>
            {saveMsg.ok ? <FiCheck size={15} /> : <FiAlertCircle size={15} />}
            {saveMsg.text}
          </div>
        )}
      </section>
    </div>
  );
};

export default PosSecondScreen;
