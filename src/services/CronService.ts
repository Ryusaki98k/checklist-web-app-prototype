import { eq } from "drizzle-orm";
import { cronSettings } from "../db/schema";
import {
  ICronService,
  CronSetting,
  IChecklistService,
  IManagerService,
  IRefrigeratorService,
  IPointService,
} from "./types";

const DEFAULT_CRON_JOBS: CronSetting[] = [
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
      evaluateDailyStreaks: true,
    },
    last_run_at: null,
    last_run_status: null,
    last_run_message: null,
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
    last_run_at: null,
    last_run_status: null,
    last_run_message: null,
  },
  {
    id: "reset-scores",
    name: "ประมวลผลตารางคะแนนสัปดาห์และรีเซ็ตคะแนน (Weekly Leaderboard & Score Reset)",
    description: "รวบรวมและบันทึกตารางอันดับประจำสัปดาห์ (Weekly Leaderboard Snapshot) ทุกคืนวันอาทิตย์ เวลา 23:55 น. ก่อนขึ้นวันใหม่ จากนั้นรีเซ็ตคะแนนสะสมของพนักงานเพื่อเริ่มรอบการแข่งขันใหม่ในวันจันทร์",
    schedule_cron: "55 16 * * 0",
    schedule_description: "ทุกวันอาทิตย์ เวลา 23:55 น.",
    enabled: true,
    config: {
      resetRoles: ["employee", "manager_assistant"],
      recordTransaction: true,
      notifyEmployees: true,
      resetStreaks: false,
    },
    last_run_at: null,
    last_run_status: null,
    last_run_message: null,
  },
  {
    id: "cleanup-data",
    name: "ล้างข้อมูลประวัติและบันทึกเก่า (Data Retention Cleanup)",
    description: "ลบประวัติงาน กะ และข้อมูลการดำเนินงานที่เก่ากว่ากำหนดโดยอัตโนมัติ เพื่อรักษาประสิทธิภาพของระบบ (ข้อมูลบันทึกตู้แช่เก็บรักษาย้อนหลัง 1 เดือน)",
    schedule_cron: "50 16 * * 0",
    schedule_description: "ทุกวันอาทิตย์ เวลา 23:50 น.",
    enabled: true,
    config: {
      retentionDays: 14,
      refrigeratorRetentionDays: 30,
      cleanShiftSessions: true,
      cleanRefrigeratorTasks: true,
      cleanNotifications: true,
      cleanPointTransactions: true,
      cleanEmployeeLeaves: true,
    },
    last_run_at: null,
    last_run_status: null,
    last_run_message: null,
  },
];

