import React from "react";
import { Complaint, ComplaintStatus } from "../../types";
import { Check, Clock, User, Wrench, ShieldCheck, Sparkles, Building2 } from "lucide-react";

interface StatusTimelineProps {
  complaint: Complaint;
}

const ORDERED_STEPS: {
  status: ComplaintStatus;
  label: string;
  defaultSubtext: string;
}[] = [
  { status: "SUBMITTED", label: "Reported", defaultSubtext: "Photo + GPS received" },
  { status: "ACKNOWLEDGED", label: "Acknowledged", defaultSubtext: "Triage verified by ward team" },
  { status: "ASSIGNED", label: "Assigned", defaultSubtext: "Routed to responsible municipal department" },
  { status: "IN_PROGRESS", label: "In Progress", defaultSubtext: "Technician dispatched to site" },
  { status: "RESOLVED", label: "Resolved", defaultSubtext: "Municipal repairs concluded" },
  { status: "CLOSED", label: "Citizen Confirmed", defaultSubtext: "Citizen verified fix and closed ticket" },
];

export const StatusTimeline: React.FC<StatusTimelineProps> = ({ complaint }) => {
  const currentStatus = complaint.status;

  // Map progress indices
  const statusIndexMap: Record<ComplaintStatus, number> = {
    SUBMITTED: 0,
    ACKNOWLEDGED: 1,
    ASSIGNED: 2,
    IN_PROGRESS: 3,
    RESOLVED: 4,
    CLOSED: 5,
  };

  const currentIndex = statusIndexMap[currentStatus] ?? 0;

  return (
    <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-[17px] sm:before:left-[21px] before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
      {ORDERED_STEPS.map((step, idx) => {
        const isCompleted = idx < currentIndex || (idx === currentIndex && (currentStatus === "RESOLVED" || currentStatus === "CLOSED"));
        const isCurrent = idx === currentIndex && currentStatus !== "CLOSED";
        const isUpcoming = idx > currentIndex;

        // Find matching timeline event if exists
        const matchedEvent = complaint.timeline
          .slice()
          .reverse()
          .find((e) => e.status === step.status);

        return (
          <div key={step.status} className="relative flex items-start group">
            {/* Step Icon / Dot */}
            <div className="absolute -left-[25px] sm:-left-[29px] top-0 flex items-center justify-center">
              {isCompleted ? (
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-4 ring-white shadow-sm">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
              ) : isCurrent ? (
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center ring-4 ring-amber-100 shadow-sm animate-pulse">
                  <span className="w-2.5 h-2.5 bg-white rounded-full" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-slate-300 text-slate-400 flex items-center justify-center ring-4 ring-white">
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                </div>
              )}
            </div>

            {/* Content card */}
            <div className={`ml-4 w-full rounded-xl p-4 transition-all ${
              isCurrent
                ? "bg-amber-50/70 border border-amber-200/80 shadow-xs"
                : isCompleted
                ? "bg-white border border-slate-200/90 shadow-2xs"
                : "bg-slate-50/60 border border-slate-200/50 opacity-65"
            }`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h4 className={`text-base font-semibold ${
                    isCurrent
                      ? "text-amber-950 font-bold"
                      : isCompleted
                      ? "text-slate-900"
                      : "text-slate-500"
                  }`}>
                    {matchedEvent ? matchedEvent.title : step.label}
                  </h4>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-md">
                      Current Stage
                    </span>
                  )}
                </div>

                {matchedEvent ? (
                  <span className="text-xs text-slate-700 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {matchedEvent.timestamp}
                  </span>
                ) : (
                  <span className="text-xs text-slate-600 italic">Upcoming</span>
                )}
              </div>

              {/* Description */}
              <p className={`mt-1.5 text-sm leading-relaxed ${
                isUpcoming ? "text-slate-600" : "text-slate-700"
              }`}>
                {matchedEvent ? matchedEvent.description : step.defaultSubtext}
              </p>

              {/* Extra metadata if completed or current */}
              {matchedEvent && (matchedEvent.actor || matchedEvent.department || matchedEvent.technicianName) && (
                <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  {matchedEvent.actor && (
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{matchedEvent.actor}</span>
                    </span>
                  )}
                  {matchedEvent.department && (
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{matchedEvent.department}</span>
                    </span>
                  )}
                  {matchedEvent.technicianName && (
                    <span className="inline-flex items-center gap-1 text-indigo-700 font-medium bg-indigo-50 px-2 py-0.5 rounded">
                      <Wrench className="w-3 h-3" />
                      <span>Tech: {matchedEvent.technicianName}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
