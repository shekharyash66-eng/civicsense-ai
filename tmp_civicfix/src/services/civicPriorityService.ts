import {
  Complaint,
  CivicPriorityBand,
  CivicPriorityBreakdown,
  CivicPriorityScore,
  IssueCategory,
} from "../types";

export const PRIORITY_CONFIG = {
  version: "v1.0",
  weights: {
    safetyRisk: 0.4,
    severity: 0.25,
    affectedPopulation: 0.2,
    unresolvedTime: 0.15,
  },
  bands: {
    criticalMin: 80,
    highMin: 60,
    mediumMin: 35,
    lowMin: 0,
  },
  // Time unresolved scaling: 0 hrs -> 0 pts, 24 hrs -> 30 pts, 72 hrs (3d) -> 60 pts, 168 hrs (7d) -> 85 pts, 336+ hrs (14d) -> 100 pts
  maxUnresolvedHoursForMaxScore: 336, // 14 days
};

export interface PriorityCalculationInput {
  category: IssueCategory;
  title: string;
  description: string;
  priority?: "low" | "medium" | "high" | "urgent";
  address?: string;
  ward?: string;
  city?: string;
  createdAt: string;
  resolvedAt?: string;
  status?: string;
}

/**
 * Evaluates credible immediate safety hazards requiring urgent human review.
 * NOTE: The priority score must never delay emergency handling or immediate triage.
 */
export function checkImmediateSafetyHazard(
  category: IssueCategory,
  title: string,
  description: string
): { isHazard: boolean; reason: string | null } {
  const combined = `${title} ${description}`.toLowerCase();

  const highThreatPatterns = [
    { pattern: /(live|sparking|exposed|dangling)\s*(wire|cable|electric)/i, reason: "Live/exposed electrical current with electrocution risk" },
    { pattern: /(open|missing)\s*(manhole|drain\s*cover|gutter\s*cover)/i, reason: "Open manhole/uncovered drain pit in path of travel" },
    { pattern: /(gas|chemical|toxic|flammable)\s*(leak|fume|smell|burst)/i, reason: "Potential toxic or flammable gas/chemical leak" },
    { pattern: /(sinkhole|road\s*collapse|bridge\s*collapse|structural\s*collapse)/i, reason: "Active structural ground collapse / sinkhole" },
    { pattern: /(traffic\s*light|signal)\s*(broken|dead|out).*major\s*(junction|intersection|highway)/i, reason: "Uncontrolled intersection signal failure on major transit corridor" },
    { pattern: /(deep\s*crater|massive\s*pothole).*speed/i, reason: "High-speed road crater likely to cause catastrophic vehicle rollover" },
  ];

  for (const { pattern, reason } of highThreatPatterns) {
    if (pattern.test(combined)) {
      return { isHazard: true, reason };
    }
  }

  return { isHazard: false, reason: null };
}

/**
 * Calculates deterministic Safety Risk factor (0-100).
 * 40% weight in overall Civic Priority Score.
 */
