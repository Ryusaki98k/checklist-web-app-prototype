import { eq, and, sql, inArray, isNull } from "drizzle-orm";
import { refrigerators, branches, refrigeratorTasks, users } from "../db/schema";
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

      if (disableCheck) {
        // If disabled, delete incomplete tasks for today so it disappears live
        await this.db
          .delete(refrigeratorTasks)
          .where(
            and(
              eq(refrigeratorTasks.refrigerator_id, id),
              eq(refrigeratorTasks.task_date, targetDate),
              isNull(refrigeratorTasks.completed_at)
            )
          );
      } else if (targetBranchId) {
        // If re-enabled, ensure daily tasks exist right now
        await this.ensureDailyRefrigeratorTasks(targetBranchId, targetDate);
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

      // Delete today's incomplete tasks for this refrigerator
      await this.db
        .delete(refrigeratorTasks)
        .where(
          and(
            eq(refrigeratorTasks.refrigerator_id, id),
            eq(refrigeratorTasks.task_date, targetDate),
            isNull(refrigeratorTasks.completed_at)
          )
        );

      // Delete the refrigerator itself (foreign keys on delete cascade will handle completed history if any)
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

      const targetDate = getThaiDateString();

      // Transfer incomplete tasks for today to the new branch
      await this.db
        .update(refrigeratorTasks)
        .set({ branch_id: targetBranchId })
        .where(
          and(
            eq(refrigeratorTasks.refrigerator_id, refrigeratorId),
            eq(refrigeratorTasks.task_date, targetDate),
            isNull(refrigeratorTasks.completed_at)
          )
        );

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

      const targetDate = getThaiDateString();

      if (disableCheck) {
        // If disabled, delete incomplete tasks for today so they disappear live
        await this.db
          .delete(refrigeratorTasks)
          .where(
            and(
              inArray(refrigeratorTasks.refrigerator_id, refrigeratorIds),
              eq(refrigeratorTasks.task_date, targetDate),
              isNull(refrigeratorTasks.completed_at)
            )
          );
      } else if (effectiveBranchId) {
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

  async ensureDailyRefrigeratorTasks(branchId: string, dateStr?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const targetDate = dateStr || getThaiDateString();

      const activeRefs = await this.db
        .select({ id: refrigerators.id })
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

      const existingTasks = await this.db
        .select({
          id: refrigeratorTasks.id,
          refrigerator_id: refrigeratorTasks.refrigerator_id,
          shift: refrigeratorTasks.shift,
        })
        .from(refrigeratorTasks)
        .where(
          and(
            eq(refrigeratorTasks.branch_id, branchId),
            eq(refrigeratorTasks.task_date, targetDate)
          )
        );

      const existingKeys = new Set(
        existingTasks.map((t: any) => `${t.refrigerator_id}_${t.shift || "all"}`)
      );

      const shiftsToCreate: ("morning" | "afternoon")[] = ["morning", "afternoon"];
      const insertRows: Array<{
        branch_id: string;
        refrigerator_id: string;
        task_date: string;
        shift: "morning" | "afternoon";
        is_okay: boolean;
      }> = [];

      for (const ref of activeRefs) {
        for (const s of shiftsToCreate) {
          const key = `${ref.id}_${s}`;
          if (!existingKeys.has(key)) {
            insertRows.push({
              branch_id: branchId,
              refrigerator_id: ref.id,
              task_date: targetDate,
              shift: s,
              is_okay: true,
            });
          }
        }
      }

      if (insertRows.length > 0) {
        await this.db
          .insert(refrigeratorTasks)
          .values(insertRows)
          .onConflictDoNothing();
      }

      // Also clean up any uncompleted tasks for refrigerators that are now disabled or removed from branch
      const activeRefIdSet = new Set(activeRefs.map((r: any) => r.id));
      const staleTasks = existingTasks.filter((t: any) => !activeRefIdSet.has(t.refrigerator_id));
      if (staleTasks.length > 0) {
        const staleIds = staleTasks.map((t: any) => t.id);
        await this.db
          .delete(refrigeratorTasks)
          .where(
            and(
              inArray(refrigeratorTasks.id, staleIds),
              isNull(refrigeratorTasks.completed_at)
            )
          );
      }

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

      // 1. Check if tasks for today already exist first before running heavy sync
      let tasksRows = await this.db
        .select()
        .from(refrigeratorTasks)
        .where(
          and(
            eq(refrigeratorTasks.branch_id, targetBranchId),
            eq(refrigeratorTasks.task_date, targetDate)
          )
        );

      if (tasksRows.length === 0) {
        // Automatically ensure initial tasks exist for today only when missing
        await this.ensureDailyRefrigeratorTasks(targetBranchId, targetDate);
        tasksRows = await this.db
          .select()
          .from(refrigeratorTasks)
          .where(
            and(
              eq(refrigeratorTasks.branch_id, targetBranchId),
              eq(refrigeratorTasks.task_date, targetDate)
            )
          );
      }

      // 2. Fetch branch's assigned refrigerators to know all units including disabled ones
      const allBranchRefs = await this.db
        .select()
        .from(refrigerators)
        .where(eq(refrigerators.branch_id, targetBranchId));

      const refMap = new Map<string, any>(allBranchRefs.map((r: any) => [r.id, r]));

      const disabledRefrigerators = allBranchRefs
        .filter((r: any) => r.disable_check)
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          minTemperature: r.min_temperature ?? 0,
          maxTemperature: r.max_temperature ?? 4,
        }));

      if (tasksRows.length === 0) {
        return { success: true, data: [], disabledRefrigerators, branchName };
      }

      // Filter by shift if shift is specified and not 'both'
      let filteredTasksRows = tasksRows;
      if (shift && shift !== "both") {
        const targetShift = shift === "morning" ? "morning" : "afternoon";
        filteredTasksRows = tasksRows.filter(
          (t: any) => !t.shift || t.shift === targetShift || t.shift === "morning_afternoon"
        );
      }

      // Include all refrigerator tasks that belong to active refrigerators in branch
      const activeTasksRows = filteredTasksRows.filter((t: any) => {
        const ref = refMap.get(t.refrigerator_id);
        return Boolean(ref);
      });

      const userIds = activeTasksRows.map((t: any) => t.completed_by).filter(Boolean);
      let userMap = new Map<string, string>();
      if (userIds.length > 0) {
        const userRows = await this.db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, userIds));
        userMap = new Map(userRows.map((u: any) => [u.id, u.name]));
      }

      const items: RefrigeratorTaskItem[] = activeTasksRows.map((t: any) => {
        const ref = refMap.get(t.refrigerator_id) as any;
        const completed = Boolean(t.completed_at);
        const completedByName = t.completed_by ? userMap.get(t.completed_by) || "พนักงาน" : null;

        return {
          taskId: t.id,
          refrigeratorId: t.refrigerator_id,
          name: ref?.name || "ตู้แช่",
          minTemperature: ref?.min_temperature ?? 0,
          maxTemperature: ref?.max_temperature ?? 4,
          targetTemperature: ref?.max_temperature ?? 4,
          disableCheck: Boolean(ref?.disable_check),
          taskDate: t.task_date,
          shift: t.shift ? (t.shift === "morning_afternoon" ? "both" : t.shift) : null,
          completed,
          completedAt: t.completed_at ? new Date(t.completed_at).toISOString() : null,
          completedByUserId: t.completed_by || null,
          completedByUserName: completedByName,
          temperature: t.temperature !== null ? t.temperature : null,
          isOkay: t.is_okay ?? true,
          comment: t.comment || null,
        };
      });

      // Sort alphabetically by refrigerator name, then morning before afternoon
      items.sort((a, b) => {
        const cmp = a.name.localeCompare(b.name, "th", { numeric: true });
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

      const [existingTask] = await this.db
        .select()
        .from(refrigeratorTasks)
        .where(eq(refrigeratorTasks.id, taskId))
        .limit(1);

      if (!existingTask) {
        return { success: false, error: "ไม่พบรายการงานตู้แช่ที่ระบุ" };
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

      // Check if refrigerator is disabled
      const [refCheck] = await this.db
        .select({ disable_check: refrigerators.disable_check, name: refrigerators.name })
        .from(refrigerators)
        .where(eq(refrigerators.id, existingTask.refrigerator_id))
        .limit(1);

      if (refCheck?.disable_check) {
        return { success: false, error: `ตู้แช่ "${refCheck.name}" ถูกปิดการตรวจสอบชั่วคราว ไม่สามารถบันทึกผลได้` };
      }

      const completedAt = completed ? new Date() : null;
      const clampedTemp = completed && temperature !== undefined && !isNaN(temperature)
        ? clampTemperature(temperature)
        : null;

      const effectiveShift = shift
        ? shift === "both"
          ? "morning_afternoon"
          : shift
        : existingTask.shift;

      const [updatedTask] = await this.db
        .update(refrigeratorTasks)
        .set({
          completed_by: completed ? userId : null,
          completed_at: completedAt,
          temperature: clampedTemp,
          is_okay: completed && isOkay !== undefined ? isOkay : true,
          comment: completed && comment !== undefined ? comment : null,
          shift_session_id: completed && shiftSessionId ? shiftSessionId : null,
          shift: effectiveShift,
        })
        .where(eq(refrigeratorTasks.id, taskId))
        .returning();

      // Update branch last_update for reactivity
      await this.db
        .update(branches)
        .set({ last_update: new Date() })
        .where(eq(branches.id, existingTask.branch_id));

      const [ref] = await this.db
        .select()
        .from(refrigerators)
        .where(eq(refrigerators.id, updatedTask.refrigerator_id))
        .limit(1);

      let userName: string | null = null;
      if (updatedTask.completed_by) {
        const [u] = await this.db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, updatedTask.completed_by))
          .limit(1);
        userName = u?.name || null;
      }

      const resultItem: RefrigeratorTaskItem = {
        taskId: updatedTask.id,
        refrigeratorId: updatedTask.refrigerator_id,
        name: ref?.name || "ตู้แช่",
        minTemperature: ref?.min_temperature ?? 0,
        maxTemperature: ref?.max_temperature ?? 4,
        targetTemperature: ref?.max_temperature ?? 4,
        taskDate: updatedTask.task_date,
        shift: updatedTask.shift ? (updatedTask.shift === "morning_afternoon" ? "both" : updatedTask.shift) : null,
        completed: Boolean(updatedTask.completed_at),
        completedAt: updatedTask.completed_at ? new Date(updatedTask.completed_at).toISOString() : null,
        completedByUserId: updatedTask.completed_by,
        completedByUserName: userName,
        temperature: updatedTask.temperature,
        isOkay: updatedTask.is_okay ?? true,
        comment: updatedTask.comment,
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

      // 1. Fetch all matching tasks in a single query
      const existingTasks = await this.db
        .select()
        .from(refrigeratorTasks)
        .where(inArray(refrigeratorTasks.id, taskIds));

      const existingMap = new Map<string, any>(existingTasks.map((t: any) => [t.id, t]));

      // 2. Fetch all matching refrigerators in a single query
      const refIds: string[] = Array.from(
        new Set(existingTasks.map((t: any) => t.refrigerator_id).filter((id: any): id is string => Boolean(id)))
      );
      const refs = refIds.length > 0
        ? await this.db.select().from(refrigerators).where(inArray(refrigerators.id, refIds))
        : [];
      const refMap = new Map<string, any>(refs.map((r: any) => [r.id, r]));

      const affectedBranchIds = new Set<string>();
      const userIds = new Set<string>();

      // 3. Concurrently update tasks in parallel
      const updatePromises = items.map(async (item) => {
        const existingTask = existingMap.get(item.taskId);
        if (!existingTask) return null;

        const ref = refMap.get(existingTask.refrigerator_id);
        if (ref?.disable_check) {
          // Refrigerator check disabled
          return null;
        }

        if (existingTask.branch_id) {
          affectedBranchIds.add(existingTask.branch_id);
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
          : existingTask.shift;

        const [updatedTask] = await this.db
          .update(refrigeratorTasks)
          .set({
            completed_by: item.completed ? item.userId : null,
            completed_at: completedAt,
            temperature: clampedTemp,
            is_okay: item.completed && item.isOkay !== undefined ? item.isOkay : true,
            comment: item.completed && item.comment !== undefined ? item.comment : null,
            shift_session_id: item.completed && item.shiftSessionId ? item.shiftSessionId : null,
            shift: effectiveShift,
          })
          .where(eq(refrigeratorTasks.id, item.taskId))
          .returning();

        return updatedTask;
      });

      const updatedRows = (await Promise.all(updatePromises)).filter(Boolean);

      // 4. Update branch last_update in a single query
      if (affectedBranchIds.size > 0) {
        await this.db
          .update(branches)
          .set({ last_update: new Date() })
          .where(inArray(branches.id, Array.from(affectedBranchIds)));
      }

      // 5. Fetch user names in batch
      let userMap = new Map<string, string>();
      const userIdsList = Array.from(userIds);
      if (userIdsList.length > 0) {
        const userRows = await this.db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, userIdsList));
        userMap = new Map(userRows.map((u: any) => [u.id, u.name]));
      }

      // 6. Assemble result items
      const resultItems: RefrigeratorTaskItem[] = updatedRows.map((t: any) => {
        const ref = refMap.get(t.refrigerator_id);
        const userName = t.completed_by ? userMap.get(t.completed_by) || null : null;

        return {
          taskId: t.id,
          refrigeratorId: t.refrigerator_id,
          name: ref?.name || "ตู้แช่",
          minTemperature: ref?.min_temperature ?? 0,
          maxTemperature: ref?.max_temperature ?? 4,
          targetTemperature: ref?.max_temperature ?? 4,
          taskDate: t.task_date,
          shift: t.shift ? (t.shift === "morning_afternoon" ? "both" : t.shift) : null,
          completed: Boolean(t.completed_at),
          completedAt: t.completed_at ? new Date(t.completed_at).toISOString() : null,
          completedByUserId: t.completed_by,
          completedByUserName: userName,
          temperature: t.temperature,
          isOkay: t.is_okay ?? true,
          comment: t.comment,
        };
      });

      return { success: true, data: resultItems };
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

        const activeRefIdSet = new Set(activeBranchRefs.map((r: RefRecord) => r.id));

        // --- Step A: Process yesterday's tasks ---
        let missedRefNames: string[] = [];
        if (doMarkMissed) {
          const yesterdayTasks = await this.db
            .select()
            .from(refrigeratorTasks)
            .where(
              and(
                eq(refrigeratorTasks.branch_id, branch.id),
                eq(refrigeratorTasks.task_date, yesterdayDate)
              )
            );

          type TaskRecord = typeof refrigeratorTasks.$inferSelect;
          const existingRefIdsYesterday = new Set(yesterdayTasks.map((t: TaskRecord) => t.refrigerator_id));
          const missingYesterdayRefs = activeBranchRefs.filter((r: RefRecord) => !existingRefIdsYesterday.has(r.id));

          // Insert missing yesterday rows as marked unchecked
          if (missingYesterdayRefs.length > 0) {
            for (const r of missingYesterdayRefs) {
              for (const s of ["morning", "afternoon"] as const) {
                await this.db
                  .insert(refrigeratorTasks)
                  .values({
                    branch_id: branch.id,
                    refrigerator_id: r.id,
                    task_date: yesterdayDate,
                    shift: s,
                    is_okay: false,
                    comment: "ไม่ได้ตรวจเช็คเมื่อวาน (ขาดการตรวจสอบ)",
                  })
                  .onConflictDoNothing();
                totalMissedTasksMarked++;
              }
            }
          }

          // Mark any uncompleted yesterday tasks as failed
          const uncompletedYesterdayTasks = yesterdayTasks.filter(
            (t: TaskRecord) => activeRefIdSet.has(t.refrigerator_id) && !t.completed_at
          );

          const uncompletedTaskIds = uncompletedYesterdayTasks.map((t: TaskRecord) => t.id);
          if (uncompletedTaskIds.length > 0) {
            await this.db
              .update(refrigeratorTasks)
              .set({
                is_okay: false,
                comment: sql`COALESCE(${refrigeratorTasks.comment}, 'ไม่ได้ตรวจเช็คเมื่อวาน (ขาดการตรวจสอบ)')`,
              })
              .where(inArray(refrigeratorTasks.id, uncompletedTaskIds));
            totalMissedTasksMarked += uncompletedTaskIds.length;
          }

          const missedRefIds = new Set([
            ...missingYesterdayRefs.map((r: RefRecord) => r.id),
            ...uncompletedYesterdayTasks.map((t: TaskRecord) => t.refrigerator_id),
          ]);

          missedRefNames = Array.from(missedRefIds)
            .map((id) => refMap.get(id)?.name || "ตู้แช่")
            .filter(Boolean);
        }

        // --- Step B: Ensure today's daily tasks exist (morning & afternoon) ---
        let newBranchTasksCount = 0;
        if (doCreateDaily) {
          const existingTodayTasks = await this.db
            .select({
              id: refrigeratorTasks.id,
              refrigerator_id: refrigeratorTasks.refrigerator_id,
              shift: refrigeratorTasks.shift,
            })
            .from(refrigeratorTasks)
            .where(
              and(
                eq(refrigeratorTasks.branch_id, branch.id),
                eq(refrigeratorTasks.task_date, targetDate)
              )
            );

          const existingKeysToday = new Set(
            existingTodayTasks.map((t: any) => `${t.refrigerator_id}_${t.shift || "all"}`)
          );

          const shiftsToCreate: ("morning" | "afternoon")[] = ["morning", "afternoon"];
          const insertToday: any[] = [];

          for (const r of activeBranchRefs) {
            for (const s of shiftsToCreate) {
              const key = `${r.id}_${s}`;
              if (!existingKeysToday.has(key)) {
                insertToday.push({
                  branch_id: branch.id,
                  refrigerator_id: r.id,
                  task_date: targetDate,
                  shift: s,
                  is_okay: true,
                });
              }
            }
          }

          if (insertToday.length > 0) {
            await this.db.insert(refrigeratorTasks).values(insertToday).onConflictDoNothing();
            totalNewTasksCreated += insertToday.length;
            newBranchTasksCount = insertToday.length;
          }

          // Clean up any uncompleted tasks for disabled/removed refrigerators today
          const staleTodayTasks = existingTodayTasks.filter(
            (t: any) => !activeRefIdSet.has(t.refrigerator_id)
          );
          if (staleTodayTasks.length > 0) {
            await this.db
              .delete(refrigeratorTasks)
              .where(
                and(
                  inArray(refrigeratorTasks.id, staleTodayTasks.map((t: any) => t.id)),
                  isNull(refrigeratorTasks.completed_at)
                )
              );
          }
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

            // 1. Manager of this branch
            await this.notificationService.createNotification({
              branchId: branch.id,
              recipientRole: "manager",
              title: `⚠️ แจ้งเตือน: ตู้แช่ไม่ได้ตรวจเช็ค (${branch.name})`,
              message: warningMsg,
              type: "refrigerator_alert",
            });

            // 2. Assistant Manager of this branch
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
