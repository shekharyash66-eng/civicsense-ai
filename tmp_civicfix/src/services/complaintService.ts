import { Complaint, ComplaintStatus, TimelineEvent, CivicNotification, User, MunicipalDepartment, DuplicateMatch } from "../types";
import { INITIAL_COMPLAINTS, INITIAL_NOTIFICATIONS, DEFAULT_USER } from "../data/mockData";
import {
  saveReportToSupabase,
  fetchReportsFromSupabase,
  fetchComplaintFromSupabaseById,
  syncAllLocalReportsToSupabase,
} from "./supabaseService";
import { enrichComplaintWithPriority, calculateCivicPriorityScore } from "./civicPriorityService";
import { findPotentialDuplicates, compareComplaints } from "./duplicateDetectionService";

const STORAGE_KEY_COMPLAINTS = "civicfix_complaints";
const STORAGE_KEY_NOTIFS = "civicfix_notifications_v1";
const STORAGE_KEY_USER = "civicfix_user_v1";

type Listener = () => void;
const listeners: Set<Listener> = new Set();

// Broadcast channel for multi-tab or iframe instant sync
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    broadcastChannel = new BroadcastChannel("civicfix_realtime_channel");
    broadcastChannel.onmessage = () => {
      notifyAll();
    };
  }
} catch (e) {
  // Graceful fallback
}

function notifyAll() {
  listeners.forEach((l) => l());
}

export function subscribeToComplaints(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Normalizes user-entered or route-derived complaint IDs:
 * - Trims whitespace
 * - Decodes URI components
 * - Normalizes to uppercase
 * - Formats CF20260428 -> CF-2026-0428 or CF1024 -> CF-1024
 */
export function normalizeComplaintId(inputId: string | null | undefined): string {
  if (!inputId || typeof inputId !== "string") return "";
  let clean = "";
  try {
    clean = decodeURIComponent(inputId).trim().toUpperCase();
  } catch {
    clean = inputId.trim().toUpperCase();
  }

  // Strip leading hashtag or symbol e.g. #CF-1024 or #2026-0428
  clean = clean.replace(/^[#№\s]+/, "");

  // Remove space around hyphens: e.g. "CF - 2026 - 0428" -> "CF-2026-0428"
  clean = clean.replace(/\s*-\s*/g, "-");
  // Compact remaining spaces
  clean = clean.replace(/\s+/g, "");

  // If user entered without "CF-", e.g. "2026-0428" or "20260428" or "1024"
  if (/^\d{4}-\d{4}$/.test(clean)) {
    clean = `CF-${clean}`;
  } else if (/^\d{8}$/.test(clean)) {
    clean = `CF-${clean.slice(0, 4)}-${clean.slice(4)}`;
  } else if (/^\d{4}$/.test(clean)) {
    clean = `CF-${clean}`;
  }

  // Unhyphenated 8-digit pattern: CF20260428 -> CF-2026-0428
  if (/^CF(\d{4})(\d{4})$/.test(clean)) {
    clean = clean.replace(/^CF(\d{4})(\d{4})$/, "CF-$1-$2");
  } else if (/^CF(\d{4})$/.test(clean)) {
    // Legacy 4-digit pattern: CF1024 -> CF-1024
    clean = clean.replace(/^CF(\d{4})$/, "CF-$1");
  }
  return clean;
}

let memoryComplaints: Complaint[] = [...INITIAL_COMPLAINTS];

export function getStoredComplaints(): Complaint[] {
  if (typeof window === "undefined") return memoryComplaints;
  try {
    let raw = localStorage.getItem(STORAGE_KEY_COMPLAINTS);
    // Backward compatibility fallback
    if (!raw) {
      raw = localStorage.getItem("civicfix_complaints_v1");
    }

    if (!raw) {
      localStorage.setItem(STORAGE_KEY_COMPLAINTS, JSON.stringify(INITIAL_COMPLAINTS));
      memoryComplaints = [...INITIAL_COMPLAINTS];
      return INITIAL_COMPLAINTS;
    }

    let parsed: Complaint[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEY_COMPLAINTS, JSON.stringify(INITIAL_COMPLAINTS));
      memoryComplaints = [...INITIAL_COMPLAINTS];
      return INITIAL_COMPLAINTS;
    }

    // Ensure all complaints have matching canonical id and complaintId fields, and compute civic priority & duplicate info
    let needsResave = false;
    parsed = parsed.map((c) => {
      const canonicalId = c.id || c.complaintId || "";
      let item = c;
      if (!c.complaintId || c.complaintId !== canonicalId || !c.id) {
        needsResave = true;
        item = {
          ...c,
          id: canonicalId,
          complaintId: canonicalId,
        };
      }
      return item;
    });

    // Verify required demo complaints are present (CF-2026-0428, CF-2026-1024, CF-2026-1735, CF-2026-2841, CF-2026-3912)
    const existingIds = new Set(parsed.map((c) => normalizeComplaintId(c.complaintId || c.id)));
    for (const demoComp of INITIAL_COMPLAINTS) {
      const normDemoId = normalizeComplaintId(demoComp.id);
      if (!existingIds.has(normDemoId)) {
        parsed.push(demoComp);
        existingIds.add(normDemoId);
        needsResave = true;
      }
    }

    // Enrich with transparent priority score and duplicate relationships
    parsed = ensureComplaintsEnriched(parsed);

    if (needsResave) {
      localStorage.setItem(STORAGE_KEY_COMPLAINTS, JSON.stringify(parsed));
    }

    memoryComplaints = parsed;
    return parsed;
  } catch (err) {
    console.warn("Failed to read complaints from storage, using initial state:", err);
    const fallback = ensureComplaintsEnriched(memoryComplaints.length > 0 ? memoryComplaints : INITIAL_COMPLAINTS);
    memoryComplaints = fallback;
    return fallback;
  }
}

/**
 * Enriches every complaint in a list with deterministic Civic Priority Score and duplicate linkages.
 */
export function ensureComplaintsEnriched(list: Complaint[]): Complaint[] {
  return list.map((c) => {
    const withPriority = enrichComplaintWithPriority(c);
    const duplicates = findPotentialDuplicates(
      {
        category: withPriority.category,
        title: withPriority.title,
        description: withPriority.description,
        latitude: withPriority.latitude,
        longitude: withPriority.longitude,
        createdAt: withPriority.createdAt,
        currentComplaintId: withPriority.complaintId || withPriority.id,
      },
      list
    );

    return {
      ...withPriority,
      incidentId: c.incidentId || withPriority.incidentId,
      duplicateInfo: {
        isPotentialDuplicate: duplicates.length > 0 || Boolean(c.incidentId),
        clusterId: c.incidentId || c.duplicateInfo?.clusterId,
        matchedDuplicates: duplicates,
        duplicateCount: duplicates.length,
      },
    };
  });
}

export function saveComplaints(complaints: Complaint[]) {
  memoryComplaints = complaints;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_COMPLAINTS, JSON.stringify(complaints));
    notifyAll();
    broadcastChannel?.postMessage({ type: "UPDATE_COMPLAINTS" });
  } catch (err) {
    console.warn("Failed to save complaints to localStorage:", err);
  }
}

