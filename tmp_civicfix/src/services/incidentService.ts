import {
  CivicIncident,
  Complaint,
  DuplicateCandidatePair,
  DuplicateReviewRecord,
  DuplicateReviewStatus,
  TimelineEvent,
} from "../types";
import { getSupabaseClient } from "../lib/supabaseClient";
import {
  normalizeComplaintId,
  getStoredComplaints,
  saveComplaints,
} from "./complaintService";
import { saveReportToSupabase } from "./supabaseService";
import { compareComplaints } from "./duplicateDetectionService";

const STORAGE_KEY_INCIDENTS = "civicfix_civic_incidents_v1";
const STORAGE_KEY_DUPLICATE_REVIEWS = "civicfix_duplicate_reviews_v1";

/**
 * Returns a canonical, sorted key for a pair of complaint IDs.
 * Ensures (A, B) and (B, A) evaluate to the exact same pair key.
 */
export function getPairKey(id1: string, id2: string): string {
  const norm1 = normalizeComplaintId(id1);
  const norm2 = normalizeComplaintId(id2);
  return [norm1, norm2].sort().join("::");
}

/**
 * Generates a stable, human-readable Incident ID.
 * Format: INC-2026-<DIGITS/LETTERS>
 */
export function generateStableIncidentId(c1: Complaint, c2?: Complaint): string {
  const baseId = normalizeComplaintId(c1.complaintId || c1.id);
  const suffix = baseId.replace(/[^A-Z0-9]/gi, "").slice(-4) || "0100";
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `INC-2026-${suffix}-${randomSuffix}`;
}

// In-flight mutex map to prevent race conditions or duplicate reviews on the same pair
const inFlightReviews = new Map<string, Promise<any>>();

// --- LOCAL STORAGE HELPERS ---

let memoryIncidents: CivicIncident[] = [];
let memoryReviews: Record<string, DuplicateReviewRecord> = {};

export function getLocalIncidents(): CivicIncident[] {
  if (typeof window === "undefined") return memoryIncidents;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INCIDENTS);
    return raw ? JSON.parse(raw) : memoryIncidents;
  } catch {
    return memoryIncidents;
  }
}

export function saveLocalIncidents(incidents: CivicIncident[]): void {
  memoryIncidents = incidents;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_INCIDENTS, JSON.stringify(incidents));
  } catch (err) {
    console.warn("[Incidents] Failed to save local incidents:", err);
  }
}

export function getLocalReviews(): Record<string, DuplicateReviewRecord> {
  if (typeof window === "undefined") return memoryReviews;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DUPLICATE_REVIEWS);
    return raw ? JSON.parse(raw) : memoryReviews;
  } catch {
    return memoryReviews;
  }
}

export function saveLocalReviews(reviews: Record<string, DuplicateReviewRecord>): void {
  memoryReviews = reviews;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_DUPLICATE_REVIEWS, JSON.stringify(reviews));
  } catch (err) {
    console.warn("[DuplicateReviews] Failed to save local reviews:", err);
  }
}

// --- SUPABASE SYNC HELPERS ---

export async function fetchIncidentsFromSupabase(): Promise<{
  success: boolean;
  incidents: CivicIncident[];
  tableExists: boolean;
  error?: string;
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      success: false,
      incidents: getLocalIncidents(),
      tableExists: false,
      error: "Supabase client not initialized",
    };
  }

  try {
    const { data, error } = await supabase
      .from("civic_incidents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      const isMissingTable =
        error.code === "42P01" ||
        error.message?.toLowerCase().includes("does not exist") ||
        error.message?.toLowerCase().includes("schema cache");

      return {
        success: false,
        incidents: getLocalIncidents(),
        tableExists: !isMissingTable,
        error: error.message,
      };
    }

    const parsed: CivicIncident[] = (data || []).map((row: any) => ({
      id: row.id,
      incidentId: row.incident_id,
      title: row.title,
      category: row.category,
      department: row.department,
      status: row.status || "OPEN",
      primaryReportId: row.primary_report_id,
      reportCount: row.report_count || 1,
      reportIds: Array.isArray(row.report_ids) ? row.report_ids : [row.primary_report_id],
      confirmedBy: row.confirmed_by,
      confirmedByEmail: row.confirmed_by_email,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    }));

    saveLocalIncidents(parsed);
    return { success: true, incidents: parsed, tableExists: true };
  } catch (err: any) {
    return {
      success: false,
      incidents: getLocalIncidents(),
      tableExists: false,
      error: err.message || "Network exception fetching incidents",
    };
  }
}

