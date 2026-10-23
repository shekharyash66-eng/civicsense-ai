export type ComplaintStatus =
  | "SUBMITTED"
  | "ACKNOWLEDGED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

export type ComplaintPriority = "low" | "medium" | "high" | "urgent";

export type IssueCategory =
  | "streetlight"
  | "pothole"
  | "garbage"
  | "water_leakage"
  | "drainage"
  | "road_damage"
  | "traffic_signal"
  | "public_toilet"
  | "stray_animal"
  | "illegal_dumping"
  | "other";

export type MunicipalDepartment =
  | "Electrical Maintenance"
  | "Road Maintenance"
  | "Waste Management"
  | "Water & Sewerage"
  | "Public Health"
  | "Traffic Management"
  | "Parks & Public Spaces"
  | "General Civic Services";

export interface TimelineEvent {
  id: string;
  status: ComplaintStatus;
  title: string;
  description: string;
  timestamp: string;
  actor: string;
  department?: string;
  technicianName?: string;
}

export interface Complaint {
  id: string;
  complaintId?: string; // Canonical identifier matching id
  citizenId: string;
  citizenName: string;
  citizenPhone?: string;
  category: IssueCategory;
  title: string;
  description: string;
  imageUrl?: string;
  latitude: number;
  longitude: number;
  address: string;
  ward: string;
  city: string;
  department: MunicipalDepartment;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  createdAt: string;
  updatedAt: string;
  assignedAt?: string;
  assignedTo?: string;
  resolvedAt?: string;
  estimatedResolution?: string;
  aiConfidence: number;
  aiSuggestedCategory: IssueCategory;
  aiSuggestedDepartment: MunicipalDepartment;
  timeline: TimelineEvent[];
  citizenConfirmedResolution?: boolean;
  citizenFeedback?: {
    rating: number;
    comment?: string;
    confirmedAt: string;
  };
  priorityScoreData?: CivicPriorityScore;
  duplicateInfo?: {
    isPotentialDuplicate?: boolean;
    clusterId?: string;
    matchedDuplicates?: DuplicateMatch[];
    duplicateCount?: number;
  };
  immediateSafetyHazard?: boolean;
  incidentId?: string; // Persistent shared incident ID (e.g. INC-2026-0428)
}

export type CivicPriorityBand = "Critical" | "High" | "Medium" | "Low";

export interface CivicIncident {
  id: string; // UUID primary key
  incidentId: string; // Canonical identifier e.g. "INC-2026-0428"
  title: string;
  category: IssueCategory;
  department: MunicipalDepartment;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  primaryReportId: string;
  reportCount: number;
  reportIds: string[];
  confirmedBy?: string;
  confirmedByEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export type DuplicateReviewStatus = "PENDING" | "CONFIRMED" | "REJECTED";

export interface DuplicateReviewRecord {
  id: string;
  pairKey: string; // Canonical sorted key "ID_A::ID_B"
  complaintId1: string;
  complaintId2: string;
  decision: "CONFIRMED" | "REJECTED";
  incidentId?: string;
  similarityScore: number;
  matchingReasons?: string[];
  reviewNotes?: string;
  reviewedBy: string;
  reviewedByEmail: string;
  reviewedAt: string;
}

export interface DuplicateCandidatePair {
  pairKey: string;
  complaint1: Complaint;
  complaint2: Complaint;
  similarityScore: number; // 0 - 100
  confidence: "high" | "moderate" | "low";
  distanceMeters: number | null;
  timeDiffHours: number;
  reasons: string[];
  reviewStatus: DuplicateReviewStatus;
  incidentId?: string;
  reviewedAt?: string;
  reviewedByEmail?: string;
}

export interface CivicPriorityBreakdown {
  safetyRisk: number; // 0-100 (40% weight)
  severity: number; // 0-100 (25% weight)
  affectedPopulation: number; // 0-100 (20% weight)
  unresolvedTime: number; // 0-100 (15% weight)
  weights: {
    safetyRisk: number;
    severity: number;
    affectedPopulation: number;
    unresolvedTime: number;
  };
  safetyEvidence: string;
  populationEvidence: string;
  unresolvedHours: number;
  immediateHazardFlag: boolean;
  isFallbackUsed: boolean;
  uncertaintyNotes?: string;
}

export interface CivicPriorityScore {
  score: number; // 0-100
  band: CivicPriorityBand;
  factors: CivicPriorityBreakdown;
  version: string; // e.g. "v1.0"
  explanation: string;
  calculatedAt: string;
}

export interface DuplicateMatch {
  complaintId: string;
  title: string;
  category: IssueCategory;
  similarityScore: number; // 0 - 100
  confidence: "high" | "moderate" | "low";
  distanceMeters: number;
  timeDiffHours: number;
  reasons: string[];
  status: ComplaintStatus;
  createdAt: string;
}

export type LocationSource = "GPS" | "MANUAL" | "IP";

export type LocationPermissionState =
  | "unknown"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable"
  | "error";

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number; // Estimated accuracy radius in meters

