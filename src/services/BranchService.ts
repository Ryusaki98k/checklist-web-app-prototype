import { eq, sql, and, inArray, notInArray, gte, lte } from "drizzle-orm";
import {
  branches,
  users,
  branchTasks,
  shiftSession,
  taskWork,
  refrigerators,
  refrigeratorTasks,
  employeeLeaves,
} from "../db/schema";
import {
  IBranchService,
  BranchOperationsReportData,
  BranchOperationsSummaryItem,
  BranchEmployeeStatusItem,
  BranchShiftProgress,
} from "./types";
import { getThaiStartAndEndOfDay } from "../utils/date";

export interface DashboardBranch {
  id: string;
  code: string;
  name: string;
  location: string;
  managerName: string;
  staffCount: number;
  status: "active" | "maintenance" | "standby";
  todayCompletionRate: number;
  members: string[];
  tasks: string[];
  leaveQuota: number;
}

export class BranchService implements IBranchService {
  private static cachedBranches: DashboardBranch[] | null = null;
  private static cachedLastUpdate: Date | null = null;
  private static cacheFetchedAt: number = 0;
  private static readonly CACHE_TTL_MS = 10000; // 10s soft window to avoid spamming SELECT MAX

  constructor(private db: any) {}

  invalidateCache(): void {
    BranchService.cachedBranches = null;
    BranchService.cachedLastUpdate = null;
    BranchService.cacheFetchedAt = 0;
  }

  async checkBranchesUpdated(
    clientLastUpdate?: string,
    branchId?: string
  ): Promise<{
    success: boolean;
    updated: boolean;
    lastUpdate?: string;
    branches?: DashboardBranch[];
    error?: string;
  }> {
    try {
      let latestTimestamp: Date | null = null;

      if (branchId) {
        const [branchRow] = await this.db
          .select({ lastUpdate: branches.last_update })
          .from(branches)
          .where(eq(branches.id, branchId))
          .limit(1);
        latestTimestamp = branchRow?.lastUpdate ? new Date(branchRow.lastUpdate) : null;
      } else {
        const [maxRow] = await this.db
          .select({ maxUpdate: sql<Date | string>`MAX(${branches.last_update})` })
          .from(branches);
        latestTimestamp = maxRow?.maxUpdate ? new Date(maxRow.maxUpdate) : null;
      }

      const isoLatest = latestTimestamp?.toISOString();

      if (!clientLastUpdate) {
        // No client cache, needs full load
        const fresh = await this.getBranches({ forceRefresh: true });
        return {
          success: true,
          updated: true,
          lastUpdate: isoLatest,
          branches: fresh.branches,
        };
      }

      const clientTime = new Date(clientLastUpdate).getTime();
      const serverTime = latestTimestamp ? latestTimestamp.getTime() : 0;

      // If server timestamp is newer than what client has
      if (serverTime > clientTime) {
        const fresh = await this.getBranches({ forceRefresh: true });
        return {
          success: true,
          updated: true,
          lastUpdate: isoLatest,
          branches: fresh.branches,
        };
      }

      // No updates needed
      return {
        success: true,
        updated: false,
        lastUpdate: isoLatest,
      };
    } catch (err: unknown) {
      console.error("BranchService.checkBranchesUpdated error:", err);
      return { success: false, updated: true, error: "เกิดข้อผิดพลาดในการตรวจสอบการอัปเดตสาขา" };
    }
  }