/**
 * Synchronizes local complaints with the user's Supabase account.
 */
export async function syncWithSupabase(): Promise<{ synced: number; remoteCount: number }> {
  try {
    const result = await fetchReportsFromSupabase();
    if (result.success && result.reports.length > 0) {
      const local = getStoredComplaints();
      const localMap = new Map<string, Complaint>();
      local.forEach((c) => {
        const id = normalizeComplaintId(c.complaintId || c.id);
        if (id) localMap.set(id, c);
      });

      // Merge remote reports into local store
      let hasChanges = false;
      result.reports.forEach((remote) => {
        const remoteNorm = normalizeComplaintId(remote.complaintId || remote.id);
        if (!remoteNorm) return;

        const existing = localMap.get(remoteNorm);
        if (!existing) {
          local.unshift(remote);
          localMap.set(remoteNorm, remote);
          hasChanges = true;
        } else {
          // Compare updated timestamps if present
          const remoteTime = new Date(remote.updatedAt || remote.createdAt || 0).getTime();
          const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
          if (remoteTime > localTime) {
            const idx = local.findIndex((l) => normalizeComplaintId(l.complaintId || l.id) === remoteNorm);
            if (idx !== -1) {
              local[idx] = { ...existing, ...remote };
              hasChanges = true;
            }
          }
        }
      });

      if (hasChanges) {
        saveComplaints(local);
      }
      return { synced: result.reports.length, remoteCount: result.reports.length };
    }
  } catch (err) {
    console.warn("[Supabase] Background sync failed:", err);
  }
  return { synced: 0, remoteCount: 0 };
}

