import React, { useState } from 'react';
import { useCivic } from '../../context/CivicContext';
import { CivicCategory } from '../../types/civic';
import { analyzeComplaintWithAI } from '../../services/aiService';
import { PriorityIndicator } from '../common/StatusBadge';
import {
  Camera,
  MapPin,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Loader2,
  Navigation,
  FileImage,
  Info,
  Zap,
  Droplets,
  Car,
  Trash2,
  HelpCircle,
} from 'lucide-react';

const CATEGORIES: CivicCategory[] = [
  'Potholes & Road Damage',
  'Garbage & Sanitation',
  'Water Leakage & Drainage',
  'Broken Streetlights & Electrical',
  'Public Infrastructure Damage',
  'Pedestrian & Traffic Safety',
  'Other Civic Issues',
];

const PRESETS = [
  {
    label: 'Road Crater',
    title: 'Deep 8-inch road pothole causing vehicular damage near transit stop',
    description: 'A deep pothole has opened up along the central lane of Grand Avenue. Multiple cars have suffered rim damage, and cyclists are swerving dangerously into oncoming traffic.',
    category: 'Potholes & Road Damage' as CivicCategory,
    location: '840 Grand Avenue, near 5th St intersection',
    lat: 37.7749,
    lng: -122.4194,
  },
  {
    label: 'Burst Water Pipe',
    title: 'Severe municipal water pipe burst flooding roadway and sidewalk',
    description: 'Clean drinking water is gushing out of an underground distribution pipe fracture, submerging the sidewalk and creating a 2-inch deep waterlogging zone across two vehicle lanes.',
    category: 'Water Leakage & Drainage' as CivicCategory,
    location: '1220 Market Street, outside public library',
    lat: 37.7785,
    lng: -122.4150,
  },
  {
    label: 'Live Wire Hazard',
    title: 'Exposed live electrical power cable sparking against metallic street pole',
    description: 'A severe storm has knocked down an overhead secondary electrical wire. It is visibly sparking against a pedestrian light pole on the public sidewalk, creating an imminent life-safety hazard.',
    category: 'Broken Streetlights & Electrical' as CivicCategory,
    location: '415 Mission Street, sidewalk corridor',
    lat: 37.7900,
    lng: -122.3980,
  },
  {
    label: 'Garbage Overflow',
    title: 'Commercial waste accumulation overflowing across pedestrian promenade',
    description: 'Several communal dumpsters have remained uncollected for 5 days. Foul odors and scattered waste are blocking the pedestrian walkway and attracting rodents.',
    category: 'Garbage & Sanitation' as CivicCategory,
    location: '280 Columbus Avenue, North Beach walkway',
    lat: 37.7980,
    lng: -122.4070,
  },
];

interface ComplaintFormProps {
  setCurrentView: (view: string) => void;
  setSelectedComplaintId?: (id: string) => void;
}

