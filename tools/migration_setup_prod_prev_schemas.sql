-- ==============================================================================
-- Migration: Setup "checklist_prod" and "checklist_prev" Schemas
-- Run this in the Supabase Dashboard -> SQL Editor (or via psql)
-- ==============================================================================

-- 1. Create schemas
CREATE SCHEMA IF NOT EXISTS checklist_prod;
CREATE SCHEMA IF NOT EXISTS checklist_prev;

-- 2. Grant permissions to Supabase roles for checklist_prod
GRANT USAGE ON SCHEMA checklist_prod TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA checklist_prod TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA checklist_prod TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA checklist_prod TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA checklist_prod
    GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- 3. Grant permissions to Supabase roles for checklist_prev
GRANT USAGE ON SCHEMA checklist_prev TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA checklist_prev TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA checklist_prev TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA checklist_prev TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA checklist_prev
    GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- 4. Drop old / obsolete schemas
DROP SCHEMA IF EXISTS checklist_web_app CASCADE;
DROP SCHEMA IF EXISTS "checklist-prod" CASCADE;
DROP SCHEMA IF EXISTS "checklist-prev" CASCADE;
