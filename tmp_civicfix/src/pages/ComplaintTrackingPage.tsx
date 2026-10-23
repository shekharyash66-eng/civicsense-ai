import React, { useState, useEffect } from "react";
import { Complaint, ComplaintStatus, User } from "../types";
import {
  getComplaintById,
  getComplaintByIdAsync,
  subscribeToComplaints,
  updateComplaintStatus,
  confirmCitizenResolution,
} from "../services/complaintService";
import { StatusBadge, PriorityBadge } from "../components/ui/StatusBadge";
import { StatusTimeline } from "../components/ui/StatusTimeline";
import { InteractiveMap } from "../components/map/InteractiveMap";
import { PriorityScoreDisplay } from "../components/ui/PriorityScoreDisplay";
import {
  MapPin,
  Clock,
  Building2,
  Calendar,
  Share2,
  CheckCircle2,
  Star,
  Sparkles,
  ArrowLeft,
  Wrench,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ThumbsUp
} from "lucide-react";

interface ComplaintTrackingPageProps {
  complaintId: string;
  currentUser: User;
  onNavigate: (route: string) => void;
}

export const ComplaintTrackingPage: React.FC<ComplaintTrackingPageProps> = ({
  complaintId,
  currentUser,
  onNavigate,
}) => {
  const [complaint, setComplaint] = useState<Complaint | null | undefined>(() =>
    getComplaintById(complaintId)
  );
  const [isLoadingDirect, setIsLoadingDirect] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Real-time listener & async Supabase fetch fallback
  useEffect(() => {
    let isMounted = true;

    const refresh = async () => {
      const local = getComplaintById(complaintId);
      if (local) {
        if (isMounted) {
          setComplaint(local);
          setJustUpdated(true);
          setTimeout(() => {
            if (isMounted) setJustUpdated(false);
          }, 4000);
        }
        return;
      }

      // If not found in local memory, fetch directly from Supabase database
      if (complaintId) {
        setIsLoadingDirect(true);
        const remote = await getComplaintByIdAsync(complaintId);
        if (isMounted) {
          setComplaint(remote);
          setIsLoadingDirect(false);
        }
      }
    };

    refresh();
    const unsubscribe = subscribeToComplaints(() => {
      const updated = getComplaintById(complaintId);
      if (updated && isMounted) {
        setComplaint(updated);
        setJustUpdated(true);
        setTimeout(() => {
          if (isMounted) setJustUpdated(false);
        }, 4000);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [complaintId]);

  if (isLoadingDirect) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-slate-50">
        <div className="text-center max-w-sm bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 mb-3 animate-spin">
            <RefreshCw className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Querying Database</h3>
          <p className="text-xs text-slate-500 mt-1">
            Looking up report #{complaintId} in Supabase...
          </p>
        </div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-slate-50">
        <div className="text-center max-w-sm bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Complaint Not Found</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Could not locate complaint #{complaintId}.
          </p>
          <button
            onClick={() => onNavigate("complaints")}
            className="bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-800 transition-colors"
          >
            Back to Complaints
          </button>
        </div>
      </div>
    );
  }

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleConfirmFix = () => {
    setIsSubmittingFeedback(true);
    confirmCitizenResolution(complaint.id, rating, feedbackComment);
    setIsSubmittingFeedback(false);
  };

  // Demo simulation quick actions
  const advanceDemoStatus = () => {
    const transitions: Record<ComplaintStatus, ComplaintStatus> = {
      SUBMITTED: "ASSIGNED",
      ACKNOWLEDGED: "ASSIGNED",
      ASSIGNED: "IN_PROGRESS",
      IN_PROGRESS: "RESOLVED",
      RESOLVED: "CLOSED",
      CLOSED: "IN_PROGRESS",
    };
    const nextStatus = transitions[complaint.status] || "IN_PROGRESS";
    updateComplaintStatus(
      complaint.id,
      nextStatus,
      `Staff advanced ticket to ${nextStatus} for verification test.`
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20 pt-6 sm:pt-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Navigation back and header banner */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => onNavigate("complaints")}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Complaints</span>
          </button>

          <div className="flex items-center gap-2">
            {/* Live real-time indicator */}
            {justUpdated && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full animate-bounce">
                <Sparkles className="w-3.5 h-3.5" /> Updated just now
              </span>
            )}

            <button
              onClick={handleShare}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedLink ? "Link Copied!" : "Share Link"}</span>
            </button>
          </div>
        </div>

        {/* Complaint Main Overview Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-mono text-sm font-extrabold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                  #{complaint.id}
                </span>
                <StatusBadge status={complaint.status} size="md" pulse={complaint.status === "IN_PROGRESS"} />
                <PriorityBadge priority={complaint.priority} />
              </div>

              <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900">
                {complaint.title}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="flex items-center gap-1 text-slate-700 font-semibold">
                  <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>{complaint.ward} • Verified GPS Location</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{complaint.department}</span>
                </span>
              </div>
            </div>

            {/* Estimated Resolution Box */}
            <div className="sm:text-right bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-2xl border border-slate-200/70 sm:border-none shrink-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                Estimated Resolution
              </span>
              <span className="text-sm font-extrabold text-teal-900 mt-0.5 block">
                {complaint.estimatedResolution || "1–2 days"}
              </span>
              <span className="text-[10px] text-slate-600 block mt-0.5">
                Target SLA: 48 hours
              </span>
            </div>
          </div>

          {/* Description & Photo Evidence */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Issue Details
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50/60 p-4 rounded-2xl border border-slate-200/60">
                  {complaint.description}
                </p>
              </div>

              {/* Citizen Information & Ward */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-600 block text-[11px]">Reported by</span>
                  <span className="font-bold text-slate-800">{complaint.citizenName}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-600 block text-[11px]">Address Marker</span>
                  <span className="font-bold text-slate-800 truncate block">{complaint.address}</span>
                </div>
              </div>
            </div>

            {/* Evidence Image */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Field Evidence
              </h3>
              {complaint.imageUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-2xs group">
                  <img
                    src={complaint.imageUrl}
                    alt={complaint.title}
                    className="w-full h-44 object-cover group-hover:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>AI Verified</span>
                  </div>
                </div>
              ) : (
                <div className="h-44 rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                  <Clock className="w-6 h-6 mb-1" />
                  <span className="text-xs">No photo attached</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= TRANSPARENT CIVIC PRIORITY SCORE & DUPLICATE CLUSTER ================= */}
        {complaint.priorityScoreData && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="font-heading text-lg font-bold text-slate-900">
                Explainable Civic Priority Assessment
              </h2>
              <p className="text-xs text-slate-500">
                Transparent municipal priority derived from physical hazard criteria, population impact, and resolution aging.
              </p>
            </div>
            <PriorityScoreDisplay
              scoreData={complaint.priorityScoreData}
              immediateHazard={complaint.immediateSafetyHazard}
              duplicateMatches={complaint.duplicateInfo?.matchedDuplicates}
              onSelectDuplicate={(dupId) => {
                onNavigate(`complaint-${dupId}`);
              }}
            />
          </div>
        )}

        {/* ================= VERTICAL STATUS TIMELINE (Requirement #15) ================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-heading text-xl font-bold text-slate-900">
                Progress Timeline
              </h2>
              <p className="text-xs text-slate-500">
                Official stage updates broadcasted in real time from municipal dispatch
              </p>
            </div>

            {/* Quick Demo Status Advance Tool for Hackathon judges */}
            <button
              onClick={advanceDemoStatus}
              className="text-xs bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Simulate Next Stage ({complaint.status})</span>
            </button>
          </div>

          {/* Timeline component */}
          <StatusTimeline complaint={complaint} />
        </div>

        {/* ================= CITIZEN RESOLUTION CONFIRMATION (Requirement #5 & #32) ================= */}
        {complaint.status === "RESOLVED" && !complaint.citizenConfirmedResolution && (
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-6 sm:p-8 border-2 border-emerald-300 shadow-sm space-y-4 animate-in fade-in duration-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <ThumbsUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold text-emerald-950">
                  Confirm On-Site Resolution
                </h3>
                <p className="text-xs sm:text-sm text-emerald-800 leading-relaxed mt-0.5">
                  The municipal department has marked this problem as resolved. Please verify if the fix is completed to your satisfaction.
                </p>
              </div>
            </div>

            {/* Star rating */}
            <div className="bg-white/80 p-4 rounded-2xl border border-emerald-200/70 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  How satisfied are you with the resolution?
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      className={`p-2 rounded-xl transition-all ${
                        rating >= s ? "text-amber-500 scale-110" : "text-slate-300 hover:text-amber-300"
                      }`}
                    >
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-slate-600 ml-2">
                    {rating === 5 ? "Excellent Fix" : `${rating} Stars`}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Feedback or comments (Optional)
                </label>
                <input
                  type="text"
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="e.g. Lineman replaced the bulb and tested it, excellent job."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none"
                />
              </div>

              <div className="pt-1 flex items-center justify-between">
                <span className="text-[11px] text-emerald-700 font-medium">
                  Your confirmation closes this civic ticket officially.
                </span>
                <button
                  onClick={handleConfirmFix}
                  disabled={isSubmittingFeedback}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer"
                >
                  Confirm & Close Ticket
                </button>
              </div>
            </div>
          </div>
        )}

        {/* If already confirmed */}
        {complaint.citizenConfirmedResolution && (
          <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex items-center justify-between text-xs text-teal-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
              <span>
                <strong>Resolution Confirmed:</strong> Citizen closed this ticket with{" "}
                {complaint.citizenFeedback?.rating}★ rating ({complaint.citizenFeedback?.confirmedAt}).
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold bg-teal-200/70 px-2 py-0.5 rounded">
              Archived
            </span>
          </div>
        )}

        {/* Issue Location Map Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-lg font-bold text-slate-900">
                Verified Map Location
              </h3>
              <p className="text-xs text-slate-500">
                {complaint.address} ({complaint.ward})
              </p>
            </div>
            <button
              onClick={() => onNavigate("map")}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              <span>Full City Map</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="rounded-2xl overflow-hidden border border-slate-200">
            <InteractiveMap
              complaints={[complaint]}
              selectedComplaintId={complaint.id}
              heightClass="h-64"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
