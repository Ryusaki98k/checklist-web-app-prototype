import { db } from "../src/db";
import { sql } from "drizzle-orm";
import { cronSettings } from "../src/db/schema";

async function runMigration() {
  console.log("Running migration: add cron_settings table...");

  // 1. Create table
  await db.execute(sql`
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
  `);

  console.log("Table checklist_web_app.cron_settings created or already exists.");

  // 2. Enable RLS
  await db.execute(sql`
    ALTER TABLE checklist_web_app.cron_settings ENABLE ROW LEVEL SECURITY;
  `);

  // 3. Grant access
  await db.execute(sql`
    GRANT ALL ON checklist_web_app.cron_settings TO anon, authenticated, service_role;
  `);

  // 4. Create RLS policies if not already created (allow all for backend/authenticated)
  await db.execute(sql`
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
  `);

  // 5. Seed initial rows
  const initialJobs = [
    {
      id: "cleanup-data",
      name: "ล้างข้อมูลประวัติและบันทึกเก่า (Data Retention Cleanup)",
      description: "ลบประวัติงาน กะ และข้อมูลการดำเนินงานที่เก่ากว่ากำหนดโดยอัตโนมัติ เพื่อรักษาประสิทธิภาพของระบบ",
      schedule_cron: "50 16 * * 0",
      schedule_description: "ทุกวันอาทิตย์ เวลา 23:50 น.",
      enabled: true,
      config: {
        retentionDays: 14,
        cleanShiftSessions: true,
        cleanRefrigeratorTasks: true,
        cleanNotifications: true,
        cleanPointTransactions: true,
        cleanEmployeeLeaves: true,
      },
    },
    {
      id: "end-shifts",
      name: "ระบบปิดกะอัตโนมัติและแจ้งเตือนพนักงาน (Auto End Shifts & Alerts)",
      description: "ตรวจสอบและแจ้งเตือนผู้จัดการเมื่อมีพนักงานไม่ปิดกะหรือขาดงาน พร้อมบังคับปิดกะที่ค้างอยู่เมื่อสิ้นวัน",
      schedule_cron: "55 16 * * *",
      schedule_description: "ทุกวัน เวลา 23:55 น.",
      enabled: true,
      config: {
        sendAttendanceAlerts: true,
        autoEndUnclosedShifts: true,
      },
    },
    {
      id: "daily-refrigerators",
      name: "ระบบตู้แช่ประจำวัน (Daily Refrigerator Routine)",
      description: "สร้างตารางตรวจเช็คตู้แช่สำหรับวันใหม่ และทำเครื่องหมายตู้แช่ที่ขาดการตรวจเช็คจากเมื่อวาน",
      schedule_cron: "5 17 * * *",
      schedule_description: "ทุกวัน เวลา 00:05 น.",
      enabled: true,
      config: {
        createDailyTasks: true,
        markMissedYesterdayTasks: true,
      },
    },
  ];

  for (const job of initialJobs) {
    const existing = await db
      .select({ id: cronSettings.id })
      .from(cronSettings)
      .where(sql`${cronSettings.id} = ${job.id}`);

    if (existing.length === 0) {
      await db.insert(cronSettings).values(job);
      console.log(`Seeded cron setting: ${job.id}`);
    } else {
      console.log(`Cron setting ${job.id} already exists.`);
    }
  }

  console.log("Migration complete!");
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
