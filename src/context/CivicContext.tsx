import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  Complaint,
  ComplaintStatus,
  Department,
  Incident,
  PriorityWeights,
  StatusHistoryEntry,
  User,
  UserRole,
  AuthResponse,
} from '../types/civic';
import { INITIAL_DEPARTMENTS } from '../data/initialData';
import { DEFAULT_PRIORITY_WEIGHTS } from '../services/priorityEngine';

interface CivicContextType {
  complaints: Complaint[];
  incidents: Incident[];
  departments: Department[];
  statusHistory: StatusHistoryEntry[];
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  selectedOfficerDeptId: string;
  setSelectedOfficerDeptId: (id: string) => void;
  priorityWeights: PriorityWeights;
  isLoading: boolean;
  fetchError: string | null;
  refreshData: () => Promise<void>;

  // Authentication State & Actions
  currentUser: User | null;
  authToken: string | null;
  authLoading: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<AuthResponse>;
  signup: (fullName: string, email: string, password: string, confirmPassword: string, phone?: string, termsAccepted?: boolean) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<AuthResponse>;
  resetPassword: (token: string, newPassword: string, confirmPassword?: string) => Promise<AuthResponse>;
  fetchUsers: () => Promise<User[]>;
  updateUserRole: (userId: string, role: UserRole, departmentId?: string) => Promise<User>;
  
  // Actions
  submitComplaint: (complaintData: Omit<Complaint, 'id' | 'submitted_at' | 'status' | 'priority_score' | 'priority_level' | 'time_unresolved_score'>) => Promise<Complaint>;
  updateComplaintStatus: (id: string, newStatus: ComplaintStatus, note: string, resolutionPhoto?: string) => Promise<void>;
  assignDepartment: (complaintId: string, departmentId: string, note?: string) => Promise<void>;
  overridePriority: (complaintId: string, newScore: number, reason: string) => Promise<void>;
  confirmIncident: (incidentId: string) => Promise<void>;
  rejectIncident: (incidentId: string) => Promise<void>;
  mergeIncidents: (primaryId: string, secondaryId: string) => Promise<void>;
  removeComplaintFromIncident: (incidentId: string, complaintId: string) => Promise<void>;
  addComplaintToIncident: (incidentId: string, complaintId: string) => Promise<void>;
  updatePriorityWeights: (weights: PriorityWeights) => Promise<boolean>;
  citizenConfirmResolution: (complaintId: string) => Promise<void>;
  reopenComplaint: (complaintId: string, reason: string) => Promise<void>;
  exportComplaintsCsv: (subset?: Complaint[]) => void;
  getDepartmentById: (id: string | null) => Department | undefined;
  getComplaintById: (id: string) => Complaint | undefined;
  getHistoryForComplaint: (complaintId: string) => StatusHistoryEntry[];
  getIncidentById: (id: string) => Incident | undefined;
  runIncidentAutoDetection: () => Promise<void>;
}

const CivicContext = createContext<CivicContextType | undefined>(undefined);

