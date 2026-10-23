import { Complaint, TimelineEvent } from "../types";
import { getSupabaseClient, getSupabaseConfig, SupabaseConfig } from "../lib/supabaseClient";
import { enrichComplaintWithPriority } from "./civicPriorityService";

export interface SupabaseSyncStatus {
  connected: boolean;
  tableExists: boolean;
  lastSyncedAt?: string;
  reportCount?: number;
  message?: string;
  error?: string;
}

/**
 * Helper to check if a string is a valid UUID
 */
export function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str.trim());
}

/**
 * Generate a standard UUID v4 for database primary keys
 */
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback below
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Deterministically derives a valid UUID v4-format from a complaint ID string
 * e.g. "CF-2026-8941" -> stable UUID
 */
export function complaintIdToUUID(complaintId: string): string {
  if (isValidUUID(complaintId)) return complaintId;
  const clean = complaintId.trim();
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x811c9dc5, h4 = 0x67452301;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 3812015801);
    h4 = Math.imul(h4 ^ ch, 1013904223);
  }
  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  const s = toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4);
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

/**
 * Maps a CivicFix Complaint object to a Supabase database row.
 * Handles both UUID and text id columns gracefully, and supports auth user_id.
 */
export function complaintToSupabaseRow(c: Complaint, authUserId?: string | null) {
  const canonicalComplaintId = c.complaintId || c.id;
  const hasValidUuid = isValidUUID(c.id);
  const rowId = hasValidUuid ? c.id : complaintIdToUUID(canonicalComplaintId);

  // Resolve user_id: if user is logged into Supabase Auth, use their UUID;
  // otherwise if citizenId is a valid UUID, use it; otherwise null (or omitted)
  const resolvedUserId = (authUserId && isValidUUID(authUserId))
    ? authUserId
    : (c.citizenId && isValidUUID(c.citizenId))
    ? c.citizenId
    : null;

  return {
    id: rowId,
    complaint_id: canonicalComplaintId,
    user_id: resolvedUserId,
    citizen_id: c.citizenId || "citizen",
    citizen_name: c.citizenName || "Citizen Reporter",
    citizen_phone: c.citizenPhone || "",
    title: c.title,
    description: c.description,
    category: c.category,
    department: c.department,
    priority: c.priority,
    status: c.status || "SUBMITTED",
    address: c.address || "",
    city: c.city || "",
    ward: c.ward || "",
    latitude: typeof c.latitude === "number" ? c.latitude : 0,
    longitude: typeof c.longitude === "number" ? c.longitude : 0,
    image_url: c.imageUrl || null,
    assigned_to: c.assignedTo || null,
    assigned_at: c.assignedAt || null,
    resolved_at: c.resolvedAt || null,
    timeline: c.timeline || [],
    estimated_resolution: c.estimatedResolution || "1–3 days",
    ai_confidence: c.aiConfidence || 0.9,
    ai_suggested_category: c.aiSuggestedCategory || c.category,
    ai_suggested_department: c.aiSuggestedDepartment || c.department,
    citizen_confirmed_resolution: c.citizenConfirmedResolution || false,
    citizen_feedback: c.citizenFeedback || null,
    created_at: c.createdAt || new Date().toISOString(),
    updated_at: c.updatedAt || new Date().toISOString(),
    incident_id: c.incidentId || null,
    raw_data: {
      ...c,
      id: canonicalComplaintId,
      complaintId: canonicalComplaintId,
      incidentId: c.incidentId || undefined,
      priorityScoreData: c.priorityScoreData || undefined,
      immediateSafetyHazard: c.immediateSafetyHazard || undefined,
    },
  };
}

/**
 * Maps a Supabase row back to a CivicFix Complaint object.
 * Safe for:
 * - Rows with raw_data JSONB
 * - Legacy rows where raw_data is absent or null
 * - Rows created before priority scoring existed (automatically enriches them)
 */
