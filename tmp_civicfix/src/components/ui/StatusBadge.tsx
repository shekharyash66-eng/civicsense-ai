import React from "react";
import { ComplaintStatus, ComplaintPriority } from "../../types";
import { Clock, Eye, UserCheck, Wrench, CheckCircle2, Archive, AlertTriangle, ArrowUpRight } from "lucide-react";

interface StatusBadgeProps {
  status: ComplaintStatus;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  pulse?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = "md",
  showIcon = true,
  pulse = false,
}) => {
  const config = {
    SUBMITTED: {
      label: "Submitted",
      bg: "bg-slate-100 text-slate-700 border-slate-200",
      dot: "bg-slate-400",
      icon: Clock,
    },
    ACKNOWLEDGED: {
      label: "Acknowledged",
      bg: "bg-blue-50 text-blue-700 border-blue-200",
      dot: "bg-blue-500",
      icon: Eye,
    },
    ASSIGNED: {
      label: "Assigned",
      bg: "bg-indigo-50 text-indigo-700 border-indigo-200",
      dot: "bg-indigo-500",
      icon: UserCheck,
    },
    IN_PROGRESS: {
      label: "In Progress",
      bg: "bg-amber-50 text-amber-800 border-amber-200",
      dot: "bg-amber-500",
      icon: Wrench,
    },
    RESOLVED: {
      label: "Resolved",
      bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
      dot: "bg-emerald-500",
      icon: CheckCircle2,
    },
    CLOSED: {
      label: "Closed & Confirmed",
      bg: "bg-teal-50 text-teal-800 border-teal-200",
      dot: "bg-teal-500",
      icon: Archive,
    },
  }[status] || {
    label: status,
    bg: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
    icon: Clock,
  };

  const Icon = config.icon;
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-xs font-medium px-2.5 py-1 gap-1.5",
    lg: "text-sm font-medium px-3 py-1.5 gap-2",
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border ${config.bg} ${sizeClasses} transition-all`}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dot}`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
        </span>
      )}
      {!pulse && showIcon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      <span className="whitespace-nowrap font-medium tracking-tight">{config.label}</span>
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: ComplaintPriority }> = ({ priority }) => {
  const map = {
    low: { label: "Low Priority", cls: "bg-slate-100 text-slate-600 border-slate-200" },
    medium: { label: "Medium Priority", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    high: { label: "High Priority", cls: "bg-orange-50 text-orange-700 border-orange-200" },
    urgent: { label: "Urgent Priority", cls: "bg-rose-50 text-rose-700 border-rose-200 animate-pulse" },
  }[priority];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map.cls}`}>
      {priority === "urgent" && <AlertTriangle className="w-3 h-3 mr-1" />}
      {map.label}
    </span>
  );
};
