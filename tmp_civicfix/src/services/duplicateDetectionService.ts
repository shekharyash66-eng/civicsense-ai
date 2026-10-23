import { Complaint, DuplicateMatch, IssueCategory } from "../types";

export interface DuplicateCheckParams {
  category: IssueCategory;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  createdAt?: string;
  currentComplaintId?: string;
}

export interface DuplicateDetectionConfig {
  maxDistanceMeters: number; // e.g. 350 meters
  maxTimeDiffHours: number; // e.g. 14 days = 336 hours
  minimumSimilarityThreshold: number; // e.g. 50%
}

const DEFAULT_CONFIG: DuplicateDetectionConfig = {
  maxDistanceMeters: 350,
  maxTimeDiffHours: 336, // 14 days
  minimumSimilarityThreshold: 50,
};

/**
 * Calculates great-circle distance between two coordinates in meters via Haversine formula.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;

  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Cleans and tokenizes text into distinct normalized words for similarity comparison.
 */
function tokenize(text: string): Set<string> {
  const stopWords = new Set([
    "the", "is", "at", "which", "on", "and", "a", "an", "in", "to", "for",
    "of", "or", "it", "this", "that", "there", "my", "our", "near", "by", "with",
    "from", "as", "be", "has", "have", "had", "was", "were", "been", "lane", "road"
  ]);

  const cleaned = (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  return new Set(cleaned);
}

/**
 * Calculates Jaccard token similarity (0 to 1).
 */
function calculateJaccardSimilarity(textA: string, textB: string): number {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection++;
    }
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Returns true if two categories are directly related.
 */
function areCategoriesRelated(cat1: IssueCategory, cat2: IssueCategory): boolean {
  if (cat1 === cat2) return true;
  const pairs: [IssueCategory, IssueCategory][] = [
    ["pothole", "road_damage"],
    ["road_damage", "pothole"],
    ["water_leakage", "drainage"],
    ["drainage", "water_leakage"],
    ["garbage", "illegal_dumping"],
    ["illegal_dumping", "garbage"],
    ["streetlight", "other"],
  ];
  return pairs.some(([a, b]) => (cat1 === a && cat2 === b) || (cat1 === b && cat2 === a));
}

/**
 * Compares an input complaint against a single existing complaint
 * and returns a match if confidence exceeds threshold.
 */
export function compareComplaints(
  target: DuplicateCheckParams,
  candidate: Complaint,
  config: DuplicateDetectionConfig = DEFAULT_CONFIG
): DuplicateMatch | null {
  // Never match against itself
  if (
    target.currentComplaintId &&
    (candidate.id === target.currentComplaintId || candidate.complaintId === target.currentComplaintId)
  ) {
    return null;
  }

  const distanceMeters = calculateDistanceMeters(
    target.latitude,
    target.longitude,
    candidate.latitude,
    candidate.longitude
  );

  // If distance exceeds maximum scan threshold, skip
  if (distanceMeters > config.maxDistanceMeters) {
    return null;
  }

  // Calculate time difference
  const targetTime = target.createdAt ? new Date(target.createdAt).getTime() : Date.now();
  const candTime = new Date(candidate.createdAt).getTime();
  const timeDiffHours = Math.round(Math.abs(targetTime - candTime) / (1000 * 60 * 60));

  // Category matching
  const exactCategory = target.category === candidate.category;
  const relatedCategory = areCategoriesRelated(target.category, candidate.category);

  if (!exactCategory && !relatedCategory) {
    return null; // Different non-related domains are not duplicates
  }

  // Text similarity
  const textSim = calculateJaccardSimilarity(
    `${target.title} ${target.description}`,
    `${candidate.title} ${candidate.description}`
  );

  // Geographic score: 0m = 100, 50m = 90, 150m = 70, 300m = 40
  let geoScore = 0;
  if (distanceMeters <= 25) geoScore = 100;
  else if (distanceMeters <= 75) geoScore = 90;
  else if (distanceMeters <= 150) geoScore = 75;
  else if (distanceMeters <= 250) geoScore = 55;
  else geoScore = Math.max(10, 100 - (distanceMeters / config.maxDistanceMeters) * 80);

  // Time score: 0-24 hrs = 100, 3 days = 85, 7 days = 65, 14 days = 40
  let timeScore = 0;
  if (timeDiffHours <= 24) timeScore = 100;
  else if (timeDiffHours <= 72) timeScore = 85;
  else if (timeDiffHours <= 168) timeScore = 65;
  else timeScore = Math.max(20, 100 - (timeDiffHours / config.maxTimeDiffHours) * 70);

  // Category score
  const catScore = exactCategory ? 100 : 70;

  // Text score (0-100)
  const tokenScore = Math.min(100, Math.round(textSim * 140)); // Scale up reasonable overlap

  // Composite similarity score
  // Geo: 40%, Category: 25%, Text: 20%, Time: 15%
  const compositeScore = Math.round(
    geoScore * 0.40 +
    catScore * 0.25 +
    tokenScore * 0.20 +
    timeScore * 0.15
  );

  if (compositeScore < config.minimumSimilarityThreshold) {
    return null;
  }

  // Build understandable reasons list
  const reasons: string[] = [];
  if (distanceMeters < 50) {
    reasons.push(`Located within ${distanceMeters}m of reported position`);
  } else {
    reasons.push(`Within ${distanceMeters}m neighborhood vicinity`);
  }

  if (exactCategory) {
    reasons.push(`Identical issue category (${candidate.category.replace("_", " ")})`);
  } else {
    reasons.push(`Closely related municipal domain (${candidate.category.replace("_", " ")})`);
  }

  if (timeDiffHours < 24) {
    reasons.push(`Reported within the last ${timeDiffHours || 1} hour(s)`);
  } else {
    const days = Math.round(timeDiffHours / 24);
    reasons.push(`Reported ${days} day(s) apart`);
  }

  if (textSim >= 0.25) {
    reasons.push("Substantial semantic overlap in description keywords");
  }

  let confidence: "high" | "moderate" | "low" = "low";
  if (compositeScore >= 75) confidence = "high";
  else if (compositeScore >= 60) confidence = "moderate";

  return {
    complaintId: candidate.complaintId || candidate.id,
    title: candidate.title,
    category: candidate.category,
    similarityScore: compositeScore,
    confidence,
    distanceMeters,
    timeDiffHours,
    reasons,
    status: candidate.status,
    createdAt: candidate.createdAt,
  };
}

/**
 * Searches a collection of complaints for potential duplicates matching the target issue.
 */
export function findPotentialDuplicates(
  target: DuplicateCheckParams,
  existingComplaints: Complaint[],
  config: DuplicateDetectionConfig = DEFAULT_CONFIG
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (const candidate of existingComplaints) {
    // Only compare against active/open complaints or recent closed complaints
    const match = compareComplaints(target, candidate, config);
    if (match) {
      matches.push(match);
    }
  }

  // Sort descending by similarity score
  return matches.sort((a, b) => b.similarityScore - a.similarityScore);
}

/**
 * Identifies duplicate clusters across an entire list of complaints.
 * Maps complaintId -> list of matched duplicate IDs.
 */
export function buildDuplicateClusters(
  complaints: Complaint[]
): Map<string, DuplicateMatch[]> {
  const clusterMap = new Map<string, DuplicateMatch[]>();

  for (const c of complaints) {
    const matches = findPotentialDuplicates(
      {
        category: c.category,
        title: c.title,
        description: c.description,
        latitude: c.latitude,
        longitude: c.longitude,
        createdAt: c.createdAt,
        currentComplaintId: c.complaintId || c.id,
      },
      complaints
    );

    if (matches.length > 0) {
      clusterMap.set(c.complaintId || c.id, matches);
    }
  }

  return clusterMap;
}
