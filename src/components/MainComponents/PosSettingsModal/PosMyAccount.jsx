"use client";

import React, { useState, useEffect } from "react";
import {
  FiLoader,
  FiMail,
  FiHash,
  FiMapPin,
  FiBriefcase,
  FiUser,
} from "react-icons/fi";
import useApiHost from "../../../hooks/useApiHost";

const PosMyAccount = ({ isDark, accent }) => {
  const apiHost = useApiHost();
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const storedUuid = localStorage.getItem("user_id");
      if (!storedUuid || !apiHost) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${apiHost}/api/get_user_profile.php?user_id=${storedUuid}`,
        );
        const data = await response.json();

        if (data && !data.error) {
          setProfile(data);
        }
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [apiHost]);

  const theme = {
    panel: isDark
      ? "bg-slate-900/40 border-white/5"
      : "bg-white border-slate-200 shadow-sm",
    panelSoft: isDark
      ? "bg-slate-950/50 border-slate-800"
      : "bg-slate-50 border-slate-200",
    textPrimary: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-slate-400" : "text-slate-500",
    textSoft: isDark ? "text-slate-500" : "text-slate-400",
  };

  const profileImage = profile?.profile_pic_url
    ? `${apiHost}/${profile.profile_pic_url}?t=${new Date().getTime()}`
    : `${apiHost}/item_pictures/Default.jpg`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full min-h-[420px]">
        <div
          className={`rounded-[28px] border px-8 py-10 flex flex-col items-center gap-4 ${theme.panel}`}
        >
          <div
            className={`h-16 w-16 rounded-2xl flex items-center justify-center ${
              isDark
                ? "bg-slate-950 border border-slate-800"
                : "bg-slate-50 border border-slate-200"
            }`}
          >
            <FiLoader
              className="text-3xl animate-spin"
              style={{ color: accent }}
            />
          </div>
          <div className="text-center">
            <p
              className={`text-[10px] font-black tracking-[0.24em] uppercase ${theme.textSoft}`}
            >
              Loading
            </p>
            <p className={`mt-2 text-sm ${theme.textMuted}`}>
              Fetching account information...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div
        className={`rounded-[32px] border p-8 sm:p-10 text-center ${theme.panel}`}
      >
        <div
          className={`mx-auto mb-5 h-20 w-20 rounded-[24px] flex items-center justify-center ${
            isDark
              ? "bg-slate-950 border border-slate-800"
              : "bg-slate-50 border border-slate-200"
          }`}
        >
          <FiUser size={34} style={{ color: accent }} />
        </div>

        <p
          className={`text-[10px] font-black tracking-[0.24em] uppercase ${theme.textSoft}`}
        >
          My Account
        </p>
        <h2 className={`mt-2 text-2xl font-black ${theme.textPrimary}`}>
          No profile data found
        </h2>
        <p className={`mt-3 text-sm max-w-md mx-auto ${theme.textMuted}`}>
          We could not load your account details from the server.
        </p>
      </div>
    );
  }

  const fullName =
    `${profile?.firstname || ""} ${profile?.lastname || ""}`.trim();

  const infoCards = [
    {
      label: "User UUID",
      value: profile?.uuid || "—",
      icon: FiHash,
      valueClass: "font-mono text-sm sm:text-base break-all",
    },
    {
      label: "Username",
      value: profile?.email || "—",
      icon: FiMail,
      valueClass: "font-bold text-sm sm:text-base break-all",
    },
    {
      label: "Department",
      value: profile?.department || "—",
      icon: FiBriefcase,
      valueClass: "font-bold text-sm sm:text-base uppercase",
    },
    {
      label: "Classification",
      value: profile?.classification || "User Account",
      icon: FiUser,
      valueClass: "font-bold text-sm sm:text-base uppercase",
    },
    {
      label: "Branch",
      value: profile?.branch_name || "—",
      icon: FiMapPin,
      valueClass: "font-bold text-sm sm:text-base uppercase",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* HERO */}
      <div
        className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-8 lg:p-10 ${theme.panel}`}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-[-40px] right-[-40px] h-40 w-40 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: accent }}
          />
        </div>

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center">
          <div className="flex justify-center lg:justify-start">
            <div
              className={`relative h-36 w-36 sm:h-40 sm:w-40 rounded-[30px] overflow-hidden border ${
                isDark
                  ? "bg-slate-950 border-slate-800"
                  : "bg-slate-100 border-slate-200"
              } shadow-xl`}
            >
              <img
                src={profileImage}
                className="object-cover w-full h-full"
                alt="Profile"
                onError={(e) => {
                  const defaultPath = `${apiHost}/item_pictures/Default.jpg`;
                  if (e.target.src !== defaultPath) {
                    e.target.src = defaultPath;
                  }
                }}
              />
            </div>
          </div>

          <div className="flex-1 text-center lg:text-left">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black tracking-[0.24em] uppercase border ${
                isDark
                  ? "bg-slate-950/70 border-slate-800"
                  : "bg-white border-slate-200"
              }`}
              style={{ color: accent }}
            >
              <FiUser size={12} />
              {profile?.classification || "User Account"}
            </span>

            <h1
              className={`mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase leading-tight ${theme.textPrimary}`}
            >
              {fullName || "Unnamed User"}
            </h1>

            <div
              className={`mt-4 flex flex-col sm:flex-row sm:flex-wrap items-center lg:items-start gap-3 sm:gap-4 text-[11px] font-black tracking-[0.18em] uppercase ${theme.textMuted}`}
            >
              <div className="flex items-center gap-2">
                <FiMapPin style={{ color: accent }} />
                <span>{profile?.branch_name || "No Branch"}</span>
              </div>

              <div className="hidden sm:block opacity-40">•</div>

              <div className="flex items-center gap-2">
                <FiBriefcase style={{ color: accent }} />
                <span>{profile?.department || "No Department"}</span>
              </div>
            </div>

            <p className={`mt-5 max-w-2xl text-sm ${theme.textMuted}`}>
              Review your account details, assigned branch, and profile
              information from this section.
            </p>
          </div>
        </div>
      </div>

      {/* QUICK INFO */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {infoCards.map((item, index) => {
          const Icon = item.icon;

          return (
            <div
              key={`${item.label}-${index}`}
              className={`rounded-[28px] border p-5 sm:p-6 ${theme.panel}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className={`h-10 w-10 rounded-2xl flex items-center justify-center border ${
                        isDark
                          ? "bg-slate-950 border-slate-800"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <Icon size={16} style={{ color: accent }} />
                    </div>

                    <p
                      className={`text-[10px] font-black tracking-[0.22em] uppercase ${theme.textSoft}`}
                    >
                      {item.label}
                    </p>
                  </div>

                  <p className={`${theme.textPrimary} ${item.valueClass}`}>
                    {item.value}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* PROFILE SUMMARY PANEL */}
      <div className={`rounded-[32px] border p-6 sm:p-8 ${theme.panelSoft}`}>
        <p
          className={`text-[10px] font-black tracking-[0.24em] uppercase ${theme.textSoft}`}
        >
          Account Overview
        </p>

        <div className="grid grid-cols-1 gap-4 mt-5 md:grid-cols-3">
          <div
            className={`rounded-[24px] border p-5 ${
              isDark
                ? "bg-slate-900/50 border-slate-800"
                : "bg-white border-slate-200"
            }`}
          >
            <p
              className={`text-[10px] font-black tracking-[0.2em] uppercase ${theme.textSoft}`}
            >
              Full Name
            </p>
            <p
              className={`mt-2 text-lg font-black uppercase ${theme.textPrimary}`}
            >
              {fullName || "—"}
            </p>
          </div>

          <div
            className={`rounded-[24px] border p-5 ${
              isDark
                ? "bg-slate-900/50 border-slate-800"
                : "bg-white border-slate-200"
            }`}
          >
            <p
              className={`text-[10px] font-black tracking-[0.2em] uppercase ${theme.textSoft}`}
            >
              Assigned Branch
            </p>
            <p
              className={`mt-2 text-lg font-black uppercase ${theme.textPrimary}`}
            >
              {profile?.branch_name || "—"}
            </p>
          </div>

          <div
            className={`rounded-[24px] border p-5 ${
              isDark
                ? "bg-slate-900/50 border-slate-800"
                : "bg-white border-slate-200"
            }`}
          >
            <p
              className={`text-[10px] font-black tracking-[0.2em] uppercase ${theme.textSoft}`}
            >
              Department
            </p>
            <p
              className={`mt-2 text-lg font-black uppercase ${theme.textPrimary}`}
            >
              {profile?.department || "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PosMyAccount;
