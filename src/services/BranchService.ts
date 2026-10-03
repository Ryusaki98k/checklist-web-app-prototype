import { eq, sql } from "drizzle-orm";
import { branches, users } from "../db/schema";
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

      let maxBranchUpdate: Date | null = null;

      const formattedBranches: DashboardBranch[] = allBranches.map((b: any, index: number) => {
        if (b.last_update) {
          const dt = new Date(b.last_update);
          if (!maxBranchUpdate || dt.getTime() > maxBranchUpdate.getTime()) {
            maxBranchUpdate = dt;
          }
        }

        const branchUsers = allUsers.filter((u: any) => b.members.includes(u.id));
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
          members: b.members || [],
          tasks: b.tasks || [],
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
        members: [],
        tasks: [],
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
      await this.db
        .update(branches)
        .set({
          members: userIds,
          last_update: new Date(),
        })
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

      await this.db
        .update(branches)
        .set({
          tasks: taskIds,
          last_update: new Date(),
        })
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
