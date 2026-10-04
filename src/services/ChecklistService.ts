import { eq, and, or, gte, lte, lt, desc, asc, inArray, isNull, sql } from "drizzle-orm";
import { tasks, taskWork, shiftSession, users, branches, refrigerators, refrigeratorTasks, notifications, pointTransactions, employeeLeaves } from "../db/schema";
import { IChecklistService, INotificationService } from "./types";
import { ShiftSession, ShiftType, ChecklistItem } from "../types";

export function isSpecialZeroPointTask(taskName: string): boolean {
  const lower = (taskName || "").toLowerCase();
  return (
    lower.includes("turn off light") ||
    lower.includes("turn off refriderator") ||
    lower.includes("turn off refrigerator") ||
    lower.includes("turn off air conditioning") ||
    lower.includes("lock the store") ||
    lower.includes("ปิดไฟส่องสว่าง") ||
    lower.includes("ปิดไฟตู้แช่") ||
    lower.includes("ปิดเครื่องปรับอากาศ") ||
    lower.includes("ปิดแอร์") ||
    lower.includes("ล็อคประตูร้าน") ||
    lower.includes("ล็อคร้าน")
  );
}

function mapPositionToTaskRole(pos: string): "cashier" | "stock" | "manager_assistant" {
  if (pos.includes("แคชเชียร์") || pos.includes("cashier")) return "cashier";
  if (pos.includes("สต็อก") || pos.includes("stock")) return "stock";
  if (pos.includes("ผู้ช่วย") || pos.includes("assistant") || pos.includes("ผู้จัดการ") || pos.includes("manager")) return "manager_assistant";
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
        const targetRoles = taskRole === "manager_assistant" ? ["manager", "manager_assistant"] : ["employee"];
        const [foundUser] = await this.db
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.role, targetRoles as any))
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

      const [currentUserRecord] = await this.db
        .select({ branchId: users.branch_id, role: users.role })
        .from(users)
        .where(eq(users.id, validUserId))
        .limit(1);

      let branchId: string = "";
      let branchNameForSession: string = "";

      if (currentUserRecord?.branchId) {
        const [b] = await this.db
          .select({ id: branches.id, name: branches.name })
          .from(branches)
          .where(eq(branches.id, currentUserRecord.branchId))
          .limit(1);
        if (b) {
          branchId = b.id;
          branchNameForSession = b.name;
        }
      }

      if (!branchId!) {
        const [anyBranch] = await this.db
          .select({ id: branches.id, name: branches.name })
          .from(branches)
          .limit(1);
        if (anyBranch) {
          branchId = anyBranch.id;
          branchNameForSession = anyBranch.name;
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

      // Manager role policy: Managers do NOT do regular assistant manager tasks,
      // ONLY the special store closing tasks (4 safety items).
      const isManager =
        currentUserRecord?.role === "manager" ||
        ((position.includes("ผู้จัดการ") || position.includes("manager")) &&
          !position.includes("ผู้ช่วย") &&
          !position.includes("assistant"));

      if (isManager) {
        dbTasks = dbTasks.filter((t: any) => t.is_special || isSpecialZeroPointTask(t.name));
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
        // Auto-close any unended shift sessions from previous days for this user
        await this.db
          .update(shiftSession)
          .set({ end: startOfDay })
          .where(
            and(
              eq(shiftSession.user, validUserId),
              isNull(shiftSession.end),
              lt(shiftSession.start, startOfDay)
            )
          );

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
            branch_id: branchId,
            task_date: dateStr,
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
            branch_id: branchId,
            task_date: dateStr,
            timestamp: null,
          }));
          const addedWorks = await this.db.insert(taskWork).values(missingInserts).returning();
          workRows = [...workRows, ...addedWorks];
        }
      }

      if (taskRole === "stock" && branchId) {
        try {
          const activeRefs = await this.db
            .select({ id: refrigerators.id })
            .from(refrigerators)
            .where(
              and(
                eq(refrigerators.branch_id, branchId),
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
        } catch (seedErr) {
          console.error("Failed to seed initial refrigerator_tasks on stock session start:", seedErr);
        }
      }

      // Query shared store closing tasks for this branch today from taskWork
      const specialTaskIds = dbTasks.filter((t: any) => t.is_special || isSpecialZeroPointTask(t.name)).map((t: any) => t.id);
      const branchClosingMap = new Map<
        string,
        {
          completedAt: string;
          completedBy: string | null;
          completedByName: string | null;
          comment: string | null;
        }
      >();

      if (specialTaskIds.length > 0 && branchId) {
        try {
          const closingRows = await this.db
            .select({
              taskId: taskWork.task,
              completedAt: taskWork.timestamp,
              completedBy: taskWork.completed_by,
              comment: taskWork.comment,
              userName: users.name,
              userRole: users.role,
            })
            .from(taskWork)
            .leftJoin(users, eq(users.id, taskWork.completed_by))
            .where(
              and(
                eq(taskWork.branch_id, branchId),
                eq(taskWork.task_date, dateStr),
                inArray(taskWork.task, specialTaskIds),
                sql`${taskWork.timestamp} IS NOT NULL`
              )
            );

          for (const row of closingRows) {
            if (row.completedAt) {
              const roleTitle =
                row.userRole === "manager"
                  ? "ผู้จัดการร้าน"
                  : row.userRole === "manager_assistant"
                  ? "ผู้ช่วยผู้จัดการร้าน"
                  : "";
              const posSuffix = roleTitle ? ` (${roleTitle})` : "";
              const completedByName = row.userName ? `${row.userName}${posSuffix}` : null;
              branchClosingMap.set(row.taskId, {
                completedAt: new Date(row.completedAt).toISOString(),
                completedBy: row.completedBy ?? null,
                completedByName,
                comment: row.comment ?? null,
              });
            }
          }
        } catch (closingErr) {
          console.error("Failed to query shared store closing tasks in getOrCreateShiftSession:", closingErr);
        }
      }

      const items: ChecklistItem[] = dbTasks.map((t: any) => {
        const work = workRows.find((w: any) => w.task === t.id);
        const timeRange = t.start && t.end ? `${t.start.slice(0, 5)} - ${t.end.slice(0, 5)}` : undefined;

        const isSpecial = isSpecialZeroPointTask(t.name);
        const sharedClosing = isSpecial ? branchClosingMap.get(t.id) : undefined;

        let completedAt: string | null = null;
        let completedBy: string | null = null;
        let completedByName: string | null = null;
        let taskComment: string | null = work?.comment ?? null;

        if (isSpecial) {
          if (sharedClosing) {
            completedAt = sharedClosing.completedAt;
            completedBy = sharedClosing.completedBy;
            completedByName = sharedClosing.completedByName;
            taskComment = sharedClosing.comment ?? taskComment;

            // Sync this session's work row in DB if not already set
            if (work && !work.timestamp) {
              void this.db
                .update(taskWork)
                .set({ timestamp: new Date(sharedClosing.completedAt), comment: taskComment })
                .where(eq(taskWork.id, work.id));
            }
          } else {
            // Not completed in shared branch tasks
            completedAt = null;
            if (work?.timestamp) {
              // Stale timestamp in this session's work row, clear it
              void this.db
                .update(taskWork)
                .set({ timestamp: null, comment: null })
                .where(eq(taskWork.id, work.id));
            }
          }
        } else {
          completedAt = work?.timestamp ? new Date(work.timestamp).toISOString() : null;
        }

        let isLate = false;
        if (completedAt && t.end) {
          const completedDate = new Date(completedAt);
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
          completedAt,
          completedBy,
          completedByName,
          taskWorkId: work?.id,
          isLate,
          comment: taskComment,
          isSpecial,
          zeroPoints: isSpecial,
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
        incompleteReason: activeDbSession.incomplete_reason || null,
        incompleteStatus: (activeDbSession.incomplete_status as any) || "none",
        incompleteAction: activeDbSession.incomplete_action || null,
        incompleteActionPoints: activeDbSession.incomplete_action_points || 0,
        incompleteActionNote: activeDbSession.incomplete_action_note || null,
        incompleteReviewedBy: activeDbSession.incomplete_reviewed_by || null,
        incompleteReviewedAt: activeDbSession.incomplete_reviewed_at ? new Date(activeDbSession.incomplete_reviewed_at).toISOString() : null,
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
  }): Promise<{ success: boolean; completedAt?: string | null; taskWorkId?: string; error?: string }> {
    try {
      const { taskWorkId, shiftSessionId, taskId, completed, comment } = params;
      const completedAt = completed ? new Date() : null;

      let targetShiftSessionId = shiftSessionId;
      let resolvedTaskWorkId = taskWorkId;

      if (taskWorkId && isValidUuid(taskWorkId)) {
        const updatedRows = await this.db
          .update(taskWork)
          .set({
            timestamp: completedAt,
            comment: completed ? (comment ?? null) : null,
          })
          .where(eq(taskWork.id, taskWorkId))
          .returning({ id: taskWork.id, shift_session: taskWork.shift_session });

        if (updatedRows && updatedRows.length > 0) {
          if (!targetShiftSessionId) {
            targetShiftSessionId = updatedRows[0].shift_session;
          }
          resolvedTaskWorkId = updatedRows[0].id;
        } else if (shiftSessionId && taskId && isValidUuid(shiftSessionId) && isValidUuid(taskId)) {
          // If taskWorkId didn't match an existing row, fallback to (shift_session, task)
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
            resolvedTaskWorkId = existing.id;
          } else {
            const [inserted] = await this.db
              .insert(taskWork)
              .values({
                shift_session: shiftSessionId,
                task: taskId,
                timestamp: completedAt,
                comment: completed ? (comment ?? null) : null,
              })
              .returning({ id: taskWork.id });
            resolvedTaskWorkId = inserted?.id;
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
          resolvedTaskWorkId = existing.id;
        } else {
          const [inserted] = await this.db
            .insert(taskWork)
            .values({
              shift_session: shiftSessionId,
              task: taskId,
              timestamp: completedAt,
              comment: completed ? (comment ?? null) : null,
            })
            .returning({ id: taskWork.id });
          resolvedTaskWorkId = inserted?.id;
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
          // Special store closing task shared branch sync
          let resolvedTaskId = taskId;
          if (!resolvedTaskId && taskWorkId && isValidUuid(taskWorkId)) {
            const [w] = await this.db
              .select({ task: taskWork.task })
              .from(taskWork)
              .where(eq(taskWork.id, taskWorkId))
              .limit(1);
            if (w) resolvedTaskId = w.task;
          }

          if (resolvedTaskId && isValidUuid(resolvedTaskId)) {
            const [tRow] = await this.db
              .select({ name: tasks.name, is_special: tasks.is_special })
              .from(tasks)
              .where(eq(tasks.id, resolvedTaskId))
              .limit(1);

            if (tRow && (tRow.is_special || isSpecialZeroPointTask(tRow.name))) {
              const { dateStr, startOfDay, endOfDay } = getThaiStartAndEndOfDay();
              try {
                // Sync all today's sessions in this branch for this special task
                const branchTodaySessions = await this.db
                  .select({ id: shiftSession.id })
                  .from(shiftSession)
                  .where(
                    and(
                      eq(shiftSession.branch, sess.branch),
                      gte(shiftSession.start, startOfDay),
                      lte(shiftSession.start, endOfDay)
                    )
                  );
                const branchSessIds = branchTodaySessions.map((s: any) => s.id);
                if (branchSessIds.length > 0) {
                  await this.db
                    .update(taskWork)
                    .set({
                      timestamp: completedAt,
                      comment: completed ? (comment ?? null) : null,
                      completed_by: completed ? sess.user : null,
                      branch_id: sess.branch,
                      task_date: dateStr,
                    })
                    .where(
                      and(
                        inArray(taskWork.shift_session, branchSessIds),
                        eq(taskWork.task, resolvedTaskId)
                      )
                    );
                }
              } catch (sharedErr) {
                console.error("Failed to sync shared special tasks:", sharedErr);
              }
            }
          }

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

      return {
        success: true,
        completedAt: completedAt ? completedAt.toISOString() : null,
        taskWorkId: resolvedTaskWorkId,
      };
    } catch (err: any) {
      console.error("ChecklistService.toggleTaskWork error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการบันทึกสถานะงาน" };
    }
  }

  async validateShiftCompletion(shiftSessionId: string): Promise<{
    success: boolean;
    isComplete: boolean;
    totalTasks: number;
    doneTasks: number;
    pendingTasks: Array<{ id: string; name: string }>;
    error?: string;
  }> {
    try {
      if (!isValidUuid(shiftSessionId)) {
        return { success: false, isComplete: false, totalTasks: 0, doneTasks: 0, pendingTasks: [], error: "ID ของกะไม่ถูกต้อง" };
      }

      const [sess] = await this.db
        .select()
        .from(shiftSession)
        .where(eq(shiftSession.id, shiftSessionId))
        .limit(1);

      if (!sess) {
        return { success: false, isComplete: false, totalTasks: 0, doneTasks: 0, pendingTasks: [], error: "ไม่พบข้อมูลกะในระบบ" };
      }

      const allowedShifts: ("morning" | "afternoon" | "morning_afternoon")[] =
        sess.shift === "morning_afternoon"
          ? ["morning", "afternoon", "morning_afternoon"]
          : [sess.shift, "morning_afternoon"];

      const dbTasks = await this.db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.task_role, sess.task_role),
            inArray(tasks.shift, allowedShifts),
            eq(tasks.disabled, false)
          )
        );

      const [sessUser] = await this.db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, sess.user))
        .limit(1);

      const isManagerUser = sessUser?.role === "manager";

      let activeTasks = dbTasks;

      if (isManagerUser && sess.task_role === "manager_assistant") {
        activeTasks = activeTasks.filter((t: any) => t.is_special || isSpecialZeroPointTask(t.name));
      }

      const works = await this.db
        .select({
          taskId: taskWork.task,
          timestamp: taskWork.timestamp,
        })
        .from(taskWork)
        .where(eq(taskWork.shift_session, shiftSessionId));

      const doneTaskIds = new Set(
        works.filter((w: any) => w.timestamp !== null).map((w: any) => w.taskId)
      );

      const pendingTasks: Array<{ id: string; name: string }> = [];
      for (const t of activeTasks) {
        if (!doneTaskIds.has(t.id)) {
          pendingTasks.push({ id: t.id, name: t.name });
        }
      }

      const totalTasks = activeTasks.length;
      const doneTasks = totalTasks - pendingTasks.length;
      const isComplete = totalTasks > 0 && pendingTasks.length === 0;

      return {
        success: true,
        isComplete,
        totalTasks,
        doneTasks,
        pendingTasks,
      };
    } catch (err: any) {
      console.error("ChecklistService.validateShiftCompletion error:", err);
      return { success: false, isComplete: false, totalTasks: 0, doneTasks: 0, pendingTasks: [], error: err?.message || "ตรวจสอบสถานะงานไม่สำเร็จ" };
    }
  }

  async endShiftSession(params: string | { shiftSessionId: string; reason?: string }): Promise<{ success: boolean; error?: string }> {
    try {
      const shiftSessionId = typeof params === "string" ? params : params.shiftSessionId;
      const rawReason = typeof params === "string" ? undefined : params.reason?.trim();

      if (!isValidUuid(shiftSessionId)) {
        return { success: false, error: "ID ของกะไม่ถูกต้อง" };
      }

      // Check online validation from DB directly
      const validation = await this.validateShiftCompletion(shiftSessionId);
      if (!validation.success) {
        return { success: false, error: validation.error || "ไม่สามารถตรวจสอบสถานะงานในฐานข้อมูลได้" };
      }

      const isIncomplete = !validation.isComplete;
      if (isIncomplete && !rawReason) {
        return {
          success: false,
          error: `ตรวจพบงานค้าง ${validation.pendingTasks.length} ข้อในระบบ กรุณาระบุเหตุผลที่ไม่สามารถทำงานให้ครบถ้วนก่อนจบกะ`,
        };
      }

      const now = new Date();
      const [endedSession] = await this.db
        .update(shiftSession)
        .set({
          end: now,
          incomplete_reason: isIncomplete ? rawReason : null,
          incomplete_status: isIncomplete ? "pending_review" : "none",
        })
        .where(eq(shiftSession.id, shiftSessionId))
        .returning();

      if (endedSession && this.notificationService) {
        const [u] = await this.db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, endedSession.user))
          .limit(1);

        const shiftName =
          endedSession.shift === "morning"
            ? "กะเช้า"
            : endedSession.shift === "afternoon"
            ? "กะบ่าย"
            : "กะเช้า-บ่าย";

        if (isIncomplete) {
          // Notify both manager and assistant manager of the branch
          const pendingCount = validation.pendingTasks.length;
          const notifMsg = `พนักงาน ${u?.name || "พนักงาน"} ได้จบกะ ${shiftName} โดยเหลืองานค้าง ${pendingCount} ข้อ เหตุผล: "${rawReason}" กรุณาตรวจสอบและพิจารณาการดำเนินการ (หักคะแนน, ตัดสตรีค หรือตัดโควตา)`;

          await this.notificationService.createNotification({
            branchId: endedSession.branch,
            recipientRole: "manager",
            title: `⚠️ จบกะงานไม่ครบ: ${u?.name || "พนักงาน"} (${shiftName})`,
            message: notifMsg,
            type: "incomplete_shift",
            shiftSessionId: endedSession.id,
          });

          await this.notificationService.createNotification({
            branchId: endedSession.branch,
            recipientRole: "manager_assistant",
            title: `⚠️ จบกะงานไม่ครบ: ${u?.name || "พนักงาน"} (${shiftName})`,
            message: notifMsg,
            type: "incomplete_shift",
            shiftSessionId: endedSession.id,
          });

          // Notify employee
          await this.notificationService.createNotification({
            recipientId: endedSession.user,
            title: `⚠️ บันทึกการจบกะ (มีงานค้าง ${pendingCount} ข้อ)`,
            message: `คุณได้จบกะงาน ${shiftName} เรียบร้อยแล้ว เหตุผลของคุณถูกส่งไปยังผู้จัดการและผู้ช่วยผู้จัดการเพื่อพิจารณาการดำเนินการต่อไป`,
            type: "incomplete_shift",
            shiftSessionId: endedSession.id,
            branchId: endedSession.branch,
          });
        } else {
          // Standard full completion notifications
          await this.notificationService.createNotification({
            recipientId: endedSession.user,
            title: `🏁 บันทึกการจบกะงานสำเร็จ`,
            message: `คุณได้ส่งมอบกะงาน ${shiftName} ครบถ้วน 100% เรียบร้อยแล้ว รายงานถูกส่งไปยังผู้จัดการร้านเพื่อตรวจรับรอง`,
            type: "shift_submitted",
            shiftSessionId: endedSession.id,
            branchId: endedSession.branch,
          });

          await this.notificationService.createNotification({
            branchId: endedSession.branch,
            recipientRole: "manager",
            title: `🏁 พนักงานจบกะงาน: ${u?.name || "พนักงาน"}`,
            message: `${u?.name || "พนักงาน"} ได้ส่งมอบและจบกะงาน ${shiftName} ครบ 100% เรียบร้อยแล้ว พร้อมให้เข้าตรวจรับรอง`,
            type: "shift_submitted",
            shiftSessionId: endedSession.id,
          });
        }
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
      const { startOfDay, endOfDay } = getThaiStartAndEndOfDay();

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
      const { startOfDay, endOfDay } = getThaiStartAndEndOfDay();

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

      if (!position || mapPositionToTaskRole(position) === "manager_assistant") {
        const { dateStr } = getThaiStartAndEndOfDay();
        await this.db.delete(taskWork).where(eq(taskWork.task_date, dateStr));
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

  async cleanupOldData(
    retentionDays: number = 14,
    options?: {
      cleanShiftSessions?: boolean;
      cleanRefrigeratorTasks?: boolean;
      cleanNotifications?: boolean;
      cleanPointTransactions?: boolean;
      cleanEmployeeLeaves?: boolean;
    }
  ): Promise<{
    success: boolean;
    cutoffDate?: string;
    deleted?: {
      shiftSessions: number;
      taskWorks: number;
      refrigeratorTasks: number;
      notifications: number;
      pointTransactions: number;
      employeeLeaves: number;
    };
    error?: string;
  }> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      const y = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(cutoffDate);
      const m = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", month: "2-digit" }).format(cutoffDate);
      const d = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", day: "2-digit" }).format(cutoffDate);
      const cutoffDateStr = `${y}-${m}-${d}`;

      const doCleanSessions = options?.cleanShiftSessions !== false;
      const doCleanRefs = options?.cleanRefrigeratorTasks !== false;
      const doCleanPoints = options?.cleanPointTransactions !== false;
      const doCleanNotifs = options?.cleanNotifications !== false;
      const doCleanLeaves = options?.cleanEmployeeLeaves !== false;

      // 1. Identify old shift sessions
      const oldSessions = await this.db
        .select({ id: shiftSession.id })
        .from(shiftSession)
        .where(lt(shiftSession.start, cutoffDate));

      const oldSessionIds: string[] = oldSessions.map((s: { id: string }) => s.id);
      let deletedTaskWorks = 0;

      if (doCleanSessions && oldSessionIds.length > 0) {
        // Delete taskWork referencing these old sessions
        const deletedWorks = await this.db
          .delete(taskWork)
          .where(inArray(taskWork.shift_session, oldSessionIds))
          .returning({ id: taskWork.id });
        deletedTaskWorks = deletedWorks.length;
      }

      // 2. Delete old refrigerator tasks (by created_at, task_date, or session_id)
      let deletedRefsCount = 0;
      if (doCleanRefs) {
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
        deletedRefsCount = deletedRefs.length;
      }

      // 3. Delete old point transactions referencing old sessions or created before cutoff
      let deletedPointsCount = 0;
      if (doCleanPoints) {
        const pointConditions = [lt(pointTransactions.created_at, cutoffDate)];
        if (oldSessionIds.length > 0) {
          pointConditions.push(inArray(pointTransactions.shift_session_id, oldSessionIds));
        }

        const deletedPoints = await this.db
          .delete(pointTransactions)
          .where(or(...pointConditions))
          .returning({ id: pointTransactions.id });
        deletedPointsCount = deletedPoints.length;
      }

      // 4. Delete old notifications referencing old sessions or created before cutoff
      let deletedNotifsCount = 0;
      if (doCleanNotifs) {
        const notifConditions = [lt(notifications.created_at, cutoffDate)];
        if (oldSessionIds.length > 0) {
          notifConditions.push(inArray(notifications.shift_session_id, oldSessionIds));
        }

        const deletedNotifs = await this.db
          .delete(notifications)
          .where(or(...notifConditions))
          .returning({ id: notifications.id });
        deletedNotifsCount = deletedNotifs.length;
      }

      // 5. Delete old shift sessions
      let deletedSessions = 0;
      if (doCleanSessions && oldSessionIds.length > 0) {
        const deletedSess = await this.db
          .delete(shiftSession)
          .where(inArray(shiftSession.id, oldSessionIds))
          .returning({ id: shiftSession.id });
        deletedSessions = deletedSess.length;
      }

      // 6. Delete old employee leaves (where leave period ended <= cutoffDateStr AND record created < cutoffDate)
      let deletedLeaves = 0;
      if (doCleanLeaves) {
        try {
          const deletedLeavesRes = await this.db
            .delete(employeeLeaves)
            .where(
              and(
                lte(employeeLeaves.end_date, cutoffDateStr),
                lt(employeeLeaves.created_at, cutoffDate)
              )
            )
            .returning({ id: employeeLeaves.id });
          deletedLeaves = deletedLeavesRes.length;
        } catch (leaveErr) {
          console.warn("ChecklistService.cleanupOldData: could not clean employeeLeaves:", leaveErr);
        }
      }

      return {
        success: true,
        cutoffDate: cutoffDate.toISOString(),
        deleted: {
          shiftSessions: deletedSessions,
          taskWorks: deletedTaskWorks,
          refrigeratorTasks: deletedRefsCount,
          notifications: deletedNotifsCount,
          pointTransactions: deletedPointsCount,
          employeeLeaves: deletedLeaves,
        },
      };
    } catch (err: any) {
      console.error("ChecklistService.cleanupOldData error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการล้างข้อมูลเก่า" };
    }
  }
}
