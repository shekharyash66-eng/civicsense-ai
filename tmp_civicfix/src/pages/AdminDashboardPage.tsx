import React, { useState, useMemo, useEffect } from "react";
import {
  Complaint,
  ComplaintStatus,
  MunicipalDepartment,
  User,
  UserProfile,
  AdminAuditLog,
  DuplicateCandidatePair,
  CivicIncident,
} from "../types";
import {
  updateComplaintStatus,
  assignComplaintToStaff,
  getComplaints,
  getStoredComplaints,
  recalculateAllComplaintScores,
} from "../services/complaintService";
import { fetchReportsFromSupabase, saveReportToSupabase } from "../services/supabaseService";
import {
  logAdminAction,
  fetchAdminAuditLogs,
  fetchProfilesForAdmin,
} from "../services/supabaseAuthService";
import {
  getCandidateDuplicatePairs,
  getRejectedDuplicatePairs,
  confirmDuplicatePair,
  rejectDuplicatePair,
  resetDuplicateReview,
  fetchIncidentsFromSupabase,
  fetchDuplicateReviewsFromSupabase,
  getLocalIncidents,
  getLocalReviews,
} from "../services/incidentService";
import { AdminAuthGate } from "../components/admin/AdminAuthGate";
import { PriorityScoreDisplay } from "../components/ui/PriorityScoreDisplay";
import {
  Shield,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserCheck,
  Send,
  Building2,
  ExternalLink,
  RefreshCw,
  LogOut,
  MapPin,
  ImageIcon,
  Eye,
  X,
  Wrench,
  Download,
  AlertCircle,
  Check,
  Users,
  FileText,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
  Zap,
  GitMerge,
  Link2,
  CheckCheck,
  Ban,
  RotateCcw,
  Info,
} from "lucide-react";
import { StatusBadge, PriorityBadge } from "../components/ui/StatusBadge";

const MUNICIPAL_DEPARTMENTS: MunicipalDepartment[] = [
  "Electrical Maintenance",
  "Road Maintenance",
  "Waste Management",
  "Water & Sewerage",
  "Public Health",
  "Traffic Management",
  "Parks & Public Spaces",
  "General Civic Services",
];

