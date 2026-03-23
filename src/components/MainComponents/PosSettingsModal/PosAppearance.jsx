"use client";

import React from "react";
import { FiCheck, FiLayers, FiInfo } from "react-icons/fi";
import { motion } from "framer-motion";

const PosAppearance = ({ isDark, accentColor, selectedColorObj, setSelectedColorObj, adaptivePalette, getContrastText }) => {
  
  const theme = {
    panel: isDark ? "bg-[#0f172a] border-white/10" : "bg-white border-slate-300 shadow-2xl shadow-slate-200/60",
    textPrimary: isDark ? "text-white" : "text-slate-950",
    textMuted: isDark ? "text-slate-400" : "text-slate-600",
    previewBorder: isDark ? "border-white/10 bg-white/[0.02]" : "border-slate-300 bg-slate-50",
  };

  return (
    <div className="space-y-16 text-left selection:bg-slate-200">
      
      {/* HEADER SECTION */}
      <section className="space-y-10">
        <div className="flex items-center gap-6">
            <div className="flex items-center justify-center w-16 h-16 text-3xl transition-colors duration-500 shadow-xl rounded-3xl" 
                 style={{ backgroundColor: accentColor, color: getContrastText() }}>
                <FiLayers />
            </div>
            <div>
                {/* REMOVED ITALIC, APPLIED FONT-BLACK */}
                <h3 className={`text-4xl font-black uppercase tracking-tighter leading-none ${theme.textPrimary}`}>
                    Appearance
                </h3>
                <p className={`text-[11px] font-black uppercase tracking-[0.4em] mt-2 ${theme.textMuted}`}>
                    Global Accent & Branding
                </p>
            </div>
        </div>

        {/* INFO CARD */}
        <div className={`p-8 rounded-[35px] border-2 flex items-center gap-5 ${theme.panel}`}>
            <div className="text-2xl" style={{ color: accentColor }}><FiInfo /></div>
            <p className={`text-[11px] font-bold uppercase tracking-widest ${theme.textMuted}`}>
                The system theme (Dark/Light) is currently managed by the <span className="font-black">Global System Settings</span>.
            </p>
        </div>
      </section>

      {/* SECTION 2: ADAPTIVE COLOR PALETTE */}
      <section className="space-y-10">
        <div className="pb-4 border-b-2 border-slate-200/30">
            <h4 className={`text-[13px] font-black uppercase tracking-[0.5em] ${theme.textPrimary}`}>
                Accent Palette
            </h4>
            <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${theme.textMuted}`}>
                The selected variant will automatically adjust based on the current theme.
            </p>
        </div>
        
        <div className={`p-12 rounded-[65px] border-2 transition-all duration-500 ${theme.panel}`}>
          <div className="grid grid-cols-2 gap-12 sm:grid-cols-4 lg:grid-cols-8">
            {adaptivePalette.map(color => (
              <button
                key={color.name}
                onClick={() => setSelectedColorObj(color)}
                className="flex flex-col items-center gap-5 group"
              >
                <div 
                  className="flex items-center justify-center w-20 h-20 transition-all duration-300 border-4 rounded-full shadow-2xl group-hover:scale-110 active:scale-90"
                  style={{ 
                    backgroundColor: isDark ? color.dark : color.light, 
                    borderColor: selectedColorObj.name === color.name ? (isDark ? '#fff' : '#0f172a') : 'transparent' 
                  }}
                >
                  {selectedColorObj.name === color.name && (
                      <FiCheck size={32} style={{ color: getContrastText() }} />
                  )}
                </div>
                <span className={`text-[11px] font-black uppercase tracking-widest text-center transition-all ${
                    selectedColorObj.name === color.name ? theme.textPrimary : "opacity-40 group-hover:opacity-100"
                }`}>
                  {color.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: PREVIEW BOX */}
      <div className={`p-14 rounded-[60px] border-2 border-dashed flex flex-col md:flex-row items-center justify-between gap-10 transition-colors duration-500 ${theme.previewBorder}`}>
        <div className="space-y-3 text-left">
            <p className={`text-[11px] font-black uppercase tracking-[0.4em] ${theme.textMuted}`}>Visual Preview</p>
            {/* REMOVED ITALIC */}
            <h5 className={`text-4xl font-black uppercase tracking-tighter ${theme.textPrimary}`}>
                {selectedColorObj.name} {isDark ? "Pastel" : "Deep"}
            </h5>
            <p className={`text-[11px] font-bold uppercase tracking-widest max-w-sm leading-relaxed ${theme.textMuted}`}>
                This accent color will be used for buttons, active indicators, and critical highlights across the CNC-STA MARIA POS.
            </p>
        </div>
        
        <button 
            className="px-20 py-8 rounded-[40px] font-black uppercase text-[13px] tracking-[0.4em] shadow-2xl hover:scale-105 active:scale-95 transition-all" 
            style={{ 
                backgroundColor: accentColor, 
                color: getContrastText(), 
                boxShadow: `0 25px 50px ${accentColor}50` 
            }}
        >
            Apply Theme
        </button>
      </div>
    </div>
  );
};

export default PosAppearance;