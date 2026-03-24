"use client";

import React, { useState, useEffect } from "react";
import { FiUser, FiLoader, FiMail, FiHash, FiMapPin, FiBriefcase, FiActivity } from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost"; 

const PosMyAccount = ({ isDark, accent }) => {
  const apiHost = useApiHost();
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const storedUuid = localStorage.getItem("user_id");
      if (!storedUuid || !apiHost) { setIsLoading(false); return; }

      try {
        const response = await fetch(`${apiHost}/api/get_user_profile.php?user_id=${storedUuid}`);
        const data = await response.json();
        if (data && !data.error) setProfile(data);
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [apiHost]);

  const theme = {
    panel: isDark ? "bg-white/[0.02] border-white/5 backdrop-blur-md" : "bg-white border-slate-200 shadow-xl",
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-white/40" : "text-slate-500",
  };

  if (isLoading) return <div className="flex items-center justify-center w-full h-96"><FiLoader className="text-4xl animate-spin" style={{ color: accent }} /></div>;

  return (
    <div className="max-w-6xl p-4 mx-auto space-y-6">
      {/* HEADER: Pic, Name, Classification, Branch */}
      <div className={`rounded-[40px] border p-12 flex flex-col md:flex-row items-center gap-10 ${theme.panel}`}>
        <div className="h-44 w-44 rounded-[40px] overflow-hidden border-4 border-white/5 bg-white/5 shadow-2xl flex items-center justify-center">
          {profile?.profile_pic_url ? (
            <img 
              src={`${apiHost}/${profile.profile_pic_url}?t=${new Date().getTime()}`} 
              className="object-cover w-full h-full"
              alt="Profile"
            />
          ) : (
            <FiUser size={80} style={{ color: accent }} className="opacity-20" />
          )}
        </div>

        <div className="flex-1 text-center md:text-left">
          <span className="text-[10px] font-black tracking-[0.4em] uppercase px-6 py-2 rounded-full bg-white/5 border border-white/10 mb-4 inline-block" style={{ color: accent }}>
            {profile?.classification}
          </span>
          <h1 className={`text-6xl font-black tracking-tighter uppercase leading-tight ${theme.textPrimary}`}>
            {profile?.firstname} <br /> {profile?.lastname}
          </h1>
          <div className="flex items-center justify-center md:justify-start gap-4 mt-4 text-[11px] font-bold tracking-widest uppercase opacity-60">
             <FiMapPin style={{ color: accent }} /> {profile?.branch_name}
          </div>
        </div>
      </div>

      {/* INFO GRID: UUID, Email, Department */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className={`rounded-[40px] border p-10 ${theme.panel}`}>
          <div className="flex items-center gap-3 mb-4 opacity-30">
            <FiHash style={{ color: accent }} />
            <p className="text-[9px] font-black uppercase tracking-widest">User UUID</p>
          </div>
          <p className={`text-lg font-mono font-bold ${theme.textPrimary}`}>{profile?.uuid}</p>
        </div>

        <div className={`rounded-[40px] border p-10 ${theme.panel}`}>
          <div className="flex items-center gap-3 mb-4 opacity-30">
            <FiMail style={{ color: accent }} />
            <p className="text-[9px] font-black uppercase tracking-widest">Email Address</p>
          </div>
          <p className={`text-lg font-bold truncate ${theme.textPrimary}`}>{profile?.email}</p>
        </div>

        <div className={`rounded-[40px] border p-10 ${theme.panel}`}>
          <div className="flex items-center gap-3 mb-4 opacity-30">
            <FiBriefcase style={{ color: accent }} />
            <p className="text-[9px] font-black uppercase tracking-widest">Department</p>
          </div>
          <p className={`text-lg font-bold uppercase ${theme.textPrimary}`}>{profile?.department}</p>
        </div>
      </div>
    </div>
  );
};

export default PosMyAccount;