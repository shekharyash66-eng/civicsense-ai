import React, { useState, useMemo } from "react";
import { Complaint, IssueCategory, ComplaintStatus, ComplaintPriority } from "../types";
import { InteractiveMap } from "../components/map/InteractiveMap";
import { StatusBadge, PriorityBadge } from "../components/ui/StatusBadge";
import {
  MapPin,
  Filter,
  PlusCircle,
  Layers,
  Search,
  ExternalLink,
  ChevronRight,
  Sparkles,
  LayoutList,
  Map as MapIcon,
  X
} from "lucide-react";

interface ComplaintMapPageProps {
  complaints: Complaint[];
  onNavigate: (route: string) => void;
  onSelectComplaint: (id: string) => void;
  onReportAtCoords?: (coords: { lat: number; lng: number; address: string; ward: string }) => void;
}

export const ComplaintMapPage: React.FC<ComplaintMapPageProps> = ({
  complaints,
  onNavigate,
  onSelectComplaint,
  onReportAtCoords,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  // Filter complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      const matchCat = selectedCategory === "ALL" || c.category === selectedCategory;
      const matchStat = selectedStatus === "ALL" || c.status === selectedStatus;
      const matchPrio = selectedPriority === "ALL" || c.priority === selectedPriority;
      const matchSearch =
        !searchQuery ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.ward.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.address.toLowerCase().includes(searchQuery.toLowerCase());

      return matchCat && matchStat && matchPrio && matchSearch;
    });
  }, [complaints, selectedCategory, selectedStatus, selectedPriority, searchQuery]);

  const activeComplaint = useMemo(() => {
    return complaints.find((c) => c.id === selectedPinId);
  }, [complaints, selectedPinId]);

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20 pt-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Page Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-2xs">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full mb-1 border border-teal-200">
              <MapPin className="w-3.5 h-3.5 text-teal-600" />
              <span>Public Civic Transparency</span>
            </div>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              City Civic Issues Map
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Explore reported problems, live work progress, and verified resolutions across wards.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
              <button
                onClick={() => setViewMode("map")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  viewMode === "map"
                    ? "bg-white text-teal-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Map</span>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  viewMode === "list"
                    ? "bg-white text-teal-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
            </div>

            <button
              onClick={() => onNavigate("report")}
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Report Issue</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Ribbon */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search issue, ward, ID..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-teal-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium px-3 py-2 rounded-xl outline-none"
            >
              <option value="ALL">All Categories</option>
              <option value="streetlight">Streetlight</option>
              <option value="pothole">Roads & Potholes</option>
              <option value="garbage">Garbage & Sanitation</option>
              <option value="water_leakage">Water Leakage</option>
              <option value="drainage">Drainage</option>
              <option value="tree_fall">Tree Fall</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium px-3 py-2 rounded-xl outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium px-3 py-2 rounded-xl outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {(selectedCategory !== "ALL" ||
              selectedStatus !== "ALL" ||
              selectedPriority !== "ALL" ||
              searchQuery) && (
              <button
                onClick={() => {
                  setSelectedCategory("ALL");
                  setSelectedStatus("ALL");
                  setSelectedPriority("ALL");
                  setSearchQuery("");
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold sm:ml-auto"
              >
                Reset Filters
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span>
              Showing <strong>{filteredComplaints.length}</strong> complaints on map
            </span>
            <span className="text-[11px] text-slate-400">
              Click any pin to inspect details or track
            </span>
          </div>
        </div>

        {/* ================= MAP VIEW ================= */}
        {viewMode === "map" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Map Canvas */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-3 border border-slate-200 shadow-sm overflow-hidden">
              <InteractiveMap
                complaints={filteredComplaints}
                selectedComplaintId={selectedPinId || undefined}
                heightClass="h-[520px]"
                onSelectComplaint={(c) => setSelectedPinId(c.id)}
              />
            </div>

            {/* Sidebar Inspector Card */}
            <div className="space-y-4">
              {activeComplaint ? (
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      #{activeComplaint.id}
                    </span>
                    <button
                      onClick={() => setSelectedPinId(null)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {activeComplaint.imageUrl && (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200">
                      <img
                        src={activeComplaint.imageUrl}
                        alt={activeComplaint.title}
                        className="w-full h-36 object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <StatusBadge status={activeComplaint.status} size="sm" pulse={activeComplaint.status === "IN_PROGRESS"} />
                      <PriorityBadge priority={activeComplaint.priority} />
                    </div>
                    <h3 className="font-heading text-lg font-bold text-slate-900">
                      {activeComplaint.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {activeComplaint.description}
                    </p>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
                    <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                      <MapPin className="w-3.5 h-3.5 text-teal-600" />
                      <span>{activeComplaint.ward}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 pl-5">{activeComplaint.address}</p>
                    <p className="text-[11px] text-slate-600 pl-5">
                      Assigned: <strong>{activeComplaint.department}</strong>
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      onClick={() => onSelectComplaint(activeComplaint.id)}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>View Full Progress & Timeline</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {onReportAtCoords && (
                      <button
                        onClick={() =>
                          onReportAtCoords({
                            lat: activeComplaint.latitude,
                            lng: activeComplaint.longitude,
                            address: activeComplaint.address,
                            ward: activeComplaint.ward,
                          })
                        }
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2 rounded-xl transition-colors flex items-center justify-center gap-1"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Report Another Issue at this Location</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <h4 className="font-heading text-base font-bold text-slate-900">
                    Select a Marker
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Click any pin on the map to preview complaint status, field photos, and crew dispatch details.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= LIST VIEW ================= */}
        {viewMode === "list" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredComplaints.map((c) => (
              <div
                key={c.id}
                onClick={() => onSelectComplaint(c.id)}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:shadow-md hover:border-teal-300 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      #{c.id}
                    </span>
                    <StatusBadge status={c.status} size="sm" pulse={c.status === "IN_PROGRESS"} />
                  </div>

                  <h3 className="font-bold text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-1">
                    {c.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {c.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 truncate flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="truncate">{c.ward}</span>
                  </span>
                  <span className="text-teal-700 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 shrink-0">
                    <span>Track</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
