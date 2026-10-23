import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import {
  Complaint,
  Incident,
  StatusHistoryEntry,
  Department,
  PriorityWeights,
  User,
  UserRecord,
  UserRole,
} from './src/types/civic.ts';
import { INITIAL_DEPARTMENTS } from './src/data/initialData.ts';
import { calculatePriority, calculateTimeUnresolvedScore, DEFAULT_PRIORITY_WEIGHTS } from './src/services/priorityEngine.ts';
import { detectPotentialIncidents } from './src/services/incidentDetector.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '15mb' }));

// ----------------------------------------------------
// CRYPTO & AUTHENTICATION HELPERS
// ----------------------------------------------------
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export interface UserSession {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

export interface PasswordResetToken {
  token: string;
  user_id: string;
  email: string;
  expires_at: string;
  used: boolean;
}

// ----------------------------------------------------
// DATABASE LAYER: Persistent storage in data/civic_db.json
// ----------------------------------------------------
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'civic_db.json');

interface DatabaseSchema {
  complaints: Complaint[];
  incidents: Incident[];
  statusHistory: StatusHistoryEntry[];
  departments: Department[];
  priorityWeights: PriorityWeights;
  users: UserRecord[];
  sessions: UserSession[];
  passwordResetTokens: PasswordResetToken[];
}

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function seedDefaultUsers(): UserRecord[] {
  const nowIso = new Date().toISOString();
  return [
    {
      id: 'USR-ADMIN-SHEKHAR',
      full_name: 'Yash Shekhar (Chief Officer)',
      email: 'shekharyash66@gmail.com',
      password_hash: hashPassword('AdminPass123!'),
      role: 'Administrator',
      email_verified: true,
      status: 'active',
      created_at: nowIso,
    },
    {
      id: 'USR-ADMIN-01',
      full_name: 'Chief Administrator',
      email: 'admin@civicsense.gov',
      password_hash: hashPassword('AdminPass123!'),
      role: 'Administrator',
      email_verified: true,
      status: 'active',
      created_at: nowIso,
    },
    {
      id: 'USR-OFFICER-01',
      full_name: 'Public Works Inspector',
      email: 'roads.officer@civicsense.gov',
      password_hash: hashPassword('OfficerPass123!'),
      role: 'Department Officer',
      department_id: 'dept-potholes',
      email_verified: true,
      status: 'active',
      created_at: nowIso,
    },
    {
      id: 'USR-OFFICER-02',
      full_name: 'Water & Sewerage Supervisor',
      email: 'water.officer@civicsense.gov',
      password_hash: hashPassword('OfficerPass123!'),
      role: 'Department Officer',
      department_id: 'dept-water',
      email_verified: true,
      status: 'active',
      created_at: nowIso,
    },
    {
      id: 'USR-OFFICER-03',
      full_name: 'Electrical Authority Engineer',
      email: 'power.officer@civicsense.gov',
      password_hash: hashPassword('OfficerPass123!'),
      role: 'Department Officer',
      department_id: 'dept-lighting',
      email_verified: true,
      status: 'active',
      created_at: nowIso,
    },
    {
      id: 'USR-CITIZEN-01',
      full_name: 'Jane Citizen',
      email: 'citizen@civicsense.gov',
      password_hash: hashPassword('CitizenPass123!'),
      role: 'Citizen',
      phone: '+1 (555) 019-2834',
      email_verified: true,
      status: 'active',
      created_at: nowIso,
    },
  ];
}

function readDatabase(): DatabaseSchema {
  ensureDataDirectory();
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data: DatabaseSchema = JSON.parse(raw);

      let modified = false;
      if (Array.isArray(data.complaints)) {
        const genuineComplaints = data.complaints.filter((c) => !c.is_demo);
        if (genuineComplaints.length !== data.complaints.length) {
          data.complaints = genuineComplaints;
          modified = true;
        }
      } else {
        data.complaints = [];
        modified = true;
      }

      if (!Array.isArray(data.incidents)) {
        data.incidents = [];
        modified = true;
      } else {
        const demoIncidentIds = new Set(['INC-101', 'INC-102', 'INC-103']);
        const genuineIncidents = data.incidents.filter((i) => !demoIncidentIds.has(i.id));
        if (genuineIncidents.length !== data.incidents.length) {
          data.incidents = genuineIncidents;
          modified = true;
        }
      }

      if (!Array.isArray(data.statusHistory)) {
        data.statusHistory = [];
        modified = true;
      } else {
        const complaintIds = new Set(data.complaints.map((c) => c.id));
        const genuineHistory = data.statusHistory.filter((h) => complaintIds.has(h.complaint_id));
        if (genuineHistory.length !== data.statusHistory.length) {
          data.statusHistory = genuineHistory;
          modified = true;
        }
      }

      if (!Array.isArray(data.departments) || data.departments.length === 0) {
        data.departments = INITIAL_DEPARTMENTS;
        modified = true;
      }

      if (!data.priorityWeights) {
        data.priorityWeights = DEFAULT_PRIORITY_WEIGHTS;
        modified = true;
      }

      if (!Array.isArray(data.users) || data.users.length === 0) {
        data.users = seedDefaultUsers();
        modified = true;
      }

      if (!Array.isArray(data.sessions)) {
        data.sessions = [];
        modified = true;
      }

      if (!Array.isArray(data.passwordResetTokens)) {
        data.passwordResetTokens = [];
        modified = true;
      }

      if (modified) {
        saveDatabase(data);
      }

      return data;
    } catch (err) {
      console.error('Error reading database file, initializing clean database:', err);
    }
  }

  const initialDb: DatabaseSchema = {
    complaints: [],
    incidents: [],
    statusHistory: [],
    departments: INITIAL_DEPARTMENTS,
    priorityWeights: DEFAULT_PRIORITY_WEIGHTS,
    users: seedDefaultUsers(),
    sessions: [],
    passwordResetTokens: [],
  };
  saveDatabase(initialDb);
  return initialDb;
}

function saveDatabase(data: DatabaseSchema) {
  ensureDataDirectory();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const sessionHeader = req.headers['x-session-token'];
  if (typeof sessionHeader === 'string' && sessionHeader.trim()) {
    return sessionHeader.trim();
  }
  return null;
}

function getAuthenticatedUser(req: Request, database: DatabaseSchema): UserRecord | null {
  const token = extractToken(req);
  if (!token) return null;

  const session = database.sessions.find(
    (s) => s.token === token && new Date(s.expires_at) > new Date()
  );
  if (!session) return null;

  const user = database.users.find((u) => u.id === session.user_id);
  if (!user || user.status === 'disabled') return null;

  return user;
}

// Initialize DB in memory/disk
let db: DatabaseSchema = readDatabase();
console.log(`Database loaded: ${db.complaints.length} complaints, ${db.users.length} registered users.`);

// ----------------------------------------------------
// AI INITIALIZATION (Google GenAI SDK)
// ----------------------------------------------------
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    console.log('Gemini API client initialized successfully.');
  } catch (err) {
    console.warn('Failed to initialize GoogleGenAI client, fallback will be used:', err);
  }
} else {
  console.log('GEMINI_API_KEY not configured or placeholder detected; transparent fallback heuristic engine active.');
}

// ----------------------------------------------------
// API ENDPOINTS
// ----------------------------------------------------

// Health & DB status
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    database_connected: true,
    total_genuine_complaints: db.complaints.length,
    total_genuine_incidents: db.incidents.length,
    total_users: db.users.length,
    ai_available: !!aiClient,
    timestamp: new Date().toISOString(),
  });
});

// Maps configuration endpoint (provides client with configured Google Maps API key)
app.get('/api/config/maps', (_req: Request, res: Response) => {
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
  res.json({
    apiKey,
    configured: Boolean(apiKey && apiKey.length > 5),
  });
});

// ----------------------------------------------------
// AUTHENTICATION API ENDPOINTS
// ----------------------------------------------------

