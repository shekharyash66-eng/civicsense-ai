import React, { useState } from 'react';
import { useCivic } from '../../context/CivicContext';
import { Complaint } from '../../types/civic';
import { PriorityIndicator } from '../common/StatusBadge';
import { ComplaintDetailModal } from './ComplaintDetailModal';
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building2,
  UserCheck,
  AlertCircle,
  Eye,
  FileCheck,
  Camera,
  MapPin,
} from 'lucide-react';

export const ResolutionTracking: React.FC = () => {
  const { complaints, departments, citizenConfirmResolution } = useCivic();

  const [filterType, setFilterType] = useState<'ALL' | 'CONFIRMED' | 'PENDING_CITIZEN'>('ALL');
  const [inspectedComplaint, setInspectedComplaint] = useState<Complaint | null>(null);

  const resolvedComplaints = complaints.filter((c) => c.status === 'Resolved');

  const filtered = resolvedComplaints.filter((c) => {
    if (filterType === 'CONFIRMED') return !!c.citizen_confirmed_resolved;
    if (filterType === 'PENDING_CITIZEN') return !c.citizen_confirmed_resolved;
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Resolution & Accountability Verification
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Audit completion evidence, department turnaround notes, and dual citizen confirmation status.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              filterType === 'ALL' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            All Resolved ({resolvedComplaints.length})
          </button>
          <button
            onClick={() => setFilterType('CONFIRMED')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              filterType === 'CONFIRMED' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Citizen Confirmed
          </button>
          <button
            onClick={() => setFilterType('PENDING_CITIZEN')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              filterType === 'PENDING_CITIZEN' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Pending Citizen Verification
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length > 0 ? (
          filtered.map((c) => {
            const dept = departments.find((d) => d.id === c.assigned_department_id);
            const isConfirmed = !!c.citizen_confirmed_resolved;

            return (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 space-y-3 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">{c.id}</span>
                    <PriorityIndicator level={c.priority_level} score={c.priority_score} />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{c.title}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isConfirmed ? (
                      <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded font-semibold text-[11px] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Confirmed by Citizen on Site</span>
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded font-medium text-[11px] flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Marked Resolved by Admin</span>
                        </span>
                        <button
                          onClick={() => citizenConfirmResolution(c.id)}
                          className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded font-medium text-[11px]"
                        >
                          Confirm Resolution (Citizen Verification)
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Location & Category:</span>
                    <div className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span>{c.location_name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{c.category}</div>
                  </div>

                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Assigned Service Department:</span>
                    <div className="font-medium text-slate-800 dark:text-slate-200">{dept?.name || 'Municipal Operations'}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Supervisor: {dept?.head_officer}</div>
                  </div>

                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Resolution Timestamp:</span>
                    <div className="font-mono text-slate-800 dark:text-slate-200">
                      {c.resolved_at ? new Date(c.resolved_at).toLocaleString() : 'Recently'}
                    </div>
                  </div>
                </div>

                {/* Resolution Completion Note */}
                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg space-y-1">
                  <div className="font-semibold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>Official Completion Note:</span>
                  </div>
                  <p className="text-emerald-900 dark:text-emerald-200 leading-relaxed font-sans">
                    {c.resolution_note || 'Maintenance work order completed and verified by on-site crew.'}
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end">
                  <button
                    onClick={() => setInspectedComplaint(c)}
                    className="text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 font-medium flex items-center gap-1"
                  >
                    <span>View Audit Trail & Evidence</span>
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
            {resolvedComplaints.length === 0
              ? 'No resolved complaints found in database yet.'
              : 'No complaints currently match this resolution status filter.'}
          </div>
        )}
      </div>

      {inspectedComplaint && (
        <ComplaintDetailModal
          complaint={inspectedComplaint}
          onClose={() => setInspectedComplaint(null)}
        />
      )}
    </div>
  );
};
