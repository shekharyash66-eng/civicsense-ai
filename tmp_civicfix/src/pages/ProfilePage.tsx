import React, { useState } from "react";
import { User, Complaint, UserLocation } from "../types";
import { updateUserProfile } from "../services/complaintService";
import {
  formatDisplayLocation,
  formatAccuracy,
  formatLocationDate,
  isLocationStale,
} from "../services/locationService";
import { LocationPromptModal } from "../components/location/LocationPromptModal";
import { SupabaseConfigModal } from "../components/database/SupabaseConfigModal";
import { getSupabaseConfig, DEFAULT_SUPABASE_PROJECT_ID } from "../lib/supabaseClient";
import {
  User as UserIcon,
  MapPin,
  Phone,
  Mail,
  Award,
  CheckCircle2,
  Shield,
  Bell,
  Sparkles,
  Save,
  Check,
  Navigation,
  Edit3,
  RefreshCw,
  Clock,
  Compass,
  AlertTriangle,
  Trash2,
  Database,
  Cloud,
  Layers,
} from "lucide-react";

interface ProfilePageProps {
  currentUser: User;
  complaints: Complaint[];
  onUpdateUser: (user: User) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  currentUser,
  complaints,
  onUpdateUser,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState(currentUser.phone);
  const [ward, setWard] = useState(currentUser.ward || "");
  const [city, setCity] = useState(currentUser.location?.city || currentUser.city || "");
  const [state, setState] = useState(currentUser.location?.state || currentUser.state || "");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [locationRemovedSuccess, setLocationRemovedSuccess] = useState(false);

  // Location modal control
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"prompt" | "manual" | "detect">("detect");

  // Supabase modal control
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const supabaseConfig = getSupabaseConfig();

  // User complaints metrics
  const citizenComplaints = complaints.filter(
    (c) => c.citizenId === currentUser.id || c.citizenName === currentUser.name
  );
  const resolvedCount = citizenComplaints.filter(
    (c) => c.status === "RESOLVED" || c.status === "CLOSED"
  ).length;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = updateUserProfile({
      name,
      email,
      phone,
      ward,
      city,
      state,
      location: currentUser.location
        ? {
            ...currentUser.location,
            city: city.trim() || currentUser.location.city,
            state: state.trim() || currentUser.location.state,
            updatedAt: new Date().toISOString(),
          }
        : undefined,
    });
    onUpdateUser(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleLocationConfirmed = (newLoc: UserLocation) => {
    const updated = updateUserProfile({
      location: newLoc,
      city: newLoc.city || currentUser.city,
      state: newLoc.state || currentUser.state,
      ward: newLoc.neighborhood || newLoc.addressLine || currentUser.ward,
    });
    setCity(newLoc.city || "");
    setState(newLoc.state || "");
    if (newLoc.neighborhood) setWard(newLoc.neighborhood);
    onUpdateUser(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleRemoveLocation = () => {
    const updated = updateUserProfile({
      location: undefined,
      city: "",
      state: "",
      ward: "",
    });
    setCity("");
    setState("");
    setWard("");
    onUpdateUser(updated);
    setLocationRemovedSuccess(true);
    setTimeout(() => setLocationRemovedSuccess(false), 3500);
  };

  const hasLocation = Boolean(currentUser.location);
  const isGps = currentUser.location?.source === "GPS";
  const isStale = currentUser.location ? isLocationStale(currentUser.location.updatedAt) : false;

  const badges = [
    {
      title: "Active Neighbor",
      desc: "Reported 3+ verified local issues",
      earned: citizenComplaints.length >= 3,
      color: "bg-teal-50 text-teal-700 border-teal-200",
    },
    {
      title: "Community Fixer",
      desc: "Confirmed 2+ resolved civic fixes",
      earned: resolvedCount >= 2,
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      title: "GPS Precision",
      desc: isGps ? "Verified device GPS location active" : "Add GPS location to verify jurisdiction",
      earned: isGps,
      color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    },
    {
      title: "Civic Champion",
      desc: currentUser.location?.neighborhood
        ? `Top contributor in ${currentUser.location.neighborhood}`
        : currentUser.location?.city
        ? `Active steward in ${currentUser.location.city}`
        : "Active neighborhood civic steward",
      earned: true,
      color: "bg-amber-50 text-amber-700 border-amber-200",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20 pt-6 sm:pt-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Profile Card Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-6">
          <img
            src={
              currentUser.avatarUrl ||
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80"
            }
            alt={currentUser.name}
            className="w-24 h-24 rounded-3xl object-cover ring-4 ring-slate-100 shadow-md"
            referrerPolicy="no-referrer"
          />
          <div className="text-center sm:text-left flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900">
                {currentUser.name}
              </h1>
              <span className="text-xs uppercase font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                {currentUser.role === "admin" ? "Municipal Staff" : "Verified Citizen"}
              </span>
            </div>

            {/* Dynamic Location Title */}
            <div className="mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm text-slate-600">
              <span className="flex items-center gap-1 font-semibold text-slate-800">
                <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                <span>{formatDisplayLocation(currentUser.location)}</span>
              </span>

              {/* Status Pill */}
              {hasLocation ? (
                isGps ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-medium">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Location detected automatically ✓</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full font-medium">
                    <Edit3 className="w-3 h-3 text-slate-500" />
                    <span>Location entered manually</span>
                  </span>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setModalMode("prompt");
                    setIsLocationModalOpen(true);
                  }}
                  className="text-[11px] text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-0.5 rounded-full font-bold transition-colors cursor-pointer"
                >
                  + Set current location
                </button>
              )}
            </div>

            {/* Impact stats pill */}
            <div className="mt-4 flex items-center justify-center sm:justify-start gap-3 text-xs font-semibold text-slate-700">
              <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-teal-700 font-extrabold">{citizenComplaints.length}</span>{" "}
                Complaints
              </div>
              <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-emerald-700 font-extrabold">{resolvedCount}</span> Resolved
              </div>
            </div>
          </div>
        </div>

        {/* SECTION: FULL LOCATION & JURISDICTION DETAILS */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-heading text-lg font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-600" />
                <span>Current Location & Jurisdiction</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {hasLocation
                  ? isGps
                    ? "Detected automatically via device GPS coordinates"
                    : "Entered manually by citizen"
                  : "No location currently configured"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalMode("detect");
                  setIsLocationModalOpen(true);
                }}
                aria-label="Update current location"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Update Current Location</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalMode("manual");
                  setIsLocationModalOpen(true);
                }}
                aria-label="Change location manually"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Change Manually</span>
              </button>

              {hasLocation && (
                <button
                  type="button"
                  onClick={handleRemoveLocation}
                  aria-label="Remove current location from profile"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Location</span>
                </button>
              )}
            </div>
          </div>

          {/* Location Removed Banner */}
          {locationRemovedSuccess && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs font-semibold text-rose-800 animate-in fade-in">
              <Check className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Current location has been successfully removed from your profile.</span>
            </div>
          )}

