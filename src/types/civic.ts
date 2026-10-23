export type PriorityLevel = 'Critical' | 'High' | 'Medium' | 'Low';

export type ComplaintStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Verified'
  | 'Assigned'
  | 'In Progress'
  | 'Resolved'
  | 'Rejected';

export type CivicCategory =
  | 'Potholes & Road Damage'
  | 'Garbage & Sanitation'
  | 'Water Leakage & Drainage'
  | 'Broken Streetlights & Electrical'
  | 'Public Infrastructure Damage'
  | 'Pedestrian & Traffic Safety'
  | 'Other Civic Issues';

export type UserRole = 'Citizen' | 'Administrator' | 'Department Officer';

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  phone?: string;
  department_id?: string; // for Department Officer
  status?: 'active' | 'disabled';
  created_at: string;
}

export interface UserRecord extends User {
  password_hash: string;
  email_verified: boolean;
  last_login_at?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: User;
  debugResetToken?: string;
}

export interface AIAnalysis {
  category: CivicCategory;
  summary: string;
  severity_score: number; // 0-100
  safety_risk_score: number; // 0-100
  affected_population_score: number | null; // 0-100 or null
  suggested_department: string;
  possible_emergency: boolean;
  reasoning: string[];
  missing_information: string[];
  isFallback?: boolean;
}

export interface StatusHistoryEntry {
  id: string;
  complaint_id: string;
  previous_status: ComplaintStatus | null;
  new_status: ComplaintStatus;
  note: string;
  changed_by: string;
  changed_by_role: UserRole;
  changed_at: string; // ISO
}

export interface Complaint {
  id: string; // e.g. "CIV-8942"
  title: string;
  description: string;
  category: CivicCategory;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  image_url?: string;
  submitted_at: string; // ISO
  status: ComplaintStatus;
  
  // Prioritization factors (0-100)
  priority_score: number;
  priority_level: PriorityLevel;
  safety_risk_score: number;
  severity_score: number;
  population_impact_score: number;
  time_unresolved_score: number;
  is_emergency_flagged: boolean;
  
  assigned_department_id: string | null;
  related_incident_id: string | null;
  
  ai_analysis?: AIAnalysis;
  resolution_note?: string;
  resolution_photo?: string;
  resolved_at?: string;
  citizen_confirmed_resolved?: boolean;
  
  // Reporter info (kept private from public tracking)
  reporter_name?: string;
  reporter_email?: string;
  reporter_phone?: string;
  
  is_demo?: boolean;
  manual_priority_override?: {
    original_score: number;
    new_score: number;
    reason: string;
    overridden_by: string;
    overridden_at: string;
  };
}

export interface Incident {
  id: string; // e.g. "INC-204"
  title: string;
  description: string;
  category: CivicCategory;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  related_complaint_ids: string[];
  grouping_confidence: number; // 0-100
  explanation: string;
  status: 'Proposed' | 'Confirmed' | 'Rejected' | 'Resolved';
  assigned_department_id: string | null;
  highest_priority: PriorityLevel;
  estimated_affected_population: number | null; // estimated count, null if unknown
  recommended_next_action: string;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  category_specialty: CivicCategory[];
  description: string;
  head_officer: string;
  contact_email: string;
  contact_phone: string;
  active: boolean;
  sla_target_hours: number;
}

export interface PriorityWeights {
  safety_risk: number; // 40
  severity: number; // 25
  population_impact: number; // 20
  time_unresolved: number; // 15
}