export const CivicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [departments, setDepartments] = useState<Department[]>(INITIAL_DEPARTMENTS);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [priorityWeights, setPriorityWeights] = useState<PriorityWeights>(DEFAULT_PRIORITY_WEIGHTS);
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Authentication state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('civic_auth_token');
  });
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [currentRole, setCurrentRole] = useState<UserRole>('Citizen');
  const [selectedOfficerDeptId, setSelectedOfficerDeptId] = useState<string>('dept-potholes');

  // Load real data from connected database via backend API
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [compRes, incRes, deptRes, histRes, weightRes] = await Promise.all([
        fetch('/api/complaints'),
        fetch('/api/incidents'),
        fetch('/api/departments'),
        fetch('/api/history'),
        fetch('/api/settings/weights'),
      ]);

      if (!compRes.ok || !incRes.ok) {
        throw new Error('Database request returned non-OK response');
      }

      const rawComplaints: Complaint[] = await compRes.json();
      const rawIncidents: Incident[] = await incRes.json();

      // Ensure no demo records are accepted
      const genuineComplaints = Array.isArray(rawComplaints)
        ? rawComplaints.filter((c) => !c.is_demo)
        : [];
      const genuineIncidents = Array.isArray(rawIncidents)
        ? rawIncidents.filter((i) => !['INC-101', 'INC-102', 'INC-103'].includes(i.id))
        : [];

      setComplaints(genuineComplaints);
      setIncidents(genuineIncidents);

      if (deptRes.ok) {
        const depts: Department[] = await deptRes.json();
        if (Array.isArray(depts) && depts.length > 0) {
          setDepartments(depts);
        }
      }

      if (histRes.ok) {
        const history: StatusHistoryEntry[] = await histRes.json();
        if (Array.isArray(history)) {
          setStatusHistory(history);
        }
      }

      if (weightRes.ok) {
        const weights: PriorityWeights = await weightRes.json();
        if (weights && typeof weights.safety_risk === 'number') {
          setPriorityWeights(weights);
        }
      }
    } catch (err) {
      console.error('Failed to load real data from database API:', err);
      setFetchError('Unable to load real data. Please try again.');
      // Do NOT silently fall back to demo data!
      setComplaints([]);
      setIncidents([]);
      setStatusHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Check auth session on boot
  useEffect(() => {
    const initAuth = async () => {
      setAuthLoading(true);
      const token = localStorage.getItem('civic_auth_token');
      if (token) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.user) {
              setCurrentUser(data.user);
              setCurrentRole(data.user.role);
              if (data.user.department_id) {
                setSelectedOfficerDeptId(data.user.department_id);
              }
              setAuthToken(token);
            } else {
              localStorage.removeItem('civic_auth_token');
              setAuthToken(null);
              setCurrentUser(null);
            }
          } else {
            localStorage.removeItem('civic_auth_token');
            setAuthToken(null);
            setCurrentUser(null);
          }
        } catch (err) {
          console.error('Error verifying auth session:', err);
          localStorage.removeItem('civic_auth_token');
          setAuthToken(null);
          setCurrentUser(null);
        }
      } else {
        setAuthLoading(false);
      }
      setAuthLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<AuthResponse> => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data: AuthResponse = await res.json();
      if (res.ok && data.success && data.token && data.user) {
        localStorage.setItem('civic_auth_token', data.token);
        setAuthToken(data.token);
        setCurrentUser(data.user);
        setCurrentRole(data.user.role);
        if (data.user.department_id) {
          setSelectedOfficerDeptId(data.user.department_id);
        }
      } else {
        setAuthError(data.message || 'Login failed.');
      }
      return data;
    } catch (err) {
      const errResponse: AuthResponse = { success: false, message: 'Network error during login. Please try again.' };
      setAuthError(errResponse.message!);
      return errResponse;
    }
  };

  const signup = async (
    fullName: string,
    email: string,
    password: string,
    confirmPassword: string,
    phone?: string,
    termsAccepted: boolean = true
  ): Promise<AuthResponse> => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          confirm_password: confirmPassword,
          phone,
          terms_accepted: termsAccepted,
        }),
      });
      const data: AuthResponse = await res.json();
      if (res.ok && data.success && data.token && data.user) {
        localStorage.setItem('civic_auth_token', data.token);
        setAuthToken(data.token);
        setCurrentUser(data.user);
        setCurrentRole(data.user.role);
      } else {
        setAuthError(data.message || 'Signup failed.');
      }
      return data;
    } catch (err) {
      const errResponse: AuthResponse = { success: false, message: 'Network error during signup. Please try again.' };
      setAuthError(errResponse.message!);
      return errResponse;
    }
  };

  const logout = async () => {
    if (authToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch (err) {
        console.error('Logout request failed:', err);
      }
    }
    localStorage.removeItem('civic_auth_token');
    setAuthToken(null);
    setCurrentUser(null);
    setCurrentRole('Citizen');
  };

  const forgotPassword = async (email: string): Promise<AuthResponse> => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: 'Network error requesting password reset.' };
    }
  };

  const resetPassword = async (
    token: string,
    newPassword: string,
    confirmPassword?: string
  ): Promise<AuthResponse> => {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: 'Network error resetting password.' };
    }
  };

  const fetchUsers = async (): Promise<User[]> => {
    if (!authToken) return [];
    try {
      const res = await fetch('/api/auth/users', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        return await res.json();
      }
      return [];
    } catch (err) {
      console.error('Failed to fetch users:', err);
      return [];
    }
  };

  const updateUserRole = async (userId: string, role: UserRole, departmentId?: string): Promise<User> => {
    const res = await fetch(`/api/auth/users/${userId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ role, department_id: departmentId }),
    });
    const data = await res.json();
    if (res.ok && data.success && data.user) {
      return data.user;
    }
    throw new Error(data.message || 'Failed to update user role');
  };

  const getDepartmentById = (id: string | null) => {
    if (!id) return undefined;
    return departments.find((d) => d.id === id);
  };

  const getComplaintById = (id: string) => {
    return complaints.find((c) => c.id.toUpperCase() === id.toUpperCase());
  };

  const getIncidentById = (id: string) => {
    return incidents.find((inc) => inc.id === id);
  };

  const getHistoryForComplaint = (complaintId: string) => {
    return statusHistory
      .filter((h) => h.complaint_id === complaintId)
      .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
  };

  const runIncidentAutoDetection = async () => {
    try {
      const res = await fetch('/api/incidents/detect', { method: 'POST' });
      if (res.ok) {
        const updatedIncidents: Incident[] = await res.json();
        setIncidents(updatedIncidents);
      }
    } catch (err) {
      console.error('Incident detection API call failed:', err);
    }
  };

  // Submit genuine complaint
  const submitComplaint = async (
    data: Omit<Complaint, 'id' | 'submitted_at' | 'status' | 'priority_score' | 'priority_level' | 'time_unresolved_score'>
  ): Promise<Complaint> => {
    const res = await fetch('/api/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Database persistence failed. Please try again.');
    }

    const created: Complaint = await res.json();

    // Update state only after successful database persistence
    setComplaints((prev) => [created, ...prev]);

    // Refresh history and incidents from DB
    refreshData();

    return created;
  };

  // Update status in database
  const updateComplaintStatus = async (
    id: string,
    newStatus: ComplaintStatus,
    note: string,
    resolutionPhoto?: string
  ) => {
    const res = await fetch(`/api/complaints/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        new_status: newStatus,
        note,
        resolution_photo: resolutionPhoto,
        changed_by: currentRole === 'Administrator' ? 'Municipal Administrator' : 'Department Officer',
        changed_by_role: currentRole,
      }),
    });

    if (!res.ok) {
      throw new Error('Failed to update status in database.');
    }

    const updated: Complaint = await res.json();
    setComplaints((prev) => prev.map((c) => (c.id === id ? updated : c)));
    refreshData();
  };

  // Assign department in database
  const assignDepartment = async (complaintId: string, departmentId: string, note?: string) => {
    const res = await fetch(`/api/complaints/${complaintId}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department_id: departmentId,
        note,
        changed_by: currentRole === 'Administrator' ? 'Municipal Administrator' : 'Department Supervisor',
        changed_by_role: currentRole,
      }),
    });

    if (!res.ok) {
      throw new Error('Failed to assign department in database.');
    }

    const updated: Complaint = await res.json();
    setComplaints((prev) => prev.map((c) => (c.id === complaintId ? updated : c)));
    refreshData();
  };

  // Override priority in database
  const overridePriority = async (complaintId: string, newScore: number, reason: string) => {
    const res = await fetch(`/api/complaints/${complaintId}/priority`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        new_score: newScore,
        reason,
        changed_by: currentRole === 'Administrator' ? 'Municipal Administrator' : 'Senior Officer',
        changed_by_role: currentRole,
      }),
    });

    if (!res.ok) {
      throw new Error('Failed to update priority in database.');
    }

    const updated: Complaint = await res.json();
    setComplaints((prev) => prev.map((c) => (c.id === complaintId ? updated : c)));
    refreshData();
  };

  // Confirm incident in database
  const confirmIncident = async (incidentId: string) => {
    const res = await fetch(`/api/incidents/${incidentId}/confirm`, {
      method: 'PATCH',
    });
    if (res.ok) {
      refreshData();
    }
  };

  // Reject incident in database
  const rejectIncident = async (incidentId: string) => {
    const res = await fetch(`/api/incidents/${incidentId}/reject`, {
      method: 'PATCH',
    });
    if (res.ok) {
      refreshData();
    }
  };

  // Merge incidents in database
  const mergeIncidents = async (primaryId: string, secondaryId: string) => {
    const res = await fetch('/api/incidents/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ primary_id: primaryId, secondary_id: secondaryId }),
    });
    if (res.ok) {
      refreshData();
    }
  };

  // Remove complaint from incident in database
  const removeComplaintFromIncident = async (incidentId: string, complaintId: string) => {
    const res = await fetch(`/api/incidents/${incidentId}/complaints/${complaintId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      refreshData();
    }
  };

  // Add complaint to incident in database
  const addComplaintToIncident = async (incidentId: string, complaintId: string) => {
    const res = await fetch(`/api/incidents/${incidentId}/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ complaint_id: complaintId }),
    });
    if (res.ok) {
      refreshData();
    }
  };

  // Update priority weights in database
  const updatePriorityWeights = async (newWeights: PriorityWeights): Promise<boolean> => {
    const sum =
      newWeights.safety_risk +
      newWeights.severity +
      newWeights.population_impact +
      newWeights.time_unresolved;
    if (sum !== 100) return false;

    const res = await fetch('/api/settings/weights', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newWeights),
    });

    if (res.ok) {
      setPriorityWeights(newWeights);
      refreshData();
      return true;
    }
    return false;
  };

  // Citizen confirm resolution in database
  const citizenConfirmResolution = async (complaintId: string) => {
    const res = await fetch(`/api/complaints/${complaintId}/confirm-resolution`, {
      method: 'PATCH',
    });
    if (res.ok) {
      refreshData();
    }
  };

  // Reopen complaint
  const reopenComplaint = async (complaintId: string, reason: string) => {
    await updateComplaintStatus(complaintId, 'In Progress', `Complaint Reopened by citizen: ${reason}`);
  };

  // Export CSV from genuine data
  const exportComplaintsCsv = (subset?: Complaint[]) => {
    const list = subset || complaints;
    const headers = [
      'Complaint ID',
      'Title',
      'Category',
      'Status',
      'Priority Score',
      'Priority Level',
      'Safety Risk',
      'Severity',
      'Population Impact',
      'Location',
      'Assigned Department',
      'Submitted At',
      'Resolved At',
      'Emergency Flag',
    ];

    const rows = list.map((c) => {
      const dept = getDepartmentById(c.assigned_department_id)?.name || 'Unassigned';
      return [
        `"${c.id}"`,
        `"${c.title.replace(/"/g, '""')}"`,
        `"${c.category}"`,
        `"${c.status}"`,
        c.priority_score,
        `"${c.priority_level}"`,
        c.safety_risk_score,
        c.severity_score,
        c.population_impact_score,
        `"${c.location_name.replace(/"/g, '""')}"`,
        `"${dept}"`,
        `"${c.submitted_at}"`,
        `"${c.resolved_at || ''}"`,
        c.is_emergency_flagged ? 'YES' : 'NO',
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `civicsense_complaints_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <CivicContext.Provider
      value={{
        complaints,
        incidents,
        departments,
        statusHistory,
        currentRole,
        setCurrentRole,
        selectedOfficerDeptId,
        setSelectedOfficerDeptId,
        priorityWeights,
        isLoading,
        currentUser,
        authToken,
        authLoading,
        authError,
        login,
        signup,
        logout,
        forgotPassword,
        resetPassword,
        fetchUsers,
        updateUserRole,
        fetchError,
        refreshData,
        submitComplaint,
        updateComplaintStatus,
        assignDepartment,
        overridePriority,
        confirmIncident,
        rejectIncident,
        mergeIncidents,
        removeComplaintFromIncident,
        addComplaintToIncident,
        updatePriorityWeights,
        citizenConfirmResolution,
        reopenComplaint,
        exportComplaintsCsv,
        getDepartmentById,
        getComplaintById,
        getHistoryForComplaint,
        getIncidentById,
        runIncidentAutoDetection,
      }}
    >
      {children}
    </CivicContext.Provider>
  );
};

export function useCivic(): CivicContextType {
  const context = useContext(CivicContext);
  if (!context) {
    throw new Error('useCivic must be used within a CivicProvider');
  }
  return context;
}
