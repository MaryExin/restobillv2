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

  // Dummy Data for visual representation if reportData is empty
  const displayData = {
    reportDate: reportData?.reportDate || "03/17/26",
    reportTime: reportData?.reportTime || "03:11 PM",
    startDateTime: reportData?.startDateTime || "03/17/26 08:00 AM",
    endDateTime: reportData?.endDateTime || "03/17/26 03:11 PM",
    begInv: reportData?.begInv || "INV-00001",
    endInv: reportData?.endInv || "INV-00050",
    begVoid: reportData?.begVoid || "V-00001",
    endVoid: reportData?.endVoid || "V-00002",
    begRefund: reportData?.begRefund || "R-00000",
    endRefund: reportData?.endRefund || "R-00000",
    resetCounter: reportData?.resetCounter || "001",
    zCounter: reportData?.zCounter || "00045",
    ...reportData
  };

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
            <p className="text-[10px] text-blue-700 leading-relaxed italic font-bold">
              * Select a specific date to retrieve historical Z-Reading data from the server.
            </p>
          </div>
        </div>

        {/* RIGHT SIDE: RECEIPT PREVIEW */}
        <div className="flex flex-col flex-1 h-full min-w-0">
          
          {/* Header Controls */}
          <div className="flex items-center justify-between mb-3 text-[11px] font-bold tracking-[0.2em] text-white uppercase px-1">
            <span>Reprint Z-Reading</span>
            <button onClick={onClose} className="flex items-center gap-1.5 hover:text-rose-400 transition-colors">
              CLOSE <FaTimes size={18} />
            </button>
          </div>

          {/* Receipt Content - All text set to font-bold */}
          <div className="bg-[#fefefe] text-slate-900 shadow-[0_0_50px_rgba(0,0,0,0.3)] overflow-y-auto rounded-sm flex-1 p-8 font-mono text-[11px] leading-tight border-2 border-blue-100 font-bold
                          scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
            
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 italic animate-pulse text-slate-400">
                <div className="w-8 h-8 border-4 rounded-full border-slate-200 border-t-blue-500 animate-spin"></div>
                Retrieving Data...
              </div>
            ) : (
              <div className="max-w-[340px] mx-auto">
                
                {/* HEADER SECTION */}
                <div className="text-center">
                  <div className="text-slate-300">{line}</div>
                  <div className="my-1 text-sm">Z-Reading Report</div>
                  <div className="text-[10px] font-bold text-slate-500">(Reprint: {displayData.reprintDateTime || '03/17/26 03:11 PM'})</div>
                  <div className="mt-2 text-slate-300">{line}</div>
                </div>

                {/* BASIC INFO WITH DUMMY DATA */}
                <div className="mt-4 space-y-0.5">
                  <div className="flex justify-between"><span>Report Date:</span><span>{displayData.reportDate}</span></div>
                  <div className="flex justify-between"><span>Report Time:</span><span>{displayData.reportTime}</span></div>
                  <div className="flex justify-between"><span>Start Date & Time:</span><span>{displayData.startDateTime}</span></div>
                  <div className="flex justify-between"><span>End Date & Time:</span><span>{displayData.endDateTime}</span></div>
                  <div className="flex justify-between pt-1"><span>Beg. INV#:</span><span>{displayData.begInv}</span></div>
                  <div className="flex justify-between"><span>End INV#:</span><span>{displayData.endInv}</span></div>
                  <div className="flex justify-between"><span>Beg. VOID #:</span><span>{displayData.begVoid}</span></div>
                  <div className="flex justify-between"><span>End VOID #:</span><span>{displayData.endVoid}</span></div>
                  <div className="flex justify-between"><span>Beg. REFUND #:</span><span>{displayData.begRefund}</span></div>
                  <div className="flex justify-between"><span>End. REFUND #:</span><span>{displayData.endRefund}</span></div>
                  
                  <div className="flex justify-between pt-3"><span>Reset Counter No.</span><span>{displayData.resetCounter}</span></div>
                  <div className="flex justify-between"><span>Z Counter No.:</span><span>{displayData.zCounter}</span></div>
                </div>

                <div className="my-2 text-slate-300">{line}</div>

                {/* SALES SUMMARY SECTION */}
                <div className="space-y-0.5">
                  <div className="flex justify-between"><span>Present Accum. Sales:</span><span>{f(displayData.presentSales)}</span></div>
                  <div className="flex justify-between"><span>Previous Accum. Sales:</span><span>{f(displayData.previousSales)}</span></div>
                  <div className="flex justify-between"><span>Sales for the Day:</span><span>{f(displayData.dailySales)}</span></div>
                </div>

                <div className="my-2 text-slate-300">{line}</div>
                <div className="mb-2 text-center">BREAKDOWN OF SALES</div>
                <div className="space-y-0.5">
                  <div className="flex justify-between"><span>VATABLE SALES:</span><span>{f(displayData.vatableSales)}</span></div>
                  <div className="flex justify-between"><span>VAT AMOUNT:</span><span>{f(displayData.vatAmount)}</span></div>
                  <div className="flex justify-between"><span>VAT-EXEMPT SALES:</span><span>{f(displayData.vatExemptSales)}</span></div>
                  <div className="flex justify-between"><span>VAT EXEMPTION:</span><span>{f(displayData.vatExemption)}</span></div>
                  <div className="flex justify-between"><span>ZERO RATED SALES:</span><span>{f(displayData.zeroRated)}</span></div>
                  <div className="flex justify-between"><span>OTHER CHARGES:</span><span>{f(displayData.otherCharges)}</span></div>
                </div>

                <div className="my-2 text-slate-300">{line}</div>
                <div className="space-y-0.5">
                  <div className="flex justify-between"><span>Gross Amount:</span><span>{f(displayData.gross)}</span></div>
                  <div className="flex justify-between"><span>Discount:</span><span>{f(displayData.discount)}</span></div>
                  <div className="flex justify-between"><span>VAT Exemption:</span><span>{f(displayData.vatExemption)}</span></div>
                  <div className="flex justify-between"><span>Refund:</span><span>{f(displayData.refund)}</span></div>
                  <div className="flex justify-between"><span>Void:</span><span>{f(displayData.void)}</span></div>
                  <div className="flex justify-between"><span>VAT Adjustment:</span><span>{f(displayData.vatAdjustment)}</span></div>
                  <div className="flex justify-between"><span>Net Amount:</span><span>{f(displayData.net)}</span></div>
                </div>

                <div className="my-2 text-slate-300">{line}</div>
                <div className="mb-2 text-center">DISCOUNT SUMMARY</div>
                <div className="space-y-0.5">
                  <div className="flex justify-between"><span>SC. DISC. :</span><span>{f(displayData.scDisc)}</span></div>
                  <div className="flex justify-between"><span>PWD DISC. :</span><span>{f(displayData.pwdDisc)}</span></div>
                  <div className="flex justify-between"><span>NAAC DISC. :</span><span>{f(displayData.naacDisc)}</span></div>
                  <div className="flex justify-between"><span>SOLO PARENT DISC. :</span><span>{f(displayData.soloDisc)}</span></div>
                  <div className="flex justify-between"><span>OTHER DISC. :</span><span>{f(displayData.otherDisc)}</span></div>
                </div>

                <div className="my-2 text-slate-300">{line}</div>
                <div className="mb-2 text-center">SALES ADJUSTMENT</div>
                <div className="space-y-0.5">
                  <div className="flex justify-between"><span>VOID:</span><span>{f(displayData.void)}</span></div>
                  <div className="flex justify-between"><span>REFUND:</span><span>{f(displayData.refund)}</span></div>
                </div>

                <div className="my-2 text-slate-300">{line}</div>
                <div className="mb-2 text-center">VAT ADJUSTMENT</div>
                <div className="space-y-0.5">
                  <div className="flex justify-between"><span>SC TRANS. :</span><span>{f(displayData.scTrans)}</span></div>
                  <div className="flex justify-between"><span>PWD TRANS. :</span><span>{f(displayData.pwdTrans)}</span></div>
                  <div className="flex justify-between"><span>REG. DISC. TRANS. :</span><span>{f(displayData.regDisc)}</span></div>
                  <div className="flex justify-between"><span>ZERO RATED TRANS. :</span><span>{f(displayData.zeroRatedTrans)}</span></div>
                  <div className="flex justify-between"><span>VAT ON RETURN :</span><span>{f(displayData.vatOnReturn)}</span></div>
                  <div className="flex justify-between"><span>OTHER VAT ADJ. :</span><span>{f(displayData.otherVatAdj)}</span></div>
                </div>

                <div className="my-2 text-slate-300">{line}</div>
                <div className="mb-2 text-center">TRANSACTION SUMMARY</div>
                <div className="space-y-0.5">
                  <div className="flex justify-between"><span>Cash in Drawer:</span><span>{f(displayData.cash)}</span></div>
                  <div className="flex justify-between"><span>CHEQUE:</span><span>{f(displayData.cheque)}</span></div>
                  <div className="flex justify-between"><span>CREDIT CARD:</span><span>{f(displayData.creditCard)}</span></div>
                  <div className="flex justify-between"><span>OTHER PAYMENTS:</span><span>{f(displayData.otherPayments)}</span></div>
                  <div className="flex justify-between"><span>Opening Fund:</span><span>{f(displayData.openingFund)}</span></div>
                  <div className="flex justify-between"><span>Withdrawal:</span><span>{f(displayData.withdrawal)}</span></div>
                  <div className="flex justify-between"><span>Payments Received:</span><span>{f(displayData.paymentsReceived)}</span></div>
                </div>

                <div className="my-2 text-slate-300">{line}</div>
                <div className="flex justify-between">
                  <span>SHORT / OVER:</span>
                  <span>{f(displayData.shortOver)}</span>
                </div>
                <div className="mt-2 text-slate-300">{line}</div>
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