// Automatically sync with Supabase on client boot
if (typeof window !== "undefined") {
  setTimeout(() => {
    syncWithSupabase().catch(() => {});
  }, 1000);
}

export function getComplaintById(inputId: string | null | undefined): Complaint | null {
  if (!inputId || typeof inputId !== "string") return null;
  const normalized = normalizeComplaintId(inputId);
  if (!normalized) return null;

  const complaints = getStoredComplaints();
  console.log("Tracking complaint:", normalized);
  console.log(
    "Available complaint IDs:",
    complaints.map((c) => c.complaintId || c.id)
  );

  // 1. Direct match on id or complaintId
  let found = complaints.find(
    (c) =>
      normalizeComplaintId(c.id) === normalized ||
      normalizeComplaintId(c.complaintId) === normalized
  );

  // 2. Flexible cross-matching: CF-1024 <-> CF-2026-1024
  if (!found) {
    found = complaints.find((c) => {
      const cNorm = normalizeComplaintId(c.complaintId || c.id);
      if (normalized.startsWith("CF-") && !normalized.includes("-2026-")) {
        const num = normalized.replace("CF-", "");
        if (cNorm === `CF-2026-${num}` || cNorm.endsWith(`-${num}`)) return true;
      }
      if (cNorm.startsWith("CF-") && !cNorm.includes("-2026-")) {
        const num = cNorm.replace("CF-", "");
        if (normalized === `CF-2026-${num}` || normalized.endsWith(`-${num}`)) return true;
      }
      return false;
    });
  }

  console.log("Complaint found:", found || null);
  return found || null;
}

/**
 * Retrieves complaint by ID, first checking local memory, then querying Supabase directly if not found.
 */
export async function getComplaintByIdAsync(inputId: string | null | undefined): Promise<Complaint | null> {
  const local = getComplaintById(inputId);
  if (local) return local;

  const normalized = normalizeComplaintId(inputId);
  if (!normalized) return null;

  try {
    const remote = await fetchComplaintFromSupabaseById(normalized);
    if (remote.success && remote.complaint) {
      // Merge into local store so future lookups and lists have it
      const current = getStoredComplaints();
      const exists = current.some((c) => normalizeComplaintId(c.complaintId || c.id) === normalized);
      if (!exists) {
        saveComplaints([remote.complaint, ...current]);
      }
      return remote.complaint;
    }
  } catch (err) {
    console.warn("[Supabase] Direct getComplaintByIdAsync error:", err);
  }

  return null;
}

export function createComplaint(
  draft: Omit<Complaint, "id" | "createdAt" | "updatedAt" | "status" | "timeline">
): Complaint {
  const complaints = getStoredComplaints();
  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const newId = `CF-${year}-${randomNum}`;
  const now = new Date();
  const timeFormatted =
    now.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ", " +
    now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const initialTimeline: TimelineEvent[] = [
    {
      id: `tl-${Date.now()}-1`,
      status: "SUBMITTED",
      title: "Complaint Received",
      description: "Photo & GPS verified report registered with municipal triage.",
      timestamp: timeFormatted,
      actor: draft.citizenName || "Citizen",
    },
  ];

  const baseComplaint: Complaint = {
    ...draft,
    id: newId,
    complaintId: newId,
    status: "SUBMITTED",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    timeline: initialTimeline,
    estimatedResolution: "1–3 days",
  };

  // Calculate transparent civic priority score
  let scoredComplaint = enrichComplaintWithPriority(baseComplaint);

  // Check for potential duplicate reports
  const duplicates = findPotentialDuplicates(
    {
      category: scoredComplaint.category,
      title: scoredComplaint.title,
      description: scoredComplaint.description,
      latitude: scoredComplaint.latitude,
      longitude: scoredComplaint.longitude,
      createdAt: scoredComplaint.createdAt,
      currentComplaintId: scoredComplaint.id,
    },
    complaints
  );

  if (duplicates.length > 0) {
    scoredComplaint = {
      ...scoredComplaint,
      duplicateInfo: {
        isPotentialDuplicate: true,
        matchedDuplicates: duplicates,
        duplicateCount: duplicates.length,
      },
    };
  }

  const updated = [scoredComplaint, ...complaints];
  saveComplaints(updated);

  // Persist to Supabase account (table 'reports') - awaited to guarantee insertion
  saveReportToSupabase(scoredComplaint)
    .then((res) => {
      if (res.success) {
        console.log(`[Supabase] Confirmed persistence in public.reports for #${newId}`);
      } else {
        console.warn("[Supabase] Report persistence notice:", res.error);
      }
    })
    .catch((err) => {
      console.warn("[Supabase] Report persistence exception:", err);
    });

  // Add notification
  addNotification({
    complaintId: newId,
    title: "Complaint Submitted Successfully",
    message: `Your complaint #${newId} for ${scoredComplaint.title} has been routed to ${scoredComplaint.department}.`,
    type: "status_change",
  });

  return scoredComplaint;
}

