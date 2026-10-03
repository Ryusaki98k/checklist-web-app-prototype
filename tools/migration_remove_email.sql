-- ==============================================================================
-- Migration: Remove email field entirely from checklist_web_app schema
-- ==============================================================================

DO $$
BEGIN
    -- 1. Drop email column from users table if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'checklist_web_app' 
          AND table_name = 'users' 
          AND column_name = 'email'
    ) THEN
        ALTER TABLE checklist_web_app.users DROP COLUMN email CASCADE;
        RAISE NOTICE '✓ Dropped email column from checklist_web_app.users';
    ELSE
        RAISE NOTICE 'email column already dropped or does not exist in checklist_web_app.users';
    END IF;

    -- 2. Drop any residual indexes on email
    DROP INDEX IF EXISTS checklist_web_app.users_email_unique;
    DROP INDEX IF EXISTS checklist_web_app.idx_users_email;
    DROP INDEX IF EXISTS checklist_web_app.idx_users_email_lower;

    RAISE NOTICE '✓ Finished dropping email references from checklist_web_app';
END $$;