export async function fetchDuplicateReviewsFromSupabase(): Promise<{
  success: boolean;
  reviews: Record<string, DuplicateReviewRecord>;
  tableExists: boolean;
  error?: string;
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      success: false,
      reviews: getLocalReviews(),
      tableExists: false,
      error: "Supabase client not initialized",
    };
  }

  try {
    const { data, error } = await supabase
      .from("civic_duplicate_reviews")
      .select("*");

    if (error) {
      const isMissingTable =
        error.code === "42P01" ||
        error.message?.toLowerCase().includes("does not exist") ||
        error.message?.toLowerCase().includes("schema cache");

      return {
        success: false,
        reviews: getLocalReviews(),
        tableExists: !isMissingTable,
        error: error.message,
      };
    }

    const map: Record<string, DuplicateReviewRecord> = {};
    (data || []).forEach((row: any) => {
      if (row.pair_key) {
        map[row.pair_key] = {
          id: row.id,
          pairKey: row.pair_key,
          complaintId1: row.complaint_id_1,
          complaintId2: row.complaint_id_2,
          decision: row.decision,
          incidentId: row.incident_id,
          similarityScore: row.similarity_score || 0,
          matchingReasons: row.matching_reasons || [],
          reviewNotes: row.review_notes,
          reviewedBy: row.reviewed_by,
          reviewedByEmail: row.reviewed_by_email,
          reviewedAt: row.reviewed_at || new Date().toISOString(),
        };
      }
    });

    saveLocalReviews(map);
    return { success: true, reviews: map, tableExists: true };
  } catch (err: any) {
    return {
      success: false,
      reviews: getLocalReviews(),
      tableExists: false,
      error: err.message || "Network exception fetching duplicate reviews",
    };
  }
}

// --- CANDIDATE GENERATION & SUPPRESSION ---

/**
 * Computes suggested duplicate candidate pairs across all complaints.
 * Suppresses any pair that has been REJECTED by an administrator.
 * Deduplicates symmetric pairs (A, B) and (B, A) into a single candidate pair.
 */
export function getCandidateDuplicatePairs(
  complaints: Complaint[],
  filterOption: "ALL" | "PENDING_ONLY" | "CONFIRMED_ONLY" = "ALL"
): DuplicateCandidatePair[] {
  const reviews = getLocalReviews();
  const pairMap = new Map<string, DuplicateCandidatePair>();

  for (let i = 0; i < complaints.length; i++) {
    const c1 = complaints[i];
    const id1 = normalizeComplaintId(c1.complaintId || c1.id);
    if (!id1) continue;

    for (let j = i + 1; j < complaints.length; j++) {
      const c2 = complaints[j];
      const id2 = normalizeComplaintId(c2.complaintId || c2.id);
      if (!id2 || id1 === id2) continue;

      const pairKey = getPairKey(id1, id2);
      const existingReview = reviews[pairKey];

      // If rejected, SUPPRESS from active triage suggestions
      if (existingReview?.decision === "REJECTED") {
        continue;
      }

      // Check if already grouped under a shared incident ID
      const sharedIncident =
        (c1.incidentId && c1.incidentId === c2.incidentId)
          ? c1.incidentId
          : existingReview?.incidentId;

      // Run comparison
      const comparison = compareComplaints(c1, c2);

      // Include if high/moderate similarity OR already confirmed under incident
      if (comparison || sharedIncident || existingReview?.decision === "CONFIRMED") {
        const reviewStatus: DuplicateReviewStatus =
          existingReview?.decision === "CONFIRMED" || sharedIncident
            ? "CONFIRMED"
            : "PENDING";

        pairMap.set(pairKey, {
          pairKey,
          complaint1: c1,
          complaint2: c2,
          similarityScore: comparison ? comparison.similarityScore : 0,
          confidence: comparison ? comparison.confidence : "low",
          distanceMeters: comparison ? comparison.distanceMeters : 0,
          timeDiffHours: comparison ? comparison.timeDiffHours : 0,
          reasons: comparison && comparison.reasons.length > 0 ? comparison.reasons : ["Shared incident confirmation"],
          reviewStatus,
          incidentId: sharedIncident || existingReview?.incidentId,
          reviewedAt: existingReview?.reviewedAt,
          reviewedByEmail: existingReview?.reviewedByEmail,
        });
      }
    }
  }

  let results = Array.from(pairMap.values());

  if (filterOption === "PENDING_ONLY") {
    results = results.filter((p) => p.reviewStatus === "PENDING");
  } else if (filterOption === "CONFIRMED_ONLY") {
    results = results.filter((p) => p.reviewStatus === "CONFIRMED");
  }

  // Sort: PENDING first (highest similarity first), then CONFIRMED
  return results.sort((a, b) => {
    if (a.reviewStatus === "PENDING" && b.reviewStatus !== "PENDING") return -1;
    if (a.reviewStatus !== "PENDING" && b.reviewStatus === "PENDING") return 1;
    return b.similarityScore - a.similarityScore;
  });
}

