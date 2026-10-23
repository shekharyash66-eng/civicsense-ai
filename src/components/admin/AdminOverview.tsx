import React from 'react';
import { useCivic } from '../../context/CivicContext';
import { PriorityLevel, ComplaintStatus, CivicCategory } from '../../types/civic';
import { PriorityIndicator, StatusIndicator } from '../common/StatusBadge';
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Building2,
  Network,
  ChevronRight,
  FileText,
  AlertTriangle,
  Inbox,
  Plus,
} from 'lucide-react';

interface AdminOverviewProps {
  setCurrentView: (view: string) => void;
  setFilterPriority?: (p: PriorityLevel) => void;
  setFilterStatus?: (s: ComplaintStatus) => void;
  setFilterCategory?: (c: CivicCategory) => void;
  setSelectedComplaintId?: (id: string) => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  setCurrentView,
  setFilterPriority,
  setFilterStatus,
  setFilterCategory,
  setSelectedComplaintId,
}) => {
  const { complaints, incidents, departments, currentRole, selectedOfficerDeptId } = useCivic();

  const isOfficer = currentRole === 'Department Officer';

  // Role scoped dataset
  const activeDataset = isOfficer
    ? complaints.filter((c) => c.assigned_department_id === selectedOfficerDeptId)
    : complaints;

  // KPI calculations computed from live database dataset (0 when empty)
  const totalCount = activeDataset.length;
  const criticalCount = activeDataset.filter((c) => c.priority_level === 'Critical').length;
  const highCount = activeDataset.filter((c) => c.priority_level === 'High').length;
  const mediumCount = activeDataset.filter((c) => c.priority_level === 'Medium').length;
  const lowCount = activeDataset.filter((c) => c.priority_level === 'Low').length;

  const unresolvedCount = activeDataset.filter(
    (c) => c.status !== 'Resolved' && c.status !== 'Rejected'
  ).length;
  const resolvedCount = activeDataset.filter((c) => c.status === 'Resolved').length;

  // Average resolution time in hours for resolved complaints
  const resolvedItems = activeDataset.filter((c) => c.status === 'Resolved' && c.resolved_at);
  let avgResolutionHours = 0;
  if (resolvedItems.length > 0) {
    const totalHours = resolvedItems.reduce((acc, c) => {
      const start = new Date(c.submitted_at).getTime();
      const end = new Date(c.resolved_at!).getTime();
      return acc + Math.max(1, (end - start) / (1000 * 60 * 60));
    }, 0);
    avgResolutionHours = Math.round((totalHours / resolvedItems.length) * 10) / 10;
  }

  // Critical alerts requiring immediate triage
  const criticalAlerts = activeDataset
    .filter((c) => c.priority_level === 'Critical' && c.status !== 'Resolved' && c.status !== 'Rejected')
    .slice(0, 4);

  // Category breakdown
  const categoryCounts: Record<string, number> = {};
  activeDataset.forEach((c) => {
    categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
  });

  // Department workload distribution computed from real data
  const departmentWorkloads = departments.map((dept) => {
    const deptComplaints = complaints.filter((c) => c.assigned_department_id === dept.id);
    const active = deptComplaints.filter((c) => c.status !== 'Resolved' && c.status !== 'Rejected').length;
    const resolved = deptComplaints.filter((c) => c.status === 'Resolved').length;
    return {
      department: dept,
      active,
      resolved,
      total: deptComplaints.length,
    };
  });

  const proposedIncidents = incidents.filter((i) => i.status === 'Proposed');

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isOfficer ? 'Department Dispatch Console' : 'Municipal Operations Command'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time civic defect triage, explainable scoring, and incident intelligence overview.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentView('report')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Complaint</span>
          </button>
          <div className="text-right text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            <div className="font-mono text-slate-700 dark:text-slate-300 font-medium">
              {new Date().toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
            <div className="text-[11px] text-teal-700 dark:text-teal-400 font-semibold">Live Database Connected</div>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total */}
        <div
          onClick={() => setCurrentView('admin-complaints')}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-teal-300 dark:hover:border-teal-600 transition-all cursor-pointer relative overflow-hidden group animate-fade-in-up stagger-1 hover-elevate"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-500" />
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span className="font-medium">Total Complaints</span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-2 tabular-nums">
            {totalCount}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
            <span>{totalCount === 0 ? 'No submissions yet' : 'Click to view all'}</span>
            <ArrowUpRight className="w-3 h-3 text-teal-600 dark:text-teal-400" />
          </div>
        </div>

        {/* Critical */}
        <div
          onClick={() => {
            if (setFilterPriority) setFilterPriority('Critical');
            setCurrentView('admin-complaints');
          }}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-red-200 dark:border-red-900/60 shadow-2xs hover:border-red-300 dark:hover:border-red-700 transition-all cursor-pointer relative overflow-hidden group bg-red-50/10 dark:bg-red-950/20 animate-fade-in-up stagger-2 hover-elevate"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-rose-600" />
          <div className="flex items-center justify-between text-xs text-red-700 dark:text-red-400 pt-1">
            <span className="font-medium">Critical Issues</span>
            <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-red-600 dark:text-red-400 mt-2 tabular-nums">
            {criticalCount}
          </div>
          <div className="text-[11px] text-red-600 dark:text-red-400 mt-1 font-medium">
            {criticalCount === 0 ? 'No critical alerts' : 'Immediate triage required'}
          </div>
        </div>

        {/* Unresolved */}
        <div
          onClick={() => {
            if (setFilterStatus) setFilterStatus('In Progress');
            setCurrentView('admin-complaints');
          }}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-amber-300 dark:hover:border-amber-600 transition-all cursor-pointer relative overflow-hidden group animate-fade-in-up stagger-3 hover-elevate"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span className="font-medium">Unresolved Queue</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-2 tabular-nums">
            {unresolvedCount}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Pending inspection/closure</div>
        </div>

        {/* Resolved */}
        <div
          onClick={() => {
            if (setFilterStatus) setFilterStatus('Resolved');
            setCurrentView('admin-complaints');
          }}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-600 transition-all cursor-pointer relative overflow-hidden group animate-fade-in-up stagger-4 hover-elevate"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span className="font-medium">Resolved Cases</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
            {resolvedCount}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">With field completion notes</div>
        </div>

        {/* Avg Resolution Time */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs relative overflow-hidden group animate-fade-in-up stagger-5 hover-elevate">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-cyan-500" />
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span className="font-medium">Avg Resolution Time</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-teal-700 dark:text-teal-400 mt-2 tabular-nums">
            {avgResolutionHours}h
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Across closed work orders</div>
        </div>
      </div>

      {/* Incident Intelligence Alert Banner */}
      {proposedIncidents.length > 0 && (
        <div className="bg-gradient-to-r from-teal-900 to-slate-900 dark:from-slate-900 dark:to-teal-950 text-white rounded-xl p-5 shadow-sm border border-teal-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-teal-300">
                Civic Incident Intelligence Alert
              </span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed max-w-2xl">
              AI has identified <strong className="text-white font-mono">{proposedIncidents.length}</strong> potential incident cluster(s) with correlated citizen reports sharing spatial, temporal, and descriptive symptoms.
            </p>
          </div>

          <button
            onClick={() => setCurrentView('admin-incidents')}
            className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shrink-0 whitespace-nowrap shadow-sm"
          >
            Review Proposed Clusters →
          </button>
        </div>
      )}

      {/* Main 2-Column Split: Critical Triage & Priority Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Urgent Critical Issues Queue */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Urgent Issues Requiring Immediate Attention</h2>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
              {criticalAlerts.length} Critical
            </span>
          </div>

          <div className="space-y-3">
            {criticalAlerts.length > 0 ? (
              criticalAlerts.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    if (setSelectedComplaintId) setSelectedComplaintId(c.id);
                    setCurrentView('admin-complaints');
                  }}
                  className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">{c.id}</span>
                        <PriorityIndicator level={c.priority_level} score={c.priority_score} />
                        <StatusIndicator status={c.status} />
                      </div>
                      <h3 className="font-semibold text-xs text-slate-900 dark:text-white mt-1 leading-snug">
                        {c.title}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                    <span className="truncate max-w-xs">{c.location_name}</span>
                    <span className="font-mono text-red-600 dark:text-red-400 font-semibold">
                      Safety Risk: {c.safety_risk_score}/100
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs space-y-2">
                <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="font-medium text-slate-600 dark:text-slate-300">
                  {totalCount === 0
                    ? 'No complaints have been submitted yet.'
                    : 'No active critical emergencies in current queue.'}
                </p>
                {totalCount === 0 && (
                  <button
                    onClick={() => setCurrentView('report')}
                    className="text-xs text-teal-700 dark:text-teal-400 hover:underline font-semibold"
                  >
                    Submit the first complaint →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Priority & Category Distribution Breakdown */}
        <div className="lg:col-span-5 space-y-6">
          {/* Priority Levels Bar Distribution */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Priority Distribution
              </h3>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{totalCount} total</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Critical (80–100)
                  </span>
                  <span className="font-mono font-bold text-red-700 dark:text-red-400 tabular-nums">
                    {criticalCount} ({totalCount > 0 ? Math.round((criticalCount / totalCount) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-red-500 h-full"
                    style={{ width: `${totalCount > 0 ? (criticalCount / totalCount) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    High (60–79)
                  </span>
                  <span className="font-mono font-bold text-orange-700 dark:text-orange-400 tabular-nums">
                    {highCount} ({totalCount > 0 ? Math.round((highCount / totalCount) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-orange-500 h-full"
                    style={{ width: `${totalCount > 0 ? (highCount / totalCount) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Medium (35–59)
                  </span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                    {mediumCount} ({totalCount > 0 ? Math.round((mediumCount / totalCount) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full"
                    style={{ width: `${totalCount > 0 ? (mediumCount / totalCount) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Low (0–34)
                  </span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {lowCount} ({totalCount > 0 ? Math.round((lowCount / totalCount) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full"
                    style={{ width: `${totalCount > 0 ? (lowCount / totalCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
              Issues by Domain Category
            </h3>
            {totalCount === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                No complaints have been submitted yet.
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                {Object.entries(categoryCounts).map(([cat, count]) => (
                  <div
                    key={cat}
                    onClick={() => {
                      if (setFilterCategory) setFilterCategory(cat as CivicCategory);
                      setCurrentView('admin-complaints');
                    }}
                    className="flex items-center justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <span className="text-slate-700 dark:text-slate-300 truncate pr-2">{cat}</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded tabular-nums">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Department Workload Overview */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Department Workload & Dispatch Capacity</h2>
          </div>
          <button
            onClick={() => setCurrentView('admin-departments')}
            className="text-xs text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 font-medium"
          >
            Manage Departments →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {departmentWorkloads.map(({ department, active, resolved, total }) => (
            <div
              key={department.id}
              className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2 text-xs"
            >
              <div className="font-semibold text-slate-900 dark:text-white truncate" title={department.name}>
                {department.name.split('(')[0]}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">SLA: {department.sla_target_hours}h target</div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Active Queue</div>
                  <div className="font-mono font-bold text-amber-700 dark:text-amber-400 text-sm tabular-nums">{active}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Resolved</div>
                  <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm tabular-nums">{resolved}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