  async getBranches(options?: { forceRefresh?: boolean }): Promise<{
    success: boolean;
    branches?: DashboardBranch[];
    lastUpdate?: string;
    error?: string;
  }> {
    try {
      const now = Date.now();
      const hasCache = BranchService.cachedBranches !== null;

      // Check soft cache window (no DB request needed)
      if (!options?.forceRefresh && hasCache && now - BranchService.cacheFetchedAt < BranchService.CACHE_TTL_MS) {
        return {
          success: true,
          branches: BranchService.cachedBranches!,
          lastUpdate: BranchService.cachedLastUpdate?.toISOString(),
        };
      }

      // If cached, do a lightweight MAX(last_update) check before performing full tables scan
      if (!options?.forceRefresh && hasCache && BranchService.cachedLastUpdate) {
        const [maxRow] = await this.db
          .select({ maxUpdate: sql<Date | string>`MAX(${branches.last_update})` })
          .from(branches);
        const serverMaxDate = maxRow?.maxUpdate ? new Date(maxRow.maxUpdate) : null;

        if (serverMaxDate && serverMaxDate.getTime() <= BranchService.cachedLastUpdate.getTime()) {
          BranchService.cacheFetchedAt = now;
          return {
            success: true,
            branches: BranchService.cachedBranches!,
            lastUpdate: BranchService.cachedLastUpdate.toISOString(),
          };
        }
      }

      // Full database load & formatting
      const allBranches = await this.db.select().from(branches);
      const allUsers = await this.db.select().from(users);
      const allBranchTasks = await this.db.select().from(branchTasks);

      // Group assigned tasks by branch_id
      const branchTasksMap = new Map<string, string[]>();
      for (const bt of allBranchTasks) {
        const current = branchTasksMap.get(bt.branch_id) || [];
        current.push(bt.task_id);
        branchTasksMap.set(bt.branch_id, current);
      }

      let maxBranchUpdate: Date | null = null;

      const formattedBranches: DashboardBranch[] = allBranches.map((b: any, index: number) => {
        if (b.last_update) {
          const dt = new Date(b.last_update);
          if (!maxBranchUpdate || dt.getTime() > maxBranchUpdate.getTime()) {
            maxBranchUpdate = dt;
          }
        }

        const branchUsers = allUsers.filter((u: any) => u.branch_id === b.id);
        const manager = branchUsers.find((u: any) => u.role === "manager" || u.role === "general_manager");
        const managerName = manager ? manager.name : "กำลังสรรหา";

        // Generate clean branch code: e.g. "BR-001" or preserve explicit code without cutting Thai characters
        const branchCode = /^[A-Z0-9_-]{2,8}$/i.test(b.name)
          ? b.name.toUpperCase()
          : `BR-${String(index + 1).padStart(3, "0")}`;

        return {
          id: b.id,
          code: branchCode,
          name: b.name,
          location: "-",
          managerName,
          staffCount: branchUsers.length,
          status: "active",
          todayCompletionRate: 0,
          members: branchUsers.map((u: any) => u.id),
          tasks: branchTasksMap.get(b.id) || [],
          leaveQuota: typeof b.leave_quota === "number" ? b.leave_quota : 3,
        };
      });

      // Update in-memory server cache
      BranchService.cachedBranches = formattedBranches;
      BranchService.cachedLastUpdate = maxBranchUpdate || new Date();
      BranchService.cacheFetchedAt = now;

      return {
        success: true,
        branches: formattedBranches,
        lastUpdate: BranchService.cachedLastUpdate.toISOString(),
      };
    } catch (err: any) {
      console.error("BranchService.getBranches error:", err);
      return { success: false, error: "เกิดข้อผิดพลาดในการดึงข้อมูลสาขา" };
    }
  }

  async createBranch(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!name.trim()) return { success: false, error: "กรุณาระบุชื่อสาขา" };

      await this.db.insert(branches).values({
        name: name.trim(),
        last_update: new Date(),
      });

