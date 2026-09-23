import { eq, and, sql, inArray } from "drizzle-orm";
import { refrigerators, branches, refrigeratorTasks, users } from "../db/schema";
import { IRefrigeratorService, RefrigeratorTaskItem } from "./types";
import { ShiftType } from "../types";

export interface RefrigeratorConfig {
  id: string;
  name: string;
  min_temperature: number;
  max_temperature: number;
  disable_check: boolean;
}

function getThaiDateString(baseDate = new Date()): string {
  const y = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(baseDate);
  const m = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", month: "2-digit" }).format(baseDate);
  const d = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", day: "2-digit" }).format(baseDate);
  return `${y}-${m}-${d}`;
}

export class RefrigeratorService implements IRefrigeratorService {
  constructor(private db: any) {}

  private async getBranchForUser(userId: string) {
    let [branch] = await this.db
      .select({ id: branches.id, name: branches.name, refrigerators: branches.refrigerators })
      .from(branches)
      .where(sql`${userId} = ANY(${branches.members})`)
      .limit(1);

    if (!branch) {
      [branch] = await this.db
        .select({ id: branches.id, name: branches.name, refrigerators: branches.refrigerators })
        .from(branches)
        .limit(1);
    }

    return branch;
  }

  async getRefrigerators(userId: string): Promise<{ success: boolean; data?: RefrigeratorConfig[]; error?: string }> {
    try {
      const branch = await this.getBranchForUser(userId);

      if (!branch) {
        return { success: true, data: [] };
      }

      // Fetch all refrigerators in the database
      const allDbRefs = await this.db.select().from(refrigerators);
      if (allDbRefs.length === 0) {
        return { success: true, data: [] };
      }

      // Automatically sync any newly added refrigerators to the branch's refrigerator list
      const branchRefIds: string[] = Array.isArray(branch.refrigerators) ? branch.refrigerators : [];
      const branchRefSet = new Set(branchRefIds);
      const allDbRefIds = allDbRefs.map((r: any) => r.id);
      const missingFromBranch = allDbRefIds.filter((id: string) => !branchRefSet.has(id));

      if (missingFromBranch.length > 0) {
        const merged = Array.from(new Set([...branchRefIds, ...allDbRefIds]));
        await this.db
          .update(branches)
          .set({
            refrigerators: merged,
            last_update: new Date(),
          })
          .where(eq(branches.id, branch.id));

        branch.refrigerators = merged;
        await this.ensureDailyRefrigeratorTasks(branch.id);
      }

      const activeRefSet = new Set(branch.refrigerators);
      const refs = allDbRefs.filter((r: any) => activeRefSet.has(r.id));
      refs.sort((a: any, b: any) => a.name.localeCompare(b.name, "th", { numeric: true }));

      return { success: true, data: refs.map((r: any) => ({ ...r, disable_check: !!r.disable_check })) };
    } catch (err: any) {
      console.error("RefrigeratorService.getRefrigerators error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการดึงข้อมูลตู้แช่" };
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

      const [newRef] = await this.db
        .insert(refrigerators)
        .values({
          name,
          min_temperature: minTemperature,
          max_temperature: maxTemperature,
          disable_check: disableCheck,
        })
        .returning();

      const currentRefs = branch.refrigerators || [];
      await this.db
        .update(branches)
        .set({
          refrigerators: [...currentRefs, newRef.id],
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

      await this.db
        .update(refrigerators)
        .set({
          name,
          min_temperature: minTemperature,
          max_temperature: maxTemperature,
          disable_check: disableCheck,
        })
        .where(eq(refrigerators.id, id));

      // Find branch containing this refrigerator and sync today's tasks
      const [branch] = await this.db
        .select({ id: branches.id })
        .from(branches)
        .where(sql`${id} = ANY(${branches.refrigerators})`)
        .limit(1);

      const targetDate = getThaiDateString();

      if (disableCheck) {
        // If disabled, delete incomplete tasks for today so it disappears live
        await this.db
          .delete(refrigeratorTasks)
          .where(
            and(
              eq(refrigeratorTasks.refrigerator_id, id),
              eq(refrigeratorTasks.task_date, targetDate),
              sql`${refrigeratorTasks.completed_at} IS NULL`
            )
          );
      } else if (branch) {
        // If re-enabled, ensure daily task is created right now
        await this.ensureDailyRefrigeratorTasks(branch.id, targetDate);
      }

      if (branch) {
        await this.db
          .update(branches)
          .set({ last_update: new Date() })
          .where(eq(branches.id, branch.id));
      }

      return { success: true };
    } catch (err: any) {
      console.error("RefrigeratorService.updateRefrigerator error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการอัปเดตตู้แช่" };
    }
  }

  async ensureDailyRefrigeratorTasks(branchId: string, dateStr?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const targetDate = dateStr || getThaiDateString();

      const [branch] = await this.db
        .select({ id: branches.id, refrigerators: branches.refrigerators })
        .from(branches)
        .where(eq(branches.id, branchId))
        .limit(1);

      if (!branch || !branch.refrigerators || branch.refrigerators.length === 0) {
        return { success: true };
      }

      const refIds = branch.refrigerators as string[];
      const activeRefs = await this.db
        .select({ id: refrigerators.id })
        .from(refrigerators)
        .where(
          and(
            inArray(refrigerators.id, refIds),
            eq(refrigerators.disable_check, false)
          )
        );

      if (activeRefs.length === 0) {
        return { success: true };
      }

      const existingTasks = await this.db
        .select({ id: refrigeratorTasks.id, refrigerator_id: refrigeratorTasks.refrigerator_id })
        .from(refrigeratorTasks)
        .where(
          and(
            eq(refrigeratorTasks.branch_id, branchId),
            eq(refrigeratorTasks.task_date, targetDate)
          )
        );

      const existingRefIds = new Set(existingTasks.map((t: any) => t.refrigerator_id));
      const missingRefs = activeRefs.filter((r: any) => !existingRefIds.has(r.id));

      if (missingRefs.length > 0) {
        const insertRows = missingRefs.map((r: any) => ({
          branch_id: branchId,
          refrigerator_id: r.id,
          task_date: targetDate,
          is_okay: true,
        }));
        await this.db.insert(refrigeratorTasks).values(insertRows);
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
              sql`${refrigeratorTasks.completed_at} IS NULL`
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
  }): Promise<{
    success: boolean;
    data?: RefrigeratorTaskItem[];
    disabledRefrigerators?: { id: string; name: string; minTemperature: number; maxTemperature: number }[];
    branchName?: string;
    error?: string;
  }> {
    try {
      const { userId, branchId: propBranchId, dateStr } = params;
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
        const [anyBranch] = await this.db
          .select({ id: branches.id, name: branches.name })
          .from(branches)
          .limit(1);
        if (anyBranch) {
          targetBranchId = anyBranch.id;
          branchName = anyBranch.name;
        } else {
          return { success: true, data: [], branchName: "" };
        }
      } else if (!branchName) {
        const [b] = await this.db
          .select({ name: branches.name })
          .from(branches)
          .where(eq(branches.id, targetBranchId))
          .limit(1);
        if (b) branchName = b.name;
      }

      if (!targetBranchId) {
        return { success: true, data: [], branchName: "" };
      }

      // Fast check: check if tasks for today already exist first before running heavy sync
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

      // Fetch branch's assigned refrigerators to know all units including disabled ones
      const [branchRow] = await this.db
        .select({ refrigerators: branches.refrigerators })
        .from(branches)
        .where(eq(branches.id, targetBranchId))
        .limit(1);

      const branchRefIds: string[] = Array.isArray(branchRow?.refrigerators) ? branchRow.refrigerators : [];
      let allBranchRefs: any[] = [];
      if (branchRefIds.length > 0) {
        allBranchRefs = await this.db
          .select()
          .from(refrigerators)
          .where(inArray(refrigerators.id, branchRefIds));
      }

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

      const userIds = tasksRows.map((t: any) => t.completed_by).filter(Boolean);

      // Include all refrigerator tasks for the branch (disabled units have disableCheck: true)
      const activeTasksRows = tasksRows.filter((t: any) => {
        const ref = refMap.get(t.refrigerator_id);
        return Boolean(ref);
      });

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
          completed,
          completedAt: t.completed_at ? new Date(t.completed_at).toISOString() : null,
          completedByUserId: t.completed_by || null,
          completedByUserName: completedByName,
          temperature: t.temperature !== null ? t.temperature : null,
          isOkay: t.is_okay ?? true,
          comment: t.comment || null,
        };
      });

      // Sort alphabetically by refrigerator name
      items.sort((a, b) => a.name.localeCompare(b.name, "th"));

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
  }): Promise<{ success: boolean; data?: RefrigeratorTaskItem; error?: string }> {
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

      const [updatedTask] = await this.db
        .update(refrigeratorTasks)
        .set({
          completed_by: completed ? userId : null,
          completed_at: completedAt,
          temperature: completed && temperature !== undefined ? temperature : null,
          is_okay: completed && isOkay !== undefined ? isOkay : true,
          comment: completed && comment !== undefined ? comment : null,
          shift_session_id: completed && shiftSessionId ? shiftSessionId : null,
          shift: completed && shift ? (shift === "both" ? "morning_afternoon" : shift) : null,
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
}
