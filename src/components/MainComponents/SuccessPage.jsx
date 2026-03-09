import { FaCheckCircle, FaDownload, FaLock, FaShieldAlt } from "react-icons/fa";
import { FiZap } from "react-icons/fi";
import { IoSparkles } from "react-icons/io5";

export default function CmpSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-2xl">
        <div className="animate-slide-up">
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl border border-blue-100/50 p-8 md:p-12">
            <div className="flex justify-center mb-8">
              <div className="animate-bounce-subtle">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <div
                    className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping"
                    style={{ animationDuration: "2s" }}
                  ></div>
                  <div className="absolute inset-4 rounded-full bg-blue-500/5"></div>
                  <FaCheckCircle className="w-16 h-16 text-blue-500 relative z-10" />
                </div>
              </div>
            </div>

            <div className="text-center mb-3 flex items-center justify-center gap-2">
              <IoSparkles className="w-6 h-6 text-blue-500 animate-pulse" />
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900">
                <span className="text-balance">Payment Confirmed!</span>
              </h1>
              <IoSparkles className="w-6 h-6 text-blue-500 animate-pulse" />
            </div>

            <p className="text-lg text-center text-slate-600 mb-10 leading-relaxed">
              Your subscription is now active and ready to use. Welcome to the
              premium experience!
            </p>

            <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200/50 rounded-2xl p-7 mb-10 shadow-inner">
              <div className="grid grid-cols-2 gap-8 md:gap-10">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Subscription Plan
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    Premium Annual
                  </p>
                </div>
                <div className="space-y-2 text-right">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Amount Paid
                  </p>
                  <p className="text-2xl font-bold text-blue-600">₱699</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                    <p className="text-lg font-semibold text-emerald-600">
                      Active
                    </p>
                  </div>
                </div>
                <div className="space-y-2 text-right">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Next Billing
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    Dec 26, 2025
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-10">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-6 ml-1">
                Premium benefits unlocked:
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-4 group">
                  <div className="mt-1 p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-all duration-300">
                    <FiZap className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      Unlimited Access
                    </p>
                    <p className="text-sm text-slate-600">
                      All premium features available immediately
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 group">
                  <div className="mt-1 p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-all duration-300">
                    <FaLock className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      Priority Support
                    </p>
                    <p className="text-sm text-slate-600">
                      24/7 dedicated customer support team
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 group">
                  <div className="mt-1 p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-all duration-300">
                    <FaShieldAlt className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      Advanced Analytics
                    </p>
                    <p className="text-sm text-slate-600">
                      In-depth insights and reporting tools
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold py-4 px-6 rounded-xl transition-all duration-300 border-2 border-blue-200 hover:border-blue-300 flex items-center justify-center gap-2 active:scale-95 shadow-sm hover:shadow-md"
              >
                <FaDownload className="w-4 h-4" />
                Download Receipt
              </button>
            </div>

            <p className="text-center text-sm text-slate-600 leading-relaxed">
              A detailed confirmation email has been sent to{" "}
              <span className="font-semibold text-slate-900">
                your@email.com
              </span>
              . Please check your inbox for billing and account details.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-3">
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-5 shadow-lg border border-blue-100/50 hover:shadow-xl transition-all duration-300 hover:border-blue-200/70 hover:scale-105">
              <FaShieldAlt className="w-6 h-6 text-blue-600 mx-auto mb-3" />
              <p className="text-xs font-semibold text-slate-700 text-center">
                Secure Payment
              </p>
            </div>
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-5 shadow-lg border border-blue-100/50 hover:shadow-xl transition-all duration-300 hover:border-blue-200/70 hover:scale-105">
              <FiZap className="w-6 h-6 text-blue-600 mx-auto mb-3" />
              <p className="text-xs font-semibold text-slate-700 text-center">
                Instant Access
              </p>
            </div>
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-5 shadow-lg border border-blue-100/50 hover:shadow-xl transition-all duration-300 hover:border-blue-200/70 hover:scale-105">
              <FaCheckCircle className="w-6 h-6 text-blue-600 mx-auto mb-3" />
              <p className="text-xs font-semibold text-slate-700 text-center">
                100% Verified
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
