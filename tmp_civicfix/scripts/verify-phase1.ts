import {
  calculateCivicPriorityScore,
  getPriorityBand,
  PRIORITY_CONFIG,
  checkImmediateSafetyHazard,
  enrichComplaintWithPriority,
} from "../src/services/civicPriorityService";

import {
  calculateDistanceMeters,
  compareComplaints,
  findPotentialDuplicates,
} from "../src/services/duplicateDetectionService";

import { Complaint, IssueCategory } from "../src/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

console.log("=== CIVICFIX PHASE 1 VERIFICATION & AUDIT SUITE ===\n");

// ---------------------------------------------------------
// TEST 1: Priority formula weights, 0 and 100, and band boundaries
// ---------------------------------------------------------
console.log("TEST 1: Priority Formula Weights & Band Boundaries");
const weights = PRIORITY_CONFIG.weights;
assert(weights.safetyRisk === 0.4, "Safety risk weight is exactly 0.40 (40%)");
assert(weights.severity === 0.25, "Severity weight is exactly 0.25 (25%)");
assert(weights.affectedPopulation === 0.2, "Affected population weight is exactly 0.20 (20%)");
assert(weights.unresolvedTime === 0.15, "Unresolved time weight is exactly 0.15 (15%)");
const weightSum = weights.safetyRisk + weights.severity + weights.affectedPopulation + weights.unresolvedTime;
assert(Math.abs(weightSum - 1.0) < 0.0001, `Weights sum to exactly 1.0 (actual: ${weightSum})`);

// Band boundaries (0-34.99: Low, 35-59.99: Medium, 60-79.99: High, 80-100: Critical)
assert(getPriorityBand(0) === "Low", "Score 0 is Low");
assert(getPriorityBand(34.9) === "Low", "Score 34.9 is Low");
assert(getPriorityBand(35.0) === "Medium", "Score 35.0 is Medium");
assert(getPriorityBand(59.9) === "Medium", "Score 59.9 is Medium");
assert(getPriorityBand(60.0) === "High", "Score 60.0 is High");
assert(getPriorityBand(79.9) === "High", "Score 79.9 is High");
assert(getPriorityBand(80.0) === "Critical", "Score 80.0 is Critical");
assert(getPriorityBand(100.0) === "Critical", "Score 100.0 is Critical");

// Test calculation output range
const minInputScore = calculateCivicPriorityScore({
  category: "other" as IssueCategory,
  title: "Minor paint scratch on park bench",
  description: "Small cosmetic scratch in quiet back alley cul-de-sac",
  priority: "low",
  address: "Dead end lane",
  ward: "Quiet area",
  createdAt: new Date().toISOString(),
});
assert(minInputScore.score >= 0 && minInputScore.score <= 35, `Low input produces Low band score (actual: ${minInputScore.score})`);

const maxInputScore = calculateCivicPriorityScore({
  category: "traffic_signal" as IssueCategory,
  title: "Complete signal collapse at major metro station junction with multiple accidents",
  description: "Total traffic light power failure with live wire exposed on main road junction near Indiranagar Metro, multiple collision injuries reported",
  priority: "urgent",
  address: "Indiranagar Metro Station Main Road Junction",
  ward: "Central Ward",
  createdAt: new Date(Date.now() - 400 * 3600 * 1000).toISOString(), // 400 hours unresolved (>14 days)
});
assert(maxInputScore.score >= 80, `High threat & aged input produces Critical score (actual: ${maxInputScore.score})`);
assert(maxInputScore.band === "Critical", "Critical band assigned");

// ---------------------------------------------------------
// TEST 2: Missing or Unreliable Evidence Handling
// ---------------------------------------------------------
console.log("\nTEST 2: Missing or Unreliable Evidence Handling");
const missingDataScore = calculateCivicPriorityScore({
  category: "other" as IssueCategory,
  title: "General civic inquiry",
  description: "Notice of maintenance request",
  createdAt: new Date().toISOString(),
  address: "",
  ward: "",
});
assert(missingDataScore.factors.isFallbackUsed === true, "Flags fallback when address and ward are missing");
assert(
  typeof missingDataScore.factors.uncertaintyNotes === "string" &&
  missingDataScore.factors.uncertaintyNotes.length > 0,
  `Explicit uncertainty note provided: "${missingDataScore.factors.uncertaintyNotes}"`
);
assert(!missingDataScore.explanation.includes("50000") && !missingDataScore.explanation.includes("people"), "Does not invent raw headcount figures");

// ---------------------------------------------------------
// TEST 3: Credible Immediate Safety Hazards
// ---------------------------------------------------------
console.log("\nTEST 3: Credible Immediate Safety Hazards");
const liveWireHazard = checkImmediateSafetyHazard("other", "Exposed electrical wire", "Live sparking wire dangling over walkway");
assert(liveWireHazard.isHazard === true, `Live wire triggers hazard flag: "${liveWireHazard.reason}"`);

const manholeHazard = checkImmediateSafetyHazard("drainage", "Drain pit", "Missing manhole cover open drain in dark road");
assert(manholeHazard.isHazard === true, `Open manhole triggers hazard flag: "${manholeHazard.reason}"`);

const nonHazard = checkImmediateSafetyHazard("garbage", "Overflowing bin", "Trash bin is full in neighborhood park");
assert(nonHazard.isHazard === false, "Routine trash is not flagged as immediate emergency hazard");

