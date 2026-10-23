import React from "react";
import {
  MapPin,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Search,
  CheckCircle2,
  Clock,
  Building2,
  Camera,
  Compass,
  Layers,
  Users,
  AlertCircle,
  HelpCircle,
  Eye,
  HeartHandshake
} from "lucide-react";

interface LandingPageProps {
  onNavigate: (route: string) => void;
  onTrackComplaintId?: (id: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, onTrackComplaintId }) => {
  const [trackInput, setTrackInput] = React.useState("");

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackInput.trim() && onTrackComplaintId) {
      onTrackComplaintId(trackInput.trim());
    } else {
      onNavigate("complaints");
    }
  };

  const workflowSteps = [
    {
      num: "01",
      title: "Capture",
      desc: "Snap a photo or describe in plain everyday words.",
      icon: Camera,
      color: "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800",
    },
    {
      num: "02",
      title: "AI Understands",
      desc: "Identifies category, urgency & structures the complaint.",
      icon: Sparkles,
      color: "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    },
    {
      num: "03",
      title: "Correct Department",
      desc: "Instantly routes to the specific municipal team.",
      icon: Building2,
      color: "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    },
    {
      num: "04",
      title: "Track",
      desc: "Real-time updates when crew dispatches.",
      icon: Clock,
      color: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    },
    {
      num: "05",
      title: "Resolved",
      desc: "Citizen verifies resolution and closes the issue.",
      icon: CheckCircle2,
      color: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    },
  ];

  const features = [
    {
      title: "AI Assisted",
      subtitle: "Describe naturally. Let AI structure.",
      description: "No confusing bureaucratic forms. Speak or type in simple language, and our AI formulates a structured, actionable municipal ticket.",
      icon: Sparkles,
      badge: "Gemini Powered",
    },
    {
      title: "Location Aware",
      subtitle: "Verified GPS & Pinpoint Map.",
      description: "Automatic device geolocation with interactive map pin verification ensures municipal crews find the exact pole or pothole without ambiguity.",
      icon: Compass,
      badge: "Precision GIS",
    },
    {
      title: "Smart Routing",
      subtitle: "Never guess which department.",
      description: "Eliminates ping-pong between municipal boards. Automatically directs electrical, water, waste, and road issues to the right field engineers.",
      icon: Building2,
      badge: "Zero Misdirection",
    },
    {
      title: "Transparent Tracking",
      subtitle: "Visible progress at every stage.",
      description: "Live stage updates, technician vehicle details, and estimated resolution timelines. Never wonder if your complaint was ignored.",
      icon: Layers,
      badge: "Real-time Sync",
    },
  ];

  const problemVsSolution = [
    {
      problem: "Citizens don't know which department handles which issue.",
      solution: "CivicFix AI classifies the issue and auto-suggests the exact municipal division.",
    },
    {
      problem: "Reports lack photos, exact coordinates, or severity context.",
      solution: "Interactive camera upload & GPS pin confirmation guarantee actionable field evidence.",
    },
    {
      problem: "Citizens have zero visibility after hitting submit.",
      solution: "Live vertical timeline tracks every change from dispatch to technician arrival.",
    },
    {
      problem: "Repeated follow-ups erode trust in civic services.",
      solution: "Citizens confirm actual on-site resolution before any ticket is formally closed.",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 bg-gradient-to-b from-slate-50 via-teal-50/25 to-white dark:from-slate-950 dark:via-teal-950/20 dark:to-slate-950 border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Tag badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-xs sm:text-sm font-semibold mb-6 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
            <span>AI + Maps + Status • Civic Technology</span>
          </div>

          {/* Main Hero Headline */}
          <h1 className="font-heading text-4xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 dark:text-white tracking-tight max-w-4xl mx-auto leading-[1.15]">
            Report civic issues.
            <br />
            <span className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 dark:from-teal-400 dark:via-emerald-400 dark:to-teal-500 bg-clip-text text-transparent">
              Track the fix. Together.
            </span>
          </h1>

          {/* Supporting text */}
          <p className="mt-6 text-base sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            A simpler way to report potholes, broken streetlights, overflowing waste, water leaks and other civic problems — with AI assistance, location evidence and transparent status updates.
          </p>

          {/* Action Button Row */}
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <button
              onClick={() => onNavigate("report")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-base px-8 py-3.5 rounded-2xl shadow-lg shadow-teal-600/20 hover:shadow-xl transition-all active:scale-95 cursor-pointer"
            >
              <span>Report an Issue</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate("complaints")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-semibold text-base px-6 py-3.5 rounded-2xl shadow-xs transition-colors"
            >
              <span>Track a Complaint</span>
            </button>
          </div>

          {/* Feature Statement Highlight */}
          <div className="mt-8 flex items-center justify-center gap-6 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300">
              <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Less confusion
            </span>
            <span className="flex items-center gap-1.5 text-indigo-800 dark:text-indigo-300">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Better evidence
            </span>
            <span className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Visible progress
            </span>
          </div>

          {/* Quick Track Input Pill */}
          <form
            onSubmit={handleTrackSubmit}
            className="mt-10 max-w-lg mx-auto bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 flex items-center gap-2"
          >
            <Search className="w-4 h-4 text-slate-400 ml-3 shrink-0" />
            <input
              type="text"
              placeholder="Enter Complaint ID (e.g. CF-1024 or CF-2026-0428)..."
              value={trackInput}
              onChange={(e) => setTrackInput(e.target.value)}
              className="w-full text-xs sm:text-sm bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 py-2"
            />
            <button
              type="submit"
              className="bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shrink-0 transition-colors"
            >
              Track
            </button>
          </form>
        </div>
      </section>

      {/* Visual Workflow Representation */}
      <section className="py-16 sm:py-20 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              How CivicFix Works
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
              From seeing a problem on your street to verifying its fix in five clean steps.
            </p>
          </div>

          {/* Step Cards with Connected Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 relative">
            {workflowSteps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className="bg-slate-50/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 relative hover:bg-white dark:hover:bg-slate-900 hover:shadow-md hover:border-teal-200 dark:hover:border-teal-700 transition-all group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                      {step.num}
                    </span>
                    <div className={`p-2 rounded-xl border ${step.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="font-heading text-base font-bold text-slate-900 dark:text-white mb-1">
                    {step.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4 Feature Cards */}
      <section className="py-16 sm:py-24 bg-slate-50/60 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs uppercase tracking-wider font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 px-3 py-1 rounded-full">
              Platform Architecture
            </span>
            <h2 className="mt-3 font-heading text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Designed for Speed & Clarity
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Eliminating the four structural friction points in municipal reporting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-7 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-teal-300 dark:hover:border-teal-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-100 dark:border-teal-800 text-teal-700 dark:text-teal-300 flex items-center justify-center shadow-2xs">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                        {feat.badge}
                      </span>
                    </div>
                    <h3 className="font-heading text-xl font-bold text-slate-900 dark:text-white">
                      {feat.title}
                    </h3>
                    <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 mt-0.5 mb-2">
                      {feat.subtitle}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Problem vs How CivicFix Solves It */}
      <section className="py-16 sm:py-24 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              The Problem & The Fix
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Why traditional municipal helplines fail, and how CivicFix changes the dynamic.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {problemVsSolution.map((item, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/40 dark:bg-slate-900/60 p-5 flex flex-col justify-between"
              >
                {/* Problem line */}
                <div className="pb-3 border-b border-slate-200/80 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded">
                    The Problem
                  </span>
                  <p className="mt-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {item.problem}
                  </p>
                </div>
                {/* Solution line */}
                <div className="pt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                    <CheckCircle2 className="w-3 h-3 text-teal-600 dark:text-teal-400" /> CivicFix Solution
                  </span>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                    {item.solution}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="font-heading text-3xl sm:text-5xl font-extrabold tracking-tight">
            Have something that needs fixing?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-xl mx-auto">
            Take a photo, confirm your location, and let our AI assist with the rest. No paperwork, no guesswork.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => onNavigate("report")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-extrabold text-base px-8 py-4 rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <span>Report It Now</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </button>
            <button
              onClick={() => onNavigate("map")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium text-base px-6 py-4 rounded-2xl backdrop-blur-md border border-white/10 transition-colors"
            >
              <MapPin className="w-4 h-4" />
              <span>Explore Ward Map</span>
            </button>
          </div>

          <p className="mt-6 text-xs text-slate-400">
            Citizen verification • Automated routing • Open accountability
          </p>
        </div>
      </section>
    </div>
  );
};
