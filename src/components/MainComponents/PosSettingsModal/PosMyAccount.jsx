"use client";

import React, { useState, useEffect } from "react";
import {
  FiLoader, FiMail, FiHash, FiMapPin, FiBriefcase, FiUser,
  FiLock, FiX, FiCheckCircle, FiEye, FiEyeOff,
} from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";

const PosMyAccount = ({ isDark, accent }) => {
  const apiHost = useApiHost();
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [imgError, setImgError] = useState(false);

  // Modal & Password States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });

  useEffect(() => {
    const fetchProfile = async () => {
      const storedUuid = localStorage.getItem("user_id");
      if (!storedUuid || !apiHost) { setIsLoading(false); return; }
      try {
        const response = await fetch(`${apiHost}/api/get_user_profile.php?user_id=${storedUuid}`);
        const data = await response.json();
        if (data && !data.error) setProfile(data);
      } catch (err) { console.error("Fetch Error:", err); } finally { setIsLoading(false); }
    };
    fetchProfile();
  }, [apiHost]);

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      alert("New passwords do not match!");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiHost}/api/get_user_profile.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: localStorage.getItem("user_id"),
          current_password: passwords.current,
          new_password: passwords.new,
        }),
      });
      const result = await response.json();
      if (result.success) {
        alert(result.message);
        setIsModalOpen(false);
        setPasswords({ current: "", new: "", confirm: "" });
        setShowPassword(false);
      } else {
        alert(result.message);
      }
    } catch (err) {
      alert("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const theme = {
    panel: isDark ? "bg-slate-900/40 border-white/5" : "bg-white border-slate-200 shadow-sm",
    panelSoft: isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200",
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-slate-400" : "text-slate-500",
    textSoft: isDark ? "text-slate-500" : "text-slate-400",
    input: isDark ? "bg-slate-950 border-slate-800 text-white focus:border-slate-600" : "bg-white border-slate-200 text-slate-900 focus:border-slate-400",
  };

  if (isLoading) return (
    <div className="flex items-center justify-center w-full min-h-[420px]">
      <FiLoader className="text-3xl animate-spin" style={{ color: accent }} />
    </div>
  );

  if (!profile) return <div className="p-10 text-center">No profile found.</div>;

  const fullName = `${profile.firstname || ""} ${profile.lastname || ""}`.trim();
  const profileImage = profile.profile_pic_url ? `${apiHost}/${profile.profile_pic_url}` : "";

  const infoCards = [
    { label: "User UUID", value: profile.uuid, icon: FiHash, valueClass: "font-mono break-all" },
    { label: "Username/Email", value: profile.email, icon: FiMail, valueClass: "font-bold break-all" },
    { label: "Department", value: profile.department, icon: FiBriefcase, valueClass: "font-bold uppercase" },
    { label: "Classification", value: profile.classification, icon: FiUser, valueClass: "font-bold uppercase" },
    { label: "Branch", value: profile.branch_name, icon: FiMapPin, valueClass: "font-bold uppercase" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* HEADER SECTION */}
      <div className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-10 ${theme.panel}`}>
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center">
          <div className={`h-40 w-40 rounded-[30px] overflow-hidden border shadow-xl ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200"}`}>
            {profileImage && !imgError ? (
              <img src={profileImage} className="object-cover w-full h-full" alt="Profile" onError={() => setImgError(true)} />
            ) : (
              <div className="flex items-center justify-center w-full h-full"><FiUser size={52} style={{ color: accent }} /></div>
            )}
          </div>
          <div className="flex-1 text-center lg:text-left">
            <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-widest uppercase border ${isDark ? "bg-slate-950/70 border-slate-800" : "bg-white border-slate-200"}`} style={{ color: accent }}>
              {profile.classification}
            </span>
            <h1 className={`mt-4 text-3xl lg:text-5xl font-black uppercase tracking-tight leading-tight ${theme.textPrimary}`}>{fullName}</h1>
            <div className={`mt-4 flex flex-wrap justify-center lg:justify-start gap-4 text-[11px] font-black uppercase ${theme.textMuted}`}>
               <div className="flex items-center gap-2"><FiMapPin style={{ color: accent }} /> {profile.branch_name}</div>
               <div className="flex items-center gap-2"><FiBriefcase style={{ color: accent }} /> {profile.department}</div>
            </div>
            <button onClick={() => setIsModalOpen(true)} style={{ backgroundColor: accent }} className="mt-8 flex items-center gap-2 px-6 py-3 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg active:scale-95">
              <FiLock /> Update Password
            </button>
          </div>
        </div>
      </div>

      {/* INFO CARDS GRID */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {infoCards.map((item, i) => (
          <div key={i} className={`rounded-[28px] border p-6 ${theme.panel}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center border ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                <item.icon size={16} style={{ color: accent }} />
              </div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${theme.textSoft}`}>{item.label}</p>
            </div>
            <p className={`${theme.textPrimary} ${item.valueClass}`}>{item.value || "—"}</p>
          </div>
        ))}
      </div>

      {/* ACCOUNT OVERVIEW BOTTOM SECTION */}
      <div className={`rounded-[32px] border p-8 ${theme.panelSoft}`}>
        <p className={`text-[10px] font-black tracking-widest uppercase ${theme.textSoft}`}>Account Overview</p>
        <div className="grid grid-cols-1 gap-4 mt-5 md:grid-cols-3">
          {[{l: "Full Name", v: fullName}, {l: "Assigned Branch", v: profile.branch_name}, {l: "Department", v: profile.department}].map((x, i) => (
            <div key={i} className={`rounded-[24px] border p-5 ${isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200"}`}>
              <p className={`text-[10px] font-black uppercase tracking-widest ${theme.textSoft}`}>{x.l}</p>
              <p className={`mt-2 text-lg font-black uppercase ${theme.textPrimary}`}>{x.v || "—"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* PASSWORD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md rounded-[32px] border p-8 shadow-2xl ${theme.panel} animate-in zoom-in duration-200`}>
            
            {/* Header with Switch Toggle at the Right */}
            <div className="flex items-center justify-between mb-10">
               <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl" style={{ backgroundColor: `${accent}15`, color: accent }}><FiLock size={20} /></div>
                  <h3 className={`font-black uppercase tracking-tight text-sm ${theme.textPrimary}`}>Security Settings</h3>
               </div>
               
               <div className="flex items-center gap-4">
                  {/* Modern Switch Toggle */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black uppercase tracking-widest ${theme.textSoft}`}>
                      {showPassword ? "Visible" : "Hidden"}
                    </span>
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors duration-300 focus:outline-none ${showPassword ? 'bg-blue-600' : 'bg-slate-400'}`}
                    >
                      <span
                        className={`${
                          showPassword ? 'translate-x-5' : 'translate-x-1'
                        } inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300`}
                      />
                    </button>
                  </div>

                  <button onClick={() => setIsModalOpen(false)} className={`${theme.textSoft} hover:text-red-500 transition-colors`}><FiX size={20} /></button>
               </div>
            </div>
            
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="space-y-1">
                <label className={`text-[9px] font-black uppercase ml-1 ${theme.textSoft}`}>Current Password</label>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  className={`w-full p-4 rounded-2xl border outline-none transition-all ${theme.input}`} 
                  value={passwords.current} 
                  onChange={e => setPasswords({...passwords, current: e.target.value})} 
                />
              </div>
              
              <div className="h-[1px] bg-slate-500/10 mx-2 my-2" />

              <div className="space-y-1">
                <label className={`text-[9px] font-black uppercase ml-1 ${theme.textSoft}`}>New Password</label>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  className={`w-full p-4 rounded-2xl border outline-none transition-all ${theme.input}`} 
                  value={passwords.new} 
                  onChange={e => setPasswords({...passwords, new: e.target.value})} 
                />
              </div>

              <div className="space-y-1">
                <label className={`text-[9px] font-black uppercase ml-1 ${theme.textSoft}`}>Confirm New Password</label>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  className={`w-full p-4 rounded-2xl border outline-none transition-all ${theme.input}`} 
                  value={passwords.confirm} 
                  onChange={e => setPasswords({...passwords, confirm: e.target.value})} 
                />
              </div>

              <button 
                disabled={isSubmitting} 
                style={{ backgroundColor: accent }} 
                className="flex items-center justify-center w-full gap-2 p-4 mt-4 font-black tracking-widest text-white uppercase transition-all shadow-lg rounded-2xl hover:brightness-110 active:scale-95"
              >
                {isSubmitting ? <FiLoader className="animate-spin" /> : <FiCheckCircle />} 
                {isSubmitting ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PosMyAccount;