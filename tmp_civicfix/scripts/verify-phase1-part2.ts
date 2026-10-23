import {
  confirmDuplicatePair,
  rejectDuplicatePair,
  getLocalIncidents,
  getLocalReviews,
  getCandidateDuplicatePairs,
} from "../src/services/incidentService";
import {
  complaintToSupabaseRow,
  supabaseRowToComplaint,
} from "../src/services/supabaseService";
import { calculateCivicPriorityScore } from "../src/services/civicPriorityService";
import { saveComplaints } from "../src/services/complaintService";
import { Complaint, IssueCategory, MunicipalDepartment, ComplaintPriority } from "../src/types";

async function runTests() {
  console.log("=== Starting CivicFix Phase 1 Part 2 Verification & Tests ===");

  // 1. Test Priority Scoring & Persistence
  console.log("\n[Test 1] Priority Scoring & Persistence in raw_data");
  const testComplaint: Complaint = {
    id: "comp-test-101",
    complaintId: "CF-2026-9999",
    title: "Main Street Pothole Hazard",
    category: "pothole" as IssueCategory,
    description: "Deep dangerous pothole on Main Street causing multiple flat tires and accidents.",
    address: "123 Main St",
    city: "San Francisco",
    ward: "Ward 3",
    latitude: 37.7749,
    longitude: -122.4194,
    citizenId: "citizen-1",
    citizenName: "Jane Doe",
    department: "Road Maintenance" as MunicipalDepartment,
    priority: "high" as ComplaintPriority,
    status: "SUBMITTED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aiConfidence: 0.95,
    aiSuggestedCategory: "pothole" as IssueCategory,
    aiSuggestedDepartment: "Road Maintenance" as MunicipalDepartment,
    timeline: [],
    immediateSafetyHazard: true,
  };

  const priorityResult = calculateCivicPriorityScore(testComplaint);
  console.log("Calculated Priority Score:", priorityResult.score, "Band:", priorityResult.band);
  
  if (priorityResult.score < 35 || !["Medium", "High", "Critical"].includes(priorityResult.band)) {
    console.error("FAIL: Score should be >= 35 (Medium/High/Critical band).");
    process.exit(1);
  }

  // Attach priorityScoreData
  testComplaint.priorityScoreData = priorityResult;

  // Test Supabase Row mapping & roundtrip
  const row = complaintToSupabaseRow(testComplaint, "user-uuid-123");
  console.log("Mapped Supabase Row keys:", Object.keys(row));
  if (!row.raw_data || !row.raw_data.priorityScoreData) {
    console.error("FAIL: raw_data.priorityScoreData not persisted in Supabase row!");
    process.exit(1);
  }

  const roundtripComplaint = supabaseRowToComplaint({
    id: row.id,
    complaint_id: row.complaint_id,
    title: row.title,
    category: row.category,
    description: row.description,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    raw_data: row.raw_data,
    incident_id: row.incident_id,
  });

  if (!roundtripComplaint.priorityScoreData || roundtripComplaint.priorityScoreData.score !== priorityResult.score) {
    console.error("FAIL: Priority score did not survive Supabase roundtrip!");
    process.exit(1);
  }
  console.log("PASS: Priority score persistence and roundtrip verified.");

  // 2. Test Duplicate Confirmation & Incident Grouping
  console.log("\n[Test 2] Duplicate Confirmation & Incident Grouping");
  const compA: Complaint = {
    id: "CF-2026-0001",
    complaintId: "CF-2026-0001",
    title: "Pothole on 5th Ave",
    category: "pothole" as IssueCategory,
    description: "Large pothole on 5th Ave.",
    address: "5th Ave",
    city: "San Francisco",
    ward: "Ward 1",
    latitude: 37.78,
    longitude: -122.41,
    citizenId: "user-1",
    citizenName: "User One",
    department: "Road Maintenance" as MunicipalDepartment,
    priority: "medium" as ComplaintPriority,
    status: "SUBMITTED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aiConfidence: 0.9,
    aiSuggestedCategory: "pothole" as IssueCategory,
    aiSuggestedDepartment: "Road Maintenance" as MunicipalDepartment,
    timeline: [],
  };

  const compB: Complaint = {
    id: "CF-2026-0002",
    complaintId: "CF-2026-0002",
    title: "Massive pothole 5th Ave",
    category: "pothole" as IssueCategory,
    description: "Another report about the massive pothole on 5th Ave.",
    address: "5th Ave",
    city: "San Francisco",
    ward: "Ward 1",
    latitude: 37.7801,
    longitude: -122.4101,
    citizenId: "user-2",
    citizenName: "User Two",
    department: "Road Maintenance" as MunicipalDepartment,
    priority: "medium" as ComplaintPriority,
    status: "SUBMITTED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aiConfidence: 0.9,
    aiSuggestedCategory: "pothole" as IssueCategory,
    aiSuggestedDepartment: "Road Maintenance" as MunicipalDepartment,
    timeline: [],
  };

  const compC: Complaint = {
    id: "CF-2026-0003",
    complaintId: "CF-2026-0003",
    title: "Streetlight outage Elm St",
    category: "streetlight" as IssueCategory,
    description: "Broken streetlight on Elm St.",
    address: "Elm St",
    city: "San Francisco",
    ward: "Ward 2",
    latitude: 37.79,
    longitude: -122.42,
    citizenId: "user-3",
    citizenName: "User Three",
    department: "Electrical Maintenance" as MunicipalDepartment,
    priority: "low" as ComplaintPriority,
    status: "SUBMITTED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aiConfidence: 0.9,
    aiSuggestedCategory: "streetlight" as IssueCategory,
    aiSuggestedDepartment: "Electrical Maintenance" as MunicipalDepartment,
    timeline: [],
  };

  saveComplaints([compA, compB, compC]);

  const adminUser = {
    id: "admin-uuid-001",
    email: "admin@civicfix.test",
    name: "Admin Tester",
    role: "admin",
  };

  const confirmRes = await confirmDuplicatePair(compA.id, compB.id, adminUser, "Confirmed duplicate pothole incident.");
  console.log("Confirmation Result:", confirmRes);

  if (!confirmRes.success || !confirmRes.incidentId) {
    console.error("FAIL: Duplicate confirmation failed.");
    process.exit(1);
  }

  const incidents = getLocalIncidents();
  console.log("Confirmed Incidents Count:", incidents.length);
  if (incidents.length === 0 || incidents[0].reportIds.length !== 2) {
    console.error("FAIL: Incident grouping did not link 2 reports.");
    process.exit(1);
  }
  console.log("PASS: Persistent incident grouping verified.");

  // 3. Test Rejected Candidate Suppression
  console.log("\n[Test 3] Rejected Candidate Suppression");
  const rejectRes = await rejectDuplicatePair(compA.id, compC.id, adminUser, "False positive, different categories/locations.");
  console.log("Rejection Result:", rejectRes);

  if (!rejectRes.success) {
    console.error("FAIL: Rejection failed.");
    process.exit(1);
  }

  const rejectedPairs = Object.values(getLocalReviews()).filter((r) => r.decision === "REJECTED");
  console.log("Rejected Pairs Count:", rejectedPairs.length);
  if (rejectedPairs.length === 0) {
    console.error("FAIL: Rejected pair not recorded.");
    process.exit(1);
  }

  // Test candidate suppression
  const candidatePairs = getCandidateDuplicatePairs([compA, compB, compC]);
  const foundRejectedInCandidates = candidatePairs.some(
    (p) => (p.complaint1.complaintId === compA.complaintId && p.complaint2.complaintId === compC.complaintId) ||
           (p.complaint1.complaintId === compC.complaintId && p.complaint2.complaintId === compA.complaintId)
  );

  if (foundRejectedInCandidates) {
    console.error("FAIL: Rejected pair was not suppressed from candidate pairs.");
    process.exit(1);
  }
  console.log("PASS: Rejected candidate suppression verified.");

  console.log("\n=== ALL VERIFICATION & TESTS PASSED SUCCESSFULLY! ===");
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
