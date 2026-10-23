import React, { useState } from "react";
import { CivicPriorityScore, DuplicateMatch } from "../../types";
import {
  ShieldAlert,
  AlertTriangle,
  Users,
  Clock,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Layers
} from "lucide-react";

interface PriorityScoreDisplayProps {
  scoreData?: CivicPriorityScore;
  immediateHazard?: boolean;
  duplicateMatches?: DuplicateMatch[];
  compact?: boolean;
  onSelectDuplicate?: (complaintId: string) => void;
}

export const PriorityScoreDisplay: React.FC<PriorityScoreDisplayProps> = ({
  scoreData,
  immediateHazard,
  duplicateMatches,
  compact = false,
  onSelectDuplicate,
}) => {
  const [showFactorDetails, setShowFactorDetails] = useState(!compact);

  if (!scoreData) {
    return null;
  }

  const { score, band, factors, version, explanation } = scoreData;

  // Band styles
  const bandConfig = {
    Critical: {
      color: "text-rose-700 bg-rose-50 border-rose-200",
      barColor: "bg-rose-600",
      textColor: "text-rose-700",
      label: "Critical (80–100)",
    },
    High: {
      color: "text-amber-700 bg-amber-50 border-amber-200",
      barColor: "bg-amber-600",
      textColor: "text-amber-700",
      label: "High (60–79.9)",
    },
    Medium: {
      color: "text-teal-700 bg-teal-50 border-teal-200",
      barColor: "bg-teal-600",
      textColor: "text-teal-700",
      label: "Medium (35–59.9)",
    },
    Low: {
      color: "text-slate-600 bg-slate-100 border-slate-200",
      barColor: "bg-slate-500",
      textColor: "text-slate-600",
      label: "Low (0–34.9)",
    },
  }[band] || {
    color: "text-slate-700 bg-slate-100 border-slate-200",
    barColor: "bg-slate-500",
    textColor: "text-slate-700",
    label: band,
  };

  return (
    <div className="space-y-3">
      {/* Credible Immediate Safety Hazard Alert */}
      {(immediateHazard || factors.immediateHazardFlag) && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-900">
          <div className="p-1.5 bg-rose-100 rounded-lg text-rose-700 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-xs space-y-0.5">
            <div className="font-semibold text-rose-800">
              Immediate Safety Hazard Flagged
            </div>
            <p className="text-rose-700 leading-relaxed">
              Requires immediate human review and rapid safety triage. Priority score calculation does not delay emergency municipal dispatch.
            </p>
          </div>
        </div>
      )}

      {/* Main Score Card */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Civic Priority Score
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {version}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {score.toFixed(1)}
              </span>
              <span className="text-xs text-slate-500">/ 100</span>
              <span
                className={`ml-2 px-2.5 py-0.5 text-xs font-semibold rounded-md border ${bandConfig.color}`}
              >
                {band} Band
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowFactorDetails(!showFactorDetails)}
            className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <span>{showFactorDetails ? "Hide breakdown" : "View breakdown"}</span>
            {showFactorDetails ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Plain-Language Explanation */}
        <div className="p-3 bg-white border border-slate-200/80 rounded-xl">
          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-700 leading-relaxed font-normal">
              <span className="font-medium text-slate-900">Assessment: </span>
              {explanation}
            </p>
          </div>
        </div>

        {/* Detailed 4-Factor Breakdown */}
        {showFactorDetails && (
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Factor Breakdown (Deterministic Formula)
            </div>

            {/* Factor 1: Safety Risk (40%) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  Safety Risk (40% weight)
                </span>
                <span className="font-semibold text-slate-900">
                  {factors.safetyRisk} / 100
                  <span className="text-slate-400 font-normal ml-1 text-[11px]">
                    (+{(factors.safetyRisk * 0.4).toFixed(1)} pts)
                  </span>
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, factors.safetyRisk)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                {factors.safetyEvidence}
              </p>
            </div>

            {/* Factor 2: Issue Severity (25%) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Issue Severity (25% weight)
                </span>
                <span className="font-semibold text-slate-900">
                  {factors.severity} / 100
                  <span className="text-slate-400 font-normal ml-1 text-[11px]">
                    (+{(factors.severity * 0.25).toFixed(1)} pts)
                  </span>
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, factors.severity)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Rated from documented extent of operational failure or impairment.
              </p>
            </div>

            {/* Factor 3: Estimated Population Affected (20%) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  Estimated Population Affected (20% weight)
                </span>
                <span className="font-semibold text-slate-900">
                  {factors.affectedPopulation} / 100
                  <span className="text-slate-400 font-normal ml-1 text-[11px]">
                    (+{(factors.affectedPopulation * 0.2).toFixed(1)} pts)
                  </span>
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, factors.affectedPopulation)}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-500 leading-tight space-y-0.5">
                <p>{factors.populationEvidence}</p>
                {factors.isFallbackUsed && factors.uncertaintyNotes && (
                  <span className="text-[10px] text-amber-700 font-medium block">
                    ⚠️ {factors.uncertaintyNotes}
                  </span>
                )}
              </div>
            </div>

            {/* Factor 4: Time Unresolved (15%) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  Time Unresolved (15% weight)
                </span>
                <span className="font-semibold text-slate-900">
                  {factors.unresolvedTime} / 100
                  <span className="text-slate-400 font-normal ml-1 text-[11px]">
                    (+{(factors.unresolvedTime * 0.15).toFixed(1)} pts)
                  </span>
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, factors.unresolvedTime)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                {factors.unresolvedHours} hour(s) elapsed since submission. Older unresolved issues gain incremental SLA triage weight.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Duplicate Complaints Section if available */}
      {duplicateMatches && duplicateMatches.length > 0 && (
        <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-700" />
              <span className="text-xs font-semibold text-amber-900">
                Related Reports Detected ({duplicateMatches.length})
              </span>
            </div>
            <span className="text-[10px] text-amber-700 font-medium">
              Geographic & Domain Clustering
            </span>
          </div>

          <p className="text-[11px] text-amber-800 leading-relaxed">
            Potentially related complaints identified within 350m.
            <span className="text-amber-700/80 ml-1">
              (Note: Multiple reports corroborate community impact, but do not automatically prove an emergency without physical hazard evidence).
            </span>
          </p>

          <div className="space-y-1.5 mt-2">
            {duplicateMatches.map((m) => (
              <div
                key={m.complaintId}
                className="p-2.5 bg-white border border-amber-200 rounded-xl text-xs flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-900 truncate">
                      #{m.complaintId}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600 truncate">{m.title}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{m.distanceMeters}m away</span>
                    <span>·</span>
                    <span>{m.similarityScore}% match</span>
                    <span>·</span>
                    <span className="capitalize">{m.status.toLowerCase().replace("_", " ")}</span>
                  </div>
                </div>

                {onSelectDuplicate && (
                  <button
                    type="button"
                    onClick={() => onSelectDuplicate(m.complaintId)}
                    className="shrink-0 px-2.5 py-1 text-[11px] font-semibold text-teal-700 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <span>View</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
