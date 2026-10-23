import React, { useState, useMemo, useEffect } from "react";
import { User, Complaint, IssueCategory } from "../types";
import { StatusBadge, PriorityBadge } from "../components/ui/StatusBadge";
import { fetchCitizenReportsFromSupabase } from "../services/supabaseService";
import {
  FileText,
  Search,
  Filter,
  PlusCircle,
  MapPin,
  Clock,
  ArrowRight,
  ChevronRight,
  Calendar,
  Sparkles,
  SlidersHorizontal,
  X,
  RefreshCw
} from "lucide-react";

interface MyComplaintsPageProps {
  currentUser: User;
  complaints: Complaint[];
  onNavigate: (route: string) => void;
  onSelectComplaint: (id: string) => void;
}

export const MyComplaintsPage: React.FC<MyComplaintsPageProps> = ({
  currentUser,
  complaints: propComplaints,
  onNavigate,
  onSelectComplaint,
}) => {
  const [activeTab, setActiveTab] = useState<"all" | "active" | "resolved">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"recent" | "priority" | "oldest">("recent");
  const [citizenReports, setCitizenReports] = useState<Complaint[]>(() =>
    propComplaints.filter(
      (c) => c.citizenId === currentUser.id || c.citizenName === currentUser.name
    )
  );
  const [isFetching, setIsFetching] = useState(false);

  // Part 16: Query .from('reports').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  useEffect(() => {
    let isMounted = true;
    const fetchCitizenData = async () => {
      if (!currentUser?.id) return;
      setIsFetching(true);
      try {
        const res = await fetchCitizenReportsFromSupabase(currentUser.id);
        if (isMounted && res.success && Array.isArray(res.reports)) {
          const map = new Map<string, Complaint>();
          propComplaints
            .filter((c) => c.citizenId === currentUser.id || c.citizenName === currentUser.name)
            .forEach((c) => {
              const key = c.complaintId || c.id;
              map.set(key, c);
            });
          res.reports.forEach((r) => {
            const key = r.complaintId || r.id;
            map.set(key, r);
          });
          setCitizenReports(Array.from(map.values()));
        }
      } catch (err) {
        console.warn("[MyComplaintsPage] Supabase fetch error:", err);
      } finally {
        if (isMounted) setIsFetching(false);
      }
    };

    fetchCitizenData();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, propComplaints]);

  // Tab filter
  const tabFiltered = useMemo(() => {
    if (activeTab === "active") {
      return citizenReports.filter(
        (c) => c.status !== "RESOLVED" && c.status !== "CLOSED"
      );
    }
    if (activeTab === "resolved") {
      return citizenReports.filter(
        (c) => c.status === "RESOLVED" || c.status === "CLOSED"
      );
    }
    return citizenReports;
  }, [citizenReports, activeTab]);

  // Search, category and sort
  const finalComplaints = useMemo(() => {
    return tabFiltered
      .filter((c) => {
        const matchCat = categoryFilter === "ALL" || c.category === categoryFilter;
        const matchSearch =
          !searchQuery ||
          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.ward.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
      })
      .sort((a, b) => {
        if (sortBy === "priority") {
          const prioScore = { urgent: 4, high: 3, medium: 2, low: 1 };
          return prioScore[b.priority] - prioScore[a.priority];
        }
        if (sortBy === "oldest") {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [tabFiltered, categoryFilter, searchQuery, sortBy]);

  // Helper for progress bar
  const getStatusProgress = (status: Complaint["status"]) => {
    switch (status) {
      case "SUBMITTED":
        return 20;
      case "ACKNOWLEDGED":
        return 40;
      case "ASSIGNED":
        return 60;
      case "IN_PROGRESS":
        return 80;
      case "RESOLVED":
      case "CLOSED":
        return 100;
      default:
        return 20;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20 pt-6 sm:pt-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-2xs">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full mb-1 border border-teal-200">
              <FileText className="w-3.5 h-3.5 text-teal-600" />
              <span>Citizen Records</span>
            </div>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              My Complaints
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Track status, technician assignments, and community confirmations for your reports.
            </p>
          </div>

          <button
            onClick={() => onNavigate("report")}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Report New Issue</span>
          </button>
        </div>

        {/* Filters & Tabs Ribbon */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Status Tabs (All, Active, Resolved) */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "all"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({citizenReports.length})
              </button>
              <button
                onClick={() => setActiveTab("active")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "active"
                    ? "bg-white text-teal-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Active (
                {
                  citizenReports.filter(
                    (c) => c.status !== "RESOLVED" && c.status !== "CLOSED"
                  ).length
                }
                )
              </button>
              <button
                onClick={() => setActiveTab("resolved")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "resolved"
                    ? "bg-white text-emerald-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Resolved (
                {
                  citizenReports.filter(
                    (c) => c.status === "RESOLVED" || c.status === "CLOSED"
                  ).length
                }
                )
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID or issue..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-teal-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 font-medium">Filter Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 outline-none"
              >
                <option value="ALL">All Categories</option>
                <option value="streetlight">Streetlight</option>
                <option value="pothole">Pothole / Road</option>
                <option value="garbage">Garbage / Waste</option>
                <option value="water_leakage">Water Leakage</option>
                <option value="drainage">Drainage</option>
                <option value="tree_fall">Tree Fall</option>
              </select>

              <span className="text-slate-400 font-medium ml-2">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 outline-none"
              >
                <option value="recent">Most Recent</option>
                <option value="priority">Highest Priority</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>

            <span className="text-slate-500">
              Showing <strong>{finalComplaints.length}</strong> complaints
            </span>
          </div>
        </div>

        {/* Complaints Grid / Cards */}
        {finalComplaints.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">No complaints match your filters</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Try resetting filters or submit a new report if you notice an issue.
            </p>
            <button
              onClick={() => onNavigate("report")}
              className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              + Report an Issue
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {finalComplaints.map((c) => {
              const progressPct = getStatusProgress(c.status);
              return (
                <div
                  key={c.id}
                  onClick={() => onSelectComplaint(c.id)}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:shadow-md hover:border-teal-300 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    {/* ID, Badges, Category */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          #{c.id}
                        </span>
                        <PriorityBadge priority={c.priority} />
                      </div>
                      <StatusBadge status={c.status} size="sm" pulse={c.status === "IN_PROGRESS"} />
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-base text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-1">
                      {c.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {c.description}
                    </p>

                    {/* Progress Bar (Requirement #18: visual status progress bar) */}
                    <div className="mt-4 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Workflow Progress</span>
                        <span className="font-semibold text-slate-600">{progressPct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            c.status === "RESOLVED" || c.status === "CLOSED"
                              ? "bg-emerald-500"
                              : "bg-teal-600"
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-3 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="truncate">{c.ward}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </div>

                  {/* Action CTA */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">
                      {c.department}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectComplaint(c.id);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800"
                    >
                      <span>Track Complaint</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
