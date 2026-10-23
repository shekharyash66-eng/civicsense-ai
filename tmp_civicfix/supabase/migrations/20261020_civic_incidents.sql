-- CivicFix Phase 1: Persistent Incident Grouping & Duplicate Review Schema
-- Run this in your Supabase Dashboard SQL Editor (Project: tnrkddekmrylxmnosrsg)

-- 1. Ensure public.reports has incident_id column
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS incident_id TEXT;
CREATE INDEX IF NOT EXISTS idx_reports_incident_id ON public.reports(incident_id);

-- 2. CREATE public.civic_incidents TABLE
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

-- Enable Row Level Security on civic_incidents
ALTER TABLE public.civic_incidents ENABLE ROW LEVEL SECURITY;

-- Incidents RLS Policies:
-- Transparent read access for verified citizens and administrators
DROP POLICY IF EXISTS "Anyone can view civic incidents" ON public.civic_incidents;
CREATE POLICY "Anyone can view civic incidents"
    ON public.civic_incidents
    FOR SELECT
    USING (true);

-- Strictly administrators can insert or modify confirmed incidents
DROP POLICY IF EXISTS "Admins can insert civic incidents" ON public.civic_incidents;
CREATE POLICY "Admins can insert civic incidents"
    ON public.civic_incidents
    FOR INSERT
    WITH CHECK (public.is_admin() OR current_user = 'service_role');

DROP POLICY IF EXISTS "Admins can update civic incidents" ON public.civic_incidents;
CREATE POLICY "Admins can update civic incidents"
    ON public.civic_incidents
    FOR UPDATE
    USING (public.is_admin() OR current_user = 'service_role')
    WITH CHECK (public.is_admin() OR current_user = 'service_role');

-- 3. CREATE public.civic_duplicate_reviews TABLE
-- Stores admin confirmation and rejection decisions to prevent repeated presentation
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

-- Enable Row Level Security on civic_duplicate_reviews
ALTER TABLE public.civic_duplicate_reviews ENABLE ROW LEVEL SECURITY;

-- Duplicate Reviews RLS Policies:
-- Only administrators can view duplicate review triage decisions
DROP POLICY IF EXISTS "Admins can view duplicate reviews" ON public.civic_duplicate_reviews;
CREATE POLICY "Admins can view duplicate reviews"
    ON public.civic_duplicate_reviews
    FOR SELECT
    USING (public.is_admin() OR current_user = 'service_role');

-- Only administrators can insert or update review decisions
DROP POLICY IF EXISTS "Admins can insert duplicate reviews" ON public.civic_duplicate_reviews;
CREATE POLICY "Admins can insert duplicate reviews"
    ON public.civic_duplicate_reviews
    FOR INSERT
    WITH CHECK (public.is_admin() OR current_user = 'service_role');

DROP POLICY IF EXISTS "Admins can update duplicate reviews" ON public.civic_duplicate_reviews;
CREATE POLICY "Admins can update duplicate reviews"
    ON public.civic_duplicate_reviews
    FOR UPDATE
    USING (public.is_admin() OR current_user = 'service_role')
    WITH CHECK (public.is_admin() OR current_user = 'service_role');

-- 4. PERFORMANCE & DEDUPLICATION INDEXES
CREATE INDEX IF NOT EXISTS idx_civic_incidents_incident_id ON public.civic_incidents(incident_id);
CREATE INDEX IF NOT EXISTS idx_civic_incidents_status ON public.civic_incidents(status);
CREATE INDEX IF NOT EXISTS idx_civic_duplicate_reviews_pair_key ON public.civic_duplicate_reviews(pair_key);
CREATE INDEX IF NOT EXISTS idx_civic_duplicate_reviews_decision ON public.civic_duplicate_reviews(decision);
