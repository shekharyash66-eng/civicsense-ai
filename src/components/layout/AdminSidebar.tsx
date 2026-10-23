import React from 'react';
import { useCivic } from '../../context/CivicContext';
import {
  LayoutDashboard,
  FileText,
  Network,
  MapPin,
  BarChart3,
  Building2,
  CheckCircle2,
  Sliders,
  AlertOctagon,
  Users,
} from 'lucide-react';

interface AdminSidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ currentView, setCurrentView }) => {
  const { complaints, incidents, currentRole, selectedOfficerDeptId, departments } = useCivic();

  const isOfficer = currentRole === 'Department Officer';
  const officerDept = departments.find((d) => d.id === selectedOfficerDeptId);

  // Computed counts
  const filteredComplaints = isOfficer
    ? complaints.filter((c) => c.assigned_department_id === selectedOfficerDeptId)
    : complaints;

  const unresolvedCount = filteredComplaints.filter(
    (c) => c.status !== 'Resolved' && c.status !== 'Rejected'
  ).length;

  const criticalCount = filteredComplaints.filter(
    (c) => c.priority_level === 'Critical' && c.status !== 'Resolved' && c.status !== 'Rejected'
  ).length;

  const proposedIncidentsCount = incidents.filter((i) => i.status === 'Proposed').length;

  const navItems = [
    {
      id: 'admin-overview',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'admin-complaints',
      label: isOfficer ? 'Department Queue' : 'All Complaints',
      icon: FileText,
      badge: unresolvedCount > 0 ? unresolvedCount : undefined,
      badgeColor: 'bg-slate-200 text-slate-800',
    },
    {
      id: 'admin-incidents',
      label: 'Incident Intelligence',
      icon: Network,
      badge: proposedIncidentsCount > 0 ? `${proposedIncidentsCount} new` : undefined,
      badgeColor: 'bg-teal-100 text-teal-800 font-semibold',
    },
    {
      id: 'admin-map',
      label: 'Civic Map View',
      icon: MapPin,
    },
    {
      id: 'admin-analytics',
      label: 'Analytics & SLA',
      icon: BarChart3,
    },
    {
      id: 'admin-departments',
      label: 'Departments',
      icon: Building2,
    },
    {
      id: 'admin-resolutions',
      label: 'Resolution Tracking',
      icon: CheckCircle2,
    },
    {
      id: 'admin-settings',
      label: 'AI Priority Engine',
      icon: Sliders,
    },
  ];

  if (!isOfficer) {
    navItems.push({
      id: 'admin-users',
      label: 'User Role Directory',
      icon: Users,
    });
  }

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col min-h-[calc(100vh-4rem)] border-r border-slate-800">
      {/* Officer Context Notice if active */}
      {isOfficer && (
        <div className="p-3 mx-3 my-3 rounded bg-slate-800 border border-slate-700 text-xs">
          <div className="text-[11px] uppercase tracking-wide text-teal-400 font-semibold">
            Officer Filter Active
          </div>
          <div className="font-medium text-white truncate mt-0.5">
            {officerDept ? officerDept.name : 'All Departments'}
          </div>
        </div>
      )}

      {/* Critical Alert summary */}
      {criticalCount > 0 && (
        <div
          onClick={() => setCurrentView('admin-complaints')}
          className="mx-3 mt-3 mb-1 p-2.5 rounded bg-red-950/60 border border-red-800/80 cursor-pointer hover:bg-red-950 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-red-200">Critical Issues</span>
          </div>
          <span className="font-mono text-xs font-bold text-red-300 bg-red-900/80 px-1.5 py-0.5 rounded">
            {criticalCount}
          </span>
        </div>
      )}

      <nav className="p-3 space-y-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono tabular-nums ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500">
        <div>CivicSense AI v2.4</div>
        <div>Municipal Intelligence Platform</div>
      </div>
    </aside>
  );
};