// POST Signup (New Citizen Registration)
app.post('/api/auth/signup', (req: Request, res: Response) => {
  try {
    const { full_name, email, password, confirm_password, phone, terms_accepted } = req.body;

    if (!full_name || !email || !password || !confirm_password) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided.' });
    }

    if (!terms_accepted) {
      return res.status(400).json({ success: false, message: 'You must accept the terms and privacy policy to register.' });
    }

    if (password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    if (password.length < 8 || !/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long and contain both letters and numbers.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    db = readDatabase();
    const normalizedEmail = email.trim().toLowerCase();

    const existing = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email address already exists.' });
    }

    // CRITICAL SECURITY RULE: Public signups ALWAYS receive 'Citizen' role by default
    const newUser: UserRecord = {
      id: `USR-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      full_name: full_name.trim(),
      email: normalizedEmail,
      password_hash: hashPassword(password),
      phone: phone ? String(phone).trim() : undefined,
      role: 'Citizen',
      email_verified: true,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    db.users.push(newUser);

    // Create active session token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    db.sessions.push({
      token,
      user_id: newUser.id,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    });

    saveDatabase(db);

    const { password_hash, ...publicUser } = newUser;
    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: publicUser,
    });
  } catch (err) {
    console.error('Error in signup API:', err);
    return res.status(500).json({ success: false, message: 'Signup failed due to a server error.' });
  }
});

// POST Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    db = readDatabase();
    const normalizedEmail = email.trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ success: false, message: 'Your account has been disabled. Please contact support.' });
    }

    user.last_login_at = new Date().toISOString();

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.sessions.push({
      token,
      user_id: user.id,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    });

    saveDatabase(db);

    const { password_hash, ...publicUser } = user;
    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: publicUser,
    });
  } catch (err) {
    console.error('Error in login API:', err);
    return res.status(500).json({ success: false, message: 'Login failed due to a server error.' });
  }
});

// POST Request OTP (Email or Phone)
app.post('/api/auth/otp/request', (req: Request, res: Response) => {
  try {
    const { target, type } = req.body;
    if (!target || typeof target !== 'string' || !target.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email or phone number.' });
    }

    const cleanTarget = target.trim().toLowerCase();
    // Default demonstration OTP
    const otpCode = '123456';

    return res.json({
      success: true,
      message: `OTP sent successfully to ${cleanTarget}. Verification Code: ${otpCode}`,
      otp: otpCode,
      target: cleanTarget,
      type: type || 'email',
    });
  } catch (err) {
    console.error('Error in OTP request API:', err);
    return res.status(500).json({ success: false, message: 'Failed to send OTP.' });
  }
});

// POST Verify OTP
app.post('/api/auth/otp/verify', (req: Request, res: Response) => {
  try {
    const { target, otp, full_name, verified, uid } = req.body;
    if (!target) {
      return res.status(400).json({ success: false, message: 'Target phone or email is required.' });
    }

    if (!verified && (!otp || (String(otp).trim() !== '123456' && String(otp).trim().length !== 6))) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code.' });
    }

    db = readDatabase();
    const cleanTarget = target.trim().toLowerCase();
    let user = db.users.find(
      (u) => u.email.toLowerCase() === cleanTarget || (u.phone && u.phone.includes(cleanTarget)) || (uid && u.id === `USR-FB-${uid}`)
    );

    if (!user) {
      // Auto-create citizen profile on first OTP verification
      const displayName = full_name?.trim() || (cleanTarget.includes('@') ? cleanTarget.split('@')[0] : 'Citizen User');
      user = {
        id: uid ? `USR-FB-${uid}` : `USR-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        full_name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
        email: cleanTarget.includes('@') ? cleanTarget : `${cleanTarget.replace(/\D/g, '')}@mobile.civicsense.gov`,
        phone: !cleanTarget.includes('@') ? cleanTarget : undefined,
        password_hash: hashPassword('OtpUserPass123!'),
        role: 'Citizen',
        email_verified: true,
        status: 'active',
        created_at: new Date().toISOString(),
      };
      db.users.push(user);
    } else if (cleanTarget && !cleanTarget.includes('@') && !user.phone) {
      user.phone = cleanTarget;
    }

    user.last_login_at = new Date().toISOString();
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.sessions.push({
      token,
      user_id: user.id,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    });

    saveDatabase(db);

    const { password_hash, ...publicUser } = user;
    return res.json({
      success: true,
      message: 'OTP verification successful.',
      token,
      user: publicUser,
    });
  } catch (err) {
    console.error('Error in OTP verify API:', err);
    return res.status(500).json({ success: false, message: 'OTP verification failed.' });
  }
});

// POST Google Sign-In
app.post('/api/auth/google', (req: Request, res: Response) => {
  try {
    const { email, name, uid } = req.body;
    const targetEmail = (email || 'citizen.google@civicsense.gov').toLowerCase().trim();
    const targetName = name || 'Google Citizen';

    db = readDatabase();
    let user = db.users.find((u) => u.email.toLowerCase() === targetEmail || (uid && u.id === `USR-GGL-${uid}`));

    if (!user) {
      user = {
        id: uid ? `USR-GGL-${uid}` : `USR-GGL-${Date.now().toString(36)}`,
        full_name: targetName,
        email: targetEmail,
        password_hash: hashPassword('GoogleSSOPass123!'),
        role: targetEmail === 'shekharyash66@gmail.com' ? 'Administrator' : 'Citizen',
        email_verified: true,
        status: 'active',
        created_at: new Date().toISOString(),
      };
      db.users.push(user);
    } else {
      user.full_name = targetName;
      if (targetEmail === 'shekharyash66@gmail.com') {
        user.role = 'Administrator';
      }
    }

    user.last_login_at = new Date().toISOString();
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.sessions.push({
      token,
      user_id: user.id,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    });

    saveDatabase(db);

    const { password_hash, ...publicUser } = user;
    return res.json({
      success: true,
      message: 'Google Sign-In successful.',
      token,
      user: publicUser,
    });
  } catch (err) {
    console.error('Error in Google auth API:', err);
    return res.status(500).json({ success: false, message: 'Google authentication failed.' });
  }
});

// GET Current User Profile (Me)
app.get('/api/auth/me', (req: Request, res: Response) => {
  try {
    db = readDatabase();
    const user = getAuthenticatedUser(req, db);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Not authenticated or session expired.' });
    }

    if (user.email.toLowerCase() === 'shekharyash66@gmail.com' && user.role !== 'Administrator') {
      user.role = 'Administrator';
      saveDatabase(db);
    }

    const { password_hash, ...publicUser } = user;
    return res.json({
      success: true,
      user: publicUser,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Session check failed.' });
  }
});

// POST Logout
app.post('/api/auth/logout', (req: Request, res: Response) => {
  try {
    const token = extractToken(req);
    if (token) {
      db = readDatabase();
      db.sessions = db.sessions.filter((s) => s.token !== token);
      saveDatabase(db);
    }
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Logout failed.' });
  }
});

// POST Forgot Password
app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    db = readDatabase();
    const normalizedEmail = email.trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);

    let debugResetToken: string | undefined = undefined;

    if (user) {
      const resetToken = generateToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      if (!Array.isArray(db.passwordResetTokens)) {
        db.passwordResetTokens = [];
      }

      db.passwordResetTokens.push({
        token: resetToken,
        user_id: user.id,
        email: user.email,
        expires_at: expiresAt,
        used: false,
      });

      saveDatabase(db);
      debugResetToken = resetToken;
    }

    return res.json({
      success: true,
      message: 'If an account exists with that email address, password reset instructions have been generated.',
      debugResetToken, // Provided in development preview for instant password reset testing
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Password reset request failed.' });
  }
});

// POST Reset Password
app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  try {
    const { token, new_password, confirm_password } = req.body;

    if (!token || !new_password) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required.' });
    }

    if (confirm_password && new_password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    if (new_password.length < 8 || !/\d/.test(new_password) || !/[a-zA-Z]/.test(new_password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long and contain both letters and numbers.',
      });
    }

    db = readDatabase();
    if (!Array.isArray(db.passwordResetTokens)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired password reset token.' });
    }

    const resetRecord = db.passwordResetTokens.find(
      (r) => r.token === token && !r.used && new Date(r.expires_at) > new Date()
    );

    if (!resetRecord) {
      return res.status(400).json({ success: false, message: 'Invalid, used, or expired password reset token.' });
    }

    const user = db.users.find((u) => u.id === resetRecord.user_id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Associated user account not found.' });
    }

    user.password_hash = hashPassword(new_password);
    resetRecord.used = true;

    // Revoke existing active sessions for security
    db.sessions = db.sessions.filter((s) => s.user_id !== user.id);

    saveDatabase(db);

    return res.json({
      success: true,
      message: 'Your password has been reset successfully. Please log in with your new password.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Reset password failed.' });
  }
});