export function supabaseRowToComplaint(row: any): Complaint {
  const canonicalId = row.complaint_id || row.id;
  let comp: Complaint;

  if (row.raw_data && typeof row.raw_data === "object" && Object.keys(row.raw_data).length > 0) {
    comp = {
      ...row.raw_data,
      id: canonicalId || row.raw_data.id,
      complaintId: canonicalId || row.raw_data.complaintId,
      status: row.status || row.raw_data.status,
      timeline: row.timeline || row.raw_data.timeline || [],
      incidentId: row.incident_id || row.raw_data.incidentId || undefined,
    };
  } else {
    // Robust fallback for legacy rows where raw_data was not present
    comp = {
      id: canonicalId,
      complaintId: canonicalId,
      title: row.title || "Civic Report",
      description: row.description || "",
      category: row.category || "other",
      department: row.department || "General Civic Services",
      priority: row.priority || "medium",
      status: row.status || "SUBMITTED",
      address: row.address || "",
      city: row.city || "",
      ward: row.ward || "",
      latitude: typeof row.latitude === "number" ? row.latitude : 0,
      longitude: typeof row.longitude === "number" ? row.longitude : 0,
      citizenId: row.citizen_id || "citizen",
      citizenName: row.citizen_name || "Citizen Reporter",
      citizenPhone: row.citizen_phone || "",
      imageUrl: row.image_url || undefined,
      assignedTo: row.assigned_to || undefined,
      assignedAt: row.assigned_at || undefined,
      resolvedAt: row.resolved_at || undefined,
      timeline: Array.isArray(row.timeline) ? row.timeline : [],
      estimatedResolution: row.estimated_resolution || "1–3 days",
      aiConfidence: row.ai_confidence || 0.9,
      aiSuggestedCategory: row.ai_suggested_category || row.category || "other",
      aiSuggestedDepartment: row.ai_suggested_department || row.department || "General Civic Services",
      citizenConfirmedResolution: Boolean(row.citizen_confirmed_resolution),
      citizenFeedback: row.citizen_feedback || undefined,
      incidentId: row.incident_id || undefined,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  // Ensure priority score and factors are present and calculated deterministically
  if (!comp.priorityScoreData || !comp.priorityScoreData.factors) {
    return enrichComplaintWithPriority(comp);
  }
  return comp;
}

// Map to deduplicate concurrent in-flight saves for the same complaint ID
const inFlightSaves = new Map<string, Promise<{ success: boolean; data?: any; error?: string }>>();

/**
 * Saves a single report to Supabase (table 'reports').
 * Enforces authenticated user_id if present, deduplicates concurrent saves,
 * and uses upsert with automatic conflict resolution for reports_pkey and reports_complaint_id_key.
 */
export async function saveReportToSupabase(
  complaint: Complaint
): Promise<{ success: boolean; data?: any; error?: string }> {
  const canonicalId = complaint.complaintId || complaint.id;
  if (!canonicalId) {
    return { success: false, error: "Complaint ID missing." };
  }

  // Deduplicate concurrent saves for the same complaint (e.g. from createComplaint + ReportIssuePage)
  const existingInFlight = inFlightSaves.get(canonicalId);
  if (existingInFlight) {
    return existingInFlight;
  }

  const savePromise = executeSaveReportToSupabase(complaint).finally(() => {
    inFlightSaves.delete(canonicalId);
  });

  inFlightSaves.set(canonicalId, savePromise);
  return savePromise;
}

async function executeSaveReportToSupabase(
  complaint: Complaint
): Promise<{ success: boolean; data?: any; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const errMsg = "Supabase client not initialized or disabled.";
    console.warn("[Supabase] Insert skipped:", errMsg);
    return { success: false, error: errMsg };
  }

  const canonicalComplaintId = complaint.complaintId || complaint.id;

  // 1. Authenticate user gracefully via Supabase Auth session
  let authUserId: string | null = null;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user?.id) {
      authUserId = session.user.id;
    } else {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!userError && user?.id) {
        authUserId = user.id;
      }
    }
  } catch (authEx) {
    // Non-fatal, proceed with complaint metadata
  }

  if (!authUserId) {
    if (complaint.citizenId && isValidUUID(complaint.citizenId)) {
      authUserId = complaint.citizenId;
    }
  }

  // 2. Build row matching public.reports schema
  const row = complaintToSupabaseRow(complaint, authUserId);

  try {
    // 3. Execute UPSERT into public.reports with conflict handling on complaint_id
    let { data: savedData, error: saveError } = await supabase
      .from("reports")
      .upsert(row, { onConflict: "complaint_id" })
      .select()
      .maybeSingle();

    // If error was caused by incident_id column not yet present in Supabase table, retry without incident_id column
    if (saveError && (saveError.message?.toLowerCase().includes("incident_id") || saveError.code === "42703")) {
      console.info("[Supabase] Column incident_id not yet present in reports table, retrying with raw_data JSONB");
      delete (row as any).incident_id;
      const retryResult = await supabase
        .from("reports")
        .upsert(row, { onConflict: "complaint_id" })
        .select()
        .maybeSingle();

      savedData = retryResult.data;
      saveError = retryResult.error;
    }

    // If conflict occurred on primary key 'id' instead of complaint_id, retry with onConflict on 'id'
    if (saveError && (saveError.code === "23505" || saveError.message?.includes("unique constraint"))) {
      console.info("[Supabase] Unique constraint encountered on complaint_id, retrying with onConflict 'id'");
      const retryResult = await supabase
        .from("reports")
        .upsert(row, { onConflict: "id" })
        .select()
        .maybeSingle();

      savedData = retryResult.data;
      saveError = retryResult.error;

      // If still encountering unique conflict (e.g. both id and complaint_id exist), perform direct update
      if (saveError && (saveError.code === "23505" || saveError.message?.includes("unique constraint"))) {
        console.info("[Supabase] Updating existing report row for:", canonicalComplaintId);
        const updateResult = await supabase
          .from("reports")
          .update(row)
          .eq("complaint_id", canonicalComplaintId)
          .select()
          .maybeSingle();

        savedData = updateResult.data;
        saveError = updateResult.error;
      }
    }

    if (saveError) {
      console.warn("SUPABASE PERSIST NOTICE:", saveError.message);
      return {
        success: false,
        error: saveError.message || "Failed to insert into public.reports",
      };
    }

    return {
      success: true,
      data: savedData || row,
    };
  } catch (err: any) {
    console.warn("SUPABASE PERSIST EXCEPTION:", err);
    return {
      success: false,
      error: err.message || "Network exception while inserting into public.reports",
    };
  }
}

