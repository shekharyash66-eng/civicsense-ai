import React, { useState, useMemo } from 'react';
import { useCivic } from '../../context/CivicContext';
import { Complaint, ComplaintStatus, PriorityLevel, CivicCategory } from '../../types/civic';
import { PriorityIndicator, StatusIndicator } from '../common/StatusBadge';
import { ComplaintDetailModal } from './ComplaintDetailModal';
import {
  Search,
  Download,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  Eye,
  Building2,
  CheckCircle,
  Clock,
  MapPin,
  ChevronRight,
} from 'lucide-react';

interface ComplaintListProps {
  initialFilterPriority?: PriorityLevel;
  initialFilterStatus?: ComplaintStatus;
  initialFilterCategory?: CivicCategory;
  onSelectIncident?: (incidentId: string) => void;
}

export const ComplaintList: React.FC<ComplaintListProps> = ({
  initialFilterPriority,
  initialFilterStatus,
  initialFilterCategory,
  onSelectIncident,
}) => {
  const { complaints, departments, updateComplaintStatus, assignDepartment, exportComplaintsCsv, currentRole, selectedOfficerDeptId } = useCivic();

  const isOfficer = currentRole === 'Department Officer';

  // Filters
  const [search, setSearch] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>(initialFilterPriority || 'ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialFilterStatus || 'ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialFilterCategory || 'ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>(
    isOfficer ? selectedOfficerDeptId : 'ALL'
  );

  // Sorting
  const [sortBy, setSortBy] = useState<'priority' | 'date' | 'id'>('priority');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal inspection
  const [inspectedComplaint, setInspectedComplaint] = useState<Complaint | null>(null);

  // Filter complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      // Role scope: Department officers only see their department's tickets (or unassigned in their category)
      if (isOfficer && c.assigned_department_id !== selectedOfficerDeptId) {
        return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesId = c.id.toLowerCase().includes(q);
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesLocation = c.location_name.toLowerCase().includes(q);
        if (!matchesId && !matchesTitle && !matchesLocation) return false;
      }

      if (selectedPriority !== 'ALL' && c.priority_level !== selectedPriority) {
        return false;
      }

      if (selectedStatus !== 'ALL' && c.status !== selectedStatus) {
        return false;
      }

      if (selectedCategory !== 'ALL' && c.category !== selectedCategory) {
        return false;
      }

      if (!isOfficer && selectedDepartment !== 'ALL') {
        if (selectedDepartment === 'UNASSIGNED') {
          if (c.assigned_department_id) return false;
        } else if (c.assigned_department_id !== selectedDepartment) {
          return false;
        }
      }

      return true;
    });
  }, [complaints, isOfficer, selectedOfficerDeptId, search, selectedPriority, selectedStatus, selectedCategory, selectedDepartment]);

  // Sort complaints
  const sortedComplaints = useMemo(() => {
    return [...filteredComplaints].sort((a, b) => {
      if (sortBy === 'priority') {
        return sortOrder === 'desc'
          ? b.priority_score - a.priority_score
          : a.priority_score - b.priority_score;
      }
      if (sortBy === 'date') {
        const timeA = new Date(a.submitted_at).getTime();
        const timeB = new Date(b.submitted_at).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      }
      if (sortBy === 'id') {
        return sortOrder === 'desc' ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
      }
      return 0;
    });
  }, [filteredComplaints, sortBy, sortOrder]);

  const toggleSort = (field: 'priority' | 'date' | 'id') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {isOfficer ? 'Department Work Queue' : 'Civic Complaint Management'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Showing <strong className="font-mono text-slate-800 dark:text-slate-200">{sortedComplaints.length}</strong> of{' '}
            <span className="font-mono">{complaints.length}</span> total reports
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => exportComplaintsCsv(sortedComplaints)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg shadow-2xs transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Search */}
          <div className="relative lg:col-span-1">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, ID, location..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Priority filter */}
          <div>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="Critical">Critical (80-100)</option>
              <option value="High">High (60-79)</option>
              <option value="Medium">Medium (35-59)</option>
              <option value="Low">Low (0-34)</option>
            </select>
          </div>

          {/* Status filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Under Review">Under Review</option>
              <option value="Verified">Verified</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Category filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All Categories</option>
              <option value="Potholes & Road Damage">Potholes & Roads</option>
              <option value="Water Leakage & Drainage">Water & Drainage</option>
              <option value="Broken Streetlights & Electrical">Power & Lighting</option>
              <option value="Garbage & Sanitation">Garbage & Sanitation</option>
              <option value="Pedestrian & Traffic Safety">Pedestrian & Traffic</option>
              <option value="Public Infrastructure Damage">Public Infrastructure</option>
              <option value="Other Civic Issues">Other Issues</option>
            </select>
          </div>

          {/* Department filter (Admin only) */}
          {!isOfficer && (
            <div>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="ALL">All Departments</option>
                <option value="UNASSIGNED">Unassigned Only</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 tracking-wider">
              <tr>
                <th
                  onClick={() => toggleSort('id')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Ticket ID</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Title & Defect</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Location</th>
                <th
                  onClick={() => toggleSort('priority')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white whitespace-nowrap text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Priority</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Status</th>
                <th
                  onClick={() => toggleSort('date')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white whitespace-nowrap text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Submitted</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedComplaints.length > 0 ? (
                sortedComplaints.map((c) => {
                  const dept = departments.find((d) => d.id === c.assigned_department_id);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setInspectedComplaint(c)}
                      className="hover:bg-teal-50/40 dark:hover:bg-slate-800/60 transition-all cursor-pointer animate-fade-in-up"
                    >
                      {/* ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {c.is_emergency_flagged && (
                            <span title="Emergency Hazard" className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                          )}
                          <span>{c.id}</span>
                        </div>
                      </td>

                      {/* Title */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">{c.title}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{c.description}</div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {c.category}
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4 max-w-[180px] truncate text-slate-600 dark:text-slate-400">
                        <span title={c.location_name}>{c.location_name}</span>
                      </td>

                      {/* Priority Score */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <PriorityIndicator level={c.priority_level} score={c.priority_score} />
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {dept ? (
                          <span className="text-slate-800 dark:text-slate-200 font-medium">{dept.name.split('(')[0]}</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-medium italic">Unassigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusIndicator status={c.status} />
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {new Date(c.submitted_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectedComplaint(c);
                          }}
                          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                          title="Inspect Complaint"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-slate-400 dark:text-slate-500">
                    <div className="max-w-sm mx-auto space-y-2">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {complaints.length === 0
                          ? 'No complaints have been submitted yet.'
                          : 'No complaints matched the active filters.'}
                      </p>
                      {complaints.length > 0 ? (
                        <button
                          onClick={() => {
                            setSearch('');
                            setSelectedPriority('ALL');
                            setSelectedStatus('ALL');
                            setSelectedCategory('ALL');
                            setSelectedDepartment('ALL');
                          }}
                          className="text-xs text-teal-700 dark:text-teal-400 hover:underline font-medium"
                        >
                          Reset All Filters
                        </button>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Citizen submissions will appear here in real time as they are registered.
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {inspectedComplaint && (
        <ComplaintDetailModal
          complaint={inspectedComplaint}
          onClose={() => setInspectedComplaint(null)}
          onSelectIncident={onSelectIncident}
        />
      )}
    </div>
  );
};