// GET Users (Administrator Only)
app.get('/api/auth/users', (req: Request, res: Response) => {
  try {
    db = readDatabase();
    const authUser = getAuthenticatedUser(req, db);
    if (!authUser || authUser.role !== 'Administrator') {
      return res.status(403).json({ success: false, message: 'Unauthorized. Administrator privileges required.' });
    }

    const publicUsers = db.users.map(({ password_hash, ...rest }) => rest);
    return res.json(publicUsers);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
});

// PATCH Update User Role (Administrator Only)
app.patch('/api/auth/users/:id/role', (req: Request, res: Response) => {
  try {
    db = readDatabase();
    const authUser = getAuthenticatedUser(req, db);
    if (!authUser || authUser.role !== 'Administrator') {
      return res.status(403).json({ success: false, message: 'Unauthorized. Administrator privileges required.' });
    }

    const { id } = req.params;
    const { role, department_id } = req.body;

    const targetUser = db.users.find((u) => u.id === id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (role && ['Citizen', 'Administrator', 'Department Officer'].includes(role)) {
      targetUser.role = role as UserRole;
    }

    if (department_id !== undefined) {
      targetUser.department_id = department_id;
    }

    saveDatabase(db);

    const { password_hash, ...publicUser } = targetUser;
    return res.json({ success: true, user: publicUser });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update user role.' });
  }
});

// GET all genuine complaints
app.get('/api/complaints', (_req: Request, res: Response) => {
  try {
    // Re-read DB to guarantee fresh state
    db = readDatabase();
    res.json(db.complaints);
  } catch (err) {
    console.error('Error fetching complaints from database:', err);
    res.status(500).json({ error: 'Unable to load real data. Please try again.' });
  }
});

// GET single complaint by ID
app.get('/api/complaints/:id', (req: Request, res: Response) => {
  try {
    db = readDatabase();
    const id = req.params.id.toUpperCase();
    const complaint = db.complaints.find((c) => c.id.toUpperCase() === id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }
    res.json(complaint);
  } catch (err) {
    res.status(500).json({ error: 'Unable to load real data. Please try again.' });
  }
});

// POST submit a genuine complaint
app.post('/api/complaints', (req: Request, res: Response) => {
  try {
    const data = req.body;
    if (!data.title || !data.description || !data.location_name) {
      return res.status(400).json({ error: 'Title, description, and location are required.' });
    }

    db = readDatabase();

    const nowIso = new Date().toISOString();
    const uniqueNum = Math.floor(1000 + Math.random() * 9000);
    const newId = `CIV-${uniqueNum}`;

    const timeScore = calculateTimeUnresolvedScore(nowIso);
    const safetyScore = typeof data.safety_risk_score === 'number' ? data.safety_risk_score : 40;
    const severityScore = typeof data.severity_score === 'number' ? data.severity_score : 40;
    const popScore = typeof data.population_impact_score === 'number' ? data.population_impact_score : 50;

    const calc = calculatePriority(
      safetyScore,
      severityScore,
      popScore,
      timeScore,
      db.priorityWeights
    );

    const newComplaint: Complaint = {
      id: newId,
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category || 'Other Civic Issues',
      location_name: data.location_name.trim(),
      latitude: typeof data.latitude === 'number' ? data.latitude : null,
      longitude: typeof data.longitude === 'number' ? data.longitude : null,
      image_url: data.image_url || undefined,
      submitted_at: nowIso,
      status: 'Submitted',
      priority_score: calc.score,
      priority_level: calc.level,
      safety_risk_score: safetyScore,
      severity_score: severityScore,
      population_impact_score: popScore,
      time_unresolved_score: timeScore,
      is_emergency_flagged: !!data.is_emergency_flagged,
      assigned_department_id: data.assigned_department_id || null,
      related_incident_id: null,
      ai_analysis: data.ai_analysis || undefined,
      reporter_name: data.reporter_name ? data.reporter_name.trim() : 'Citizen Reporter',
      reporter_email: data.reporter_email ? data.reporter_email.trim() : undefined,
      reporter_phone: data.reporter_phone ? data.reporter_phone.trim() : undefined,
      is_demo: false, // Genuine submission only
    };

    const newHistory: StatusHistoryEntry = {
      id: `sh-${Date.now()}`,
      complaint_id: newId,
      previous_status: null,
      new_status: 'Submitted',
      note: 'Complaint successfully registered in municipal database.',
      changed_by: newComplaint.reporter_name || 'Citizen Reporter',
      changed_by_role: 'Citizen',
      changed_at: nowIso,
    };

    db.complaints.unshift(newComplaint);
    db.statusHistory.unshift(newHistory);

    // Auto-evaluate potential incidents on genuine complaints only
    const newProposed = detectPotentialIncidents(db.complaints, db.incidents);
    if (newProposed.length > 0) {
      const existingIds = new Set(db.incidents.map((i) => i.id));
      const filteredNew = newProposed.filter((n) => !existingIds.has(n.id));
      db.incidents = [...filteredNew, ...db.incidents];
    }

    saveDatabase(db);
    console.log(`Saved new genuine complaint to database: ${newComplaint.id}`);

    res.status(201).json(newComplaint);
  } catch (err) {
    console.error('Error saving complaint to database:', err);
    res.status(500).json({ error: 'Database persistence failed. Please try again.' });
  }
});

// PATCH update status
app.patch('/api/complaints/:id/status', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { new_status, note, changed_by, changed_by_role, resolution_photo } = req.body;

    if (!new_status) {
      return res.status(400).json({ error: 'new_status is required.' });
    }

    db = readDatabase();
    const complaint = db.complaints.find((c) => c.id.toUpperCase() === id.toUpperCase());
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    const previousStatus = complaint.status;
    const nowIso = new Date().toISOString();
    const isResolved = new_status === 'Resolved';

    complaint.status = new_status;
    if (isResolved) {
      complaint.resolved_at = nowIso;
      complaint.resolution_note = note;
      if (resolution_photo) complaint.resolution_photo = resolution_photo;
    } else if (new_status === 'In Progress' && previousStatus === 'Resolved') {
      complaint.resolved_at = undefined;
      complaint.citizen_confirmed_resolved = false;
    }

    const historyEntry: StatusHistoryEntry = {
      id: `sh-${Date.now()}`,
      complaint_id: complaint.id,
      previous_status: previousStatus,
      new_status,
      note: note || `Status changed from ${previousStatus} to ${new_status}.`,
      changed_by: changed_by || 'Municipal Operations',
      changed_by_role: changed_by_role || 'Administrator',
      changed_at: nowIso,
    };

    db.statusHistory.unshift(historyEntry);
    saveDatabase(db);

    res.json(complaint);
  } catch (err) {
    res.status(500).json({ error: 'Database update failed.' });
  }
});

// PATCH assign department
app.patch('/api/complaints/:id/assign', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { department_id, note, changed_by, changed_by_role } = req.body;

    db = readDatabase();
    const complaint = db.complaints.find((c) => c.id.toUpperCase() === id.toUpperCase());
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    complaint.assigned_department_id = department_id;
    complaint.status = 'Assigned';

    const dept = db.departments.find((d) => d.id === department_id);
    const deptName = dept ? dept.name : department_id;
    const nowIso = new Date().toISOString();

    const historyEntry: StatusHistoryEntry = {
      id: `sh-${Date.now()}`,
      complaint_id: complaint.id,
      previous_status: 'Under Review',
      new_status: 'Assigned',
      note: note || `Dispatched to ${deptName}.`,
      changed_by: changed_by || 'Municipal Operations',
      changed_by_role: changed_by_role || 'Administrator',
      changed_at: nowIso,
    };

    db.statusHistory.unshift(historyEntry);
    saveDatabase(db);

    res.json(complaint);
  } catch (err) {
    res.status(500).json({ error: 'Database assignment update failed.' });
  }
});

// PATCH manual priority override
app.patch('/api/complaints/:id/priority', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { new_score, reason, changed_by, changed_by_role } = req.body;

    if (typeof new_score !== 'number' || !reason) {
      return res.status(400).json({ error: 'new_score and reason are required.' });
    }

    db = readDatabase();
    const complaint = db.complaints.find((c) => c.id.toUpperCase() === id.toUpperCase());
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    const originalScore = complaint.priority_score;
    const nowIso = new Date().toISOString();
    const newLevel = new_score >= 80 ? 'Critical' : new_score >= 60 ? 'High' : new_score >= 35 ? 'Medium' : 'Low';

    complaint.priority_score = new_score;
    complaint.priority_level = newLevel;
    complaint.manual_priority_override = {
      original_score: originalScore,
      new_score,
      reason,
      overridden_by: changed_by || 'Municipal Administrator',
      overridden_at: nowIso,
    };

    const historyEntry: StatusHistoryEntry = {
      id: `sh-${Date.now()}`,
      complaint_id: complaint.id,
      previous_status: complaint.status,
      new_status: complaint.status,
      note: `Priority score manually adjusted from ${originalScore} to ${new_score} (${newLevel}). Reason: ${reason}`,
      changed_by: changed_by || 'Municipal Administrator',
      changed_by_role: changed_by_role || 'Administrator',
      changed_at: nowIso,
    };

    db.statusHistory.unshift(historyEntry);
    saveDatabase(db);

    res.json(complaint);
  } catch (err) {
    res.status(500).json({ error: 'Database priority update failed.' });
  }
});

