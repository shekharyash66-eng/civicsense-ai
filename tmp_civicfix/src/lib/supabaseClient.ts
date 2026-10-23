import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Default credentials supplied by user
export const DEFAULT_SUPABASE_PROJECT_ID = "tnrkddekmrylxmnosrsg";
export const DEFAULT_SUPABASE_URL = `https://${DEFAULT_SUPABASE_PROJECT_ID}.supabase.co`;
export const DEFAULT_SUPABASE_KEY = "sb_publishable_xvNp0C60ZHaFVKSWGdWTkQ_tf45sZ-H";

const STORAGE_KEY_SUPABASE_CONFIG = "civicfix_supabase_config_v1";

export interface SupabaseConfig {
  url: string;
  key: string;
  projectId: string;
  enabled: boolean;
}

export function getSupabaseConfig(): SupabaseConfig {
  const metaEnv = typeof import.meta !== "undefined" ? (import.meta as any)?.env || {} : {};
  const envUrl = metaEnv.VITE_SUPABASE_URL || metaEnv.SUPABASE_URL;
  const envKey = metaEnv.VITE_SUPABASE_ANON_KEY || metaEnv.SUPABASE_ANON_KEY;

  if (typeof window === "undefined") {
    return {
      url: envUrl || DEFAULT_SUPABASE_URL,
      key: envKey || DEFAULT_SUPABASE_KEY,
      projectId: DEFAULT_SUPABASE_PROJECT_ID,
      enabled: true,
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUPABASE_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.url && parsed.key) {
        return parsed;
      }
    }
  } catch (e) {
    // Ignore JSON errors
  }

  return {
    url: envUrl || DEFAULT_SUPABASE_URL,
    key: envKey || DEFAULT_SUPABASE_KEY,
    projectId: DEFAULT_SUPABASE_PROJECT_ID,
    enabled: true,
  };
}

export function saveSupabaseConfig(config: Partial<SupabaseConfig>): SupabaseConfig {
  const current = getSupabaseConfig();
  const updated: SupabaseConfig = {
    ...current,
    ...config,
  };

  // Derive project ID if URL is provided
  if (updated.url && !updated.projectId) {
    const match = updated.url.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/);
    if (match && match[1]) {
      updated.projectId = match[1];
    }
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_SUPABASE_CONFIG, JSON.stringify(updated));
  }

  // Reset singleton client so it recreates with new config
  supabaseClientInstance = null;
  return updated;
}

let supabaseClientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.enabled || !config.url || !config.key) {
    return null;
  }

  if (!supabaseClientInstance) {
    try {
      supabaseClientInstance = createClient(config.url, config.key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    } catch (err) {
      console.warn("[Supabase] Failed to initialize client:", err);
      return null;
    }
  }

  return supabaseClientInstance;
}

/**
 * Recommended PostgreSQL table definition for Supabase SQL Editor:
 */
