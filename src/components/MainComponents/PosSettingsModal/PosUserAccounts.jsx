"use client";

import React, { useState, useEffect, useRef } from "react";
import { FiUsers, FiTrash2, FiX, FiLoader, FiCamera } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Cropper from "react-easy-crop";
import useApiHost from "../../../hooks/useApiHost";

const PosUserAccounts = ({ isDark, accent, getContrastText }) => {
  const apiHost = useApiHost();
  const fileInputRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Profile Picture States
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [finalImage, setFinalImage] = useState(null);

  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    username: "",
    password: "",
    contact: "",
    position: "CASHIER",
    company: "",
  });

  useEffect(() => {
    if (apiHost) {
      fetchUsers();
      fetchUnits();
    }
  }, [apiHost]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${apiHost}/api/manage_users.php`);
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnits = async () => {
    try {
      const res = await fetch(`${apiHost}/api/manage_users.php?get_units=1`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setBusinessUnits(data);
        setFormData((prev) => ({ ...prev, company: data[0].Unit_Name }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result);
        setIsCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateCroppedImage = async () => {
    const canvas = document.createElement("canvas");
    const img = new Image();
    img.src = imageToCrop;
    await new Promise((r) => (img.onload = r));
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      img,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      400,
      400,
    );
    setFinalImage(canvas.toDataURL("image/jpeg", 0.8));
    setIsCropperOpen(false);
  };

  const handleDelete = async (uuid, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const res = await fetch(`${apiHost}/api/manage_users.php`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuid }),
      });
      const result = await res.json();
      if (result.success) {
        setUsers(users.filter((u) => u.uuid !== uuid));
      }
    } catch (err) {
      alert("Delete failed");
    }
  };

  const handleSubmit = async () => {
    if (
      !formData.username ||
      !formData.firstName ||
      !formData.password ||
      !formData.lastName
    ) {
      alert(
        "Please fill all required fields (First Name, Last Name, Email, Password).",
      );
      return;
    }

    // Kunin ang logged in user as creator
    const creatorUuid = localStorage.getItem("user_id") || "ADMIN_WEB";

    setIsSaving(true);
    try {
      const res = await fetch(`${apiHost}/api/manage_users.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          image: finalImage,
          creatorUuid: creatorUuid,
        }),
      });
      const result = await res.json();
      if (result.success) {
        fetchUsers();
        setIsModalOpen(false);
        setFinalImage(null);
        setFormData({
          firstName: "",
          middleName: "",
          lastName: "",
          username: "",
          password: "",
          contact: "",
          position: "CASHIER",
          company: businessUnits[0]?.Unit_Name || "",
        });
      }
    } catch (err) {
      alert("Save error");
    } finally {
      setIsSaving(false);
    }
  };

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

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-96">
        <FiLoader className="text-4xl animate-spin" style={{ color: accent }} />
      </div>
    );

  return (
    <div className="space-y-8 text-left">
      {/* HEADER SECTION */}
      <div
        className={`rounded-[50px] border p-12 flex flex-col lg:flex-row items-center justify-between gap-12 ${theme.panel}`}
      >
        <div className="flex items-center gap-10">
          <div
            className="h-28 w-28 rounded-[35px] flex items-center justify-center shadow-2xl"
            style={{ backgroundColor: accent }}
          >
            <FiUsers size={40} color={contrast} />
          </div>
          <div>
            <h2
              className={`text-5xl font-black uppercase tracking-tighter ${theme.textPrimary}`}
            >
              User Accounts
            </h2>
            <p
              className={`text-[10px] font-black uppercase tracking-[0.5em] mt-2 ${theme.textMuted}`}
            >
              Registry & Employee Sync
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-12 py-6 rounded-[35px] font-black uppercase text-[12px] tracking-[0.3em] hover:scale-105 transition-transform"
          style={{ backgroundColor: accent, color: contrast }}
        >
          Add New User
        </button>
      </div>

      {/* TABLE SECTION */}
      <div
        className={`rounded-[40px] border p-8 overflow-x-auto ${theme.panel}`}
      >
        <table className="w-full text-left border-separate border-spacing-y-2 min-w-[800px]">
          <thead>
            <tr
              className={`text-[10px] font-black uppercase tracking-widest ${theme.textMuted}`}
            >
              <th className="px-8 py-4">Avatar</th>
              <th className="px-8 py-4">Name</th>
              <th className="px-8 py-4">Position</th>
              <th className="px-8 py-4">Unit</th>
              <th className="px-8 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.uuid} className="group">
                <td className={`px-8 py-4 rounded-l-3xl ${theme.subPanel}`}>
                  <div className="relative flex items-center justify-center overflow-hidden border h-14 w-14 rounded-2xl bg-slate-800 border-white/10">
                    {u.profile_pix ? (
                      <img
                        src={`${apiHost}/profile_pictures/${u.profile_pix}`}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "block";
                        }}
                      />
                    ) : null}
                    <span
                      className={`${u.profile_pix ? "hidden" : "block"} text-xl font-black text-white opacity-20`}
                    >
                      {u.firstname?.[0]}
                    </span>
                  </div>
                </td>
                <td
                  className={`px-8 py-6 font-black text-[12px] ${theme.subPanel} ${theme.textPrimary}`}
                >
                  {u.firstname} {u.lastname}
                </td>
                <td
                  className={`px-8 py-6 font-black text-[10px] opacity-60 uppercase tracking-widest ${theme.subPanel} ${theme.textPrimary}`}
                >
                  {u.position}
                </td>
                <td
                  className={`px-8 py-6 font-black text-[11px] ${theme.subPanel}`}
                  style={{ color: accent }}
                >
                  {u.company}
                </td>
                <td
                  className={`px-8 py-6 rounded-r-3xl text-right ${theme.subPanel}`}
                >
                  <button
                    onClick={() => handleDelete(u.uuid, u.firstname)}
                    className="p-3 transition-all text-rose-500 hover:scale-125 hover:rotate-12"
                  >
                    <FiTrash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* REGISTRATION MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`w-full max-w-6xl rounded-[60px] p-16 overflow-y-auto max-h-[95vh] ${isDark ? "bg-[#0b1222]" : "bg-white"}`}
            >
              <div className="flex items-center justify-between mb-10">
                <h3
                  className={`text-4xl font-black uppercase tracking-tighter ${theme.textPrimary}`}
                >
                  User Registration
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-3xl transition-opacity opacity-20 hover:opacity-100"
                >
                  <FiX />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
                <div className="flex flex-col items-center lg:col-span-4">
                  <div
                    className="h-72 w-72 rounded-[60px] border-4 border-dashed border-white/10 flex items-center justify-center overflow-hidden bg-white/5 cursor-pointer relative group"
                    onClick={() => fileInputRef.current.click()}
                  >
                    {finalImage ? (
                      <img
                        src={finalImage}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-4 transition-opacity opacity-10 group-hover:opacity-30">
                        <FiCamera size={50} />
                        <span className="text-[10px] font-black uppercase">
                          Upload Photo
                        </span>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    hidden
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:col-span-8 md:grid-cols-2">
                  {[
                    { id: "firstName", label: "First Name" },
                    { id: "middleName", label: "Middle Name" },
                    { id: "lastName", label: "Last Name" },
                    { id: "username", label: "Email / Username" },
                    { id: "password", label: "Password", type: "password" },
                    { id: "contact", label: "Contact Number" },
                  ].map((f) => (
                    <div key={f.id} className="space-y-2 text-left">
                      <label className="text-[9px] font-black uppercase tracking-widest opacity-40 ml-4">
                        {f.label}
                      </label>
                      <input
                        name={f.id}
                        type={f.type || "text"}
                        value={formData[f.id]}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [e.target.name]: e.target.value.toUpperCase(),
                          })
                        }
                        className={`w-full p-5 rounded-[25px] border outline-none font-bold text-[12px] ${theme.input}`}
                      />
                    </div>
                  ))}

                  <div className="space-y-2 text-left">
                    <label className="text-[9px] font-black uppercase tracking-widest opacity-40 ml-4">
                      Position
                    </label>
                    <select
                      name="position"
                      value={formData.position}
                      onChange={(e) =>
                        setFormData({ ...formData, position: e.target.value })
                      }
                      className={`w-full p-5 rounded-[25px] border outline-none font-bold text-[12px] ${theme.input}`}
                    >
                      <option value="CASHIER">CASHIER</option>
                      <option value="SUPERVISOR">SUPERVISOR</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-[9px] font-black uppercase tracking-widest opacity-40 ml-4">
                      Business Unit
                    </label>
                    <select
                      name="company"
                      value={formData.company}
                      onChange={(e) =>
                        setFormData({ ...formData, company: e.target.value })
                      }
                      className={`w-full p-5 rounded-[25px] border outline-none font-bold text-[12px] ${theme.input}`}
                    >
                      {businessUnits.map((unit) => (
                        <option key={unit.Unit_Name} value={unit.Unit_Name}>
                          {unit.Unit_Name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="w-full py-8 mt-12 rounded-[35px] font-black uppercase tracking-[0.5em] text-sm shadow-2xl active:scale-95 transition-all"
                style={{ backgroundColor: accent, color: contrast }}
              >
                {isSaving ? "Creating Account..." : "Confirm & Save Registry"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* IMAGE CROPPER MODAL */}
      {isCropperOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/95 flex flex-col items-center justify-center p-10">
          <div className="relative w-full max-w-2xl h-[500px] rounded-3xl overflow-hidden border border-white/10">
            <Cropper
              image={imageToCrop}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, p) => setCroppedAreaPixels(p)}
            />
          </div>
          <div className="flex gap-4 mt-10">
            <button
              onClick={() => setIsCropperOpen(false)}
              className="px-12 py-4 font-black text-[10px] uppercase tracking-widest text-white rounded-2xl bg-white/10 hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={generateCroppedImage}
              className="px-16 py-4 font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl"
              style={{ backgroundColor: accent, color: "#fff" }}
            >
              Apply Crop
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PosUserAccounts;
