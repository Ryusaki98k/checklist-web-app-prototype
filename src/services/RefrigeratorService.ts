import { eq, and, or, sql, inArray, isNull } from "drizzle-orm";
import { refrigerators, branches, users, tasks, branchTasks, jointTaskWork } from "../db/schema";
import { IRefrigeratorService, INotificationService, RefrigeratorTaskItem } from "./types";
import { ShiftType } from "../types";

export interface RefrigeratorConfig {
  id: string;
  name: string;
  min_temperature: number;
  max_temperature: number;
  disable_check: boolean;
}

export const MIN_REFRIGERATOR_TEMP = -100;
export const MAX_REFRIGERATOR_TEMP = 100;

export function clampTemperature(val: number | undefined | null): number {
  if (val === undefined || val === null || isNaN(val)) return 0;
  return Math.min(MAX_REFRIGERATOR_TEMP, Math.max(MIN_REFRIGERATOR_TEMP, Math.round(Number(val))));
}

function getThaiDateString(baseDate = new Date()): string {
  const y = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(baseDate);
  const m = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", month: "2-digit" }).format(baseDate);
  const d = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", day: "2-digit" }).format(baseDate);
  return `${y}-${m}-${d}`;
}

export class RefrigeratorService implements IRefrigeratorService {
  constructor(private db: any, private notificationService?: INotificationService) {}

  private async getBranchForUser(userId: string) {
    const [u] = await this.db
      .select({ branchId: users.branch_id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (u?.branchId) {
      const [b] = await this.db
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(eq(branches.id, u.branchId))
        .limit(1);
      if (b) return b;
    }

    const [fallbackBranch] = await this.db
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .limit(1);

    return fallbackBranch;
  }

  async getRefrigerators(userId: string): Promise<{ success: boolean; data?: RefrigeratorConfig[]; error?: string }> {
    try {
      const branch = await this.getBranchForUser(userId);

      if (!branch) {
        return { success: true, data: [] };
      }

      const refs = await this.db
        .select()
        .from(refrigerators)
        .where(eq(refrigerators.branch_id, branch.id));

      refs.sort((a: any, b: any) => a.name.localeCompare(b.name, "th", { numeric: true }));

      return { success: true, data: refs.map((r: any) => ({ ...r, disable_check: !!r.disable_check })) };
    } catch (err: any) {
      console.error("RefrigeratorService.getRefrigerators error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการดึงข้อมูลตู้แช่" };
    }
  }

  async getRefrigeratorsByBranch(branchId: string): Promise<{ success: boolean; data?: RefrigeratorConfig[]; error?: string }> {
    try {
      if (!branchId) {
        return { success: false, error: "กรุณาระบุรหัสสาขา" };
      }

      const refs = (await this.db
        .select()
        .from(refrigerators)
        .where(eq(refrigerators.branch_id, branchId))) as Array<{
        id: string;
        name: string;
        min_temperature: number;
        max_temperature: number;
        disable_check: boolean;
      }>;

      refs.sort((a, b) => a.name.localeCompare(b.name, "th", { numeric: true }));

      return { success: true, data: refs.map((r) => ({ ...r, disable_check: !!r.disable_check })) };
    } catch (err: unknown) {
      console.error("RefrigeratorService.getRefrigeratorsByBranch error:", err);
      return { success: false, error: (err as Error)?.message || "เกิดข้อผิดพลาดในการดึงข้อมูลตู้แช่ของสาขา" };
    }
  }

  async createBranchRefrigerator(params: {
    branchId: string;
    name: string;
    minTemperature: number;
    maxTemperature: number;
    disableCheck?: boolean;
  }): Promise<{ success: boolean; data?: RefrigeratorConfig; error?: string }> {
    try {
      const { branchId, name, minTemperature, maxTemperature, disableCheck = false } = params;
      if (!branchId || !name.trim()) {
        return { success: false, error: "กรุณาระบุข้อมูลให้ครบถ้วน" };
      }

      const clampedMin = clampTemperature(minTemperature);
      const clampedMax = clampTemperature(maxTemperature);

      const [newRef] = await this.db
        .insert(refrigerators)
        .values({
          branch_id: branchId,
          name: name.trim(),
          min_temperature: clampedMin,
          max_temperature: clampedMax,
          disable_check: disableCheck,
        })
        .returning();

      await this.db
        .update(branches)
        .set({
          last_update: new Date(),
        })
        .where(eq(branches.id, branchId));

      if (!disableCheck) {
        await this.ensureDailyRefrigeratorTasks(branchId);
      }

      return { success: true, data: newRef };
    } catch (err: unknown) {
      console.error("RefrigeratorService.createBranchRefrigerator error:", err);
      return { success: false, error: (err as Error)?.message || "เกิดข้อผิดพลาดในการเพิ่มตู้แช่" };
    }
  }

  async createRefrigerator(params: {
    userId: string;
    name: string;
    minTemperature: number;
    maxTemperature: number;
    disableCheck: boolean;
  }): Promise<{ success: boolean; data?: RefrigeratorConfig; error?: string }> {
    try {
      const { userId, name, minTemperature, maxTemperature, disableCheck } = params;

      const branch = await this.getBranchForUser(userId);
      if (!branch) {
        return { success: false, error: "ไม่พบสาขาของผู้ใช้นี้" };
      }

      const clampedMin = clampTemperature(minTemperature);
      const clampedMax = clampTemperature(maxTemperature);

      const [newRef] = await this.db
        .insert(refrigerators)
        .values({
          branch_id: branch.id,
          name,
          min_temperature: clampedMin,
          max_temperature: clampedMax,
          disable_check: disableCheck,
        })
        .returning();

      await this.db
        .update(branches)
        .set({
          last_update: new Date(),
        })
        .where(eq(branches.id, branch.id));

      if (!disableCheck) {
        await this.ensureDailyRefrigeratorTasks(branch.id);
      }

      return { success: true, data: newRef };
    } catch (err: any) {
      console.error("RefrigeratorService.createRefrigerator error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการเพิ่มตู้แช่" };
    }
  }

  async updateRefrigerator(params: {
    id: string;
    name: string;
    minTemperature: number;
    maxTemperature: number;
    disableCheck: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { id, name, minTemperature, maxTemperature, disableCheck } = params;

      const clampedMin = clampTemperature(minTemperature);
      const clampedMax = clampTemperature(maxTemperature);

      const [updatedRef] = await this.db
        .update(refrigerators)
        .set({
          name,
          min_temperature: clampedMin,
          max_temperature: clampedMax,
          disable_check: disableCheck,
        })
        .where(eq(refrigerators.id, id))
        .returning({ id: refrigerators.id, branch_id: refrigerators.branch_id });

      const targetBranchId = updatedRef?.branch_id;
      const targetDate = getThaiDateString();

      // Find tasks linked to this refrigerator via custom jsonb
      const refTasks = await this.db
        .select({ id: tasks.id, shift: tasks.shift })
        .from(tasks)
        .where(
          and(
            sql`${tasks.custom}->>'type' = 'refrigerator'`,
            sql`${tasks.custom}->>'refrigeratorId' = ${id}`
          )
        );

      const taskIds = refTasks.map((t: any) => t.id);

      if (disableCheck) {
        // If disabled, mark task definitions disabled and delete today's incomplete work
        if (taskIds.length > 0) {
          await this.db
            .update(tasks)
            .set({ disabled: true })
            .where(inArray(tasks.id, taskIds));

          await this.db
            .delete(jointTaskWork)
            .where(
              and(
                inArray(jointTaskWork.task_id, taskIds),
                eq(jointTaskWork.task_date, targetDate),
                isNull(jointTaskWork.completed_at)
              )
            );
        }
      } else {
        // If re-enabled, re-enable tasks and ensure daily tasks exist
        if (taskIds.length > 0) {
          await this.db
            .update(tasks)
            .set({
              disabled: false,
              name: sql`CASE WHEN ${tasks.shift} = 'morning' THEN ${`ตรวจเช็คอุณหภูมิตู้แช่: ${name} (รอบเช้า)`} ELSE ${`ตรวจเช็คอุณหภูมิตู้แช่: ${name} (รอบบ่าย)`} END`,
              custom: {
                type: "refrigerator",
                refrigeratorId: id,
                minTemp: clampedMin,
                maxTemp: clampedMax,
              },
            })
            .where(inArray(tasks.id, taskIds));
        }
        if (targetBranchId) {
          await this.ensureDailyRefrigeratorTasks(targetBranchId, targetDate);
        }
      }

      if (targetBranchId) {
        await this.db
          .update(branches)
          .set({ last_update: new Date() })
          .where(eq(branches.id, targetBranchId));
      }

      return { success: true };
    } catch (err: any) {
      console.error("RefrigeratorService.updateRefrigerator error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการอัปเดตตู้แช่" };
    }
  }

  async deleteRefrigerator(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!id) {
        return { success: false, error: "ไม่พบรหัสตู้แช่" };
      }

      const [existing] = await this.db
        .select({ id: refrigerators.id, branch_id: refrigerators.branch_id })
        .from(refrigerators)
        .where(eq(refrigerators.id, id))
        .limit(1);

      if (!existing) {
        return { success: false, error: "ไม่พบตู้แช่นี้ในระบบ" };
      }

      const branchId = existing.branch_id;
      const targetDate = getThaiDateString();

      // Find tasks linked to this refrigerator
      const refTasks = await this.db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            sql`${tasks.custom}->>'type' = 'refrigerator'`,
            sql`${tasks.custom}->>'refrigeratorId' = ${id}`
          )
        );

