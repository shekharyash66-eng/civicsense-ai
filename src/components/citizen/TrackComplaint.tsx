import React, { useState, useEffect } from 'react';
import { useCivic } from '../../context/CivicContext';
import { PriorityIndicator, StatusIndicator } from '../common/StatusBadge';
import {
  Search,
  CheckCircle,
  Clock,
  Building2,
  MapPin,
  Calendar,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Inbox,
  ArrowRight,
} from 'lucide-react';
import { ComplaintStatus } from '../../types/civic';

interface TrackComplaintProps {
  initialComplaintId?: string;
  setCurrentView: (view: string) => void;
}

const STATUS_STEPS: ComplaintStatus[] = [
  'Submitted',
  'Under Review',
  'Verified',
  'Assigned',
  'In Progress',
  'Resolved',
];

export const TrackComplaint: React.FC<TrackComplaintProps> = ({ initialComplaintId, setCurrentView }) => {
  const {
    complaints,
    getComplaintById,
    getDepartmentById,
    getHistoryForComplaint,
    citizenConfirmResolution,
  } = useCivic();

  const [searchQuery, setSearchQuery] = useState(initialComplaintId || '');
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(
    initialComplaintId || (complaints.length > 0 ? complaints[0].id : null)
  );

  useEffect(() => {
    if (initialComplaintId) {
      setSearchQuery(initialComplaintId);
      setSelectedComplaintId(initialComplaintId);
    } else if (complaints.length > 0 && !selectedComplaintId) {
      setSelectedComplaintId(complaints[0].id);
    }
  }, [initialComplaintId, complaints]);

  const activeComplaint = selectedComplaintId ? getComplaintById(selectedComplaintId) : undefined;
  const history = activeComplaint ? getHistoryForComplaint(activeComplaint.id) : [];
  const assignedDept = activeComplaint ? getDepartmentById(activeComplaint.assigned_department_id) : undefined;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const match = getComplaintById(searchQuery.trim());
    if (match) {
      setSelectedComplaintId(match.id);
    } else {
      setSelectedComplaintId(null);
    }
  };

  const getStepIndex = (status: ComplaintStatus) => {
    if (status === 'Rejected') return -1;
    return STATUS_STEPS.indexOf(status);
  };

  const currentStepIdx = activeComplaint ? getStepIndex(activeComplaint.status) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8 text-slate-900 dark:text-white">
      {/* Header & Search */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Track Civic Complaint
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Monitor real-time triage status, assigned public departments, and resolution progress notes.
        </p>

        {/* Search Input */}
        <form onSubmit={handleSearch} className="mt-6 flex gap-3 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter Complaint ID (e.g. CIV-4821)"
              className="w-full text-sm pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 text-white rounded-lg text-xs font-semibold shadow transition-colors"
          >
            Lookup
          </button>
        </form>

        {/* Recent Genuine Submissions (only when complaints exist in DB) */}
        {complaints.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400">
            <span>Recent Complaints:</span>
            {complaints.slice(0, 5).map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSearchQuery(c.id);
                  setSelectedComplaintId(c.id);
                }}
                className="text-teal-700 dark:text-teal-400 hover:underline font-mono"
              >
                {c.id}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Tracking Content */}
      {activeComplaint ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Top Bar with ID and Status */}
          <div className="p-6 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xl font-bold text-slate-900 dark:text-white">
                  {activeComplaint.id}
                </span>
                <StatusIndicator status={activeComplaint.status} />
                <PriorityIndicator
                  level={activeComplaint.priority_level}
                  score={activeComplaint.priority_score}
                />
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mt-1">
                {activeComplaint.title}
              </h2>
            </div>

            <div className="text-right text-xs text-slate-500 dark:text-slate-400">
              <div>Submitted on:</div>
              <div className="font-medium text-slate-700 dark:text-slate-200 font-mono">
                {new Date(activeComplaint.submitted_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>

          {/* Stepper Timeline for standard workflow */}
          {activeComplaint.status !== 'Rejected' ? (
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
                Resolution Lifecycle Progress
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                {STATUS_STEPS.map((step, idx) => {
                  const isCompleted = idx <= currentStepIdx;
                  const isCurrent = idx === currentStepIdx;
                  return (
                    <div
                      key={step}
                      className={`p-2.5 rounded-lg border text-center transition-all ${
                        isCurrent
                          ? 'bg-teal-50 dark:bg-teal-950/80 border-teal-500 text-teal-900 dark:text-teal-200 font-bold'
                          : isCompleted
                          ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium'
                          : 'bg-white dark:bg-slate-900 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600'
                      }`}
                    >
                      <div className="text-[10px] font-mono mb-0.5">Step 0{idx + 1}</div>
                      <div className="text-xs truncate">{step}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm">Complaint Classified as Rejected</h3>
                  <p className="text-xs mt-1 leading-relaxed">
                    <strong>Official Municipal Justification:</strong>{' '}
                    {activeComplaint.resolution_note || 'The submitted request does not fall under public municipal works jurisdiction.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs border-b border-slate-200 dark:border-slate-800">
            <div className="space-y-4">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Issue Description:</span>
                <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-sm bg-slate-50 dark:bg-slate-800/80 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  {activeComplaint.description}
                </p>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Location Landmark:</span>
                <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200 text-sm">
                  <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                  <span>{activeComplaint.location_name}</span>
                </div>
                {activeComplaint.latitude && activeComplaint.longitude && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 ml-5">
                    GPS: {activeComplaint.latitude.toFixed(5)}, {activeComplaint.longitude.toFixed(5)}
                  </div>
                )}
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Civic Category:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{activeComplaint.category}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Assigned Department:</span>
                {assignedDept ? (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">{assignedDept.name}</div>
                    <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Head: {assignedDept.head_officer}</div>
                    <div className="text-slate-500 dark:text-slate-400 text-[11px]">Contact: {assignedDept.contact_email}</div>
                  </div>
                ) : (
                  <div className="text-slate-500 dark:text-slate-400 italic">Pending departmental assignment</div>
                )}
              </div>

              {activeComplaint.related_incident_id && (
                <div className="p-3 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg">
                  <div className="text-teal-900 dark:text-teal-200 font-semibold text-xs flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                    <span>Linked to Consolidated Incident: {activeComplaint.related_incident_id}</span>
                  </div>
                  <p className="text-[11px] text-teal-800 dark:text-teal-300 mt-1">
                    Your complaint has been aggregated with nearby reports for systematic root-cause resolution.
                  </p>
                </div>
              )}

              {activeComplaint.status === 'Resolved' && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-900 dark:text-emerald-200 font-semibold text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Resolution Summary Note:</span>
                  </div>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    {activeComplaint.resolution_note || 'Issue resolved by field dispatch.'}
                  </p>

                  <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-700 dark:text-emerald-400">
                      Citizen Verification: {activeComplaint.citizen_confirmed_resolved ? 'Confirmed by Citizen' : 'Pending Citizen Confirmation'}
                    </span>
                    {!activeComplaint.citizen_confirmed_resolved ? (
                      <button
                        onClick={() => citizenConfirmResolution(activeComplaint.id)}
                        className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white rounded font-medium text-xs shadow-sm"
                      >
                        Confirm Resolved on Site
                      </button>
                    ) : (
                      <span className="text-emerald-800 dark:text-emerald-300 font-bold">✓ Verified</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Audit Trail Timeline */}
          <div className="p-6 bg-slate-50 dark:bg-slate-800/50">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
              Status Change Audit Log & Notes
            </h3>
            {history.length > 0 ? (
              <div className="space-y-4">
                {history.map((h) => (
                  <div key={h.id} className="flex items-start gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-teal-600 dark:bg-teal-400 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                        <span className="font-semibold text-slate-900 dark:text-white">{h.new_status}</span>
                        <span className="font-mono text-[11px]">
                          {new Date(h.changed_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-200">{h.note}</p>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Logged by: {h.changed_by} ({h.changed_by_role})</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400">Initial ticket created. No updates yet.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 p-10 rounded-xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
          <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {complaints.length === 0 ? 'No complaints have been submitted yet.' : 'Complaint Not Found'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              {complaints.length === 0
                ? 'Be the first to report an infrastructure defect in your neighborhood.'
                : searchQuery
                ? `No record matched reference ID "${searchQuery}". Please check the ID and try again.`
                : 'Enter a complaint reference number above to view real-time status.'}
            </p>
          </div>
          {complaints.length === 0 && (
            <button
              onClick={() => setCurrentView('report')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 dark:hover:bg-teal-500 transition-colors"
            >
              <span>Submit a Complaint</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