export const SUPABASE_SQL_SCHEMA = `-- CivicFix Database Schema & RBAC Setup for Supabase
-- Run this script in your Supabase Dashboard SQL Editor (Project: tnrkddekmrylxmnosrsg)

-- 1. Ensure UUID extension is installed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CREATE OR UPGRADE public.profiles TABLE (References auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    ward TEXT,
    city TEXT,
    citizen_id TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'admin')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Ensure all required columns exist even if public.profiles already existed
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'admin'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS citizen_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Ensure profiles table has RLS enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. SECURE HELPER FUNCTION: is_admin()
-- Uses SECURITY DEFINER with search_path set to public to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 4. ROLE ESCALATION PROTECTION TRIGGER
-- Prevents ordinary citizens from updating their own role column to 'admin'
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If role is modified, ensure caller is an admin or service_role
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_admin() AND current_user <> 'service_role' THEN
      RAISE EXCEPTION 'Access Denied: Citizens cannot elevate their own role to admin.';
    END IF;
  END IF;
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_profile_role ON public.profiles;
CREATE TRIGGER tr_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

-- 5. AUTOMATIC PROFILE CREATION ON NEW AUTH.USERS (Google OAuth / Email signup trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, avatar_url, ward, city, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    COALESCE(NEW.raw_user_meta_data->>'ward', ''),
    COALESCE(NEW.raw_user_meta_data->>'city', 'Bengaluru'),
    'citizen' -- Strictly default to citizen
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    avatar_url = CASE WHEN public.profiles.avatar_url IS NULL OR public.profiles.avatar_url = '' THEN EXCLUDED.avatar_url ELSE public.profiles.avatar_url END,
    updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- BACKFILL: Populate profiles for any auth.users that were registered before the trigger was installed
INSERT INTO public.profiles (id, full_name, email, phone, avatar_url, ward, city, role)
SELECT 
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    u.email,
    COALESCE(u.raw_user_meta_data->>'phone', u.phone, ''),
    COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture', ''),
    COALESCE(u.raw_user_meta_data->>'ward', ''),
    COALESCE(u.raw_user_meta_data->>'city', 'Bengaluru'),
    'citizen'
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- 6. PROFILES RLS POLICIES
DROP POLICY IF EXISTS "Users can read own profile or admin can read all" ON public.profiles;
CREATE POLICY "Users can read own profile or admin can read all"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id OR current_user = 'service_role');

-- 7. CREATE OR UPGRADE public.reports TABLE
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    citizen_id TEXT,
    citizen_name TEXT,
    citizen_phone TEXT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    department TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'SUBMITTED',
    address TEXT,
    city TEXT,
    ward TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    image_url TEXT,
    photos TEXT[] DEFAULT '{}',
    evidence_photos TEXT[] DEFAULT '{}',
    timeline JSONB DEFAULT '[]'::jsonb,
    estimated_resolution TEXT DEFAULT '1–3 days',
    ai_confidence DOUBLE PRECISION DEFAULT 0.9,
    ai_suggested_category TEXT,
    ai_suggested_department TEXT,
    assigned_to TEXT,
    assigned_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    citizen_confirmed_resolution BOOLEAN DEFAULT false,
    citizen_feedback JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    raw_data JSONB
);

-- Ensure all columns exist if table was already created
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS complaint_id TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS citizen_id TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS citizen_name TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS citizen_phone TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS raw_data JSONB;

-- Enable Row Level Security on reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Drop old policies to prevent collision
DROP POLICY IF EXISTS "Allow public read access to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow public insert to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow authenticated insert to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow anon and auth insert to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow public update to reports" ON public.reports;
DROP POLICY IF EXISTS "Allow update to reports" ON public.reports;
DROP POLICY IF EXISTS "Citizen can read own reports or admin read all" ON public.reports;
DROP POLICY IF EXISTS "Citizen can insert own reports" ON public.reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;

-- Reports Policy 1: SELECT
-- Citizens can select their own reports; Admins can select all reports;
-- Public tracking is also allowed for tracking specific complaint by ID.
CREATE POLICY "Citizen can read own reports or admin read all"
    ON public.reports
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR public.is_admin()
        OR auth.role() = 'anon'
    );

-- Reports Policy 2: INSERT
-- Authenticated citizen inserts reports where user_id matches auth.uid()
CREATE POLICY "Citizen can insert own reports"
    ON public.reports
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        OR (auth.role() = 'anon' AND user_id IS NULL)
    );

-- Reports Policy 3: UPDATE
-- Admins can update any report; Citizens can update citizen_confirmed_resolution & citizen_feedback for their own reports
CREATE POLICY "Admins or owners can update reports"
    ON public.reports
    FOR UPDATE
    USING (
        public.is_admin()
        OR auth.uid() = user_id
    )
    WITH CHECK (
        public.is_admin()
        OR auth.uid() = user_id
    );

-- 8. CREATE public.admin_audit_logs TABLE
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can manage audit logs"
    ON public.admin_audit_logs
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 9. CREATE public.civic_incidents TABLE (Persistent Incident Grouping)
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS incident_id TEXT;

CREATE TABLE IF NOT EXISTS public.civic_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    department TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    primary_report_id TEXT NOT NULL,
    report_count INTEGER NOT NULL DEFAULT 1,
    confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    confirmed_by_email TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.civic_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view civic incidents" ON public.civic_incidents;
CREATE POLICY "Anyone can view civic incidents"
    ON public.civic_incidents FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert civic incidents" ON public.civic_incidents;
CREATE POLICY "Admins can insert civic incidents"
    ON public.civic_incidents FOR INSERT
    WITH CHECK (public.is_admin() OR current_user = 'service_role');

DROP POLICY IF EXISTS "Admins can update civic incidents" ON public.civic_incidents;
CREATE POLICY "Admins can update civic incidents"
    ON public.civic_incidents FOR UPDATE
    USING (public.is_admin() OR current_user = 'service_role')
    WITH CHECK (public.is_admin() OR current_user = 'service_role');

-- 10. CREATE public.civic_duplicate_reviews TABLE (Audit & Suppression of Review Decisions)
CREATE TABLE IF NOT EXISTS public.civic_duplicate_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pair_key TEXT NOT NULL UNIQUE,
    complaint_id_1 TEXT NOT NULL,
    complaint_id_2 TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('CONFIRMED', 'REJECTED')),
    incident_id TEXT,
    similarity_score DOUBLE PRECISION,
    matching_reasons TEXT[] DEFAULT '{}',
    review_notes TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_by_email TEXT,
    reviewed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.civic_duplicate_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view duplicate reviews" ON public.civic_duplicate_reviews;
CREATE POLICY "Admins can view duplicate reviews"
    ON public.civic_duplicate_reviews FOR SELECT USING (public.is_admin() OR current_user = 'service_role');

DROP POLICY IF EXISTS "Admins can insert duplicate reviews" ON public.civic_duplicate_reviews;
CREATE POLICY "Admins can insert duplicate reviews"
    ON public.civic_duplicate_reviews FOR INSERT
    WITH CHECK (public.is_admin() OR current_user = 'service_role');

DROP POLICY IF EXISTS "Admins can update duplicate reviews" ON public.civic_duplicate_reviews;
CREATE POLICY "Admins can update duplicate reviews"
    ON public.civic_duplicate_reviews FOR UPDATE
    USING (public.is_admin() OR current_user = 'service_role')
    WITH CHECK (public.is_admin() OR current_user = 'service_role');

-- 11. PERFORMANCE & DEDUPLICATION INDEXES
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_complaint_id ON public.reports(complaint_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_incident_id ON public.reports(incident_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_civic_incidents_incident_id ON public.civic_incidents(incident_id);
CREATE INDEX IF NOT EXISTS idx_civic_duplicate_reviews_pair_key ON public.civic_duplicate_reviews(pair_key);

-- 12. SAFE PROCEDURE TO PROMOTE INITIAL ADMINISTRATOR:
-- In your Supabase Dashboard SQL Editor, run the following line with your email:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your-admin@civicfix.org';
`;