export class CronService implements ICronService {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private db: any,
    private checklistService?: IChecklistService,
    private managerService?: IManagerService,
    private refrigeratorService?: IRefrigeratorService,
    private pointService?: IPointService
  ) {}

  async getAllSettings(): Promise<CronSetting[]> {
    try {
      const records = await this.db.select().from(cronSettings);

      if (!records || records.length === 0) {
        // Auto-seed if table is empty
        for (const defaultJob of DEFAULT_CRON_JOBS) {
          try {
            await this.db.insert(cronSettings).values({
              id: defaultJob.id,
              name: defaultJob.name,
              description: defaultJob.description,
              schedule_cron: defaultJob.schedule_cron,
              schedule_description: defaultJob.schedule_description,
              enabled: defaultJob.enabled,
              config: defaultJob.config,
            });
          } catch {
            // Ignore insert conflicts
          }
        }
        return DEFAULT_CRON_JOBS;
      }

      // Ensure any newly added DEFAULT_CRON_JOBS exist in DB and auto-migrate weekly reset-scores
      for (const defaultJob of DEFAULT_CRON_JOBS) {
        const found = records.find((r: typeof cronSettings.$inferSelect) => r.id === defaultJob.id);
        if (!found) {
          try {
            await this.db.insert(cronSettings).values({
              id: defaultJob.id,
              name: defaultJob.name,
              description: defaultJob.description,
              schedule_cron: defaultJob.schedule_cron,
              schedule_description: defaultJob.schedule_description,
              enabled: defaultJob.enabled,
              config: defaultJob.config,
            });
            records.push({
              id: defaultJob.id,
              name: defaultJob.name,
              description: defaultJob.description,
              schedule_cron: defaultJob.schedule_cron,
              schedule_description: defaultJob.schedule_description,
              enabled: defaultJob.enabled,
              config: defaultJob.config,
              last_run_at: null,
              last_run_status: null,
              last_run_message: null,
              updated_at: new Date(),
            });
          } catch {
            // Ignore insert conflicts
          }
        } else if (found.id === "reset-scores" && (found.schedule_cron === "0 0 1 * *" || found.name?.includes("ประจำเดือน"))) {
          // Auto-migrate legacy monthly job to weekly Sunday 23:55 schedule
          try {
            await this.db
              .update(cronSettings)
              .set({
                name: defaultJob.name,
                description: defaultJob.description,
                schedule_cron: defaultJob.schedule_cron,
                schedule_description: defaultJob.schedule_description,
                updated_at: new Date(),
              })
              .where(eq(cronSettings.id, "reset-scores"));

            found.name = defaultJob.name;
            found.description = defaultJob.description;
            found.schedule_cron = defaultJob.schedule_cron;
            found.schedule_description = defaultJob.schedule_description;
          } catch {
            // Ignore update errors
          }
        }
      }

      // Maintain consistent ordering: end-shifts -> daily-refrigerators -> reset-scores -> cleanup-data
      const orderMap: Record<string, number> = {
        "end-shifts": 1,
        "daily-refrigerators": 2,
        "reset-scores": 3,
        "cleanup-data": 4,
      };

      const mapped: CronSetting[] = records.map((r: typeof cronSettings.$inferSelect) => {
        const rawConfig = (r.config as Record<string, unknown>) || {};
        if (r.id === "cleanup-data" && rawConfig.refrigeratorRetentionDays === undefined) {
          rawConfig.refrigeratorRetentionDays = 30;
        }
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          schedule_cron: r.schedule_cron,
          schedule_description: r.schedule_description,
          enabled: Boolean(r.enabled),
          config: rawConfig,
          last_run_at: r.last_run_at ? new Date(r.last_run_at).toISOString() : null,
          last_run_status: r.last_run_status as "success" | "failed" | "skipped" | null,
          last_run_message: r.last_run_message,
          updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
        };
      });

      mapped.sort((a, b) => (orderMap[a.id] || 99) - (orderMap[b.id] || 99));
      return mapped;
    } catch (err) {
      console.error("CronService.getAllSettings error:", err);
      return DEFAULT_CRON_JOBS;
    }
  }

  async getSetting(id: string): Promise<CronSetting | null> {
    try {
      const records = await this.db
        .select()
        .from(cronSettings)
        .where(eq(cronSettings.id, id))
        .limit(1);

      if (!records || records.length === 0) {
        const fallback = DEFAULT_CRON_JOBS.find((j) => j.id === id);
        return fallback || null;
      }

      const r = records[0];
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        schedule_cron: r.schedule_cron,
        schedule_description: r.schedule_description,
        enabled: Boolean(r.enabled),
        config: (r.config as Record<string, unknown>) || {},
        last_run_at: r.last_run_at ? new Date(r.last_run_at).toISOString() : null,
        last_run_status: r.last_run_status as "success" | "failed" | "skipped" | null,
        last_run_message: r.last_run_message,
        updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
      };
    } catch (err) {
      console.error(`CronService.getSetting(${id}) error:`, err);
      return DEFAULT_CRON_JOBS.find((j) => j.id === id) || null;
    }
  }

  async updateSetting(
    id: string,
    updates: { enabled?: boolean; config?: Record<string, unknown> }
  ): Promise<{ success: boolean; error?: string; setting?: CronSetting }> {
    try {
      const existing = await this.getSetting(id);
      if (!existing) {
        return { success: false, error: `ไม่พบการตั้งค่า Cron Job รหัส ${id}` };
      }

      const newEnabled = updates.enabled !== undefined ? updates.enabled : existing.enabled;
      const newConfig = updates.config !== undefined ? { ...existing.config, ...updates.config } : existing.config;

      await this.db
        .update(cronSettings)
        .set({
          enabled: newEnabled,
          config: newConfig,
          updated_at: new Date(),
        })
        .where(eq(cronSettings.id, id));

      const updated = await this.getSetting(id);
      return { success: true, setting: updated || undefined };
    } catch (err) {
      console.error(`CronService.updateSetting(${id}) error:`, err);
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกการตั้งค่า";
      return { success: false, error: message };
    }
  }

  async recordExecution(
    id: string,
    result: { status: "success" | "failed" | "skipped"; message?: string }
  ): Promise<void> {
    try {
      await this.db
        .update(cronSettings)
        .set({
          last_run_at: new Date(),
          last_run_status: result.status,
          last_run_message: result.message || null,
        })
        .where(eq(cronSettings.id, id));
    } catch (err) {
      console.error(`CronService.recordExecution(${id}) error:`, err);
    }
  }

  async runCronJob(
    id: string,
    overrides?: Record<string, unknown>
  ): Promise<{ success: boolean; skipped?: boolean; message?: string; result?: unknown; error?: string }> {
    const setting = await this.getSetting(id);
    if (!setting) {
      return { success: false, error: `ไม่พบข้อมูลงานระบบรหัส ${id}` };
    }

    // Check if job is disabled (overrides.force can bypass if requested)
    if (!setting.enabled && !overrides?.force) {
      const skippedMsg = "งานระบบนี้ถูกปิดใช้งาน (Disabled) ในหน้าผู้ดูแลระบบ จึงข้ามการประมวลผล";
      await this.recordExecution(id, {
        status: "skipped",
        message: skippedMsg,
      });
      return {
        success: true,
        skipped: true,
        message: skippedMsg,
      };
    }

    const mergedConfig = { ...setting.config, ...(overrides?.config as Record<string, unknown> || {}) };

    try {
      if (id === "cleanup-data") {
        if (!this.checklistService) {
          throw new Error("ChecklistService is not configured in CronService");
        }

        const retentionDays = Number(mergedConfig.retentionDays) || 14;
        const refrigeratorRetentionDays = Number(mergedConfig.refrigeratorRetentionDays) || 30;
        const options = {
          refrigeratorRetentionDays,
          cleanShiftSessions: mergedConfig.cleanShiftSessions !== false,
          cleanRefrigeratorTasks: mergedConfig.cleanRefrigeratorTasks !== false,
          cleanNotifications: mergedConfig.cleanNotifications !== false,
          cleanPointTransactions: mergedConfig.cleanPointTransactions !== false,
          cleanEmployeeLeaves: mergedConfig.cleanEmployeeLeaves !== false,
        };

        const res = await this.checklistService.cleanupOldData(retentionDays, options);
        if (!res.success) {
          throw new Error(res.error || "เกิดข้อผิดพลาดในการล้างข้อมูลเก่า");
        }

        const deleted = res.deleted || {
          shiftSessions: 0,
          taskWorks: 0,
          refrigeratorTasks: 0,
          notifications: 0,
          pointTransactions: 0,
          employeeLeaves: 0,
        };

        const summaryMsg = `ล้างข้อมูลเก่าสำเร็จ (กะและงานย่อยเก่ากว่า ${retentionDays} วัน, ตู้แช่เก่ากว่า ${refrigeratorRetentionDays} วัน / 1 เดือน): ปิดกะ/ลบประวัติกะ ${deleted.shiftSessions} กะ, งานย่อย ${deleted.taskWorks} รายการ, บันทึกตู้แช่ ${deleted.refrigeratorTasks} รายการ, แจ้งเตือน ${deleted.notifications} รายการ, คะแนน ${deleted.pointTransactions} รายการ, ข้อมูลลา ${deleted.employeeLeaves} รายการ`;

        await this.recordExecution(id, {
          status: "success",
          message: summaryMsg,
        });

        return {
          success: true,
          result: res,
          message: summaryMsg,
        };
      }

      if (id === "end-shifts") {
        if (!this.managerService || !this.checklistService) {
          throw new Error("ManagerService or ChecklistService is not configured in CronService");
        }

        const sendAlerts = mergedConfig.sendAttendanceAlerts !== false;
        const autoEnd = mergedConfig.autoEndUnclosedShifts !== false;
        const evalStreaks = mergedConfig.evaluateDailyStreaks !== false;
        const dateStr = overrides?.dateStr as string | undefined;

        let alertsResult = null;
        if (sendAlerts) {
          alertsResult = await this.managerService.processShiftAttendanceAlerts({ dateStr });
        }

        let endShiftsResult = null;
        if (autoEnd) {
          endShiftsResult = await this.checklistService.autoEndUnfinishedShifts();
        }

        let streakResult = null;
        if (evalStreaks && this.pointService) {
          streakResult = await this.pointService.evaluateDailyStreaks(dateStr);
        }

        const endedCount = endShiftsResult?.endedCount ?? 0;
        const absentCount = alertsResult?.totalAbsentStaff ?? 0;
        const unendedCount = alertsResult?.totalUnendedShifts ?? 0;
        const evaluatedStreaksCount = streakResult?.evaluatedCount ?? 0;

        const summaryMsg = `ประมวลผลสิ้นวันสำเร็จ: บังคับปิดกะค้าง ${endedCount} กะ, ประเมินสตรีคประจำวัน ${evaluatedStreaksCount} คน (สมบูรณ์ ${streakResult?.perfectCount ?? 0}, ปรับ Flawed ${streakResult?.flawedCount ?? 0}, รักษาสตรีคจากใบลา ${streakResult?.preservedCount ?? 0}), ตรวจพบกะค้างเตือน ${unendedCount} กะ, พนักงานขาดงาน ${absentCount} คน`;

        await this.recordExecution(id, {
          status: "success",
          message: summaryMsg,
        });

        return {
          success: true,
          result: { alerts: alertsResult, endShifts: endShiftsResult, streakEvaluation: streakResult },
          message: summaryMsg,
        };
      }

      if (id === "daily-refrigerators") {
        if (!this.refrigeratorService) {
          throw new Error("RefrigeratorService is not configured in CronService");
        }

        const createDaily = mergedConfig.createDailyTasks !== false;
        const markMissed = mergedConfig.markMissedYesterdayTasks !== false;
        const targetDate = overrides?.targetDate as string | undefined;
        const yesterdayDate = overrides?.yesterdayDate as string | undefined;

        const res = await this.refrigeratorService.processDailyRefrigeratorTasks({
          targetDate,
          yesterdayDate,
          createDailyTasks: createDaily,
          markMissedYesterdayTasks: markMissed,
        });

        if (!res.success) {
          throw new Error(res.error || "เกิดข้อผิดพลาดในการประมวลผลงานตู้แช่ประจำวัน");
        }

        const summaryMsg = `ประมวลผลงานตู้แช่สำเร็จ: สร้างงานตรวจใหม่ ${res.totalNewTasksCreated} งาน, ทำเครื่องหมายตู้ขาดตรวจ ${res.totalMissedTasksMarked} ตู้ (ครอบคลุม ${res.processedBranches} สาขา)`;

        await this.recordExecution(id, {
          status: "success",
          message: summaryMsg,
        });

        return {
          success: true,
          result: res,
          message: summaryMsg,
        };
      }

      if (id === "reset-scores") {
        if (!this.pointService) {
          throw new Error("PointService is not configured in CronService");
        }

        const resetRoles = (mergedConfig.resetRoles as string[]) || ["employee", "manager_assistant"];
        const recordTransaction = mergedConfig.recordTransaction !== false;
        const notifyEmployees = mergedConfig.notifyEmployees !== false;
        const resetStreaks = Boolean(mergedConfig.resetStreaks);

        const res = await this.pointService.processWeeklyLeaderboardAndReset({
          resetRoles,
          recordTransaction,
          notifyEmployees,
          resetStreaks,
        });

        if (!res.success) {
          throw new Error(res.error || "เกิดข้อผิดพลาดในการประมวลผลตารางอันดับและรีเซ็ตคะแนนประจำสัปดาห์");
        }

        const summaryMsg = `ประมวลผลตารางคะแนนประจำสัปดาห์สำเร็จ (รอบ ${res.weekStartDate} ถึง ${res.weekEndDate}): บันทึก Snapshot ${res.snapshotsCreated} ชุด, พนักงานที่รีเซ็ตคะแนน ${res.affectedUsersCount} คน (ล้างแต้มเดิมรวม ${res.totalPointsReset} แต้ม, สตรีค: ${resetStreaks ? "รีเซ็ต" : "รักษาสถิติเดิม"})`;

        await this.recordExecution(id, {
          status: "success",
          message: summaryMsg,
        });

        return {
          success: true,
          result: res,
          message: summaryMsg,
        };
      }

      return { success: false, error: `ไม่รองรับงานระบบรหัส ${id}` };
    } catch (err) {
      console.error(`CronService.runCronJob(${id}) error:`, err);
      const errMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการทำงานอัตโนมัติ";
      await this.recordExecution(id, {
        status: "failed",
        message: errMsg,
      });
      return { success: false, error: errMsg };
    }
  }
}