      this.invalidateCache();
      return { success: true };
    } catch (err: any) {
      console.error("BranchService.createBranch error:", err);
      return { success: false, error: "ไม่สามารถสร้างสาขาได้" };
    }
  }

  async assignStaffToBranch(branchId: string, userIds: string[]): Promise<{ success: boolean; error?: string }> {
    try {
      if (!branchId || typeof branchId !== "string") {
        return { success: false, error: "ID ของสาขาไม่ถูกต้อง" };
      }

      const validUserIds = Array.isArray(userIds) ? userIds.filter(Boolean) : [];

      if (validUserIds.length > 0) {
        // 1. Unassign users previously assigned to this branch who were unselected
        await this.db
          .update(users)
          .set({ branch_id: null })
          .where(and(eq(users.branch_id, branchId), notInArray(users.id, validUserIds)));

        // 2. Assign selected users to this branch
        await this.db
          .update(users)
          .set({ branch_id: branchId })
          .where(inArray(users.id, validUserIds));
      } else {
        // Unassign all users from this branch
        await this.db
          .update(users)
          .set({ branch_id: null })
          .where(eq(users.branch_id, branchId));
      }

      // Touch branch last_update
      await this.db
        .update(branches)
        .set({ last_update: new Date() })
        .where(eq(branches.id, branchId));

      this.invalidateCache();
      return { success: true };
    } catch (err: any) {
      console.error("BranchService.assignStaffToBranch error:", err);
      return { success: false, error: "ไม่สามารถปรับปรุงพนักงานในสาขาได้" };
    }
  }

  async assignTasksToBranch(branchId: string, taskIds: string[]): Promise<{ success: boolean; error?: string }> {
    try {
      if (!branchId || typeof branchId !== "string") {
        return { success: false, error: "ID ของสาขาไม่ถูกต้อง" };
      }

      const validTaskIds = Array.isArray(taskIds) ? taskIds.filter(Boolean) : [];

      if (validTaskIds.length > 0) {
        // 1. Remove branch tasks that are no longer assigned
        await this.db
          .delete(branchTasks)
          .where(and(eq(branchTasks.branch_id, branchId), notInArray(branchTasks.task_id, validTaskIds)));

        // 2. Insert new task assignments with ON CONFLICT DO NOTHING (prevents duplicate key errors and race conditions)
        const taskValues = validTaskIds.map((taskId) => ({
          branch_id: branchId,
          task_id: taskId,
        }));
        await this.db
          .insert(branchTasks)
          .values(taskValues)
          .onConflictDoNothing();
      } else {
        // Clear all tasks for this branch
        await this.db
          .delete(branchTasks)
          .where(eq(branchTasks.branch_id, branchId));
      }

      await this.db
        .update(branches)
        .set({ last_update: new Date() })
        .where(eq(branches.id, branchId));

      this.invalidateCache();
      return { success: true };
    } catch (err: any) {
      console.error("BranchService.assignTasksToBranch error:", err);
      return { success: false, error: "ไม่สามารถปรับปรุงงานของสาขาได้" };
    }
  }


  async updateBranchLeaveQuota(branchId: string, quota: number): Promise<{ success: boolean; error?: string }> {
    try {
      if (!branchId || typeof branchId !== "string") {
        return { success: false, error: "ID ของสาขาไม่ถูกต้อง" };
      }
      const safeQuota = Math.max(0, Math.floor(quota));
      await this.db
        .update(branches)
        .set({
          leave_quota: safeQuota,
          last_update: new Date(),
        })
        .where(eq(branches.id, branchId));

      this.invalidateCache();
      return { success: true };
    } catch (err: any) {
      console.error("BranchService.updateBranchLeaveQuota error:", err);
      return { success: false, error: "ไม่สามารถปรับปรุงโควตาการลาของสาขาได้" };
    }
  }

  async getBranchOperationsReport(dateStr?: string): Promise<{
    success: boolean;
    data?: BranchOperationsReportData;
    error?: string;
  }> {
    try {
      const targetDate = dateStr ? new Date(dateStr) : new Date();
      const { startOfDay, endOfDay, dateStr: activeDateStr } = getThaiStartAndEndOfDay(targetDate);

      // 1. Fetch core entities
      const allBranches = await this.db.select().from(branches);
      const allUsers = await this.db.select().from(users);

      // 2. Fetch today's shift sessions
      const todaySessions = await this.db
        .select()
        .from(shiftSession)
        .where(and(gte(shiftSession.start, startOfDay), lte(shiftSession.start, endOfDay)));

      const sessionIds = todaySessions.map((s: any) => s.id);

      // 3. Fetch taskWorks for today's sessions
      let todayWorks: any[] = [];
      if (sessionIds.length > 0) {
        todayWorks = await this.db
          .select()
          .from(taskWork)
          .where(inArray(taskWork.shift_session, sessionIds));
      }

      // 4. Fetch refrigerators and refrigeratorTasks
      const allFridges = await this.db.select().from(refrigerators);
      const todayRefTasks = await this.db
        .select()
        .from(refrigeratorTasks)
        .where(eq(refrigeratorTasks.task_date, activeDateStr));

      // 5. Fetch approved leaves for today
      const todayLeaves = await this.db
        .select()
        .from(employeeLeaves)
        .where(
          and(
            lte(employeeLeaves.start_date, activeDateStr),
            gte(employeeLeaves.end_date, activeDateStr),
            eq(employeeLeaves.status, "approved")
          )
        );

      // Helper for task role title
      const getPositionTitle = (role?: string | null, taskRole?: string | null) => {
        if (taskRole === "manager_assistant") return "ผู้ช่วยผู้จัดการร้าน";
        if (taskRole === "cashier") return "พนักงานแคชเชียร์";
        if (taskRole === "stock") return "พนักงานจัดเรียงสินค้า / สต็อก";
        if (role === "general_manager") return "ผู้จัดการทั่วไป";
        if (role === "committee") return "กรรมการบริหาร";
        if (role === "manager") return "ผู้จัดการร้าน";
        if (role === "manager_assistant") return "ผู้ช่วยผู้จัดการร้าน";
        return "พนักงานประจำสาขา";
      };

      let totalTasksCompany = 0;
      let completedTasksCompany = 0;
      let totalWorkingStaffCompany = 0;
      let totalOnLeaveStaffCompany = 0;
      const totalStaffCompany = allUsers.filter(
        (u: any) => u.branch_id && !["admin", "committee", "general_manager"].includes(u.role)
      ).length;

      const branchSummaries: BranchOperationsSummaryItem[] = allBranches.map((b: any, index: number) => {
        const branchUsers = allUsers.filter((u: any) => u.branch_id === b.id);
        const manager = branchUsers.find((u: any) => u.role === "manager" || u.role === "general_manager");
        const managerName = manager ? manager.name : "กำลังสรรหา";

        const branchCode = /^[A-Z0-9_-]{2,8}$/i.test(b.name)
          ? b.name.toUpperCase()
          : `BR-${String(index + 1).padStart(3, "0")}`;

        const bSessions = todaySessions.filter((s: any) => s.branch === b.id);
        const bSessionIds = new Set(bSessions.map((s: any) => s.id));
        const bWorks = todayWorks.filter((w: any) => bSessionIds.has(w.shift_session));

        const totalTasksToday = bWorks.length;
        const completedTasksToday = bWorks.filter((w: any) => w.timestamp !== null).length;
        const pendingTasksToday = totalTasksToday - completedTasksToday;
        const todayCompletionRate =
          totalTasksToday > 0 ? Math.round((completedTasksToday / totalTasksToday) * 100) : 0;

        totalTasksCompany += totalTasksToday;
        completedTasksCompany += completedTasksToday;

        // Shifts breakdown
        const computeShiftProgress = (shiftType: "morning" | "afternoon" | "night"): BranchShiftProgress => {
          const sShifts = bSessions.filter((s: any) => s.shift === shiftType);
          const sIds = new Set(sShifts.map((s: any) => s.id));
          const sWorks = bWorks.filter((w: any) => sIds.has(w.shift_session));
          const sTotal = sWorks.length;
          const sDone = sWorks.filter((w: any) => w.timestamp !== null).length;
          const sRate = sTotal > 0 ? Math.round((sDone / sTotal) * 100) : 0;
          const sStaffCount = new Set(sShifts.map((s: any) => s.user)).size;

          return {
            shift: shiftType,
            totalTasks: sTotal,
            completedTasks: sDone,
            completionRate: sRate,
            activeStaffCount: sStaffCount,
            sessionsCount: sShifts.length,
          };
        };

        const shifts = {
          morning: computeShiftProgress("morning"),
          afternoon: computeShiftProgress("afternoon"),
          night: computeShiftProgress("night"),
        };

        // Refrigerator compliance
        const bFridges = allFridges.filter((f: any) => f.branch_id === b.id && !f.disable_check);
        const bRefTasks = todayRefTasks.filter((t: any) => t.branch_id === b.id && t.completed);
        const refrigeratorComplianceRate =
          bFridges.length > 0
            ? Math.min(100, Math.round((bRefTasks.length / bFridges.length) * 100))
            : 100;

        // Employees roster
        let workingCount = 0;
        let completedCount = 0;
        let onLeaveCount = 0;
        let offDutyCount = 0;

        const employees: BranchEmployeeStatusItem[] = branchUsers
          .filter((u: any) => u.role !== "admin")
          .map((u: any) => {
            const userSessions = bSessions.filter((s: any) => s.user === u.id);
            const activeSess = userSessions.find((s: any) => s.end === null);
            const completedSess = userSessions.find((s: any) => s.end !== null);
            const userLeave = todayLeaves.find((l: any) => l.user_id === u.id);

            let status: "working" | "completed" | "on_leave" | "off_duty" = "off_duty";
            let activeShift = undefined;
            let shiftSessionId = undefined;
            let shiftStartTime = undefined;
            let shiftEndTime = undefined;

            if (activeSess) {
              status = "working";
              activeShift = activeSess.shift;
              shiftSessionId = activeSess.id;
              shiftStartTime = activeSess.start ? new Date(activeSess.start).toISOString() : undefined;
              workingCount++;
            } else if (completedSess) {
              status = "completed";
              activeShift = completedSess.shift;
              shiftSessionId = completedSess.id;
              shiftStartTime = completedSess.start ? new Date(completedSess.start).toISOString() : undefined;
              shiftEndTime = completedSess.end ? new Date(completedSess.end).toISOString() : undefined;
              completedCount++;
            } else if (userLeave) {
              status = "on_leave";
              onLeaveCount++;
            } else {
              offDutyCount++;
            }

            // Individual works
            const userSessionIds = new Set(userSessions.map((s: any) => s.id));
            const uWorks = bWorks.filter((w: any) => userSessionIds.has(w.shift_session));
            const uTotal = uWorks.length;
            const uDone = uWorks.filter((w: any) => w.timestamp !== null).length;
            const taskCompletionRate = uTotal > 0 ? Math.round((uDone / uTotal) * 100) : 0;

            const position = getPositionTitle(u.role, activeSess?.task_role || completedSess?.task_role);

            return {
              id: u.id,
              name: u.name,
              username: u.username,
              role: u.role,
              position,
              point: u.point ?? 0,
              pointStreak: u.point_streak ?? 0,
              pointStreakType: u.point_streak_type ?? "none",
              status,
              activeShift,
              shiftSessionId,
              shiftStartTime,
              shiftEndTime,
              completedTasksCount: uDone,
              totalTasksCount: uTotal,
              taskCompletionRate,
              leaveInfo: userLeave
                ? {
                    leaveType: userLeave.leave_type,
                    startDate: userLeave.start_date,
                    endDate: userLeave.end_date,
                    reason: userLeave.reason,
                  }
                : undefined,
            };
          });

        // Sort employees: working first, then completed, then on_leave, then off_duty
        employees.sort((a, b) => {
          const order = { working: 0, completed: 1, on_leave: 2, off_duty: 3 };
          if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
          return a.name.localeCompare(b.name, "th");
        });

        totalWorkingStaffCompany += workingCount;
        totalOnLeaveStaffCompany += onLeaveCount;

        let healthStatus: "excellent" | "in_progress" | "needs_attention" = "in_progress";
        if (todayCompletionRate >= 80) {
          healthStatus = "excellent";
        } else if (todayCompletionRate < 40 && (bSessions.length > 0 || branchUsers.length > 0)) {
          healthStatus = "needs_attention";
        }

        return {
          id: b.id,
          code: branchCode,
          name: b.name,
          location: "-",
          managerName,
          staffCount: branchUsers.length,
          status: "active",
          leaveQuota: typeof b.leave_quota === "number" ? b.leave_quota : 3,
          todayCompletionRate,
          totalTasksToday,
          completedTasksToday,
          pendingTasksToday,
          totalRefrigerators: bFridges.length,
          checkedRefrigeratorsToday: bRefTasks.length,
          refrigeratorComplianceRate,
          shifts,
          workingStaffCount: workingCount,
          completedStaffCount: completedCount,
          onLeaveStaffCount: onLeaveCount,
          offDutyStaffCount: offDutyCount,
          healthStatus,
          employees,
        };
      });

      const averageCompletionRate =
        branchSummaries.length > 0
          ? Math.round(branchSummaries.reduce((sum, b) => sum + b.todayCompletionRate, 0) / branchSummaries.length)
          : 0;

      const averageRefrigeratorCompliance =
        branchSummaries.length > 0
          ? Math.round(
              branchSummaries.reduce((sum, b) => sum + b.refrigeratorComplianceRate, 0) / branchSummaries.length
            )
          : 100;

      const reportData: BranchOperationsReportData = {
        summary: {
          totalBranches: allBranches.length,
          activeBranchesCount: branchSummaries.length,
          totalStaff: totalStaffCompany,
          totalWorkingStaff: totalWorkingStaffCompany,
          totalOnLeaveStaff: totalOnLeaveStaffCompany,
          averageCompletionRate,
          totalTasksToday: totalTasksCompany,
          completedTasksToday: completedTasksCompany,
          averageRefrigeratorCompliance,
        },
        branches: branchSummaries,
        generatedAt: new Date().toISOString(),
      };

      return {
        success: true,
        data: reportData,
      };
    } catch (err: unknown) {
      console.error("BranchService.getBranchOperationsReport error:", err);
      return { success: false, error: "เกิดข้อผิดพลาดในการดึงรายงานการปฏิบัติงานสาขา" };
    }
  }
}
