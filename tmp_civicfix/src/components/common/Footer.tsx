import React from "react";
import { MapPin, CheckCircle, ShieldCheck, HeartHandshake, PhoneCall, Sparkles, Shield, Lock, ArrowRight } from "lucide-react";

export const Footer: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  return (
    <footer className="bg-slate-900 text-slate-400 text-xs border-t border-slate-800 pb-20 sm:pb-8 pt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-slate-800">
          {/* Brand Col */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2 text-white">
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <span className="font-heading font-extrabold text-lg text-white">
                Civic<span className="text-teal-400">Fix</span>
              </span>
            </div>
            <p className="text-slate-300 font-medium text-xs leading-relaxed">
              Report civic issues. Track the fix. Together.
            </p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Transforming citizen evidence into structured, location-aware municipal action with transparent tracking.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-teal-400 font-semibold pt-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI + Maps + Status</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">
              Citizen Portal
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => onNavigate("report")}
                  className="hover:text-white transition-colors"
                >
                  Report a Problem
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate("dashboard")}
                  className="hover:text-white transition-colors"
                >
                  Citizen Dashboard
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate("complaints")}
                  className="hover:text-white transition-colors"
                >
                  Track Complaints
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate("map")}
                  className="hover:text-white transition-colors"
                >
                  Live City Issues Map
                </button>
              </li>
            </ul>
          </div>

          {/* Municipal Staff & Admin Portal Link */}
          <div>
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">
              Administration
            </h4>
            <div className="space-y-3">
              {/* Dedicated Admin Portal Access Card */}
              <button
                onClick={() => onNavigate("admin")}
                className="w-full text-left p-3.5 rounded-2xl bg-gradient-to-br from-slate-800 to-indigo-950/60 hover:from-slate-800 hover:to-indigo-900/80 border border-slate-700/80 hover:border-indigo-500/50 text-white transition-all group shadow-sm flex flex-col gap-2 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                      <Shield className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-xs text-white group-hover:text-indigo-300 transition-colors">
                      Admin Portal
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-indigo-950/80 text-indigo-300 border-indigo-800/80">
                    RBAC Protected
                  </span>
                </div>

                <div className="text-[11px] text-slate-300">
                  Municipal operations console for triage, dispatching work crews, and status updates.
                </div>

                <div className="flex items-center gap-1 text-[11px] text-indigo-400 font-semibold pt-0.5">
                  <span>Sign In / Access Admin Console</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>

              <ul className="space-y-1.5 pt-1 text-[11px]">
                <li className="text-slate-500 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-slate-600" />
                  <span>BBMP Central Operations Desk</span>
                </li>
                <li className="text-slate-500 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-slate-600" />
                  <span>BESCOM Electrical Infrastructure</span>
                </li>
                <li className="text-slate-500 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-slate-600" />
                  <span>BWSSB Water & Sewerage Utility</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Trust & Emergency */}
          <div>
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">
              Emergency & Trust
            </h4>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-300">
                  You review every AI-generated complaint before it is submitted.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <PhoneCall className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Civic Helpline: 1533 / 1912</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-[10px] text-slate-400 leading-relaxed">
                CivicFix routes and tracks civic complaints for local municipal bodies. In case of immediate life hazard or electrical fire, dial 112 directly.
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px]">
          <div>
            © {new Date().getFullYear()} CivicFix Platform. Public Civic Technology Initiative.
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <span>Privacy First</span>
            <span>•</span>
            <span>Open Civic Protocol</span>
            <span>•</span>
            {/* Admin sign-up / login link in footer bottom bar */}
            <button
              onClick={() => onNavigate("admin")}
              className="text-slate-400 hover:text-indigo-400 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
            >
              <Lock className="w-3 h-3 text-indigo-400" />
              <span>Admin Login / Sign Up</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