function calculateSafetyRisk(
  category: IssueCategory,
  title: string,
  description: string,
  priority?: string
): { score: number; evidence: string; immediateHazard: boolean } {
  const combined = `${title} ${description}`.toLowerCase();
  const hazardCheck = checkImmediateSafetyHazard(category, title, description);

  // Category baseline safety risk
  let baseScore = 30;
  let categoryNote = "Standard civic infrastructure maintenance";

  switch (category) {
    case "traffic_signal":
      baseScore = 75;
      categoryNote = "Traffic control failure directly elevates vehicular collision risk";
      break;
    case "pothole":
    case "road_damage":
      baseScore = 65;
      categoryNote = "Pavement surface defect impacts two-wheeler & vehicular stability";
      break;
    case "streetlight":
      baseScore = 55;
      categoryNote = "Nighttime illumination outage impacts pedestrian security & visibility";
      break;
    case "drainage":
      baseScore = 50;
      categoryNote = "Drainage overflow risks water stagnation & vector-borne public health hazards";
      break;
    case "water_leakage":
      baseScore = 45;
      categoryNote = "Potable or pressurized water surge causes pavement erosion & resource loss";
      break;
    case "illegal_dumping":
    case "garbage":
      baseScore = 40;
      categoryNote = "Solid waste accumulation poses sanitary & microbial public health risks";
      break;
    case "stray_animal":
      baseScore = 45;
      categoryNote = "Aggressive or distressed stray presence can trigger bite or traffic accidents";
      break;
    case "public_toilet":
      baseScore = 35;
      categoryNote = "Sanitary facility defect affecting community sanitation access";
      break;
    default:
      baseScore = 30;
      categoryNote = "General non-critical municipal service inquiry";
      break;
  }

  let adjustment = 0;
  const modifierNotes: string[] = [];

  // Keyword modifiers based on reported evidence
  if (hazardCheck.isHazard) {
    adjustment += 35;
    modifierNotes.push(`Immediate safety hazard flagged: ${hazardCheck.reason}`);
  } else if (/accident|collision|skid|injured|injury|fell|blood|hospital/i.test(combined)) {
    adjustment += 25;
    modifierNotes.push("Documented incidents/injuries reported");
  } else if (/danger|dangerous|hazard|peril|blind\s*spot/i.test(combined)) {
    adjustment += 15;
    modifierNotes.push("Heightened physical hazard characteristics noted");
  }

  if (/dark|night|pitch\s*black|evening/i.test(combined) && category === "streetlight") {
    adjustment += 15;
    modifierNotes.push("Complete darkness at night reported");
  }

  if (/deep|huge|massive|sharp|large|crater/i.test(combined)) {
    adjustment += 10;
    modifierNotes.push("Significant physical dimension documented");
  }

  if (priority === "urgent") adjustment += 10;
  else if (priority === "high") adjustment += 5;
  else if (priority === "low") adjustment -= 10;

  const finalScore = Math.min(100, Math.max(5, baseScore + adjustment));

  const evidence = modifierNotes.length > 0
    ? `${categoryNote}. Evidence: ${modifierNotes.join("; ")}.`
    : `${categoryNote}. Baseline assessment from category characteristics.`;

  return {
    score: Math.round(finalScore),
    evidence,
    immediateHazard: hazardCheck.isHazard,
  };
}

/**
 * Calculates deterministic Issue Severity factor (0-100).
 * 25% weight in overall Civic Priority Score.
 */
function calculateSeverity(
  category: IssueCategory,
  title: string,
  description: string,
  priority?: string
): { score: number; evidence: string } {
  const combined = `${title} ${description}`.toLowerCase();

  let baseSeverity = 40;
  if (priority === "urgent") baseSeverity = 85;
  else if (priority === "high") baseSeverity = 70;
  else if (priority === "medium") baseSeverity = 50;
  else if (priority === "low") baseSeverity = 25;

  let adjustment = 0;
  const reasons: string[] = [];

  if (/completely\s*off|totally\s*broken|shattered|collapsed|unusable|destroyed|burst/i.test(combined)) {
    adjustment += 20;
    reasons.push("Total operational failure reported");
  } else if (/intermittent|flicker|partial|slow|minor|small|slight/i.test(combined)) {
    adjustment -= 15;
    reasons.push("Partial or intermittent dysfunction noted");
  }

  if (/overflowing|spilling|flooding|submerged|blocking\s*entire/i.test(combined)) {
    adjustment += 15;
    reasons.push("Active overflow or full transit obstruction");
  }

  const finalScore = Math.min(100, Math.max(10, baseSeverity + adjustment));
  const evidence = reasons.length > 0
    ? `Rated from documented dysfunction extent: ${reasons.join(", ")} (Priority tier: ${priority || "medium"}).`
    : `Standard severity baseline based on ${priority || "medium"} priority classification.`;

  return {
    score: Math.round(finalScore),
    evidence,
  };
}

/**
 * Calculates deterministic Estimated Population Affected factor (0-100).
 * 20% weight in overall Civic Priority Score.
 * Note: Clearly labels estimates and documented fallbacks without inventing raw headcount.
 */