// PATCH citizen confirm resolution
app.patch('/api/complaints/:id/confirm-resolution', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    db = readDatabase();
    const complaint = db.complaints.find((c) => c.id.toUpperCase() === id.toUpperCase());
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    complaint.citizen_confirmed_resolved = true;
    const nowIso = new Date().toISOString();

    const historyEntry: StatusHistoryEntry = {
      id: `sh-${Date.now()}`,
      complaint_id: complaint.id,
      previous_status: 'Resolved',
      new_status: 'Resolved',
      note: 'Citizen confirmed resolution on site: issue verified fixed satisfactorily.',
      changed_by: 'Citizen Reporter',
      changed_by_role: 'Citizen',
      changed_at: nowIso,
    };

    db.statusHistory.unshift(historyEntry);
    saveDatabase(db);

    res.json(complaint);
  } catch (err) {
    res.status(500).json({ error: 'Database update failed.' });
  }
});

// GET all genuine incidents
app.get('/api/incidents', (_req: Request, res: Response) => {
  try {
    db = readDatabase();
    res.json(db.incidents);
  } catch (err) {
    res.status(500).json({ error: 'Unable to load real data. Please try again.' });
  }
});

// POST trigger incident detection
app.post('/api/incidents/detect', (_req: Request, res: Response) => {
  try {
    db = readDatabase();
    const newProposed = detectPotentialIncidents(db.complaints, db.incidents);
    if (newProposed.length > 0) {
      const existingIds = new Set(db.incidents.map((i) => i.id));
      const filteredNew = newProposed.filter((n) => !existingIds.has(n.id));
      db.incidents = [...filteredNew, ...db.incidents];
      saveDatabase(db);
    }
    res.json(db.incidents);
  } catch (err) {
    res.status(500).json({ error: 'Incident detection scan failed.' });
  }
});

// PATCH confirm incident
app.patch('/api/incidents/:id/confirm', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    db = readDatabase();
    const incident = db.incidents.find((i) => i.id === id);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });

    incident.status = 'Confirmed';
    incident.updated_at = new Date().toISOString();

    // Link complaints
    db.complaints = db.complaints.map((c) =>
      incident.related_complaint_ids.includes(c.id) ? { ...c, related_incident_id: id } : c
    );

    saveDatabase(db);
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: 'Database update failed.' });
  }
});

// PATCH reject incident
app.patch('/api/incidents/:id/reject', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    db = readDatabase();
    const incident = db.incidents.find((i) => i.id === id);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });

    incident.status = 'Rejected';
    incident.updated_at = new Date().toISOString();

    // Unlink complaints
    db.complaints = db.complaints.map((c) =>
      c.related_incident_id === id ? { ...c, related_incident_id: null } : c
    );

    saveDatabase(db);
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: 'Database update failed.' });
  }
});

// POST merge incidents
app.post('/api/incidents/merge', (req: Request, res: Response) => {
  try {
    const { primary_id, secondary_id } = req.body;
    db = readDatabase();
    const primary = db.incidents.find((i) => i.id === primary_id);
    const secondary = db.incidents.find((i) => i.id === secondary_id);

    if (!primary || !secondary) {
      return res.status(404).json({ error: 'One or both incidents not found.' });
    }

    const mergedComplaintIds = Array.from(new Set([...primary.related_complaint_ids, ...secondary.related_complaint_ids]));

    primary.related_complaint_ids = mergedComplaintIds;
    primary.description = `${primary.description} Merged with ${secondary.title}.`;
    primary.updated_at = new Date().toISOString();

    db.incidents = db.incidents.filter((i) => i.id !== secondary_id);
    db.complaints = db.complaints.map((c) =>
      c.related_incident_id === secondary_id ? { ...c, related_incident_id: primary_id } : c
    );

    saveDatabase(db);
    res.json(primary);
  } catch (err) {
    res.status(500).json({ error: 'Merge failed.' });
  }
});

// POST add complaint to incident
app.post('/api/incidents/:id/complaints', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { complaint_id } = req.body;
    db = readDatabase();
    const incident = db.incidents.find((i) => i.id === id);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });

    if (!incident.related_complaint_ids.includes(complaint_id)) {
      incident.related_complaint_ids.push(complaint_id);
      incident.updated_at = new Date().toISOString();
    }

    const complaint = db.complaints.find((c) => c.id === complaint_id);
    if (complaint) {
      complaint.related_incident_id = id;
    }

    saveDatabase(db);
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: 'Update failed.' });
  }
});

// DELETE remove complaint from incident
app.delete('/api/incidents/:id/complaints/:complaintId', (req: Request, res: Response) => {
  try {
    const { id, complaintId } = req.params;
    db = readDatabase();
    const incident = db.incidents.find((i) => i.id === id);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });

    incident.related_complaint_ids = incident.related_complaint_ids.filter((cid) => cid !== complaintId);
    incident.updated_at = new Date().toISOString();

    const complaint = db.complaints.find((c) => c.id === complaintId);
    if (complaint && complaint.related_incident_id === id) {
      complaint.related_incident_id = null;
    }

    saveDatabase(db);
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: 'Delete failed.' });
  }
});

// GET departments
app.get('/api/departments', (_req: Request, res: Response) => {
  try {
    db = readDatabase();
    res.json(db.departments);
  } catch (err) {
    res.status(500).json({ error: 'Unable to load real data. Please try again.' });
  }
});

// GET status history
app.get('/api/history', (_req: Request, res: Response) => {
  try {
    db = readDatabase();
    res.json(db.statusHistory);
  } catch (err) {
    res.status(500).json({ error: 'Unable to load real data. Please try again.' });
  }
});

// GET priority weights
app.get('/api/settings/weights', (_req: Request, res: Response) => {
  try {
    db = readDatabase();
    res.json(db.priorityWeights);
  } catch (err) {
    res.status(500).json({ error: 'Unable to load real data. Please try again.' });
  }
});

// PUT priority weights
app.put('/api/settings/weights', (req: Request, res: Response) => {
  try {
    const newWeights: PriorityWeights = req.body;
    const sum =
      newWeights.safety_risk +
      newWeights.severity +
      newWeights.population_impact +
      newWeights.time_unresolved;

    if (sum !== 100) {
      return res.status(400).json({ error: 'Weights must sum to 100%.' });
    }

    db = readDatabase();
    db.priorityWeights = newWeights;

    // Recalculate genuine open complaints
    db.complaints = db.complaints.map((c) => {
      if (c.status === 'Resolved' || c.status === 'Rejected') return c;
      if (c.manual_priority_override) return c;

      const timeScore = calculateTimeUnresolvedScore(c.submitted_at);
      const calc = calculatePriority(
        c.safety_risk_score,
        c.severity_score,
        c.population_impact_score,
        timeScore,
        newWeights
      );

      return {
        ...c,
        priority_score: calc.score,
        priority_level: calc.level,
        time_unresolved_score: timeScore,
      };
    });

    saveDatabase(db);
    res.json(db.priorityWeights);
  } catch (err) {
    res.status(500).json({ error: 'Weights update failed.' });
  }
});

// Heuristic fallback classifier
function runFallbackAnalysis(title: string, description: string, userCategory?: string) {
  const combined = `${title} ${description}`.toLowerCase();
  
  let category = userCategory || 'Other Civic Issues';
  let suggestedDept = 'Department of Public Works (Roads)';
  let safetyScore = 45;
  let severityScore = 40;
  let popScore: number | null = 50;
  let possibleEmergency = false;
  const reasoning: string[] = [];
  const missingInfo: string[] = [];

  // Emergency triggers
  if (/live wire|sparking|electrocution|sinkhole|collapse|gas leak|open manhole|deep pit/.test(combined)) {
    possibleEmergency = true;
    safetyScore = 95;
    severityScore = 88;
    reasoning.push('Text mentions severe immediate hazard requiring urgent human review.');
  }

  // Category & Department determination
  if (/water|leak|pipe|burst|flood|drain|sewer|waterlogging|gutter/.test(combined)) {
    category = 'Water Leakage & Drainage';
    suggestedDept = 'Municipal Water & Sewerage Board';
    severityScore = Math.max(severityScore, 65);
    reasoning.push('Keywords identify water supply or drainage infrastructure degradation.');
  } else if (/pothole|road|asphalt|crater|pavement|trench|crack/.test(combined)) {
    category = 'Potholes & Road Damage';
    suggestedDept = 'Department of Public Works (Roads)';
    severityScore = Math.max(severityScore, 60);
    safetyScore = Math.max(safetyScore, 65);
    reasoning.push('Road surface damage poses vehicular and bicycle transit risk.');
  } else if (/light|lamp|streetlight|dark|blackout|pole|wire|power|electric/.test(combined)) {
    category = 'Broken Streetlights & Electrical';
    suggestedDept = 'City Power & Electrical Authority';
    safetyScore = Math.max(safetyScore, 60);
    reasoning.push('Illumination failure impacts nighttime pedestrian safety and security.');
  } else if (/garbage|trash|waste|dump|rubbish|litter|bins|smell/.test(combined)) {
    category = 'Garbage & Sanitation';
    suggestedDept = 'Waste & Environmental Sanitation';
    severityScore = Math.max(severityScore, 50);
    reasoning.push('Accumulation of waste generates sanitation and environmental concerns.');
  } else if (/crosswalk|signal|zebra|speed bump|sign|bollard|pedestrian/.test(combined)) {
    category = 'Pedestrian & Traffic Safety';
    suggestedDept = 'Pedestrian & Traffic Safety Board';
    safetyScore = Math.max(safetyScore, 70);
    reasoning.push('Pedestrian corridor elements directly influence collision avoidance.');
  }

  if (combined.length < 30) {
    missingInfo.push('Detailed dimensions or visual markers of defect');
  }

  return {
    category,
    summary: `${title.slice(0, 80)}: reported issue requiring municipal inspection.`,
    severity_score: severityScore,
    safety_risk_score: safetyScore,
    affected_population_score: popScore,
    suggested_department: suggestedDept,
    possible_emergency: possibleEmergency,
    reasoning: reasoning.length > 0 ? reasoning : ['Standard civic service defect based on keyword classification.'],
    missing_information: missingInfo,
    isFallback: true,
  };
}

