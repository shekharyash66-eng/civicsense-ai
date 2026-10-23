import React, { useState, useEffect } from "react";
import { Complaint, User } from "../types";
import { StatusBadge } from "../components/ui/StatusBadge";
import { fetchCitizenReportsFromSupabase } from "../services/supabaseService";
import {
  PlusCircle,
  FileText,
  Clock,
  CheckCircle2,
  MapPin,
  ChevronRight,
  ArrowRight,
  User as UserIcon,
  LogOut,
  Map as MapIcon,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

interface DashboardPageProps {
  currentUser: User;
  complaints: Complaint[];
  onNavigate: (route: string) => void;
  onSelectComplaint: (id: string) => void;
  onLogout?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  currentUser,
  complaints: propComplaints,
  onNavigate,
  onSelectComplaint,
  onLogout,
}) => {
  const [citizenReports, setCitizenReports] = useState<Complaint[]>(() =>
    propComplaints.filter(
      (c) => c.citizenId === currentUser.id || c.citizenName === currentUser.name
    )
  );
  const [isLoading, setIsLoading] = useState(false);

  // Requirement Part 12: Restricted to the logged-in citizen's own reports (.eq('user_id', user.id))
  useEffect(() => {
    let isMounted = true;
    const loadCitizenData = async () => {
      if (!currentUser?.id) return;
      setIsLoading(true);
      try {
        const res = await fetchCitizenReportsFromSupabase(currentUser.id);
        if (isMounted && res.success && Array.isArray(res.reports)) {
          // If Supabase has records, use them; merge with local matching records
          const map = new Map<string, Complaint>();
          propComplaints
            .filter((c) => c.citizenId === currentUser.id || c.citizenName === currentUser.name)
            .forEach((c) => map.set(c.id, c));
          res.reports.forEach((r) => map.set(r.id, r));
          setCitizenReports(Array.from(map.values()));
        }
      } catch (err) {
        console.warn("[Dashboard] fetchCitizenReports notice:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadCitizenData();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, propComplaints]);

  // Compute greeting based on time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Statistics restricted strictly to citizen's own reports
  const totalReports = citizenReports.length;
  const pendingCount = citizenReports.filter(
    (c) => c.status === "SUBMITTED" || c.status === "ACKNOWLEDGED"
  ).length;
  const inProgressCount = citizenReports.filter(
    (c) => c.status === "IN_PROGRESS" || c.status === "ASSIGNED"
  ).length;
  const resolvedCount = citizenReports.filter(
    (c) => c.status === "RESOLVED" || c.status === "CLOSED"
  ).length;

  // Recent 4 complaints
  const recentComplaints = citizenReports.slice(0, 4);

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20 pt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header Hero Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-2xs">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full mb-2 border border-teal-200">
              <MapPin className="w-3.5 h-3.5 text-teal-600" />
              <span>{currentUser.city ? `${currentUser.ward || "Local Ward"} • ${currentUser.city}` : "Citizen Service Zone"}</span>
            </div>
            <h1 className="font-heading text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {greeting}, {currentUser.name.split(" ")[0]}
            </h1>
            <p className="text-sm sm:text-base text-slate-500 mt-1">
              Welcome to your citizen console. Track and resolve local neighborhood issues.
            </p>
          </div>

          {/* Citizen Actions (Submit, Profile, Logout) */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigate("report")}
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-sm px-5 py-3 rounded-2xl shadow-md hover:shadow-lg shadow-teal-600/20 transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              <span>Submit New Report</span>
            </button>

            <button
              onClick={() => onNavigate("complaints")}
              className="inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3.5 py-3 rounded-2xl transition-all"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              <span>My Reports</span>
            </button>

            <button
              onClick={() => onNavigate("profile")}
              className="inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3.5 py-3 rounded-2xl transition-all"
            >
              <UserIcon className="w-4 h-4 text-slate-500" />
              <span>Profile</span>
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="inline-flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs px-3.5 py-3 rounded-2xl border border-rose-200/60 transition-all"
                title="Sign out of CivicFix"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>

        {/* Statistics Cards (Part 12: Total, Pending, In-Progress, Resolved) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Reports
            </span>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1 font-heading">
              {String(totalReports).padStart(2, "0")}
            </h3>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Submitted by you</span>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              Pending Review
            </span>
            <h3 className="text-3xl font-extrabold text-blue-900 mt-1 font-heading">
              {String(pendingCount).padStart(2, "0")}
            </h3>
            <span className="text-[11px] text-blue-500 mt-0.5 block">Awaiting triage</span>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
              In Progress
            </span>
            <h3 className="text-3xl font-extrabold text-amber-900 mt-1 font-heading">
              {String(inProgressCount).padStart(2, "0")}
            </h3>
            <span className="text-[11px] text-amber-500 mt-0.5 block">Crews assigned</span>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
              Resolved Fixes
            </span>
            <h3 className="text-3xl font-extrabold text-emerald-900 mt-1 font-heading">
              {String(resolvedCount).padStart(2, "0")}
            </h3>
            <span className="text-[11px] text-emerald-500 mt-0.5 block">Verified completed</span>
          </div>
        </div>

        {/* Quick Actions Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => onNavigate("report")}
            className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-left flex items-center justify-between group transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Report Issue</div>
                <div className="text-xs text-slate-500">Camera or voice complaint</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button
            onClick={() => onNavigate("complaints")}
            className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-left flex items-center justify-between group transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Track My Complaints</div>
                <div className="text-xs text-slate-500">Real-time status & updates</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button
            onClick={() => onNavigate("map")}
            className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-left flex items-center justify-between group transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <MapIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Nearby Ward Map</div>
                <div className="text-xs text-slate-500">Interactive civic issues</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Recent Complaints Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-xl font-bold text-slate-900">
                Recent Reports
              </h2>
              <p className="text-xs text-slate-500">
                Updates from municipal triage and field crews
              </p>
            </div>
            <button
              onClick={() => onNavigate("complaints")}
              className="text-xs sm:text-sm font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              <span>View all ({totalReports})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentComplaints.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">No complaints submitted yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Report potholes, streetlight outages, garbage overflows, or water leaks in your area.
              </p>
              <button
                onClick={() => onNavigate("report")}
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl"
              >
                + Report an Issue
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentComplaints.map((c) => {
                const latestEvent = c.timeline?.[c.timeline.length - 1];
                return (
                  <div
                    key={c.id}
                    onClick={() => onSelectComplaint(c.id)}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:shadow-md hover:border-teal-200 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {c.id}
                        </span>
                        <StatusBadge status={c.status} size="sm" pulse={c.status === "IN_PROGRESS"} />
                      </div>

                      <h3 className="text-base font-bold text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-1">
                        {c.title}
                      </h3>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="truncate">{c.ward}</span>
                        </span>
                        <span>•</span>
                        <span className="truncate text-slate-600 font-medium">
                          {c.department}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="text-slate-500 flex items-center gap-1.5 truncate">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {latestEvent?.title || "Status updated"}: {latestEvent?.timestamp || "Recently"}
                        </span>
                      </div>
                      <span className="text-teal-700 font-semibold group-hover:translate-x-1 transition-transform shrink-0 flex items-center gap-0.5">
                        <span>Track</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
