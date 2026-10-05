import { eq, sql, and, inArray, notInArray } from "drizzle-orm";
import { branches, users, branchTasks } from "../db/schema";
import { IBranchService } from "./types";

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
}