          {/* Stale Location Notice */}
          {isStale && hasLocation && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Your location may be outdated. Would you like to refresh it?</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalMode("detect");
                  setIsLocationModalOpen(true);
                }}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] cursor-pointer"
              >
                Update Location
              </button>
            </div>
          )}

          {/* Detailed Address Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Current Location
              </span>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                <span>{formatDisplayLocation(currentUser.location)}</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {hasLocation ? (isGps ? "Detected automatically" : "Entered manually") : "Unset"}
              </span>
            </div>

            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 sm:col-span-2">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Address
              </span>
              <div className="text-xs sm:text-sm font-semibold text-slate-800 break-words">
                {currentUser.location?.formattedAddress ||
                  currentUser.location?.addressLine ||
                  "No detailed street address recorded"}
              </div>
            </div>

            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                City
              </span>
              <div className="text-sm font-bold text-slate-900">
                {currentUser.location?.city || currentUser.city || "Not available"}
              </div>
            </div>

            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                State
              </span>
              <div className="text-sm font-bold text-slate-900">
                {currentUser.location?.state || currentUser.state || "Not available"}
              </div>
            </div>

            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                PIN / Postal Code
              </span>
              <div className="text-sm font-bold text-slate-900">
                {currentUser.location?.postalCode || "Not available"}
              </div>
            </div>

            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Location Accuracy
              </span>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>
                  {isGps ? formatAccuracy(currentUser.location?.accuracy) : "Manual Entry (N/A)"}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 sm:col-span-2">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Last Updated
              </span>
              <div className="text-xs sm:text-sm font-medium text-slate-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{formatLocationDate(currentUser.location?.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Civic Badges Section */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xs space-y-4">
          <div>
            <h2 className="font-heading text-lg font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <span>Civic Achievements & Badges</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Badges awarded for active neighborhood stewardship and verified resolutions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {badges.map((b) => (
              <div
                key={b.title}
                className={`p-4 rounded-2xl border transition-all ${
                  b.earned ? b.color : "bg-slate-50 border-slate-200 opacity-50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Award className="w-4 h-4" />
                  {b.earned && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <h4 className="font-bold text-xs">{b.title}</h4>
                <p className="text-[11px] mt-0.5 leading-tight opacity-90">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION: SUPABASE DATABASE STORAGE INTEGRATION */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <h2 className="font-heading text-lg font-bold text-slate-900">
                  Supabase Cloud Database Storage
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider">
                  Configured
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Connected to project <code className="font-mono font-bold text-slate-700">{supabaseConfig.projectId || DEFAULT_SUPABASE_PROJECT_ID}</code>. All reports, photos, and timelines are securely saved in your database.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsSupabaseModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Manage Supabase Sync</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Project ID
              </span>
              <code className="font-mono font-bold text-slate-800 text-xs">
                {supabaseConfig.projectId || DEFAULT_SUPABASE_PROJECT_ID}
              </code>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Active Table
              </span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-teal-600" />
                <code>public.reports</code>
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Live Reports Saved
              </span>
              <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{complaints.length} Total Reports Synced</span>
              </span>
            </div>
          </div>
        </div>

        {/* Edit Profile Form */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="font-heading text-lg font-bold text-slate-900">
                Personal Information
              </h2>
              <p className="text-xs text-slate-500">
                Used to pre-fill complaint submissions and notify you of work progress.
              </p>
            </div>
            {savedSuccess && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1 animate-in fade-in">
                <Check className="w-3.5 h-3.5 stroke-[3]" /> Saved successfully
              </span>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:bg-white focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:bg-white focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:bg-white focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ward / Neighborhood Area
                </label>
                <input
                  type="text"
                  value={ward}
                  onChange={(e) => setWard(e.target.value)}
                  placeholder="e.g. Indiranagar, Ward 12, Hazratganj"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:bg-white focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Lucknow, Mumbai, Bengaluru"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:bg-white focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  State / Province
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Uttar Pradesh, Maharashtra, Karnataka"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:bg-white focus:border-teal-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-6 py-3 rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Save Profile Changes</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Location Detection / Confirmation Modal */}
      <LocationPromptModal
        isOpen={isLocationModalOpen}
        initialMode={modalMode}
        onClose={() => setIsLocationModalOpen(false)}
        onLocationConfirmed={handleLocationConfirmed}
        title={modalMode === "manual" ? "Edit Location Manually" : "Update Current Location"}
      />

      {/* Supabase Database Storage Modal */}
      <SupabaseConfigModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
      />
    </div>
  );
};