// ----------------------------------------------------
// QUOTA RESILIENCE & CIRCUIT BREAKER ENGINE
// ----------------------------------------------------
function isQuotaError(err: any): boolean {
  if (!err) return false;
  const msg = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Quota exceeded') ||
    msg.includes('quota') ||
    msg.includes('rate-limit')
  );
}

function extractRetryDelaySeconds(err: any): number {
  try {
    const str = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
    const match = str.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  } catch {
    // ignore
  }
  return 1800; // default 30 mins
}

const quotaCooldowns: Record<string, number> = {};

function isModelAvailable(modelName: string): boolean {
  const expiry = quotaCooldowns[modelName];
  if (!expiry) return true;
  if (Date.now() > expiry) {
    delete quotaCooldowns[modelName];
    return true;
  }
  return false;
}

function recordQuotaHit(modelName: string, err: any) {
  const retrySec = extractRetryDelaySeconds(err);
  quotaCooldowns[modelName] = Date.now() + retrySec * 1000;
  console.info(`[CivicSense Intelligence] ${modelName} free-tier quota reached (cooldown: ${retrySec}s). Local deterministic civic engine active.`);
}

async function executeGeminiCall<T>(
  callFn: (model: string) => Promise<T | null>,
  candidateModels = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.1-flash-lite']
): Promise<T | null> {
  if (!aiClient) return null;

  for (const model of candidateModels) {
    if (!isModelAvailable(model)) {
      continue;
    }

    try {
      const result = await callFn(model);
      if (result) {
        return result;
      }
    } catch (err: any) {
      if (isQuotaError(err)) {
        recordQuotaHit(model, err);
      } else {
        const shortMsg = err?.message ? String(err.message).slice(0, 100) : 'Service unavailable';
        console.warn(`[AI Engine] ${model} query notice: ${shortMsg}`);
      }
    }
  }

  return null;
}

// Endpoint: AI-assisted Complaint Analysis
app.post('/api/analyze-complaint', async (req: Request, res: Response) => {
  const { title, description, category, location, imageBase64 } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required.' });
  }

  // Attempt Gemini API if client available and not quota-exhausted
  if (aiClient) {
    const promptText = `You are the CivicSense AI Municipal Incident Intelligence Engine.
Analyze the following citizen civic complaint report and provide structured JSON assessment.

Title: "${title}"
Description: "${description}"
User Selected Category (may be empty or approximate): "${category || 'None'}"
Reported Location: "${location || 'Unknown'}"

Evaluate realistic civic factors:
1. "category": Must be one of ["Potholes & Road Damage", "Garbage & Sanitation", "Water Leakage & Drainage", "Broken Streetlights & Electrical", "Public Infrastructure Damage", "Pedestrian & Traffic Safety", "Other Civic Issues"]
2. "summary": Concise 1-sentence objective summary of the reported defect.
3. "severity_score": Integer 0 to 100 representing physical structural deterioration (0 = cosmetic, 100 = complete catastrophic failure).
4. "safety_risk_score": Integer 0 to 100 representing immediate danger to human safety, vehicle collisions, or electrocution (0 = safe, 100 = life-threatening).
5. "affected_population_score": Integer 0 to 100 representing pedestrian/vehicular traffic density if determinable, or null if insufficient information. Do NOT guess blindly.
6. "suggested_department": Must be one of ["Department of Public Works (Roads)", "Municipal Water & Sewerage Board", "City Power & Electrical Authority", "Waste & Environmental Sanitation", "Pedestrian & Traffic Safety Board"].
7. "possible_emergency": Boolean. True ONLY if explicitly hazardous (e.g., exposed live electrical wire, active sinkhole collapse, open deep manhole, toxic gas/chemical spill, rapid home flooding).
8. "reasoning": Array of 2 to 4 concise explanatory bullet strings.
9. "missing_information": Array of critical missing information (e.g., "Precise street cross-junction", "Photographic evidence of depth").

Return valid JSON adhering strictly to the schema.`;

    const contents: any[] = [];
    if (imageBase64 && imageBase64.includes('base64,')) {
      const parts = imageBase64.split('base64,');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      contents.push({
        parts: [
          { inlineData: { mimeType: mime, data: parts[1] } },
          { text: promptText },
        ],
      });
    } else {
      contents.push(promptText);
    }

    const geminiAnalysis = await executeGeminiCall<any>(async (model) => {
      const response = await aiClient!.models.generateContent({
        model,
        contents: contents.length === 1 ? contents[0] : contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              summary: { type: Type.STRING },
              severity_score: { type: Type.INTEGER },
              safety_risk_score: { type: Type.INTEGER },
              affected_population_score: { type: Type.INTEGER, nullable: true },
              suggested_department: { type: Type.STRING },
              possible_emergency: { type: Type.BOOLEAN },
              reasoning: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              missing_information: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'category',
              'summary',
              'severity_score',
              'safety_risk_score',
              'suggested_department',
              'possible_emergency',
              'reasoning',
            ],
          },
        },
      });

      const text = response?.text;
      if (text) {
        return JSON.parse(text);
      }
      return null;
    });

    if (geminiAnalysis) {
      return res.json({
        ...geminiAnalysis,
        isFallback: false,
      });
    }
  }

  // Graceful deterministic fallback
  const fallback = runFallbackAnalysis(title, description, category);
  return res.json(fallback);
});

// ----------------------------------------------------
// SMART AI CIVIC ASSISTANT ENDPOINT
// ----------------------------------------------------

async function callGeminiWithTimeout(
  promptText: string | any[],
  systemInstructionText?: string,
  timeoutMs = 4000
): Promise<string | null> {
  if (!aiClient) return null;

  return executeGeminiCall<string>(async (model) => {
    const configObj: any = {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
    };
    if (systemInstructionText) {
      configObj.systemInstruction = systemInstructionText;
    }

    const apiPromise = aiClient!.models.generateContent({
      model,
      contents: promptText as any,
      config: configObj,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`API call timed out after ${timeoutMs}ms`)), timeoutMs)
    );

    const response: any = await Promise.race([apiPromise, timeoutPromise]);
    const responseText = response?.text?.trim();
    if (responseText) {
      return responseText;
    }
    return null;
  });
}

const ASSISTANT_REFUSAL = "Main CivicSense AI Assistant hoon aur shehar ke civic issues (jaise sadak ke gaddhe, kachra, paani leakage, drainage, streetlights) aur is platform ke baare mein madad karta hoon. 😊 Batayein, main aapki kisi civic issue mein kaise madad kar sakta hoon?";

function classifyCivicDomain(userMessage: string): boolean {
  const text = userMessage.toLowerCase().trim();

  // Allow pain, injury, accident, doctor, fall - these frequently relate to road defects/potholes/manholes
  const isInjuryOrAccident =
    /\b(pain|leg|hurt|injury|injured|accident|wound|fracture|fell|doctor|hospital|chot|dard|gir gaya)\b/.test(text);
  if (isInjuryOrAccident) {
    return true;
  }

  // Pure non-civic off-topic patterns
  const nonCivicPatterns = [
    /\b(cricket|football|match|ipl|score|virat|dhoni|messi|ronaldo|world cup)\b/,
    /\b(python|javascript|typescript|c\+\+|java|html|css|coding|program|code|function|debug|algorithm|developer)\b/,
    /\b(quantum|physics|chemistry|calculus|algebra|homework|maths|equation|solve this math)\b/,
    /\b(movie|film|actor|actress|cinema|bollywood|hollywood|song|music|album|celebrity|joke|tell me a joke)\b/,
    /\b(stock|share market|bitcoin|crypto|investment|finance|trading|mutual fund)\b/,
    /\b(politics|election|prime minister|president|political party|modi|bjp|congress|vote)\b/,
    /\b(hotel|flight|vacation|tourist|travel recommendation|best places to visit in)\b/,
    /\b(write an essay|write a poem|write a story|write a letter|tell me a story)\b/
  ];

  for (const pattern of nonCivicPatterns) {
    if (pattern.test(text)) {
      if (
        !text.includes('complaint') &&
        !text.includes('pothole') &&
        !text.includes('kachra') &&
        !text.includes('paani') &&
        !text.includes('road') &&
        !text.includes('civicsense')
      ) {
        return false;
      }
    }
  }

  return true;
}

