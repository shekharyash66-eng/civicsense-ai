import React, { useState } from 'react';
import { useCivic } from '../../context/CivicContext';
import { calculatePriority } from '../../services/priorityEngine';
import {
  ShieldAlert,
  Network,
  Calculator,
  MapPin,
  Clock,
  ArrowRight,
  Sparkles,
  FileCheck2,
  Users2,
  Building,
  AlertTriangle,
  Database,
  Inbox,
  CheckCircle2,
  Sliders,
  Layers,
  Activity,
  Flame,
  Droplets,
  Zap,
  Trash2,
  Car,
  ChevronRight,
  Play,
} from 'lucide-react';

interface LandingPageProps {
  setCurrentView: (view: string) => void;
}

const PRESET_SCENARIOS = [
  {
    label: 'Exposed Live Wire',
    title: 'Exposed live wire sparking on flooded pedestrian crosswalk',
    category: 'Broken Streetlights & Electrical',
    safety: 95,
    severity: 88,
    population: 80,
    time: 20,
    department: 'City Power & Electrical Authority',
    emergency: true,
  },
  {
    label: 'Deep Road Crater',
    title: '8-inch deep crater pothole near busy elementary school route',
    category: 'Potholes & Road Damage',
    safety: 75,
    severity: 70,
    population: 85,
    time: 45,
    department: 'Department of Public Works (Roads)',
    emergency: false,
  },
  {
    label: 'Burst Water Main',
    title: 'Sub-surface water pipe fracture flooding curb and sidewalk',
    category: 'Water Leakage & Drainage',
    safety: 65,
    severity: 80,
    population: 70,
    time: 30,
    department: 'Municipal Water & Sewerage Board',
    emergency: false,
  },
  {
    label: 'Flickering Lamp',
    title: 'Intermittent flickering streetlamp in quiet residential cul-de-sac',
    category: 'Broken Streetlights & Electrical',
    safety: 25,
    severity: 30,
    population: 20,
    time: 15,
    department: 'City Power & Electrical Authority',
    emergency: false,
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ setCurrentView }) => {
  const { complaints, incidents, departments, priorityWeights } = useCivic();

  // Live database counts strictly reflecting actual records
  const totalReports = complaints.length;
  const criticalCount = complaints.filter((c) => c.priority_level === 'Critical').length;
  const resolvedCount = complaints.filter((c) => c.status === 'Resolved').length;
  const confirmedIncidents = incidents.filter((i) => i.status === 'Confirmed').length;

  const firstIncident = incidents[0];
  const linkedReports = firstIncident
    ? complaints.filter((c) => firstIncident.related_complaint_ids.includes(c.id))
    : [];

  // Interactive Live Triage Sandbox State
  const [selectedScenario, setSelectedScenario] = useState(PRESET_SCENARIOS[0]);
  const [customQuery, setCustomQuery] = useState(PRESET_SCENARIOS[0].title);
  const [customSafety, setCustomSafety] = useState(PRESET_SCENARIOS[0].safety);
  const [customSeverity, setCustomSeverity] = useState(PRESET_SCENARIOS[0].severity);
  const [customPop, setCustomPop] = useState(PRESET_SCENARIOS[0].population);
  const [customTime, setCustomTime] = useState(PRESET_SCENARIOS[0].time);

  const calculatedSandbox = calculatePriority(
    customSafety,
    customSeverity,
    customPop,
    customTime,
    priorityWeights
  );

  const handleSelectScenario = (scenario: typeof PRESET_SCENARIOS[0]) => {
    setSelectedScenario(scenario);
    setCustomQuery(scenario.title);
    setCustomSafety(scenario.safety);
    setCustomSeverity(scenario.severity);
    setCustomPop(scenario.population);
    setCustomTime(scenario.time);
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen font-sans text-slate-800 dark:text-slate-100 transition-colors">
      {/* Hero Section with Architectural Grid */}
      <section className="relative overflow-hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 civic-grid">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 lg:pt-20 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column: Vision & Actions */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 dark:bg-teal-950/80 border border-teal-200/80 dark:border-teal-800 rounded-full text-xs font-semibold text-teal-800 dark:text-teal-300">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                <span>Next-Generation Civic Incident Intelligence</span>
              </div>

              <div className="space-y-3">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
                  CivicSense <span className="text-teal-700 dark:text-teal-400">AI</span>
                </h1>
                <p className="text-xl sm:text-2xl font-semibold text-slate-700 dark:text-slate-300">
                  Smarter Priorities. Safer Communities.
                </p>
              </div>

              <p className="text-base text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                Transforming citizen complaints into structured municipal intelligence. CivicSense AI automatically detects systemic hazard clusters, estimates risk severity, and computes explainable priority scores for swift municipal resolution.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => setCurrentView('report')}
                  className="px-6 py-3.5 text-sm font-semibold text-white bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 rounded-xl shadow-md transition-all flex items-center gap-2 hover:gap-3"
                >
                  <span>Report an Issue</span>
                  <ArrowRight className="w-4 h-4 text-teal-400 dark:text-white" />
                </button>

                <button
                  onClick={() => setCurrentView('admin-overview')}
                  className="px-6 py-3.5 text-sm font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl shadow-2xs transition-all flex items-center gap-2"
                >
                  <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Operations Console</span>
                </button>

                <button
                  onClick={() => setCurrentView('track')}
                  className="px-4 py-3.5 text-sm font-medium text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 transition-colors"
                >
                  Lookup Ticket ID →
                </button>
              </div>

              {/* Civic Categories Strip */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                  <Car className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> Roads & Potholes
                </span>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                  <Droplets className="w-3.5 h-3.5 text-teal-500" /> Water & Drainage
                </span>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                  <Zap className="w-3.5 h-3.5 text-amber-500" /> Power & Lighting
                </span>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                  <Trash2 className="w-3.5 h-3.5 text-emerald-500" /> Sanitation
                </span>
              </div>
            </div>

            {/* Right Column: Interactive Live Prioritization Sandbox */}
            <div className="lg:col-span-6">
              <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-2xl p-6 shadow-2xl border border-slate-800 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-teal-400">
                        Interactive Triage Sandbox
                      </h2>
                      <div className="text-[11px] text-slate-400">Test how the priority engine ranks civic hazards</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono bg-slate-800 text-teal-300 border border-slate-700 px-2.5 py-0.5 rounded">
                    Explainable AI
                  </span>
                </div>

                {/* Scenario Selector Chips */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-slate-400">Choose a real-world scenario to simulate:</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {PRESET_SCENARIOS.map((scenario) => (
                      <button
                        key={scenario.label}
                        onClick={() => handleSelectScenario(scenario)}
                        className={`p-2.5 text-left rounded-lg border transition-all ${
                          selectedScenario.label === scenario.label
                            ? 'bg-teal-950/60 border-teal-500/80 text-white'
                            : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="font-semibold text-xs flex items-center justify-between">
                          <span>{scenario.label}</span>
                          {scenario.emergency && (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {scenario.department.split('(')[0]}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scenario Description Preview */}
                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300 leading-relaxed">
                  <span className="text-teal-400 font-mono font-semibold mr-1.5">Report:</span>
                  &ldquo;{customQuery}&rdquo;
                </div>

                {/* Factor Breakdown Bars */}
                <div className="space-y-2.5 text-xs bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between font-semibold text-[11px] text-slate-400 uppercase tracking-wide">
                    <span>Evaluated Factors</span>
                    <span>Weighted Impact</span>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300">Safety Risk (40% Weight)</span>
                      <span className="font-mono text-red-400 font-semibold">{customSafety}/100</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${customSafety}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300">Issue Severity (25% Weight)</span>
                      <span className="font-mono text-orange-400 font-semibold">{customSeverity}/100</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-orange-500 h-full transition-all duration-300" style={{ width: `${customSeverity}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300">Population Impact (20% Weight)</span>
                      <span className="font-mono text-amber-400 font-semibold">{customPop}/100</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${customPop}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300">Time Unresolved (15% Weight)</span>
                      <span className="font-mono text-teal-400 font-semibold">{customTime}/100</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-teal-500 h-full transition-all duration-300" style={{ width: `${customTime}%` }} />
                    </div>
                  </div>
                </div>

                {/* Live Output Computed Card */}
                <div className="p-3.5 bg-teal-950/40 rounded-xl border border-teal-800/80 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] text-teal-300 font-medium">Computed Priority Rank:</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-base font-bold font-mono ${
                        calculatedSandbox.level === 'Critical' ? 'text-red-400' :
                        calculatedSandbox.level === 'High' ? 'text-orange-400' :
                        calculatedSandbox.level === 'Medium' ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {calculatedSandbox.level} Tier
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        (Score: {calculatedSandbox.score})
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setCurrentView('report')}
                    className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg font-bold text-xs transition-colors shadow flex items-center gap-1.5 shrink-0"
                  >
                    <span>File Similar Issue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Live Database Metrics Telemetry (Strictly from actual database records) */}
      <section className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Live Municipal Database Telemetry</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live metrics computed strictly from genuine records in the connected database.
              </p>
            </div>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-md flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Database Connected & Live</span>
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800/90 p-5 rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Logged Complaints</div>
              <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
                {totalReports}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Recorded submissions</div>
            </div>

            <div className="bg-white dark:bg-slate-800/90 p-5 rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Critical Triage Items</div>
              <div className="text-3xl font-extrabold font-mono text-red-600 dark:text-red-400 mt-1 tabular-nums">
                {criticalCount}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Requiring immediate human review</div>
            </div>

            <div className="bg-white dark:bg-slate-800/90 p-5 rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Correlated Incidents</div>
              <div className="text-3xl font-extrabold font-mono text-teal-600 dark:text-teal-400 mt-1 tabular-nums">
                {confirmedIncidents}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Confirmed multi-report clusters</div>
            </div>

            <div className="bg-white dark:bg-slate-800/90 p-5 rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Resolved Cases</div>
              <div className="text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {resolvedCount}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">With resolution audit trail</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Stage Civic Intelligence Architecture */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 border border-teal-200/80 dark:border-teal-800 px-2.5 py-0.5 rounded-full">
            <span>System Pipeline</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            How CivicSense AI Resolves Urban Problems
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            A transparent 4-stage lifecycle bridging citizen field observations to verified departmental closure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <div className="w-12 h-12 rounded-xl bg-slate-900 dark:bg-teal-950 text-teal-400 font-bold font-mono text-sm flex items-center justify-center border border-transparent dark:border-teal-800">
              01
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Field Capture & Geolocation</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Citizens submit photographic evidence, defect descriptions, and precise GPS coordinates with zero registration friction.
            </p>
            <div className="text-[11px] text-teal-700 dark:text-teal-400 font-medium pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1">
              <span>Browser Geolocation · Photo Support</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <div className="w-12 h-12 rounded-xl bg-slate-900 dark:bg-teal-950 text-teal-400 font-bold font-mono text-sm flex items-center justify-center border border-transparent dark:border-teal-800">
              02
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Gemini AI Triage & Risk</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Server-side Gemini AI models assess hazard severity, flags life-threatening emergencies (live wires, sinkholes), and estimates population impact.
            </p>
            <div className="text-[11px] text-teal-700 dark:text-teal-400 font-medium pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1">
              <span>Risk Scoring · Emergency Flags</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <div className="w-12 h-12 rounded-xl bg-slate-900 dark:bg-teal-950 text-teal-400 font-bold font-mono text-sm flex items-center justify-center border border-transparent dark:border-teal-800">
              03
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Incident Intelligence</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Synthesizes overlapping complaints across spatial proximity (&le;250m), temporal windows (&le;48h), and symptom overlap into root incidents.
            </p>
            <div className="text-[11px] text-teal-700 dark:text-teal-400 font-medium pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1">
              <span>Cluster Detection · Deduplication</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <div className="w-12 h-12 rounded-xl bg-slate-900 dark:bg-teal-950 text-teal-400 font-bold font-mono text-sm flex items-center justify-center border border-transparent dark:border-teal-800">
              04
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Work Orders & Verification</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Dispatches work orders directly to responsible municipal departments, enforces SLA deadlines, and facilitates dual field verification.
            </p>
            <div className="text-[11px] text-teal-700 dark:text-teal-400 font-medium pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1">
              <span>Department SLAs · Dual Sign-off</span>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison: Legacy Civic Systems vs CivicSense AI */}
      <section className="py-16 bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Why Traditional Civic Portals Fail
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Legacy grievance hotlines treat every ticket equally on a first-in-first-out queue, leaving critical safety hazards buried under routine requests.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Traditional */}
            <div className="p-6 rounded-2xl bg-rose-50/40 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 space-y-4 text-xs">
              <div className="flex items-center gap-2 text-rose-900 dark:text-rose-300 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Traditional Municipal Portals (Legacy FIFO)</span>
              </div>
              <ul className="space-y-3 text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-rose-600 dark:text-rose-400 font-bold font-mono">✕</span>
                  <span><strong>Blind Queue Order:</strong> Emergency gas leaks and live wires wait in the same line as minor cosmetic requests.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-600 dark:text-rose-400 font-bold font-mono">✕</span>
                  <span><strong>Duplicate Chaos:</strong> 30 citizens reporting the same broken water main generate 30 separate fragmented tickets.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-600 dark:text-rose-400 font-bold font-mono">✕</span>
                  <span><strong>Black Box Status:</strong> Citizens receive no explanation of why their issue was delayed or how it was triaged.</span>
                </li>
              </ul>
            </div>

            {/* CivicSense AI */}
            <div className="p-6 rounded-2xl bg-teal-50/40 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-900/60 space-y-4 text-xs">
              <div className="flex items-center gap-2 text-teal-950 dark:text-teal-200 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>CivicSense AI (Intelligence-First)</span>
              </div>
              <ul className="space-y-3 text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 dark:text-teal-400 font-bold font-mono">✓</span>
                  <span><strong>Explainable Risk Weights:</strong> Automatic prioritization based on human safety (40%), severity (25%), and population impact (20%).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 dark:text-teal-400 font-bold font-mono">✓</span>
                  <span><strong>Incident Clustering:</strong> Automatically aggregates related reports into unified incidents with single work-order dispatch.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 dark:text-teal-400 font-bold font-mono">✓</span>
                  <span><strong>Complete Accountability:</strong> Transparent public audit trails, departmental SLA tracking, and citizen verification.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Transparent Prioritization Formula Interactive Explorer */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            <Calculator className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>Transparent Governance</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Auditable Priority Scoring Math
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Civic priority is never a black box. Every complaint receives a score from 0 to 100 calculated from four configurable civic factors.
          </p>

          <div className="space-y-3 pt-2">
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-slate-900 dark:text-white">Safety Risk (40% Default)</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Hazard to life, collision danger, electrocution risk</div>
              </div>
              <span className="font-mono text-sm font-bold text-red-600 dark:text-red-400">0.40 × Risk</span>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-slate-900 dark:text-white">Issue Severity (25% Default)</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Structural deterioration, depth of crater, water volume</div>
              </div>
              <span className="font-mono text-sm font-bold text-orange-600 dark:text-orange-400">0.25 × Severity</span>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-slate-900 dark:text-white">Population Impact (20% Default)</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Transit corridors, hospital arterial routes, school zones</div>
              </div>
              <span className="font-mono text-sm font-bold text-amber-600 dark:text-amber-400">0.20 × Density</span>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-slate-900 dark:text-white">Time Unresolved (15% Default)</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Progressive score escalation as ticket approaches or passes SLA</div>
              </div>
              <span className="font-mono text-sm font-bold text-teal-600 dark:text-teal-400">0.15 × Time</span>
            </div>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-300 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 p-3.5 rounded-xl flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Safety Safeguard:</strong> Numerical scores never override emergency protocols.
              Life-threatening defects are flagged for immediate dispatch regardless of computed rank.
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-3">
              <div className="text-white font-bold text-base flex items-center gap-2">
                <span>CivicSense AI</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-xs">
                Smart Civic Issue Prioritizer and Complaint Intelligence Platform. Built for open, responsive municipal governance.
              </p>
            </div>
            <div>
              <div className="text-white font-semibold mb-2.5">Citizen Services</div>
              <ul className="space-y-2">
                <li><button onClick={() => setCurrentView('report')} className="hover:text-white transition-colors">Report a Problem</button></li>
                <li><button onClick={() => setCurrentView('track')} className="hover:text-white transition-colors">Track Complaint Status</button></li>
                <li><button onClick={() => setCurrentView('my-complaints')} className="hover:text-white transition-colors">My Filed Complaints</button></li>
              </ul>
            </div>
            <div>
              <div className="text-white font-semibold mb-2.5">Municipal Administration</div>
              <ul className="space-y-2">
                <li><button onClick={() => setCurrentView('admin-overview')} className="hover:text-white transition-colors">Command Dashboard</button></li>
                <li><button onClick={() => setCurrentView('admin-incidents')} className="hover:text-white transition-colors">Incident Intelligence</button></li>
                <li><button onClick={() => setCurrentView('map')} className="hover:text-white transition-colors">Interactive Civic Map</button></li>
                <li><button onClick={() => setCurrentView('admin-analytics')} className="hover:text-white transition-colors">Accountability & SLA Metrics</button></li>
              </ul>
            </div>
            <div>
              <div className="text-white font-semibold mb-2.5">System Infrastructure</div>
              <p className="text-slate-400 leading-relaxed mb-3">
                Full-stack Node/Express backend with live persistent JSON storage, Leaflet spatial mapping, and Gemini AI triage.
              </p>
              <div className="text-teal-400 font-mono flex items-center gap-1.5 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Persistent Database Active</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-slate-500">
            <div>CivicSense AI &copy; 2026. Smarter Priorities. Safer Communities.</div>
            <div className="mt-2 sm:mt-0 flex gap-4">
              <span>Connected Database</span>
              <span>&middot;</span>
              <span>Zero-Mock Architecture</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
