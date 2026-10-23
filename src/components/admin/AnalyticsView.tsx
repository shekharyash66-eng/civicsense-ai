import React, { useState } from 'react';
import { useCivic } from '../../context/CivicContext';
import {
  BarChart3,
  TrendingUp,
  Clock,
  AlertTriangle,
  Building2,
  CheckCircle2,
  MapPin,
  Calendar,
  Layers,
  ArrowUpRight,
} from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const { complaints, incidents, departments } = useCivic();

  const [dateRangeFilter, setDateRangeFilter] = useState<'7d' | '30d' | 'all'>('all');

  const total = complaints.length;
  const resolved = complaints.filter((c) => c.status === 'Resolved').length;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  // Overdue calculation: active complaints open longer than 72 hours
  const now = Date.now();
  const overdueComplaints = complaints.filter((c) => {
    if (c.status === 'Resolved' || c.status === 'Rejected') return false;
    const submitted = new Date(c.submitted_at).getTime();
    const hours = (now - submitted) / (1000 * 60 * 60);
    return hours > 72;
  });

  // Average resolution time in hours
  const resolvedList = complaints.filter((c) => c.status === 'Resolved' && c.resolved_at);
  let avgHours = 0;
  if (resolvedList.length > 0) {
    const sum = resolvedList.reduce((acc, c) => {
      const s = new Date(c.submitted_at).getTime();
      const e = new Date(c.resolved_at!).getTime();
      return acc + (e - s) / (1000 * 60 * 60);
    }, 0);
    avgHours = Math.round((sum / resolvedList.length) * 10) / 10;
  }

  // Geographic hotspot aggregation
  const locationHotspots: Record<string, { count: number; critical: number }> = {};
  complaints.forEach((c) => {
    const loc = c.location_name.split(',')[0].trim();
    if (!locationHotspots[loc]) {
      locationHotspots[loc] = { count: 0, critical: 0 };
    }
    locationHotspots[loc].count += 1;
    if (c.priority_level === 'Critical') {
      locationHotspots[loc].critical += 1;
    }
  });

  const sortedHotspots = Object.entries(locationHotspots)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6);

  // Reopened cases
  const citizenConfirmedCount = complaints.filter((c) => c.citizen_confirmed_resolved).length;
  const pendingConfirmationCount = resolved - citizenConfirmedCount;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Analytics & Accountability
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Empirical civic performance, SLA turnaround benchmarks, and geographic cluster metrics.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
          <button
            onClick={() => setDateRangeFilter('7d')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              dateRangeFilter === '7d' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setDateRangeFilter('30d')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              dateRangeFilter === '30d' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setDateRangeFilter('all')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              dateRangeFilter === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            All Records
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="font-medium">Resolution Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
            {resolutionRate}%
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {resolved} of {total} closed cases
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="font-medium">Avg Resolution Time</span>
            <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-teal-700 dark:text-teal-400 mt-2 tabular-nums">
            {avgHours}h
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">From submission to fix</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="font-medium">Overdue Complaints (&gt;72h)</span>
            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-2 tabular-nums">
            {overdueComplaints.length}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Exceeding SLA benchmark</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="font-medium">Citizen Confirmed Fixes</span>
            <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-700 dark:text-indigo-400 mt-2 tabular-nums">
            {citizenConfirmedCount}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{pendingConfirmationCount} pending citizen check</div>
        </div>
      </div>

      {/* Hotspots & Department Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Geographic Hotspots */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-sm">
              <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Geographic Hotspot Corridors</span>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">By report volume</span>
          </div>

          {sortedHotspots.length > 0 ? (
            <div className="space-y-3">
              {sortedHotspots.map(([loc, stats]) => (
                <div key={loc} className="space-y-1">
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-800 dark:text-slate-200 truncate">{loc}</span>
                    <span className="font-mono text-slate-900 dark:text-white tabular-nums">
                      {stats.count} reports {stats.critical > 0 && <span className="text-red-600 dark:text-red-400 font-bold">({stats.critical} critical)</span>}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-teal-600 h-full"
                      style={{ width: `${Math.min(100, (stats.count / total) * 350)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
              No analytics data available yet.
            </div>
          )}
        </div>

        {/* Department SLA & Workload Adherence */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-sm">
              <Building2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Department SLA Compliance & Workload</span>
            </div>
          </div>

          <div className="space-y-3">
            {departments.map((d) => {
              const deptComplaints = complaints.filter((c) => c.assigned_department_id === d.id);
              const deptResolved = deptComplaints.filter((c) => c.status === 'Resolved').length;
              const rate = deptComplaints.length > 0 ? Math.round((deptResolved / deptComplaints.length) * 100) : 0;

              return (
                <div key={d.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-1.5">
                  <div className="flex justify-between font-semibold text-slate-900 dark:text-white">
                    <span className="truncate">{d.name}</span>
                    <span className="font-mono text-teal-700 dark:text-teal-400 tabular-nums">{rate}% closed</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>SLA Target: {d.sla_target_hours}h</span>
                    <span>Total Dispatched: {deptComplaints.length}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-teal-600 h-full" style={{ width: `${rate}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