function generateCivicAssistantFallback(query: string, user: UserRecord | null, database: DatabaseSchema): string {
  const q = query.toLowerCase().trim();

  // Refusal check for strictly out-of-domain topics
  if (
    q.includes('cricket') ||
    q.includes('python') ||
    q.includes('movie') ||
    q.includes('song') ||
    q.includes('physics') ||
    q.includes('math') ||
    q.includes('coding') ||
    q.includes('bitcoin') ||
    q.includes('stock market')
  ) {
    return ASSISTANT_REFUSAL;
  }

  // 1. Pain / Leg / Injury / Accident / Health concerns
  if (
    q.includes('pain') ||
    q.includes('leg') ||
    q.includes('hurt') ||
    q.includes('dard') ||
    q.includes('chot') ||
    q.includes('injury') ||
    q.includes('accident') ||
    q.includes('hospital') ||
    q.includes('doctor') ||
    q.includes('fracture') ||
    q.includes('wound') ||
    q.includes('gir gaya') ||
    q.includes('fall') ||
    q.includes('knee') ||
    q.includes('foot')
  ) {
    return "I'm sorry to hear that! Agar aapko dard ya chot aayi hai, kripya pehle kisi Doctor ya Emergency Medical Service (**108 / 102**) se sampark karein aur first-aid lein. Aapki health aur safety sabse pehle hai! 🙏\n\n🏥 **Civic Hazard & Defect Reporting:**\nAgar yeh chot kisi sadak ke pothole, khule manhole, toote hue footpath ya andhere ki wajah se hui hai, toh aap yahan **'Report Issue'** tab mein jakar us dangerous spot ki photo aur exact location ke sath complaint submit kar sakte hain.\n\n⚠️ Complaint form mein **'Flag as Public Safety Emergency'** tick karein taaki Municipal Rapid Response team isko highest priority par repair kare aur baaki nagrik surakshit rahein.";
  }

  // 2. Greetings & Salutations
  if (
    q === 'hi' ||
    q === 'hello' ||
    q === 'hey' ||
    q === 'namaste' ||
    q === 'pranam' ||
    q.startsWith('hi ') ||
    q.startsWith('hello ') ||
    q.startsWith('hey ') ||
    q.includes('kaise ho') ||
    q.includes('good morning') ||
    q.includes('good evening') ||
    q.includes('good afternoon') ||
    q.includes('how are you')
  ) {
    return "Namaste! 🙏 Main aapka CivicSense AI Assistant hoon.\n\nMain shehar ke civic issues—jaise **sadak ke gaddhe (potholes), kachra (garbage), paani leakage/drainage, tooti streetlights**—ko report karne, unka priority score calculate karne aur live status track karne mein aapki poori madad karta hoon.\n\nBatayein, aaj main aapki kya madad kar sakta hoon? Aap apna sawaal pooch sakte hain ya upar diye gaye options me se select kar sakte hain!";
  }

  // 3. Emergency / Danger / Electrical Sparking / Flood / Open Manhole
  if (
    q.includes('emergency') ||
    q.includes('danger') ||
    q.includes('khatra') ||
    q.includes('sparking') ||
    q.includes('live wire') ||
    q.includes('taar gir gaya') ||
    q.includes('fire') ||
    q.includes('aag') ||
    q.includes('short circuit') ||
    q.includes('flood') ||
    q.includes('manhole khula')
  ) {
    return "🚨 **Urgent Civic Safety Alert:**\n\n1. **Safe Distance Banayein**: Live wires, sparking transformers, deep open manholes ya flooded drainage se turant door rahein!\n2. **Emergency Hotlines Par Call Karein**:\n   • **112**: All-in-One National Emergency Helpline\n   • **101**: Fire Brigade\n   • **108**: Ambulance / Medical Emergency\n3. **CivicSense Platform Par Rapid Alert File Karein**:\n   Top bar mein **'Report Issue'** button dabayein, category chunein aur form mein **'Flag as Public Safety Emergency'** tick karein taaki Municipal Control Room ko instant critical triage alert bheja ja sake.";
  }

  // 4. Resolution Timeline / SLA / "Kab tak thik hoga"
  if (
    q.includes('kab tak') ||
    q.includes('kitna time') ||
    q.includes('kitne din') ||
    q.includes('how long') ||
    q.includes('sla') ||
    q.includes('timeline') ||
    q.includes('when will') ||
    q.includes('kab solve') ||
    q.includes('kitni der')
  ) {
    return "⏱️ **CivicSense AI Municipal SLA & Resolution Timelines:**\n\nCivicSense AI har complaint ke priority score (0-100) ke aadhar par standard Service Level Agreement (SLA) define karta hai:\n\n• 🔴 **Critical Priority (Score 80-100)**: **24 Ghante** ke andar action (open manholes, live electrical wires, critical road sinkholes).\n• 🟠 **High Priority (Score 60-79)**: **48 Ghante** ke andar (major highway potholes, drinking water mains burst).\n• 🟡 **Medium Priority (Score 35-59)**: **3 se 5 din** ke andar (garbage collection overflow, non-functional streetlights).\n• 🟢 **Low Priority (Score 0-34)**: **7 din** ke andar (routine maintenance, footpath hairline patches).\n\nApni specific complaint ka live status janane ke liye **'Track Complaint'** tab par apna Ticket ID search karein!";
  }

  // 5. Account / Login / Signup / Password Reset
  if (
    q.includes('login') ||
    q.includes('signin') ||
    q.includes('sign in') ||
    q.includes('signup') ||
    q.includes('sign up') ||
    q.includes('register account') ||
    q.includes('password') ||
    q.includes('otp') ||
    q.includes('google sign')
  ) {
    return "🔐 **Citizen Account & Authentication Assistance:**\n\nCivicSense AI par aap aasaani se sign in kar sakte hain:\n• **Google Sign-In**: 'Continue with Google' par click karke direct access paayein.\n• **Phone OTP / Email OTP**: Apna mobile number ya email enter karein aur received 6-digit verification code dalein.\n• **Password Reset**: Agar password bhool gaye hain, toh 'Forgot Password' link par jakar naya password set kar sakte hain.\n\nSign in karne ke baad aap **'My Submitted Complaints'** mein apni sabhi past reports, officer updates aur resolution photos live dekh sakte hain!";
  }

  // 6. Municipal Console / Officer / Admin Access
  if (
    q.includes('officer') ||
    q.includes('municipal console') ||
    q.includes('admin') ||
    q.includes('staff') ||
    q.includes('triage')
  ) {
    return "🏢 **Municipal Command & Officer Console:**\n\nMunicipal Console shahar ke Department Officers aur Administrators ke liye triage command center hai:\n• New incoming complaints ko priority order mein review karna.\n• Field workers ko dispatch karna aur status 'In Progress' / 'Resolved' update karna.\n• Resolution proof photo upload karna.\n\n*Note: Municipal Console access karne ke liye Administrator ya Department Officer account se sign in hona avashyak hai. Citizens apni complaints 'Track Complaint' tab par track kar sakte hain.*";
  }

  // 7. Potholes / Road issues
  if (
    q.includes('pothole') ||
    q.includes('gaddha') ||
    q.includes('sadak') ||
    q.includes('road') ||
    q.includes('crater') ||
    q.includes('highway') ||
    q.includes('footpath') ||
    q.includes('pavement')
  ) {
    return "🛣️ **Pothole ya Sadak Kharaab hone par complaint kaise karein:**\n\n1. Top menu mein **'Report Issue'** tab par click karein.\n2. Title & Description mein exact jagah aur problem likhein.\n3. Category mein **'Potholes & Road Damage'** choose karein.\n4. Clear photo upload karein aur location landmark add karein.\n5. AI System safety risk aur severity ka score calculate karke Public Works Department (Roads) ko assign kar dega.\n6. Complaint submit hote hi aapko **Ticket ID** (e.g. CIV-XXXX) milegi jisse aap live progress track kar sakte hain.";
  }

  // 8. Garbage / Sanitation
  if (
    q.includes('kachra') ||
    q.includes('garbage') ||
    q.includes('waste') ||
    q.includes('safai') ||
    q.includes('dustbin') ||
    q.includes('trash') ||
    q.includes('cleanliness') ||
    q.includes('dump')
  ) {
    return "🧹 **Kachra ya Safai (Garbage & Sanitation) ki complaint:**\n\n1. **'Report Issue'** form open karein.\n2. Category **'Garbage & Sanitation'** select karein.\n3. Overflowing dustbin, uncollected waste ya illegal dumping location enter karein.\n4. Ticket direct **Waste & Environmental Sanitation Department** ko bhej diya jayega.\n5. Department officer status 'In Progress' aur resolution photo upload karega.";
  }

  // 9. Water Leakage & Drainage
  if (
    q.includes('water') ||
    q.includes('paani') ||
    q.includes('pani') ||
    q.includes('leak') ||
    q.includes('drainage') ||
    q.includes('sewage') ||
    q.includes('nali') ||
    q.includes('pipe') ||
    q.includes('overflow')
  ) {
    return "💧 **Paani Leakage ya Sewage Overflow ki complaint:**\n\n1. **'Report Issue'** page par jaakar Category **'Water Leakage & Drainage'** select karein.\n2. Leakage ki severity describe karein (e.g. clean drinking water pipe burst ya sewage overflow).\n3. Exact location/street address enter karein.\n4. Ticket **Municipal Water & Sewerage Board** ko dispatch hoga.\n\n⚠️ **Safety Tip:** Agar paani live bijli ke taar ya transformer ke paas flooded hai, toh turant safe distance banayein!";
  }

  // 10. Streetlight & Electricity
  if (
    q.includes('streetlight') ||
    q.includes('light') ||
    q.includes('lamp') ||
    q.includes('bijli') ||
    q.includes('wire') ||
    q.includes('andhera') ||
    q.includes('electricity') ||
    q.includes('dark')
  ) {
    return "💡 **Broken Streetlight ya Bijli problem report karne ke liye:**\n\n1. **'Report Issue'** tab select karein.\n2. Category **'Broken Streetlights & Electrical'** select karein.\n3. Pole number ya nearest building landmark specify karein.\n4. Ticket **City Power & Electrical Authority** ko assign hoga.\n\n⚠️ **Emergency Safety:** Agar koi live bijli ka taar toota hua gira hai, toh use bilkul na chhuein aur aas-paas ke logon ko savdhan karein.";
  }

  // 11. Category / Capabilities
  const isCategoryQuery =
    q.includes('kya kya') ||
    q.includes('kya complain') ||
    q.includes('konsi complain') ||
    q.includes('kaun si') ||
    q.includes('kya file') ||
    q.includes('kya report') ||
    q.includes('kya kr sakta') ||
    q.includes('kya kar sakta') ||
    q.includes('categories') ||
    q.includes('types') ||
    q.includes('kon kon') ||
    q.includes('option');

  if (isCategoryQuery) {
    return "📋 **CivicSense AI par aap in sabhi Civic Issues ki Complaint file kar sakte hain:**\n\n1. 🛣️ **Potholes & Road Damage**: Sadak ke gaddhe, tooti sadak, manhole damage, broken pavements.\n2. 🧹 **Garbage & Sanitation**: Kachra na uthna, overflowing dustbins, open waste dump, safai ki kami.\n3. 💧 **Water Leakage & Drainage**: Paani ke pipe leakage, sewage overflow, clogged naliyan, waterlogging.\n4. 💡 **Broken Streetlights & Electrical**: Tooti streetlights, live bijli wires, sparking transformers.\n5. 🚧 **Public Infrastructure**: Broken footpaths, damaged public benches, park maintenance.\n6. 🚸 **Pedestrian & Traffic Safety**: Missing traffic signs, unsafe zebra crossings, damaged speed bumps.\n\nNayi complaint file karne ke liye top bar mein **'Report Issue'** button par click karein!";
  }

  // 12. Tracking & Status check
  const isStatusQuery =
    q.includes('status') ||
    q.includes('track') ||
    q.includes('kya hua') ||
    q.includes('kaha tak') ||
    q.includes('kab tak') ||
    q.includes('kab thik') ||
    q.includes('progress') ||
    q.includes('followup') ||
    q.includes('m jo') ||
    q.includes('mera status') ||
    q.includes('meri complaint') ||
    q.includes('mere ticket') ||
    q.includes('complain ka kya') ||
    (q.includes('complain') && (q.includes('hua') || q.includes('dekhna') || q.includes('batao') || q.includes('kiya') || q.includes('diya')));

  if (isStatusQuery) {
    let matchedComplaints: Complaint[] = [];

    if (user) {
      matchedComplaints = database.complaints.filter(
        (c) =>
          (c.reporter_email && c.reporter_email.toLowerCase() === user.email.toLowerCase()) ||
          (c.reporter_name && user.full_name && c.reporter_name.toLowerCase().includes(user.full_name.toLowerCase()))
      );
    }

    if (user && matchedComplaints.length > 0) {
      const latestList = matchedComplaints.slice(0, 3);
      const listText = latestList
        .map((c) => {
          const dept = database.departments.find((d) => d.id === c.assigned_department_id);
          return `• **${c.id}**: "${c.title}"\n  📍 Category: ${c.category}\n  ⚡ Status: **${c.status}** | Priority: **${c.priority_level}** (${c.priority_score}/100)\n  🏢 Dept: ${dept ? dept.name : 'Municipal Dept'}`;
        })
        .join('\n\n');

      return `📊 **Aapki Registered Complaints ka Current Status (${matchedComplaints.length} Total):**\n\n${listText}\n\n🔍 Detail inspection tracking ke liye **'Track Complaint'** tab par Ticket ID enter karein!`;
    }

    if (database.complaints.length > 0) {
      const recentList = database.complaints.slice(0, 2);
      const sampleText = recentList
        .map((c) => `• **${c.id}**: "${c.title}" — Status: **${c.status}** (${c.priority_level} Priority)`)
        .join('\n');

      return `🔍 **Complaint Status Tracking:**\n\nAapki complaints ka status check karne ke liye:\n1. Top menu mein **'Track Complaint'** tab par click karein.\n2. Apna **Ticket ID** (e.g. CIV-XXXX) enter karke Search karein.\n\nDatabase mein recent active tickets:\n${sampleText}\n\n*(Tip: Agar aapne Sign In kiya hai, toh 'My Submitted Complaints' section mein aapki saari tickets dikhengi!)*`;
    }

    return "🔍 **Complaint Status Check:**\n\nAap apni complaint ka status **'Track Complaint'** tab par apna Ticket ID (e.g. **CIV-1001**) enter karke check kar sakte hain. Agar aapne abhi tak complaint file nahi ki hai, toh **'Report Issue'** tab se abhi file karein!";
  }

  // 13. Escalation / Delays / "Kisine sunvai nahi ki" / "Bohot time ho gaya"
  if (
    q.includes('sunvai') ||
    q.includes('delay') ||
    q.includes('der') ||
    q.includes('late') ||
    q.includes('action nahi') ||
    q.includes('kuch nahi hua') ||
    q.includes('escalat') ||
    q.includes('bohot din') ||
    q.includes('ignore')
  ) {
    return "⚡ **Delayed Complaints & Automated Escalation Engine:**\n\nCivicSense AI mein har complaint ke sath automatic dynamic escalation laga hua hai:\n\n1. **Automated Time-Unresolved Score Boost (15%)**: Jaise-jaise samay beet-ta hai aur complaint resolve nahi hoti, AI system automatically complaint ka priority score badha deta hai taaki yeh officer dashboard par top priority par aa jaye.\n2. **SLA Breach Warnings**: Agar Critical ticket 24 ghante ya High ticket 48 ghante me resolve nahi hota, toh Control Room dashboard par red SLA breach alert highlight ho jata hai.\n3. **Follow-Up Step**: Aap **'Track Complaint'** tab par jakar Ticket ID check karein aur wahan assigned department officer ka contact ya latest municipal status note verify karein.";
  }

  // 14. Photo / Evidence upload assistance
  if (
    q.includes('photo') ||
    q.includes('image') ||
    q.includes('camera') ||
    q.includes('tasveer') ||
    q.includes('upload') ||
    q.includes('picture')
  ) {
    return "📷 **Photo Upload & Visual AI Inspection:**\n\n1. **'Report Issue'** form mein **'Upload / Capture Photo'** area par click karein.\n2. Mobile user camera se live spot ki clear photo khinch sakte hain ya gallery se upload kar sakte hain.\n3. **Tip**: Problem ki wide-angle aur close-up dono features dikhane wali photo se AI severity score (0-100) aur safety risk zyada accurately calculate hota hai.\n4. Complaint resolve hone par municipal officer bhi **'Resolution Proof Photo'** upload karta hai jise aap check kar sakte hain.";
  }

  // 15. GPS & Location setting
  if (
    q.includes('gps') ||
    q.includes('location') ||
    q.includes('map') ||
    q.includes('landmark') ||
    q.includes('pata') ||
    q.includes('address') ||
    q.includes('jagah')
  ) {
    return "📍 **Accurate Location & GPS Tagging:**\n\n1. **'Report Issue'** form mein **'Detect My Current Location'** button dabane par browser GPS aapki latitude/longitude pin coordinate automatically le lega.\n2. Location Description mein landmark (jaise 'Near City Hospital Gate #2', 'Opposite Metro Pillar 140') zaroor likhein.\n3. Interactive Map tab par aap shahar ke sabhi active reported civic issues aur clusters ko visual pins par dekh sakte hain.";
  }

  // 16. How to register / file a complaint general
  if (
    q.includes('register') ||
    q.includes('complaint') ||
    q.includes('report') ||
    q.includes('kaise') ||
    q.includes('file') ||
    q.includes('nayi') ||
    q.includes('daal') ||
    q.includes('karni')
  ) {
    return "📝 **CivicSense AI par Nayi Complaint Register karne ke steps:**\n\n1. Navigation bar mein **'Report Issue'** button par click karein.\n2. Defect ka Title (e.g., 'Main road par bada pothole') aur Description enter karein.\n3. Sahi Category select karein (Road, Garbage, Water, Light, etc.).\n4. Problem ki Photo upload karein aur Location landmark enter karein.\n5. **'Submit Complaint'** par click karein.\n\n✨ CivicSense AI engine aapki report ka Risk & Priority score compute karega aur sahi municipal department ko assign karega!";
  }

  // 17. Priority scoring explanation
  if (
    q.includes('priority') ||
    q.includes('score') ||
    q.includes('decide') ||
    q.includes('urgency') ||
    q.includes('critical') ||
    q.includes('formula') ||
    q.includes('calculation')
  ) {
    return "🎯 **CivicSense AI Priority Engine kaise kaam karta hai:**\n\nAI Engine har complaint ke 4 key factors analyze karta hai:\n\n1. **Safety Risk (40%)**: Immediate physical danger (exposed wires, deep sinkholes, dangerous flooding).\n2. **Defect Severity (25%)**: Structural damage level.\n3. **Public Density (20%)**: High-traffic areas (schools, hospitals, market junctions).\n4. **Unresolved Time (15%)**: SLA breach priority boost over time.\n\nScore (0-100) ke aadhar par priority **Critical, High, Medium, ya Low** set hoti hai.";
  }

  // 18. Dynamic typed question responder (tailored to user's typed words)
  const isHindi = /[अ-ह]|kya|kaise|karo|batao|mera|meri|kaha|hain|hai|nahi|mujhe|chahiye/i.test(query);
  const cleanSnippet = query.trim().length > 60 ? query.trim().substring(0, 57) + '...' : query.trim();

  if (isHindi) {
    return `Main aapke is sawaal: *" ${cleanSnippet} "* ko samajh raha hoon. 🙏\n\nCivicSense AI platform par aap shehar ke sabhi civic issues ko manage kar sakte hain:\n• 📝 **Problem Report**: 'Report Issue' tab se naye potholes, drainage, kachra ya bijli issues submit karein.\n• 🔍 **Live Progress**: 'Track Complaint' tab par jakar Ticket ID (jaise CIV-XXXX) se live update dekhein.\n• 🚨 **Urgent Help**: Agar kisi ko chot aayi hai ya sadak par emergency risk hai, toh report karte samay 'Flag as Public Safety Emergency' tick karein.\n\nAap apna specific sawaal ya problem ka description likh sakte hain, main turant guide karunga!`;
  }

  return `Regarding your query: *" ${cleanSnippet} "*:\n\nCivicSense AI is designed to help you resolve and track municipal issues:\n• 📝 **Submit a Report**: Head to the **'Report Issue'** tab to log damaged roads, water leaks, garbage, or faulty streetlights.\n• 🔍 **Track Progress**: Open **'Track Complaint'** and search by your Ticket ID (e.g., CIV-XXXX) for live status, priority score, and assigned officer notes.\n• 🚨 **Public Danger**: Check 'Flag as Public Safety Emergency' for immediate priority escalation.\n\nFeel free to ask any specific question about your complaint or municipal services!`;
}

