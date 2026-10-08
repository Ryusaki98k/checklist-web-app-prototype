import { eq, or, sql } from "drizzle-orm";
import { users, branches } from "../db/schema";
import { IAuthService } from "./types";
import { User, Role, ActiveRole, ManagerType, ExecutiveType } from "../types";
import { getUserAvailableRoles, canAccessRole, computePrimaryRole } from "../utils/roles";

const INITIAL_USERS: Array<{
  name: string;
  username: string;
  password: string;
  role: 'admin' | 'committee' | 'general_manager' | 'manager' | 'manager_assistant' | 'employee';
  managerType: ManagerType;
  executiveType: ExecutiveType;
  isAdmin: boolean;
  position?: string;
}> = [
  { name: "คุณวิภาดา สุขเจริญ", username: "manager", password: "manager123", role: "manager", managerType: "store", executiveType: "none", isAdmin: false, position: "ผู้จัดการร้าน" },
  { name: "คุณกิตติศักดิ์ พัฒนกิจ", username: "director", password: "director123", role: "committee", managerType: "none", executiveType: "committee", isAdmin: false, position: "กรรมการ" },
  { name: "คุณธนากร เกียรติไพบูลย์", username: "assistant", password: "123", role: "manager_assistant", managerType: "assistant", executiveType: "none", isAdmin: false, position: "ผู้ช่วยผู้จัดการร้าน" },
  { name: "คุณอนุรักษ์ วงศ์สวัสดิ์", username: "manager2", password: "manager123", role: "manager", managerType: "store", executiveType: "none", isAdmin: false, position: "ผู้จัดการร้าน" },
  { name: "คุณพรทิพย์ สุขเจริญ", username: "asst", password: "123", role: "manager_assistant", managerType: "assistant", executiveType: "none", isAdmin: false, position: "ผู้ช่วยผู้จัดการร้าน" },
  { name: "สมศรี ใจดี", username: "cashier", password: "123", role: "employee", managerType: "none", executiveType: "none", isAdmin: false, position: "แคชเชียร์" },
  { name: "สมชาย มั่นคง", username: "stock", password: "123", role: "employee", managerType: "none", executiveType: "none", isAdmin: false, position: "พนักงานสต็อก/จัดเรียง" },
  { name: "กัญญาภัทร พิมพา", username: "kanya", password: "123", role: "employee", managerType: "none", executiveType: "none", isAdmin: false, position: "แคชเชียร์" },
  { name: "ศุภชัย มีสุข", username: "suphachai", password: "123", role: "employee", managerType: "none", executiveType: "none", isAdmin: false, position: "พนักงานทั่วไป" },
  { name: "คุณสมเกียรติ บริหารกิจ", username: "admin", password: "admin123", role: "admin", managerType: "store", executiveType: "executive", isAdmin: true, position: "ผู้ดูแลระบบส่วนกลาง" },
];

export class AuthService implements IAuthService {
  constructor(private db: any, private supabaseServerClient?: any) {}

  async seedUsersIfEmpty(): Promise<void> {
    try {
      const existing = await this.db.select({ id: users.id }).from(users).limit(1);
      if (existing.length === 0) {
        await this.db.insert(users).values(
          INITIAL_USERS.map((u) => ({
            name: u.name,
            username: u.username.toLowerCase(),
            password: u.password,
            role: u.role,
            manager_type: u.managerType,
            executive_type: u.executiveType,
            is_admin: u.isAdmin,
          }))
        );
        console.log("Seeded initial users to database.");
      }
    } catch (err) {
      console.error("seedUsersIfEmpty error:", err);
    }
  }

