import React from "react";
import { CivicNotification } from "../../types";
import { markNotificationAsRead, markAllNotificationsRead } from "../../services/complaintService";
import { Bell, CheckCheck, ExternalLink, Wrench, ShieldAlert, CheckCircle2 } from "lucide-react";

interface NotificationDropdownProps {
  notifications: CivicNotification[];
  isOpen: boolean;
  onClose: () => void;
  onNavigateToComplaint: (id: string) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  notifications,
  isOpen,
  onClose,
  onNavigateToComplaint,
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIcon = (type: CivicNotification["type"]) => {
    switch (type) {
      case "resolution":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case "assignment":
        return <Wrench className="w-4 h-4 text-indigo-600" />;
      case "status_change":
        return <Bell className="w-4 h-4 text-amber-600" />;
      default:
        return <ShieldAlert className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
      {/* Header */}
      <div className="p-3.5 px-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
          {unreadCount > 0 && (
            <span className="bg-teal-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllNotificationsRead()}
            className="text-xs text-teal-700 hover:text-teal-800 font-medium flex items-center gap-1 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            No notifications yet.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                markNotificationAsRead(n.id);
                onClose();
                onNavigateToComplaint(n.complaintId);
              }}
              className={`p-3.5 transition-colors cursor-pointer hover:bg-slate-50 flex items-start gap-3 ${
                !n.read ? "bg-teal-50/40" : "bg-white"
              }`}
            >
              <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 shrink-0">
                {getIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-slate-900 truncate">
                    {n.title}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {n.timestamp}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                  {n.message}
                </p>
                <div className="mt-1 flex items-center gap-1 text-[11px] font-mono text-teal-700 font-medium">
                  <span>#{n.complaintId}</span>
                  <ExternalLink className="w-3 h-3" />
                </div>
              </div>
              {!n.read && (
                <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0 mt-1.5" />
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
        <span className="text-[11px] text-slate-400">
          Civic alerts & departmental assignments
        </span>
      </div>
    </div>
  );
};