export function updateComplaintStatus(
  id: string,
  newStatus: ComplaintStatus,
  note?: string,
  actor = "Municipal Operations Desk",
  assignedDepartment?: string,
  technicianName?: string
): Complaint | undefined {
  const complaints = getStoredComplaints();
  const normalized = normalizeComplaintId(id);
  const index = complaints.findIndex(
    (c) => normalizeComplaintId(c.complaintId || c.id) === normalized
  );
  if (index === -1) return undefined;

  const target = complaints[index];
  const now = new Date();
  const timeFormatted = now.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ", " +
    now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  let eventTitle = "Status Updated";
  let defaultDesc = `Status transitioned to ${newStatus}.`;

  if (newStatus === "ACKNOWLEDGED") {
    eventTitle = "Triage Acknowledged";
    defaultDesc = "Municipal desk reviewed evidence and validated priority.";
  } else if (newStatus === "ASSIGNED") {
    eventTitle = "Assigned to Field Squad";
    defaultDesc = `Assigned to ${assignedDepartment || target.department} division.`;
  } else if (newStatus === "IN_PROGRESS") {
    eventTitle = "Field Work In Progress";
    defaultDesc = technicianName
      ? `Field technician ${technicianName} on site resolving the issue.`
      : "Crew dispatched to location with repair equipment.";
  } else if (newStatus === "RESOLVED") {
    eventTitle = "Civic Problem Resolved";
    defaultDesc = "Field crew completed rectification. Awaiting citizen confirmation.";
  } else if (newStatus === "CLOSED") {
    eventTitle = "Case Closed";
    defaultDesc = "Resolution confirmed by citizen. Case archived.";
  }

  const newTimelineEvent: TimelineEvent = {
    id: `tl-${Date.now()}`,
    status: newStatus,
    title: eventTitle,
    description: note || defaultDesc,
    timestamp: timeFormatted,
    actor,
    department: assignedDepartment || target.department,
    technicianName,
  };

  const rawUpdatedComplaint: Complaint = {
    ...target,
    status: newStatus,
    updatedAt: now.toISOString(),
    department: (assignedDepartment as any) || target.department,
    timeline: [...target.timeline, newTimelineEvent],
    assignedAt: newStatus === "ASSIGNED" ? now.toISOString() : target.assignedAt,
    resolvedAt: newStatus === "RESOLVED" ? now.toISOString() : target.resolvedAt,
  };

  // Recalculate priority score when complaint status/resolved timestamp changes
  const updatedComplaint = enrichComplaintWithPriority(rawUpdatedComplaint);

  complaints[index] = updatedComplaint;
  saveComplaints(complaints);

  // Sync update to Supabase
  saveReportToSupabase(updatedComplaint).catch(() => {});

  // Dispatch notification
  addNotification({
    complaintId: target.id,
    title: `Status: ${newStatus.replace("_", " ")}`,
    message: `Complaint #${target.id} (${target.title}) is now ${newStatus.replace("_", " ")}.`,
    type: newStatus === "RESOLVED" ? "resolution" : newStatus === "ASSIGNED" ? "assignment" : "status_change",
  });

  return updatedComplaint;
}

export function confirmCitizenResolution(
  id: string,
  rating: number,
  comment?: string
): Complaint | undefined {
  const complaints = getStoredComplaints();
  const normalized = normalizeComplaintId(id);
  const index = complaints.findIndex(
    (c) => normalizeComplaintId(c.complaintId || c.id) === normalized
  );
  if (index === -1) return undefined;

  const target = complaints[index];
  const now = new Date();
  const timeFormatted = now.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ", " +
    now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const confirmEvent: TimelineEvent = {
    id: `tl-${Date.now()}`,
    status: "CLOSED",
    title: "Citizen Confirmed Resolution",
    description: `Citizen verified repair with ${rating}★ feedback. ${comment ? `Note: "${comment}"` : ""}`,
    timestamp: timeFormatted,
    actor: target.citizenName,
  };

  const updated: Complaint = {
    ...target,
    status: "CLOSED",
    citizenConfirmedResolution: true,
    citizenFeedback: {
      rating,
      comment,
      confirmedAt: timeFormatted,
    },
    updatedAt: now.toISOString(),
    timeline: [...target.timeline, confirmEvent],
  };

  complaints[index] = updated;
  saveComplaints(complaints);

  // Sync to Supabase
  saveReportToSupabase(updated).catch(() => {});

  return updated;
}