/**
 * Returns pairs that have been marked as REJECTED by an administrator (for audit / undo).
 */
export function getRejectedDuplicatePairs(complaints: Complaint[]): DuplicateCandidatePair[] {
  const reviews = getLocalReviews();
  const compMap = new Map<string, Complaint>();
  complaints.forEach((c) => {
    const id = normalizeComplaintId(c.complaintId || c.id);
    if (id) compMap.set(id, c);
  });

  const rejectedList: DuplicateCandidatePair[] = [];

  Object.values(reviews).forEach((rev) => {
    if (rev.decision !== "REJECTED") return;
    const c1 = compMap.get(normalizeComplaintId(rev.complaintId1));
    const c2 = compMap.get(normalizeComplaintId(rev.complaintId2));

    if (c1 && c2) {
      const comp = compareComplaints(c1, c2);
      rejectedList.push({
        pairKey: rev.pairKey,
        complaint1: c1,
        complaint2: c2,
        similarityScore: rev.similarityScore || comp.similarityScore,
        confidence: comp.confidence,
        distanceMeters: comp.distanceMeters,
        timeDiffHours: comp.timeDiffHours,
        reasons: rev.matchingReasons?.length ? rev.matchingReasons : comp.reasons,
        reviewStatus: "REJECTED",
        reviewedAt: rev.reviewedAt,
        reviewedByEmail: rev.reviewedByEmail,
      });
    }
  });

  return rejectedList;
}

// --- ADMIN REVIEW ACTIONS ---

export interface AdminReviewerInfo {
  id: string;
  email: string;
  name?: string;
  role: string;
}

/**
 * Confirms two complaints as a shared incident.
 * - Strictly verifies admin authorization (citizens are blocked).
 * - Generates or preserves a stable incident ID.
 * - Links both complaints without altering citizen complaint IDs, statuses, or evidence.
 * - Records confirmation decision in civic_duplicate_reviews.
 * - Appends audit timeline events to each complaint.
 * - Prevents double confirmation or concurrent conflicts.
 */
