import { eq, and, gte, lte, lt, desc, inArray, sql } from "drizzle-orm";
import { tasks, taskWork, shiftSession, users, branches, employeeLeaves, pointTransactions } from "../db/schema";
import { IManagerService, IPointService, INotificationService, BranchEmployeeStatus } from "./types";
import { ShiftType, Role, LeaveType, EmployeeLeave, LeaveQuotaInfo } from "../types";
import { isPaidLeave } from "../utils/leave";

export interface ManagerShiftSummary {
  id: string;
  userId: string;
  userName: string;
  userPosition?: string;
  taskRole?: "cashier" | "stock" | "manager_assistant";
  shift: ShiftType;
  startedAt: string;
  completedAt: string | null;
  totalItems: number;
  doneItems: number;
  isAllDone: boolean;
  assistantApproved: boolean;
  managerApproved: boolean;
  assistantApproveTime?: string | null;
  managerApproveTime?: string | null;
  items: Array<{
    id: string;
    label: string;
    category?: string;
    completedAt: string | null;
    taskWorkId?: string;
    assistantApproved: boolean;
    managerApproved: boolean;
    isLate?: boolean;
    comment?: string | null;
  }>;
  branchName?: string;
  incompleteReason?: string | null;
  incompleteStatus?: "none" | "pending_review" | "reviewed";
  incompleteAction?: string | null;
  incompleteActionPoints?: number;
  incompleteActionNote?: string | null;
  incompleteReviewedBy?: string | null;
  incompleteReviewedAt?: string | null;
}

function mapDbShiftToUi(dbShift: "morning" | "afternoon" | "morning_afternoon"): ShiftType {
  if (dbShift === "morning") return "morning";
  if (dbShift === "afternoon") return "afternoon";
  return "both";
}

function mapTaskRoleToTitle(role: "cashier" | "stock" | "manager_assistant"): string {
  if (role === "cashier") return "แคชเชียร์";
  if (role === "stock") return "พนักงานสต็อก/จัดเรียง";
  return "ผู้ช่วยผู้จัดการร้าน";
}

function getThaiStartAndEndOfDay(baseDate = new Date()) {
  const yElement = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(baseDate);
  const mElement = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", month: "2-digit" }).format(baseDate);
  const dElement = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", day: "2-digit" }).format(baseDate);

  const startStr = `${yElement}-${mElement}-${dElement}T00:00:00+07:00`;
  const endStr = `${yElement}-${mElement}-${dElement}T23:59:59.999+07:00`;

  return {
    startOfDay: new Date(startStr),
    endOfDay: new Date(endStr),
  };
}

export class ManagerService implements IManagerService {
  constructor(
    private db: any,
    private pointService?: IPointService,
    private notificationService?: INotificationService
  ) {}