interface AdminDashboardPageProps {
  currentUser: User | null;
  complaints: Complaint[];
  onNavigate: (route: string) => void;
  onSelectComplaint: (id: string) => void;
  onLogout?: () => void;
  onRefreshRole?: () => Promise<void>;
  onUserAuthenticated?: (user: User) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  currentUser,
  complaints: propComplaints,
  onNavigate,
  onSelectComplaint,
  onLogout,
  onRefreshRole,
  onUserAuthenticated,
}) => {
  // Navigation tab within Admin: "reports" | "duplicates" | "users" | "audit"
  const [activeAdminTab, setActiveAdminTab] = useState<"reports" | "duplicates" | "users" | "audit">("reports");

  // Duplicate Candidate Review State (Tab: duplicates)
  const [duplicateSubTab, setDuplicateSubTab] = useState<"pending" | "confirmed" | "rejected">("pending");
  const [candidatePairs, setCandidatePairs] = useState<DuplicateCandidatePair[]>([]);
  const [rejectedPairs, setRejectedPairs] = useState<DuplicateCandidatePair[]>([]);
  const [confirmedIncidents, setConfirmedIncidents] = useState<CivicIncident[]>([]);
  const [isProcessingReview, setIsProcessingReview] = useState<string | null>(null);
  const [reviewActionFeedback, setReviewActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [reviewNotesInput, setReviewNotesInput] = useState<Record<string, string>>({});
  const [remoteIncidentTablesAvailable, setRemoteIncidentTablesAvailable] = useState<boolean>(true);
  const [showSqlMigrationModal, setShowSqlMigrationModal] = useState<boolean>(false);

  // Complaints state: merged local and Supabase reports
  const [reports, setReports] = useState<Complaint[]>(propComplaints);
  const [isFetchingSupabase, setIsFetchingSupabase] = useState(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [selectedBand, setSelectedBand] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"priority_desc" | "date_desc" | "date_asc">("priority_desc");
  const [filterDuplicatesOnly, setFilterDuplicatesOnly] = useState<boolean>(false);
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Refresh duplicate candidates and incidents from memory/local/Supabase
  const refreshDuplicateReviewState = () => {
    const pairs = getCandidateDuplicatePairs(reports);
    setCandidatePairs(pairs);
    const rej = getRejectedDuplicatePairs(reports);
    setRejectedPairs(rej);
    setConfirmedIncidents(getLocalIncidents());
  };

  useEffect(() => {
    refreshDuplicateReviewState();
  }, [reports]);

  // Recalculate priority scores across all complaints
  const handleRecalculateScores = () => {
    setIsRecalculating(true);
    try {
      const rescored = recalculateAllComplaintScores();
      setReports(rescored);
    } finally {
      setTimeout(() => setIsRecalculating(false), 500);
    }
  };

  // Modal: Update Status & Assign Staff
  const [activeModalComplaint, setActiveModalComplaint] = useState<Complaint | null>(null);
  const [modalNewStatus, setModalNewStatus] = useState<ComplaintStatus>("IN_PROGRESS");
  const [modalAssignedStaff, setModalAssignedStaff] = useState("");
  const [modalStaffNote, setModalStaffNote] = useState("");
  const [isSavingAction, setIsSavingAction] = useState(false);

  // Modal: Inspect Full Details
  const [inspectComplaint, setInspectComplaint] = useState<Complaint | null>(null);

  // Modal: Photo enlargement preview
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // User Management State (Tab 2)
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // Audit Logs State (Tab 3)
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Sync reports from Supabase on mount or refresh
  const loadSupabaseReports = async () => {
    setIsFetchingSupabase(true);
    setSupabaseError(null);
    try {
      const res = await fetchReportsFromSupabase();
      if (res.success && res.reports && res.reports.length > 0) {
        setReports(res.reports);
        setLastSyncTime(new Date().toLocaleTimeString());
      } else {
        // Fallback to local complaints
        setReports(propComplaints);
      }
    } catch (err: any) {
      setSupabaseError(err.message || "Failed to query Supabase.");
    } finally {
      setIsFetchingSupabase(false);
    }
  };

  // Load Users from Supabase
  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const users = await fetchProfilesForAdmin();
      setRegisteredUsers(users);
    } catch (e) {
      console.warn("Error fetching users:", e);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Load Audit Logs from Supabase
  const loadAuditLogs = async () => {
    setIsLoadingAudit(true);
    try {
      const logs = await fetchAdminAuditLogs();
      setAuditLogs(logs);
    } catch (e) {
      console.warn("Error fetching audit logs:", e);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // Load Incidents & Duplicate Reviews from Supabase
  const loadIncidentsAndReviews = async () => {
    try {
      const incRes = await fetchIncidentsFromSupabase();
      if (!incRes.tableExists) {
        setRemoteIncidentTablesAvailable(false);
      } else if (incRes.incidents.length > 0) {
        setConfirmedIncidents(incRes.incidents);
      }

      const revRes = await fetchDuplicateReviewsFromSupabase();
      if (!revRes.tableExists) {
        setRemoteIncidentTablesAvailable(false);
      }

      refreshDuplicateReviewState();
    } catch (e) {
      console.warn("Notice: Incident tables query error:", e);
    }
  };

  const handleConfirmDuplicate = async (pair: DuplicateCandidatePair) => {
    if (!currentUser || currentUser.role !== "admin") {
      setReviewActionFeedback({
        type: "error",
        message: "Access Denied: Only municipal administrators can confirm duplicate incidents.",
      });
      return;
    }

    setIsProcessingReview(pair.pairKey);
    setReviewActionFeedback(null);
    try {
      const note = reviewNotesInput[pair.pairKey];
      const res = await confirmDuplicatePair(
        pair.complaint1.complaintId || pair.complaint1.id,
        pair.complaint2.complaintId || pair.complaint2.id,
        {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          role: currentUser.role,
        },
        note
      );

      if (res.success) {
        setReviewActionFeedback({
          type: "success",
          message: `Confirmed! Reports #${pair.complaint1.complaintId || pair.complaint1.id} and #${pair.complaint2.complaintId || pair.complaint2.id} linked under Incident #${res.incidentId}.`,
        });
        const refreshed = getStoredComplaints();
        setReports(refreshed);
        refreshDuplicateReviewState();
      } else {
        setReviewActionFeedback({
          type: "error",
          message: res.error || "Failed to confirm duplicate pair.",
        });
      }
    } catch (err: any) {
      setReviewActionFeedback({
        type: "error",
        message: err.message || "An unexpected error occurred during confirmation.",
      });
    } finally {
      setIsProcessingReview(null);
    }
  };

  const handleRejectDuplicate = async (pair: DuplicateCandidatePair) => {
    if (!currentUser || currentUser.role !== "admin") {
      setReviewActionFeedback({
        type: "error",
        message: "Access Denied: Only municipal administrators can reject duplicate candidates.",
      });
      return;
    }

    setIsProcessingReview(pair.pairKey);
    setReviewActionFeedback(null);
    try {
      const note = reviewNotesInput[pair.pairKey];
      const res = await rejectDuplicatePair(
        pair.complaint1.complaintId || pair.complaint1.id,
        pair.complaint2.complaintId || pair.complaint2.id,
        {
          id: currentUser.id,
          email: currentUser.email,
          role: currentUser.role,
        },
        note
      );

      if (res.success) {
        setReviewActionFeedback({
          type: "success",
          message: `Match rejected. This pair will be suppressed from duplicate suggestions.`,
        });
        refreshDuplicateReviewState();
      } else {
        setReviewActionFeedback({
          type: "error",
          message: res.error || "Failed to reject duplicate pair.",
        });
      }
    } catch (err: any) {
      setReviewActionFeedback({
        type: "error",
        message: err.message || "An unexpected error occurred during rejection.",
      });
    } finally {
      setIsProcessingReview(null);
    }
  };

  const handleResetReview = async (pair: DuplicateCandidatePair) => {
    if (!currentUser || currentUser.role !== "admin") return;
    setIsProcessingReview(pair.pairKey);
    try {
      await resetDuplicateReview(
        pair.complaint1.complaintId || pair.complaint1.id,
        pair.complaint2.complaintId || pair.complaint2.id,
        {
          id: currentUser.id,
          email: currentUser.email,
          role: currentUser.role,
        }
      );
      setReviewActionFeedback({
        type: "success",
        message: `Decision reset. Candidate pair returned to Pending Triage.`,
      });
      refreshDuplicateReviewState();
    } finally {
      setIsProcessingReview(null);
    }
  };

  useEffect(() => {
    if (currentUser?.role === "admin") {
      loadSupabaseReports();
      loadIncidentsAndReviews();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.role === "admin") {
      if (activeAdminTab === "users") loadUsers();
      if (activeAdminTab === "audit") loadAuditLogs();
      if (activeAdminTab === "duplicates") loadIncidentsAndReviews();
    }
  }, [activeAdminTab, currentUser]);

  // Keep synced with parent props if updated locally
  useEffect(() => {
    if (propComplaints && propComplaints.length > 0) {
      setReports((prev) => {
        const map = new Map<string, Complaint>();
        propComplaints.forEach((c) => map.set(c.id, c));
        prev.forEach((c) => {
          if (!map.has(c.id)) map.set(c.id, c);
        });
        return Array.from(map.values());
      });
    }
  }, [propComplaints]);

  // Handle Admin Logout
  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      onNavigate("landing");
    }
  };

  // Filtered complaints list
  const filtered = useMemo(() => {
    const list = reports.filter((c) => {
      const matchDept = selectedDept === "ALL" || c.department === selectedDept;
      const matchStatus = selectedStatus === "ALL" || c.status === selectedStatus;
      const matchPriority = selectedPriority === "ALL" || c.priority === selectedPriority;
      const matchBand = selectedBand === "ALL" || c.priorityScoreData?.band === selectedBand;
      const matchDup =
        !filterDuplicatesOnly ||
        Boolean(c.duplicateInfo?.isPotentialDuplicate && (c.duplicateInfo.duplicateCount || 0) > 0);

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.title?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.id?.toLowerCase().includes(q) ||
        c.complaintId?.toLowerCase().includes(q) ||
        c.citizenName?.toLowerCase().includes(q) ||
        c.citizenPhone?.includes(q) ||
        c.ward?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q);

      return matchDept && matchStatus && matchPriority && matchBand && matchDup && matchSearch;
    });

    // Deterministic sorting
    return list.sort((a, b) => {
      if (sortBy === "priority_desc") {
        return (b.priorityScoreData?.score || 0) - (a.priorityScoreData?.score || 0);
      } else if (sortBy === "date_desc") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortBy === "date_asc") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return 0;
    });
  }, [reports, selectedDept, selectedStatus, selectedPriority, selectedBand, filterDuplicatesOnly, sortBy, searchQuery]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.toLowerCase().trim();
    if (!q) return registeredUsers;
    return registeredUsers.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q) ||
        u.citizen_id?.toLowerCase().includes(q) ||
        u.city?.toLowerCase().includes(q)
    );
  }, [registeredUsers, userSearchQuery]);

  // Metrics Counters
  const totalCount = reports.length;
  const submittedCount = reports.filter((c) => c.status === "SUBMITTED").length;
  const inProgressCount = reports.filter((c) => c.status === "IN_PROGRESS" || c.status === "ASSIGNED").length;
  const resolvedCount = reports.filter((c) => c.status === "RESOLVED").length;
  const criticalBandCount = reports.filter((c) => c.priorityScoreData?.band === "Critical").length;
  const hazardAlertCount = reports.filter((c) => c.immediateSafetyHazard || c.priorityScoreData?.factors?.immediateHazardFlag).length;
  const duplicateClusterCount = reports.filter((c) => c.duplicateInfo?.isPotentialDuplicate).length;
  const pendingDuplicateCount = useMemo(() => {
    return candidatePairs.filter((p) => p.reviewStatus === "PENDING").length;
  }, [candidatePairs]);
  const confirmedIncidentsCount = confirmedIncidents.length;
  const rejectedPairsCount = rejectedPairs.length;

  // Open Action Modal
  const handleOpenActionModal = (c: Complaint) => {
    setActiveModalComplaint(c);
    setModalNewStatus(c.status);
    setModalAssignedStaff(c.assignedTo || "");
    setModalStaffNote("");
  };

  // Save Modal Action
  const handleSaveModalAction = async () => {
    if (!activeModalComplaint || !currentUser) return;
    setIsSavingAction(true);

    try {
      // 1. Update status locally
      const updated = updateComplaintStatus(
        activeModalComplaint.id,
        modalNewStatus,
        modalStaffNote ? `[${currentUser.name || "Administrator"}] ${modalStaffNote}` : undefined,
        currentUser.name || "Administrator"
      );

      // 2. Assign staff if specified
      if (modalAssignedStaff.trim() && modalAssignedStaff !== activeModalComplaint.assignedTo) {
        assignComplaintToStaff(activeModalComplaint.id, modalAssignedStaff.trim());
      }

      // 3. Persist to Supabase if connected
      if (updated) {
        const payloadToSave: Complaint = {
          ...updated,
          assignedTo: modalAssignedStaff.trim() || updated.assignedTo,
        };
        await saveReportToSupabase(payloadToSave);

        // 4. Log admin audit entry
        await logAdminAction({
          action: "UPDATE_STATUS",
          reportId: activeModalComplaint.id,
          details: {
            admin_id: currentUser.id,
            admin_name: currentUser.name || "Municipal Administrator",
            admin_email: currentUser.email || "",
            previous_status: activeModalComplaint.status,
            new_status: modalNewStatus,
            assigned_to: modalAssignedStaff.trim() || activeModalComplaint.assignedTo,
            note: modalStaffNote.trim(),
          },
        });
      }

      // Update local state with recalculated priority score & timeline
      setReports((prev) =>
        prev.map((c) => {
          if (c.id === activeModalComplaint.id) {
            return updated
              ? {
                  ...updated,
                  assignedTo: modalAssignedStaff.trim() || updated.assignedTo,
                }
              : {
                  ...c,
                  status: modalNewStatus,
                  assignedTo: modalAssignedStaff.trim() || c.assignedTo,
                };
          }
          return c;
        })
      );

      setActiveModalComplaint(null);
    } catch (err: any) {
      alert("Error saving update: " + err.message);
    } finally {
      setIsSavingAction(false);
    }
  };

  // CSV Export for Municipal Reports
  const handleExportCSV = () => {
    if (filtered.length === 0) {
      alert("No reports to export based on current filters.");
      return;
    }

    const headers = [
      "Report ID",
      "Title",
      "Category",
      "Department",
      "Status",
      "Priority",
      "Citizen Name",
      "Citizen Phone",
      "Ward",
      "Latitude",
      "Longitude",
      "Assigned Crew",
      "Submitted Date",
    ];

    const rows = filtered.map((c) => [
      `"${c.complaintId || c.id}"`,
      `"${(c.title || "").replace(/"/g, '""')}"`,
      `"${c.category}"`,
      `"${c.department}"`,
      c.status,
      c.priority,
      `"${c.citizenName || ""}"`,
      `"${c.citizenPhone || ""}"`,
      `"${c.ward || ""}"`,
      c.latitude,
      c.longitude,
      `"${c.assignedTo || ""}"`,
      `"${c.createdAt}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `civicfix_reports_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // RBAC GUARD: If user is not logged in OR role is citizen, render AdminAuthGate
  if (!currentUser || currentUser.role !== "admin") {
    return (
      <AdminAuthGate
        currentUser={currentUser}
        onAuthenticated={(adminUser) => {
          if (onUserAuthenticated) {
            onUserAuthenticated(adminUser);
          }
        }}
        onBackToSite={() => onNavigate(currentUser ? "dashboard" : "landing")}
        onRefreshRole={onRefreshRole}
      />
    );
  }

  // LOGGED-IN ADMIN OPERATIONS CONSOLE
  return (
    <div className="min-h-screen bg-slate-100/70 pb-20 pt-6 sm:pt-8 text-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Top Master Admin Header & Profile Banner */}
        <div className="bg-slate-900 text-white p-6 sm:p-7 rounded-3xl border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative overflow-hidden">
          <div className="space-y-2 z-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-300 bg-teal-950/80 border border-teal-800/80 px-2.5 py-1 rounded-full">
                <Shield className="w-3.5 h-3.5 text-teal-400" />
                <span>Municipal Administration Panel</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Verified Supabase Admin</span>
              </span>
            </div>

            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Civic Operations & Reports Console
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Real-time oversight of all citizen reports submitted on CivicFix. Dispatch municipal work crews, update resolution timelines, and audit live records.
            </p>
          </div>

          {/* Admin Profile Card & Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 z-10">
            <div className="bg-slate-800/90 border border-slate-700/80 p-3 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md text-sm">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "A"}
              </div>
              <div className="text-left pr-2">
                <div className="text-xs font-bold text-white flex items-center gap-1">
                  <span>{currentUser.name || "Administrator"}</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                  {currentUser.email}
                </div>
                <div className="text-[10px] text-teal-300 font-medium">
                  {currentUser.ward || "City Administration"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate("landing")}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors cursor-pointer"
                title="View Citizen Public Portal"
              >
                Citizen Portal
              </button>
              <button
                onClick={handleLogout}
                className="bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 text-xs font-bold px-3 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Log out of Admin Console"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Administration Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
          <button
            onClick={() => setActiveAdminTab("reports")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeAdminTab === "reports"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Reports Management</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeAdminTab === "reports" ? "bg-slate-800 text-teal-300" : "bg-slate-200 text-slate-700"
            }`}>
              {totalCount}
            </span>
          </button>

          <button
            onClick={() => setActiveAdminTab("duplicates")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeAdminTab === "duplicates"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white"
            }`}
          >
            <GitMerge className="w-4 h-4 text-amber-500" />
            <span>Duplicate & Incident Review</span>
            {pendingDuplicateCount > 0 ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500 text-slate-950 font-mono animate-pulse">
                {pendingDuplicateCount}
              </span>
            ) : (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeAdminTab === "duplicates" ? "bg-slate-800 text-teal-300" : "bg-slate-200 text-slate-700"
              }`}>
                0
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveAdminTab("users")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeAdminTab === "users"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Profiles & Roles</span>
          </button>

          <button
            onClick={() => setActiveAdminTab("audit")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeAdminTab === "audit"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white"
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Admin Audit Logs</span>
          </button>
        </div>

        {/* TAB 1: REPORTS MANAGEMENT */}
        {activeAdminTab === "reports" && (
          <div className="space-y-6">
            {/* Action Required: Duplicate Candidates Banner */}
            {pendingDuplicateCount > 0 && (
              <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-900 flex items-center justify-center shrink-0">
                    <GitMerge className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <span>{pendingDuplicateCount} Potential Duplicate Incident Group{pendingDuplicateCount > 1 ? "s" : ""} Detected</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">Triage Action Required</span>
                    </div>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Algorithm matched complaints with high semantic similarity and geographic proximity. Confirm shared incidents or reject matches to keep triage clean.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveAdminTab("duplicates")}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>Review Candidates ({pendingDuplicateCount})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Realtime Supabase Sync & Stats Ribbon */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-700">Database Sync:</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 font-semibold text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Connected to public.reports
                </span>
                {lastSyncTime && (
                  <span className="text-slate-400 text-[11px] hidden md:inline">
                    Last synced at {lastSyncTime}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleRecalculateScores}
                  disabled={isRecalculating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Recalculate transparent 4-factor Civic Priority Scores"
                >
                  <Zap className={`w-3.5 h-3.5 text-indigo-600 ${isRecalculating ? "animate-spin" : ""}`} />
                  <span>{isRecalculating ? "Recalculating..." : "Recalculate Scores"}</span>
                </button>

                <button
                  onClick={loadSupabaseReports}
                  disabled={isFetchingSupabase}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-teal-600 ${isFetchingSupabase ? "animate-spin" : ""}`} />
                  <span>{isFetchingSupabase ? "Syncing..." : "Refresh from Supabase"}</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                  title="Export visible reports to CSV"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Supabase Notice if error */}
            {supabaseError && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Notice: {supabaseError}. Showing locally stored records.</span>
                </div>
                <button
                  onClick={loadSupabaseReports}
                  className="underline font-bold text-amber-800 hover:text-amber-950 text-xs"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Metrics Grid (6 Columns) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total Reports
                </span>
                <div className="text-2xl font-extrabold text-slate-900 font-heading mt-1">
                  {totalCount}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">All submissions</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                  Critical Band
                </span>
                <div className="text-2xl font-extrabold text-rose-900 font-heading mt-1">
                  {criticalBandCount}
                </div>
                <span className="text-[10px] text-rose-600 mt-0.5 block">Score ≥ 80 / 100</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                  Safety Hazards
                </span>
                <div className="text-2xl font-extrabold text-rose-900 font-heading mt-1">
                  {hazardAlertCount}
                </div>
                <span className="text-[10px] text-rose-700 mt-0.5 block">Immediate review</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  Submitted
                </span>
                <div className="text-2xl font-extrabold text-blue-900 font-heading mt-1">
                  {submittedCount}
                </div>
                <span className="text-[10px] text-blue-600 mt-0.5 block">Awaiting triage</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                  In Progress
                </span>
                <div className="text-2xl font-extrabold text-amber-900 font-heading mt-1">
                  {inProgressCount}
                </div>
                <span className="text-[10px] text-amber-600 mt-0.5 block">Assigned / field</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  Resolved
                </span>
                <div className="text-2xl font-extrabold text-emerald-900 font-heading mt-1">
                  {resolvedCount}
                </div>
                <span className="text-[10px] text-emerald-600 mt-0.5 block">Fix completed</span>
              </div>
            </div>

            {/* Filter and Search Controls */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by ticket ID, title, citizen name, phone, ward, address..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-teal-500 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Priority Band Filter */}
                <select
                  value={selectedBand}
                  onChange={(e) => setSelectedBand(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl outline-none"
                >
                  <option value="ALL">All Bands (0–100)</option>
                  <option value="Critical">Critical Band (80–100)</option>
                  <option value="High">High Band (60–79.9)</option>
                  <option value="Medium">Medium Band (35–59.9)</option>
                  <option value="Low">Low Band (0–34.9)</option>
                </select>

                {/* Sort Order */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium px-3 py-2 rounded-xl outline-none"
                >
                  <option value="priority_desc">Sort: Priority Score (High → Low)</option>
                  <option value="date_desc">Sort: Newest First</option>
                  <option value="date_asc">Sort: Oldest First</option>
                </select>

                {/* Department Filter */}
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium px-3 py-2 rounded-xl outline-none"
                >
                  <option value="ALL">All Departments</option>
                  {MUNICIPAL_DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium px-3 py-2 rounded-xl outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SUBMITTED">SUBMITTED</option>
                  <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>

                {/* Duplicate Cluster Filter Toggle */}
                <button
                  type="button"
                  onClick={() => setFilterDuplicatesOnly(!filterDuplicatesOnly)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 shrink-0 ${
                    filterDuplicatesOnly
                      ? "bg-amber-100 text-amber-900 border-amber-300 shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                  <span>Duplicates Only ({duplicateClusterCount})</span>
                </button>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      viewMode === "table"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Table View
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("cards")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      viewMode === "cards"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Card Grid
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                <span>
                  Showing <strong>{filtered.length}</strong> of <strong>{reports.length}</strong> total civic reports
                </span>
                {(selectedDept !== "ALL" || selectedStatus !== "ALL" || selectedPriority !== "ALL" || searchQuery) && (
                  <button
                    onClick={() => {
                      setSelectedDept("ALL");
                      setSelectedStatus("ALL");
                      setSelectedPriority("ALL");
                      setSearchQuery("");
                    }}
                    className="text-teal-700 hover:text-teal-900 font-semibold underline text-[11px]"
                  >
                    Reset All Filters
                  </button>
                )}
              </div>
            </div>

            {/* REPORTS DISPLAY: TABLE VIEW */}
            {viewMode === "table" && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-5 py-3.5">Ticket & Evidence</th>
                        <th className="px-5 py-3.5">Citizen Reporter</th>
                        <th className="px-5 py-3.5">Ward & Location</th>
                        <th className="px-5 py-3.5">Category & Dept</th>
                        <th className="px-5 py-3.5">Civic Priority Score</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-400">
                            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <div className="font-bold text-slate-600 text-sm">No reports match your filters</div>
                            <p className="text-xs text-slate-400 mt-1">Try clearing search or filters to see all reports.</p>
                          </td>
                        </tr>
                      ) : (
                        filtered.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                            {/* ID, Title & Photo */}
                            <td className="px-5 py-4 font-medium">
                              <div className="flex items-start gap-3">
                                {c.imageUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewPhotoUrl(c.imageUrl!)}
                                    className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200 hover:ring-2 hover:ring-teal-400 transition-all cursor-pointer relative group"
                                    title="Click to enlarge evidence"
                                  >
                                    <img
                                      src={c.imageUrl}
                                      alt={c.title}
                                      className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                      referrerPolicy="no-referrer"
                                    />
                                  </button>
                                ) : (
                                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center shrink-0">
                                    <ImageIcon className="w-4 h-4 text-slate-400" />
                                  </div>
                                )}
                                <div>
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.2 rounded text-[11px]">
                                      #{c.complaintId || c.id}
                                    </span>
                                    {c.aiConfidence && (
                                      <span className="text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded font-semibold border border-teal-100">
                                        AI {Math.round(c.aiConfidence * 100)}%
                                      </span>
                                    )}
                                  </div>
                                  <div
                                    onClick={() => setInspectComplaint(c)}
                                    className="text-slate-900 font-bold max-w-xs truncate hover:text-teal-700 cursor-pointer"
                                  >
                                    {c.title}
                                  </div>
                                  <div className="text-[11px] text-slate-400 line-clamp-1 max-w-xs">
                                    {c.description}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Citizen */}
                            <td className="px-5 py-4 text-slate-600">
                              <div className="font-semibold text-slate-900">{c.citizenName || "Citizen Reporter"}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {c.citizenPhone || "No phone logged"}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(c.createdAt).toLocaleDateString()}
                              </div>
                            </td>

                            {/* Ward & Address */}
                            <td className="px-5 py-4 text-slate-600">
                              <div className="font-bold text-slate-800">{c.ward || "City Ward"}</div>
                              <div className="text-[11px] text-slate-500 max-w-[170px] truncate" title={c.address}>
                                {c.address}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {c.latitude?.toFixed(4)}, {c.longitude?.toFixed(4)}
                              </div>
                            </td>

                            {/* Category & Department */}
                            <td className="px-5 py-4 text-slate-700">
                              <span className="inline-block text-[10px] uppercase font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md mb-1">
                                {c.category}
                              </span>
                              <div className="text-[11px] text-slate-600 flex items-center gap-1 font-medium truncate max-w-[160px]">
                                <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{c.department}</span>
                              </div>
                              {c.assignedTo && (
                                <div className="text-[10px] text-indigo-700 font-semibold truncate mt-0.5">
                                  Crew: {c.assignedTo}
                                </div>
                              )}
                            </td>

                            {/* Civic Priority Score (40% Safety, 25% Severity, 20% Population, 15% Time) */}
                            <td className="px-5 py-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-xs text-slate-900">
                                    {c.priorityScoreData ? `${c.priorityScoreData.score.toFixed(1)}` : "—"}
                                  </span>
                                  <span className="text-[10px] text-slate-400">/ 100</span>
                                  {c.priorityScoreData && (
                                    <span
                                      className={`px-1.5 py-0.2 text-[10px] font-bold rounded border ${
                                        c.priorityScoreData.band === "Critical"
                                          ? "bg-rose-50 text-rose-700 border-rose-200"
                                          : c.priorityScoreData.band === "High"
                                          ? "bg-amber-50 text-amber-700 border-amber-200"
                                          : c.priorityScoreData.band === "Medium"
                                          ? "bg-teal-50 text-teal-700 border-teal-200"
                                          : "bg-slate-100 text-slate-600 border-slate-200"
                                      }`}
                                    >
                                      {c.priorityScoreData.band}
                                    </span>
                                  )}
                                </div>

                                {(c.immediateSafetyHazard || c.priorityScoreData?.factors?.immediateHazardFlag) && (
                                  <div className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                    <ShieldAlert className="w-3 h-3 text-rose-600 shrink-0" />
                                    <span>Immediate Hazard</span>
                                  </div>
                                )}

                                {c.duplicateInfo?.isPotentialDuplicate && (
                                  <div className="text-[10px] text-amber-700 font-medium flex items-center gap-1">
                                    <Layers className="w-3 h-3 text-amber-600" />
                                    <span>{c.duplicateInfo.duplicateCount} related</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-5 py-4">
                              <StatusBadge status={c.status} size="sm" pulse={c.status === "IN_PROGRESS"} />
                            </td>

                            {/* Actions */}
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenActionModal(c)}
                                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Update Status / Dispatch Crew"
                                >
                                  <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Update</span>
                                </button>

                                <button
                                  onClick={() => setInspectComplaint(c)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                                  title="View Full Report Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => onSelectComplaint(c.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer"
                                  title="Open on Citizen Tracker"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* REPORTS DISPLAY: CARD GRID VIEW */}
            {viewMode === "cards" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.length === 0 ? (
                  <div className="col-span-full text-center py-12 bg-white rounded-3xl border border-slate-200 text-slate-400">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <div className="font-bold text-slate-600 text-sm">No reports match your filters</div>
                  </div>
                ) : (
                  filtered.map((c) => (
                    <div
                      key={c.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-shadow p-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            #{c.complaintId || c.id}
                          </span>
                          <StatusBadge status={c.status} size="sm" />
                        </div>

                        {c.imageUrl && (
                          <div
                            onClick={() => setPreviewPhotoUrl(c.imageUrl!)}
                            className="w-full h-36 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 relative group cursor-pointer"
                          >
                            <img
                              src={c.imageUrl}
                              alt={c.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                              <Eye className="w-4 h-4" /> Click to enlarge
                            </div>
                          </div>
                        )}

                        <div>
                          <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{c.title}</h4>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{c.description}</p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 text-xs space-y-1 text-slate-600">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Citizen:</span>
                            <span className="font-semibold text-slate-800">{c.citizenName}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Location:</span>
                            <span className="font-medium truncate max-w-[180px]">{c.ward}, {c.address}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Priority Score:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-800">
                                {c.priorityScoreData ? `${c.priorityScoreData.score.toFixed(1)}/100` : "—"}
                              </span>
                              {c.priorityScoreData && (
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                  c.priorityScoreData.band === "Critical"
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : c.priorityScoreData.band === "High"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : c.priorityScoreData.band === "Medium"
                                    ? "bg-teal-50 text-teal-700 border-teal-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                }`}>
                                  {c.priorityScoreData.band}
                                </span>
                              )}
                            </div>
                          </div>
                          {(c.immediateSafetyHazard || c.priorityScoreData?.factors?.immediateHazardFlag) && (
                            <div className="flex items-center justify-between text-[11px] text-rose-700 bg-rose-50 p-1.5 rounded-lg border border-rose-200">
                              <span className="flex items-center gap-1 font-bold">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                Immediate Safety Hazard
                              </span>
                              <span className="text-[10px] uppercase font-bold">Urgent</span>
                            </div>
                          )}
                          {c.duplicateInfo?.isPotentialDuplicate && (
                            <div className="flex items-center justify-between text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                              <span className="flex items-center gap-1 font-semibold">
                                <Layers className="w-3.5 h-3.5" />
                                {c.duplicateInfo.duplicateCount} Related Duplicate(s)
                              </span>
                              <span className="text-[10px]">Within 350m</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Dept:</span>
                            <span className="truncate max-w-[160px]">{c.department}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenActionModal(c)}
                          className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Update Status</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInspectComplaint(c)}
                          className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs"
                          title="Inspect Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DUPLICATE & INCIDENT REVIEW */}
        {activeAdminTab === "duplicates" && (
          <div className="space-y-6">
            {/* Header Ribbon */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-bold text-lg text-slate-900">
                      Duplicate Complaint Triage & Incident Grouping
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      Phase 1 Admin Review
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                    Review candidate pairs detected by text similarity, category matching, and geographic distance.
                    Confirming groups reports under a shared incident while preserving each citizen's original complaint, ID, and timeline.
                    Rejections persist to prevent duplicate reappearance.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={refreshDuplicateReviewState}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                    title="Refresh Candidate Pairs"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                    <span>Refresh Pairs</span>
                  </button>

                  <button
                    onClick={() => setShowSqlMigrationModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                    title="View Supabase Incident Schema Migration"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Schema SQL</span>
                  </button>
                </div>
              </div>

              {/* Action Feedback Banner */}
              {reviewActionFeedback && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between animate-in fade-in duration-150 ${
                    reviewActionFeedback.type === "success"
                      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                      : "bg-rose-50 text-rose-900 border-rose-200"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {reviewActionFeedback.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{reviewActionFeedback.message}</span>
                  </div>
                  <button
                    onClick={() => setReviewActionFeedback(null)}
                    className="text-xs font-bold underline opacity-70 hover:opacity-100 cursor-pointer ml-3"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Remote Supabase Table Advisory */}
              {!remoteIncidentTablesAvailable && (
                <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Database Notice: </span>
                      Tables <code className="bg-amber-100 px-1 rounded font-mono text-[11px]">public.civic_incidents</code> and{" "}
                      <code className="bg-amber-100 px-1 rounded font-mono text-[11px]">public.civic_duplicate_reviews</code> are not yet installed in your Supabase project.
                      Local persistence and review actions are operational in this session. Run the migration script in Supabase SQL Editor for cross-device cloud persistence.
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSqlMigrationModal(true)}
                    className="underline font-bold text-amber-950 whitespace-nowrap text-xs cursor-pointer"
                  >
                    Copy Migration
                  </button>
                </div>
              )}

              {/* Duplicate Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                    Pending Review
                  </span>
                  <div className="text-2xl font-extrabold text-amber-950 font-heading mt-0.5">
                    {pendingDuplicateCount}
                  </div>
                  <span className="text-[10px] text-amber-700 mt-0.5 block">Requires triage decision</span>
                </div>

                <div className="bg-teal-50/60 p-3.5 rounded-2xl border border-teal-200/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                    Confirmed Incidents
                  </span>
                  <div className="text-2xl font-extrabold text-teal-950 font-heading mt-0.5">
                    {confirmedIncidentsCount}
                  </div>
                  <span className="text-[10px] text-teal-700 mt-0.5 block">Shared incident groups</span>
                </div>

                <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-200/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                    Linked Reports
                  </span>
                  <div className="text-2xl font-extrabold text-indigo-950 font-heading mt-0.5">
                    {confirmedIncidents.reduce((acc, i) => acc + (i.reportCount || 0), 0)}
                  </div>
                  <span className="text-[10px] text-indigo-700 mt-0.5 block">Reports under incidents</span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Rejected Pairs
                  </span>
                  <div className="text-2xl font-extrabold text-slate-900 font-heading mt-0.5">
                    {rejectedPairsCount}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Suppressed from triage</span>
                </div>
              </div>

              {/* Sub-Tabs: Pending Triage | Confirmed Incidents | Rejected Matches */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDuplicateSubTab("pending")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    duplicateSubTab === "pending"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pending Triage</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    duplicateSubTab === "pending" ? "bg-amber-700 text-white" : "bg-slate-200 text-slate-700"
                  }`}>
                    {pendingDuplicateCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDuplicateSubTab("confirmed")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    duplicateSubTab === "confirmed"
                      ? "bg-teal-700 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Confirmed Incidents</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    duplicateSubTab === "confirmed" ? "bg-teal-800 text-white" : "bg-slate-200 text-slate-700"
                  }`}>
                    {confirmedIncidentsCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDuplicateSubTab("rejected")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    duplicateSubTab === "rejected"
                      ? "bg-slate-800 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Rejected Pairs</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    duplicateSubTab === "rejected" ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700"
                  }`}>
                    {rejectedPairsCount}
                  </span>
                </button>
              </div>
            </div>

            {/* SUB-TAB 1: PENDING TRIAGE CANDIDATE PAIRS */}
            {duplicateSubTab === "pending" && (
              <div className="space-y-4">
                {candidatePairs.filter((p) => p.reviewStatus === "PENDING").length === 0 ? (
                  <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 shadow-2xs space-y-3">
                    <CheckCheck className="w-10 h-10 text-emerald-500 mx-auto" />
                    <h4 className="font-heading font-bold text-slate-900 text-base">
                      No Pending Duplicate Candidates
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      All submitted citizen complaints are distinct or have already been triaged.
                      When new complaints arrive with matching categories and proximity, candidate pairs will appear here for administrator confirmation.
                    </p>
                  </div>
                ) : (
                  candidatePairs
                    .filter((p) => p.reviewStatus === "PENDING")
                    .map((pair) => {
                      const c1 = pair.complaint1;
                      const c2 = pair.complaint2;
                      const isProcessing = isProcessingReview === pair.pairKey;

                      return (
                        <div
                          key={pair.pairKey}
                          className="bg-white rounded-3xl border border-amber-200/90 shadow-2xs overflow-hidden transition-all hover:border-amber-300"
                        >
                          {/* Pair Match Header */}
                          <div className="bg-gradient-to-r from-amber-50/80 via-orange-50/60 to-white px-5 py-3.5 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-amber-500 text-slate-950 font-mono shadow-2xs">
                                <GitMerge className="w-3.5 h-3.5" />
                                {pair.similarityScore.toFixed(0)}% Match
                              </span>

                              <span
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                                  pair.confidence === "high"
                                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                                    : "bg-amber-100 text-amber-800 border border-amber-200"
                                }`}
                              >
                                {pair.confidence} Confidence
                              </span>

                              {pair.distanceMeters !== null ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                                  <MapPin className="w-3 h-3 text-rose-500" />
                                  {pair.distanceMeters.toFixed(1)}m apart
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                                  Location coordinates absent
                                </span>
                              )}

                              <span className="text-[11px] text-slate-500 font-mono">
                                ⏱️ {pair.timeDiffHours.toFixed(1)} hrs apart
                              </span>
                            </div>

                            <span className="text-[11px] font-mono text-slate-400">
                              Pair: #{c1.complaintId || c1.id} ↔ #{c2.complaintId || c2.id}
                            </span>
                          </div>

                          {/* Side-by-Side Reports Comparison Grid */}
                          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                            {/* Report 1 Card */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                                    #{c1.complaintId || c1.id}
                                  </span>
                                  <span className="text-[10px] uppercase font-bold text-slate-400">Report A</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <StatusBadge status={c1.status} size="sm" />
                                  <PriorityBadge priority={c1.priority} />
                                </div>
                              </div>

                              <div>
                                <h4 className="font-heading font-bold text-sm text-slate-900 line-clamp-1">{c1.title}</h4>
                                <p className="text-xs text-slate-600 mt-1 line-clamp-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                                  {c1.description}
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                                <div>
                                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Category & Dept</span>
                                  <span className="font-semibold text-slate-800 capitalize truncate block">{c1.category}</span>
                                  <span className="text-[10px] text-slate-500 truncate block">{c1.department}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Ward & Location</span>
                                  <span className="font-semibold text-slate-800 truncate block">{c1.ward}</span>
                                  <span className="text-[10px] text-slate-500 truncate block">{c1.address}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                                <div>
                                  <span className="text-[10px] text-slate-400 block">Reporter</span>
                                  <span className="font-semibold text-slate-700">{c1.citizenName}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-slate-400 block">Civic Priority Score</span>
                                  <span className="font-mono font-bold text-slate-800">
                                    {c1.priorityScoreData ? `${c1.priorityScoreData.score.toFixed(1)}/100 (${c1.priorityScoreData.band})` : "—"}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setInspectComplaint(c1)}
                                className="w-full text-center text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Inspect Report A Full Details</span>
                              </button>
                            </div>

                            {/* Report 2 Card */}
                            <div className="space-y-3 pt-4 md:pt-0 md:pl-5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                                    #{c2.complaintId || c2.id}
                                  </span>
                                  <span className="text-[10px] uppercase font-bold text-slate-400">Report B</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <StatusBadge status={c2.status} size="sm" />
                                  <PriorityBadge priority={c2.priority} />
                                </div>
                              </div>

                              <div>
                                <h4 className="font-heading font-bold text-sm text-slate-900 line-clamp-1">{c2.title}</h4>
                                <p className="text-xs text-slate-600 mt-1 line-clamp-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                                  {c2.description}
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                                <div>
                                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Category & Dept</span>
                                  <span className="font-semibold text-slate-800 capitalize truncate block">{c2.category}</span>
                                  <span className="text-[10px] text-slate-500 truncate block">{c2.department}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Ward & Location</span>
                                  <span className="font-semibold text-slate-800 truncate block">{c2.ward}</span>
                                  <span className="text-[10px] text-slate-500 truncate block">{c2.address}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                                <div>
                                  <span className="text-[10px] text-slate-400 block">Reporter</span>
                                  <span className="font-semibold text-slate-700">{c2.citizenName}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-slate-400 block">Civic Priority Score</span>
                                  <span className="font-mono font-bold text-slate-800">
                                    {c2.priorityScoreData ? `${c2.priorityScoreData.score.toFixed(1)}/100 (${c2.priorityScoreData.band})` : "—"}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setInspectComplaint(c2)}
                                className="w-full text-center text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Inspect Report B Full Details</span>
                              </button>
                            </div>
                          </div>

                          {/* Match Evidence Box */}
                          <div className="bg-slate-50/80 px-5 py-3 border-t border-b border-slate-100">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                              Explainable Match Reasons & Evidence:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {pair.reasons.map((r, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200"
                                >
                                  <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>{r}</span>
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Action Footer (Admin Only) */}
                          <div className="p-4 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <div className="flex-1">
                              <input
                                type="text"
                                placeholder="Optional reviewer note (e.g. Same sinkhole confirmed by Indiranagar traffic crew)..."
                                value={reviewNotesInput[pair.pairKey] || ""}
                                onChange={(e) =>
                                  setReviewNotesInput({
                                    ...reviewNotesInput,
                                    [pair.pairKey]: e.target.value,
                                  })
                                }
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleRejectDuplicate(pair)}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                                title="Reject Match and suppress from future suggestions"
                              >
                                <Ban className="w-3.5 h-3.5 text-rose-500" />
                                <span>{isProcessing ? "Processing..." : "Reject Match"}</span>
                              </button>

                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleConfirmDuplicate(pair)}
                                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 shadow-md transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                                title="Confirm Related Incident and group under shared Incident ID"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                <span>{isProcessing ? "Linking Incident..." : "Confirm Related Incident"}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            )}

            {/* SUB-TAB 2: CONFIRMED INCIDENTS */}
            {duplicateSubTab === "confirmed" && (
              <div className="space-y-4">
                {confirmedIncidents.length === 0 ? (
                  <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 shadow-2xs space-y-3">
                    <Info className="w-10 h-10 text-slate-300 mx-auto" />
                    <h4 className="font-heading font-bold text-slate-900 text-base">
                      No Confirmed Incidents Yet
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Confirmed duplicate reports will be grouped under stable shared incident records here.
                      Head to the Pending Triage tab to review candidates.
                    </p>
                  </div>
                ) : (
                  confirmedIncidents.map((inc) => (
                    <div
                      key={inc.incidentId}
                      className="bg-white rounded-3xl border border-teal-200/90 shadow-2xs p-5 space-y-4 hover:border-teal-300 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-bold bg-teal-100 text-teal-900 px-3 py-1 rounded-xl border border-teal-200">
                            #{inc.incidentId}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                            {inc.status}
                          </span>
                          <span className="text-xs font-semibold text-slate-700 capitalize">
                            {inc.department}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
                          <span>Confirmed by {inc.confirmedByEmail || "Admin"}</span>
                          <span>•</span>
                          <span>{new Date(inc.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="font-heading font-bold text-base text-slate-900">{inc.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-200">
                              <Layers className="w-3.5 h-3.5" />
                              {inc.reportCount || inc.reportIds.length} Confirmed Reports Linked
                            </span>
                            <span className="text-xs text-slate-400">Anchor: #{inc.primaryReportId}</span>
                          </div>
                        </div>
                      </div>

                      {/* Linked Complaint Badges */}
                      <div className="pt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                          Citizen Reports Linked Under This Incident:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {inc.reportIds.map((repId) => {
                            const complaint = reports.find(
                              (r) => (r.complaintId || r.id) === repId
                            );
                            return (
                              <button
                                key={repId}
                                type="button"
                                onClick={() => {
                                  if (complaint) setInspectComplaint(complaint);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono font-bold transition-colors cursor-pointer"
                              >
                                <span>#{repId}</span>
                                {complaint && (
                                  <span className="text-[10px] text-slate-500 font-sans font-normal truncate max-w-[120px]">
                                    ({complaint.citizenName})
                                  </span>
                                )}
                                <Eye className="w-3 h-3 text-slate-400" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* SUB-TAB 3: REJECTED PAIRS */}
            {duplicateSubTab === "rejected" && (
              <div className="space-y-4">
                {rejectedPairs.length === 0 ? (
                  <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 shadow-2xs space-y-3">
                    <Info className="w-10 h-10 text-slate-300 mx-auto" />
                    <h4 className="font-heading font-bold text-slate-900 text-base">
                      No Rejected Candidate Pairs
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Candidate pairs rejected during triage will appear here. Rejection suppresses them from being repeatedly proposed as duplicate matches.
                    </p>
                  </div>
                ) : (
                  rejectedPairs.map((pair) => (
                    <div
                      key={pair.pairKey}
                      className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3 shadow-2xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            Rejected Match
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-800">
                            #{pair.complaint1.complaintId || pair.complaint1.id} ↔ #{pair.complaint2.complaintId || pair.complaint2.id}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 font-mono">
                          Rejected by {pair.reviewedByEmail || "Admin"} • {pair.reviewedAt ? new Date(pair.reviewedAt).toLocaleDateString() : "Recent"}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-2xl">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Report A</span>
                          <span className="font-bold text-slate-800">{pair.complaint1.title}</span>
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{pair.complaint1.description}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Report B</span>
                          <span className="font-bold text-slate-800">{pair.complaint2.title}</span>
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{pair.complaint2.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-slate-500">
                          Suppressed from triage suggestions. Click Restore to reconsider as candidate.
                        </span>
                        <button
                          type="button"
                          onClick={() => handleResetReview(pair)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                          <span>Restore to Pending Triage</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* MODAL: SUPABASE SQL MIGRATION VIEW */}
        {showSqlMigrationModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150 my-8">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-heading text-base font-bold text-slate-900">
                      Supabase Incident Grouping SQL Migration
                    </h3>
                    <p className="text-xs text-slate-500">
                      Copy and run this in your Supabase SQL Editor to enable remote cloud persistence.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSqlMigrationModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-900 text-slate-200 p-4 rounded-2xl font-mono text-xs max-h-72 overflow-y-auto leading-relaxed border border-slate-800 select-all">
{`-- CivicFix Phase 1: Persistent Incident Grouping & Duplicate Review Schema
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS incident_id TEXT;
CREATE INDEX IF NOT EXISTS idx_reports_incident_id ON public.reports(incident_id);

CREATE TABLE IF NOT EXISTS public.civic_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    department TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    primary_report_id TEXT NOT NULL,
    report_count INTEGER NOT NULL DEFAULT 1,
    confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    confirmed_by_email TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.civic_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view civic incidents"
    ON public.civic_incidents FOR SELECT USING (true);

CREATE POLICY "Admins can insert civic incidents"
    ON public.civic_incidents FOR INSERT
    WITH CHECK (public.is_admin() OR current_user = 'service_role');

CREATE POLICY "Admins can update civic incidents"
    ON public.civic_incidents FOR UPDATE
    USING (public.is_admin() OR current_user = 'service_role')
    WITH CHECK (public.is_admin() OR current_user = 'service_role');

CREATE TABLE IF NOT EXISTS public.civic_duplicate_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pair_key TEXT NOT NULL UNIQUE,
    complaint_id_1 TEXT NOT NULL,
    complaint_id_2 TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('CONFIRMED', 'REJECTED')),
    incident_id TEXT,
    similarity_score DOUBLE PRECISION,
    matching_reasons TEXT[] DEFAULT '{}',
    review_notes TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_by_email TEXT,
    reviewed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.civic_duplicate_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view duplicate reviews"
    ON public.civic_duplicate_reviews FOR SELECT
    USING (public.is_admin() OR current_user = 'service_role');

CREATE POLICY "Admins can insert duplicate reviews"
    ON public.civic_duplicate_reviews FOR INSERT
    WITH CHECK (public.is_admin() OR current_user = 'service_role');

CREATE POLICY "Admins can update duplicate reviews"
    ON public.civic_duplicate_reviews FOR UPDATE
    USING (public.is_admin() OR current_user = 'service_role')
    WITH CHECK (public.is_admin() OR current_user = 'service_role');`}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">
                  Located in <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">supabase/migrations/20261020_civic_incidents.sql</code>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS incident_id TEXT;
CREATE INDEX IF NOT EXISTS idx_reports_incident_id ON public.reports(incident_id);

CREATE TABLE IF NOT EXISTS public.civic_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    department TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    primary_report_id TEXT NOT NULL,
    report_count INTEGER NOT NULL DEFAULT 1,
    confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    confirmed_by_email TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.civic_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view civic incidents"
    ON public.civic_incidents FOR SELECT USING (true);

CREATE POLICY "Admins can insert civic incidents"
    ON public.civic_incidents FOR INSERT
    WITH CHECK (public.is_admin() OR current_user = 'service_role');

CREATE POLICY "Admins can update civic incidents"
    ON public.civic_incidents FOR UPDATE
    USING (public.is_admin() OR current_user = 'service_role')
    WITH CHECK (public.is_admin() OR current_user = 'service_role');

CREATE TABLE IF NOT EXISTS public.civic_duplicate_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pair_key TEXT NOT NULL UNIQUE,
    complaint_id_1 TEXT NOT NULL,
    complaint_id_2 TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('CONFIRMED', 'REJECTED')),
    incident_id TEXT,
    similarity_score DOUBLE PRECISION,
    matching_reasons TEXT[] DEFAULT '{}',
    review_notes TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_by_email TEXT,
    reviewed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.civic_duplicate_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view duplicate reviews"
    ON public.civic_duplicate_reviews FOR SELECT
    USING (public.is_admin() OR current_user = 'service_role');

CREATE POLICY "Admins can insert duplicate reviews"
    ON public.civic_duplicate_reviews FOR INSERT
    WITH CHECK (public.is_admin() OR current_user = 'service_role');

CREATE POLICY "Admins can update duplicate reviews"
    ON public.civic_duplicate_reviews FOR UPDATE
    USING (public.is_admin() OR current_user = 'service_role')
    WITH CHECK (public.is_admin() OR current_user = 'service_role');`);
                    alert("SQL migration script copied to clipboard!");
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Copy SQL to Clipboard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: USER PROFILES & ROLES */}
        {activeAdminTab === "users" && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-heading font-bold text-lg text-slate-900">Registered Citizen & Admin Profiles</h3>
                  <p className="text-xs text-slate-500">
                    Live accounts queried directly from <strong>public.profiles</strong> in Supabase.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder="Search users..."
                      className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-teal-500"
                    />
                  </div>
                  <button
                    onClick={loadUsers}
                    disabled={isLoadingUsers}
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors"
                    title="Refresh users"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingUsers ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Profiles Table */}
              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Citizen ID</th>
                      <th className="px-4 py-3">City / Ward</th>
                      <th className="px-4 py-3">Registered At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-slate-400">
                          {isLoadingUsers ? "Loading profiles from Supabase..." : "No user profiles found."}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{u.full_name || "Civic Citizen"}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono border ${
                                u.role === "admin"
                                  ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600">{u.citizen_id || "CZ-N/A"}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {u.city || "Bengaluru"}{u.ward ? ` (${u.ward})` : ""}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-[11px]">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : "Recent"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Informative Promotion Note */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800">Role Security in Supabase: </span>
                  Roles are enforced server-side via Supabase Row-Level Security (RLS) policies. To promote a user to administrator, execute:
                  <code className="mx-1 px-1.5 py-0.5 bg-slate-200 rounded font-mono text-[11px] text-slate-800">
                    UPDATE public.profiles SET role = 'admin' WHERE email = 'USER_EMAIL';
                  </code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ADMIN AUDIT LOGS */}
        {activeAdminTab === "audit" && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-bold text-lg text-slate-900">Administrative Audit Trail</h3>
                  <p className="text-xs text-slate-500">
                    Live audit logs stored in <strong>public.admin_audit_logs</strong> recording status changes and staff dispatches.
                  </p>
                </div>
                <button
                  onClick={loadAuditLogs}
                  disabled={isLoadingAudit}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors"
                  title="Refresh audit logs"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingAudit ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* Audit Table */}
              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Administrator</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Target Ticket</th>
                      <th className="px-4 py-3">Audit Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-slate-400">
                          {isLoadingAudit ? "Loading audit logs..." : "No audit events logged yet. Status updates will record here automatically."}
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900">{log.admin_name}</span>
                            <span className="block text-[11px] text-slate-400">{log.admin_email}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600">
                            #{log.target_report_id?.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-[11px]">
                            {log.details ? JSON.stringify(log.details) : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: UPDATE STATUS & DISPATCH WORK CREW */}
        {activeModalComplaint && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150 my-8">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="font-mono text-xs font-bold text-slate-500">
                    Update Report #{activeModalComplaint.complaintId || activeModalComplaint.id}
                  </span>
                  <h3 className="font-heading text-lg font-bold text-slate-900 mt-0.5 line-clamp-1">
                    {activeModalComplaint.title}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveModalComplaint(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Change Complaint Lifecycle Status
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(
                    ["SUBMITTED", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"] as ComplaintStatus[]
                  ).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setModalNewStatus(st)}
                      className={`p-2 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                        modalNewStatus === st
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {st.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assign Field Crew / Contractor */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Assign Municipal Field Crew / Contractor
                </label>
                <input
                  type="text"
                  value={modalAssignedStaff}
                  onChange={(e) => setModalAssignedStaff(e.target.value)}
                  placeholder="e.g. Electrical Maintenance Team 4, Line Inspector Ramesh"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>

              {/* Official Resolution Note */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Official Municipal Resolution Note
                </label>
                <textarea
                  rows={3}
                  value={modalStaffNote}
                  onChange={(e) => setModalStaffNote(e.target.value)}
                  placeholder="e.g. Work order issued. Repair team dispatched on-site. Work scheduled to conclude before 5 PM."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  🔔 Broadcasts an automatic update to the citizen's notification center and appends to the timeline.
                </span>
              </div>

              {/* Modal Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModalComplaint(null)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingAction}
                  onClick={handleSaveModalAction}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingAction ? "Saving..." : "Broadcast & Save Update"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: FULL COMPLAINT DETAIL INSPECTOR */}
        {inspectComplaint && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150 my-8">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                      #{inspectComplaint.complaintId || inspectComplaint.id}
                    </span>
                    <StatusBadge status={inspectComplaint.status} size="sm" />
                    <PriorityBadge priority={inspectComplaint.priority} />
                  </div>
                  <h3 className="font-heading text-lg font-bold text-slate-900 mt-1">
                    {inspectComplaint.title}
                  </h3>
                </div>
                <button
                  onClick={() => setInspectComplaint(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Photo Banner if exists */}
              {inspectComplaint.imageUrl && (
                <div className="w-full max-h-64 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                  <img
                    src={inspectComplaint.imageUrl}
                    alt={inspectComplaint.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {/* Explainable Civic Priority Score & Duplicate Analysis Card */}
              <PriorityScoreDisplay
                scoreData={inspectComplaint.priorityScoreData}
                immediateHazard={inspectComplaint.immediateSafetyHazard}
                duplicateMatches={inspectComplaint.duplicateInfo?.matchedDuplicates}
                onSelectDuplicate={(dupId) => {
                  const match = reports.find(
                    (r) => r.id === dupId || r.complaintId === dupId
                  );
                  if (match) setInspectComplaint(match);
                }}
              />

              {/* Description & Citizen Info */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Citizen Description
                </span>
                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                  {inspectComplaint.description}
                </p>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Reporter</span>
                  <span className="font-semibold text-slate-800">{inspectComplaint.citizenName}</span>
                  <span className="text-slate-500 block text-[11px]">{inspectComplaint.citizenPhone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Ward & Address</span>
                  <span className="font-semibold text-slate-800">{inspectComplaint.ward}</span>
                  <span className="text-slate-500 block text-[11px] truncate">{inspectComplaint.address}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Department</span>
                  <span className="font-semibold text-slate-800">{inspectComplaint.department}</span>
                  <span className="text-slate-500 block text-[11px] truncate">Crew: {inspectComplaint.assignedTo || "Unassigned"}</span>
                </div>
              </div>

              {/* Timeline */}
              {inspectComplaint.timeline && inspectComplaint.timeline.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Action Timeline ({inspectComplaint.timeline.length} events)
                  </span>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {inspectComplaint.timeline.map((evt, idx) => (
                      <div key={idx} className="text-xs p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-start justify-between">
                        <div>
                          <span className="font-bold text-slate-800">{evt.title}</span>
                          <p className="text-[11px] text-slate-500 mt-0.5">{evt.description}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 ml-2 font-mono">
                          {evt.timestamp}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inspector Footer Actions */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setInspectComplaint(null);
                    onSelectComplaint(inspectComplaint.id);
                  }}
                  className="text-xs text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Citizen Tracking View</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const c = inspectComplaint;
                    setInspectComplaint(null);
                    handleOpenActionModal(c);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Dispatch / Update Status</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PHOTO ENLARGE PREVIEW MODAL */}
        {previewPhotoUrl && (
          <div
            onClick={() => setPreviewPhotoUrl(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          >
            <div className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl bg-black">
              <img
                src={previewPhotoUrl}
                alt="Evidence Photo"
                className="w-full h-full object-contain max-h-[85vh]"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(null)}
                className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full hover:bg-black/90 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