  formattedAddress?: string;
  addressLine?: string;
  neighborhood?: string;
  locality?: string;

  city?: string;
  district?: string;
  state?: string;

  postalCode?: string;
  country?: string;
  countryCode?: string;

  source: LocationSource;
  updatedAt: string;
}

export interface GeocodedLocation {
  formattedAddress: string;
  addressLine?: string;
  neighborhood?: string;
  locality?: string;
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  countryCode?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  city?: string;
  state?: string;
  ward?: string;
  role: "citizen" | "admin" | "technician";
  avatarUrl?: string;
  createdAt: string;
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    inApp: boolean;
  };
  location?: UserLocation;
  verifiedCitizen?: boolean;
}

export interface CivicNotification {
  id: string;
  complaintId: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: "status_change" | "assignment" | "resolution" | "system";
}

export interface AIChatMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
  timestamp: string;
}

export interface AIAnalysisResult {
  category: IssueCategory;
  title: string;
  description: string;
  priority: ComplaintPriority;
  suggestedDepartment: MunicipalDepartment;
  confidence: number;
  detectedWardHint?: string;
  clarifyingQuestion?: string | null;
}

export type AssistantIntent =
  | "GENERAL_APP_QUESTION"
  | "HOW_TO_REPORT"
  | "CREATE_COMPLAINT"
  | "TRACK_COMPLAINT"
  | "COMPLAINT_STATUS"
  | "COMPLAINT_DETAILS"
  | "DEPARTMENT_QUESTION"
  | "LOCATION_HELP"
  | "IMAGE_ANALYSIS"
  | "EDIT_COMPLAINT"
  | "RESOLUTION_CONFIRMATION"
  | "PROFILE_HELP"
  | "NOTIFICATION_HELP"
  | "GENERAL_CIVIC_INFORMATION"
  | "OUT_OF_SCOPE"
  | "EMERGENCY";

export interface AssistantActionButton {
  label: string;
  action:
    | "GO_REPORT"
    | "GO_COMPLAINTS"
    | "GO_COMPLAINT"
    | "GO_MAP"
    | "GO_DASHBOARD"
    | "GO_PROFILE"
    | "REVIEW_COMPLAINT"
    | "CONFIRM_FIX"
    | "UPLOAD_IMAGE";
  complaintId?: string;
  route?: string;
  draftData?: ComplaintDraftInput;
}

export interface ComplaintDraftInput {
  title?: string;
  description?: string;
  category?: IssueCategory;
  department?: MunicipalDepartment;
  priority?: ComplaintPriority;
  image?: string;
  ward?: string;
  address?: string;
  coords?: { lat: number; lng: number };
}

export interface AssistantMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  imageUri?: string;
  intent?: AssistantIntent;
  complaintCard?: Complaint;
  analysisCard?: {
    category: IssueCategory;
    title: string;
    suggestedDepartment: MunicipalDepartment;
    priority: ComplaintPriority;
    confidence: number;
    description: string;
    imageUri?: string;
  };
  actionButtons?: AssistantActionButton[];
}

export interface AssistantAppContext {
  currentPage: string;
  currentComplaintId?: string;
  currentUser?: {
    id: string;
    name: string;
    city?: string;
    ward?: string;
  };
  userComplaintsSummary?: Array<{
    id: string;
    title: string;
    status: ComplaintStatus;
    department: MunicipalDepartment;
    ward?: string;
    updatedAt?: string;
  }>;
}

export interface AssistantResponse {
  reply: string;
  intent: AssistantIntent;
  matchedComplaintId?: string;
  complaintData?: Complaint;
  analysisCard?: AssistantMessage["analysisCard"];
  draftData?: ComplaintDraftInput;
  actionButtons?: AssistantActionButton[];
}

export interface UserProfile {
  id: string;
  email: string;
  role: "citizen" | "admin";
  full_name: string;
  phone: string;
  citizen_id?: string;
  ward?: string;
  city?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  admin_email: string;
  action: string;
  target_report_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}
