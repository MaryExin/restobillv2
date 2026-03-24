"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FiUsers, FiCheck, FiSearch, FiChevronDown, 
  FiShoppingCart, FiPackage, FiBarChart2, 
  FiSettings, FiMinus 
} from "react-icons/fi";

const PosUserRolesSetUp = ({ isDark, accent, textColor }) => {
  const employees = [
    { name: "JUAN DELA CRUZ", role: "Manager" },
    { name: "MARIA CLARA", role: "Cashier" },
    { name: "JOSE RIZAL", role: "Supervisor" },
    { name: "ANDRES BONIFACIO", role: "Admin" },
  ];

  const [selectedEmployeeObj, setSelectedEmployeeObj] = useState(employees[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [permissions, setPermissions] = useState({
    "Open New Day": true, "Transactions - View": true, "Transactions - Edit": false,
    "Transactions - Void": false, "Transactions Refund": false, "View Product List": true,
    "Edit Product List": false, "View Reports": false, "Export Reports": false,
    "Perform X-Reading": true, "Perform Z-Reading": false, "Open Settings": false,
    "Edit Roles": false, "Add User": false, "Change Password": true,
  });

  const theme = {
    panel: isDark ? "border-white/10 bg-[#0f172a]" : "border-slate-300 bg-white shadow-2xl shadow-slate-200/60",
    textPrimary: isDark ? "text-white" : "text-slate-950", 
    textMuted: isDark ? "text-slate-400" : "text-slate-600",
    categoryHeader: isDark ? "text-slate-300" : "text-slate-700",
    inputBg: isDark ? "bg-white/5 border-white/20" : "bg-slate-50 border-slate-300",
    inputText: isDark ? "text-white" : "text-slate-900",
    dropdownBg: isDark ? "bg-[#111827] border-white/10" : "bg-white border-slate-200 shadow-2xl shadow-black/10",
    dropdownHover: isDark ? "hover:bg-white/5" : "hover:bg-slate-50",
  };

  const roleGroups = [
    { title: "TRANSACTIONS", icon: <FiShoppingCart />, items: ["Open New Day", "Transactions - View", "Transactions - Edit", "Transactions - Void", "Transactions Refund"] },
    { title: "INVENTORY", icon: <FiPackage />, items: ["View Product List", "Edit Product List"] },
    { title: "AUDIT", icon: <FiBarChart2 />, items: ["View Reports", "Export Reports", "Perform X-Reading", "Perform Z-Reading"] },
    { title: "CONTROL", icon: <FiSettings />, items: ["Open Settings", "Edit Roles", "Add User", "Change Password"] },
  ];

  const togglePermission = (key) => setPermissions(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleCategory = (items) => {
    const allEnabled = items.every(item => permissions[item]);
    const newState = { ...permissions };
    items.forEach(item => { newState[item] = !allEnabled; });
    setPermissions(newState);
  };

  const isCategoryAllEnabled = (items) => items.every(item => permissions[item]);
  const isCategoryPartiallyEnabled = (items) => items.some(item => permissions[item]) && !items.every(item => permissions[item]);

  return (
    <div className="space-y-12 text-left selection:bg-slate-200">
      
      {/* 1. TOP BAR WITH PREMIUM CUSTOM DROPDOWN */}
      <div className={`p-10 rounded-[45px] border-2 flex flex-col lg:flex-row items-center gap-10 transition-all ${theme.panel}`}>
        <div className="relative z-50 flex items-center flex-1 w-full gap-6">
            <div className="flex items-center justify-center w-16 h-16 text-3xl transition-colors duration-500 shadow-xl rounded-3xl" 
                 style={{ backgroundColor: accent, color: textColor }}>
                <FiUsers />
            </div>
            
            <div className="relative flex-1">
                <p className={`text-[11px] font-black uppercase tracking-[0.4em] mb-1.5 ${theme.textMuted}`}>Configuration Target</p>
                
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`w-full flex items-center justify-between font-black uppercase text-2xl tracking-tighter focus:outline-none cursor-pointer ${theme.textPrimary}`}
                >
                    <span>{selectedEmployeeObj.name}</span>
                    <motion.div
                      animate={{ rotate: isDropdownOpen ? 180 : 0 }}
                      className={`text-2xl transition-colors ${theme.textMuted}`}
                    >
                      <FiChevronDown />
                    </motion.div>
                </button>

                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className={`absolute top-full left-0 mt-4 w-[400px] p-5 rounded-[30px] border z-[60] overflow-hidden ${theme.dropdownBg}`}
                    >
                      <div className="space-y-3">
                        {employees.map((emp) => (
                          <button
                            key={emp.name}
                            onClick={() => {
                              setSelectedEmployeeObj(emp);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-5 rounded-2xl transition-all group ${theme.dropdownHover}`}
                          >
                            <div className="text-left">
                                <span className={`text-[13px] font-black uppercase tracking-wider group-hover:text-slate-950 ${
                                  selectedEmployeeObj.name === emp.name ? theme.textPrimary : isDark ? "text-white/60" : "text-slate-600"
                                }`}>
                                    {emp.name}
                                </span>
                                <p className={`text-[10px] font-black uppercase tracking-[0.3em] mt-1 ${isDark ? "text-white/30" : "text-slate-400"}`}>{emp.role}</p>
                            </div>
                            
                            {selectedEmployeeObj.name === emp.name && (
                                <div className="flex items-center justify-center w-6 h-6 text-xl transition-colors duration-500 rounded-full" style={{ color: accent }}>
                                  <FiCheck />
                                </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
            </div>
        </div>

        <div className={`flex items-center gap-4 px-8 py-5 rounded-[30px] border-2 w-full lg:w-[400px] shadow-inner ${theme.inputBg}`}>
            <FiSearch className={`text-xl opacity-60 ${theme.inputText}`} />
            <input 
                type="text" 
                placeholder="SEARCH PERMISSION..." 
                className={`bg-transparent text-[12px] font-black uppercase tracking-[0.2em] outline-none w-full ${theme.inputText} placeholder:text-slate-400`}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>
      </div>

      {/* 2. PERMISSIONS GRID */}
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        {roleGroups.map((group, gIdx) => (
          <div key={gIdx} className={`p-12 rounded-[60px] border-2 flex flex-col transition-all ${theme.panel}`}>
            <div className="flex items-center justify-between pb-8 mb-10 border-b-2 border-slate-200/40">
                <div className="flex items-center gap-5">
                    <span className="text-2xl" style={{ color: accent }}>{group.icon}</span>
                    <h4 className={`text-[13px] font-black uppercase tracking-[0.5em] ${theme.categoryHeader}`}>{group.title}</h4>
                </div>
                <button onClick={() => toggleCategory(group.items)} className="flex items-center gap-4 px-5 py-2 transition-all rounded-full hover:bg-slate-100 group">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${theme.textMuted} group-hover:text-slate-900`}>Select All</span>
                    <div className="flex items-center w-12 p-1 transition-all border rounded-full shadow-inner h-7 border-slate-300/20" style={{ backgroundColor: isCategoryAllEnabled(group.items) ? accent : (isCategoryPartiallyEnabled(group.items) ? accent + '90' : (isDark ? '#1e293b' : '#e2e8f0')) }}>
                        <motion.div animate={{ x: isCategoryAllEnabled(group.items) ? 20 : 0 }} className="flex items-center justify-center w-5 h-5 rounded-full shadow-lg" style={{ backgroundColor: isCategoryAllEnabled(group.items) || isCategoryPartiallyEnabled(group.items) ? textColor : '#fff' }}>
                            {isCategoryAllEnabled(group.items) && <FiCheck size={12} style={{ color: accent }} />}
                            {isCategoryPartiallyEnabled(group.items) && <FiMinus size={12} style={{ color: accent }} />}
                        </motion.div>
                    </div>
                </button>
            </div>
            <div className="flex-1 space-y-6">
              {group.items.filter(item => item.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => (
                <div key={item} className="flex items-center justify-between py-1 group">
                  <span className={`text-[14px] font-black uppercase tracking-wide transition-colors ${permissions[item] ? theme.textPrimary : "text-slate-400"}`}>{item}</span>
                  <button onClick={() => togglePermission(item)} className="relative w-16 transition-all duration-300 rounded-full shadow-inner h-9" style={{ backgroundColor: permissions[item] ? accent : (isDark ? '#1e293b' : '#cbd5e1') }}>
                    <motion.div animate={{ x: permissions[item] ? 28 : 4 }} className="absolute flex items-center justify-center transition-colors rounded-full shadow-xl top-1 h-7 w-7" style={{ backgroundColor: permissions[item] ? textColor : '#fff' }}>
                        {permissions[item] && <FiCheck size={14} style={{ color: accent }} />}
                    </motion.div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 3. ACTION BUTTON */}
      <div className="flex justify-end pt-10">
         <button className="px-20 py-8 rounded-[40px] font-black uppercase text-[13px] tracking-[0.4em] shadow-2xl hover:scale-105 active:scale-95 transition-all" style={{ backgroundColor: accent, color: textColor, boxShadow: `0 25px 50px ${accent}60` }}>
           Update Permissions
         </button>
      </div>
    </div>
  );
};

export default PosUserRolesSetUp;