export function assignComplaintToStaff(id: string, staffName: string): Complaint | undefined {
  const complaints = getStoredComplaints();
  const normalized = normalizeComplaintId(id);
  const index = complaints.findIndex(
    (c) => normalizeComplaintId(c.complaintId || c.id) === normalized
  );
  if (index === -1) return undefined;

  const target = complaints[index];
  const now = new Date();
  const timeFormatted = now.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ", " +
    now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const assignEvent: TimelineEvent = {
    id: `tl-${Date.now()}`,
    status: "ASSIGNED",
    title: "Assigned to Field Squad",
    description: `Assigned to ${staffName}. Crew alerted with GPS route and evidence.`,
    timestamp: timeFormatted,
    actor: "Municipal Dispatch",
    department: target.department,
    technicianName: staffName,
  };

  const updated: Complaint = {
    ...target,
    status: target.status === "SUBMITTED" || target.status === "ACKNOWLEDGED" ? "ASSIGNED" : target.status,
    assignedTo: staffName,
    updatedAt: now.toISOString(),
    timeline: [...target.timeline, assignEvent],
  };

  complaints[index] = updated;
  saveComplaints(complaints);

  // Sync to Supabase
  saveReportToSupabase(updated).catch(() => {});

  addNotification({
    complaintId: target.id,
    title: "Technician Dispatched",
    message: `Complaint #${target.id} has been assigned to ${staffName}.`,
    type: "assignment",
  });

  return updated;
}

export function updateComplaint(updated: Complaint): Complaint {
  const complaints = getStoredComplaints();
  const normalized = normalizeComplaintId(updated.complaintId || updated.id);
  const index = complaints.findIndex(
    (c) => normalizeComplaintId(c.complaintId || c.id) === normalized
  );
  if (index !== -1) {
    complaints[index] = {
      ...updated,
      id: updated.id || updated.complaintId || "",
      complaintId: updated.complaintId || updated.id || "",
      updatedAt: new Date().toISOString(),
    };
    saveComplaints(complaints);
    // Sync to Supabase
    saveReportToSupabase(complaints[index]).catch(() => {});
    return complaints[index];
  }
  return updated;
}

// Notifications Service
export function getStoredNotifications(): CivicNotification[] {
  if (typeof window === "undefined") return INITIAL_NOTIFICATIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTIFS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(INITIAL_NOTIFICATIONS));
      return INITIAL_NOTIFICATIONS;
    }
    return JSON.parse(raw);
  } catch (err) {
    return INITIAL_NOTIFICATIONS;
  }
}

export function addNotification(notif: Omit<CivicNotification, "id" | "timestamp" | "read">) {
  const current = getStoredNotifications();
  const newNotif: CivicNotification = {
    ...notif,
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: "Just now",
    read: false,
  };
  const updated = [newNotif, ...current];
  try {
    localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(updated));
    notifyAll();
  } catch (e) {}
}

export function markNotificationAsRead(id: string) {
  const current = getStoredNotifications();
  const updated = current.map((n) => (n.id === id ? { ...n, read: true } : n));
  localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(updated));
  notifyAll();
}

export function markAllNotificationsRead() {
  const current = getStoredNotifications();
  const updated = current.map((n) => ({ ...n, read: true }));
  localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(updated));
  notifyAll();
}

// User state management
const STORAGE_KEY_USER_PROFILES = "civicfix_profiles_v2";

export function getActiveUser(): User {
  if (typeof window === "undefined") return DEFAULT_USER;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(DEFAULT_USER));
      return DEFAULT_USER;
    }
    const user = JSON.parse(raw);
    // If a saved profile exists in the per-user map, merge it to keep user-specific locations isolated
    const profilesRaw = localStorage.getItem(STORAGE_KEY_USER_PROFILES);
    if (profilesRaw) {
      const profiles = JSON.parse(profilesRaw);
      if (profiles[user.id]) {
        return { ...user, ...profiles[user.id] };
      }
    }
    return user;
  } catch (err) {
    return DEFAULT_USER;
  }
}

