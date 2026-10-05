-- ==============================================================================
-- Migration: Move checklist application tables and types from 'public' to 'checklist_web_app'
-- Execute this script in the Supabase Dashboard -> SQL Editor (or via psql)
-- ==============================================================================

-- 1. Create the dedicated schema
CREATE SCHEMA IF NOT EXISTS checklist_web_app;

-- 2. Move enum types to checklist_web_app (if they exist in public)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'role' AND n.nspname = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'role' AND n.nspname = 'checklist_web_app') THEN
            ALTER TYPE public.role SET SCHEMA checklist_web_app;
        ELSE
            DROP TYPE public.role;
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'task_role' AND n.nspname = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'task_role' AND n.nspname = 'checklist_web_app') THEN
            ALTER TYPE public.task_role SET SCHEMA checklist_web_app;
        ELSE
            DROP TYPE public.task_role;
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'shift' AND n.nspname = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'shift' AND n.nspname = 'checklist_web_app') THEN
            ALTER TYPE public.shift SET SCHEMA checklist_web_app;
        ELSE
            DROP TYPE public.shift;
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'point_streak' AND n.nspname = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'point_streak' AND n.nspname = 'checklist_web_app') THEN
            ALTER TYPE public.point_streak SET SCHEMA checklist_web_app;
        ELSE
            DROP TYPE public.point_streak;
        END IF;
    END IF;
END $$;

-- 3. Move tables from public to checklist_web_app (if they exist in public)
ALTER TABLE IF EXISTS public.users SET SCHEMA checklist_web_app;
ALTER TABLE IF EXISTS public.branches SET SCHEMA checklist_web_app;
ALTER TABLE IF EXISTS public.tasks SET SCHEMA checklist_web_app;
ALTER TABLE IF EXISTS public.shift_session SET SCHEMA checklist_web_app;
ALTER TABLE IF EXISTS public.task_work SET SCHEMA checklist_web_app;
ALTER TABLE IF EXISTS public.refrigerators SET SCHEMA checklist_web_app;
ALTER TABLE IF EXISTS public.refrigerator_tasks SET SCHEMA checklist_web_app;
ALTER TABLE IF EXISTS public.notifications SET SCHEMA checklist_web_app;
ALTER TABLE IF EXISTS public.point_transactions SET SCHEMA checklist_web_app;

-- 4. Grant required schema and table permissions to Supabase roles
GRANT USAGE ON SCHEMA checklist_web_app TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA checklist_web_app TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA checklist_web_app TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA checklist_web_app TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA checklist_web_app
    GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA checklist_web_app
    GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA checklist_web_app
    GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 5. Add notifications table to Realtime publication
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE checklist_web_app.notifications;
        EXCEPTION
            WHEN duplicate_object THEN
                -- Table is already in publication
                NULL;
        END;
    END IF;
END $$;
