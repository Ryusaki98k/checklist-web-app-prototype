import { eq, and, or, gte, lte, lt, desc, asc, inArray, isNull, sql } from "drizzle-orm";
import { tasks, taskWork, shiftSession, users, branches, refrigerators, refrigeratorTasks, notifications, pointTransactions } from "../db/schema";
import { IChecklistService, INotificationService } from "./types";
import { ShiftSession, ShiftType, ChecklistItem } from "../types";

function mapPositionToTaskRole(pos: string): "cashier" | "stock" | "manager_assistant" {
  if (pos.includes("แคชเชียร์") || pos.includes("cashier")) return "cashier";
  if (pos.includes("สต็อก") || pos.includes("stock")) return "stock";
  if (pos.includes("ผู้ช่วย") || pos.includes("assistant")) return "manager_assistant";
  return "cashier";
}

function mapShiftToDbShift(shift: ShiftType): "morning" | "afternoon" | "morning_afternoon" {
  if (shift === "morning") return "morning";
  if (shift === "afternoon") return "afternoon";
  return "morning_afternoon";
}

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
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
    dateStr: `${yElement}-${mElement}-${dElement}`,
  };
}

export class ChecklistService implements IChecklistService {
  constructor(private db: any, private notificationService?: INotificationService) {}

  async getOrCreateShiftSession(params: {
    userId: string;
    userName: string;
    position: string;
    shift: ShiftType;
  }): Promise<{ success: boolean; session?: ShiftSession; error?: string }> {
    try {
      const { userId, userName, position, shift } = params;
      const taskRole = mapPositionToTaskRole(position);
      const dbShift = mapShiftToDbShift(shift);

      let validUserId = userId;
      if (!isValidUuid(userId)) {
        const targetRole = taskRole === "manager_assistant" ? "manager_assistant" : "employee";
        const [foundUser] = await this.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.role, targetRole))
          .limit(1);
        if (foundUser) {
          validUserId = foundUser.id;
        } else {
          const [anyUser] = await this.db.select({ id: users.id }).from(users).limit(1);
          if (anyUser) validUserId = anyUser.id;
          else return { success: false, error: "ไม่พบบัญชีผู้ใช้ในฐานข้อมูล" };
        }
      }

      const { startOfDay, endOfDay, dateStr } = getThaiStartAndEndOfDay();

      const branchForUser = await this.db
        .select({ id: branches.id, name: branches.name, tasks: branches.tasks })
        .from(branches)
        .where(sql`${validUserId} = ANY(${branches.members})`)
        .limit(1);

      let branchId: string;
      let branchNameForSession: string;
      let branchTaskIds: string[] = [];

      if (branchForUser.length > 0) {
        branchId = branchForUser[0].id;
        branchNameForSession = branchForUser[0].name;
        branchTaskIds = branchForUser[0].tasks || [];
      } else {
        const [anyBranch] = await this.db
          .select({ id: branches.id, name: branches.name, tasks: branches.tasks })
          .from(branches)
          .limit(1);
        if (anyBranch) {
          branchId = anyBranch.id;
          branchNameForSession = anyBranch.name;
          branchTaskIds = anyBranch.tasks || [];
        } else {
          return { success: false, error: "กรุณาสร้างสาขาอย่างน้อย 1 สาขาก่อนเริ่มกะ" };
        }
      }

      const allowedShifts: ("morning" | "afternoon" | "morning_afternoon")[] =
        dbShift === "morning_afternoon"
          ? ["morning", "afternoon", "morning_afternoon"]
          : [dbShift, "morning_afternoon"];