  async login(
    username: string,
    password: string,
    requestedRole?: Role
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanUsername = (username || "").trim().toLowerCase();
    const cleanPassword = (password || "").trim();

    if (!cleanUsername || !cleanPassword) {
      return { success: false, error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" };
    }

    try {
      // Support login by username
      const result = await this.db
        .select()
        .from(users)
        .where(eq(sql`lower(${users.username})`, cleanUsername))
        .limit(1);

      if (result.length === 0) {
        return { success: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
      }

      const foundUser = result[0];

      if (foundUser.password && foundUser.password !== cleanPassword) {
        return { success: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
      }

      // Update last_login
      await this.db
        .update(users)
        .set({ last_login: new Date() })
        .where(eq(users.id, foundUser.id));

      const managerType: ManagerType = foundUser.manager_type || "none";
      const executiveType: ExecutiveType = foundUser.executive_type || "none";
      const isAdmin: boolean = Boolean(foundUser.is_admin);

      // Determine active role
      let activeRole: ActiveRole;
      if (requestedRole) {
        // Check if user has permission to assume requested role
        const hasAccess = canAccessRole({ managerType, executiveType, isAdmin }, requestedRole);
        if (!hasAccess) {
          return {
            success: false,
            error: `บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานในบทบาทดังกล่าว`,
          };
        }
        activeRole = requestedRole;
      } else {
        // Fallback: pick the highest privilege role
        activeRole = computePrimaryRole(managerType, executiveType, isAdmin);
      }

      let defaultPosition: string | undefined = undefined;
      if (activeRole === "manager") defaultPosition = "ผู้จัดการร้าน";
      else if (activeRole === "committee") defaultPosition = "กรรมการ";
      else if (activeRole === "general_manager") defaultPosition = "ผู้จัดการทั่วไป";
      else if (activeRole === "manager_assistant") defaultPosition = "ผู้ช่วยผู้จัดการร้าน";
      else if (activeRole === "admin") defaultPosition = "ผู้ดูแลระบบส่วนกลาง";

      const branchQuery = foundUser.branch_id
        ? await this.db
            .select({ id: branches.id, name: branches.name })
            .from(branches)
            .where(eq(branches.id, foundUser.branch_id))
            .limit(1)
        : [];

      const branchName = branchQuery.length > 0 ? branchQuery[0].name : undefined;
      const branchId = branchQuery.length > 0 ? branchQuery[0].id : undefined;

      const userObj: User = {
        id: foundUser.id,
        name: foundUser.name,
        username: foundUser.username || foundUser.name,
        profile_id: foundUser.profile_id || null,
        profileId: foundUser.profile_id || null,
        managerType,
        executiveType,
        isAdmin,
        activeRole,
        role: activeRole, // Keeps 100% backward compatibility
        position: defaultPosition,
        branchName,
        branchId,
        point: foundUser.point || 0,
        pointStreak: foundUser.point_streak || 0,
        pointStreakType: foundUser.point_streak_type as any,
        longestStreak: foundUser.longest_streak || 0,
        leaveQuota: typeof foundUser.leave_quota === "number" ? foundUser.leave_quota : null,
      };

      return { success: true, user: userObj };
    } catch (err: any) {
      console.error("AuthService.login error:", err);
      return { success: false, error: "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง" };
    }
  }

  async register(data: {
    name: string;
    username: string;
    password?: string;
    role?: Role;
    managerType?: ManagerType;
    executiveType?: ExecutiveType;
    isAdmin?: boolean;
    position?: string;
    branchId?: string;
    leaveQuota?: number | null;
    profile_id?: string | null;
    profileId?: string | null;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanName = (data.name || "").trim();
    const cleanUsername = (data.username || "").trim().toLowerCase();
    const cleanPassword = data.password ? data.password.trim() : null;
    const profileId = data.profile_id || data.profileId || null;

    if (!cleanName || !cleanUsername) {
      return { success: false, error: "กรุณากรอกชื่อ-นามสกุล และชื่อผู้ใช้ให้ครบถ้วน" };
    }

    // Resolve permissions from either direct fields or legacy role/position
    let managerType: ManagerType = data.managerType || "none";
    let executiveType: ExecutiveType = data.executiveType || "none";
    let isAdmin: boolean = Boolean(data.isAdmin);

    if (data.role) {
      if (data.role === "admin") {
        isAdmin = true;
      } else if (data.role === "manager") {
        if (data.position?.includes("กรรมการ")) executiveType = "committee";
        else if (data.position?.includes("ผู้ช่วย")) managerType = "assistant";
        else managerType = "store";
      } else if (data.role === "manager_assistant") {
        managerType = "assistant";
      } else if (data.role === "committee") {
        executiveType = "committee";
      } else if (data.role === "general_manager") {
        executiveType = "executive";
      }
    }

    const computedRole = computePrimaryRole(managerType, executiveType, isAdmin);

    try {
      const existing = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(sql`lower(${users.username})`, cleanUsername))
        .limit(1);

      if (existing.length > 0) {
        return { success: false, error: "ชื่อผู้ใช้นี้มีผู้อื่นใช้งานแล้วในระบบ กรุณาใช้ชื่ออื่น" };
      }

      const [created] = await this.db
        .insert(users)
        .values({
          name: cleanName,
          username: cleanUsername,
          password: cleanPassword,
          profile_id: profileId,
          manager_type: managerType,
          executive_type: executiveType,
          is_admin: isAdmin,
          branch_id: data.branchId || null,
          leave_quota: typeof data.leaveQuota === "number" ? Math.max(0, Math.floor(data.leaveQuota)) : null,
          last_login: new Date(),
        })
        .returning();

      let assignedBranchName: string | undefined = undefined;
      if (data.branchId) {
        const targetBranch = await this.db
          .select({ name: branches.name })
          .from(branches)
          .where(eq(branches.id, data.branchId))
          .limit(1);

        if (targetBranch.length > 0) {
          assignedBranchName = targetBranch[0].name;
        }
      }

      const isManagement = managerType !== "none" || executiveType !== "none" || isAdmin;

      const userObj: User = {
        id: created.id,
        name: created.name,
        username: created.username,
        profile_id: created.profile_id || null,
        profileId: created.profile_id || null,
        managerType,
        executiveType,
        isAdmin,
        activeRole: computedRole,
        role: computedRole,
        position: isManagement ? data.position ?? (managerType === "assistant" ? "ผู้ช่วยผู้จัดการร้าน" : "ผู้จัดการร้าน") : undefined,
        branchName: assignedBranchName,
        branchId: data.branchId,
        point: 0,
        pointStreak: 0,
        pointStreakType: "none",
        longestStreak: 0,
        leaveQuota: typeof created.leave_quota === "number" ? created.leave_quota : null,
      };

      return { success: true, user: userObj };
    } catch (err: any) {
      console.error("AuthService.register error:", err);
      return { success: false, error: "เกิดข้อผิดพลาดในการบันทึกข้อมูลลงฐานข้อมูล" };
    }
  }

  async getUserById(id: string): Promise<{ success: boolean; user?: User; error?: string }> {
    if (!id) return { success: false, error: "ไม่มีรหัสผู้ใช้งาน" };

    try {
      const result = await this.db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (result.length === 0) {
        return { success: false, error: "ไม่พบผู้ใช้งาน" };
      }

      const foundUser = result[0];
      const managerType: ManagerType = foundUser.manager_type || "none";
      const executiveType: ExecutiveType = foundUser.executive_type || "none";
      const isAdmin: boolean = Boolean(foundUser.is_admin);
      const computedRole = computePrimaryRole(managerType, executiveType, isAdmin);
      const effectiveRole: ActiveRole = computedRole;

      let defaultPosition: string | undefined = undefined;
      if (effectiveRole === "manager") defaultPosition = "ผู้จัดการร้าน";
      else if (effectiveRole === "committee") defaultPosition = "กรรมการ";
      else if (effectiveRole === "general_manager") defaultPosition = "ผู้จัดการทั่วไป";
      else if (effectiveRole === "manager_assistant") defaultPosition = "ผู้ช่วยผู้จัดการร้าน";
      else if (effectiveRole === "admin") defaultPosition = "ผู้ดูแลระบบส่วนกลาง";

      const branchQuery = foundUser.branch_id
        ? await this.db
            .select({ id: branches.id, name: branches.name })
            .from(branches)
            .where(eq(branches.id, foundUser.branch_id))
            .limit(1)
        : [];

      const branchName = branchQuery.length > 0 ? branchQuery[0].name : undefined;
      const branchId = branchQuery.length > 0 ? branchQuery[0].id : undefined;

      const userObj: User = {
        id: foundUser.id,
        name: foundUser.name,
        username: foundUser.username || foundUser.name,
        profile_id: foundUser.profile_id || null,
        profileId: foundUser.profile_id || null,
        managerType,
        executiveType,
        isAdmin,
        activeRole: effectiveRole,
        role: effectiveRole,
        position: defaultPosition,
        branchName,
        branchId,
        point: foundUser.point || 0,
        pointStreak: foundUser.point_streak || 0,
        pointStreakType: foundUser.point_streak_type as any,
        longestStreak: foundUser.longest_streak || 0,
        leaveQuota: typeof foundUser.leave_quota === "number" ? foundUser.leave_quota : null,
      };

      return { success: true, user: userObj };
    } catch (err: any) {
      console.error("AuthService.getUserById error:", err);
      return { success: false, error: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้งาน" };
    }
  }

  async getAllUsers(): Promise<{ success: boolean; users?: User[]; error?: string }> {
    try {
      const allUsers = await this.db.select().from(users);
      const allBranches = await this.db.select().from(branches);

      const formatted: User[] = allUsers.map((u: any) => {
        const managerType: ManagerType = u.manager_type || "none";
        const executiveType: ExecutiveType = u.executive_type || "none";
        const isAdmin: boolean = Boolean(u.is_admin);
        const computedRole = computePrimaryRole(managerType, executiveType, isAdmin);
        const effectiveRole: ActiveRole = computedRole;

        let defaultPosition: string | undefined = undefined;
        if (effectiveRole === "manager") defaultPosition = "ผู้จัดการร้าน";
        else if (effectiveRole === "committee") defaultPosition = "กรรมการ";
        else if (effectiveRole === "general_manager") defaultPosition = "ผู้จัดการทั่วไป";
        else if (effectiveRole === "manager_assistant") defaultPosition = "ผู้ช่วยผู้จัดการร้าน";
        else if (effectiveRole === "admin") defaultPosition = "ผู้ดูแลระบบส่วนกลาง";

        const userBranch = allBranches.find((b: any) => b.id === u.branch_id);

        return {
          id: u.id,
          name: u.name,
          username: u.username || u.name,
          profile_id: u.profile_id || null,
          profileId: u.profile_id || null,
          password: u.password || undefined,
          managerType,
          executiveType,
          isAdmin,
          activeRole: effectiveRole,
          role: effectiveRole,
          position: defaultPosition,
          branchName: userBranch ? userBranch.name : undefined,
          branchId: userBranch ? userBranch.id : undefined,
          point: u.point || 0,
          pointStreak: u.point_streak || 0,
          pointStreakType: u.point_streak_type as any,
          longestStreak: u.longest_streak || 0,
          leaveQuota: typeof u.leave_quota === "number" ? u.leave_quota : null,
        };
      });

      return { success: true, users: formatted };
    } catch (err: any) {
      console.error("AuthService.getAllUsers error:", err);
      return { success: false, error: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้งาน" };
    }
  }

  async syncOAuthUser(userData: {
    id: string;
    username?: string;
    name?: string;
    role?: Role;
    managerType?: ManagerType;
    executiveType?: ExecutiveType;
    isAdmin?: boolean;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const cleanUsername = (userData.username || `user_${userData.id.substring(0, 6)}`).trim().toLowerCase();
      const displayName = userData.name || cleanUsername || "ผู้ใช้งาน";

      // 1. Check if user with this id or username already exists
      const [existing] = await this.db
        .select()
        .from(users)
        .where(
          or(
            eq(users.id, userData.id),
            eq(sql`lower(${users.username})`, cleanUsername)
          )
        )
        .limit(1);

      if (existing) {
        // Update last_login
        await this.db
          .update(users)
          .set({ last_login: new Date() })
          .where(eq(users.id, existing.id));

        return this.getUserById(existing.id);
      }

      const managerType: ManagerType = userData.managerType || "none";
      const executiveType: ExecutiveType = userData.executiveType || "none";
      const isAdmin: boolean = Boolean(userData.isAdmin);
      const computedRole = computePrimaryRole(managerType, executiveType, isAdmin);

      // 2. Insert new OAuth user with the Supabase auth ID
      const [created] = await this.db
        .insert(users)
        .values({
          id: userData.id,
          name: displayName,
          username: cleanUsername,
          password: null,
          manager_type: managerType,
          executive_type: executiveType,
          is_admin: isAdmin,
          last_login: new Date(),
        })
        .returning();

      return this.getUserById(created.id);
    } catch (err: any) {
      console.error("AuthService.syncOAuthUser error:", err);
      return { success: false, error: err?.message || "Failed to sync OAuth user" };
    }
  }

  async updateUserRole(userId: string, role: Role): Promise<{ success: boolean; error?: string }> {
    try {
      if (!userId) return { success: false, error: "ไม่พบรหัสผู้ใช้" };
      const validRoles: Role[] = ["admin", "committee", "general_manager", "manager", "manager_assistant", "employee"];
      if (!validRoles.includes(role)) {
        return { success: false, error: "บทบาทไม่ถูกต้อง" };
      }

      // Convert legacy role selection to new granular fields
      let managerType: ManagerType = "none";
      let executiveType: ExecutiveType = "none";
      let isAdmin = false;

      if (role === "admin") {
        isAdmin = true;
      } else if (role === "manager") {
        managerType = "store";
      } else if (role === "manager_assistant") {
        managerType = "assistant";
      } else if (role === "general_manager") {
        executiveType = "executive";
      } else if (role === "committee") {
        executiveType = "committee";
      }

      await this.db
        .update(users)
        .set({
          manager_type: managerType,
          executive_type: executiveType,
          is_admin: isAdmin,
        })
        .where(eq(users.id, userId));

      return { success: true };
    } catch (err: unknown) {
      console.error("AuthService.updateUserRole error:", err);
      return { success: false, error: "ไม่สามารถปรับปรุงสิทธิ์ของผู้ใช้ในฐานข้อมูลได้" };
    }
  }

  async updateUserPermissions(
    userId: string,
    permissions: {
      managerType?: ManagerType;
      executiveType?: ExecutiveType;
      isAdmin?: boolean;
      role?: Role;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!userId) return { success: false, error: "ไม่พบรหัสผู้ใช้" };

      const updateData: any = {};
      if (permissions.managerType !== undefined) updateData.manager_type = permissions.managerType;
      if (permissions.executiveType !== undefined) updateData.executive_type = permissions.executiveType;
      if (permissions.isAdmin !== undefined) updateData.is_admin = permissions.isAdmin;

      await this.db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId));

      return { success: true };
    } catch (err: any) {
      console.error("AuthService.updateUserPermissions error:", err);
      return { success: false, error: "ไม่สามารถปรับปรุงสิทธิ์ของผู้ใช้ในฐานข้อมูลได้" };
    }
  }

  async updateUserProfile(params: {
    userId: string;
    name?: string;
    profile_id?: string | null;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      if (!params.userId) return { success: false, error: "ไม่พบรหัสผู้ใช้" };

      const updateData: any = {};
      if (params.name !== undefined && params.name.trim() !== "") {
        updateData.name = params.name.trim();
      }
      if (params.profile_id !== undefined) {
        updateData.profile_id = params.profile_id;
      }

      if (Object.keys(updateData).length === 0) {
        return { success: false, error: "ไม่มีข้อมูลที่ต้องเปลี่ยนแปลง" };
      }

      await this.db
        .update(users)
        .set(updateData)
        .where(eq(users.id, params.userId));

      return this.getUserById(params.userId);
    } catch (err: any) {
      console.error("AuthService.updateUserProfile error:", err);
      return { success: false, error: "ไม่สามารถบันทึกข้อมูลโปรไฟล์ได้" };
    }
  }
}
