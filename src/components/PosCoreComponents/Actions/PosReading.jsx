import React, { useState, useEffect } from "react";
import { FaFileInvoice, FaPrint, FaMoneyBillWave, FaUserCircle } from "react-icons/fa";

/**
 * Combined PosReading Modal Component
 * Step 1: Selection (X/Z Reading)
 * Step 2: X-Reading Cashier Selection
 * Step 3: X-Reading Cash Drawer Input (with Verify)
 * Step 4: Z-Reading Cash Count (Closing with Verify)
 */
const PosReading = ({ isOpen, onClose, onXReadingSubmit, onZReadingSubmit }) => {
  const [step, setStep] = useState(1); 
  const [selectedCashier, setSelectedCashier] = useState("");
  const [amount, setAmount] = useState("");
  const [verifyAmount, setVerifyAmount] = useState("");

  const cashiers = [
    { id: 1, name: "All Cashiers" },
    { id: 2, name: "AM SHIFT" },
    { id: 3, name: "Cashier Staff" },
    { id: 4, name: "PM SHIFT" },
  ];

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setAmount("");
      setVerifyAmount("");
      setSelectedCashier("");
    }
  }, [isOpen]);

  const handleCashierSelect = (name) => {
    setSelectedCashier(name);
    setAmount("");
    setVerifyAmount("");
    setStep(3); 
  };

  const handleXSubmit = () => {
    if (amount !== verifyAmount) {
      alert("Amounts do not match!");
      return;
    }
    if (onXReadingSubmit) {
      onXReadingSubmit(selectedCashier, amount);
    }
  };

  const handleZSubmit = () => {
    if (amount !== verifyAmount) {
      alert("Amounts do not match!");
      return;
    }
    if (onZReadingSubmit) {
      onZReadingSubmit(amount);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
      <div className="w-[480px] rounded-[25px] bg-[#f0f5ff] p-8 shadow-2xl border border-white flex flex-col items-center">
        
        {/* --- STEP 1: INITIAL SELECTION --- */}
        {step === 1 && (
          <>
            <h2 className="mb-8 text-[28px] font-bold text-[#3b5998]">POS Reading</h2>
            <div className="flex flex-col w-full gap-5 mb-10">
              <button
                onClick={() => setStep(2)}
                className="flex items-center justify-center gap-6 w-full h-[85px] bg-white rounded-[18px] shadow-sm hover:bg-slate-50 transition-all active:scale-[0.98]"
              >
                <FaFileInvoice className="text-[35px] text-blue-400" />
                <span className="text-[22px] font-medium text-slate-500">X-Reading</span>
              </button>

              <button
                onClick={() => setStep(4)}
                className="flex items-center justify-center gap-6 w-full h-[85px] bg-white rounded-[18px] shadow-sm hover:bg-slate-50 transition-all active:scale-[0.98]"
              >
                <FaPrint className="text-[35px] text-orange-400" />
                <span className="text-[22px] font-medium text-slate-500">Z-Reading</span>
              </button>
            </div>
            <button
              onClick={onClose}
              className="h-[52px] w-[240px] rounded-full font-bold text-white text-[18px] shadow-lg active:scale-95 transition-transform"
              style={{ background: "linear-gradient(to right, #f78ca0, #60cbe5)" }}
            >
              Cancel
            </button>
          </>
        )}

        {/* --- STEP 2: X-READING CASHIER SELECTION --- */}
        {step === 2 && (
          <>
            <h2 className="mb-6 text-[28px] font-bold text-[#3b5998]">Select Cashier Name</h2>
            <div className="flex flex-col w-full gap-3 mb-8 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
              {cashiers.map((cashier) => (
                <button
                  key={cashier.id}
                  onClick={() => handleCashierSelect(cashier.name)}
                  className="flex items-center justify-start px-8 gap-6 w-full min-h-[85px] bg-white rounded-[18px] shadow-sm border border-transparent hover:border-blue-300 transition-all active:scale-95 group"
                >
                  <FaUserCircle className="text-[42px] text-[#00a1ff]" />
                  <span className="text-[20px] font-medium text-slate-500 group-hover:text-blue-500">
                    {cashier.name}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(1)}
              className="h-[52px] w-[240px] rounded-full font-bold text-white text-[18px] shadow-lg active:scale-95"
              style={{ background: "linear-gradient(to right, #f78ca0, #60cbe5)" }}
            >
              Back
            </button>
          </>
        )}

        {/* --- STEP 3: X-READING CASH DRAWER INPUT (WITH VERIFY) --- */}
        {step === 3 && (
          <>
            <h2 className="text-[28px] font-bold text-[#3b5998] mb-1">X-Reading</h2>
            <p className="mb-8 italic font-medium text-slate-500">Cashier: {selectedCashier}</p>
            
            <div className="w-full mb-10 space-y-6">
              <div className="flex flex-col w-full gap-2 text-left">
                <label className="text-[#3b5998] font-bold text-[18px] ml-2">Cash Drawer Amount:</label>
                <div className="relative">
                  <FaMoneyBillWave className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-400 text-[22px]" />
                  <input 
                    type="number"
                    className="w-full h-[65px] pl-14 pr-6 rounded-full border-2 border-blue-200 outline-none text-[20px] bg-white focus:border-blue-400"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col w-full gap-2 text-left">
                <label className="text-[#3b5998] font-bold text-[18px] ml-2">Verify Amount:</label>
                <div className="relative">
                  <FaMoneyBillWave className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-400 text-[22px]" />
                  <input 
                    type="number"
                    placeholder="Double click to copy"
                    className="w-full h-[65px] pl-14 pr-6 rounded-full border-2 border-blue-200 outline-none text-[20px] bg-white focus:border-blue-400"
                    value={verifyAmount}
                    onChange={(e) => setVerifyAmount(e.target.value)}
                    onDoubleClick={() => setVerifyAmount(amount)}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(2)}
                className="h-[55px] w-[180px] rounded-full font-bold text-white text-[18px] shadow-lg active:scale-95"
                style={{ background: "linear-gradient(to right, #f78ca0, #60cbe5)" }}
              >
                Back
              </button>
              <button
                onClick={handleXSubmit}
                className="h-[55px] w-[180px] rounded-full font-bold text-white text-[18px] shadow-lg active:scale-95"
                style={{ background: "linear-gradient(to right, #3b5998, #60cbe5)" }}
              >
                Submit
              </button>
            </div>
          </>
        )}

        {/* --- STEP 4: Z-READING CASH COUNT --- */}
        {step === 4 && (
          <>
            <h2 className="text-[32px] font-bold text-[#3b5998] mb-1">Input Cash Count</h2>
            <p className="mb-8 font-medium text-slate-500">Closing for: {new Date().toISOString().split('T')[0]}</p>
            <div className="w-full mb-10 space-y-6">
              <div className="flex flex-col w-full gap-2 text-left">
                <label className="text-[#3b5998] font-bold text-[18px] ml-2">Input Amount:</label>
                <div className="relative">
                  <FaMoneyBillWave className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-400 text-[22px]" />
                  <input 
                    type="number"
                    className="w-full h-[65px] pl-14 pr-6 rounded-full border-2 border-orange-300 outline-none text-[20px] bg-white focus:border-orange-400"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col w-full gap-2 text-left">
                <label className="text-[#3b5998] font-bold text-[18px] ml-2">Verify Amount:</label>
                <div className="relative">
                  <FaMoneyBillWave className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-400 text-[22px]" />
                  <input 
                    type="number"
                    placeholder="Double click to copy"
                    className="w-full h-[65px] pl-14 pr-6 rounded-full border-2 border-orange-300 outline-none text-[20px] bg-white focus:border-orange-400"
                    value={verifyAmount}
                    onChange={(e) => setVerifyAmount(e.target.value)}
                    onDoubleClick={() => setVerifyAmount(amount)}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="h-[55px] w-[180px] rounded-full font-bold text-white text-[18px] shadow-lg active:scale-95"
                style={{ background: "linear-gradient(to right, #f78ca0, #60cbe5)" }}
              >
                Back
              </button>
              <button
                onClick={handleZSubmit}
                className="h-[55px] w-[180px] rounded-full font-bold text-white text-[18px] shadow-lg active:scale-95"
                style={{ background: "linear-gradient(to right, #f78ca0, #60cbe5)" }}
              >
                Submit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PosReading;  