function calculateAffectedPopulation(
  address = "",
  ward = "",
  title = "",
  description = ""
): { score: number; evidence: string; isFallbackUsed: boolean; uncertaintyNotes?: string } {
  const combined = `${address} ${ward} ${title} ${description}`.toLowerCase();

  // Transit hubs, commercial thoroughfares, high-traffic corridors
  const highDensityKeywords = [
    "metro", "railway", "station", "bus\s*stand", "bus\s*stop",
    "market", "bazaar", "mall", "hospital", "school", "college",
    "main\s*road", "arterial", "highway", "junction", "crossroad",
    "pedestrian\s*walkway", "indiranagar", "koramangala", "connaught\s*place",
    "central", "expressway", "ring\s*road"
  ];

  // Secondary residential streets or neighborhood lanes
  const mediumDensityKeywords = [
    "lane", "cross", "colony", "residential", "layout", "nagar",
    "sector", "block", "apartment", "society", "ward", "enclave"
  ];

  // Isolated/low-density zones
  const lowDensityKeywords = [
    "dead\s*end", "cul-de-sac", "vacant", "service\s*lane", "back\s*alley",
    "perimeter", "rural", "outer\s*bypass"
  ];

  for (const kw of highDensityKeywords) {
    if (new RegExp(kw, "i").test(combined)) {
      return {
        score: 85,
        evidence: `High community density estimated from location context (${kw.replace(/\\s\*/g, " ")}) along a primary pedestrian/traffic corridor.`,
        isFallbackUsed: false,
      };
    }
  }

  for (const kw of mediumDensityKeywords) {
    if (new RegExp(kw, "i").test(combined)) {
      return {
        score: 55,
        evidence: `Moderate density estimated from neighborhood residential zone context (${kw.replace(/\\s\*/g, " ")}).`,
        isFallbackUsed: false,
      };
    }
  }

  for (const kw of lowDensityKeywords) {
    if (new RegExp(kw, "i").test(combined)) {
      return {
        score: 25,
        evidence: `Low localized density indicated by secondary access or cul-de-sac location context.`,
        isFallbackUsed: false,
      };
    }
  }

  // Fallback when address/ward provides limited density context
  if (address.trim().length > 3) {
    return {
      score: 45,
      evidence: `Estimated standard urban density for "${address.split(",")[0] || "reported ward"}". (Estimate labeled: conservative urban baseline).`,
      isFallbackUsed: true,
      uncertaintyNotes: "Specific pedestrian/traffic flow counts unavailable; standard ward density baseline applied.",
    };
  }

  // Documented conservative fallback
  return {
    score: 35,
    evidence: "Conservative municipal baseline applied due to limited localized transit data.",
    isFallbackUsed: true,
    uncertaintyNotes: "No precise street address or transit landmark detected; conservative default of 35/100 utilized.",
  };
}

/**
 * Calculates deterministic Time Unresolved factor (0-100).
 * 15% weight in overall Civic Priority Score.
 */
function calculateTimeUnresolved(
  createdAt: string,
  resolvedAt?: string,
  status?: string
): { score: number; unresolvedHours: number; evidence: string } {
  const createdDate = new Date(createdAt);
  const effectiveEnd = (status === "RESOLVED" || status === "CLOSED") && resolvedAt
    ? new Date(resolvedAt)
    : new Date();

  const diffMs = Math.max(0, effectiveEnd.getTime() - createdDate.getTime());
  const hours = Math.round(diffMs / (1000 * 60 * 60));

  // Deterministic non-linear curve:
  // 0-6 hrs: 5 - 15 pts (fresh report)
  // 24 hrs (1 day): 30 pts
  // 48 hrs (2 days): 48 pts
  // 72 hrs (3 days): 60 pts
  // 120 hrs (5 days): 75 pts
  // 168 hrs (7 days): 85 pts
  // 336+ hrs (14+ days): 100 pts (maximum SLA breach urgency)
  let score = 0;
  if (hours <= 6) {
    score = 5 + (hours / 6) * 10;
  } else if (hours <= 24) {
    score = 15 + ((hours - 6) / 18) * 15;
  } else if (hours <= 72) {
    score = 30 + ((hours - 24) / 48) * 30;
  } else if (hours <= 168) {
    score = 60 + ((hours - 72) / 96) * 25;
  } else {
    score = Math.min(100, 85 + ((hours - 168) / 168) * 15);
  }

  const roundedScore = Math.round(score);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const timeLabel = days > 0
    ? `${days}d ${remainingHours}h`
    : `${hours} hours`;

  const statusLabel = (status === "RESOLVED" || status === "CLOSED")
    ? `Resolved after ${timeLabel}`
    : `Pending for ${timeLabel}`;

  return {
    score: roundedScore,
    unresolvedHours: hours,
    evidence: `${statusLabel} (${roundedScore}/100 SLA aging pressure).`,
  };
}

/**
 * Maps a numeric score (0-100) to standard initial bands:
 * - 80–100: Critical
 * - 60–79.99: High
 * - 35–59.99: Medium
 * - 0–34.99: Low
 */