  async getManagerShiftSessions(filterDate?: string): Promise<{
    success: boolean;
    sessions?: ManagerShiftSummary[];
    hasAssistantLoggedInToday?: boolean;
    error?: string;
  }> {
    try {
      const today = filterDate ? new Date(filterDate) : new Date();
      const { startOfDay, endOfDay } = getThaiStartAndEndOfDay(today);

      const dbSessions = await this.db
        .select()
        .from(shiftSession)
        .where(and(gte(shiftSession.start, startOfDay), lte(shiftSession.start, endOfDay)))
        .orderBy(desc(shiftSession.start));

      const [assistantLoggedIn] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.role, "manager_assistant"),
            gte(users.last_login, startOfDay),
            lte(users.last_login, endOfDay)
          )
        )
        .limit(1);

      const hasAssistantLoggedInToday = !!assistantLoggedIn;

      if (dbSessions.length === 0) {
        return { success: true, sessions: [], hasAssistantLoggedInToday };
      }

      const sessionIds = dbSessions.map((s: any) => s.id) as string[];
      const userIds = Array.from(new Set(dbSessions.map((s: any) => s.user))) as string[];

      const dbUsers =
        userIds.length > 0
          ? await this.db.select().from(users).where(inArray(users.id, userIds))
          : [];

      const dbWorks =
        sessionIds.length > 0
          ? await this.db
              .select()
              .from(taskWork)
              .where(inArray(taskWork.shift_session, sessionIds))
          : [];

      const taskIds = Array.from(new Set(dbWorks.map((w: any) => w.task))) as string[];
      const allTasks =
        taskIds.length > 0
          ? await this.db.select().from(tasks).where(inArray(tasks.id, taskIds))
          : [];

      const branchIds = Array.from(new Set(dbSessions.map((s: any) => s.branch).filter(Boolean))) as string[];
      const dbBranches =
        branchIds.length > 0
          ? await this.db.select({ id: branches.id, name: branches.name }).from(branches).where(inArray(branches.id, branchIds))
          : [];

      const summaries: ManagerShiftSummary[] = dbSessions.map((sess: any) => {
        const user = dbUsers.find((u: any) => u.id === sess.user);
        const sessionWorks = dbWorks.filter((w: any) => w.shift_session === sess.id);

        const managerApproved = sess.manager_approve_timestamp !== null;
        const assistantApproved =
          managerApproved || sess.manager_assistance_approve_timestamp !== null;

        const items = sessionWorks.map((work: any) => {
          const t = allTasks.find((item: any) => item.id === work.task);
          const timeRange = t?.start && t?.end ? `${t.start.slice(0, 5)} - ${t.end.slice(0, 5)}` : undefined;
          let isLate = false;

          if (work.timestamp && t?.end) {
            const completedDate = new Date(work.timestamp);
            const [endHour, endMinute] = t.end.split(":").map(Number);
            const deadlineDate = new Date(sess.start);
            deadlineDate.setHours(endHour, endMinute, 0, 0);

            if (completedDate > deadlineDate) {
              isLate = true;
            }
          }

          return {
            id: work.task,
            label: t ? t.name : "รายการงาน",
            category: timeRange ? `ช่วงเวลา ${timeRange}` : undefined,
            completedAt: work.timestamp ? new Date(work.timestamp).toISOString() : null,
            taskWorkId: work.id,
            assistantApproved,
            managerApproved,
            isLate,
            comment: work.comment ?? null,
          };
        });

        const totalItems = items.length;
        const doneItems = items.filter((i: any) => i.completedAt !== null).length;
        const isAllDone = totalItems > 0 && doneItems === totalItems;

        return {
          id: sess.id,
          userId: sess.user,
          userName: user ? user.name : "พนักงานสาขา",
          userPosition: mapTaskRoleToTitle(sess.task_role),
          taskRole: sess.task_role,
          shift: mapDbShiftToUi(sess.shift),
          startedAt: new Date(sess.start).toISOString(),
          completedAt: sess.end ? new Date(sess.end).toISOString() : null,
          totalItems,
          doneItems,
          isAllDone,
          assistantApproved,
          managerApproved,
          assistantApproveTime: sess.manager_assistance_approve_timestamp
            ? new Date(sess.manager_assistance_approve_timestamp).toISOString()
            : null,
          managerApproveTime: sess.manager_approve_timestamp
            ? new Date(sess.manager_approve_timestamp).toISOString()
            : null,
          items,
          branchName: dbBranches.find((b: any) => b.id === sess.branch)?.name,
          incompleteReason: sess.incomplete_reason || null,
          incompleteStatus: (sess.incomplete_status as any) || "none",
          incompleteAction: sess.incomplete_action || null,
          incompleteActionPoints: sess.incomplete_action_points || 0,
          incompleteActionNote: sess.incomplete_action_note || null,
          incompleteReviewedBy: sess.incomplete_reviewed_by || null,
          incompleteReviewedAt: sess.incomplete_reviewed_at
            ? new Date(sess.incomplete_reviewed_at).toISOString()
            : null,
        };
      });

      return { success: true, sessions: summaries, hasAssistantLoggedInToday };
    } catch (err: any) {
      console.error("ManagerService.getManagerShiftSessions error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการดึงข้อมูลสำหรับผู้จัดการ" };
    }
  }

  async getHistoryShiftSessions(
    daysOffset: number = 14,
    specificDate?: string
  ): Promise<{
    success: boolean;
    sessions?: ManagerShiftSummary[];
    error?: string;
  }> {
    try {
      const today = new Date();
      const { endOfDay: todayEndOfDay } = getThaiStartAndEndOfDay(today);

      let queryStart: Date;
      let queryEnd: Date;

      if (specificDate) {
        const targetDate = new Date(specificDate);
        const bounds = getThaiStartAndEndOfDay(targetDate);
        queryStart = bounds.startOfDay;
        queryEnd = bounds.endOfDay;
      } else {
        const boundaryDate = new Date(today.getTime());
        boundaryDate.setDate(boundaryDate.getDate() - daysOffset);
        const { startOfDay: startOfBoundary } = getThaiStartAndEndOfDay(boundaryDate);
        queryStart = startOfBoundary;
        queryEnd = todayEndOfDay;
      }

      const dbSessions = await this.db
        .select()
        .from(shiftSession)
        .where(and(gte(shiftSession.start, queryStart), lte(shiftSession.start, queryEnd)))
        .orderBy(desc(shiftSession.start));

      const dbUsers = await this.db.select({ id: users.id, name: users.name }).from(users);

      const historySessionIds = dbSessions.map((s: any) => s.id) as string[];
      const dbWorks =
        historySessionIds.length > 0
          ? await this.db
              .select()
              .from(taskWork)
              .where(inArray(taskWork.shift_session, historySessionIds))
          : [];

      const taskIds = Array.from(new Set(dbWorks.map((w: any) => w.task))) as string[];
      const allTasks =
        taskIds.length > 0
          ? await this.db.select().from(tasks).where(inArray(tasks.id, taskIds))
          : [];

      const branchIds = Array.from(new Set(dbSessions.map((s: any) => s.branch).filter(Boolean))) as string[];
      const dbBranches =
        branchIds.length > 0
          ? await this.db.select({ id: branches.id, name: branches.name }).from(branches).where(inArray(branches.id, branchIds))
          : [];

      const summaries: ManagerShiftSummary[] = dbSessions.map((sess: any) => {
        const user = dbUsers.find((u: any) => u.id === sess.user);
        const sessionWorks = dbWorks.filter((w: any) => w.shift_session === sess.id);

        const items = sessionWorks.map((work: any) => {
          const t = allTasks.find((item: any) => item.id === work.task);
          const timeRange = t?.start && t?.end ? `${t.start.slice(0, 5)} - ${t.end.slice(0, 5)}` : undefined;
          let isLate = false;

          if (work.timestamp && t?.end) {
            const completedDate = new Date(work.timestamp);
            const [endHour, endMinute] = t.end.split(":").map(Number);
            const deadlineDate = new Date(sess.start);
            deadlineDate.setHours(endHour, endMinute, 0, 0);

            if (completedDate > deadlineDate) {
              isLate = true;
            }
          }

          return {
            id: work.task,
            label: t ? t.name : "รายการงาน",
            category: timeRange ? `ช่วงเวลา ${timeRange}` : undefined,
            completedAt: work.timestamp ? new Date(work.timestamp).toISOString() : null,
            taskWorkId: work.id,
            assistantApproved: work.manager_assistance_approve_timestamp !== null,
            managerApproved: work.manager_approve_timestamp !== null,
            isLate,
            comment: work.comment ?? null,
          };
        });

        const totalItems = items.length;
        const doneItems = items.filter((i: any) => i.completedAt !== null).length;
        const isAllDone = totalItems > 0 && doneItems === totalItems;

        const managerApproved = sess.manager_approve_timestamp !== null;
        const assistantApproved =
          managerApproved || sess.manager_assistance_approve_timestamp !== null;

        return {
          id: sess.id,
          userId: sess.user,
          userName: user ? user.name : "พนักงานสาขา",
          userPosition: mapTaskRoleToTitle(sess.task_role),
          taskRole: sess.task_role,
          shift: mapDbShiftToUi(sess.shift),
          startedAt: new Date(sess.start).toISOString(),
          completedAt: sess.end ? new Date(sess.end).toISOString() : null,
          totalItems,
          doneItems,
          isAllDone,
          assistantApproved,
          managerApproved,
          assistantApproveTime: sess.manager_assistance_approve_timestamp
            ? new Date(sess.manager_assistance_approve_timestamp).toISOString()
            : null,
          managerApproveTime: sess.manager_approve_timestamp
            ? new Date(sess.manager_approve_timestamp).toISOString()
            : null,
          items,
          branchName: dbBranches.find((b: any) => b.id === sess.branch)?.name,
          incompleteReason: sess.incomplete_reason || null,
          incompleteStatus: (sess.incomplete_status as any) || "none",
          incompleteAction: sess.incomplete_action || null,
          incompleteActionPoints: sess.incomplete_action_points || 0,
          incompleteActionNote: sess.incomplete_action_note || null,
          incompleteReviewedBy: sess.incomplete_reviewed_by || null,
          incompleteReviewedAt: sess.incomplete_reviewed_at
            ? new Date(sess.incomplete_reviewed_at).toISOString()
            : null,
        };
      });

      return { success: true, sessions: summaries };
    } catch (err: any) {
      console.error("ManagerService.getHistoryShiftSessions error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการดึงข้อมูลประวัติ" };
    }
  }

  async approveShiftSession(params: {
    shiftSessionId: string;
    role: "manager" | "manager_assistant" | "committee" | "general_manager" | Role;
    isException?: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { shiftSessionId, role, isException } = params;

      const [targetSession] = await this.db
        .select({
          task_role: shiftSession.task_role,
          start: shiftSession.start,
          user: shiftSession.user,
          branch: shiftSession.branch,
          manager_assistance_approve_timestamp: shiftSession.manager_assistance_approve_timestamp,
          manager_approve_timestamp: shiftSession.manager_approve_timestamp,
        })
        .from(shiftSession)
        .where(eq(shiftSession.id, shiftSessionId))
        .limit(1);

      if (!targetSession) {
        return { success: false, error: "ไม่พบข้อมูลกะนี้" };
      }

      if (targetSession.task_role === "manager_assistant" && role === "manager_assistant") {
        return {
          success: false,
          error: "ผู้ที่จะอนุมัติงานของผู้ช่วยผู้จัดการร้านได้จะต้องเป็นตำแหน่งผู้จัดการร้าน (Manager) หรือสูงกว่าเท่านั้น",
        };
      }

      const wasFullyApproved = targetSession.manager_approve_timestamp !== null;
      const now = new Date();

      if (role === "manager_assistant") {
        await this.db
          .update(shiftSession)
          .set({ manager_assistance_approve_timestamp: now })
          .where(eq(shiftSession.id, shiftSessionId));
      } else {
        // Manager or higher approval: approve manager level, and also fulfill assistant approval if missing
        const assistantTimestamp = targetSession.manager_assistance_approve_timestamp || now;
        await this.db
          .update(shiftSession)
          .set({
            manager_approve_timestamp: now,
            manager_assistance_approve_timestamp: assistantTimestamp,
          })
          .where(eq(shiftSession.id, shiftSessionId));
      }

      const isNowFullyApproved = role !== "manager_assistant";

      // Transition to fully approved -> Trigger PointService to award points and streak!
      if (!wasFullyApproved && isNowFullyApproved && this.pointService) {
        await this.pointService.evaluateShiftSession(shiftSessionId, Boolean(isException));
      }

      // Notify employee and manager about approval
      if (this.notificationService && targetSession.user) {
        const [empUser] = await this.db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, targetSession.user))
          .limit(1);

        const empName = empUser?.name || "พนักงาน";
        const roleLabel = role === "manager_assistant" ? "ผู้ช่วยผู้จัดการร้าน" : "ผู้จัดการร้าน";

        const empTitle = isNowFullyApproved
          ? isException
            ? "🛡️ กะงานได้รับการอนุมัติแบบอนุโลม (Exception)"
            : "🏆 กะงานได้รับการอนุมัติสมบูรณ์"
          : isException
            ? `📝 ${roleLabel}ตรวจรับรองงานแล้ว (เสนอแบบอนุโลม)`
            : `📝 ${roleLabel}ตรวจรับรองงานแล้ว`;

        const empMsg = isNowFullyApproved
          ? isException
            ? "ผู้จัดการร้านได้อนุมัติการปฏิบัติงานกะของคุณแบบอนุโลม (รักษาคะแนนสตรีคต่อเนื่องเป็นสถานะ Flawed) เรียบร้อยแล้ว!"
            : "ผู้จัดการร้านได้อนุมัติการปฏิบัติงานกะของคุณเรียบร้อยแล้ว!"
          : `${roleLabel}ได้ตรวจสอบรายการงานกะของคุณแล้ว และบันทึกผลการรับรอง`;

        // 1. Notify Employee
        await this.notificationService.createNotification({
          recipientId: targetSession.user,
          title: empTitle,
          message: empMsg,
          type: "shift_approved",
          shiftSessionId: shiftSessionId,
          branchId: targetSession.branch,
        });

        // 2. If Assistant Manager approved, notify the Store Manager
        if (role === "manager_assistant") {
          await this.notificationService.createNotification({
            branchId: targetSession.branch,
            recipientRole: "manager",
            title: `📋 ผู้ช่วยผู้จัดการตรวจรับรองงานแล้ว${isException ? " (เสนอแบบอนุโลม)" : ""}`,
            message: `ผู้ช่วยผู้จัดการได้ตรวจรับรองรายการงานของ ${empName} เรียบร้อยแล้ว${isException ? " โดยเสนอให้พิจารณาอนุมัติแบบอนุโลม (Exception)" : ""} กรุณาตรวจสอบเพื่ออนุมัติขั้นสุดท้าย`,
            type: "shift_submitted",
            shiftSessionId: shiftSessionId,
          });
        }
      }

      // Update branch last_update
      if (targetSession.branch) {
        await this.db
          .update(branches)
          .set({ last_update: new Date() })
          .where(eq(branches.id, targetSession.branch));
      }

      return { success: true };
    } catch (err: any) {
      console.error("ManagerService.approveShiftSession error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการรับรองผลงาน" };
    }
  }

  async reviewIncompleteShift(params: {
    shiftSessionId: string;
    reviewerId: string;
    action: "no_penalty" | "deduct_points" | "break_streak" | "deduct_leave_quota";
    pointsToDeduct?: number;
    note?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { shiftSessionId, reviewerId, action, pointsToDeduct = 0, note } = params;
      if (!shiftSessionId || !reviewerId) {
        return { success: false, error: "ข้อมูลระบุไม่ครบถ้วน" };
      }

      const [sess] = await this.db
        .select()
        .from(shiftSession)
        .where(eq(shiftSession.id, shiftSessionId))
        .limit(1);

      if (!sess) {
        return { success: false, error: "ไม่พบข้อมูลกะงานในระบบ" };
      }

      const [reviewer] = await this.db
        .select({ id: users.id, name: users.name, role: users.role })
        .from(users)
        .where(eq(users.id, reviewerId))
        .limit(1);

      if (!reviewer) {
        return { success: false, error: "ไม่พบข้อมูลผู้พิจารณา" };
      }

      const [targetUser] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, sess.user))
        .limit(1);

      if (!targetUser) {
        return { success: false, error: "ไม่พบข้อมูลพนักงานเจ้าของกะ" };
      }

      let actionDesc = "";
      const now = new Date();

      if (action === "no_penalty") {
        actionDesc = "อนุโลม (ไม่ลงโทษ / ไม่หักคะแนนหรือสตรีค)";
      } else if (action === "deduct_points") {
        const deduct = Math.max(1, pointsToDeduct || 5);
        actionDesc = `หักคะแนน ${deduct} แต้ม`;
        const newPoint = Math.max(0, (targetUser.point || 0) - deduct);
        await this.db
          .update(users)
          .set({ point: newPoint })
          .where(eq(users.id, targetUser.id));

        await this.db.insert(pointTransactions).values({
          user_id: targetUser.id,
          points: -deduct,
          type: "penalty",
          shift_session_id: sess.id,
          description: `หักคะแนนจากการจบกะงานไม่ครบ: ${note || "พิจารณาโดยผู้บริหาร"}`,
          created_at: now,
        });
      } else if (action === "break_streak") {
        actionDesc = "ตัดสตรีคการทำงานต่อเนื่องเป็น 0";
        await this.db
          .update(users)
          .set({ point_streak: 0, point_streak_type: "none" })
          .where(eq(users.id, targetUser.id));
      } else if (action === "deduct_leave_quota") {
        const currentQuota = targetUser.leave_quota ?? 3;
        const newQuota = Math.max(0, currentQuota - 1);
        actionDesc = "หักโควตาการลา 1 วัน";
        await this.db
          .update(users)
          .set({ leave_quota: newQuota })
          .where(eq(users.id, targetUser.id));
      }

      await this.db
        .update(shiftSession)
        .set({
          incomplete_status: "reviewed",
          incomplete_action: action,
          incomplete_action_points: action === "deduct_points" ? (pointsToDeduct || 5) : 0,
          incomplete_action_note: note || null,
          incomplete_reviewed_by: reviewerId,
          incomplete_reviewed_at: now,
        })
        .where(eq(shiftSession.id, shiftSessionId));

      if (this.notificationService) {
        const reviewerRoleName = reviewer.role === "manager_assistant" ? "ผู้ช่วยผู้จัดการร้าน" : "ผู้จัดการร้าน";
        await this.notificationService.createNotification({
          recipientId: targetUser.id,
          branchId: sess.branch,
          title: `⚖️ ผลการพิจารณาจบกะงานไม่ครบ`,
          message: `${reviewerRoleName} (${reviewer.name}) ได้พิจารณาผลการจบกะงานไม่ครบของคุณ: ${actionDesc}${note ? ` (หมายเหตุ: ${note})` : ""}`,
          type: "system",
          shiftSessionId: sess.id,
        });
      }

      return { success: true };
    } catch (err: any) {
      console.error("ManagerService.reviewIncompleteShift error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการบันทึกผลการพิจารณา" };
    }
  }

  async getBranchStaffStatus(branchId?: string): Promise<{
    success: boolean;
    employees?: BranchEmployeeStatus[];
    branches?: Array<{ id: string; name: string }>;
    selectedBranchId?: string;
    error?: string;
  }> {
    try {
      // 1. Fetch all branches
      const allBranches = await this.db
        .select({ id: branches.id, name: branches.name, members: branches.members })
        .from(branches);

      if (allBranches.length === 0) {
        return { success: true, employees: [], branches: [] };
      }

      const activeBranch = branchId 
        ? allBranches.find((b: any) => b.id === branchId) || allBranches[0]
        : allBranches[0];

      const activeBranchId = activeBranch.id;
      const branchMemberIds: string[] = activeBranch.members || [];

      // 2. Fetch users who belong to this branch, or if members array is empty, all staff
      let candidateUsers: any[] = [];
      if (branchMemberIds.length > 0) {
        candidateUsers = await this.db
          .select()
          .from(users)
          .where(inArray(users.id, branchMemberIds));
      } else {
        candidateUsers = await this.db
          .select()
          .from(users)
          .where(inArray(users.role, ["employee", "manager_assistant"]));
      }

      // 3. Today's time boundary (Asia/Bangkok)
      const { startOfDay, endOfDay } = getThaiStartAndEndOfDay(new Date());

      // 4. Fetch all shift sessions for today across candidate users
      const todaySessions = candidateUsers.length > 0
        ? await this.db
            .select()
            .from(shiftSession)
            .where(
              and(
                inArray(shiftSession.user, candidateUsers.map(u => u.id)),
                gte(shiftSession.start, startOfDay),
                lte(shiftSession.start, endOfDay)
              )
            )
            .orderBy(desc(shiftSession.start))
        : [];

      // 5. Total shifts worked count and last shift per user across all time
      const totalShiftCounts = candidateUsers.length > 0
        ? await this.db
            .select({
              userId: shiftSession.user,
              totalCount: sql<number>`count(*)::int`,
              lastShift: sql<Date | string>`max(${shiftSession.start})`,
            })
            .from(shiftSession)
            .where(inArray(shiftSession.user, candidateUsers.map(u => u.id)))
            .groupBy(shiftSession.user)
        : [];

      // 5.5 Fetch active leaves for today for candidate users at this branch
      const thaiTodayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
      let todayLeaves: any[] = [];
      const leaveRecorderMap = new Map<string, string>();
      try {
        if (candidateUsers.length > 0) {
          todayLeaves = await this.db
            .select()
            .from(employeeLeaves)
            .where(
              and(
                eq(employeeLeaves.branch_id, activeBranchId),
                inArray(employeeLeaves.user_id, candidateUsers.map(u => u.id)),
                lte(employeeLeaves.start_date, thaiTodayStr),
                gte(employeeLeaves.end_date, thaiTodayStr)
              )
            );

          const recorderIds = Array.from(new Set(todayLeaves.map((l: any) => l.recorded_by).filter(Boolean))) as string[];
          if (recorderIds.length > 0) {
            const recorderUsers = await this.db
              .select({ id: users.id, name: users.name })
              .from(users)
              .where(inArray(users.id, recorderIds));
            recorderUsers.forEach((ru: any) => leaveRecorderMap.set(ru.id, ru.name));
          }
        }
      } catch (leaveErr) {
        console.warn("Could not query employeeLeaves table, falling back:", leaveErr);
      }

      // 6. For currently active shifts (end IS NULL), fetch their task works to calculate checklist progress
      const activeSessions = todaySessions.filter((s: any) => s.end === null);
      const activeSessionIds = activeSessions.map((s: any) => s.id);

      const activeWorks = activeSessionIds.length > 0
        ? await this.db
            .select()
            .from(taskWork)
            .where(inArray(taskWork.shift_session, activeSessionIds))
        : [];

      // 7. Assemble BranchEmployeeStatus array
      const employees: BranchEmployeeStatus[] = candidateUsers.map((u: any) => {
        const userTodaySessions = todaySessions.filter((s: any) => s.user === u.id);
        const todayShiftsCount = userTodaySessions.length;

        // Current active shift (end is null)
        const currentActiveSession = userTodaySessions.find((s: any) => s.end === null);
        const isOnDuty = Boolean(currentActiveSession);

        let activeShift: BranchEmployeeStatus["activeShift"] | undefined = undefined;
        if (currentActiveSession) {
          const works = activeWorks.filter((w: any) => w.shift_session === currentActiveSession.id);
          const totalTasks = works.length;
          const completedTasks = works.filter((w: any) => w.timestamp !== null).length;
          const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
          const startedAtDate = new Date(currentActiveSession.start);
          const durationMinutes = Math.max(0, Math.round((Date.now() - startedAtDate.getTime()) / 60000));

          activeShift = {
            sessionId: currentActiveSession.id,
            shift: mapDbShiftToUi(currentActiveSession.shift),
            taskRole: currentActiveSession.task_role,
            taskRoleTitle: mapTaskRoleToTitle(currentActiveSession.task_role),
            startedAt: startedAtDate.toISOString(),
            durationMinutes,
            totalTasks,
            completedTasks,
            completionPercentage,
          };
        }

        const totalStats = totalShiftCounts.find((tc: any) => tc.userId === u.id);
        const totalShiftsWorked = totalStats ? Number(totalStats.totalCount) : todayShiftsCount;
        const lastShiftAt = totalStats?.lastShift 
          ? new Date(totalStats.lastShift).toISOString() 
          : (currentActiveSession ? new Date(currentActiveSession.start).toISOString() : null);

        let position = u.role === "manager_assistant" ? "ผู้ช่วยผู้จัดการร้าน" : "พนักงานประจำสาขา";
        if (currentActiveSession) {
          position = mapTaskRoleToTitle(currentActiveSession.task_role);
        }

        const matchingLeave = todayLeaves.find((l: any) => l.user_id === u.id);
        const isOnLeave = Boolean(matchingLeave);
        const activeLeave = matchingLeave
          ? {
              id: matchingLeave.id,
              leaveType: matchingLeave.leave_type as LeaveType,
              startDate: matchingLeave.start_date,
              endDate: matchingLeave.end_date,
              reason: matchingLeave.reason,
              preserveStreak: matchingLeave.preserve_streak ?? true,
              recordedByName: leaveRecorderMap.get(matchingLeave.recorded_by) || "ผู้จัดการ",
            }
          : undefined;

        return {
          id: u.id,
          name: u.name,
          username: u.username,
          role: u.role,
          position,
          branchId: activeBranchId,
          branchName: activeBranch.name,
          isOnDuty,
          isOnLeave,
          activeLeave,
          activeShift,
          todayShiftsCount,
          totalShiftsWorked,
          lastShiftAt,
          point: u.point ?? 0,
          pointStreak: u.point_streak ?? 0,
          pointStreakType: u.point_streak_type ?? "none",
        };
      });

      // Sort: On-duty first, then On-leave, then by name
      employees.sort((a, b) => {
        if (a.isOnDuty && !b.isOnDuty) return -1;
        if (!a.isOnDuty && b.isOnDuty) return 1;
        if (a.isOnLeave && !b.isOnLeave) return -1;
        if (!a.isOnLeave && b.isOnLeave) return 1;
        return a.name.localeCompare(b.name, "th");
      });

      return {
        success: true,
        employees,
        branches: allBranches.map((b: any) => ({ id: b.id, name: b.name })),
        selectedBranchId: activeBranchId,
      };
    } catch (err: any) {
      console.error("ManagerService.getBranchStaffStatus error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการโหลดสถานะพนักงาน" };
    }
  }

  async processShiftAttendanceAlerts(params?: {
    dateStr?: string;
  }): Promise<{
    success: boolean;
    processedBranches: number;
    totalUnendedShifts: number;
    totalAbsentStaff: number;
    details?: Array<{
      branchId: string;
      branchName: string;
      unendedCount: number;
      unendedStaff: string[];
      absentCount: number;
      absentStaff: string[];
    }>;
    error?: string;
  }> {
    try {
      const now = new Date();
      let targetDateObj = now;
      if (params?.dateStr) {
        const [y, m, d] = params.dateStr.split("-").map(Number);
        targetDateObj = new Date(y, m - 1, d, 12, 0, 0);
      }
      const { startOfDay, endOfDay } = getThaiStartAndEndOfDay(targetDateObj);
      const thaiDateLabel = new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(targetDateObj);

      // 1. Fetch all branches
      const allBranches = await this.db
        .select({ id: branches.id, name: branches.name, members: branches.members })
        .from(branches);

      let totalUnendedShifts = 0;
      let totalAbsentStaff = 0;
      const details: Array<{
        branchId: string;
        branchName: string;
        unendedCount: number;
        unendedStaff: string[];
        absentCount: number;
        absentStaff: string[];
      }> = [];

      for (const branch of allBranches) {
        const memberIds: string[] = Array.isArray(branch.members) ? branch.members : [];
        if (memberIds.length === 0) continue;

        // Fetch candidate staff users
        const candidateUsers = await this.db
          .select({ id: users.id, name: users.name, role: users.role })
          .from(users)
          .where(
            and(
              inArray(users.id, memberIds),
              inArray(users.role, ["employee", "manager_assistant"])
            )
          );

        if (candidateUsers.length === 0) continue;

        const candidateIds = candidateUsers.map((u: { id: string }) => u.id);

        // Fetch shift sessions for this branch & candidate users within today's window
        const branchSessions = await this.db
          .select({
            id: shiftSession.id,
            user: shiftSession.user,
            task_role: shiftSession.task_role,
            shift: shiftSession.shift,
            start: shiftSession.start,
            end: shiftSession.end,
          })
          .from(shiftSession)
          .where(
            and(
              eq(shiftSession.branch, branch.id),
              inArray(shiftSession.user, candidateIds),
              gte(shiftSession.start, startOfDay),
              lte(shiftSession.start, endOfDay)
            )
          );

        type SessionRecord = (typeof branchSessions)[number];

        // Group sessions by user ID
        const sessionsByUser = new Map<string, SessionRecord[]>();
        for (const s of branchSessions) {
          const list = sessionsByUser.get(s.user) || [];
          list.push(s);
          sessionsByUser.set(s.user, list);
        }

        // 1) Find staff who started a shift but never ended it (end is null)
        const unendedStaffNames: string[] = [];
        for (const [userId, userSessions] of sessionsByUser.entries()) {
          const hasUnended = userSessions.some((s: SessionRecord) => s.end === null);
          if (hasUnended) {
            const u = candidateUsers.find((cu: { id: string }) => cu.id === userId);
            if (u) {
              const roleTitle = u.role === "manager_assistant" ? "ผู้ช่วยฯ" : "พนักงาน";
              unendedStaffNames.push(`${u.name} (${roleTitle})`);
            }
          }
        }

        // Fetch approved leaves for today at this branch to avoid false absence alerts
        const dateStrForLeaves = params?.dateStr || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(targetDateObj);
        let onLeaveUserIds = new Set<string>();
        const onLeaveStaffNames: string[] = [];
        try {
          const branchLeaves = await this.db
            .select({
              id: employeeLeaves.id,
              user_id: employeeLeaves.user_id,
              leave_type: employeeLeaves.leave_type,
            })
            .from(employeeLeaves)
            .where(
              and(
                eq(employeeLeaves.branch_id, branch.id),
                inArray(employeeLeaves.user_id, candidateIds),
                lte(employeeLeaves.start_date, dateStrForLeaves),
                gte(employeeLeaves.end_date, dateStrForLeaves)
              )
            );

          onLeaveUserIds = new Set(branchLeaves.map((l: any) => l.user_id));
          for (const leave of branchLeaves) {
            const u = candidateUsers.find((cu: { id: string }) => cu.id === leave.user_id);
            if (u) {
              const typeLabel = isPaidLeave(leave.leave_type) ? "ลาเเบบได้เงิน" : "ลาเเบบไม่ได้รับเงิน";
              onLeaveStaffNames.push(`${u.name} (${typeLabel})`);
            }
          }
        } catch (leaveErr) {
          console.warn("Could not query leaves for attendance alerts:", leaveErr);
        }

        // 2) Find staff who didn't come to work (0 sessions today and NOT on approved leave)
        const absentStaffNames: string[] = [];
        for (const u of candidateUsers) {
          const userSessions = sessionsByUser.get(u.id);
          if (!userSessions || userSessions.length === 0) {
            if (onLeaveUserIds.has(u.id)) {
              continue; // On approved leave, do not count as absent!
            }
            const roleTitle = u.role === "manager_assistant" ? "ผู้ช่วยฯ" : "พนักงาน";
            absentStaffNames.push(`${u.name} (${roleTitle})`);
          }
        }

        totalUnendedShifts += unendedStaffNames.length;
        totalAbsentStaff += absentStaffNames.length;

        details.push({
          branchId: branch.id,
          branchName: branch.name,
          unendedCount: unendedStaffNames.length,
          unendedStaff: unendedStaffNames,
          absentCount: absentStaffNames.length,
          absentStaff: absentStaffNames,
        });

        // Send notifications if issues found
        if (this.notificationService && (unendedStaffNames.length > 0 || absentStaffNames.length > 0)) {
          const msgParts: string[] = [];
          if (unendedStaffNames.length > 0) {
            msgParts.push(`⚠️ เข้ากะแล้วแต่ไม่กดจบกะ (${unendedStaffNames.length} คน): ${unendedStaffNames.join(", ")}`);
          }
          if (absentStaffNames.length > 0) {
            msgParts.push(`⚪ ไม่มาปฏิบัติงาน/ไม่พบการเข้ากะ (${absentStaffNames.length} คน): ${absentStaffNames.join(", ")}`);
          }
          const fullMsg = `สาขา${branch.name} ประจำวันที่ ${thaiDateLabel}:\n${msgParts.join("\n")}\nกรุณาตรวจสอบและดำเนินการติดตาม`;

          // 1. Notify Manager of this branch
          await this.notificationService.createNotification({
            branchId: branch.id,
            recipientRole: "manager",
            title: `⚠️ แจ้งเตือน: พนักงานไม่จบกะ / ขาดการเข้ากะ (${branch.name})`,
            message: fullMsg,
            type: "system",
          });

          // 2. Notify Assistant Manager of this branch
          await this.notificationService.createNotification({
            branchId: branch.id,
            recipientRole: "manager_assistant",
            title: `⚠️ แจ้งเตือน: พนักงานไม่จบกะ / ขาดการเข้ากะ (${branch.name})`,
            message: fullMsg,
            type: "system",
          });
        }
      }

      // Notify General Manager with summary
      if (this.notificationService) {
        const issueBranches = details.filter(d => d.unendedCount > 0 || d.absentCount > 0);
        if (issueBranches.length > 0) {
          const branchSummaries = issueBranches
            .map(b => `• ${b.branchName}: ไม่จบกะ ${b.unendedCount} คน, ขาดกะ ${b.absentCount} คน`)
            .join("\n");

          await this.notificationService.createNotification({
            recipientRole: "general_manager",
            title: `⚠️ รายงานพนักงานไม่จบกะและไม่เข้ากะ (${thaiDateLabel})`,
            message: `ตรวจพบ ${issueBranches.length} สาขา ที่มีพนักงานไม่จบกะรวม ${totalUnendedShifts} คน และไม่พบการเข้ากะรวม ${totalAbsentStaff} คน:\n${branchSummaries}`,
            type: "system",
          });
        }
      }

      return {
        success: true,
        processedBranches: allBranches.length,
        totalUnendedShifts,
        totalAbsentStaff,
        details,
      };
    } catch (err: unknown) {
      console.error("ManagerService.processShiftAttendanceAlerts error:", err);
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการตรวจสอบการเข้ากะ";
      return {
        success: false,
        processedBranches: 0,
        totalUnendedShifts: 0,
        totalAbsentStaff: 0,
        error: message,
      };
    }
  }

  async markEmployeeLeave(params: {
    userId: string;
    branchId: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
    preserveStreak?: boolean;
    recordedBy: string;
  }): Promise<{ success: boolean; leave?: EmployeeLeave; error?: string }> {
    try {
      const { userId, branchId, leaveType, startDate, endDate, reason, preserveStreak = true, recordedBy } = params;

      if (!userId || !branchId || !leaveType || !startDate || !endDate || !reason?.trim() || !recordedBy) {
        return { success: false, error: "กรุณากรอกข้อมูลการลาและเหตุผลการลาให้ครบถ้วน" };
      }

      if (startDate > endDate) {
        return { success: false, error: "วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด" };
      }

      // Retrieve target user & recorder info first
      const [targetUser] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!targetUser) {
        return { success: false, error: "ไม่พบข้อมูลพนักงาน" };
      }
      const [recorder] = await this.db.select().from(users).where(eq(users.id, recordedBy)).limit(1);
      const [branch] = await this.db.select().from(branches).where(eq(branches.id, branchId)).limit(1);

      const previousStreak = targetUser.point_streak ?? 0;

      // If the manager decided not to preserve streak (e.g. invalid leave or unexcused), break streak
      if (!preserveStreak) {
        await this.db
          .update(users)
          .set({
            point_streak: 0,
            point_streak_type: "none",
          })
          .where(eq(users.id, userId));
      }

      // Insert leave record into database
      const [newLeave] = await this.db
        .insert(employeeLeaves)
        .values({
          user_id: userId,
          branch_id: branchId,
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim(),
          preserve_streak: preserveStreak,
          previous_streak: previousStreak,
          recorded_by: recordedBy,
          status: "approved",
          approved_by: recordedBy,
          approved_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning();

      // Create an audit notification if notificationService is available
      if (this.notificationService) {
        const leaveTypeName = isPaidLeave(leaveType) 
          ? "ลาเเบบได้เงิน (Paid Leave)" 
          : "ลาเเบบไม่ได้รับเงิน (Unpaid Leave)";
        const dateDesc = startDate === endDate ? startDate : `${startDate} ถึง ${endDate}`;
        const streakDecisionText = preserveStreak 
          ? "(สตรีคคะแนนสะสมได้รับการคุ้มครอง ไม่ขาด)" 
          : "(ดุลยพินิจผู้บริหาร: ไม่อนุมัติรักษาสตรีค ส่งผลให้สตรีคคะแนนถูกตัดเป็น 0)";
        
        await this.notificationService.createNotification({
          recipientId: userId,
          branchId,
          title: `📋 บันทึก${leaveTypeName}`,
          message: `ผู้บริหาร (${recorder?.name || "ผู้จัดการ"}) ได้บันทึก${leaveTypeName} วันที่ ${dateDesc} เรียบร้อยแล้ว ${streakDecisionText}`,
          type: "system",
        });
      }

      const createdLeave: EmployeeLeave = {
        id: newLeave.id,
        userId: newLeave.user_id,
        userName: targetUser?.name || "พนักงาน",
        userPosition: targetUser?.role === "manager_assistant" ? "ผู้ช่วยผู้จัดการร้าน" : "พนักงานประจำสาขา",
        branchId: newLeave.branch_id,
        branchName: branch?.name,
        leaveType: newLeave.leave_type as LeaveType,
        startDate: newLeave.start_date,
        endDate: newLeave.end_date,
        reason: newLeave.reason,
        preserveStreak: newLeave.preserve_streak ?? true,
        previousStreak: newLeave.previous_streak ?? undefined,
        recordedBy: newLeave.recorded_by,
        recordedByName: recorder?.name || "ผู้จัดการ",
        recordedByRole: recorder?.role as Role,
        status: (newLeave.status as "pending" | "approved" | "rejected") || "approved",
        approvedBy: newLeave.approved_by || recordedBy,
        approvedByName: recorder?.name || "ผู้จัดการ",
        approvedAt: newLeave.approved_at ? new Date(newLeave.approved_at).toISOString() : new Date().toISOString(),
        createdAt: newLeave.created_at ? new Date(newLeave.created_at).toISOString() : new Date().toISOString(),
        updatedAt: newLeave.updated_at ? new Date(newLeave.updated_at).toISOString() : undefined,
      };

      return {
        success: true,
        leave: createdLeave,
      };
    } catch (err: unknown) {
      console.error("ManagerService.markEmployeeLeave error:", err);
      const message = err instanceof Error ? err.message : "ไม่สามารถบันทึกการลาได้";
      return { success: false, error: message };
    }
  }

  async getBranchLeaves(params: {
    branchId: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ success: boolean; leaves?: EmployeeLeave[]; error?: string }> {
    try {
      const { branchId, startDate, endDate } = params;
      if (!branchId) {
        return { success: false, error: "ไม่พบรหัสสาขา" };
      }

      const conditions = [eq(employeeLeaves.branch_id, branchId)];
      if (startDate && endDate) {
        conditions.push(lte(employeeLeaves.start_date, endDate));
        conditions.push(gte(employeeLeaves.end_date, startDate));
      }

      const rawLeaves = await this.db
        .select()
        .from(employeeLeaves)
        .where(and(...conditions))
        .orderBy(desc(employeeLeaves.created_at));

      if (rawLeaves.length === 0) {
        return { success: true, leaves: [] };
      }

      const userIds = Array.from(
        new Set([
          ...rawLeaves.map((l: { user_id: string }) => l.user_id),
          ...rawLeaves.map((l: { recorded_by: string }) => l.recorded_by),
          ...rawLeaves.map((l: { approved_by?: string | null }) => l.approved_by).filter((id: string | null | undefined): id is string => Boolean(id)),
        ])
      );

      const userRecords = userIds.length > 0
        ? await this.db.select().from(users).where(inArray(users.id, userIds))
        : [];
      const userMap = new Map<string, { id: string; name: string; role: Role }>(
        userRecords.map((u: { id: string; name: string; role: Role }) => [u.id, u])
      );

      const [branchRecord] = await this.db
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(eq(branches.id, branchId))
        .limit(1);

      const leaves: EmployeeLeave[] = rawLeaves.map((l: typeof employeeLeaves.$inferSelect) => {
        const emp = userMap.get(l.user_id);
        const rec = userMap.get(l.recorded_by);
        const app = l.approved_by ? userMap.get(l.approved_by) : undefined;
        return {
          id: l.id,
          userId: l.user_id,
          userName: emp?.name || "พนักงาน",
          userPosition: emp?.role === "manager_assistant" ? "ผู้ช่วยผู้จัดการร้าน" : "พนักงานประจำสาขา",
          branchId: l.branch_id,
          branchName: branchRecord?.name,
          leaveType: l.leave_type as LeaveType,
          startDate: l.start_date,
          endDate: l.end_date,
          reason: l.reason,
          preserveStreak: l.preserve_streak ?? true,
          previousStreak: l.previous_streak ?? undefined,
          recordedBy: l.recorded_by,
          recordedByName: rec?.name || "ผู้จัดการ",
          recordedByRole: rec?.role as Role,
          status: (l.status as "pending" | "approved" | "rejected") || "approved",
          approvedBy: l.approved_by || undefined,
          approvedByName: app?.name || undefined,
          approvedAt: l.approved_at ? new Date(l.approved_at).toISOString() : undefined,
          createdAt: l.created_at ? new Date(l.created_at).toISOString() : new Date().toISOString(),
          updatedAt: l.updated_at ? new Date(l.updated_at).toISOString() : undefined,
        };
      });

      return { success: true, leaves };
    } catch (err: unknown) {
      console.error("ManagerService.getBranchLeaves error:", err);
      const message = err instanceof Error ? err.message : "ไม่สามารถโหลดรายการลาได้";
      return { success: false, error: message };
    }
  }

  async cancelEmployeeLeave(params: {
    leaveId: string;
    cancelledBy: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { leaveId } = params;
      if (!leaveId) {
        return { success: false, error: "ไม่พบรหัสรายการลา" };
      }

      // Fetch the leave record first to check if streak was broken and needs restoration
      const [leaveRecord] = await this.db
        .select()
        .from(employeeLeaves)
        .where(eq(employeeLeaves.id, leaveId))
        .limit(1);

      if (leaveRecord) {
        // If this leave broke the streak and there was a previous streak, restore it if current streak is still 0
        if (!leaveRecord.preserve_streak && leaveRecord.previous_streak && leaveRecord.previous_streak > 0) {
          const [userRecord] = await this.db
            .select()
            .from(users)
            .where(eq(users.id, leaveRecord.user_id))
            .limit(1);

          if (userRecord && userRecord.point_streak === 0) {
            await this.db
              .update(users)
              .set({
                point_streak: leaveRecord.previous_streak,
                point_streak_type: "flawed", // Restore to active streak state
              })
              .where(eq(users.id, leaveRecord.user_id));
          }
        }

        await this.db.delete(employeeLeaves).where(eq(employeeLeaves.id, leaveId));
      }

      return { success: true };
    } catch (err: unknown) {
      console.error("ManagerService.cancelEmployeeLeave error:", err);
      const message = err instanceof Error ? err.message : "ไม่สามารถยกเลิกรายการลาได้";
      return { success: false, error: message };
    }
  }

  async cleanupOldLeaves(retentionDays: number = 14): Promise<{
    success: boolean;
    cutoffDate?: string;
    deletedCount?: number;
    error?: string;
  }> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      const y = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(cutoffDate);
      const m = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", month: "2-digit" }).format(cutoffDate);
      const d = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", day: "2-digit" }).format(cutoffDate);
      const cutoffDateStr = `${y}-${m}-${d}`;

      const deleted = await this.db
        .delete(employeeLeaves)
        .where(
          and(
            lte(employeeLeaves.end_date, cutoffDateStr),
            lt(employeeLeaves.created_at, cutoffDate)
          )
        )
        .returning({ id: employeeLeaves.id });

      return {
        success: true,
        cutoffDate: cutoffDate.toISOString(),
        deletedCount: deleted.length,
      };
    } catch (err: unknown) {
      console.error("ManagerService.cleanupOldLeaves error:", err);
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการล้างข้อมูลการลาเก่า";
      return { success: false, error: message };
    }
  }

  async getEmployeeLeaveQuota(params: {
    userId: string;
    branchId?: string;
  }): Promise<{ success: boolean; quota?: LeaveQuotaInfo; error?: string }> {
    try {
      const { userId } = params;
      if (!userId) return { success: false, error: "ไม่พบรหัสผู้ใช้" };

      const [targetUser] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!targetUser) return { success: false, error: "ไม่พบข้อมูลผู้ใช้" };

      let branchRecord: any = null;
      let branchId = params.branchId;

      if (branchId) {
        const [b] = await this.db.select().from(branches).where(eq(branches.id, branchId)).limit(1);
        branchRecord = b;
      } else {
        const allBranches = await this.db.select().from(branches);
        branchRecord = allBranches.find((b: any) => b.members?.includes(userId));
        branchId = branchRecord?.id;
      }

      const branchDefaultQuota = typeof branchRecord?.leave_quota === "number" ? branchRecord.leave_quota : 3;
      const customQuota = typeof targetUser.leave_quota === "number" ? targetUser.leave_quota : null;
      const allocatedQuota = customQuota !== null ? customQuota : branchDefaultQuota;

      const currentYearStr = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date());
      const userLeaves = await this.db
        .select()
        .from(employeeLeaves)
        .where(eq(employeeLeaves.user_id, userId));

      const calcDays = (start: string, end: string) => {
        try {
          const s = new Date(start).getTime();
          const e = new Date(end).getTime();
          if (isNaN(s) || isNaN(e)) return 1;
          const diffDays = Math.round((e - s) / 86400000);
          return Math.max(1, diffDays + 1);
        } catch {
          return 1;
        }
      };

      let usedDays = 0;
      let pendingDays = 0;

      for (const l of userLeaves) {
        if (l.start_date?.startsWith(currentYearStr) || l.end_date?.startsWith(currentYearStr)) {
          const days = calcDays(l.start_date, l.end_date);
          const st = l.status || "approved";
          if (st === "approved") {
            usedDays += days;
          } else if (st === "pending") {
            pendingDays += days;
          }
        }
      }

      const remainingDays = Math.max(0, allocatedQuota - usedDays - pendingDays);

      return {
        success: true,
        quota: {
          userId,
          branchId,
          allocatedQuota,
          branchDefaultQuota,
          customQuota,
          usedDays,
          pendingDays,
          remainingDays,
        },
      };
    } catch (err: unknown) {
      console.error("ManagerService.getEmployeeLeaveQuota error:", err);
      return { success: false, error: "ไม่สามารถคำนวณโควตาการลาได้" };
    }
  }

  async requestEmployeeLeave(params: {
    userId: string;
    branchId: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
    requestedBy: string;
    preserveStreak?: boolean;
    isManagerRole?: boolean;
  }): Promise<{ success: boolean; leave?: EmployeeLeave; autoApproved?: boolean; error?: string }> {
    try {
      const { userId, branchId, leaveType, startDate, endDate, reason, requestedBy, preserveStreak = true } = params;
      if (!userId || !branchId || !leaveType || !startDate || !endDate || !reason?.trim() || !requestedBy) {
        return { success: false, error: "กรุณากรอกข้อมูลการลาและเหตุผลให้ครบถ้วน" };
      }
      if (startDate > endDate) {
        return { success: false, error: "วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด" };
      }

      // Check quota
      const quotaRes = await this.getEmployeeLeaveQuota({ userId, branchId });
      if (quotaRes.success && quotaRes.quota) {
        if (quotaRes.quota.remainingDays <= 0) {
          return {
            success: false,
            error: `โควตาการลาของคุณหมดแล้ว (ใช้ไปแล้ว ${quotaRes.quota.usedDays}/${quotaRes.quota.allocatedQuota} วัน)`,
          };
        }
      }

      const [targetUser] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!targetUser) return { success: false, error: "ไม่พบข้อมูลพนักงาน" };
      const [requester] = await this.db.select().from(users).where(eq(users.id, requestedBy)).limit(1);
      const [branch] = await this.db.select().from(branches).where(eq(branches.id, branchId)).limit(1);

      // Determine if manager requested -> auto confirm
      const isManagerOrAdmin =
        params.isManagerRole ||
        requester?.role === "manager" ||
        requester?.role === "manager_assistant" ||
        requester?.role === "general_manager" ||
        requester?.role === "committee" ||
        requester?.role === "admin";

      const isEmployeeSelf = userId === requestedBy && requester?.role === "employee";
      const autoApproved = !isEmployeeSelf || isManagerOrAdmin;
      const initialStatus = autoApproved ? "approved" : "pending";

      const previousStreak = targetUser.point_streak ?? 0;

      if (autoApproved && !preserveStreak) {
        await this.db
          .update(users)
          .set({ point_streak: 0, point_streak_type: "none" })
          .where(eq(users.id, userId));
      }

      const [newLeave] = await this.db
        .insert(employeeLeaves)
        .values({
          user_id: userId,
          branch_id: branchId,
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim(),
          preserve_streak: preserveStreak,
          previous_streak: previousStreak,
          recorded_by: requestedBy,
          status: initialStatus,
          approved_by: autoApproved ? requestedBy : null,
          approved_at: autoApproved ? new Date() : null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning();

      // Notifications
      if (this.notificationService) {
        const leaveTypeName = isPaidLeave(leaveType) ? "ลาเเบบได้เงิน" : "ลาเเบบไม่ได้รับเงิน";
        const dateDesc = startDate === endDate ? startDate : `${startDate} ถึง ${endDate}`;

        if (autoApproved) {
          await this.notificationService.createNotification({
            recipientId: userId,
            branchId,
            title: `📋 บันทึก${leaveTypeName} สำเร็จ`,
            message: `การลาของคุณวันที่ ${dateDesc} ได้รับการอนุมัติแล้ว`,
            type: "system",
          });
        } else {
          // Notify branch managers & assistant managers
          await this.notificationService.createNotification({
            recipientRole: "manager",
            branchId,
            title: `📩 มีคำขอลางานใหม่`,
            message: `พนักงาน ${targetUser.name} ได้ส่งคำขอ${leaveTypeName} วันที่ ${dateDesc}: "${reason.trim()}" รอการอนุมัติ`,
            type: "system",
          });
          await this.notificationService.createNotification({
            recipientRole: "manager_assistant",
            branchId,
            title: `📩 มีคำขอลางานใหม่`,
            message: `พนักงาน ${targetUser.name} ได้ส่งคำขอ${leaveTypeName} วันที่ ${dateDesc}: "${reason.trim()}" รอการอนุมัติ`,
            type: "system",
          });
        }
      }

      const createdLeave: EmployeeLeave = {
        id: newLeave.id,
        userId: newLeave.user_id,
        userName: targetUser?.name || "พนักงาน",
        userPosition: targetUser?.role === "manager_assistant" ? "ผู้ช่วยผู้จัดการร้าน" : "พนักงานประจำสาขา",
        branchId: newLeave.branch_id,
        branchName: branch?.name,
        leaveType: newLeave.leave_type as LeaveType,
        startDate: newLeave.start_date,
        endDate: newLeave.end_date,
        reason: newLeave.reason,
        preserveStreak: newLeave.preserve_streak ?? true,
        previousStreak: newLeave.previous_streak ?? undefined,
        recordedBy: newLeave.recorded_by,
        recordedByName: requester?.name || "ผู้จัดการ",
        recordedByRole: requester?.role as Role,
        status: newLeave.status as "pending" | "approved" | "rejected",
        approvedBy: newLeave.approved_by || undefined,
        approvedByName: autoApproved ? (requester?.name || "ผู้จัดการ") : undefined,
        approvedAt: newLeave.approved_at ? new Date(newLeave.approved_at).toISOString() : undefined,
        createdAt: newLeave.created_at ? new Date(newLeave.created_at).toISOString() : new Date().toISOString(),
        updatedAt: newLeave.updated_at ? new Date(newLeave.updated_at).toISOString() : undefined,
      };

      return {
        success: true,
        leave: createdLeave,
        autoApproved,
      };
    } catch (err: unknown) {
      console.error("ManagerService.requestEmployeeLeave error:", err);
      const message = err instanceof Error ? err.message : "ไม่สามารถส่งคำขอลางานได้";
      return { success: false, error: message };
    }
  }

  async approveEmployeeLeave(params: {
    leaveId: string;
    approvedBy: string;
    leaveType?: LeaveType;
    preserveStreak?: boolean;
  }): Promise<{ success: boolean; leave?: EmployeeLeave; error?: string }> {
    try {
      const { leaveId, approvedBy, leaveType, preserveStreak } = params;
      if (!leaveId || !approvedBy) return { success: false, error: "ข้อมูลไม่ครบถ้วน" };

      const [existingLeave] = await this.db.select().from(employeeLeaves).where(eq(employeeLeaves.id, leaveId)).limit(1);
      if (!existingLeave) return { success: false, error: "ไม่พบรายการขอลางาน" };

      const [approver] = await this.db.select().from(users).where(eq(users.id, approvedBy)).limit(1);
      const [targetUser] = await this.db.select().from(users).where(eq(users.id, existingLeave.user_id)).limit(1);

      const finalPreserveStreak = preserveStreak !== undefined ? preserveStreak : existingLeave.preserve_streak;
      const finalLeaveType = leaveType || existingLeave.leave_type;

      if (!finalPreserveStreak) {
        await this.db
          .update(users)
          .set({ point_streak: 0, point_streak_type: "none" })
          .where(eq(users.id, existingLeave.user_id));
      }

      const [updatedLeave] = await this.db
        .update(employeeLeaves)
        .set({
          status: "approved",
          approved_by: approvedBy,
          approved_at: new Date(),
          leave_type: finalLeaveType,
          preserve_streak: finalPreserveStreak,
          updated_at: new Date(),
        })
        .where(eq(employeeLeaves.id, leaveId))
        .returning();

      if (this.notificationService) {
        const leaveTypeName = isPaidLeave(finalLeaveType as LeaveType) ? "ลาเเบบได้เงิน" : "ลาเเบบไม่ได้รับเงิน";
        const dateDesc = existingLeave.start_date === existingLeave.end_date
          ? existingLeave.start_date
          : `${existingLeave.start_date} ถึง ${existingLeave.end_date}`;
        await this.notificationService.createNotification({
          recipientId: existingLeave.user_id,
          branchId: existingLeave.branch_id,
          title: `✅ คำขอลางานได้รับการอนุมัติ`,
          message: `ผู้บริหาร (${approver?.name || "ผู้จัดการ"}) ได้อนุมัติ${leaveTypeName} วันที่ ${dateDesc} เรียบร้อยแล้ว`,
          type: "system",
        });
      }

      return {
        success: true,
        leave: {
          id: updatedLeave.id,
          userId: updatedLeave.user_id,
          userName: targetUser?.name || "พนักงาน",
          branchId: updatedLeave.branch_id,
          leaveType: updatedLeave.leave_type as LeaveType,
          startDate: updatedLeave.start_date,
          endDate: updatedLeave.end_date,
          reason: updatedLeave.reason,
          preserveStreak: updatedLeave.preserve_streak ?? true,
          previousStreak: updatedLeave.previous_streak ?? undefined,
          recordedBy: updatedLeave.recorded_by,
          status: "approved",
          approvedBy: updatedLeave.approved_by || undefined,
          approvedByName: approver?.name || "ผู้จัดการ",
          approvedAt: updatedLeave.approved_at ? new Date(updatedLeave.approved_at).toISOString() : undefined,
          createdAt: updatedLeave.created_at ? new Date(updatedLeave.created_at).toISOString() : new Date().toISOString(),
          updatedAt: updatedLeave.updated_at ? new Date(updatedLeave.updated_at).toISOString() : undefined,
        },
      };
    } catch (err: unknown) {
      console.error("ManagerService.approveEmployeeLeave error:", err);
      const message = err instanceof Error ? err.message : "ไม่สามารถอนุมัติการลาได้";
      return { success: false, error: message };
    }
  }

  async rejectEmployeeLeave(params: {
    leaveId: string;
    rejectedBy: string;
    reason?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { leaveId, rejectedBy, reason } = params;
      if (!leaveId || !rejectedBy) return { success: false, error: "ข้อมูลไม่ครบถ้วน" };

      const [existingLeave] = await this.db.select().from(employeeLeaves).where(eq(employeeLeaves.id, leaveId)).limit(1);
      if (!existingLeave) return { success: false, error: "ไม่พบรายการขอลางาน" };

      const [rejecter] = await this.db.select().from(users).where(eq(users.id, rejectedBy)).limit(1);

      await this.db
        .update(employeeLeaves)
        .set({
          status: "rejected",
          updated_at: new Date(),
        })
        .where(eq(employeeLeaves.id, leaveId));

      if (this.notificationService) {
        const dateDesc = existingLeave.start_date === existingLeave.end_date
          ? existingLeave.start_date
          : `${existingLeave.start_date} ถึง ${existingLeave.end_date}`;
        await this.notificationService.createNotification({
          recipientId: existingLeave.user_id,
          branchId: existingLeave.branch_id,
          title: `❌ คำขอลางานไม่ได้รับการอนุมัติ`,
          message: `ผู้บริหาร (${rejecter?.name || "ผู้จัดการ"}) ไม่อนุมัติคำขอลางาน วันที่ ${dateDesc}${reason ? `: ${reason}` : ""}`,
          type: "system",
        });
      }

      return { success: true };
    } catch (err: unknown) {
      console.error("ManagerService.rejectEmployeeLeave error:", err);
      const message = err instanceof Error ? err.message : "ไม่สามารถปฏิเสธการลาได้";
      return { success: false, error: message };
    }
  }

  async updateEmployeeLeaveQuota(params: {
    userId: string;
    quota: number | null;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { userId, quota } = params;
      if (!userId) return { success: false, error: "ไม่พบรหัสผู้ใช้" };

      const cleanQuota = quota === null ? null : Math.max(0, Math.floor(quota));
      await this.db
        .update(users)
        .set({ leave_quota: cleanQuota })
        .where(eq(users.id, userId));

      return { success: true };
    } catch (err: unknown) {
      console.error("ManagerService.updateEmployeeLeaveQuota error:", err);
      return { success: false, error: "ไม่สามารถอัปเดตโควตาการลาของพนักงานได้" };
    }
  }

  async updateBranchLeaveQuota(params: {
    branchId: string;
    quota: number;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { branchId, quota } = params;
      if (!branchId) return { success: false, error: "ไม่พบรหัสสาขา" };

      const cleanQuota = Math.max(0, Math.floor(quota));
      await this.db
        .update(branches)
        .set({
          leave_quota: cleanQuota,
          last_update: new Date(),
        })
        .where(eq(branches.id, branchId));

      return { success: true };
    } catch (err: unknown) {
      console.error("ManagerService.updateBranchLeaveQuota error:", err);
      return { success: false, error: "ไม่สามารถอัปเดตโควตาการลาของสาขาได้" };
    }
  }

  async getAllUsersLeaveQuotas(): Promise<{
    success: boolean;
    quotas?: Record<string, LeaveQuotaInfo>;
    error?: string;
  }> {
    try {
      const allUsers = await this.db.select().from(users);
      const allBranches = await this.db.select().from(branches);
      const allLeaves = await this.db.select().from(employeeLeaves);

      const currentYearStr = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date());

      const calcDays = (start: string, end: string) => {
        try {
          const s = new Date(start).getTime();
          const e = new Date(end).getTime();
          if (isNaN(s) || isNaN(e)) return 1;
          const diffDays = Math.round((e - s) / 86400000);
          return Math.max(1, diffDays + 1);
        } catch {
          return 1;
        }
      };

      const quotaMap: Record<string, LeaveQuotaInfo> = {};

      for (const u of allUsers) {
        const userBranch = allBranches.find((b: any) => Array.isArray(b.members) && b.members.includes(u.id));
        const branchDefaultQuota = typeof userBranch?.leave_quota === "number" ? userBranch.leave_quota : 3;
        const customQuota = typeof u.leave_quota === "number" ? u.leave_quota : null;
        const allocatedQuota = customQuota !== null ? customQuota : branchDefaultQuota;

        let usedDays = 0;
        let pendingDays = 0;

        for (const l of allLeaves) {
          if (l.user_id === u.id) {
            if (l.start_date?.startsWith(currentYearStr) || l.end_date?.startsWith(currentYearStr)) {
              const days = calcDays(l.start_date, l.end_date);
              const st = l.status || "approved";
              if (st === "approved") {
                usedDays += days;
              } else if (st === "pending") {
                pendingDays += days;
              }
            }
          }
        }

        const remainingDays = Math.max(0, allocatedQuota - usedDays - pendingDays);

        quotaMap[u.id] = {
          userId: u.id,
          branchId: userBranch?.id,
          allocatedQuota,
          branchDefaultQuota,
          customQuota,
          usedDays,
          pendingDays,
          remainingDays,
        };
      }

      return { success: true, quotas: quotaMap };
    } catch (err: unknown) {
      console.error("ManagerService.getAllUsersLeaveQuotas error:", err);
      return { success: false, error: "เกิดข้อผิดพลาดในการคำนวณโควตาวันลาของผู้ใช้งาน" };
    }
  }
}