export async function confirmDuplicatePair(
  c1Id: string,
  c2Id: string,
  adminUser: AdminReviewerInfo,
  reviewNotes?: string
): Promise<{
  success: boolean;
  incidentId?: string;
  error?: string;
  supabaseSynced?: boolean;
}> {
  // 1. Authorization check
  if (!adminUser || adminUser.role !== "admin") {
    return {
      success: false,
      error: "Access Denied: Only authenticated administrators can confirm duplicate incidents.",
    };
  }

  const pairKey = getPairKey(c1Id, c2Id);

  // 2. Prevent concurrent duplicate reviews on same pair
  if (inFlightReviews.has(pairKey)) {
    return inFlightReviews.get(pairKey);
  }

  const reviewPromise = (async () => {
    const allComplaints = getStoredComplaints();
    const norm1 = normalizeComplaintId(c1Id);
    const norm2 = normalizeComplaintId(c2Id);

    const c1Index = allComplaints.findIndex(
      (c) => normalizeComplaintId(c.complaintId || c.id) === norm1
    );
    const c2Index = allComplaints.findIndex(
      (c) => normalizeComplaintId(c.complaintId || c.id) === norm2
    );

    if (c1Index === -1 || c2Index === -1) {
      return {
        success: false,
        error: `Could not locate complaints #${c1Id} or #${c2Id}.`,
      };
    }

    const c1 = allComplaints[c1Index];
    const c2 = allComplaints[c2Index];

    // 3. Resolve Incident ID: Reuse existing incident ID if either is already linked
    let incidentId = c1.incidentId || c2.incidentId;
    let isExistingIncident = Boolean(incidentId);

    if (!incidentId) {
      incidentId = generateStableIncidentId(c1, c2);
    }

    // 4. Update civic_duplicate_reviews record
    const nowIso = new Date().toISOString();
    const comparison = c1 && c2 ? compareComplaints(c1, c2) : null;
    const similarityScore = comparison ? comparison.similarityScore : 50;
    const matchingReasons = comparison ? comparison.reasons : ["Manually confirmed duplicate match"];
    const reviewRecord: DuplicateReviewRecord = {
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      pairKey,
      complaintId1: norm1,
      complaintId2: norm2,
      decision: "CONFIRMED",
      incidentId,
      similarityScore,
      matchingReasons,
      reviewNotes: reviewNotes || `Confirmed by ${adminUser.email}`,
      reviewedBy: adminUser.id,
      reviewedByEmail: adminUser.email,
      reviewedAt: nowIso,
    };

    // Save locally
    const localReviews = getLocalReviews();
    localReviews[pairKey] = reviewRecord;
    saveLocalReviews(localReviews);

    // 5. Update or Create Incident in civic_incidents
    const localIncidents = getLocalIncidents();
    let existingIncIndex = localIncidents.findIndex((inc) => inc.incidentId === incidentId);

    const timeFormatted =
      new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      ", " +
      new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    // 6. Update Complaint Timelines & incidentId without mutating citizen data
    const createIncidentTimelineEvent = (partnerId: string): TimelineEvent => ({
      id: `tl-inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: "ACKNOWLEDGED",
      title: `Linked to Shared Incident #${incidentId}`,
      description: `Report verified and grouped under municipal incident #${incidentId} alongside report #${partnerId} by municipal triage.`,
      timestamp: timeFormatted,
      actor: adminUser.name || "Municipal Administrator",
      department: c1.department,
    });

    const updatedC1: Complaint = {
      ...c1,
      incidentId,
      duplicateInfo: {
        ...c1.duplicateInfo,
        clusterId: incidentId,
      },
      timeline: [...(c1.timeline || []), createIncidentTimelineEvent(norm2)],
      updatedAt: nowIso,
    };

    const updatedC2: Complaint = {
      ...c2,
      incidentId,
      duplicateInfo: {
        ...c2.duplicateInfo,
        clusterId: incidentId,
      },
      timeline: [...(c2.timeline || []), createIncidentTimelineEvent(norm1)],
      updatedAt: nowIso,
    };

    allComplaints[c1Index] = updatedC1;
    allComplaints[c2Index] = updatedC2;
    saveComplaints(allComplaints);

    // 7. Update civic_incidents list
    if (existingIncIndex !== -1) {
      const existing = localIncidents[existingIncIndex];
      const allLinkedIds = Array.from(new Set([...existing.reportIds, norm1, norm2]));
      localIncidents[existingIncIndex] = {
        ...existing,
        reportIds: allLinkedIds,
        reportCount: allLinkedIds.length,
        updatedAt: nowIso,
      };
    } else {
      localIncidents.unshift({
        id: `inc-${Date.now()}`,
        incidentId,
        title: `${c1.category.toUpperCase()}: ${c1.title}`,
        category: c1.category,
        department: c1.department,
        status: "OPEN",
        primaryReportId: norm1,
        reportCount: 2,
        reportIds: [norm1, norm2],
        confirmedBy: adminUser.id,
        confirmedByEmail: adminUser.email,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
    saveLocalIncidents(localIncidents);

    // 8. Persist to Supabase
    let supabaseSynced = false;
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        // A. Upsert into civic_incidents
        const incidentData = localIncidents.find((i) => i.incidentId === incidentId);
        if (incidentData) {
          const { error: incErr } = await supabase.from("civic_incidents").upsert(
            {
              incident_id: incidentData.incidentId,
              title: incidentData.title,
              category: incidentData.category,
              department: incidentData.department,
              status: incidentData.status,
              primary_report_id: incidentData.primaryReportId,
              report_count: incidentData.reportCount,
              confirmed_by: adminUser.id,
              confirmed_by_email: adminUser.email,
              updated_at: nowIso,
            },
            { onConflict: "incident_id" }
          );
          if (!incErr) supabaseSynced = true;
        }

        // B. Upsert into civic_duplicate_reviews
        const { error: revErr } = await supabase.from("civic_duplicate_reviews").upsert(
          {
            pair_key: pairKey,
            complaint_id_1: norm1,
            complaint_id_2: norm2,
            decision: "CONFIRMED",
            incident_id: incidentId,
            similarity_score: comparison.similarityScore,
            matching_reasons: comparison.reasons,
            review_notes: reviewNotes || `Confirmed by ${adminUser.email}`,
            reviewed_by: adminUser.id,
            reviewed_by_email: adminUser.email,
            reviewed_at: nowIso,
          },
          { onConflict: "pair_key" }
        );
        if (!revErr) supabaseSynced = true;

        // C. Save updated reports to Supabase
        await Promise.all([
          saveReportToSupabase(updatedC1),
          saveReportToSupabase(updatedC2),
        ]);
      } catch (err) {
        console.warn("[Supabase] Notice: Remote incident write error (will persist locally):", err);
      }
    }

    return {
      success: true,
      incidentId,
      supabaseSynced,
    };
  })();

  inFlightReviews.set(pairKey, reviewPromise);
  try {
    return await reviewPromise;
  } finally {
    inFlightReviews.delete(pairKey);
  }
}

/**
 * Rejects a suggested duplicate pair.
 * Persists the decision so this pair is never repeatedly presented as a new suggestion.
 * Preserves each complaint intact.
 */
export async function rejectDuplicatePair(
  c1Id: string,
  c2Id: string,
  adminUser: AdminReviewerInfo,
  notes?: string
): Promise<{ success: boolean; error?: string; supabaseSynced?: boolean }> {
  // 1. Authorization check
  if (!adminUser || adminUser.role !== "admin") {
    return {
      success: false,
      error: "Access Denied: Only authenticated administrators can reject duplicate candidates.",
    };
  }

  const norm1 = normalizeComplaintId(c1Id);
  const norm2 = normalizeComplaintId(c2Id);
  const pairKey = getPairKey(norm1, norm2);

  if (inFlightReviews.has(pairKey)) {
    return inFlightReviews.get(pairKey);
  }

  const rejectPromise = (async () => {
    const allComplaints = getStoredComplaints();
    const c1 = allComplaints.find((c) => normalizeComplaintId(c.complaintId || c.id) === norm1);
    const c2 = allComplaints.find((c) => normalizeComplaintId(c.complaintId || c.id) === norm2);

    const comparison = c1 && c2 ? compareComplaints(c1, c2) : null;
    const similarityScore = comparison ? comparison.similarityScore : 0;
    const matchingReasons = comparison ? comparison.reasons : ["Manually reviewed match"];
    const nowIso = new Date().toISOString();

    const record: DuplicateReviewRecord = {
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      pairKey,
      complaintId1: norm1,
      complaintId2: norm2,
      decision: "REJECTED",
      similarityScore,
      matchingReasons,
      reviewNotes: notes || `Rejected by ${adminUser.email}`,
      reviewedBy: adminUser.id,
      reviewedByEmail: adminUser.email,
      reviewedAt: nowIso,
    };

    // Save locally
    const localReviews = getLocalReviews();
    localReviews[pairKey] = record;
    saveLocalReviews(localReviews);

    // Save to Supabase
    let supabaseSynced = false;
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase.from("civic_duplicate_reviews").upsert(
          {
            pair_key: pairKey,
            complaint_id_1: norm1,
            complaint_id_2: norm2,
            decision: "REJECTED",
            incident_id: null,
            similarity_score: similarityScore,
            matching_reasons: matchingReasons,
            review_notes: notes || `Rejected by ${adminUser.email}`,
            reviewed_by: adminUser.id,
            reviewed_by_email: adminUser.email,
            reviewed_at: nowIso,
          },
          { onConflict: "pair_key" }
        );
        if (!error) supabaseSynced = true;
      } catch (err) {
        console.warn("[Supabase] Notice: Remote duplicate review rejection skipped:", err);
      }
    }

    return { success: true, supabaseSynced };
  })();

  inFlightReviews.set(pairKey, rejectPromise);
  try {
    return await rejectPromise;
  } finally {
    inFlightReviews.delete(pairKey);
  }
}

/**
 * Reverts a previous rejection or confirmation back to PENDING.
 */
export async function resetDuplicateReview(
  c1Id: string,
  c2Id: string,
  adminUser: AdminReviewerInfo
): Promise<{ success: boolean; error?: string }> {
  if (!adminUser || adminUser.role !== "admin") {
    return { success: false, error: "Access Denied: Admin authorization required." };
  }

  const pairKey = getPairKey(c1Id, c2Id);
  const localReviews = getLocalReviews();
  delete localReviews[pairKey];
  saveLocalReviews(localReviews);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from("civic_duplicate_reviews").delete().eq("pair_key", pairKey);
    } catch {
      // non-blocking
    }
  }

  return { success: true };
}