/**
 * Fetches reports strictly belonging to the authenticated citizen (.eq('user_id', userId))
 * Enforces requirement: Do not download all reports and filter in JavaScript (Part 12 & 16).
 */
export async function fetchCitizenReportsFromSupabase(
  userId: string
): Promise<{ success: boolean; reports: Complaint[]; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) {
    return { success: false, reports: [], error: "Supabase client not initialized or invalid userId" };
  }

  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("SUPABASE CITIZEN REPORTS FETCH ERROR:", error);
      return { success: false, reports: [], error: error.message };
    }

    const parsed = (data || []).map(supabaseRowToComplaint);
    return { success: true, reports: parsed };
  } catch (err: any) {
    console.error("SUPABASE CITIZEN REPORTS FETCH ERROR:", err);
    return { success: false, reports: [], error: err.message };
  }
}

/**
 * Updates a report in Supabase with new status, timeline, or assignments (Admin & Author).
 */
export async function updateReportInSupabase(
  id: string,
  updates: Partial<Complaint>,
  adminNote?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: "Database client not available" };
  }

  try {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.status) updatePayload.status = updates.status;
    if (updates.priority) updatePayload.priority = updates.priority;
    if (updates.assignedTo !== undefined) updatePayload.assigned_to = updates.assignedTo;
    if (updates.assignedAt) updatePayload.assigned_at = updates.assignedAt;
    if (updates.resolvedAt) updatePayload.resolved_at = updates.resolvedAt;
    if (updates.timeline) updatePayload.timeline = updates.timeline;
    if (updates.incidentId !== undefined) updatePayload.incident_id = updates.incidentId;
    if (updates.citizenConfirmedResolution !== undefined) {
      updatePayload.citizen_confirmed_resolution = updates.citizenConfirmedResolution;
    }
    if (updates.citizenFeedback) updatePayload.citizen_feedback = updates.citizenFeedback;

    // Fetch existing raw_data to merge updates and preserve full priority score breakdown & incident info
    const idIsUUID = isValidUUID(id);
    let existingRaw: any = null;
    try {
      let query = supabase.from("reports").select("raw_data");
      if (idIsUUID) {
        query = query.or(`id.eq.${id},complaint_id.eq.${id}`);
      } else {
        query = query.eq("complaint_id", id);
      }
      const existingRes = await query.maybeSingle();
      if (existingRes?.data?.raw_data) {
        existingRaw = existingRes.data.raw_data;
      }
    } catch {
      // non-fatal
    }

    const mergedRaw = {
      ...(existingRaw || {}),
      ...updates,
      ...(updates.incidentId !== undefined ? { incidentId: updates.incidentId } : {}),
      ...(updates.priorityScoreData ? { priorityScoreData: updates.priorityScoreData } : {}),
      status: updates.status || existingRaw?.status || "SUBMITTED",
      updatedAt: updatePayload.updated_at,
    };
    updatePayload.raw_data = mergedRaw;

    let updateQuery = supabase.from("reports").update(updatePayload);
    if (idIsUUID) {
      updateQuery = updateQuery.or(`id.eq.${id},complaint_id.eq.${id}`);
    } else {
      updateQuery = updateQuery.eq("complaint_id", id);
    }
    let { data, error } = await updateQuery.select().maybeSingle();

    // If error was caused by incident_id column not existing yet, retry without incident_id column
    if (error && (error.message?.toLowerCase().includes("incident_id") || error.code === "42703")) {
      delete updatePayload.incident_id;
      let retryQuery = supabase.from("reports").update(updatePayload);
      if (idIsUUID) {
        retryQuery = retryQuery.or(`id.eq.${id},complaint_id.eq.${id}`);
      } else {
        retryQuery = retryQuery.eq("complaint_id", id);
      }
      const retryRes = await retryQuery.select().maybeSingle();
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) {
      console.error("SUPABASE REPORT UPDATE ERROR:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error("SUPABASE REPORT UPDATE ERROR:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetches all reports stored in the user's Supabase account.
 */
export async function fetchReportsFromSupabase(): Promise<{ success: boolean; reports: Complaint[]; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, reports: [], error: "Supabase client not initialized" };
  }

  try {
    // Try table 'reports'
    const { data: reportsData, error: reportsErr } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (!reportsErr && Array.isArray(reportsData)) {
      const parsed = reportsData.map(supabaseRowToComplaint);
      return { success: true, reports: parsed };
    }

    // Fallback: try table 'complaints'
    const { data: complaintsData, error: complaintsErr } = await supabase
      .from("complaints")
      .select("*")
      .order("created_at", { ascending: false });

    if (!complaintsErr && Array.isArray(complaintsData)) {
      const parsed = complaintsData.map(supabaseRowToComplaint);
      return { success: true, reports: parsed };
    }

    return {
      success: false,
      reports: [],
      error: reportsErr?.message || complaintsErr?.message || "Could not read reports from Supabase",
    };
  } catch (err: any) {
    return { success: false, reports: [], error: err.message || "Error contacting Supabase" };
  }
}

