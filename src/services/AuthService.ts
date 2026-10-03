import { eq, or, sql } from "drizzle-orm";
import { users, branches } from "../db/schema";
import { IAuthService } from "./types";
import { User, Role } from "../types";

const INITIAL_USERS: Array<{
  name: string;
  username: string;
  password: string;
  role: 'admin' | 'committee' | 'general_manager' | 'manager' | 'manager_assistant' | 'employee';
  position?: string;
}> = [
  { name: "คุณวิภาดา สุขเจริญ", username: "manager", password: "manager123", role: "manager", position: "ผู้จัดการร้าน" },
  { name: "คุณกิตติศักดิ์ พัฒนกิจ", username: "director", password: "director123", role: "committee", position: "กรรมการ" },
  { name: "คุณธนากร เกียรติไพบูลย์", username: "assistant", password: "123", role: "manager_assistant", position: "ผู้ช่วยผู้จัดการร้าน" },
  { name: "คุณอนุรักษ์ วงศ์สวัสดิ์", username: "manager2", password: "manager123", role: "manager", position: "ผู้จัดการร้าน" },
  { name: "คุณพรทิพย์ สุขเจริญ", username: "asst", password: "123", role: "manager_assistant", position: "ผู้ช่วยผู้จัดการร้าน" },
  { name: "สมศรี ใจดี", username: "cashier", password: "123", role: "employee", position: "แคชเชียร์" },
  { name: "สมชาย มั่นคง", username: "stock", password: "123", role: "employee", position: "พนักงานสต็อก/จัดเรียง" },
  { name: "กัญญาภัทร พิมพา", username: "kanya", password: "123", role: "employee", position: "แคชเชียร์" },
  { name: "ศุภชัย มีสุข", username: "suphachai", password: "123", role: "employee", position: "พนักงานทั่วไป" },
  { name: "คุณสมเกียรติ บริหารกิจ", username: "admin", password: "admin123", role: "admin", position: "ผู้ดูแลระบบส่วนกลาง" },
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
          }))
        );
        console.log("Seeded initial users to database.");
      }
    } catch (err) {
      console.error("seedUsersIfEmpty error:", err);
    }
  }

  async login(username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanUsername = (username || "").trim().toLowerCase();
    const cleanPassword = (password || "").trim();

    if (!cleanUsername || !cleanPassword) {
      return { success: false, error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" };
    }

    try {
      await this.seedUsersIfEmpty();

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

      let defaultPosition: string | undefined = undefined;
      if (foundUser.role === "manager") defaultPosition = "ผู้จัดการร้าน";
      else if (foundUser.role === "committee") defaultPosition = "กรรมการ";
      else if (foundUser.role === "manager_assistant") defaultPosition = "ผู้ช่วยผู้จัดการร้าน";
      else if (foundUser.role === "admin") defaultPosition = "ผู้ดูแลระบบส่วนกลาง";

      const branchQuery = await this.db
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(sql`${foundUser.id} = ANY(${branches.members})`)
        .limit(1);

      const branchName = branchQuery.length > 0 ? branchQuery[0].name : undefined;
      const branchId = branchQuery.length > 0 ? branchQuery[0].id : undefined;

      const userObj: User = {
        id: foundUser.id,
        name: foundUser.name,
        username: foundUser.username || foundUser.name,
        role: foundUser.role as Role,
        position: defaultPosition,
        branchName,
        branchId,
        point: foundUser.point || 0,
        pointStreak: foundUser.point_streak || 0,
        pointStreakType: foundUser.point_streak_type as any,
        longestStreak: foundUser.longest_streak || 0,
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
    position?: string;
    branchId?: string;
    leaveQuota?: number | null;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanName = (data.name || "").trim();
    const cleanUsername = (data.username || "").trim().toLowerCase();
    const cleanPassword = data.password ? data.password.trim() : null;

    let dbRole: Role = "employee";
    if (data.role === "manager") {
      if (data.position?.includes("กรรมการ")) dbRole = "committee";
      else if (data.position?.includes("ผู้ช่วย")) dbRole = "manager_assistant";
      else dbRole = "manager";
    } else if (data.role) {
      dbRole = data.role;
    }

    if (!cleanName || !cleanUsername) {
      return { success: false, error: "กรุณากรอกชื่อ-นามสกุล และชื่อผู้ใช้ให้ครบถ้วน" };
    }

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
          role: dbRole as any,
          leave_quota: typeof data.leaveQuota === "number" ? Math.max(0, Math.floor(data.leaveQuota)) : null,
          last_login: new Date(),
        })
        .returning();

      let assignedBranchName: string | undefined = undefined;
      if (data.branchId) {
        const targetBranch = await this.db
          .select()
          .from(branches)
          .where(eq(branches.id, data.branchId))
          .limit(1);

        if (targetBranch.length > 0) {
          assignedBranchName = targetBranch[0].name;
          const currentMembers = targetBranch[0].members || [];
          await this.db
            .update(branches)
            .set({
              members: [...currentMembers, created.id],
              last_update: new Date(),
            })
            .where(eq(branches.id, data.branchId));
        }
      }

      const isManagement = ["admin", "committee", "general_manager", "manager", "manager_assistant"].includes(
        created.role
      );

      const userObj: User = {
        id: created.id,
        name: created.name,
        username: created.username,
        role: created.role as Role,
        position: isManagement ? data.position ?? "ผู้จัดการร้าน" : undefined,
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

      let defaultPosition: string | undefined = undefined;
      if (foundUser.role === "manager") defaultPosition = "ผู้จัดการร้าน";
      else if (foundUser.role === "committee") defaultPosition = "กรรมการ";
      else if (foundUser.role === "manager_assistant") defaultPosition = "ผู้ช่วยผู้จัดการร้าน";
      else if (foundUser.role === "admin") defaultPosition = "ผู้ดูแลระบบส่วนกลาง";

      const branchQuery = await this.db
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(sql`${foundUser.id} = ANY(${branches.members})`)
        .limit(1);

      const branchName = branchQuery.length > 0 ? branchQuery[0].name : undefined;
      const branchId = branchQuery.length > 0 ? branchQuery[0].id : undefined;

      const userObj: User = {
        id: foundUser.id,
        name: foundUser.name,
        username: foundUser.username || foundUser.name,
        role: foundUser.role as Role,
        position: defaultPosition,
        branchName,
        branchId,
        point: foundUser.point || 0,
        pointStreak: foundUser.point_streak || 0,
        pointStreakType: foundUser.point_streak_type as any,
        longestStreak: foundUser.longest_streak || 0,
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
        let defaultPosition: string | undefined = undefined;
        if (u.role === "manager") defaultPosition = "ผู้จัดการร้าน";
        else if (u.role === "committee") defaultPosition = "กรรมการ";
        else if (u.role === "manager_assistant") defaultPosition = "ผู้ช่วยผู้จัดการร้าน";
        else if (u.role === "admin") defaultPosition = "ผู้ดูแลระบบส่วนกลาง";

        const userBranch = allBranches.find(
          (b: any) => Array.isArray(b.members) && b.members.includes(u.id)
        );

        return {
          id: u.id,
          name: u.name,
          username: u.username || u.name,
          password: u.password || undefined,
          role: u.role as Role,
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

      // 2. Insert new OAuth user with the Supabase auth ID
      const [created] = await this.db
        .insert(users)
        .values({
          id: userData.id,
          name: displayName,
          username: cleanUsername,
          password: null,
          role: (userData.role as any) || "employee",
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

      await this.db
        .update(users)
        .set({ role: role as any })
        .where(eq(users.id, userId));

      return { success: true };
    } catch (err: unknown) {
      console.error("AuthService.updateUserRole error:", err);
      return { success: false, error: "ไม่สามารถปรับปรุงสิทธิ์ของผู้ใช้ในฐานข้อมูลได้" };
    }
  }
}
