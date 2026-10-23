import React, { useState } from 'react';
import { useCivic } from '../../context/CivicContext';
import { Complaint, ComplaintStatus, PriorityLevel } from '../../types/civic';
import { PriorityIndicator, StatusIndicator } from '../common/StatusBadge';
import {
  X,
  MapPin,
  Calendar,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Sliders,
  History,
  FileText,
  Clock,
  Sparkles,
  Camera,
  User,
} from 'lucide-react';

interface ComplaintDetailModalProps {
  complaint: Complaint;
  onClose: () => void;
  onSelectIncident?: (incidentId: string) => void;
}

export const ComplaintDetailModal: React.FC<ComplaintDetailModalProps> = ({
  complaint,
  onClose,
  onSelectIncident,
}) => {
  const {
    departments,
    updateComplaintStatus,
    assignDepartment,
    overridePriority,
    getHistoryForComplaint,
    currentRole,
    priorityWeights,
  } = useCivic();

  const history = getHistoryForComplaint(complaint.id);

  // Status edit state
  const [newStatus, setNewStatus] = useState<ComplaintStatus>(complaint.status);
  const [statusNote, setStatusNote] = useState('');
  const [statusError, setStatusError] = useState('');

  // Department edit state
  const [selectedDeptId, setSelectedDeptId] = useState(complaint.assigned_department_id || '');

  // Priority override state
  const [isOverriding, setIsOverriding] = useState(false);
  const [overrideScore, setOverrideScore] = useState(complaint.priority_score);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSuccess, setOverrideSuccess] = useState(false);

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newStatus === 'Rejected' && !statusNote.trim()) {
      setStatusError('A clear justification is required when rejecting a complaint.');
      return;
    }
    if (newStatus === 'Resolved' && !statusNote.trim()) {
      setStatusError('Please provide a resolution note summarizing what was fixed.');
      return;
    }
    setStatusError('');
    updateComplaintStatus(complaint.id, newStatus, statusNote.trim());
    setStatusNote('');
  };

  const handleDeptAssign = (deptId: string) => {
    setSelectedDeptId(deptId);
    assignDepartment(complaint.id, deptId);
  };

  const handleOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      setStatusError('A specific rationale is required for manual priority changes.');
      return;
    }
    overridePriority(complaint.id, overrideScore, overrideReason.trim());
    setIsOverriding(false);
    setOverrideSuccess(true);
    setTimeout(() => setOverrideSuccess(false), 3000);
  };

  const assignedDept = departments.find((d) => d.id === (complaint.assigned_department_id || selectedDeptId));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-6 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xl font-bold text-slate-900 dark:text-white">{complaint.id}</span>
            <StatusIndicator status={complaint.status} />
            <PriorityIndicator level={complaint.priority_level} score={complaint.priority_score} />
            {complaint.is_emergency_flagged && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800">
                EMERGENCY FLAGGED
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Title & Description */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{complaint.title}</h2>
            <div className="mt-1 flex items-center gap-4 text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                {complaint.location_name}
              </span>
              <span>·</span>
              <span>{complaint.category}</span>
              <span>·</span>
              <span>Submitted: {new Date(complaint.submitted_at).toLocaleString()}</span>
            </div>
            <p className="mt-3 text-slate-700 dark:text-slate-200 text-sm bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed">
              {complaint.description}
            </p>
          </div>

          {/* Photo Evidence if present */}
          {complaint.image_url && (
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs mb-2 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>Photographic Evidence</span>
              </div>
              <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 max-w-md bg-slate-100 dark:bg-slate-800">
                <img
                  src={complaint.image_url}
                  alt="Citizen uploaded evidence"
                  className="w-full h-56 object-cover"
                />
              </div>
            </div>
          )}

          {/* Two-Column Grid: AI Prioritization Breakdown & Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Col: Priority Score Factors */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Explainable Priority Factors (AI Estimates)</span>
                </div>
                <button
                  onClick={() => setIsOverriding(!isOverriding)}
                  className="text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 font-medium text-[11px]"
                >
                  {isOverriding ? 'Cancel Override' : 'Manual Override'}
                </button>
              </div>

              {/* Factors */}
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-600 dark:text-slate-400">Safety Risk (Weight: {priorityWeights.safety_risk}%)</span>
                    <strong className="font-mono text-red-600 dark:text-red-400">{complaint.safety_risk_score}/100</strong>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-red-500 h-full" style={{ width: `${complaint.safety_risk_score}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-600 dark:text-slate-400">Issue Severity (Weight: {priorityWeights.severity}%)</span>
                    <strong className="font-mono text-orange-600 dark:text-orange-400">{complaint.severity_score}/100</strong>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-orange-500 h-full" style={{ width: `${complaint.severity_score}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-600 dark:text-slate-400">Population Impact (Weight: {priorityWeights.population_impact}%)</span>
                    <strong className="font-mono text-amber-600 dark:text-amber-400">{complaint.population_impact_score}/100</strong>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full" style={{ width: `${complaint.population_impact_score}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-600 dark:text-slate-400">Time Unresolved (Weight: {priorityWeights.time_unresolved}%)</span>
                    <strong className="font-mono text-teal-600 dark:text-teal-400">{complaint.time_unresolved_score}/100</strong>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-teal-500 h-full" style={{ width: `${complaint.time_unresolved_score}%` }} />
                  </div>
                </div>
              </div>

              {/* Dynamic AI Explanation */}
              {complaint.ai_analysis && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>AI Reasoning:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-300">
                    {complaint.ai_analysis.reasoning.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Manual Priority Override Form */}
              {isOverriding && (
                <form onSubmit={handleOverrideSubmit} className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2 bg-amber-50/50 dark:bg-amber-950/40 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="font-semibold text-amber-900 dark:text-amber-200 text-xs">Authorize Priority Override</div>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                      New Score: <span className="font-mono font-bold text-slate-900 dark:text-white">{overrideScore}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={overrideScore}
                      onChange={(e) => setOverrideScore(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Reason for Adjustment (Required)</label>
                    <input
                      type="text"
                      required
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="e.g. On-site verification discovered deeper cavern beneath asphalt"
                      className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-amber-700 dark:bg-amber-600 hover:bg-amber-800 dark:hover:bg-amber-500 text-white rounded font-medium text-xs"
                  >
                    Confirm Score Override
                  </button>
                </form>
              )}

              {overrideSuccess && (
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 rounded text-xs border border-emerald-200 dark:border-emerald-800">
                  Priority updated and recorded in audit log.
                </div>
              )}
            </div>

            {/* Right Col: Department Assignment & Status Transitions */}
            <div className="space-y-4">
              {/* Department Assignment */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Department Assignment</span>
                </div>
                <select
                  value={complaint.assigned_department_id || ''}
                  onChange={(e) => handleDeptAssign(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                >
                  <option value="">-- Assign Responsible Department --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.category_specialty.join(', ')})
                    </option>
                  ))}
                </select>

                {assignedDept && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    <div>Officer: <strong className="text-slate-700 dark:text-slate-200">{assignedDept.head_officer}</strong></div>
                    <div>Target SLA: <strong className="text-slate-700 dark:text-slate-200">{assignedDept.sla_target_hours} hours</strong></div>
                  </div>
                )}
              </div>

              {/* Status Update Form */}
              <form onSubmit={handleStatusSubmit} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Update Complaint Lifecycle Status</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(['Under Review', 'Verified', 'Assigned', 'In Progress', 'Resolved', 'Rejected'] as ComplaintStatus[]).map((st) => (
                    <button
                      type="button"
                      key={st}
                      onClick={() => setNewStatus(st)}
                      className={`py-1.5 px-2 rounded text-xs font-medium border text-left transition-colors ${
                        newStatus === st
                          ? 'bg-slate-900 dark:bg-teal-600 text-white border-slate-900 dark:border-teal-600'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                    Progress / Resolution Note {newStatus === 'Rejected' || newStatus === 'Resolved' ? '(Required)' : '(Optional)'}
                  </label>
                  <textarea
                    rows={2}
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder={
                      newStatus === 'Rejected'
                        ? 'Explain why this complaint was rejected (e.g. private jurisdiction, duplicate)...'
                        : newStatus === 'Resolved'
                        ? 'Summarize completed repair work...'
                        : 'Add field updates or notes...'
                    }
                    className="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                  />
                </div>

                {statusError && (
                  <div className="text-xs text-red-600 dark:text-red-400">{statusError}</div>
                )}

                <button
                  type="submit"
                  className="w-full py-2 bg-teal-600 dark:bg-teal-600 hover:bg-teal-700 dark:hover:bg-teal-500 text-white rounded font-semibold text-xs transition-colors"
                >
                  Save Status Change
                </button>
              </form>

              {/* Related Incident link */}
              {complaint.related_incident_id && (
                <div className="p-3 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-teal-900 dark:text-teal-200 font-semibold text-xs">Part of Consolidated Incident</div>
                    <div className="text-teal-700 dark:text-teal-400 font-mono text-[11px]">{complaint.related_incident_id}</div>
                  </div>
                  {onSelectIncident && (
                    <button
                      onClick={() => onSelectIncident(complaint.related_incident_id!)}
                      className="text-xs text-teal-800 dark:text-teal-300 font-medium underline"
                    >
                      Inspect Incident →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Status Change Audit Trail */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs mb-3 flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>Full Audit Trail History</span>
            </div>
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      Status changed to <strong className="text-teal-700 dark:text-teal-400">{h.new_status}</strong>
                    </div>
                    <div className="text-slate-600 dark:text-slate-300 mt-0.5">{h.note}</div>
                  </div>
                  <div className="text-right text-[11px] text-slate-400 dark:text-slate-500 font-mono shrink-0">
                    <div>{new Date(h.changed_at).toLocaleString()}</div>
                    <div>By: {h.changed_by}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white rounded-lg text-xs font-semibold"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
