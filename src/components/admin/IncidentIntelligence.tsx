import React, { useState } from 'react';
import { useCivic } from '../../context/CivicContext';
import { Incident, Complaint } from '../../types/civic';
import { PriorityIndicator, StatusIndicator } from '../common/StatusBadge';
import { ComplaintDetailModal } from './ComplaintDetailModal';
import {
  Network,
  Sparkles,
  CheckCircle,
  XCircle,
  Merge,
  Plus,
  Trash2,
  MapPin,
  Clock,
  Users2,
  Building2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RotateCw,
  ExternalLink,
} from 'lucide-react';

interface IncidentIntelligenceProps {
  initialIncidentId?: string;
  setCurrentView: (view: string) => void;
}

export const IncidentIntelligence: React.FC<IncidentIntelligenceProps> = ({
  initialIncidentId,
  setCurrentView,
}) => {
  const {
    incidents,
    complaints,
    departments,
    confirmIncident,
    rejectIncident,
    mergeIncidents,
    removeComplaintFromIncident,
    addComplaintToIncident,
    runIncidentAutoDetection,
  } = useCivic();

  const [filterStatus, setFilterStatus] = useState<'ALL' | 'Proposed' | 'Confirmed' | 'Rejected'>('ALL');
  const [expandedIncidentId, setExpandedIncidentId] = useState<string | null>(
    initialIncidentId || incidents[0]?.id || null
  );

  // Merge modal state
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [primaryMergeId, setPrimaryMergeId] = useState<string>('');
  const [secondaryMergeId, setSecondaryMergeId] = useState<string>('');

  // Add complaint to incident state
  const [addComplaintIncidentId, setAddComplaintIncidentId] = useState<string | null>(null);
  const [selectedComplaintToAdd, setSelectedComplaintToAdd] = useState<string>('');

  // Inspect modal
  const [inspectedComplaint, setInspectedComplaint] = useState<Complaint | null>(null);

  const [isClustering, setIsClustering] = useState(false);

  const handleRunDetection = () => {
    setIsClustering(true);
    setTimeout(() => {
      runIncidentAutoDetection();
      setIsClustering(false);
    }, 600);
  };

  const filteredIncidents = incidents.filter((i) => {
    if (filterStatus === 'ALL') return true;
    return i.status === filterStatus;
  });

  const handleMergeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (primaryMergeId && secondaryMergeId && primaryMergeId !== secondaryMergeId) {
      mergeIncidents(primaryMergeId, secondaryMergeId);
      setMergeModalOpen(false);
    }
  };

  const handleAddComplaintSubmit = (incidentId: string) => {
    if (selectedComplaintToAdd) {
      addComplaintToIncident(incidentId, selectedComplaintToAdd);
      setSelectedComplaintToAdd('');
      setAddComplaintIncidentId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 px-2.5 py-0.5 rounded mb-1">
            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Signature Intelligence Feature</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Civic Incident Intelligence
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            AI-driven spatial, temporal, and semantic correlation grouping individual complaints into systemic root incidents.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              if (incidents.length >= 2) {
                setPrimaryMergeId(incidents[0].id);
                setSecondaryMergeId(incidents[1].id);
                setMergeModalOpen(true);
              }
            }}
            disabled={incidents.length < 2}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
          >
            <Merge className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Merge Incidents</span>
          </button>

          <button
            onClick={handleRunDetection}
            disabled={isClustering}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 rounded-lg shadow-2xs transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isClustering ? 'animate-spin' : ''}`} />
            <span>{isClustering ? 'Scanning...' : 'Detect Clusters'}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit text-xs">
        {(['ALL', 'Proposed', 'Confirmed', 'Rejected'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterStatus(tab)}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
              filterStatus === tab
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab === 'ALL' ? 'All Incidents' : tab}
          </button>
        ))}
      </div>

      {/* Incidents List */}
      <div className="space-y-4">
        {filteredIncidents.length > 0 ? (
          filteredIncidents.map((incident) => {
            const isExpanded = expandedIncidentId === incident.id;
            const related = complaints.filter((c) => incident.related_complaint_ids.includes(c.id));
            const assignedDept = departments.find((d) => d.id === incident.assigned_department_id);

            return (
              <div
                key={incident.id}
                className={`bg-white dark:bg-slate-900 rounded-xl border transition-all overflow-hidden animate-fade-in-up hover-elevate ${
                  incident.status === 'Proposed'
                    ? 'border-teal-300 dark:border-teal-700 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 shadow-2xs'
                }`}
              >
                {/* Header Banner */}
                <div
                  onClick={() => setExpandedIncidentId(isExpanded ? null : incident.id)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 px-2 py-0.5 rounded">
                        {incident.id}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-semibold border ${
                          incident.status === 'Confirmed'
                            ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : incident.status === 'Proposed'
                            ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 animate-pulse'
                            : 'bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {incident.status === 'Proposed' ? 'Requires Admin Confirmation' : incident.status}
                      </span>
                      <PriorityIndicator level={incident.highest_priority} showScore={false} />
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {incident.related_complaint_ids.length} Linked Complaints
                      </span>
                    </div>

                    <h2 className="text-base font-bold text-slate-900 dark:text-white">{incident.title}</h2>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        {incident.location_name}
                      </span>
                      <span>·</span>
                      <span>{incident.category}</span>
                      {incident.estimated_affected_population && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Users2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                            Est. {incident.estimated_affected_population.toLocaleString()} citizens impacted
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Confidence and Toggle */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">Grouping Confidence</div>
                      <div className="font-mono text-base font-bold text-teal-700 dark:text-teal-400">
                        {incident.grouping_confidence}%
                      </div>
                    </div>

                    <button className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-5 text-xs">
                    {/* Correlation Reasoning Banner */}
                    <div className="p-4 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg space-y-1.5">
                      <div className="font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5 text-xs">
                        <Sparkles className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                        <span>AI Incident Correlation Rationale</span>
                      </div>
                      <p className="text-xs text-teal-950 dark:text-teal-200 leading-relaxed font-sans">
                        {incident.explanation}
                      </p>
                    </div>

                    {/* Next Action Recommendation */}
                    <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-start gap-3">
                      <Building2 className="w-4 h-4 text-slate-600 dark:text-slate-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">Recommended Next Operational Action:</div>
                        <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">{incident.recommended_next_action}</p>
                      </div>
                    </div>

                    {/* Linked Complaints List */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wide">
                          Subsumed Citizen Complaints ({related.length})
                        </h3>
                        <button
                          onClick={() => setAddComplaintIncidentId(incident.id)}
                          className="text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 font-medium text-xs flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Link Another Complaint</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {related.map((c) => (
                          <div
                            key={c.id}
                            className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                          >
                            <div
                              onClick={() => setInspectedComplaint(c)}
                              className="flex-1 cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900 dark:text-white">{c.id}</span>
                                <PriorityIndicator level={c.priority_level} score={c.priority_score} />
                                <StatusIndicator status={c.status} />
                              </div>
                              <div className="font-medium text-slate-800 dark:text-slate-200 mt-1 truncate">{c.title}</div>
                              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{c.location_name}</div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => setInspectedComplaint(c)}
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-700 dark:text-slate-200 font-medium"
                              >
                                View
                              </button>
                              <button
                                onClick={() => removeComplaintFromIncident(incident.id, c.id)}
                                title="Unlink from this incident"
                                className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add complaint dropdown if opened */}
                      {addComplaintIncidentId === incident.id && (
                        <div className="mt-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                          <select
                            value={selectedComplaintToAdd}
                            onChange={(e) => setSelectedComplaintToAdd(e.target.value)}
                            className="flex-1 text-xs px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          >
                            <option value="">-- Select complaint to link --</option>
                            {complaints
                              .filter((c) => !incident.related_complaint_ids.includes(c.id))
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.id} - {c.title.slice(0, 45)}...
                                </option>
                              ))}
                          </select>
                          <button
                            onClick={() => handleAddComplaintSubmit(incident.id)}
                            disabled={!selectedComplaintToAdd}
                            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded font-medium disabled:opacity-50"
                          >
                            Attach
                          </button>
                          <button
                            onClick={() => setAddComplaintIncidentId(null)}
                            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Operational Action Controls */}
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                        Incident created: {new Date(incident.created_at).toLocaleString()}
                      </div>

                      <div className="flex items-center gap-2">
                        {incident.status === 'Proposed' && (
                          <>
                            <button
                              onClick={() => confirmIncident(incident.id)}
                              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-2xs"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Confirm Incident Grouping</span>
                            </button>

                            <button
                              onClick={() => rejectIncident(incident.id)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-medium rounded-lg"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Reject Grouping</span>
                            </button>
                          </>
                        )}

                        {incident.status === 'Confirmed' && (
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1 text-xs">
                            <CheckCircle className="w-4 h-4" />
                            <span>Confirmed Municipal Incident</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <Network className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No incidents found.</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              AI cluster detection will group related complaints once overlapping reports are submitted.
            </p>
          </div>
        )}
      </div>

      {/* Merge Modal */}
      {mergeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleMergeSubmit}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full space-y-4 text-xs shadow-xl"
          >
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
              <Merge className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Merge Consolidated Incidents</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              Combine two separate incidents when investigative evidence reveals they stem from the same root municipal problem.
            </p>

            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Primary Incident (Will Retain ID)</label>
              <select
                value={primaryMergeId}
                onChange={(e) => setPrimaryMergeId(e.target.value)}
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {incidents.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.id} - {i.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">Secondary Incident (Will be Merged & Closed)</label>
              <select
                value={secondaryMergeId}
                onChange={(e) => setSecondaryMergeId(e.target.value)}
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {incidents.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.id} - {i.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMergeModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded font-medium text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!primaryMergeId || !secondaryMergeId || primaryMergeId === secondaryMergeId}
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded font-semibold disabled:opacity-50"
              >
                Confirm Merge
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inspect complaint modal */}
      {inspectedComplaint && (
        <ComplaintDetailModal
          complaint={inspectedComplaint}
          onClose={() => setInspectedComplaint(null)}
        />
      )}
    </div>
  );
};