export function setActiveUser(user: User) {
  try {
    // 1. Save as current active user
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    // 2. Persist in per-user isolated profiles map
    const profilesRaw = localStorage.getItem(STORAGE_KEY_USER_PROFILES);
    const profiles = profilesRaw ? JSON.parse(profilesRaw) : {};
    profiles[user.id] = user;
    localStorage.setItem(STORAGE_KEY_USER_PROFILES, JSON.stringify(profiles));
  } catch (e) {
    console.warn("Could not write user to localStorage", e);
  }
  notifyAll();
}

export function updateUserProfile(updates: Partial<User>): User {
  const current = getActiveUser();
  const updated: User = {
    ...current,
    ...updates,
  };
  // Sync top-level city & ward if location provided
  if (updates.location) {
    if (updates.location.city) {
      updated.city = updates.location.city;
    }
    if (updates.location.neighborhood || updates.location.addressLine) {
      updated.ward = updates.location.neighborhood || updates.location.addressLine || updated.ward;
    }
    if (updates.location.state) {
      updated.state = updates.location.state;
    }
  }
  setActiveUser(updated);
  return updated;
}

export function resetToDemoData() {
  localStorage.setItem(STORAGE_KEY_COMPLAINTS, JSON.stringify(INITIAL_COMPLAINTS));
  localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(INITIAL_NOTIFICATIONS));
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(DEFAULT_USER));
  localStorage.removeItem(STORAGE_KEY_USER_PROFILES);
  notifyAll();
  broadcastChannel?.postMessage({ type: "RESET" });
}

// Convenient alias exports
export const getComplaints = getStoredComplaints;
export const getAllComplaints = getStoredComplaints;
export const getNotifications = getStoredNotifications;
export const subscribeToNotifications = subscribeToComplaints;

export function getMyComplaints(citizenId?: string): Complaint[] {
  const complaints = getStoredComplaints();
  const user = getActiveUser();
  const idToMatch = citizenId || user.id;
  return complaints.filter((c) => c.citizenId === idToMatch || c.citizenName === user.name);
}

export const getUserComplaints = getMyComplaints;

export function getComplaintStatus(id: string): { status?: ComplaintStatus; complaint?: Complaint } {
  const c = getComplaintById(id);
  return { status: c?.status, complaint: c };
}

export function suggestDepartment(issueText: string): MunicipalDepartment {
  const lower = (issueText || "").toLowerCase();
  if (lower.includes("light") || lower.includes("lamp") || lower.includes("pole") || lower.includes("dark") || lower.includes("bulb")) {
    return "Electrical Maintenance";
  }
  if (lower.includes("pothole") || lower.includes("road") || lower.includes("asphalt") || lower.includes("tar") || lower.includes("speed breaker") || lower.includes("crater")) {
    return "Road Maintenance";
  }
  if (lower.includes("garbage") || lower.includes("trash") || lower.includes("waste") || lower.includes("dump") || lower.includes("bin") || lower.includes("litter") || lower.includes("debris")) {
    return "Waste Management";
  }
  if (lower.includes("water") || lower.includes("leak") || lower.includes("pipe") || lower.includes("drain") || lower.includes("sewer") || lower.includes("gutter") || lower.includes("flooding")) {
    return "Water & Sewerage";
  }
  if (lower.includes("traffic") || lower.includes("signal") || lower.includes("junction") || lower.includes("zebra") || lower.includes("pedestrian")) {
    return "Traffic Management";
  }
  if (lower.includes("park") || lower.includes("tree") || lower.includes("branch") || lower.includes("garden") || lower.includes("grass")) {
    return "Parks & Public Spaces";
  }
  return "General Civic Services";
}

export function checkPotentialDuplicatesForDraft(
  category: any,
  title: string,
  description: string,
  latitude: number,
  longitude: number
): DuplicateMatch[] {
  const complaints = getStoredComplaints();
  return findPotentialDuplicates(
    {
      category,
      title,
      description,
      latitude,
      longitude,
    },
    complaints
  );
}

export function recalculateAllComplaintScores(): Complaint[] {
  const complaints = getStoredComplaints();
  const rescored = ensureComplaintsEnriched(complaints);
  saveComplaints(rescored);
  return rescored;
}

