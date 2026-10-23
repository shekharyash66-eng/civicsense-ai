import { PriorityLevel, PriorityWeights } from '../types/civic';

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  safety_risk: 40,
  severity: 25,
  population_impact: 20,
  time_unresolved: 15,
};

/**
 * Calculates the time unresolved score (0-100) based on hours elapsed since submission.
 */
export function calculateTimeUnresolvedScore(submittedAtIso: string, resolvedAtIso?: string): number {
  const submitTime = new Date(submittedAtIso).getTime();
  const endTime = resolvedAtIso ? new Date(resolvedAtIso).getTime() : Date.now();
  const hoursElapsed = Math.max(0, (endTime - submitTime) / (1000 * 60 * 60));

  if (hoursElapsed < 6) return 10;
  if (hoursElapsed < 24) return 25;
  if (hoursElapsed < 72) return 50; // 3 days
  if (hoursElapsed < 168) return 75; // 7 days
  if (hoursElapsed < 336) return 90; // 14 days
  return 100; // > 14 days
}

export function getPriorityLevel(score: number): PriorityLevel {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 35) return 'Medium';
  return 'Low';
}

export interface PriorityCalculationResult {
  score: number;
  level: PriorityLevel;
  safety_component: number;
  severity_component: number;
  population_component: number;
  time_component: number;
  explanation: string;
  factor_breakdown: {
    safety_risk: { raw: number; weighted: number; reason: string };
    severity: { raw: number; weighted: number; reason: string };
    population_impact: { raw: number; weighted: number; reason: string };
    time_unresolved: { raw: number; weighted: number; reason: string };
  };
}

export function calculatePriority(
  safetyRisk: number,
  severity: number,
  populationImpact: number,
  timeUnresolved: number,
  weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS
): PriorityCalculationResult {
  const clampedSafety = Math.max(0, Math.min(100, Math.round(safetyRisk)));
  const clampedSeverity = Math.max(0, Math.min(100, Math.round(severity)));
  const clampedPop = Math.max(0, Math.min(100, Math.round(populationImpact)));
  const clampedTime = Math.max(0, Math.min(100, Math.round(timeUnresolved)));

  const totalWeight = weights.safety_risk + weights.severity + weights.population_impact + weights.time_unresolved;
  const normW = totalWeight > 0 ? totalWeight : 100;

  const safetyComponent = (weights.safety_risk / normW) * clampedSafety;
  const severityComponent = (weights.severity / normW) * clampedSeverity;
  const popComponent = (weights.population_impact / normW) * clampedPop;
  const timeComponent = (weights.time_unresolved / normW) * clampedTime;

  const totalScore = Math.round((safetyComponent + severityComponent + popComponent + timeComponent) * 10) / 10;
  const boundedScore = Math.min(100, Math.max(0, totalScore));
  const level = getPriorityLevel(boundedScore);

  // Dynamic explanations based on actual values
  let safetyReason = 'Negligible physical risk to citizens or passing traffic.';
  if (clampedSafety >= 75) {
    safetyReason = 'High physical hazard: immediate potential for vehicular accidents, falls, or electrocution.';
  } else if (clampedSafety >= 45) {
    safetyReason = 'Moderate safety concern: requires caution for elderly, children, or night traffic.';
  }

  let severityReason = 'Minor surface inconvenience with minimal functional deterioration.';
  if (clampedSeverity >= 75) {
    severityReason = 'Severe physical structural damage or systemic disruption of civic services.';
  } else if (clampedSeverity >= 45) {
    severityReason = 'Moderate structural wear; worsening conditions likely without timely repair.';
  }

  let popReason = 'Localized impact affecting isolated individual property or quiet cul-de-sac.';
  if (clampedPop >= 70) {
    popReason = 'Major thoroughfare, public transit hub, hospital route, or dense market district.';
  } else if (clampedPop >= 40) {
    popReason = 'Neighborhood arterial street or community gathering zone with regular foot traffic.';
  }

  let timeReason = 'Recently submitted report within initial triage window.';
  if (clampedTime >= 75) {
    timeReason = 'Extended unresolved duration exceeding standard municipal turnaround SLA.';
  } else if (clampedTime >= 40) {
    timeReason = 'Open for several days without active departmental closure.';
  }

  // Summary explanation sentence
  const reasons: string[] = [];
  if (clampedSafety >= 60) reasons.push(`safety risk is rated at ${clampedSafety}/100`);
  if (clampedSeverity >= 60) reasons.push(`structural damage is severe (${clampedSeverity}/100)`);
  if (clampedPop >= 60) reasons.push(`impacts high-density civic zone (${clampedPop}/100)`);
  if (clampedTime >= 60) reasons.push(`has been pending resolution for over 3 days (${clampedTime}/100)`);

  let explanationSummary = `Priority score: ${boundedScore}/100 (${level}). `;
  if (reasons.length > 0) {
    explanationSummary += `The score is driven upward because ${reasons.join(', ')}.`;
  } else {
    explanationSummary += `The issue has modest baseline scores across safety (${clampedSafety}), severity (${clampedSeverity}), and public density (${clampedPop}).`;
  }

  return {
    score: boundedScore,
    level,
    safety_component: Math.round(safetyComponent * 10) / 10,
    severity_component: Math.round(severityComponent * 10) / 10,
    population_component: Math.round(popComponent * 10) / 10,
    time_component: Math.round(timeComponent * 10) / 10,
    explanation: explanationSummary,
    factor_breakdown: {
      safety_risk: { raw: clampedSafety, weighted: Math.round(safetyComponent * 10) / 10, reason: safetyReason },
      severity: { raw: clampedSeverity, weighted: Math.round(severityComponent * 10) / 10, reason: severityReason },
      population_impact: { raw: clampedPop, weighted: Math.round(popComponent * 10) / 10, reason: popReason },
      time_unresolved: { raw: clampedTime, weighted: Math.round(timeComponent * 10) / 10, reason: timeReason },
    },
  };
}

/**
 * Checks for explicit emergency keywords that require immediate human triage
 */
export function detectEmergencyHazard(text: string): { isEmergency: boolean; reason?: string } {
  const lower = text.toLowerCase();
  const emergencyPatterns = [
    { regex: /live wire|sparking wire|hanging electrical|electrocution|short circuit wire/, reason: 'Potential exposed live electrical wire hazard' },
    { regex: /sinkhole|crater collapse|road collapsed|bridge cracked|fissure/, reason: 'Imminent structural roadway collapse hazard' },
    { regex: /gas leak|chemical smell|toxic fume|sewer gas explosion/, reason: 'Suspected hazardous gas or chemical leak' },
    { regex: /flooding into homes|submerged electrical meter|rapid water rising/, reason: 'Hazardous water rise near electrical or occupied buildings' },
    { regex: /manhole open|missing manhole cover|uncovered pit on road/, reason: 'Uncovered deep manhole posing immediate pedestrian/vehicle danger' },
  ];

  for (const pattern of emergencyPatterns) {
    if (pattern.regex.test(lower)) {
      return { isEmergency: true, reason: pattern.reason };
    }
  }

  return { isEmergency: false };
}
