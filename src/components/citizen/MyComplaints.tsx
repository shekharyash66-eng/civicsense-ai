import React from 'react';
import { useCivic } from '../../context/CivicContext';
import { PriorityIndicator, StatusIndicator } from '../common/StatusBadge';
import { FileText, ArrowRight, Plus, MapPin, Calendar, Inbox } from 'lucide-react';

interface MyComplaintsProps {
  setCurrentView: (view: string) => void;
  setSelectedComplaintId: (id: string) => void;
}

export const MyComplaints: React.FC<MyComplaintsProps> = ({ setCurrentView, setSelectedComplaintId }) => {
  const { complaints, currentUser } = useCivic();

  const userComplaints = currentUser?.email
    ? complaints.filter((c) => c.reporter_email?.toLowerCase() === currentUser.email.toLowerCase())
    : complaints;

  const displayComplaints = userComplaints.length > 0 ? userComplaints : complaints;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6 text-slate-900 dark:text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            My Submitted Complaints
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Track status updates, departmental work orders, and resolution milestones for your filed issues.
          </p>
        </div>

        <button
          onClick={() => setCurrentView('report')}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 text-white rounded-lg text-xs font-semibold shadow transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Report New Issue</span>
        </button>
      </div>

      {displayComplaints.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-4 shadow-2xs">
          <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              No complaints have been submitted yet.
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              Your reported civic issues and infrastructure maintenance tickets will appear here once submitted.
            </p>
          </div>
          <button
            onClick={() => setCurrentView('report')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
          >
            <span>Submit Your First Report</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {displayComplaints.map((c) => (
            <div
              key={c.id}
              onClick={() => {
                setSelectedComplaintId(c.id);
                setCurrentView('track');
              }}
              className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{c.id}</span>
                  <StatusIndicator status={c.status} />
                  <PriorityIndicator level={c.priority_level} score={c.priority_score} />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{c.title}</h3>
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[11px]">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                    {c.location_name}
                  </span>
                  <span>·</span>
                  <span>{c.category}</span>
                  <span>·</span>
                  <span>Submitted {new Date(c.submitted_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-semibold shrink-0">
                <span>Track Details</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