export function getPriorityBand(score: number): CivicPriorityBand {
  if (score >= PRIORITY_CONFIG.bands.criticalMin) return "Critical";
  if (score >= PRIORITY_CONFIG.bands.highMin) return "High";
  if (score >= PRIORITY_CONFIG.bands.mediumMin) return "Medium";
  return "Low";
}

/**
 * Builds clear, plain-language explanation for why this score was assigned.
 */
function generatePriorityExplanation(
  band: CivicPriorityBand,
  safety: { score: number; immediateHazard: boolean; evidence: string },
  severity: { score: number },
  population: { score: number },
  unresolved: { score: number; unresolvedHours: number }
): string {
  const parts: string[] = [];

  if (safety.immediateHazard) {
    parts.push("Urgent immediate hazard flagged requiring direct human oversight");
  } else if (safety.score >= 75) {
    parts.push("High safety risk to citizens");
  } else if (safety.score >= 50) {
    parts.push("Moderate safety concern");
  }

  if (population.score >= 75) {
    parts.push("high-traffic pedestrian/transit corridor impact");
  } else if (population.score >= 50) {
    parts.push("active neighborhood residential footprint");
  }

  if (severity.score >= 75) {
    parts.push("severe operational breakdown");
  }

  if (unresolved.unresolvedHours >= 72) {
    const days = Math.floor(unresolved.unresolvedHours / 24);
    parts.push(`exceeded initial turnaround SLA (${days} days unresolved)`);
  }

  if (parts.length === 0) {
    return `${band} priority municipal issue within standard maintenance tolerances.`;
  }

  const primary = parts.slice(0, 2).join(" combined with ");
  const secondary = parts.slice(2).join(", and ");

  return secondary
    ? `${capitalize(primary)}, and ${secondary}.`
    : `${capitalize(primary)}.`;
}

function capitalize(s: string) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Main Deterministic Calculation Function
 * Computes:
 * priorityScore = safetyRisk * 0.40 + severity * 0.25 + affectedPopulation * 0.20 + unresolvedTime * 0.15
 */
export function calculateCivicPriorityScore(
  input: PriorityCalculationInput
): CivicPriorityScore {
  const safety = calculateSafetyRisk(
    input.category,
    input.title,
    input.description,
    input.priority
  );

  const severity = calculateSeverity(
    input.category,
    input.title,
    input.description,
    input.priority
  );

  const population = calculateAffectedPopulation(
    input.address,
    input.ward,
    input.title,
    input.description
  );

  const unresolved = calculateTimeUnresolved(
    input.createdAt,
    input.resolvedAt,
    input.status
  );

  const weightedSum =
    safety.score * PRIORITY_CONFIG.weights.safetyRisk +
    severity.score * PRIORITY_CONFIG.weights.severity +
    population.score * PRIORITY_CONFIG.weights.affectedPopulation +
    unresolved.score * PRIORITY_CONFIG.weights.unresolvedTime;

  // Round to 1 decimal place (e.g. 74.2)
  const score = Math.round(weightedSum * 10) / 10;
  const band = getPriorityBand(score);

  const explanation = generatePriorityExplanation(
    band,
    safety,
    severity,
    population,
    unresolved
  );

  const factors: CivicPriorityBreakdown = {
    safetyRisk: safety.score,
    severity: severity.score,
    affectedPopulation: population.score,
    unresolvedTime: unresolved.score,
    weights: { ...PRIORITY_CONFIG.weights },
    safetyEvidence: safety.evidence,
    populationEvidence: population.evidence,
    unresolvedHours: unresolved.unresolvedHours,
    immediateHazardFlag: safety.immediateHazard,
    isFallbackUsed: population.isFallbackUsed,
    uncertaintyNotes: population.uncertaintyNotes,
  };

  return {
    score,
    band,
    factors,
    version: PRIORITY_CONFIG.version,
    explanation,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Enriches a complaint with recalculated Civic Priority Score.
 */
export function enrichComplaintWithPriority(complaint: Complaint): Complaint {
  const priorityScoreData = calculateCivicPriorityScore({
    category: complaint.category,
    title: complaint.title,
    description: complaint.description,
    priority: complaint.priority,
    address: complaint.address,
    ward: complaint.ward,
    city: complaint.city,
    createdAt: complaint.createdAt,
    resolvedAt: complaint.resolvedAt,
    status: complaint.status,
  });

  return {
    ...complaint,
    priorityScoreData,
    immediateSafetyHazard: priorityScoreData.factors.immediateHazardFlag,
  };
}
