-- ==============================================================================
-- Migration: Add cron_settings table to 'checklist_web_app' schema
-- Execute this script in Supabase Dashboard -> SQL Editor (or via psql)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS checklist_web_app.cron_settings (
    id text PRIMARY KEY,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    schedule_cron text NOT NULL,
    schedule_description text NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    last_run_at timestamp with time zone,
    last_run_status text,
    last_run_message text,
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE checklist_web_app.cron_settings ENABLE ROW LEVEL SECURITY;

GRANT ALL ON checklist_web_app.cron_settings TO anon, authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'checklist_web_app' 
      AND tablename = 'cron_settings' 
      AND policyname = 'Allow read access to cron_settings'
  ) THEN
    CREATE POLICY "Allow read access to cron_settings" 
    ON checklist_web_app.cron_settings 
    FOR SELECT 
    TO authenticated, anon, service_role 
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'checklist_web_app' 
      AND tablename = 'cron_settings' 
      AND policyname = 'Allow update access to cron_settings'
  ) THEN
    CREATE POLICY "Allow update access to cron_settings" 
    ON checklist_web_app.cron_settings 
    FOR UPDATE 
    TO authenticated, anon, service_role 
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'checklist_web_app' 
      AND tablename = 'cron_settings' 
      AND policyname = 'Allow insert access to cron_settings'
  ) THEN
    CREATE POLICY "Allow insert access to cron_settings" 
    ON checklist_web_app.cron_settings 
    FOR INSERT 
    TO authenticated, anon, service_role 
    WITH CHECK (true);
  END IF;
END $$;

INSERT INTO checklist_web_app.cron_settings (id, name, description, schedule_cron, schedule_description, enabled, config)
VALUES 
  (
    'cleanup-data',
    'ล้างข้อมูลประวัติและบันทึกเก่า (Data Retention Cleanup)',
    'ลบประวัติงาน กะ และข้อมูลการดำเนินงานที่เก่ากว่ากำหนดโดยอัตโนมัติ เพื่อรักษาประสิทธิภาพของระบบ',
    '50 16 * * 0',
    'ทุกวันอาทิตย์ เวลา 23:50 น.',
    true,
    '{"retentionDays": 14, "cleanShiftSessions": true, "cleanRefrigeratorTasks": true, "cleanNotifications": true, "cleanPointTransactions": true, "cleanEmployeeLeaves": true}'::jsonb
  ),
  (
    'end-shifts',
    'ระบบปิดกะอัตโนมัติและแจ้งเตือนพนักงาน (Auto End Shifts & Alerts)',
    'ตรวจสอบและแจ้งเตือนผู้จัดการเมื่อมีพนักงานไม่ปิดกะหรือขาดงาน พร้อมบังคับปิดกะที่ค้างอยู่เมื่อสิ้นวัน',
    '55 16 * * *',
    'ทุกวัน เวลา 23:55 น.',
    true,
    '{"sendAttendanceAlerts": true, "autoEndUnclosedShifts": true}'::jsonb
  ),
  (
    'daily-refrigerators',
    'ระบบตู้แช่ประจำวัน (Daily Refrigerator Routine)',
    'สร้างตารางตรวจเช็คตู้แช่สำหรับวันใหม่ และทำเครื่องหมายตู้แช่ที่ขาดการตรวจเช็คจากเมื่อวาน',
    '5 17 * * *',
    'ทุกวัน เวลา 00:05 น.',
    true,
    '{"createDailyTasks": true, "markMissedYesterdayTasks": true}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
