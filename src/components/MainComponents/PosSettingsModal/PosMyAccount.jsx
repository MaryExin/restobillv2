"use client";

import React, { useState, useRef, useCallback } from "react";
import { FiUser, FiLock, FiMapPin, FiChevronRight, FiCamera, FiX, FiZoomIn, FiZoomOut, FiEdit3, FiHash } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Cropper from "react-easy-crop";

const PosMyAccount = ({ isDark, accent, branchInfo }) => {
  const [profile, setProfile] = useState({
    firstName: branchInfo?.firstName || "SYSTEM",
    lastName: branchInfo?.lastName || "ADMIN",
    username: branchInfo?.userName || "admin",
  });

  const fileInputRef = useRef(null);
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
    input: isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900",
  };

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
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

  const saveCroppedImage = async () => {
    const cropped = await getCroppedImg(imageToCrop, croppedAreaPixels);
    setProfile({ ...profile, profilePic: cropped });
    setIsCropperOpen(false);
  };

  return (
    <div className="space-y-8 text-left transition-all duration-500">
      
      <div className={`rounded-[50px] border p-12 flex flex-col lg:flex-row items-center gap-12 transition-all duration-500 ${theme.panel}`}>
        <div className="relative group">
          <div 
            className="h-44 w-44 rounded-[55px] p-1.5 flex items-center justify-center transition-all duration-500 shadow-xl"
            style={{ background: `linear-gradient(135deg, ${accent}, #67e8f9)` }}
          >
             <div className={`h-full w-full rounded-[50px] overflow-hidden flex items-center justify-center ${isDark ? "bg-[#0b1222]" : "bg-white"}`}>
                {profile.profilePic ? (
                  <img src={profile.profilePic} alt="Profile" className="object-cover w-full h-full" />
                ) : (
                  <FiUser size={80} style={{ color: accent }} className="opacity-30" />
                )}
             </div>
          </div>
          
          <motion.button 
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => fileInputRef.current.click()}
            className="absolute z-10 flex items-center justify-center text-white rounded-full shadow-2xl -bottom-2 -right-2 h-14 w-14"
            style={{ backgroundColor: accent, boxShadow: `0 10px 25px ${accent}40` }}
          >
            <FiCamera size={22} />
          </motion.button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
        </div>

        <div className="flex-1 text-center lg:text-left">
          <div 
            className="inline-block px-5 py-2 rounded-full font-black text-[10px] uppercase tracking-[0.3em] mb-5"
            style={{ backgroundColor: `${accent}15`, color: accent }}
          >
            System Profile
          </div>
          <h2 className={`text-6xl font-black tracking-tighter uppercase mb-2 leading-none ${theme.textPrimary}`}>
            {profile.firstName} {profile.lastName}
          </h2>
          <p className={`text-sm font-black tracking-[0.2em] uppercase ${theme.textMuted}`}>
            {branchInfo?.userRole || "Administrator"} • <span style={{ color: accent }}>{branchInfo?.branch || "STA MARIA"}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        
        <div className={`rounded-[50px] border p-12 space-y-8 ${theme.panel}`}>
          <h4 className={`text-[11px] font-black uppercase tracking-[0.5em] mb-4 ${theme.textMuted}`}>Personal Registry</h4>
          
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <label className={`text-[9px] font-black uppercase tracking-widest ml-4 ${theme.textMuted}`}>First Name</label>
                  <input 
                    type="text" value={profile.firstName} 
                    onChange={(e) => setProfile({...profile, firstName: e.target.value.toUpperCase()})}
                    className={`w-full px-6 py-4 rounded-3xl outline-none border transition-all text-[11px] font-black uppercase ${theme.input}`}
                  />
               </div>
               <div className="space-y-2">
                  <label className={`text-[9px] font-black uppercase tracking-widest ml-4 ${theme.textMuted}`}>Last Name</label>
                  <input 
                    type="text" value={profile.lastName} 
                    onChange={(e) => setProfile({...profile, lastName: e.target.value.toUpperCase()})}
                    className={`w-full px-6 py-4 rounded-3xl outline-none border transition-all text-[11px] font-black uppercase ${theme.input}`}
                  />
               </div>
            </div>

            <div className="space-y-2">
              <label className={`text-[9px] font-black uppercase tracking-widest ml-4 ${theme.textMuted}`}>Username</label>
              <div className="relative">
                <FiEdit3 className="absolute -translate-y-1/2 left-6 top-1/2 opacity-20" />
                <input 
                  type="text" value={profile.username} 
                  onChange={(e) => setProfile({...profile, username: e.target.value})}
                  className={`w-full pl-14 pr-6 py-4 rounded-3xl outline-none border transition-all text-[11px] font-black ${theme.input}`}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className={`rounded-[50px] border p-10 ${theme.panel}`}>
            <h4 className={`text-[11px] font-black uppercase tracking-[0.5em] mb-10 ${theme.textMuted}`}>Registry Info</h4>
            <div className="space-y-4">
              {[
                { label: "Staff ID", val: branchInfo?.staffId || "USR-001", icon: <FiHash /> },
                { label: "Terminal", val: "STATION " + (branchInfo?.terminalNo || "1"), icon: <FiMapPin /> }
              ].map((item, i) => (
                <div key={i} className={`flex items-center justify-between p-7 rounded-[35px] ${theme.subPanel}`}>
                  <div className="flex items-center gap-5">
                    <span style={{ color: accent }} className="text-xl">{item.icon}</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${theme.textMuted}`}>{item.label}</span>
                  </div>
                  <span className={`text-xs font-black uppercase tracking-wider ${theme.textPrimary}`}>{item.val}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-[50px] border p-10 ${theme.panel}`}>
            <h4 className={`text-[11px] font-black uppercase tracking-[0.5em] mb-10 ${theme.textMuted}`}>Security Management</h4>
            <motion.button 
              whileHover={{ scale: 1.02 }}
              className="w-full flex items-center justify-between p-8 rounded-[40px] text-white shadow-2xl transition-all active:scale-95"
              style={{ backgroundColor: accent, boxShadow: `0 20px 40px ${accent}30` }}
            >
               <div className="flex items-center gap-6">
                <FiLock size={28} />
                <p className="text-[14px] font-black uppercase tracking-widest">Update Passkey</p>
              </div>
              <FiChevronRight size={24} />
            </motion.button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isCropperOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className={`w-full max-w-[600px] rounded-[60px] border p-12 ${isDark ? 'bg-[#0f172a] border-white/5' : 'bg-white border-slate-200 shadow-2xl'}`}
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className={`text-3xl font-black uppercase tracking-tighter ${theme.textPrimary}`}>Scale Profile Picture</h3>
                <button onClick={() => setIsCropperOpen(false)} className={`text-3xl opacity-30 hover:opacity-100 transition-all ${theme.textPrimary}`}><FiX /></button>
              </div>

              <div className="relative w-full h-80 rounded-[40px] overflow-hidden bg-black/40 mb-8 shadow-inner">
                <Cropper
                  image={imageToCrop} crop={crop} zoom={zoom} aspect={1}
                  onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete}
                  style={{ cropAreaStyle: { border: `4px solid ${accent}`, boxShadow: '0 0 0 9999px rgba(0,0,0,0.8)' } }}
                />
              </div>

              <div className="flex items-center gap-6 mb-10">
                <FiZoomOut size={20} className={theme.textMuted} />
                <input 
                  type="range" value={zoom} min={1} max={3} step={0.1} 
                  onChange={(e) => setZoom(e.target.value)} 
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', accentColor: accent }}
                />
                <FiZoomIn size={20} className={theme.textMuted} />
              </div>

              <button 
                onClick={saveCroppedImage}
                className="w-full py-6 rounded-[30px] font-black uppercase tracking-[0.3em] text-[12px] shadow-2xl transition-all active:scale-95" 
                style={{ backgroundColor: accent, color: isDark ? "#0f172a" : "#fff" }}
              >
                Apply Changes
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PosMyAccount;