/**
 * Fetches a single complaint from Supabase by its id or complaint_id.
 */
export async function fetchComplaintFromSupabaseById(
  id: string
): Promise<{ success: boolean; complaint?: Complaint; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase || !id) {
    return { success: false, error: "Supabase not connected or ID empty" };
  }

  try {
    const idIsUUID = isValidUUID(id);

    // 1. Try 'reports' table searching by id OR complaint_id
    let reportQuery = supabase.from("reports").select("*");
    if (idIsUUID) {
      reportQuery = reportQuery.or(`id.eq.${id},complaint_id.eq.${id}`);
    } else {
      reportQuery = reportQuery.eq("complaint_id", id);
    }
    const { data: reportData, error: reportErr } = await reportQuery.limit(1).maybeSingle();

    if (!reportErr && reportData) {
      return { success: true, complaint: supabaseRowToComplaint(reportData) };
    }

    // 2. Fallback: try 'complaints' table
    let compQuery = supabase.from("complaints").select("*");
    if (idIsUUID) {
      compQuery = compQuery.or(`id.eq.${id},complaint_id.eq.${id}`);
    } else {
      compQuery = compQuery.eq("complaint_id", id);
    }
    const { data: compData, error: compErr } = await compQuery.limit(1).maybeSingle();

    if (!compErr && compData) {
      return { success: true, complaint: supabaseRowToComplaint(compData) };
    }

    return {
      success: false,
      error: reportErr?.message || compErr?.message || "Report not found in Supabase",
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Tests connection to the user's Supabase project.
 */
export async function testSupabaseConnection(): Promise<SupabaseSyncStatus> {
  const supabase = getSupabaseClient();
  const config = getSupabaseConfig();

  if (!supabase) {
    return {
      connected: false,
      tableExists: false,
      message: "Supabase connection is not configured or disabled.",
    };
  }

  try {
    // Test basic query to 'reports'
    const { data, count, error } = await supabase
      .from("reports")
      .select("id", { count: "exact", head: false })
      .limit(5);

    if (!error) {
      return {
        connected: true,
        tableExists: true,
        reportCount: count ?? (data?.length || 0),
        lastSyncedAt: new Date().toISOString(),
        message: `Connected successfully to Supabase Project (${config.projectId}). Table 'reports' is ready!`,
      };
    }

    // Check if table missing (e.g. relation does not exist / 42P01)
    if (error.code === "42P01" || error.message.includes("relation") || error.message.includes("does not exist")) {
      // Check 'complaints' table
      const { data: cData, count: cCount, error: cErr } = await supabase
        .from("complaints")
        .select("id", { count: "exact", head: false })
        .limit(5);

      if (!cErr) {
        return {
          connected: true,
          tableExists: true,
          reportCount: cCount ?? (cData?.length || 0),
          lastSyncedAt: new Date().toISOString(),
          message: `Connected to Supabase Project (${config.projectId}). Using 'complaints' table.`,
        };
      }

      return {
        connected: true,
        tableExists: false,
        message: `Connected to Supabase Project (${config.projectId}), but the 'reports' table needs to be created.`,
        error: "Table 'reports' does not exist yet. Please run the provided SQL script in your Supabase SQL Editor.",
      };
    }

    return {
      connected: false,
      tableExists: false,
      message: `Failed to connect to Supabase: ${error.message}`,
      error: error.message,
    };
  } catch (err: any) {
    return {
      connected: false,
      tableExists: false,
      message: `Connection failed: ${err.message}`,
      error: err.message,
    };
  }
}

/**
 * Synchronizes all local complaints to Supabase in batch.
 */
export async function syncAllLocalReportsToSupabase(complaints: Complaint[]): Promise<{
  successCount: number;
  failureCount: number;
  total: number;
  error?: string;
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { successCount: 0, failureCount: complaints.length, total: complaints.length, error: "Supabase client not active." };
  }

  const rows = complaints.map((c) => complaintToSupabaseRow(c));

  try {
    const { error: reportsError } = await supabase
      .from("reports")
      .upsert(rows, { onConflict: "id" });

    if (!reportsError) {
      return { successCount: complaints.length, failureCount: 0, total: complaints.length };
    }

    // Fallback: try one by one to count partial success
    let successCount = 0;
    let failureCount = 0;
    for (const c of complaints) {
      const res = await saveReportToSupabase(c);
      if (res.success) successCount++;
      else failureCount++;
    }

    return {
      successCount,
      failureCount,
      total: complaints.length,
      error: failureCount > 0 ? reportsError.message : undefined,
    };
  } catch (err: any) {
    return {
      successCount: 0,
      failureCount: complaints.length,
      total: complaints.length,
      error: err.message,
    };
  }
}