// Verify that immediate hazard is flagged regardless of score
const testComplaint: Complaint = {
  id: "TEST-001",
  complaintId: "TEST-001",
  title: "Live wire dangling",
  description: "Live sparking electrical wire hanging near pavement",
  category: "other",
  department: "Electrical Maintenance",
  priority: "low",
  status: "SUBMITTED",
  address: "Dead end alley",
  city: "City",
  ward: "Ward 1",
  latitude: 12.9,
  longitude: 77.5,
  citizenId: "c1",
  citizenName: "Citizen",
  citizenPhone: "1234567890",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  timeline: [],
  estimatedResolution: "1 day",
  aiConfidence: 0.9,
  aiSuggestedCategory: "other",
  aiSuggestedDepartment: "Electrical Maintenance",
};
const enriched = enrichComplaintWithPriority(testComplaint);
assert(enriched.immediateSafetyHazard === true, "immediateSafetyHazard flag is true on complaint");
assert(enriched.priorityScoreData?.factors.immediateHazardFlag === true, "immediateHazardFlag is true in score factors");

// ---------------------------------------------------------
// TEST 4: Duplicate Detection Scenarios
// ---------------------------------------------------------
console.log("\nTEST 4: Duplicate Detection Scenarios");

const baseCandidate: Complaint = {
  id: "CF-EXISTING-1",
  complaintId: "CF-EXISTING-1",
  title: "Dangerous pothole on 100 Feet Road",
  description: "Deep pothole causing bike skids near signal junction on 100 Feet Road",
  category: "pothole",
  department: "Road Maintenance",
  priority: "high",
  status: "SUBMITTED",
  address: "100 Feet Road, Indiranagar",
  city: "Bengaluru",
  ward: "Ward 80",
  latitude: 12.9716,
  longitude: 77.6412,
  citizenId: "citizen-1",
  citizenName: "Aarav Sharma",
  citizenPhone: "9876543210",
  createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(), // 2 hours ago
  updatedAt: new Date().toISOString(),
  timeline: [],
  estimatedResolution: "2 days",
  aiConfidence: 0.95,
  aiSuggestedCategory: "pothole",
  aiSuggestedDepartment: "Road Maintenance",
};

// Scenario A: Same pothole at nearly identical coordinates (<25m)
const distMetersA = calculateDistanceMeters(12.9716, 77.6412, 12.97168, 77.64125);
console.log(`  -> Distance between nearly identical coordinates: ${distMetersA}m`);
const matchA = compareComplaints(
  {
    category: "pothole",
    title: "Big pothole on 100ft road",
    description: "Deep pothole near signal causing vehicles to swerve",
    latitude: 12.97168,
    longitude: 77.64125,
    createdAt: new Date().toISOString(),
  },
  baseCandidate
);
assert(matchA !== null, "Scenario A: Potential duplicate identified");
assert((matchA?.similarityScore || 0) >= 60, `Scenario A: High/Moderate similarity score (actual: ${matchA?.similarityScore}%)`);

// Scenario B: Different wording about same issue at same location
const matchB = compareComplaints(
  {
    category: "pothole",
    title: "Broken road crater",
    description: "Huge asphalt crater damaged my scooter rim right in front of the traffic light",
    latitude: 12.97165,
    longitude: 77.64122,
    createdAt: new Date().toISOString(),
  },
  baseCandidate
);
assert(matchB !== null, "Scenario B: Different wording matched via geographic & category overlap");
assert((matchB?.similarityScore || 0) >= 50, `Scenario B: Similarity score meets threshold (actual: ${matchB?.similarityScore}%)`);

// Scenario C: Similar descriptions at distant locations (>350m, e.g. 15km away)
const matchC = compareComplaints(
  {
    category: "pothole",
    title: "Dangerous pothole on 100 Feet Road",
    description: "Deep pothole causing bike skids near signal junction on 100 Feet Road",
    latitude: 13.0827, // Chennai coordinates
    longitude: 80.2707,
    createdAt: new Date().toISOString(),
  },
  baseCandidate
);
assert(matchC === null, "Scenario C: Distant report is correctly rejected (returns null)");

// Scenario D: Different issue categories at the same location (garbage vs pothole)
const matchD = compareComplaints(
  {
    category: "garbage",
    title: "Uncollected waste pile",
    description: "Trash dumped on sidewalk next to the road",
    latitude: 12.9716,
    longitude: 77.6412,
    createdAt: new Date().toISOString(),
  },
  baseCandidate
);
assert(matchD === null, "Scenario D: Different unrelated categories at same coords are NOT duplicates");

// Scenario E: Missing coordinates (0, 0)
const matchE = compareComplaints(
  {
    category: "pothole",
    title: "Pothole somewhere",
    description: "",
    latitude: 0,
    longitude: 0,
    createdAt: new Date().toISOString(),
  },
  baseCandidate
);
assert(matchE === null, "Scenario E: Missing/invalid coordinates handled safely without throwing");

// Test findPotentialDuplicates collection wrapper
const candidateList = [baseCandidate];
const searchResults = findPotentialDuplicates(
  {
    category: "pothole",
    title: "Pothole on 100ft road",
    description: "Dangerous crater for two-wheelers",
    latitude: 12.97162,
    longitude: 77.64121,
  },
  candidateList
);
assert(searchResults.length === 1, "findPotentialDuplicates returns 1 candidate suggestion");
assert(searchResults[0].complaintId === baseCandidate.id, "Candidate suggestion preserves original complaint ID");

console.log(`\nVerification Test Run Complete: ${passed} Passed, ${failed} Failed.`);
if (failed > 0) {
  process.exit(1);
}
