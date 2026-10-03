-- ==============================================================================
-- Migration: Add employee_leaves table and leave_type enum to 'checklist_web_app'
-- Execute this script in the Supabase Dashboard -> SQL Editor (or via psql)
-- ==============================================================================

-- 1. Create enum type in checklist_web_app schema (or add 'other' value if enum already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_namespace n ON n.oid = t.typnamespace 
        WHERE t.typname = 'leave_type' AND n.nspname = 'checklist_web_app'
    ) THEN
        CREATE TYPE checklist_web_app.leave_type AS ENUM ('paid', 'unpaid', 'ลาเเบบได้เงิน', 'ลาเเบบไม่ได้รับเงิน', 'sick', 'personal', 'other');
    ELSE
        -- Ensure paid, unpaid, and Thai values exist in leave_type enum
        ALTER TYPE checklist_web_app.leave_type ADD VALUE IF NOT EXISTS 'paid';
        ALTER TYPE checklist_web_app.leave_type ADD VALUE IF NOT EXISTS 'unpaid';
        ALTER TYPE checklist_web_app.leave_type ADD VALUE IF NOT EXISTS 'ลาเเบบได้เงิน';
        ALTER TYPE checklist_web_app.leave_type ADD VALUE IF NOT EXISTS 'ลาเเบบไม่ได้รับเงิน';
        ALTER TYPE checklist_web_app.leave_type ADD VALUE IF NOT EXISTS 'other';
    END IF;
END $$;

-- 2. Create employee_leaves table if not exists
CREATE TABLE IF NOT EXISTS checklist_web_app.employee_leaves (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES checklist_web_app.users(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES checklist_web_app.branches(id) ON DELETE CASCADE,
    leave_type checklist_web_app.leave_type NOT NULL,
    start_date text NOT NULL,
    end_date text NOT NULL,
    reason text NOT NULL,
    preserve_streak boolean NOT NULL DEFAULT true,
    previous_streak integer,
    recorded_by uuid NOT NULL REFERENCES checklist_web_app.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Ensure columns exist if table was already created earlier
ALTER TABLE checklist_web_app.employee_leaves 
    ADD COLUMN IF NOT EXISTS preserve_streak boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS previous_streak integer;

-- 3. Create indexes for quick query performance
CREATE INDEX IF NOT EXISTS idx_employee_leaves_branch_dates 
    ON checklist_web_app.employee_leaves (branch_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_employee_leaves_user_dates 
    ON checklist_web_app.employee_leaves (user_id, start_date, end_date);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE checklist_web_app.employee_leaves ENABLE ROW LEVEL SECURITY;

-- 5. Grant access permissions to Supabase roles
GRANT ALL ON checklist_web_app.employee_leaves TO anon, authenticated, service_role;