      const taskIds = refTasks.map((t: any) => t.id);

      if (taskIds.length > 0) {
        // Delete today's incomplete work for this refrigerator
        await this.db
          .delete(jointTaskWork)
          .where(
            and(
              inArray(jointTaskWork.task_id, taskIds),
              eq(jointTaskWork.task_date, targetDate),
              isNull(jointTaskWork.completed_at)
            )
          );

        // Delete branch link and task definitions
        await this.db.delete(branchTasks).where(inArray(branchTasks.task_id, taskIds));
        await this.db.delete(tasks).where(inArray(tasks.id, taskIds));
      }

      // Delete the refrigerator itself
      await this.db.delete(refrigerators).where(eq(refrigerators.id, id));

      if (branchId) {
        await this.db
          .update(branches)
          .set({ last_update: new Date() })
          .where(eq(branches.id, branchId));
      }

      return { success: true };
    } catch (err: unknown) {
      console.error("RefrigeratorService.deleteRefrigerator error:", err);
      return { success: false, error: (err as Error)?.message || "เกิดข้อผิดพลาดในการลบตู้แช่" };
    }
  }

  async transferRefrigerator(params: {
    refrigeratorId: string;
    targetBranchId: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { refrigeratorId, targetBranchId } = params;
      if (!refrigeratorId || !targetBranchId) {
        return { success: false, error: "ข้อมูลไม่ครบถ้วน (ต้องระบุรหัสตู้แช่และสาขาปลายทาง)" };
      }

      const [existing] = await this.db
        .select({
          id: refrigerators.id,
          branch_id: refrigerators.branch_id,
          name: refrigerators.name,
          disable_check: refrigerators.disable_check,
        })
        .from(refrigerators)
        .where(eq(refrigerators.id, refrigeratorId))
        .limit(1);

      if (!existing) {
        return { success: false, error: "ไม่พบตู้แช่นี้ในระบบ" };
      }

      const [targetBranch] = await this.db
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(eq(branches.id, targetBranchId))
        .limit(1);

      if (!targetBranch) {
        return { success: false, error: "ไม่พบสาขาปลายทางในระบบ" };
      }

      const oldBranchId = existing.branch_id;
      if (oldBranchId === targetBranchId) {
        return { success: true };
      }

      // Update refrigerator branch assignment
      await this.db
        .update(refrigerators)
        .set({ branch_id: targetBranchId })
        .where(eq(refrigerators.id, refrigeratorId));

      // Update task definitions branch assignment
      await this.db
        .update(tasks)
        .set({ branch_id: targetBranchId })
        .where(
          and(
            sql`${tasks.custom}->>'type' = 'refrigerator'`,
            sql`${tasks.custom}->>'refrigeratorId' = ${refrigeratorId}`
          )
        );

      const targetDate = getThaiDateString();

      // Find tasks linked to this refrigerator
      const refTasks = await this.db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            sql`${tasks.custom}->>'type' = 'refrigerator'`,
            sql`${tasks.custom}->>'refrigeratorId' = ${refrigeratorId}`
          )
        );

      const taskIds = refTasks.map((t: any) => t.id);

      if (taskIds.length > 0) {
        // Transfer incomplete tasks for today to the new branch
        await this.db
          .update(jointTaskWork)
          .set({ branch_id: targetBranchId })
          .where(
            and(
              inArray(jointTaskWork.task_id, taskIds),
              eq(jointTaskWork.task_date, targetDate),
              isNull(jointTaskWork.completed_at)
            )
          );
      }

      // If active, ensure task exists in target branch
      if (!existing.disable_check) {
        await this.ensureDailyRefrigeratorTasks(targetBranchId, targetDate);
      }

      // Touch both branches last_update
      if (oldBranchId) {
        await this.db
          .update(branches)
          .set({ last_update: new Date() })
          .where(eq(branches.id, oldBranchId));
      }
      await this.db
        .update(branches)
        .set({ last_update: new Date() })
        .where(eq(branches.id, targetBranchId));

      return { success: true };
    } catch (err: unknown) {
      console.error("RefrigeratorService.transferRefrigerator error:", err);
      return { success: false, error: (err as Error)?.message || "เกิดข้อผิดพลาดในการย้ายตู้แช่" };
    }
  }

  async batchToggleRefrigeratorDisableCheck(params: {
    refrigeratorIds: string[];
    disableCheck: boolean;
    branchId?: string;
  }): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const { refrigeratorIds, disableCheck, branchId } = params;
      if (!refrigeratorIds || refrigeratorIds.length === 0) {
        return { success: true, count: 0 };
      }

      let effectiveBranchId = branchId;
      if (!effectiveBranchId && refrigeratorIds.length > 0) {
        const [firstRef] = await this.db
          .select({ branch_id: refrigerators.branch_id })
          .from(refrigerators)
          .where(eq(refrigerators.id, refrigeratorIds[0]))
          .limit(1);
        if (firstRef?.branch_id) {
          effectiveBranchId = firstRef.branch_id;
        }
      }

      // Update disable_check for the selected refrigerators
      await this.db
        .update(refrigerators)
        .set({ disable_check: disableCheck })
        .where(inArray(refrigerators.id, refrigeratorIds));

      // Find tasks linked to these refrigerators
      const refTasks = await this.db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            sql`${tasks.custom}->>'type' = 'refrigerator'`,
            inArray(sql`${tasks.custom}->>'refrigeratorId'`, refrigeratorIds)
          )
        );

      const taskIds = refTasks.map((t: any) => t.id);

      if (taskIds.length > 0) {
        // Update disabled status on task definitions
        await this.db
          .update(tasks)
          .set({ disabled: disableCheck })
          .where(inArray(tasks.id, taskIds));

        const targetDate = getThaiDateString();

        if (disableCheck) {
          // If disabled, delete incomplete tasks for today so they disappear live
          await this.db
            .delete(jointTaskWork)
            .where(
              and(
                inArray(jointTaskWork.task_id, taskIds),
                eq(jointTaskWork.task_date, targetDate),
                isNull(jointTaskWork.completed_at)
              )
            );
        }
      }

      const targetDate = getThaiDateString();
      if (!disableCheck && effectiveBranchId) {
        // If re-enabled, ensure daily tasks exist
        await this.ensureDailyRefrigeratorTasks(effectiveBranchId, targetDate);
      }

      if (effectiveBranchId) {
        await this.db
          .update(branches)
          .set({ last_update: new Date() })
          .where(eq(branches.id, effectiveBranchId));
      }

      return { success: true, count: refrigeratorIds.length };
    } catch (err: unknown) {
      console.error("RefrigeratorService.batchToggleRefrigeratorDisableCheck error:", err);
      return { success: false, error: (err as Error)?.message || "เกิดข้อผิดพลาดในการเปลี่ยนสถานะตู้แช่แบบกลุ่ม" };
    }
  }

  async ensureDailyRefrigeratorTasks(branchId: string, _dateStr?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const activeRefs = await this.db
        .select({
          id: refrigerators.id,
          name: refrigerators.name,
          min_temperature: refrigerators.min_temperature,
          max_temperature: refrigerators.max_temperature,
          disable_check: refrigerators.disable_check,
        })
        .from(refrigerators)
        .where(
          and(
            eq(refrigerators.branch_id, branchId),
            eq(refrigerators.disable_check, false)
          )
        );

      if (activeRefs.length === 0) {
        return { success: true };
      }

      const shiftsToEnsure: ("morning" | "afternoon")[] = ["morning", "afternoon"];

      // Query existing refrigerator tasks in tasks table
      const existingRefTasksInDb = await this.db
        .select({
          id: tasks.id,
          shift: tasks.shift,
          name: tasks.name,
          disabled: tasks.disabled,
          custom: tasks.custom,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.branch_id, branchId),
            sql`${tasks.custom}->>'type' = 'refrigerator'`
          )
        );

      const taskKeyMap = new Map<string, typeof existingRefTasksInDb[0]>(
        existingRefTasksInDb.map((t: any) => [`${t.custom?.refrigeratorId}_${t.shift}`, t])
      );

      for (const ref of activeRefs) {
        for (const s of shiftsToEnsure) {
          const key = `${ref.id}_${s}`;
          const existingTask = taskKeyMap.get(key);
          const shiftLabel = s === "morning" ? "รอบเช้า" : "รอบบ่าย";
          const taskName = `ตรวจเช็คอุณหภูมิตู้แช่: ${ref.name} (${shiftLabel})`;
          const customPayload = {
            type: "refrigerator",
            refrigeratorId: ref.id,
            minTemp: ref.min_temperature,
            maxTemp: ref.max_temperature,
          };

          if (!existingTask) {
            const [created] = await this.db
              .insert(tasks)
              .values({
                branch_id: branchId,
                shift: s,
                name: taskName,
                task_role: "stock",
                start: s === "morning" ? "06:00:00" : "14:00:00",
                end: s === "morning" ? "14:00:00" : "22:00:00",
                disabled: Boolean(ref.disable_check),
                for_managers: false,
                is_joint: true,
                is_daily: true,
                selectable_roles: ["stock", "manager_assistant"],
                category: "ตู้แช่",
                custom: customPayload,
              })
              .returning({ id: tasks.id });

            if (created) {
              await this.db
                .insert(branchTasks)
                .values({ branch_id: branchId, task_id: created.id })
                .onConflictDoNothing();
            }
          } else if (
            existingTask.name !== taskName ||
            existingTask.disabled !== Boolean(ref.disable_check) ||
            existingTask.custom?.minTemp !== ref.min_temperature ||
            existingTask.custom?.maxTemp !== ref.max_temperature
          ) {
            await this.db
              .update(tasks)
              .set({
                name: taskName,
                disabled: Boolean(ref.disable_check),
                is_joint: true,
                is_daily: true,
                category: "ตู้แช่",
                custom: customPayload,
              })
              .where(eq(tasks.id, existingTask.id));
          }
        }
      }

      // Ensure night closing tasks are joint tasks
      await this.db
        .update(tasks)
        .set({
          is_joint: true,
          is_daily: true,
        })
        .where(
          and(
            eq(tasks.shift, "night"),
            or(eq(tasks.branch_id, branchId), isNull(tasks.branch_id))
          )
        );

      return { success: true };
    } catch (err: any) {
      console.error("RefrigeratorService.ensureDailyRefrigeratorTasks error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการเริ่มต้นรายการตู้แช่" };
    }
  }

  async getBranchRefrigeratorTasks(params: {
    userId?: string;
    branchId?: string;
    dateStr?: string;
    shift?: ShiftType;
  }): Promise<{
    success: boolean;
    data?: RefrigeratorTaskItem[];
    disabledRefrigerators?: { id: string; name: string; minTemperature: number; maxTemperature: number }[];
    branchName?: string;
    error?: string;
  }> {
    try {
      const { userId, branchId: propBranchId, dateStr, shift } = params;
      const targetDate = dateStr || getThaiDateString();

      let targetBranchId = propBranchId;
      let branchName = "";

      if (!targetBranchId && userId) {
        const branch = await this.getBranchForUser(userId);
        if (branch) {
          targetBranchId = branch.id;
          branchName = branch.name;
        }
      }

      if (!targetBranchId) {
        return { success: false, data: [], branchName: "", error: "ผู้ใช้งานไม่มีสาขาประจำการ ไม่สามารถเข้าถึงข้อมูลตู้แช่ได้" };
      }

      if (!branchName) {
        const [b] = await this.db
          .select({ name: branches.name })
          .from(branches)
          .where(eq(branches.id, targetBranchId))
          .limit(1);
        if (b) branchName = b.name;
      }

      // Fetch branch's assigned refrigerators to know all units including disabled ones
      const allBranchRefs = await this.db
        .select()
        .from(refrigerators)
        .where(eq(refrigerators.branch_id, targetBranchId));

      const activeRefs = allBranchRefs.filter((r: any) => !r.disable_check);

      // Automatically ensure tasks exist in tasks table
      if (activeRefs.length > 0) {
        await this.ensureDailyRefrigeratorTasks(targetBranchId, targetDate);
      }

      // Query refrigerator task definitions
      const taskQueryConditions = [
        eq(tasks.branch_id, targetBranchId),
        sql`${tasks.custom}->>'type' = 'refrigerator'`,
      ];

      if (shift && shift !== "both") {
        taskQueryConditions.push(eq(tasks.shift, shift));
      }

      const refTasksList = await this.db
        .select()
        .from(tasks)
        .where(and(...taskQueryConditions));

      const refMap = new Map<string, any>(allBranchRefs.map((r: any) => [r.id, r]));

      const disabledRefrigerators = allBranchRefs
        .filter((r: any) => r.disable_check)
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          minTemperature: r.min_temperature ?? 0,
          maxTemperature: r.max_temperature ?? 4,
        }));

      if (refTasksList.length === 0) {
        return { success: true, data: [], disabledRefrigerators, branchName };
      }

      // Fetch today's work entries from joint_task_work
      const taskIds = refTasksList.map((t: any) => t.id);
      const workRows = await this.db
        .select()
        .from(jointTaskWork)
        .where(
          and(
            eq(jointTaskWork.branch_id, targetBranchId),
            eq(jointTaskWork.task_date, targetDate),
            inArray(jointTaskWork.task_id, taskIds)
          )
        );

      const workMap = new Map<string, any>(workRows.map((w: any) => [w.task_id, w]));

      const userIds = workRows.map((w: any) => w.completed_by).filter(Boolean);
      let userMap = new Map<string, string>();
      if (userIds.length > 0) {
        const userRows = await this.db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, userIds));
        userMap = new Map(userRows.map((u: any) => [u.id, u.name]));
      }

      const items: RefrigeratorTaskItem[] = refTasksList.map((t: any) => {
        const refId = t.custom?.refrigeratorId;
        const ref = refId ? refMap.get(refId) : null;
        const work = workMap.get(t.id);
        const completed = Boolean(work?.completed_at);
        const completedByName = work?.completed_by ? userMap.get(work.completed_by) || "พนักงาน" : null;

        return {
          taskId: t.id,
          refrigeratorId: refId || t.id,
          name: ref?.name || t.name,
          minTemperature: ref?.min_temperature ?? 0,
          maxTemperature: ref?.max_temperature ?? 4,
          targetTemperature: ref?.max_temperature ?? 4,
          disableCheck: Boolean(ref?.disable_check),
          taskDate: targetDate,
          shift: t.shift ? (t.shift === "morning_afternoon" ? "both" : t.shift) : null,
          completed,
          completedAt: work?.completed_at ? new Date(work.completed_at).toISOString() : null,
          completedByUserId: work?.completed_by || null,
          completedByUserName: completedByName,
          temperature: work?.custom?.temperature !== undefined ? work.custom.temperature : null,
          isOkay: work?.custom?.isOkay !== undefined ? work.custom.isOkay : true,
          comment: work?.comment || null,
        };
      });

      // Sort alphabetically by refrigerator name, then shift
      items.sort((a, b) => {
        const cmp = a.name.localeCompare(b.name, "th");
        if (cmp !== 0) return cmp;
        return (a.shift || "").localeCompare(b.shift || "");
      });

      return { success: true, data: items, disabledRefrigerators, branchName };
    } catch (err: any) {
      console.error("RefrigeratorService.getBranchRefrigeratorTasks error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการดึงรายการตรวจตู้แช่" };
    }
  }

  async updateRefrigeratorTask(params: {
    taskId: string;
    userId: string;
    completed: boolean;
    temperature?: number;
    isOkay?: boolean;
    comment?: string;
    shiftSessionId?: string;
    shift?: ShiftType;
  }): Promise<{ success: boolean; data?: RefrigeratorTaskItem; conflict?: boolean; message?: string; error?: string }> {
    try {
      const { taskId, userId, completed, temperature, isOkay, comment, shiftSessionId, shift } = params;

      // 1. Fetch task definition from tasks
      const [taskDef] = await this.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, taskId))
        .limit(1);

      if (!taskDef) {
        return { success: false, error: "ไม่พบรายการงานตู้แช่ที่ระบุ" };
      }

      const targetBranchId = taskDef.branch_id;
      if (!targetBranchId) {
        return { success: false, error: "งานนี้ไม่ได้เชื่อมโยงกับสาขา" };
      }

      if (userId) {
        const [u] = await this.db
          .select({ branch_id: users.branch_id })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!u?.branch_id) {
          return { success: false, error: "ผู้ใช้งานไม่มีสาขาประจำการ ไม่สามารถบันทึกตรวจตู้แช่ได้" };
        }
      }

      const refId = taskDef.custom?.refrigeratorId;
      const [ref] = refId
        ? await this.db.select().from(refrigerators).where(eq(refrigerators.id, refId)).limit(1)
        : [null];

      if (ref?.disable_check) {
        return { success: false, error: `ตู้แช่ "${ref.name}" ถูกปิดการตรวจสอบชั่วคราว ไม่สามารถบันทึกผลได้` };
      }

      const targetDate = getThaiDateString();

      // 2. Fetch existing joint_task_work for concurrency check
      const [existingWork] = await this.db
        .select()
        .from(jointTaskWork)
        .where(
          and(
            eq(jointTaskWork.task_id, taskId),
            eq(jointTaskWork.branch_id, targetBranchId),
            eq(jointTaskWork.task_date, targetDate)
          )
        )
        .limit(1);

      // Concurrency check: If another user already completed this item, prevent race condition & overwrite
      if (completed && existingWork?.completed_at && existingWork.completed_by && existingWork.completed_by !== userId) {
        const [completedByUser] = await this.db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, existingWork.completed_by))
          .limit(1);

        const completedByName = completedByUser?.name || "พนักงานท่านอื่น";
        const completedTime = new Date(existingWork.completed_at).toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const conflictItem: RefrigeratorTaskItem = {
          taskId: taskDef.id,
          refrigeratorId: refId || taskDef.id,
          name: ref?.name || taskDef.name,
          minTemperature: ref?.min_temperature ?? 0,
          maxTemperature: ref?.max_temperature ?? 4,
          targetTemperature: ref?.max_temperature ?? 4,
          taskDate: targetDate,
          shift: existingWork.shift ? (existingWork.shift === "morning_afternoon" ? "both" : existingWork.shift) : null,
          completed: true,
          completedAt: new Date(existingWork.completed_at).toISOString(),
          completedByUserId: existingWork.completed_by,
          completedByUserName: completedByName,
          temperature: existingWork.custom?.temperature ?? null,
          isOkay: existingWork.custom?.isOkay ?? true,
          comment: existingWork.comment,
        };

        return {
          success: false,
          conflict: true,
          message: `ตู้แช่ "${ref?.name || "ตู้แช่"}" ได้รับการบันทึกโดย ${completedByName} แล้วเมื่อเวลา ${completedTime} น. (ระบบป้องกันการบันทึกซ้ำ)`,
          data: conflictItem,
        };
      }

      const completedAt = completed ? new Date() : null;
      const clampedTemp = completed && temperature !== undefined && !isNaN(temperature)
        ? clampTemperature(temperature)
        : null;

      const effectiveShift = shift
        ? shift === "both"
          ? "morning_afternoon"
          : shift
        : taskDef.shift;

      const customPayload = {
        temperature: clampedTemp,
        isOkay: completed && isOkay !== undefined ? isOkay : true,
        shiftSessionId: completed && shiftSessionId ? shiftSessionId : null,
      };

      let activeWorkRecord: any;

      if (existingWork) {
        const [updated] = await this.db
          .update(jointTaskWork)
          .set({
            status: completed ? "completed" : "incomplete",
            completed_by: completed ? userId : null,
            completed_at: completedAt,
            comment: completed && comment !== undefined ? comment : null,
            shift: effectiveShift,
            custom: customPayload,
          })
          .where(
            and(
              eq(jointTaskWork.id, existingWork.id),
              completed
                ? or(isNull(jointTaskWork.completed_at), eq(jointTaskWork.completed_by, userId))
                : sql`TRUE`
            )
          )
          .returning();

        if (!updated && completed) {
          return {
            success: false,
            conflict: true,
            message: `ตู้แช่นี้เพิ่งถูกบันทึกโดยเพื่อนร่วมงาน ระบบกำลังอัปเดตข้อมูลล่าสุด`,
          };
        }
        activeWorkRecord = updated || existingWork;
      } else {
        const [inserted] = await this.db
          .insert(jointTaskWork)
          .values({
            task_id: taskId,
            branch_id: targetBranchId,
            task_date: targetDate,
            shift: effectiveShift,
            status: completed ? "completed" : "incomplete",
            completed_by: completed ? userId : null,
            completed_at: completedAt,
            comment: completed && comment !== undefined ? comment : null,
            custom: customPayload,
          })
          .returning();
        activeWorkRecord = inserted;
      }

      // Update branch last_update for reactivity
      await this.db
        .update(branches)
        .set({ last_update: new Date() })
        .where(eq(branches.id, targetBranchId));

      let userName: string | null = null;
      if (activeWorkRecord.completed_by) {
        const [u] = await this.db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, activeWorkRecord.completed_by))
          .limit(1);
        userName = u?.name || null;
      }

      const resultItem: RefrigeratorTaskItem = {
        taskId: taskDef.id,
        refrigeratorId: refId || taskDef.id,
        name: ref?.name || taskDef.name,
        minTemperature: ref?.min_temperature ?? 0,
        maxTemperature: ref?.max_temperature ?? 4,
        targetTemperature: ref?.max_temperature ?? 4,
        taskDate: targetDate,
        shift: activeWorkRecord.shift ? (activeWorkRecord.shift === "morning_afternoon" ? "both" : activeWorkRecord.shift) : null,
        completed: Boolean(activeWorkRecord.completed_at),
        completedAt: activeWorkRecord.completed_at ? new Date(activeWorkRecord.completed_at).toISOString() : null,
        completedByUserId: activeWorkRecord.completed_by,
        completedByUserName: userName,
        temperature: activeWorkRecord.custom?.temperature ?? null,
        isOkay: activeWorkRecord.custom?.isOkay ?? true,
        comment: activeWorkRecord.comment,
      };

      return { success: true, data: resultItem };
    } catch (err: any) {
      console.error("RefrigeratorService.updateRefrigeratorTask error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการบันทึกผลการตรวจตู้แช่" };
    }
  }

  async batchUpdateRefrigeratorTasks(items: Array<{
    taskId: string;
    userId: string;
    completed: boolean;
    temperature?: number;
    isOkay?: boolean;
    comment?: string;
    shiftSessionId?: string;
    shift?: ShiftType;
  }>): Promise<{ success: boolean; data?: RefrigeratorTaskItem[]; conflicts?: Array<{ taskId: string; message: string }>; error?: string }> {
    if (!items || items.length === 0) {
      return { success: true, data: [] };
    }

    try {
      const taskIds = Array.from(new Set(items.map((i) => i.taskId).filter(Boolean)));
      if (taskIds.length === 0) {
        return { success: true, data: [] };
      }

      const targetDate = getThaiDateString();

      // 1. Fetch matching task definitions in tasks table
      const taskDefs = await this.db
        .select()
        .from(tasks)
        .where(inArray(tasks.id, taskIds));

      const taskDefMap = new Map<string, any>(taskDefs.map((t: any) => [t.id, t]));

      // 2. Fetch refrigerators
      const refIds: string[] = Array.from(
        new Set(taskDefs.map((t: any) => t.custom?.refrigeratorId).filter((id: any): id is string => Boolean(id)))
      );
      const refs = refIds.length > 0
        ? await this.db.select().from(refrigerators).where(inArray(refrigerators.id, refIds))
        : [];
      const refMap = new Map<string, any>(refs.map((r: any) => [r.id, r]));

      // 3. Fetch existing joint_task_work for these tasks today
      const existingWorks = await this.db
        .select()
        .from(jointTaskWork)
        .where(
          and(
            inArray(jointTaskWork.task_id, taskIds),
            eq(jointTaskWork.task_date, targetDate)
          )
        );

      const existingWorkMap = new Map<string, any>(existingWorks.map((w: any) => [w.task_id, w]));

      const affectedBranchIds = new Set<string>();
      const userIds = new Set<string>();
      const conflicts: Array<{ taskId: string; message: string }> = [];

      // 4. Concurrently update/insert works with conflict checks
      const updatePromises = items.map(async (item) => {
        const taskDef = taskDefMap.get(item.taskId);
        if (!taskDef) return null;

        const refId = taskDef.custom?.refrigeratorId;
        const ref = refId ? refMap.get(refId) : null;
        if (ref?.disable_check) {
          return null;
        }

        const existingWork = existingWorkMap.get(item.taskId);

        // Prevent race condition overwrite if already completed by another user
        if (item.completed && existingWork?.completed_at && existingWork.completed_by && existingWork.completed_by !== item.userId) {
          conflicts.push({
            taskId: item.taskId,
            message: `ตู้แช่ "${ref?.name || "ตู้แช่"}" ถูกบันทึกโดยเพื่อนร่วมงานไปก่อนหน้าแล้ว`,
          });
          return existingWork;
        }

        if (taskDef.branch_id) {
          affectedBranchIds.add(taskDef.branch_id);
        }
        if (item.completed && item.userId) {
          userIds.add(item.userId);
        }

        const completedAt = item.completed ? new Date() : null;
        const clampedTemp = item.completed && item.temperature !== undefined && !isNaN(item.temperature)
          ? clampTemperature(item.temperature)
          : null;

        const effectiveShift = item.shift
          ? item.shift === "both"
            ? "morning_afternoon"
            : item.shift
          : taskDef.shift;

        const customPayload = {
          temperature: clampedTemp,
          isOkay: item.completed && item.isOkay !== undefined ? item.isOkay : true,
          shiftSessionId: item.completed && item.shiftSessionId ? item.shiftSessionId : null,
        };

        if (existingWork) {
          const [updated] = await this.db
            .update(jointTaskWork)
            .set({
              status: item.completed ? "completed" : "incomplete",
              completed_by: item.completed ? item.userId : null,
              completed_at: completedAt,
              comment: item.completed && item.comment !== undefined ? item.comment : null,
              shift: effectiveShift,
              custom: customPayload,
            })
            .where(
              and(
                eq(jointTaskWork.id, existingWork.id),
                item.completed
                  ? or(isNull(jointTaskWork.completed_at), eq(jointTaskWork.completed_by, item.userId))
                  : sql`TRUE`
              )
            )
            .returning();

          return updated || existingWork;
        } else {
          const [inserted] = await this.db
            .insert(jointTaskWork)
            .values({
              task_id: item.taskId,
              branch_id: taskDef.branch_id,
              task_date: targetDate,
              shift: effectiveShift,
              status: item.completed ? "completed" : "incomplete",
              completed_by: item.completed ? item.userId : null,
              completed_at: completedAt,
              comment: item.completed && item.comment !== undefined ? item.comment : null,
              custom: customPayload,
            })
            .returning();

          return inserted;
        }
      });

      const updatedRows = (await Promise.all(updatePromises)).filter(Boolean);

      // 5. Update branch last_update
      if (affectedBranchIds.size > 0) {
        await this.db
          .update(branches)
          .set({ last_update: new Date() })
          .where(inArray(branches.id, Array.from(affectedBranchIds)));
      }

      // 6. Fetch user names
      let userMap = new Map<string, string>();
      const userIdsList = Array.from(userIds);
      if (userIdsList.length > 0) {
        const userRows = await this.db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, userIdsList));
        userMap = new Map(userRows.map((u: any) => [u.id, u.name]));
      }

      // 7. Assemble result items
      const resultItems: RefrigeratorTaskItem[] = updatedRows.map((work: any) => {
        const taskDef = taskDefMap.get(work.task_id);
        const refId = taskDef?.custom?.refrigeratorId;
        const ref = refId ? refMap.get(refId) : null;
        const userName = work.completed_by ? userMap.get(work.completed_by) || null : null;

        return {
          taskId: work.task_id,
          refrigeratorId: refId || work.task_id,
          name: ref?.name || taskDef?.name || "ตู้แช่",
          minTemperature: ref?.min_temperature ?? 0,
          maxTemperature: ref?.max_temperature ?? 4,
          targetTemperature: ref?.max_temperature ?? 4,
          taskDate: work.task_date,
          shift: work.shift ? (work.shift === "morning_afternoon" ? "both" : work.shift) : null,
          completed: Boolean(work.completed_at),
          completedAt: work.completed_at ? new Date(work.completed_at).toISOString() : null,
          completedByUserId: work.completed_by,
          completedByUserName: userName,
          temperature: work.custom?.temperature ?? null,
          isOkay: work.custom?.isOkay ?? true,
          comment: work.comment,
        };
      });

      return { success: true, data: resultItems, conflicts: conflicts.length > 0 ? conflicts : undefined };
    } catch (err: any) {
      console.error("RefrigeratorService.batchUpdateRefrigeratorTasks error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการบันทึกผลการตรวจตู้แช่แบบกลุ่ม" };
    }
  }

  async processDailyRefrigeratorTasks(params?: {
    targetDate?: string;
    yesterdayDate?: string;
    createDailyTasks?: boolean;
    markMissedYesterdayTasks?: boolean;
  }): Promise<{
    success: boolean;
    processedBranches: number;
    totalNewTasksCreated: number;
    totalMissedTasksMarked: number;
    missedBranchesCount: number;
    details?: Array<{
      branchId: string;
      branchName: string;
      missedCount: number;
      missedRefrigerators: string[];
      newTasksCount: number;
    }>;
    error?: string;
  }> {
    try {
      const now = new Date();
      const targetDate = params?.targetDate || getThaiDateString(now);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayDate = params?.yesterdayDate || getThaiDateString(yesterday);
      const doMarkMissed = params?.markMissedYesterdayTasks !== false;
      const doCreateDaily = params?.createDailyTasks !== false;

      // 1. Fetch all branches
      const allBranches = await this.db
        .select({ id: branches.id, name: branches.name })
        .from(branches);

      // 2. Fetch all refrigerators metadata
      const allDbRefs = await this.db.select().from(refrigerators);
      type RefRecord = typeof refrigerators.$inferSelect;
      const refMap = new Map<string, RefRecord>(allDbRefs.map((r: RefRecord) => [r.id, r]));

      let totalNewTasksCreated = 0;
      let totalMissedTasksMarked = 0;
      const details: Array<{
        branchId: string;
        branchName: string;
        missedCount: number;
        missedRefrigerators: string[];
        newTasksCount: number;
      }> = [];

      for (const branch of allBranches) {
        const activeBranchRefs = allDbRefs.filter(
          (r: RefRecord) => r.branch_id === branch.id && !r.disable_check
        );

        if (activeBranchRefs.length === 0) continue;

        // Fetch task definitions for active refrigerators
        const branchRefTasks = await this.db
          .select({
            id: tasks.id,
            shift: tasks.shift,
            custom: tasks.custom,
          })
          .from(tasks)
          .where(
            and(
              eq(tasks.branch_id, branch.id),
              sql`${tasks.custom}->>'type' = 'refrigerator'`
            )
          );

        const taskIds = branchRefTasks.map((t: any) => t.id);

        // --- Step A: Process yesterday's tasks in joint_task_work ---
        let missedRefNames: string[] = [];
        if (doMarkMissed && taskIds.length > 0) {
          const yesterdayWorks = await this.db
            .select()
            .from(jointTaskWork)
            .where(
              and(
                eq(jointTaskWork.branch_id, branch.id),
                eq(jointTaskWork.task_date, yesterdayDate),
                inArray(jointTaskWork.task_id, taskIds)
              )
            );

          const completedYesterdayTaskIds = new Set(
            yesterdayWorks.filter((w: any) => Boolean(w.completed_at)).map((w: any) => w.task_id)
          );

          const uncompletedTasks = branchRefTasks.filter((t: any) => !completedYesterdayTaskIds.has(t.id));

          if (uncompletedTasks.length > 0) {
            for (const ut of uncompletedTasks) {
              const existingWork = yesterdayWorks.find((w: any) => w.task_id === ut.id);
              if (existingWork) {
                await this.db
                  .update(jointTaskWork)
                  .set({
                    status: "incomplete",
                    comment: sql`COALESCE(${jointTaskWork.comment}, 'ไม่ได้ตรวจเช็คเมื่อวาน (ขาดการตรวจสอบ)')`,
                    custom: { isOkay: false },
                  })
                  .where(eq(jointTaskWork.id, existingWork.id));
              } else {
                await this.db
                  .insert(jointTaskWork)
                  .values({
                    task_id: ut.id,
                    branch_id: branch.id,
                    task_date: yesterdayDate,
                    shift: ut.shift,
                    status: "incomplete",
                    comment: "ไม่ได้ตรวจเช็คเมื่อวาน (ขาดการตรวจสอบ)",
                    custom: { isOkay: false },
                  })
                  .onConflictDoNothing();
              }
            }

            totalMissedTasksMarked += uncompletedTasks.length;

            const missedRefIds = new Set(
              uncompletedTasks.map((t: any) => t.custom?.refrigeratorId).filter(Boolean)
            );
            missedRefNames = Array.from(missedRefIds)
              .map((id) => refMap.get(id as string)?.name || "ตู้แช่")
              .filter(Boolean);
          }
        }

        // --- Step B: Ensure today's daily tasks exist (morning & afternoon) ---
        let newBranchTasksCount = 0;
        if (doCreateDaily) {
          await this.ensureDailyRefrigeratorTasks(branch.id, targetDate);

          const todayTasks = await this.db
            .select({ id: tasks.id })
            .from(tasks)
            .where(
              and(
                eq(tasks.branch_id, branch.id),
                sql`${tasks.custom}->>'type' = 'refrigerator'`,
                eq(tasks.disabled, false)
              )
            );

          newBranchTasksCount = todayTasks.length;
          totalNewTasksCreated += newBranchTasksCount;
        }

        details.push({
          branchId: branch.id,
          branchName: branch.name,
          missedCount: missedRefNames.length,
          missedRefrigerators: missedRefNames,
          newTasksCount: newBranchTasksCount,
        });

        // --- Step C: Send notification to Manager & Assistant Manager for this branch ---
        if (this.notificationService) {
          if (missedRefNames.length > 0) {
            const warningMsg = `สาขา${branch.name} พบตู้แช่ที่ไม่ได้ตรวจเช็คเมื่อวาน (${yesterdayDate}) จำนวน ${missedRefNames.length} ตู้: ${missedRefNames.join(", ")} ระบบได้บันทึกสถานะไม่ผ่านเรียบร้อยแล้ว และได้เตรียมรายการตรวจเช็คประจำวันใหม่ (${targetDate}) ให้พนักงานสต็อกแล้ว`;

            await this.notificationService.createNotification({
              branchId: branch.id,
              recipientRole: "manager",
              title: `⚠️ แจ้งเตือน: ตู้แช่ไม่ได้ตรวจเช็ค (${branch.name})`,
              message: warningMsg,
              type: "refrigerator_alert",
            });

            await this.notificationService.createNotification({
              branchId: branch.id,
              recipientRole: "manager_assistant",
              title: `⚠️ แจ้งเตือน: ตู้แช่ไม่ได้ตรวจเช็ค (${branch.name})`,
              message: warningMsg,
              type: "refrigerator_alert",
            });
          } else {
            await this.notificationService.createNotification({
              branchId: branch.id,
              recipientRole: "manager",
              title: `📋 เริ่มต้นรายการตรวจตู้แช่วันนี้ (${targetDate})`,
              message: `สาขา${branch.name} บันทึกอุณหภูมิตู้แช่เมื่อวานครบถ้วน 100% ระบบได้เตรียมรายการตรวจเช็คสำหรับวันนี้เรียบร้อยแล้ว`,
              type: "system",
            });
          }
        }
      }

      // --- Step D: Send notification to General Manager (GM) ---
      if (this.notificationService) {
        const missedBranches = details.filter((d) => d.missedCount > 0);
        if (missedBranches.length > 0) {
          const summaryLines = missedBranches
            .map((b) => `• ${b.branchName}: ${b.missedCount} ตู้ (${b.missedRefrigerators.join(", ")})`)
            .join("\n");

          await this.notificationService.createNotification({
            recipientRole: "general_manager",
            title: `⚠️ รายงานตู้แช่ที่ไม่ได้ตรวจเช็คเมื่อวาน (${yesterdayDate})`,
            message: `ตรวจพบ ${missedBranches.length} สาขา ที่ขาดการบันทึกตู้แช่เมื่อวาน (รวม ${totalMissedTasksMarked} ตู้):\n${summaryLines}\nระบบได้ทำเครื่องหมายสถานะไม่ผ่านและเตรียมงานตรวจรอบใหม่ (${targetDate}) ให้ทุกสาขาแล้ว`,
            type: "refrigerator_alert",
          });
        } else {
          await this.notificationService.createNotification({
            recipientRole: "general_manager",
            title: `✅ สรุปการตรวจตู้แช่เมื่อวาน (${yesterdayDate}) เรียบร้อยครบถ้วน`,
            message: `ทุกสาขาบันทึกผลการตรวจตู้แช่เมื่อวานครบ 100% และระบบได้เริ่มต้นรายการตรวจเช็คประจำวัน (${targetDate}) ทุกสาขาเรียบร้อยแล้ว`,
            type: "system",
          });
        }
      }

      return {
        success: true,
        processedBranches: allBranches.length,
        totalNewTasksCreated,
        totalMissedTasksMarked,
        missedBranchesCount: details.filter((d) => d.missedCount > 0).length,
        details,
      };
    } catch (err: unknown) {
      console.error("RefrigeratorService.processDailyRefrigeratorTasks error:", err);
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการประมวลผลงานตู้แช่ประจำวัน";
      return {
        success: false,
        processedBranches: 0,
        totalNewTasksCreated: 0,
        totalMissedTasksMarked: 0,
        missedBranchesCount: 0,
        error: message,
      };
    }
  }
}
