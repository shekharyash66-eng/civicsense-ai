import React from 'react';
import { ComplaintStatus, PriorityLevel } from '../../types/civic';

export const PriorityIndicator: React.FC<{
  level: PriorityLevel;
  score?: number;
  showScore?: boolean;
}> = ({ level, score, showScore = true }) => {
  const config = {
    Critical: {
      color: 'text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/80 dark:border-red-800',
      dot: 'bg-red-500',
    },
    High: {
      color: 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950/80 dark:border-orange-800',
      dot: 'bg-orange-500',
    },
    Medium: {
      color: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/80 dark:border-amber-800',
      dot: 'bg-amber-500',
    },
    Low: {
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/80 dark:border-emerald-800',
      dot: 'bg-emerald-500',
    },
  }[level];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium border ${config.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      <span className="whitespace-nowrap">{level}</span>
      {showScore && typeof score === 'number' && (
        <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums text-[11px]">
          ({score})
        </span>
      )}
    </span>
  );
};

export const StatusIndicator: React.FC<{ status: ComplaintStatus }> = ({ status }) => {
  const styles: Record<ComplaintStatus, string> = {
    Submitted: 'text-slate-700 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700',
    'Under Review': 'text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-950/80 dark:border-sky-800',
    Verified: 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/80 dark:border-indigo-800',
    Assigned: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/80 dark:border-blue-800',
    'In Progress': 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/80 dark:border-amber-800',
    Resolved: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/80 dark:border-emerald-800',
    Rejected: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/80 dark:border-rose-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border whitespace-nowrap ${styles[status] || styles.Submitted}`}
    >
      {status}
    </span>
  );
};