export const ComplaintForm: React.FC<ComplaintFormProps> = ({ setCurrentView, setSelectedComplaintId }) => {
  const { submitComplaint, currentUser } = useCivic();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CivicCategory>('Potholes & Road Damage');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Reporter info pre-filled from authenticated user profile
  const [reporterName, setReporterName] = useState(currentUser?.full_name || '');
  const [reporterEmail, setReporterEmail] = useState(currentUser?.email || '');
  const [reporterPhone, setReporterPhone] = useState(currentUser?.phone || '');

  React.useEffect(() => {
    if (currentUser) {
      if (!reporterName) setReporterName(currentUser.full_name);
      if (!reporterEmail) setReporterEmail(currentUser.email);
      if (currentUser.phone && !reporterPhone) setReporterPhone(currentUser.phone);
    }
  }, [currentUser]);

  // AI state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedComplaint, setSubmittedComplaint] = useState<any | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleApplyPreset = (p: typeof PRESETS[0]) => {
    setTitle(p.title);
    setDescription(p.description);
    setCategory(p.category);
    setLocationName(p.location);
    setLatitude(p.lat);
    setLongitude(p.lng);
    setErrorMsg('');
  };

  // Handle image upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Please upload a valid image file (JPEG, PNG, WebP).');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('Image size must be less than 5MB.');
        return;
      }
      setErrorMsg('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Browser Geolocation
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }
    setLocatingUser(true);
    setErrorMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        if (!locationName) {
          setLocationName(`GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        }
        setLocatingUser(false);
      },
      (err) => {
        setLocatingUser(false);
        setErrorMsg('Unable to retrieve your location. Please enter your street address manually.');
      },
      { timeout: 8000 }
    );
  };

  // Run AI analysis
  const handleRunAIAnalysis = async () => {
    if (!title.trim() || !description.trim()) {
      setErrorMsg('Please enter a title and description before requesting AI triage.');
      return;
    }
    setErrorMsg('');
    setIsAnalyzing(true);
    try {
      const result = await analyzeComplaintWithAI({
        title,
        description,
        category,
        location: locationName,
        imageBase64: imagePreview || undefined,
      });
      setAiResult(result);
      if (result.category && CATEGORIES.includes(result.category)) {
        setCategory(result.category);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Submit Complaint
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please provide an issue title.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Please provide a detailed description.');
      return;
    }
    if (!locationName.trim()) {
      setErrorMsg('Please provide a location or street landmark.');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      // If AI hasn't run yet, run it in background for classification
      let currentAi = aiResult;
      if (!currentAi) {
        currentAi = await analyzeComplaintWithAI({
          title,
          description,
          category,
          location: locationName,
          imageBase64: imagePreview || undefined,
        });
      }

      const safetyScore = currentAi.safety_risk_score ?? 40;
      const severityScore = currentAi.severity_score ?? 40;
      const popScore = currentAi.affected_population_score ?? 50;

      const created = await submitComplaint({
        title,
        description,
        category,
        location_name: locationName,
        latitude,
        longitude,
        image_url: imagePreview || undefined,
        safety_risk_score: safetyScore,
        severity_score: severityScore,
        population_impact_score: popScore,
        is_emergency_flagged: !!currentAi.possible_emergency,
        assigned_department_id: null,
        related_incident_id: null,
        ai_analysis: currentAi,
        reporter_name: reporterName.trim() || 'Citizen Reporter',
        reporter_email: reporterEmail.trim() || undefined,
        reporter_phone: reporterPhone.trim() || undefined,
      });

      setSubmittedComplaint(created);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit complaint. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUCCESS SCREEN
  if (submittedComplaint) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-slate-900 dark:text-white">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-8 space-y-6 text-center">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Complaint Successfully Filed
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
              Your report has been persisted in the municipal database and dispatched to the triage queue.
            </p>
          </div>

          {/* Ticket ID Box */}
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-5 text-left space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Complaint Reference ID:</span>
              <span className="font-mono text-xl font-extrabold text-teal-700 dark:text-teal-400">
                {submittedComplaint.id}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 dark:text-slate-500">Category:</span>
                <div className="font-medium text-slate-800 dark:text-slate-200">{submittedComplaint.category}</div>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500">Computed Priority:</span>
                <div className="mt-0.5">
                  <PriorityIndicator
                    level={submittedComplaint.priority_level}
                    score={submittedComplaint.priority_score}
                  />
                </div>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500">Location:</span>
                <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{submittedComplaint.location_name}</div>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500">Current Status:</span>
                <div className="font-medium text-slate-800 dark:text-slate-200">{submittedComplaint.status}</div>
              </div>
            </div>

            {submittedComplaint.is_emergency_flagged && (
              <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/80 p-2.5 rounded-lg text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                <span>
                  <strong>Urgent Review Flagged:</strong> High safety hazard detected. Forwarded for priority dispatch.
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => {
                if (setSelectedComplaintId) {
                  setSelectedComplaintId(submittedComplaint.id);
                }
                setCurrentView('track');
              }}
              className="flex-1 py-3 px-4 bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 text-white rounded-xl text-xs font-semibold shadow transition-all flex items-center justify-center gap-2"
            >
              <span>Track this Complaint</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setSubmittedComplaint(null);
                setTitle('');
                setDescription('');
                setLocationName('');
                setAiResult(null);
                setImagePreview(null);
              }}
              className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            >
              Submit Another Report
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6 text-slate-900 dark:text-white">
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 px-2.5 py-0.5 rounded-full mb-1">
          <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>Citizen Telemetry Portal</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Report a Civic Problem
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Report road craters, water leaks, electrical hazards, or public sanitation defects directly to municipal dispatch.
        </p>
      </div>

      {/* Quick Fill Scenarios for immediate testing */}
      <div className="bg-slate-100/80 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 text-xs space-y-2">
        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>Quick Preset Scenarios (Click to autofill authentic defect report):</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleApplyPreset(p)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/60 hover:text-teal-900 dark:hover:text-teal-200 hover:border-teal-300 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 text-xs font-medium transition-all shadow-2xs"
            >
              + {p.label}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/80 text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
            Issue Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Deep crater pothole near 5th Street crosswalk"
            className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Description & AI Trigger */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
              Detailed Description <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={handleRunAIAnalysis}
              disabled={isAnalyzing || !description.trim()}
              className="text-xs text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600 dark:text-teal-400" />
                  <span>Scanning with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Test AI Triage Classification</span>
                </>
              )}
            </button>
          </div>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the physical defect, approximate depth/size, traffic danger, or any visible safety hazards..."
            className="w-full text-sm p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 leading-relaxed"
          />
        </div>

        {/* AI Insight Box (if generated) */}
        {aiResult && (
          <div className="p-4 rounded-xl bg-teal-50/70 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-900 dark:text-teal-200">
                <Sparkles className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                <span>CivicSense AI Recommendation (Estimate)</span>
              </div>
              <span className="text-xs text-teal-800 dark:text-teal-300 font-medium">
                Safety Score: <strong className="font-mono">{aiResult.safety_risk_score}/100</strong>
              </span>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{aiResult.summary}</p>

            {aiResult.possible_emergency && (
              <div className="p-2.5 bg-red-100 dark:bg-red-950/70 border border-red-300 dark:border-red-800 rounded-lg text-xs text-red-900 dark:text-red-200 font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0" />
                <span>Potential Emergency Flagged: Will be routed directly to priority supervisor dispatch.</span>
              </div>
            )}

            <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-teal-200/60 dark:border-teal-800/60">
              <span><strong>Suggested Department:</strong> {aiResult.suggested_department}</span>
              <span><strong>Suggested Category:</strong> {aiResult.category}</span>
            </div>
          </div>
        )}

        {/* Category & Photo Upload */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Civic Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CivicCategory)}
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
              Photograph / Evidence (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="block w-full text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:py-2.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-slate-700 cursor-pointer"
            />
          </div>
        </div>

        {/* Photo Preview if uploaded */}
        {imagePreview && (
          <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 max-w-sm">
            <img
              src={imagePreview}
              alt="Uploaded evidence preview"
              className="w-full h-44 object-cover"
            />
            <button
              type="button"
              onClick={() => setImagePreview(null)}
              className="absolute top-2 right-2 bg-black/75 hover:bg-black text-white text-xs px-2.5 py-1 rounded-md"
            >
              Remove Photo
            </button>
          </div>
        )}

        {/* Location & GPS */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
              Location / Landmark Address <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={locatingUser}
              className="text-xs text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 font-semibold flex items-center gap-1 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>{locatingUser ? 'Acquiring GPS...' : 'Use Current Device GPS'}</span>
            </button>
          </div>
          <div className="relative">
            <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              required
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. 850 Grand Avenue, near 5th St junction"
              className="w-full text-sm pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          {latitude && longitude && (
            <div className="text-[11px] text-teal-700 dark:text-teal-400 mt-1.5 flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Verified Coordinates: {latitude.toFixed(5)}, {longitude.toFixed(5)}</span>
            </div>
          )}
        </div>

        {/* Optional Contact Details */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-3">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span>Optional Reporter Details (For Progress Notifications)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Your Name</label>
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Citizen Reporter"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Email</label>
              <input
                type="email"
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Phone</label>
              <input
                type="tel"
                value={reporterPhone}
                onChange={(e) => setReporterPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Submit Action */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 text-white rounded-xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-teal-400 dark:text-white" />
                <span>Classifying & Persisting to Database...</span>
              </>
            ) : (
              <>
                <span>Submit Civic Complaint</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
