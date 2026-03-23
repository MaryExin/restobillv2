"use client";

import React, { useState, useRef, useCallback } from "react";
import { FiUserPlus, FiUsers, FiEdit2, FiTrash2, FiX, FiLock, FiChevronDown, FiHash, FiUser, FiCamera, FiZoomIn, FiZoomOut, FiCheckCircle } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Cropper from "react-easy-crop";

const PosUserAccounts = ({ isDark, accent, getContrastText }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef(null);
  
  const [users, setUsers] = useState([
    { id: "USR-001", username: "ADMIN_CNC", firstName: "SYSTEM", lastName: "ADMIN", position: "ADMINISTRATOR", image: null },
    { id: "USR-002", username: "CASHIER_1", firstName: "MARIA", lastName: "CLARA", position: "CASHIER", image: null },
  ]);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    password: "",
    position: "ADMINISTRATOR"
  });

  const [selectedImage, setSelectedImage] = useState(null);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);

  const theme = {
    panel: isDark ? "border-white/5 bg-white/[0.03] shadow-2xl" : "border-slate-200 bg-white shadow-sm",
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-white/40" : "text-slate-500",
    subPanel: isDark ? "bg-white/[0.04]" : "bg-slate-50",
    input: isDark ? "bg-white/5 border-white/10 text-white focus:border-white/30" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-slate-400",
  };

  const buttonTextColor = getContrastText ? getContrastText() : "#ffffff";
  const nextId = `USR-${String(users.length + 1).padStart(3, '0')}`;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result);
        setIsCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const getCroppedImg = async (imageSrc, pixelCrop) => {
    const image = await new Promise((resolve) => {
      const img = new Image();
      img.src = imageSrc;
      img.onload = () => resolve(img);
    });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
    return canvas.toDataURL("image/jpeg");
  };

  const showCroppedImage = async () => {
    try {
      const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
      setSelectedImage(croppedImage);
      setIsCropperOpen(false);
      setImageToCrop(null);
    } catch (e) { console.error(e); }
  };

  const handleSubmit = () => {
    if (!formData.username || !formData.firstName) return;
    const newUser = { id: nextId, ...formData, image: selectedImage };
    setUsers([...users, newUser]);
    setIsModalOpen(false);
    setFormData({ firstName: "", lastName: "", username: "", password: "", position: "ADMINISTRATOR" });
    setSelectedImage(null);
  };

  return (
    <div className="space-y-8 text-left transition-all duration-500">
      
      {/* HEADER CARD */}
      <div className={`rounded-[50px] border p-12 flex flex-col lg:flex-row items-center justify-between gap-12 transition-all duration-500 ${theme.panel}`}>
        <div className="flex flex-col items-center gap-10 lg:flex-row">
          <div className="h-32 w-32 rounded-[40px] p-1 flex items-center justify-center shadow-xl transition-all duration-500"
               style={{ background: `linear-gradient(135deg, ${accent}, #67e8f9)` }}>
             <div className={`h-full w-full rounded-[35px] flex items-center justify-center transition-all duration-500 ${isDark ? "bg-[#0b1222]" : "bg-white"}`}>
                <FiUsers size={40} style={{ color: accent }} className="opacity-30" />
             </div>
          </div>
          <div className="text-center lg:text-left">
            <h2 className={`text-5xl font-black tracking-tighter uppercase ${theme.textPrimary}`}>User Accounts</h2>
            <p className={`text-[10px] font-black uppercase tracking-[0.5em] mt-2 ${theme.textMuted}`}>Registry & Access Management</p>
          </div>
        </div>

        <motion.button 
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => setIsModalOpen(true)}
          className="px-10 py-6 rounded-[35px] font-black uppercase text-[12px] tracking-[0.3em] shadow-2xl flex items-center gap-4 transition-all"
          style={{ backgroundColor: accent, color: buttonTextColor, boxShadow: `0 20px 40px ${accent}40` }}
        >
          <FiUserPlus size={20} /> Add New User
        </motion.button>
      </div>

      {/* DATA TABLE */}
      <div className={`rounded-[50px] border p-10 overflow-hidden ${theme.panel}`}>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-separate border-spacing-y-3">
            <thead>
              <tr>
                {['ID', 'Username', 'Full Name', 'Position', 'Action'].map(h => (
                  <th key={h} className={`px-8 py-2 text-[10px] font-black uppercase tracking-[0.4em] ${theme.textMuted}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="transition-all group">
                  <td className={`px-8 py-6 rounded-l-[30px] font-black text-[11px] tracking-widest ${theme.subPanel}`} style={{ color: accent }}>{user.id}</td>
                  <td className={`px-8 py-6 font-black text-[11px] uppercase tracking-wider ${theme.subPanel} ${theme.textPrimary}`}>{user.username}</td>
                  <td className={`px-8 py-6 text-[11px] font-black uppercase tracking-tight ${theme.subPanel} ${theme.textPrimary}`}>{user.firstName} {user.lastName}</td>
                  <td className={`px-8 py-6 ${theme.subPanel}`}>
                     <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase border tracking-widest" 
                           style={{ borderColor: `${accent}30`, color: accent, backgroundColor: `${accent}05` }}>
                        {user.position}
                     </span>
                  </td>
                  <td className={`px-8 py-6 rounded-r-[30px] ${theme.subPanel}`}>
                    <div className="flex gap-2">
                      <button className={`p-3 rounded-xl border transition-all ${isDark ? 'border-white/5 hover:bg-white/10' : 'border-slate-200 hover:bg-white'}`}>
                        <FiEdit2 size={14} className={theme.textPrimary} />
                      </button>
                      <button className="p-3 transition-all border rounded-xl border-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white">
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-3xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className={`w-full max-w-[800px] rounded-[60px] border p-12 overflow-y-auto max-h-[90vh] custom-scrollbar ${isDark ? 'bg-[#0b1222] border-white/5' : 'bg-white border-slate-200'}`}
            >
              <div className="flex items-center justify-between mb-10">
                <h3 className={`text-4xl font-black uppercase tracking-tighter ${theme.textPrimary}`}>New User Account</h3>
                <button onClick={() => setIsModalOpen(false)} className={`text-3xl opacity-30 hover:opacity-100 transition-all ${theme.textPrimary}`}><FiX /></button>
              </div>

              <div className="flex flex-col items-center gap-8 pb-10 mb-10 border-b border-white/5">
                <div className="relative">
                  <div className="h-44 w-44 rounded-[55px] p-1.5 flex items-center justify-center shadow-2xl"
                       style={{ background: `linear-gradient(135deg, ${accent}, #67e8f9)` }}>
                     <div className={`h-full w-full rounded-[50px] flex items-center justify-center overflow-hidden ${isDark ? "bg-[#0b1222]" : "bg-white"}`}>
                        {selectedImage ? (
                          <img src={selectedImage} alt="Preview" className="object-cover w-full h-full" />
                        ) : (
                          <FiUser size={80} style={{ color: accent }} className="opacity-20" />
                        )}
                     </div>
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={() => fileInputRef.current.click()}
                    className="absolute flex items-center justify-center text-white rounded-full -bottom-4 -right-4 h-14 w-14 shadow-3xl"
                    style={{ backgroundColor: accent, boxShadow: `0 10px 20px ${accent}40` }}
                  >
                    <FiCamera size={24} />
                  </motion.button>
                  <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
                <div className="space-y-3 md:col-span-2">
                  <label className={`text-[10px] font-black uppercase tracking-[0.4em] ml-4 ${theme.textMuted}`}>System ID</label>
                  <div className={`px-8 py-5 rounded-[25px] flex items-center gap-4 border-2 border-dashed ${isDark ? 'border-white/5 text-white/40' : 'border-slate-100'}`}>
                    <FiHash style={{ color: accent }} />
                    <span className="font-black tracking-[0.3em]">{nextId}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className={`text-[10px] font-black uppercase tracking-[0.4em] ml-4 ${theme.textMuted}`}>First Name</label>
                  <input name="firstName" type="text" value={formData.firstName} onChange={handleInputChange} placeholder="GIVEN NAME" className={`w-full px-8 py-5 rounded-[25px] outline-none border transition-all text-[11px] font-black tracking-widest uppercase ${theme.input}`} />
                </div>
                <div className="space-y-3">
                  <label className={`text-[10px] font-black uppercase tracking-[0.4em] ml-4 ${theme.textMuted}`}>Last Name</label>
                  <input name="lastName" type="text" value={formData.lastName} onChange={handleInputChange} placeholder="SURNAME" className={`w-full px-8 py-5 rounded-[25px] outline-none border transition-all text-[11px] font-black tracking-widest uppercase ${theme.input}`} />
                </div>

                <div className="space-y-3">
                  <label className={`text-[10px] font-black uppercase tracking-[0.4em] ml-4 ${theme.textMuted}`}>Username</label>
                  <input name="username" type="text" value={formData.username} onChange={handleInputChange} placeholder="USERNAME" className={`w-full px-8 py-5 rounded-[25px] outline-none border transition-all text-[11px] font-black tracking-widest uppercase ${theme.input}`} />
                </div>
                <div className="space-y-3">
                  <label className={`text-[10px] font-black uppercase tracking-[0.4em] ml-4 ${theme.textMuted}`}>Initial Passkey</label>
                  <input name="password" type="password" value={formData.password} onChange={handleInputChange} placeholder="••••••••" className={`w-full px-8 py-5 rounded-[25px] outline-none border transition-all text-[11px] font-black tracking-widest ${theme.input}`} />
                </div>

                <div className="space-y-3 md:col-span-2">
                  <label className={`text-[10px] font-black uppercase tracking-[0.4em] ml-4 ${theme.textMuted}`}>Position</label>
                  <div className="relative">
                    <select name="position" value={formData.position} onChange={handleInputChange} className={`w-full px-8 py-5 rounded-[25px] outline-none border appearance-none text-[11px] font-black uppercase tracking-[0.2em] ${theme.input}`}>
                      <option>ADMINISTRATOR</option>
                      <option>MANAGER</option>
                      <option>CASHIER</option>
                    </select>
                    <FiChevronDown className="absolute -translate-y-1/2 right-8 top-1/2 opacity-40" />
                  </div>
                </div>
              </div>

              <motion.button 
                whileHover={{ scale: 1.02 }}
                onClick={handleSubmit}
                className="w-full py-8 rounded-[30px] font-black uppercase tracking-[0.4em] text-[13px] mt-12 shadow-2xl transition-all" 
                style={{ backgroundColor: accent, color: buttonTextColor, boxShadow: `0 20px 40px ${accent}40` }}
              >
                Create Account Now
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CROPPER MODAL */}
      <AnimatePresence>
        {isCropperOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={`w-full max-w-[650px] rounded-[60px] border p-12 ${isDark ? 'bg-[#0f172a] border-white/5' : 'bg-white'}`}>
              <h3 className={`text-3xl font-black uppercase tracking-tighter mb-8 ${theme.textPrimary}`}>Adjust Photo</h3>
              <div className="relative w-full h-96 rounded-[40px] overflow-hidden mb-8 border border-white/5">
                <Cropper image={imageToCrop} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} 
                  style={{ containerStyle: { background: 'transparent' }, cropAreaStyle: { border: `4px solid ${accent}`, boxShadow: `0 0 0 9999px rgba(0,0,0,0.8)` } }} />
              </div>
              <div className="flex items-center gap-6 pb-10 mb-10 border-b border-white/5">
                <FiZoomOut size={22} className={theme.textMuted} />
                <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(e.target.value)} className="w-full h-2 rounded-full" style={{ accentColor: accent }} />
                <FiZoomIn size={22} className={theme.textMuted} />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <button onClick={() => { setIsCropperOpen(false); setImageToCrop(null); }} className={`py-6 rounded-[30px] font-black uppercase text-[11px] tracking-widest border ${isDark ? 'border-white/5' : 'border-slate-200'} ${theme.textPrimary}`}>Cancel</button>
                <button onClick={showCroppedImage} className="py-6 rounded-[30px] font-black uppercase text-[11px] tracking-widest shadow-2xl" style={{ backgroundColor: accent, color: buttonTextColor }}>Apply & Save</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PosUserAccounts;