app.post('/api/assistant/chat', async (req: Request, res: Response) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const userQuery = message.trim();

    // Domain validation
    const isAllowedDomain = classifyCivicDomain(userQuery);
    if (!isAllowedDomain) {
      return res.json({
        reply: ASSISTANT_REFUSAL,
        isRefusal: true,
      });
    }

    db = readDatabase();
    const authUser = getAuthenticatedUser(req, db);

    let userContextString = '';
    if (authUser) {
      const userComplaints = db.complaints.filter(
        (c) =>
          (c.reporter_email && c.reporter_email.toLowerCase() === authUser.email.toLowerCase()) ||
          (c.reporter_name && c.reporter_name.toLowerCase() === authUser.full_name.toLowerCase())
      );

      userContextString = `\nAuthenticated User Persona: Name "${authUser.full_name}", Email "${authUser.email}", Role "${authUser.role}".
User Complaints (${userComplaints.length}): ${JSON.stringify(
        userComplaints.map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          priority_level: c.priority_level,
          priority_score: c.priority_score,
          category: c.category,
          submitted_at: c.submitted_at,
        }))
      )}`;
    }

    // Complaint ID specific lookup check
    const idMatch = userQuery.match(/CIV-\d+/i);
    let specificComplaintContext = '';
    if (idMatch) {
      const requestedId = idMatch[0].toUpperCase();
      const complaint = db.complaints.find((c) => c.id.toUpperCase() === requestedId);
      if (complaint) {
        const isAuthorized =
          !authUser ||
          authUser.role === 'Administrator' ||
          (authUser.role === 'Department Officer' && authUser.department_id === complaint.assigned_department_id) ||
          (authUser.role === 'Citizen' && complaint.reporter_email?.toLowerCase() === authUser.email.toLowerCase());

        if (isAuthorized) {
          const dept = db.departments.find((d) => d.id === complaint.assigned_department_id);
          const history = db.statusHistory
            .filter((h) => h.complaint_id === complaint.id)
            .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

          specificComplaintContext = `\nRequested Complaint (${requestedId}): Title "${complaint.title}", Status "${complaint.status}", Category "${complaint.category}", Priority "${complaint.priority_level}" (${complaint.priority_score}/100), Assigned Dept "${dept ? dept.name : 'Unassigned'}", Latest Update Note "${history[0]?.note || 'No notes'}"`;
        } else {
          specificComplaintContext = `\nRequested Complaint ID ${requestedId} exists, but user is not authorized to access another citizen's private complaint.`;
        }
      } else {
        specificComplaintContext = `\nRequested Complaint ID ${requestedId} was NOT found in the database.`;
      }
    }

    const systemInstructionText = `You are CivicSense AI Assistant, an empathetic, smart civic intelligence assistant.
Your capabilities:
1. Help citizens and municipal officers report, resolve, and track civic problems (potholes, garbage, water leaks, drainage, broken streetlights, electrical hazards).
2. Explain priority score calculations (Safety 40%, Severity 25%, Density 20%, Time 15%), SLAs, and department workflows.
3. If a user asks about pain, injury, accidents, or feeling hurt (e.g. "I had pain in my leg", "fell on the road"):
   - First express genuine empathy and recommend seeking medical attention / emergency services (108/102/doctor) for their health.
   - Ask if the injury occurred due to a civic defect (such as an open manhole, pothole, or uneven road/footpath).
   - Explain how they can submit a high-priority complaint on the 'Report Issue' tab with photo and location to ensure municipal teams repair the hazard promptly.
4. If a user sends a greeting ("hi", "hello", "how are you"), respond warmly, briefly explain your civic assistance capabilities, and offer help.
5. If a user asks something completely outside civic matters (e.g. cricket score, coding homework, stock market), politely redirect them back to civic guidance with a helpful tone.
6. Support Hindi, English, and Hinglish. Match the user's preferred language. Keep responses concise, clear, and actionable.${userContextString}${specificComplaintContext}`;

    const historyText = Array.isArray(conversationHistory)
      ? conversationHistory
          .slice(-6)
          .map((h: any) => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`)
          .join('\n')
      : '';

    const fullPrompt = `${historyText ? `Recent Chat History:\n${historyText}\n\n` : ''}User Question: "${userQuery}"`;

    const geminiReply = await callGeminiWithTimeout(fullPrompt, systemInstructionText, 4000);
    if (geminiReply) {
      return res.json({ reply: geminiReply });
    }

    const fallbackReply = generateCivicAssistantFallback(userQuery, authUser, db);
    return res.json({ reply: fallbackReply });
  } catch (err) {
    console.error('Error in assistant chat API:', err);
    return res.status(500).json({ error: 'AI Assistant temporarily unavailable. Please try again.' });
  }
});

// Setup Vite middleware in dev or static serving in prod
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, 'vite.config.ts'),
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`CivicSense AI Server running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