      let dbTasks = await this.db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.task_role, taskRole),
            inArray(tasks.shift, allowedShifts),
            eq(tasks.disabled, false)
          )
        )
        .orderBy(asc(tasks.start));

      if (branchTaskIds.length > 0) {
        dbTasks = dbTasks.filter((t: any) => branchTaskIds.includes(t.id));
      } else {
        dbTasks = [];
      }

      const [existingSession] = await this.db
        .select()
        .from(shiftSession)
        .where(
          and(
            eq(shiftSession.task_role, taskRole),
            eq(shiftSession.shift, dbShift),
            gte(shiftSession.start, startOfDay),
            lte(shiftSession.start, endOfDay),
            eq(shiftSession.branch, branchId),
            eq(shiftSession.user, validUserId)
          )
        )
        .orderBy(desc(shiftSession.start))
        .limit(1);

      let activeDbSession = existingSession;
      let workRows: any[] = [];

      if (!activeDbSession) {
        const [newSession] = await this.db
          .insert(shiftSession)
          .values({
            user: validUserId,
            branch: branchId,
            task_role: taskRole,
            shift: dbShift,
            start: new Date(),
          })
          .returning();

        activeDbSession = newSession;

        if (dbTasks.length > 0) {
          const inserts = dbTasks.map((t: any) => ({
            task: t.id,
            shift_session: newSession.id,
            timestamp: null,
          }));
          workRows = await this.db.insert(taskWork).values(inserts).returning();
        }

        if (this.notificationService) {
          const shiftTitle = dbShift === "morning" ? "กะเช้า" : dbShift === "afternoon" ? "กะบ่าย" : "กะเช้า-บ่าย";
          await this.notificationService.createNotification({
            recipientId: validUserId,
            title: `🚀 เริ่มต้นปฏิบัติงาน: ${shiftTitle}`,
            message: `เริ่มบันทึกกะงานสำหรับตำแหน่ง ${position} เรียบร้อยแล้ว อย่าลืมตรวจสอบรายการงานตามรอบเวลาที่กำหนด`,
            type: "info",
            shiftSessionId: newSession.id,
            branchId: branchId,
          });
        }
      } else {
        workRows = await this.db
          .select()
          .from(taskWork)
          .where(eq(taskWork.shift_session, activeDbSession.id));

        const existingTaskIds = new Set(workRows.map((w: any) => w.task));
        const missingTasks = dbTasks.filter((t: any) => !existingTaskIds.has(t.id));
        if (missingTasks.length > 0) {
          const missingInserts = missingTasks.map((t: any) => ({
            task: t.id,
            shift_session: activeDbSession.id,
            timestamp: null,
          }));
          const addedWorks = await this.db.insert(taskWork).values(missingInserts).returning();
          workRows = [...workRows, ...addedWorks];
        }
      }

      if (taskRole === "stock" && branchId) {
        try {
          const [branchRow] = await this.db
            .select({ refrigerators: branches.refrigerators })
            .from(branches)
            .where(eq(branches.id, branchId))
            .limit(1);

          if (branchRow?.refrigerators && branchRow.refrigerators.length > 0) {
            const activeRefs = await this.db
              .select({ id: refrigerators.id })
              .from(refrigerators)
              .where(
                and(
                  inArray(refrigerators.id, branchRow.refrigerators as string[]),
                  eq(refrigerators.disable_check, false)
                )
              );

            if (activeRefs.length > 0) {
              const existingTasks = await this.db
                .select({ refrigerator_id: refrigeratorTasks.refrigerator_id })
                .from(refrigeratorTasks)
                .where(
                  and(
                    eq(refrigeratorTasks.branch_id, branchId),
                    eq(refrigeratorTasks.task_date, dateStr)
                  )
                );

              const existingRefIds = new Set(existingTasks.map((t: any) => t.refrigerator_id));
              const missingRefs = activeRefs.filter((r: any) => !existingRefIds.has(r.id));
              if (missingRefs.length > 0) {
                await this.db.insert(refrigeratorTasks).values(
                  missingRefs.map((r: any) => ({
                    branch_id: branchId,
                    refrigerator_id: r.id,
                    task_date: dateStr,
                    is_okay: true,
                  }))
                );
              }
            }
          }
        } catch (seedErr) {
          console.error("Failed to seed initial refrigerator_tasks on stock session start:", seedErr);
        }
      }

      const items: ChecklistItem[] = dbTasks.map((t: any) => {
        const work = workRows.find((w: any) => w.task === t.id);
        const timeRange = t.start && t.end ? `${t.start.slice(0, 5)} - ${t.end.slice(0, 5)}` : undefined;
        let isLate = false;
        if (work?.timestamp && t.end) {
          const completedDate = new Date(work.timestamp);
          const [endHour, endMinute] = t.end.split(":").map(Number);
          const deadlineDate = new Date(activeDbSession!.start);
          deadlineDate.setHours(endHour, endMinute, 0, 0);
          if (completedDate > deadlineDate) {
            isLate = true;
          }
        }

        return {
          id: t.id,
          label: t.name,
          category: timeRange ? `ช่วงเวลา ${timeRange}` : undefined,
          completedAt: work?.timestamp ? new Date(work.timestamp).toISOString() : null,
          taskWorkId: work?.id,
          isLate,
          comment: work?.comment ?? null,
        };
      });

      const isAllComplete = items.length > 0 && items.every((i) => i.completedAt !== null);

      const sessionObj: ShiftSession = {
        id: activeDbSession.id,
        userId: validUserId,
        userName: userName,
        userPosition: position,
        shift: shift,
        startedAt: new Date(activeDbSession.start).toISOString(),
        completedAt: activeDbSession.end ? new Date(activeDbSession.end).toISOString() : null,
        items,
        notified: isAllComplete,
        branchName: branchNameForSession,
      };

      return { success: true, session: sessionObj };
    } catch (err: any) {
      console.error("ChecklistService.getOrCreateShiftSession error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการดึงข้อมูลเช็คลิสต์" };
    }
  }

  async toggleTaskWork(params: {
    taskWorkId?: string;
    shiftSessionId?: string;
    taskId?: string;
    completed: boolean;
    comment?: string;
  }): Promise<{ success: boolean; completedAt?: string | null; error?: string }> {
    try {
      const { taskWorkId, shiftSessionId, taskId, completed, comment } = params;
      const completedAt = completed ? new Date() : null;

      let targetShiftSessionId = shiftSessionId;

      if (taskWorkId && isValidUuid(taskWorkId)) {
        await this.db
          .update(taskWork)
          .set({
            timestamp: completedAt,
            comment: completed ? (comment ?? null) : null,
          })
          .where(eq(taskWork.id, taskWorkId));

        if (!targetShiftSessionId) {
          const [work] = await this.db
            .select({ shift_session: taskWork.shift_session })
            .from(taskWork)
            .where(eq(taskWork.id, taskWorkId))
            .limit(1);
          if (work) {
            targetShiftSessionId = work.shift_session;
          }
        }
      } else if (shiftSessionId && taskId && isValidUuid(shiftSessionId) && isValidUuid(taskId)) {
        const [existing] = await this.db
          .select({ id: taskWork.id })
          .from(taskWork)
          .where(and(eq(taskWork.shift_session, shiftSessionId), eq(taskWork.task, taskId)))
          .limit(1);

        if (existing) {
          await this.db
            .update(taskWork)
            .set({
              timestamp: completedAt,
              comment: completed ? (comment ?? null) : null,
            })
            .where(eq(taskWork.id, existing.id));
        } else {
          await this.db.insert(taskWork).values({
            shift_session: shiftSessionId,
            task: taskId,
            timestamp: completedAt,
            comment: completed ? (comment ?? null) : null,
          });
        }
      } else {
        return { success: false, error: "ข้อมูลระบุรายการไม่ถูกต้อง" };
      }

      if (targetShiftSessionId && isValidUuid(targetShiftSessionId)) {
        const [sess] = await this.db
          .select({ branch: shiftSession.branch, user: shiftSession.user, shift: shiftSession.shift })
          .from(shiftSession)
          .where(eq(shiftSession.id, targetShiftSessionId))
          .limit(1);

        if (sess && sess.branch) {
          await this.db
            .update(branches)
            .set({ last_update: new Date() })
            .where(eq(branches.id, sess.branch));

          // Check if all tasks for session are now completed to trigger notification
          if (completed && this.notificationService) {
            const works = await this.db
              .select()
              .from(taskWork)
              .where(eq(taskWork.shift_session, targetShiftSessionId));

            const allDone = works.length > 0 && works.every((w: any) => w.timestamp !== null);
            if (allDone) {
              const [userObj] = await this.db
                .select({ name: users.name })
                .from(users)
                .where(eq(users.id, sess.user))
                .limit(1);

              const shiftName =
                sess.shift === "morning"
                  ? "กะเช้า"
                  : sess.shift === "afternoon"
                  ? "กะบ่าย"
                  : "กะดึก";

              // Notify manager
              await this.notificationService.createNotification({
                branchId: sess.branch,
                recipientRole: "manager",
                title: `📋 ส่งงานสำเร็จ: ${shiftName}`,
                message: `${userObj?.name || "พนักงาน"} ได้เช็ครายการงานครบทุกข้อแล้ว กรุณาตรวจสอบและอนุมัติ`,
                type: "shift_submitted",
                shiftSessionId: targetShiftSessionId,
              });

              // Notify employee
              await this.notificationService.createNotification({
                recipientId: sess.user,
                title: `✨ ทำรายการตรวจครบ 100% แล้ว`,
                message: `คุณได้ตรวจสอบรายการงานกะ ${shiftName} ครบทุกข้อแล้ว กรุณากด "จบกะงาน" เพื่อส่งรายงานให้ผู้จัดการร้าน`,
                type: "shift_submitted",
                shiftSessionId: targetShiftSessionId,
                branchId: sess.branch,
              });
            }
          }
        }
      }

      return { success: true, completedAt: completedAt ? completedAt.toISOString() : null };
    } catch (err: any) {
      console.error("ChecklistService.toggleTaskWork error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการบันทึกสถานะงาน" };
    }
  }

  async endShiftSession(shiftSessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!isValidUuid(shiftSessionId)) {
        return { success: false, error: "ID ของกะไม่ถูกต้อง" };
      }

      const [endedSession] = await this.db
        .update(shiftSession)
        .set({
          end: new Date(),
        })
        .where(eq(shiftSession.id, shiftSessionId))
        .returning();

      if (endedSession && this.notificationService) {
        const [u] = await this.db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, endedSession.user))
          .limit(1);

        const shiftName = endedSession.shift === "morning" ? "กะเช้า" : endedSession.shift === "afternoon" ? "กะบ่าย" : "กะเช้า-บ่าย";

        // Notify employee
        await this.notificationService.createNotification({
          recipientId: endedSession.user,
          title: `🏁 บันทึกการจบกะงานสำเร็จ`,
          message: `คุณได้ส่งมอบกะงาน ${shiftName} เรียบร้อยแล้ว รายงานถูกส่งไปยังผู้จัดการร้านเพื่อตรวจรับรองและให้แต้มรางวัล`,
          type: "shift_submitted",
          shiftSessionId: endedSession.id,
          branchId: endedSession.branch,
        });

        // Notify branch managers
        await this.notificationService.createNotification({
          branchId: endedSession.branch,
          recipientRole: "manager",
          title: `🏁 พนักงานจบกะงาน: ${u?.name || "พนักงาน"}`,
          message: `${u?.name || "พนักงาน"} ได้ส่งมอบและจบกะงาน ${shiftName} ประจำสาขาเรียบร้อยแล้ว พร้อมให้เข้าตรวจรับรอง`,
          type: "shift_submitted",
          shiftSessionId: endedSession.id,
        });
      }

      return { success: true };
    } catch (err: any) {
      console.error("ChecklistService.endShiftSession error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการจบกะ" };
    }
  }

  async getPositionShiftsStatus(position: string, userId?: string): Promise<{
    success: boolean;
    statuses?: Record<ShiftType, { status: "completed" | "incomplete" | "none"; total: number; done: number }>;
    error?: string;
  }> {
    try {
      const taskRole = mapPositionToTaskRole(position);
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const whereConditions = [
        eq(shiftSession.task_role, taskRole),
        gte(shiftSession.start, startOfDay),
        lte(shiftSession.start, endOfDay),
      ];

      if (userId && isValidUuid(userId)) {
        whereConditions.push(eq(shiftSession.user, userId));
      }

      const todaySessions = await this.db
        .select()
        .from(shiftSession)
        .where(and(...whereConditions))
        .orderBy(desc(shiftSession.start));

      const result: Record<ShiftType, { status: "completed" | "incomplete" | "none"; total: number; done: number }> = {
        morning: { status: "none", total: 0, done: 0 },
        afternoon: { status: "none", total: 0, done: 0 },
        both: { status: "none", total: 0, done: 0 },
      };

      const shiftMap: Record<"morning" | "afternoon" | "morning_afternoon", ShiftType> = {
        morning: "morning",
        afternoon: "afternoon",
        morning_afternoon: "both",
      };

      const sessionIds = todaySessions.map((s: any) => s.id) as string[];
      let allWorks: any[] = [];
      if (sessionIds.length > 0) {
        allWorks = await this.db
          .select()
          .from(taskWork)
          .where(inArray(taskWork.shift_session, sessionIds));
      }

      for (const [dbShift, uiShift] of Object.entries(shiftMap) as Array<
        ["morning" | "afternoon" | "morning_afternoon", ShiftType]
      >) {
        const sess = todaySessions.find((s: any) => s.shift === dbShift);
        if (!sess) continue;

        const works = allWorks.filter((w: any) => w.shift_session === sess.id);
        const total = works.length;
        const done = works.filter((w: any) => w.timestamp !== null).length;
        const isAllDone = total > 0 && done === total;
        const hasActivity = done > 0 || sess.end !== null;

        result[uiShift] = {
          status: !hasActivity ? "none" : isAllDone ? "completed" : "incomplete",
          total,
          done,
        };
      }

      return { success: true, statuses: result };
    } catch (err: any) {
      console.error("ChecklistService.getPositionShiftsStatus error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการโหลดสถานะกะ" };
    }
  }

  async resetTodayChecklistData(position?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const conditions = [gte(shiftSession.start, startOfDay), lte(shiftSession.start, endOfDay)];

      if (position) {
        const taskRole = mapPositionToTaskRole(position);
        conditions.push(eq(shiftSession.task_role, taskRole));
      }

      const sessionsToDelete = await this.db
        .select({ id: shiftSession.id })
        .from(shiftSession)
        .where(and(...conditions));

      const sessionIds = sessionsToDelete.map((s: any) => s.id) as string[];

      if (sessionIds.length > 0) {
        await this.db.delete(taskWork).where(inArray(taskWork.shift_session, sessionIds));
        await this.db.delete(shiftSession).where(inArray(shiftSession.id, sessionIds));
      }

      return { success: true };
    } catch (err: any) {
      console.error("ChecklistService.resetTodayChecklistData error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการรีเซ็ตข้อมูล" };
    }
  }

  async autoEndUnfinishedShifts(): Promise<{
    success: boolean;
    endedCount: number;
    sessions?: Array<{
      sessionId: string;
      userId: string;
      userName: string;
      branchId: string;
      shift: string;
      totalItems: number;
      completedItems: number;
    }>;
    error?: string;
  }> {
    try {
      // Find all shifts that have started but have not ended
      const unclosedSessions = await this.db
        .select({
          id: shiftSession.id,
          user: shiftSession.user,
          branch: shiftSession.branch,
          task_role: shiftSession.task_role,
          shift: shiftSession.shift,
          start: shiftSession.start,
        })
        .from(shiftSession)
        .where(isNull(shiftSession.end));

      if (unclosedSessions.length === 0) {
        return { success: true, endedCount: 0, sessions: [] };
      }

      const now = new Date();
      const sessionIds: string[] = unclosedSessions.map((s: any) => s.id);

      // End all unclosed sessions
      await this.db
        .update(shiftSession)
        .set({ end: now })
        .where(inArray(shiftSession.id, sessionIds));

      // Fetch user and branch names
      const userIds = Array.from(new Set(unclosedSessions.map((s: any) => s.user))) as string[];
      const branchIds = Array.from(new Set(unclosedSessions.map((s: any) => s.branch))) as string[];

      const userRows =
        userIds.length > 0
          ? await this.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds))
          : [];
      const userMap = new Map<string, string>(userRows.map((u: any) => [u.id, u.name]));

      const branchRows =
        branchIds.length > 0
          ? await this.db.select({ id: branches.id, name: branches.name }).from(branches).where(inArray(branches.id, branchIds))
          : [];
      const branchMap = new Map<string, string>(branchRows.map((b: any) => [b.id, b.name]));

      // Fetch task works for these sessions to report checklist completion
      const works = await this.db
        .select({
          id: taskWork.id,
          shift_session: taskWork.shift_session,
          timestamp: taskWork.timestamp,
        })
        .from(taskWork)
        .where(inArray(taskWork.shift_session, sessionIds));

      const processedSessions: Array<{
        sessionId: string;
        userId: string;
        userName: string;
        branchId: string;
        shift: string;
        totalItems: number;
        completedItems: number;
      }> = [];

      for (const sess of unclosedSessions) {
        const sessWorks = works.filter((w: any) => w.shift_session === sess.id);
        const totalItems = sessWorks.length;
        const completedItems = sessWorks.filter((w: any) => w.timestamp !== null).length;
        const userName = userMap.get(sess.user) || "พนักงาน";
        const branchName = branchMap.get(sess.branch) || "สาขา";
        const shiftTitle =
          sess.shift === "morning"
            ? "กะเช้า"
            : sess.shift === "afternoon"
            ? "กะบ่าย"
            : "กะเช้า-บ่าย";
        const roleTitle =
          sess.task_role === "cashier"
            ? "แคชเชียร์"
            : sess.task_role === "stock"
            ? "สต็อก"
            : "ผู้ช่วยผู้จัดการ";

        processedSessions.push({
          sessionId: sess.id,
          userId: sess.user,
          userName,
          branchId: sess.branch,
          shift: sess.shift,
          totalItems,
          completedItems,
        });

        if (this.notificationService) {
          const detailMsg = `${userName} (${roleTitle}) ไม่ได้ทำการกดจบกะ ระบบจึงทำการปิดกะงาน${shiftTitle} ประจำ${branchName} อัตโนมัติเมื่อสิ้นสุดวัน (เช็คลิสต์เสร็จสิ้น ${completedItems}/${totalItems} รายการ)`;

          // 1. Notify Manager of branch
          await this.notificationService.createNotification({
            branchId: sess.branch,
            recipientRole: "manager",
            title: `⚠️ แจ้งเตือน: ระบบปิดกะงานอัตโนมัติ (${shiftTitle})`,
            message: detailMsg,
            type: "system",
            shiftSessionId: sess.id,
          });

          // 2. Notify Assistant Manager of branch
          await this.notificationService.createNotification({
            branchId: sess.branch,
            recipientRole: "manager_assistant",
            title: `⚠️ แจ้งเตือน: ระบบปิดกะงานอัตโนมัติ (${shiftTitle})`,
            message: detailMsg,
            type: "system",
            shiftSessionId: sess.id,
          });

          // 3. Notify the employee themselves
          await this.notificationService.createNotification({
            recipientId: sess.user,
            branchId: sess.branch,
            title: `⚠️ ระบบปิดกะงานของคุณอัตโนมัติ (${shiftTitle})`,
            message: `ระบบได้ทำการปิดกะงานของคุณโดยอัตโนมัติเมื่อสิ้นสุดวันปฏิบัติงาน เนื่องจากไม่ได้กดส่งมอบงาน (เช็คลิสต์เสร็จสิ้น ${completedItems}/${totalItems} รายการ)`,
            type: "system",
            shiftSessionId: sess.id,
          });
        }
      }

      return {
        success: true,
        endedCount: unclosedSessions.length,
        sessions: processedSessions,
      };
    } catch (err: any) {
      console.error("ChecklistService.autoEndUnfinishedShifts error:", err);
      return { success: false, endedCount: 0, error: err?.message || "เกิดข้อผิดพลาดในการปิดกะงานอัตโนมัติ" };
    }
  }

  async cleanupOldData(retentionDays: number = 14): Promise<{
    success: boolean;
    cutoffDate?: string;
    deleted?: {
      shiftSessions: number;
      taskWorks: number;
      refrigeratorTasks: number;
      notifications: number;
      pointTransactions: number;
    };
    error?: string;
  }> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      const y = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(cutoffDate);
      const m = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", month: "2-digit" }).format(cutoffDate);
      const d = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", day: "2-digit" }).format(cutoffDate);
      const cutoffDateStr = `${y}-${m}-${d}`;

      // 1. Identify old shift sessions
      const oldSessions = await this.db
        .select({ id: shiftSession.id })
        .from(shiftSession)
        .where(lt(shiftSession.start, cutoffDate));

      const oldSessionIds: string[] = oldSessions.map((s: any) => s.id);
      let deletedTaskWorks = 0;

      if (oldSessionIds.length > 0) {
        // Delete taskWork referencing these old sessions
        const deletedWorks = await this.db
          .delete(taskWork)
          .where(inArray(taskWork.shift_session, oldSessionIds))
          .returning({ id: taskWork.id });
        deletedTaskWorks = deletedWorks.length;
      }

      // 2. Delete old refrigerator tasks (by created_at, task_date, or session_id)
      const refConditions = [
        lt(refrigeratorTasks.created_at, cutoffDate),
        lte(refrigeratorTasks.task_date, cutoffDateStr),
      ];
      if (oldSessionIds.length > 0) {
        refConditions.push(inArray(refrigeratorTasks.shift_session_id, oldSessionIds));
      }

      const deletedRefs = await this.db
        .delete(refrigeratorTasks)
        .where(or(...refConditions))
        .returning({ id: refrigeratorTasks.id });

      // 3. Delete old point transactions referencing old sessions or created before cutoff
      const pointConditions = [lt(pointTransactions.created_at, cutoffDate)];
      if (oldSessionIds.length > 0) {
        pointConditions.push(inArray(pointTransactions.shift_session_id, oldSessionIds));
      }

      const deletedPoints = await this.db
        .delete(pointTransactions)
        .where(or(...pointConditions))
        .returning({ id: pointTransactions.id });

      // 4. Delete old notifications referencing old sessions or created before cutoff
      const notifConditions = [lt(notifications.created_at, cutoffDate)];
      if (oldSessionIds.length > 0) {
        notifConditions.push(inArray(notifications.shift_session_id, oldSessionIds));
      }

      const deletedNotifs = await this.db
        .delete(notifications)
        .where(or(...notifConditions))
        .returning({ id: notifications.id });

      // 5. Delete old shift sessions
      let deletedSessions = 0;
      if (oldSessionIds.length > 0) {
        const deletedSess = await this.db
          .delete(shiftSession)
          .where(inArray(shiftSession.id, oldSessionIds))
          .returning({ id: shiftSession.id });
        deletedSessions = deletedSess.length;
      }

      return {
        success: true,
        cutoffDate: cutoffDate.toISOString(),
        deleted: {
          shiftSessions: deletedSessions,
          taskWorks: deletedTaskWorks,
          refrigeratorTasks: deletedRefs.length,
          notifications: deletedNotifs.length,
          pointTransactions: deletedPoints.length,
        },
      };
    } catch (err: any) {
      console.error("ChecklistService.cleanupOldData error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการล้างข้อมูลเก่า" };
    }
  }
}
