import React, { useState } from 'react';
import { FaTimes, FaPrint, FaFilePdf, FaCalendarDay, FaSearch } from 'react-icons/fa';

const ZReadingView = ({ isOpen, onClose, reportData, isLoading, onFilter }) => {
  const [selectedDate, setSelectedDate] = useState('');

  if (!isOpen) return null;

  const f = (n) =>
    new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n || 0);

  const line = "========================================";
  const dashLine = "----------------------------------------";

  const handleFilter = () => {
    if (onFilter) onFilter(selectedDate);
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-all duration-300">
      
      {/* Main Container */}
      <div className="relative w-full max-w-[850px] flex flex-col md:flex-row gap-6 h-[95vh] animate-in fade-in zoom-in duration-300">
        
        {/* LEFT SIDE: SIDEBAR FILTER */}
        <div className="w-full md:w-[260px] bg-white rounded-2xl p-6 shadow-2xl border-2 border-blue-100 flex flex-col shrink-0">
          <div className="flex items-center gap-2.5 mb-8 text-blue-600 font-bold uppercase text-[11px] tracking-[0.2em]">
            <FaCalendarDay size={16} />
            <span>Select Report Date</span>
          </div>

          <div className="flex-1 space-y-6">
            <div className="flex flex-col gap-2.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase ml-1 tracking-wider">
                Target Date
              </label>
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full p-3 text-sm transition-all border-2 shadow-inner outline-none cursor-pointer border-blue-50 bg-slate-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button 
              onClick={handleFilter}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2.5 text-xs shadow-lg shadow-blue-500/30 active:scale-95"
            >
              <FaSearch size={13} /> SEARCH RECORDS
            </button>
          </div>

          <div className="p-4 mt-8 border-2 border-blue-50 bg-blue-50/50 rounded-xl">
            <p className="text-[10px] text-blue-700 leading-relaxed italic">
              * Select a specific date to retrieve historical Z-Reading data from the server.
            </p>
          </div>
        </div>

        {/* RIGHT SIDE: RECEIPT PREVIEW */}
        <div className="flex flex-col flex-1 h-full min-w-0">
          
          {/* Header Controls */}
          <div className="flex items-center justify-between mb-3 text-[11px] font-medium tracking-[0.2em] text-white uppercase px-1">
            <span>Electronic Journal Preview</span>
            <button onClick={onClose} className="flex items-center gap-1.5 hover:text-rose-400 transition-colors">
              CLOSE <FaTimes size={18} />
            </button>
          </div>

          {/* Receipt Content */}
          <div className="bg-[#fefefe] text-slate-900 shadow-[0_0_50px_rgba(0,0,0,0.3)] overflow-y-auto rounded-sm flex-1 p-8 font-mono text-[11px] leading-tight border-2 border-blue-100
                          scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
            
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 italic animate-pulse text-slate-400">
                <div className="w-8 h-8 border-4 rounded-full border-slate-200 border-t-blue-500 animate-spin"></div>
                Retrieving Data...
              </div>
            ) : (
              <div className="max-w-[340px] mx-auto">
                
                {/* HEADER SECTION */}
                <div className="font-bold text-center">
                  <div className="text-blue-200">{line}</div>
                  <div className="my-1 text-sm text-blue-600">Z-READING REPORT</div>
                  <div className="text-[10px] font-normal text-slate-500">(Reprint: {reportData?.reprintDateTime})</div>
                  <div className="text-blue-200">{line}</div>
                </div>

                {/* BASIC INFO */}
                <div className="mt-4 space-y-1">
                  <div className="flex justify-between"><span>Report Date:</span><span className="font-bold">{reportData?.reportDate}</span></div>
                  <div className="flex justify-between"><span>Report Time:</span><span>{reportData?.reportTime}</span></div>
                  <div className="flex justify-between"><span>Start Date & Time:</span><span className="text-[10px]">{reportData?.startDateTime}</span></div>
                  <div className="flex justify-between"><span>End Date & Time:</span><span className="text-[10px]">{reportData?.endDateTime}</span></div>
                  <div className="flex justify-between pt-1 mt-1 border-t border-blue-50"><span>Beg. INV #:</span><span>{reportData?.begInv}</span></div>
                  <div className="flex justify-between"><span>End INV #:</span><span>{reportData?.endInv}</span></div>
                  <div className="flex justify-between"><span>Beg. VOID #:</span><span>{reportData?.begVoid}</span></div>
                  <div className="flex justify-between"><span>End VOID #:</span><span>{reportData?.endVoid}</span></div>
                  <div className="flex justify-between"><span>Beg. REFUND #:</span><span>{reportData?.begRefund}</span></div>
                  <div className="flex justify-between"><span>End. REFUND #:</span><span>{reportData?.endRefund}</span></div>
                </div>

                <div className="my-3 font-bold text-center text-blue-100">{dashLine}</div>

                {/* COUNTERS */}
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Reset Counter No.</span><span>{reportData?.resetCounter}</span></div>
                  <div className="flex justify-between font-bold text-blue-600"><span>Z Counter No.</span><span>{reportData?.zCounter}</span></div>
                </div>

                <div className="my-3 font-bold text-center text-blue-200">{line}</div>

                {/* SALES SECTION */}
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Present Accum. Sales:</span><span>{f(reportData?.presentSales)}</span></div>
                  <div className="flex justify-between"><span>Previous Accum. Sales:</span><span>{f(reportData?.previousSales)}</span></div>
                  <div className="flex justify-between pt-2 mt-2 text-sm font-bold text-blue-700 border-t-2 border-blue-100 border-dashed">
                    <span>SALES FOR THE DAY:</span>
                    <span>{f(reportData?.dailySales)}</span>
                  </div>
                </div>

                <div className="mt-5 font-bold text-center uppercase tracking-widest text-[10px] bg-blue-50 text-blue-600 py-1.5 rounded">Breakdown of Sales</div>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between"><span>VATABLE SALES:</span><span>{f(reportData?.vatableSales)}</span></div>
                  <div className="flex justify-between"><span>VAT AMOUNT:</span><span>{f(reportData?.vatAmount)}</span></div>
                  <div className="flex justify-between"><span>VAT-EXEMPT SALES:</span><span>{f(reportData?.vatExemptSales)}</span></div>
                  <div className="flex justify-between"><span>VAT EXEMPTION:</span><span>{f(reportData?.vatExemption)}</span></div>
                  <div className="flex justify-between"><span>ZERO RATED SALES:</span><span>{f(reportData?.zeroRated)}</span></div>
                  <div className="flex justify-between"><span>OTHER CHARGES:</span><span>{f(reportData?.otherCharges)}</span></div>
                </div>

                <div className="my-3 font-bold text-center text-blue-200">{line}</div>

                {/* AMOUNTS & ADJUSTMENTS */}
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Gross Amount:</span><span>{f(reportData?.gross)}</span></div>
                  <div className="flex justify-between font-medium text-rose-600"><span>Discount:</span><span>-{f(reportData?.discount)}</span></div>
                  <div className="flex justify-between font-medium text-rose-600"><span>VAT Exemption:</span><span>-{f(reportData?.vatExemption)}</span></div>
                  <div className="flex justify-between font-medium text-rose-600"><span>Refund:</span><span>-{f(reportData?.refund)}</span></div>
                  <div className="flex justify-between font-medium text-rose-600"><span>Void:</span><span>-{f(reportData?.void)}</span></div>
                  <div className="flex justify-between"><span>VAT Adjustment:</span><span>{f(reportData?.vatAdjustment)}</span></div>
                  <div className="flex justify-between pt-2 mt-2 text-sm font-bold text-blue-800 border-t-2 border-blue-100 border-dashed">
                    <span>NET AMOUNT:</span>
                    <span>{f(reportData?.net)}</span>
                  </div>
                </div>

                {/* TRANSACTION SUMMARY */}
                <div className="mt-5 font-bold text-center uppercase tracking-widest text-[10px] bg-blue-50 text-blue-600 py-1.5 rounded">Transaction Summary</div>
                <div className="px-1 mt-2 space-y-1">
                  <div className="flex justify-between"><span>Cash in Drawer:</span><span>{f(reportData?.cash)}</span></div>
                  <div className="flex justify-between pt-1 border-t border-blue-50"><span>Opening Fund:</span><span>{f(reportData?.openingFund)}</span></div>
                  <div className="flex justify-between font-medium text-rose-600"><span>Withdrawal:</span><span>-{f(reportData?.withdrawal)}</span></div>
                  <div className="flex justify-between font-bold text-blue-700"><span>SHORT / OVER:</span><span>{f(reportData?.shortOver)}</span></div>
                </div>

                <div className="mt-6 text-center">
                  <div className="font-bold text-blue-100">{line}</div>
                  <div className="text-[9px] text-slate-400 italic mt-1 uppercase tracking-tighter">*** End of Transaction Record ***</div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex w-full gap-3 mt-4">
            <button className="flex items-center justify-center flex-1 gap-2.5 py-4 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xl shadow-blue-900/20 active:scale-[0.98]">
              <FaPrint size={16} /> PRINT Z-REPORT
            </button>
            <button className="p-4 text-blue-600 border-2 border-blue-100 rounded-xl bg-white hover:bg-blue-50 transition-all active:scale-[0.98]">
              <FaFilePdf size={22} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ZReadingView;