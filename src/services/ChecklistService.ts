import { eq, and, or, gte, lte, lt, desc, asc, inArray, isNull, sql } from "drizzle-orm";
import { tasks, branchTasks, taskWork, shiftSession, users, branches, refrigerators, refrigeratorTasks, notifications, pointTransactions, employeeLeaves, jointTaskWork, specialTasks } from "../db/schema";
import { IChecklistService, INotificationService } from "./types";
import { ShiftSession, ShiftType, ChecklistItem, JointTaskItem, BranchDailyTask } from "../types";
import { getThaiDateString } from "../data/storage";

export function isSpecialZeroPointTask(taskName: string): boolean {
  // Retained for backward compatibility if called with a task name
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
  if (
    pos.includes("ผู้ช่วย") ||
    pos.includes("assistant") ||
    (pos.includes("ผู้จัดการ") && !pos.includes("ผู้จัดการทั่วไป")) ||
    (pos.includes("manager") && !pos.toLowerCase().includes("general manager"))
  ) {
    return "manager_assistant";
  }
  return "cashier";
}

function mapShiftToDbShift(shift: ShiftType): "morning" | "afternoon" | "night" | "morning_afternoon" {
  if (shift === "morning") return "morning";
  if (shift === "afternoon") return "afternoon";
  if (shift === "night") return "night";
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
        const [foundUser] = taskRole === "manager_assistant"
          ? await this.db.select({ id: users.id }).from(users).where(inArray(users.manager_type, ["assistant", "store"])).limit(1)
          : await this.db.select({ id: users.id }).from(users).limit(1);
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
        .select({ 
          branchId: users.branch_id, 
          managerType: users.manager_type,
          executiveType: users.executive_type,
          isAdmin: users.is_admin,
          branchName: branches.name,
        })
        .from(users)
        .leftJoin(branches, eq(branches.id, users.branch_id))
        .where(eq(users.id, validUserId))
        .limit(1);

      // Executive & Committee policy: Executive and Committee must not have any checklist, including the night checklist.
      const isExecutiveOrCommittee =
        currentUserRecord?.executiveType === "executive" ||
        currentUserRecord?.executiveType === "committee" ||
        position.includes("ผู้จัดการทั่วไป") ||
        position.toLowerCase().includes("general manager") ||
        position.includes("กรรมการ");

      if (isExecutiveOrCommittee) {
        return {
          success: false,
          error: "ตำแหน่งกรรมการและผู้บริหารไม่มีรายการเช็คลิสต์การปฏิบัติงาน",
        };
      }

      if (!currentUserRecord?.branchId) {
        return {
          success: false,
          error: "บัญชีของคุณยังไม่ได้รับการกำหนดสาขาประจำการ ไม่สามารถเริ่มกะปฏิบัติงานได้",
        };
      }

      if (!currentUserRecord?.branchName) {
        return {
          success: false,
          error: "ไม่พบข้อมูลสาขาที่สังกัดอยู่ในระบบ กรุณาติดต่อผู้จัดการหรือผู้ดูแลระบบ",
        };
      }

      const branchId: string = currentUserRecord.branchId;
      const branchNameForSession: string = currentUserRecord.branchName;

      const allowedShifts: ("morning" | "afternoon" | "night" | "morning_afternoon")[] =
        dbShift === "morning_afternoon"
          ? ["morning", "afternoon", "night", "morning_afternoon"]
          : [dbShift, "morning_afternoon"];

      const branchTaskCondition = branchId
        ? or(eq(tasks.branch_id, branchId), isNull(tasks.branch_id))
        : isNull(tasks.branch_id);

      const [rawTasks, [existingSession]] = await Promise.all([
        this.db
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.task_role, taskRole),
              inArray(tasks.shift, allowedShifts),
              eq(tasks.disabled, false),
              eq(tasks.is_joint, false),
              branchTaskCondition
            )
          )
          .orderBy(asc(tasks.start)),
        this.db
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
          .limit(1),
      ]);

      let dbTasks = rawTasks;

      // Manager role policy: Managers do NOT do regular assistant manager tasks,
      // ONLY the for_managers tasks (closing/night safety items).
      const isManager =
        ((position.includes("ผู้จัดการ") || position.includes("manager")) &&
          !position.includes("ผู้ช่วย") &&
          !position.includes("assistant")) &&
        currentUserRecord?.executiveType === "none" &&
        !position.includes("ผู้จัดการทั่วไป") &&
        !position.toLowerCase().includes("general manager") &&
        !position.includes("กรรมการ");

      if (isManager) {
        dbTasks = dbTasks.filter((t: any) => t.for_managers || t.shift === "night");
      }

      let activeDbSession = existingSession;
      let workRows: any[] = [];
      const specialTaskIds = dbTasks.filter((t: any) => t.for_managers || t.shift === "night").map((t: any) => t.id);
      const branchClosingMap = new Map<
        string,
        {
          completedAt: string;
          completedBy: string | null;
          completedByName: string | null;
          comment: string | null;
        }
      >();

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
        const [fetchedWorks, closingRows] = await Promise.all([
          this.db
            .select()
            .from(taskWork)
            .where(eq(taskWork.shift_session, activeDbSession.id)),
          specialTaskIds.length > 0 && branchId
            ? this.db
                .select({
                  taskId: taskWork.task,
                  completedAt: taskWork.timestamp,
                  completedBy: taskWork.completed_by,
                  comment: taskWork.comment,
                  userName: users.name,
                  managerType: users.manager_type,
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
                )
                .catch((closingErr: any) => {
                  console.error("Failed to query shared store closing tasks in batch:", closingErr);
                  return [];
                })
            : Promise.resolve([]),
        ]);
        workRows = fetchedWorks;

        for (const row of closingRows) {
          if (row.completedAt) {
            const roleTitle =
              row.managerType === "store"
                ? "ผู้จัดการร้าน"
                : row.managerType === "assistant"
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

      // Query shared store closing tasks for new session if not already populated
      if (branchClosingMap.size === 0 && specialTaskIds.length > 0 && branchId) {
        try {
          const closingRows = await this.db
            .select({
              taskId: taskWork.task,
              completedAt: taskWork.timestamp,
              completedBy: taskWork.completed_by,
              comment: taskWork.comment,
              userName: users.name,
              managerType: users.manager_type,
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
                row.managerType === "store"
                  ? "ผู้จัดการร้าน"
                  : row.managerType === "assistant"
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

        const isSpecial = Boolean(t.for_managers || t.shift === "night");
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
          category: t.category || (timeRange ? `ช่วงเวลา ${timeRange}` : undefined),
          completedAt,
          completedBy,
          completedByName,
          taskWorkId: work?.id,
          isLate,
          comment: taskComment,
          isSpecial,
          forManagers: Boolean(t.for_managers),
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

  async batchToggleTaskWorks(
    items: Array<{
      taskWorkId?: string;
      shiftSessionId?: string;
      taskId?: string;
      completed: boolean;
      comment?: string;
    }>
  ): Promise<{
    success: boolean;
    results?: Array<{
      taskId?: string;
      taskWorkId?: string;
      completed: boolean;
      completedAt?: string | null;
    }>;
    error?: string;
  }> {
    if (!items || items.length === 0) {
      return { success: true, results: [] };
    }

    try {
      // 1. Coalesce/deduplicate items in the batch: latest entry per taskId or taskWorkId wins
      const coalescedMap = new Map<string, (typeof items)[0]>();
      for (const item of items) {
        const key = item.taskId || item.taskWorkId || `${item.shiftSessionId}_${item.taskId}`;
        coalescedMap.set(key, item);
      }
      const uniqueItems = Array.from(coalescedMap.values());

      // 2. Pre-fetch existing taskWorks in a single query
      const explicitWorkIds = uniqueItems
        .map((i) => i.taskWorkId)
        .filter((id): id is string => Boolean(id && isValidUuid(id)));

      const existingWorksById =
        explicitWorkIds.length > 0
          ? await this.db
              .select({ id: taskWork.id, shift_session: taskWork.shift_session, task: taskWork.task })
              .from(taskWork)
              .where(inArray(taskWork.id, explicitWorkIds))
          : [];
      const workByIdMap = new Map<string, { id: string; shift_session: string; task: string }>(
        existingWorksById.map((w: any) => [w.id, w])
      );

      // Pre-fetch existing taskWorks by (shift_session, task) in a single query
      const sessionIdsForQuery = Array.from(
        new Set(uniqueItems.map((i) => i.shiftSessionId).filter((id): id is string => Boolean(id && isValidUuid(id))))
      );
      const taskIdsForQuery = Array.from(
        new Set(uniqueItems.map((i) => i.taskId).filter((id): id is string => Boolean(id && isValidUuid(id))))
      );

      let existingWorksBySessionAndTask: any[] = [];
      if (sessionIdsForQuery.length > 0 && taskIdsForQuery.length > 0) {
        existingWorksBySessionAndTask = await this.db
          .select({ id: taskWork.id, shift_session: taskWork.shift_session, task: taskWork.task })
          .from(taskWork)
          .where(and(inArray(taskWork.shift_session, sessionIdsForQuery), inArray(taskWork.task, taskIdsForQuery)));
      }
      const workBySessionAndTaskMap = new Map<string, { id: string; shift_session: string; task: string }>(
        existingWorksBySessionAndTask.map((w: any) => [`${w.shift_session}_${w.task}`, w])
      );

      // Pre-fetch all sessions involved in a single query
      const allSessionIdsSet = new Set<string>(sessionIdsForQuery);
      for (const w of existingWorksById) {
        if (w.shift_session && isValidUuid(w.shift_session)) {
          allSessionIdsSet.add(w.shift_session);
        }
      }
      const allSessionIds = Array.from(allSessionIdsSet);
      const sessionRows =
        allSessionIds.length > 0
          ? await this.db
              .select({ id: shiftSession.id, branch: shiftSession.branch, user: shiftSession.user, shift: shiftSession.shift })
              .from(shiftSession)
              .where(inArray(shiftSession.id, allSessionIds))
          : [];
      const sessionMap = new Map<string, any>(sessionRows.map((s: any) => [s.id, s]));

      // Pre-fetch all tasks involved in a single query
      const allTaskIdsSet = new Set<string>(taskIdsForQuery);
      for (const w of existingWorksById) {
        if (w.task && isValidUuid(w.task)) {
          allTaskIdsSet.add(w.task);
        }
      }
      const allTaskIds = Array.from(allTaskIdsSet);
      const taskRows =
        allTaskIds.length > 0
          ? await this.db
              .select({ id: tasks.id, name: tasks.name, for_managers: tasks.for_managers, shift: tasks.shift })
              .from(tasks)
              .where(inArray(tasks.id, allTaskIds))
          : [];
      const taskMap = new Map<string, any>(taskRows.map((t: any) => [t.id, t]));

      const affectedBranches = new Set<string>();
      const completedSessionsToCheck = new Set<{ sessionId: string; branchId: string; userId: string; shift: string }>();
      const branchTodaySessionsCache = new Map<string, string[]>();

      const syncSharedSpecialTask = async (
        sess: any,
        tId: string,
        completedAt: Date | null,
        completed: boolean,
        comment?: string
      ) => {
        try {
          let branchSessIds = branchTodaySessionsCache.get(sess.branch);
          if (!branchSessIds) {
            const { startOfDay, endOfDay } = getThaiStartAndEndOfDay();
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
            branchSessIds = branchTodaySessions.map((s: any) => s.id) as string[];
            branchTodaySessionsCache.set(sess.branch, branchSessIds);
          }
          const validBranchSessIds: string[] = branchSessIds || [];
          if (validBranchSessIds.length > 0) {
            const { dateStr } = getThaiStartAndEndOfDay();
            await this.db
              .update(taskWork)
              .set({
                timestamp: completedAt,
                comment: completed ? (comment ?? null) : null,
                completed_by: completed ? sess.user : null,
                branch_id: sess.branch,
                task_date: dateStr,
              })
              .where(and(inArray(taskWork.shift_session, validBranchSessIds), eq(taskWork.task, tId)));
          }
        } catch (sharedErr) {
          console.error("Failed to sync shared special tasks in batch:", sharedErr);
        }
      };

      // 3. Process all item updates/inserts concurrently via Promise.all
      const itemPromises = uniqueItems.map(async (item) => {
        const { taskWorkId, shiftSessionId, taskId, completed, comment } = item;
        const completedAt = completed ? new Date() : null;

        let targetShiftSessionId = shiftSessionId;
        let resolvedTaskWorkId = taskWorkId;
        let resolvedTaskId = taskId;

        if (taskWorkId && isValidUuid(taskWorkId)) {
          const existingRow = workByIdMap.get(taskWorkId);
          if (existingRow) {
            if (!targetShiftSessionId) targetShiftSessionId = existingRow.shift_session;
            if (!resolvedTaskId) resolvedTaskId = existingRow.task;
          }

          const updatedRows = await this.db
            .update(taskWork)
            .set({
              timestamp: completedAt,
              comment: completed ? (comment ?? null) : null,
            })
            .where(eq(taskWork.id, taskWorkId))
            .returning({ id: taskWork.id, shift_session: taskWork.shift_session });

          if (updatedRows && updatedRows.length > 0) {
            resolvedTaskWorkId = updatedRows[0].id;
            if (!targetShiftSessionId) targetShiftSessionId = updatedRows[0].shift_session;
          } else if (shiftSessionId && taskId && isValidUuid(shiftSessionId) && isValidUuid(taskId)) {
            const key = `${shiftSessionId}_${taskId}`;
            const existing = workBySessionAndTaskMap.get(key);
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
          const key = `${shiftSessionId}_${taskId}`;
          const existing = workBySessionAndTaskMap.get(key);
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

        if (targetShiftSessionId && isValidUuid(targetShiftSessionId)) {
          const sess = sessionMap.get(targetShiftSessionId);
          if (sess && sess.branch) {
            affectedBranches.add(sess.branch);
            if (completed) {
              completedSessionsToCheck.add({
                sessionId: targetShiftSessionId,
                branchId: sess.branch,
                userId: sess.user,
                shift: sess.shift,
              });
            }

            if (!resolvedTaskId && resolvedTaskWorkId && workByIdMap.has(resolvedTaskWorkId)) {
              resolvedTaskId = workByIdMap.get(resolvedTaskWorkId)?.task;
            }

            if (resolvedTaskId && isValidUuid(resolvedTaskId)) {
              const tRow = taskMap.get(resolvedTaskId);
              if (tRow && (tRow.for_managers || tRow.shift === "night")) {
                await syncSharedSpecialTask(sess, resolvedTaskId, completedAt, completed, comment);
              }
            }
          }
        }

        return {
          taskId,
          taskWorkId: resolvedTaskWorkId,
          completed,
          completedAt: completedAt ? completedAt.toISOString() : null,
        };
      });

      const results = await Promise.all(itemPromises);

      // 4. Update affected branches in a single query
      if (affectedBranches.size > 0) {
        await this.db
          .update(branches)
          .set({ last_update: new Date() })
          .where(inArray(branches.id, Array.from(affectedBranches)));
      }

      // 5. Evaluate completed sessions in batch for notifications
      if (this.notificationService && completedSessionsToCheck.size > 0) {
        const sessionsToCheckList = Array.from(completedSessionsToCheck);
        const checkSessionIds = sessionsToCheckList.map((s) => s.sessionId);

        const allWorks = await this.db
          .select({ shift_session: taskWork.shift_session, timestamp: taskWork.timestamp })
          .from(taskWork)
          .where(inArray(taskWork.shift_session, checkSessionIds));

        const worksBySession = new Map<string, any[]>();
        for (const w of allWorks) {
          if (!worksBySession.has(w.shift_session)) {
            worksBySession.set(w.shift_session, []);
          }
          worksBySession.get(w.shift_session)!.push(w);
        }

        const userIdsToCheck = Array.from(new Set(sessionsToCheckList.map((s) => s.userId)));
        const userRows =
          userIdsToCheck.length > 0
            ? await this.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIdsToCheck))
            : [];
        const userMap = new Map<string, string>(userRows.map((u: any) => [u.id, u.name]));

        for (const sessionInfo of sessionsToCheckList) {
          const sessWorks = worksBySession.get(sessionInfo.sessionId) || [];
          const allDone = sessWorks.length > 0 && sessWorks.every((w: any) => w.timestamp !== null);
          if (allDone) {
            const userName = userMap.get(sessionInfo.userId) || "พนักงาน";
            const shiftName =
              sessionInfo.shift === "morning"
                ? "กะเช้า"
                : sessionInfo.shift === "afternoon"
                ? "กะบ่าย"
                : "กะดึก";

            await this.notificationService.createNotification({
              branchId: sessionInfo.branchId,
              recipientRole: "manager",
              title: `📋 ส่งงานสำเร็จ: ${shiftName}`,
              message: `${userName} ได้เช็ครายการงานครบทุกข้อแล้ว กรุณาตรวจสอบและอนุมัติ`,
              type: "shift_submitted",
              shiftSessionId: sessionInfo.sessionId,
            });

            await this.notificationService.createNotification({
              recipientId: sessionInfo.userId,
              title: `✨ ทำรายการตรวจครบ 100% แล้ว`,
              message: `คุณได้ตรวจสอบรายการงานกะ ${shiftName} ครบทุกข้อแล้ว กรุณากด "จบกะงาน" เพื่อส่งรายงานให้ผู้จัดการร้าน`,
              type: "shift_submitted",
              shiftSessionId: sessionInfo.sessionId,
              branchId: sessionInfo.branchId,
            });
          }
        }
      }

      return { success: true, results };
    } catch (err: any) {
      console.error("ChecklistService.batchToggleTaskWorks error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการบันทึกสถานะงานแบบกลุ่ม" };
    }
  }

  async toggleTaskWork(params: {
    taskWorkId?: string;
    shiftSessionId?: string;
    taskId?: string;
    completed: boolean;
    comment?: string;
  }): Promise<{ success: boolean; completedAt?: string | null; taskWorkId?: string; error?: string }> {
    const res = await this.batchToggleTaskWorks([params]);
    if (!res.success || !res.results || res.results.length === 0) {
      return { success: false, error: res.error || "เกิดข้อผิดพลาดในการบันทึกสถานะงาน" };
    }
    const r = res.results[0];
    return {
      success: true,
      completedAt: r.completedAt,
      taskWorkId: r.taskWorkId,
    };
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

      const allowedShifts: ("morning" | "afternoon" | "night" | "morning_afternoon")[] =
        sess.shift === "morning_afternoon"
          ? ["morning", "afternoon", "night", "morning_afternoon"]
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
        .select({ managerType: users.manager_type })
        .from(users)
        .where(eq(users.id, sess.user))
        .limit(1);

      const isManagerUser = sessUser?.managerType === "store";

      let activeTasks = dbTasks;

      if (isManagerUser && sess.task_role === "manager_assistant") {
        activeTasks = activeTasks.filter((t: any) => t.for_managers || t.shift === "night");
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

      // For stock role: Check whether all active refrigerators for this branch & shift are finished
      let refTotal = 0;
      let refDone = 0;
      if (sess.task_role === "stock") {
        const todayStr = getThaiDateString(sess.start);
        const refShiftsToCheck: ("morning" | "afternoon")[] =
          sess.shift === "afternoon"
            ? ["afternoon"]
            : sess.shift === "morning"
            ? ["morning"]
            : ["morning", "afternoon"];

        const activeBranchRefs = await this.db
          .select({ id: refrigerators.id, name: refrigerators.name })
          .from(refrigerators)
          .where(and(eq(refrigerators.branch_id, sess.branch), eq(refrigerators.disable_check, false)));

        if (activeBranchRefs.length > 0) {
          const refTasksToday = await this.db
            .select()
            .from(refrigeratorTasks)
            .where(
              and(
                eq(refrigeratorTasks.branch_id, sess.branch),
                eq(refrigeratorTasks.task_date, todayStr),
                inArray(refrigeratorTasks.shift, refShiftsToCheck)
              )
            );

          const completedRefKeySet = new Set(
            refTasksToday
              .filter((rt: any) => Boolean(rt.completed_at))
              .map((rt: any) => `${rt.refrigerator_id}_${rt.shift || "morning"}`)
          );

          for (const ref of activeBranchRefs) {
            for (const s of refShiftsToCheck) {
              refTotal++;
              const key = `${ref.id}_${s}`;
              if (completedRefKeySet.has(key)) {
                refDone++;
              } else {
                const shiftLabel = s === "morning" ? "รอบเช้า" : "รอบบ่าย";
                pendingTasks.push({
                  id: `ref_${ref.id}_${s}`,
                  name: `[ตู้แช่] ตรวจอุณหภูมิ ${ref.name} (${shiftLabel})`,
                });
              }
            }
          }
        }
      }

      const totalTasks = activeTasks.length + refTotal;
      const doneTasks = (activeTasks.length - (pendingTasks.length - (refTotal - refDone))) + refDone;
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

      const [sess] = await this.db
        .select({ id: shiftSession.id, task_role: shiftSession.task_role, branch: shiftSession.branch })
        .from(shiftSession)
        .where(eq(shiftSession.id, shiftSessionId))
        .limit(1);

      if (!sess) {
        return { success: false, error: "ไม่พบข้อมูลกะในระบบ" };
      }

      // Check online validation from DB directly
      const validation = await this.validateShiftCompletion(shiftSessionId);
      if (!validation.success) {
        return { success: false, error: validation.error || "ไม่สามารถตรวจสอบสถานะงานในฐานข้อมูลได้" };
      }

      // For stock employees: Refrigerator checklist is strictly required before quitting/ending session
      if (sess.task_role === "stock") {
        const pendingRefTasks = validation.pendingTasks.filter((t) => t.name.startsWith("[ตู้แช่]"));
        if (pendingRefTasks.length > 0) {
          return {
            success: false,
            error: `พนักงานสต็อกจำเป็นต้องตรวจเช็คตู้แช่ให้ครบทุกตู้ก่อนจบกะ (ตรวจพบตู้แช่ค้างตรวจ ${pendingRefTasks.length} รายการ: ${pendingRefTasks.map((p) => p.name.replace("[ตู้แช่] ", "")).slice(0, 3).join(", ")}${pendingRefTasks.length > 3 ? "..." : ""})`,
          };
        }
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
      if (
        position.includes("ผู้จัดการทั่วไป") ||
        position.toLowerCase().includes("general manager") ||
        position.includes("กรรมการ")
      ) {
        return {
          success: true,
          statuses: {
            morning: { status: "none", total: 0, done: 0 },
            afternoon: { status: "none", total: 0, done: 0 },
            night: { status: "none", total: 0, done: 0 },
            both: { status: "none", total: 0, done: 0 },
          },
        };
      }

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
        .select({
          id: shiftSession.id,
          shift: shiftSession.shift,
          end: shiftSession.end,
        })
        .from(shiftSession)
        .where(and(...whereConditions))
        .orderBy(desc(shiftSession.start));

      const result: Record<ShiftType, { status: "completed" | "incomplete" | "none"; total: number; done: number }> = {
        morning: { status: "none", total: 0, done: 0 },
        afternoon: { status: "none", total: 0, done: 0 },
        night: { status: "none", total: 0, done: 0 },
        both: { status: "none", total: 0, done: 0 },
      };

      const shiftMap: Record<"morning" | "afternoon" | "night" | "morning_afternoon", ShiftType> = {
        morning: "morning",
        afternoon: "afternoon",
        night: "night",
        morning_afternoon: "both",
      };

      const sessionIds = todaySessions.map((s: any) => s.id) as string[];
      let allWorks: any[] = [];
      if (sessionIds.length > 0) {
        allWorks = await this.db
          .select({
            id: taskWork.id,
            shift_session: taskWork.shift_session,
            timestamp: taskWork.timestamp,
          })
          .from(taskWork)
          .where(inArray(taskWork.shift_session, sessionIds));
      }

      for (const [dbShift, uiShift] of Object.entries(shiftMap) as Array<
        ["morning" | "afternoon" | "night" | "morning_afternoon", ShiftType]
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
      refrigeratorRetentionDays?: number;
      cleanShiftSessions?: boolean;
      cleanRefrigeratorTasks?: boolean;
      cleanNotifications?: boolean;
      cleanPointTransactions?: boolean;
      cleanEmployeeLeaves?: boolean;
    }
  ): Promise<{
    success: boolean;
    cutoffDate?: string;
    refrigeratorCutoffDate?: string;
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

      // Refrigerator data retention: strictly preserved for 1 month (30 days)
      const refRetentionDays = options?.refrigeratorRetentionDays ?? 30;
      const refCutoffDate = new Date(Date.now() - refRetentionDays * 24 * 60 * 60 * 1000);
      const refY = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(refCutoffDate);
      const refM = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", month: "2-digit" }).format(refCutoffDate);
      const refD = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", day: "2-digit" }).format(refCutoffDate);
      const refCutoffDateStr = `${refY}-${refM}-${refD}`;

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

      // 2. Delete old refrigerator tasks (strictly preserve for 1 month / 30 days)
      let deletedRefsCount = 0;
      if (doCleanRefs) {
        const refConditions = [
          lt(refrigeratorTasks.created_at, refCutoffDate),
          lte(refrigeratorTasks.task_date, refCutoffDateStr),
        ];

        const deletedRefs = await this.db
          .delete(refrigeratorTasks)
          .where(and(...refConditions))
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

  async getBranchDailyTasks(branchId?: string): Promise<{ success: boolean; tasks?: BranchDailyTask[]; error?: string }> {
    try {
      const condition = branchId
        ? or(eq(tasks.branch_id, branchId), isNull(tasks.branch_id))
        : isNull(tasks.branch_id);

      const dbTasks = await this.db
        .select()
        .from(tasks)
        .where(condition)
        .orderBy(asc(tasks.task_role), asc(tasks.start));

      const mapped: BranchDailyTask[] = dbTasks.map((t: any) => ({
        id: t.id,
        branchId: t.branch_id,
        name: t.name,
        taskRole: t.task_role,
        shift: t.shift === "morning_afternoon" ? "both" : t.shift,
        startTime: t.start || "00:00",
        endTime: t.end || "00:00",
        disabled: Boolean(t.disabled),
        forManagers: Boolean(t.for_managers),
        isJoint: Boolean(t.is_joint),
        isDaily: Boolean(t.is_daily),
        shiftTypes: (t.shift_types as string[]) || [],
        refrigeratorId: t.refrigerator_id || null,
        selectableRoles: (t.selectable_roles as string[]) || [t.task_role],
        category: t.category,
      }));

      return { success: true, tasks: mapped };
    } catch (err: any) {
      console.error("ChecklistService.getBranchDailyTasks error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการดึงรายการงานประจำสาขา" };
    }
  }

  async createBranchDailyTask(params: {
    branchId?: string | null;
    name: string;
    taskRole: "cashier" | "stock" | "manager_assistant";
    shift: ShiftType;
    startTime: string;
    endTime: string;
    disabled?: boolean;
    forManagers?: boolean;
    isJoint?: boolean;
    isDaily?: boolean;
    shiftTypes?: string[];
    refrigeratorId?: string | null;
    selectableRoles?: string[];
    category?: string | null;
  }): Promise<{ success: boolean; task?: BranchDailyTask; error?: string }> {
    try {
      const dbShift = mapShiftToDbShift(params.shift);
      const [newTask] = await this.db
        .insert(tasks)
        .values({
          branch_id: params.branchId || null,
          name: params.name.trim(),
          task_role: params.taskRole,
          shift: dbShift,
          start: params.startTime || "00:00:00",
          end: params.endTime || "00:00:00",
          disabled: params.disabled ?? false,
          for_managers: params.forManagers ?? false,
          is_joint: params.isJoint ?? false,
          is_daily: params.isDaily ?? (params.isJoint ?? false),
          shift_types: params.shiftTypes || (params.shift ? [params.shift] : []),
          refrigerator_id: params.refrigeratorId || null,
          selectable_roles: params.selectableRoles || [params.taskRole],
          category: params.category || null,
        })
        .returning();

      if (params.branchId) {
        await this.db
          .update(branches)
          .set({ last_update: new Date() })
          .where(eq(branches.id, params.branchId));
      }

      return {
        success: true,
        task: {
          id: newTask.id,
          branchId: newTask.branch_id,
          name: newTask.name,
          taskRole: newTask.task_role,
          shift: newTask.shift === "morning_afternoon" ? "both" : newTask.shift,
          startTime: newTask.start,
          endTime: newTask.end,
          disabled: Boolean(newTask.disabled),
          forManagers: Boolean(newTask.for_managers),
          isJoint: Boolean(newTask.is_joint),
          isDaily: Boolean(newTask.is_daily),
          shiftTypes: (newTask.shift_types as string[]) || [],
          refrigeratorId: newTask.refrigerator_id || null,
          selectableRoles: (newTask.selectable_roles as string[]) || [newTask.task_role],
          category: newTask.category,
        },
      };
    } catch (err: any) {
      console.error("ChecklistService.createBranchDailyTask error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการสร้างงานประจำสาขา" };
    }
  }

  async updateBranchDailyTask(params: {
    id: string;
    branchId?: string | null;
    name?: string;
    taskRole?: "cashier" | "stock" | "manager_assistant";
    shift?: ShiftType;
    startTime?: string;
    endTime?: string;
    disabled?: boolean;
    forManagers?: boolean;
    isJoint?: boolean;
    isDaily?: boolean;
    shiftTypes?: string[];
    refrigeratorId?: string | null;
    selectableRoles?: string[];
    category?: string | null;
  }): Promise<{ success: boolean; task?: BranchDailyTask; error?: string }> {
    try {
      const updateData: any = {};
      if (params.name !== undefined) updateData.name = params.name.trim();
      if (params.taskRole !== undefined) updateData.task_role = params.taskRole;
      if (params.shift !== undefined) updateData.shift = mapShiftToDbShift(params.shift);
      if (params.startTime !== undefined) updateData.start = params.startTime;
      if (params.endTime !== undefined) updateData.end = params.endTime;
      if (params.disabled !== undefined) updateData.disabled = params.disabled;
      if (params.forManagers !== undefined) updateData.for_managers = params.forManagers;
      if (params.isJoint !== undefined) updateData.is_joint = params.isJoint;
      if (params.isDaily !== undefined) updateData.is_daily = params.isDaily;
      if (params.shiftTypes !== undefined) updateData.shift_types = params.shiftTypes;
      if (params.refrigeratorId !== undefined) updateData.refrigerator_id = params.refrigeratorId;
      if (params.selectableRoles !== undefined) updateData.selectable_roles = params.selectableRoles;
      if (params.category !== undefined) updateData.category = params.category;

      const [updated] = await this.db
        .update(tasks)
        .set(updateData)
        .where(eq(tasks.id, params.id))
        .returning();

      if (updated?.branch_id) {
        await this.db
          .update(branches)
          .set({ last_update: new Date() })
          .where(eq(branches.id, updated.branch_id));
      }

      return {
        success: true,
        task: updated
          ? {
              id: updated.id,
              branchId: updated.branch_id,
              name: updated.name,
              taskRole: updated.task_role,
              shift: updated.shift === "morning_afternoon" ? "both" : updated.shift,
              startTime: updated.start,
              endTime: updated.end,
              disabled: Boolean(updated.disabled),
              forManagers: Boolean(updated.for_managers),
              isJoint: Boolean(updated.is_joint),
              isDaily: Boolean(updated.is_daily),
              shiftTypes: (updated.shift_types as string[]) || [],
              refrigeratorId: updated.refrigerator_id || null,
              selectableRoles: (updated.selectable_roles as string[]) || [updated.task_role],
              category: updated.category,
            }
          : undefined,
      };
    } catch (err: any) {
      console.error("ChecklistService.updateBranchDailyTask error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการอัปเดตงานประจำสาขา" };
    }
  }

  async deleteBranchDailyTask(taskId: string, branchId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.db.delete(tasks).where(eq(tasks.id, taskId));

      if (branchId) {
        await this.db
          .update(branches)
          .set({ last_update: new Date() })
          .where(eq(branches.id, branchId));
      }

      return { success: true };
    } catch (err: any) {
      console.error("ChecklistService.deleteBranchDailyTask error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการลบงาน" };
    }
  }

  async getBranchJointTasks(params: {
    branchId: string;
    dateStr?: string;
    shift?: ShiftType;
  }): Promise<{ success: boolean; data?: JointTaskItem[]; error?: string }> {
    try {
      const { branchId, dateStr, shift } = params;
      const targetDate = dateStr || getThaiStartAndEndOfDay().dateStr;

      // 1. Fetch joint tasks definitions for this branch (or global templates)
      const jointDefs = await this.db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.is_joint, true),
            eq(tasks.disabled, false),
            or(eq(tasks.branch_id, branchId), isNull(tasks.branch_id))
          )
        )
        .orderBy(asc(tasks.name));

      if (jointDefs.length === 0) {
        return { success: true, data: [] };
      }

      const taskIds = jointDefs.map((t: any) => t.id);

      // 2. Fetch existing joint work entries for today
      const workConditions = [
        eq(jointTaskWork.branch_id, branchId),
        eq(jointTaskWork.task_date, targetDate),
        inArray(jointTaskWork.task_id, taskIds),
      ];

      const workRows = await this.db
        .select()
        .from(jointTaskWork)
        .where(and(...workConditions));

      const workMap = new Map<string, any>(workRows.map((w: any) => [w.task_id, w]));

      // 3. User names map
      const userIds = workRows.map((w: any) => w.completed_by).filter(Boolean);
      let userMap = new Map<string, string>();
      if (userIds.length > 0) {
        const uRows = await this.db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, userIds));
        userMap = new Map(uRows.map((u: any) => [u.id, u.name]));
      }

      const items: JointTaskItem[] = jointDefs.map((def: any) => {
        const work = workMap.get(def.id);
        const completed = Boolean(work?.completed_at);
        const completedByUserName = work?.completed_by ? userMap.get(work.completed_by) || "พนักงาน" : null;

        return {
          id: work?.id || def.id,
          taskId: def.id,
          branchId,
          taskDate: targetDate,
          shift: work?.shift ? (work.shift === "morning_afternoon" ? "both" : work.shift) : (def.shift === "morning_afternoon" ? "both" : def.shift),
          name: def.name,
          selectableRoles: (def.selectable_roles as string[]) || [def.task_role],
          category: def.category,
          completed,
          completedAt: work?.completed_at ? new Date(work.completed_at).toISOString() : null,
          completedByUserId: work?.completed_by || null,
          completedByUserName,
          comment: work?.comment || null,
          isDaily: Boolean(def.is_daily),
          shiftTypes: (def.shift_types as string[]) || [],
          refrigeratorId: def.refrigerator_id || null,
        };
      });

      // Filter by shift if shift specified
      const filtered = shift && shift !== "both"
        ? items.filter((it) => it.shift === shift || !it.shift || (it.shiftTypes && it.shiftTypes.includes(shift)))
        : items;

      return { success: true, data: filtered };
    } catch (err: any) {
      console.error("ChecklistService.getBranchJointTasks error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการดึงรายการงานส่วนกลาง" };
    }
  }

  async toggleJointTaskItem(params: {
    jointWorkId?: string;
    taskId: string;
    branchId: string;
    dateStr: string;
    shift?: ShiftType;
    userId: string;
    completed: boolean;
    comment?: string;
  }): Promise<{ success: boolean; data?: JointTaskItem; conflict?: boolean; message?: string; error?: string }> {
    try {
      const { taskId, branchId, dateStr, shift, userId, completed, comment } = params;
      const dbShift = shift ? mapShiftToDbShift(shift) : null;

      // 1. Check existing work row for this task & date
      const [existingWork] = await this.db
        .select()
        .from(jointTaskWork)
        .where(
          and(
            eq(jointTaskWork.task_id, taskId),
            eq(jointTaskWork.branch_id, branchId),
            eq(jointTaskWork.task_date, dateStr)
          )
        )
        .limit(1);

      // Concurrency check: If another user already completed this item, prevent race condition & overwrite
      if (completed && existingWork?.completed_at && existingWork.completed_by && existingWork.completed_by !== userId) {
        const [completedByUser] = await this.db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, existingWork.completed_by))
          .limit(1);

        const [t] = await this.db.select({ name: tasks.name }).from(tasks).where(eq(tasks.id, taskId)).limit(1);
        const completedName = completedByUser?.name || "พนักงานท่านอื่น";
        const completedTime = new Date(existingWork.completed_at).toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        });

        return {
          success: false,
          conflict: true,
          message: `งาน "${t?.name || "งานส่วนกลาง"}" ได้รับการบันทึกโดย ${completedName} เมื่อเวลา ${completedTime} น. แล้ว (ระบบป้องกันการบันทึกซ้ำ)`,
        };
      }

      let activeRow: any;
      const now = completed ? new Date() : null;

      if (existingWork) {
        const [updated] = await this.db
          .update(jointTaskWork)
          .set({
            completed_by: completed ? userId : null,
            completed_at: now,
            comment: completed && comment ? comment : null,
            shift: dbShift || existingWork.shift,
          })
          .where(
            and(
              eq(jointTaskWork.id, existingWork.id),
              completed
                ? or(sql`${jointTaskWork.completed_at} IS NULL`, eq(jointTaskWork.completed_by, userId))
                : sql`TRUE`
            )
          )
          .returning();

        if (!updated && completed) {
          return {
            success: false,
            conflict: true,
            message: "รายการนี้เพิ่งถูกบันทึกโดยเพื่อนร่วมงาน ระบบกำลังอัปเดตข้อมูลล่าสุด",
          };
        }
        activeRow = updated || existingWork;
      } else if (completed) {
        const [inserted] = await this.db
          .insert(jointTaskWork)
          .values({
            task_id: taskId,
            branch_id: branchId,
            task_date: dateStr,
            shift: dbShift,
            completed_by: userId,
            completed_at: now,
            comment: comment || null,
          })
          .onConflictDoUpdate({
            target: [jointTaskWork.task_id, jointTaskWork.branch_id, jointTaskWork.task_date],
            set: {
              completed_by: sql`CASE WHEN ${jointTaskWork.completed_at} IS NULL THEN ${userId} ELSE ${jointTaskWork.completed_by} END`,
              completed_at: sql`CASE WHEN ${jointTaskWork.completed_at} IS NULL THEN ${now} ELSE ${jointTaskWork.completed_at} END`,
              comment: sql`CASE WHEN ${jointTaskWork.completed_at} IS NULL THEN ${comment || null} ELSE ${jointTaskWork.comment} END`,
            },
          })
          .returning();

        if (inserted && inserted.completed_by && inserted.completed_by !== userId) {
          return {
            success: false,
            conflict: true,
            message: "รายการนี้เพิ่งถูกบันทึกโดยเพื่อนร่วมงาน ระบบกำลังอัปเดตข้อมูลล่าสุด",
          };
        }
        activeRow = inserted;
      }

      // Touch branch last_update
      await this.db
        .update(branches)
        .set({ last_update: new Date() })
        .where(eq(branches.id, branchId));

      const [taskDef] = await this.db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);

      // Two-way sync: If task is linked to a refrigerator, sync refrigerator_tasks table as well!
      if (taskDef?.refrigerator_id) {
        const refShift = (taskDef.shift === "afternoon" ? "afternoon" : "morning") as "morning" | "afternoon";
        try {
          if (completed) {
            const [existingRefTask] = await this.db
              .select({ id: refrigeratorTasks.id })
              .from(refrigeratorTasks)
              .where(
                and(
                  eq(refrigeratorTasks.branch_id, branchId),
                  eq(refrigeratorTasks.refrigerator_id, taskDef.refrigerator_id),
                  eq(refrigeratorTasks.task_date, dateStr),
                  eq(refrigeratorTasks.shift, refShift)
                )
              )
              .limit(1);

            if (existingRefTask) {
              await this.db
                .update(refrigeratorTasks)
                .set({
                  completed_by: userId,
                  completed_at: now,
                  is_okay: true,
                  comment: comment || null,
                })
                .where(eq(refrigeratorTasks.id, existingRefTask.id));
            } else {
              await this.db.insert(refrigeratorTasks).values({
                branch_id: branchId,
                refrigerator_id: taskDef.refrigerator_id,
                task_date: dateStr,
                shift: refShift,
                completed_by: userId,
                completed_at: now,
                is_okay: true,
                comment: comment || null,
              });
            }
          } else {
            await this.db
              .update(refrigeratorTasks)
              .set({
                completed_by: null,
                completed_at: null,
                comment: null,
              })
              .where(
                and(
                  eq(refrigeratorTasks.branch_id, branchId),
                  eq(refrigeratorTasks.refrigerator_id, taskDef.refrigerator_id),
                  eq(refrigeratorTasks.task_date, dateStr),
                  eq(refrigeratorTasks.shift, refShift)
                )
              );
          }
        } catch (refSyncErr) {
          console.warn("Failed to sync refrigerator_tasks from joint task:", refSyncErr);
        }
      }

      let userName: string | null = null;
      if (activeRow?.completed_by) {
        const [u] = await this.db.select({ name: users.name }).from(users).where(eq(users.id, activeRow.completed_by)).limit(1);
        userName = u?.name || null;
      }

      const resultItem: JointTaskItem = {
        id: activeRow?.id || taskId,
        taskId,
        branchId,
        taskDate: dateStr,
        shift: activeRow?.shift ? (activeRow.shift === "morning_afternoon" ? "both" : activeRow.shift) : null,
        name: taskDef?.name || "งานส่วนกลาง",
        selectableRoles: (taskDef?.selectable_roles as string[]) || [taskDef?.task_role || "stock"],
        category: taskDef?.category,
        completed: Boolean(activeRow?.completed_at),
        completedAt: activeRow?.completed_at ? new Date(activeRow.completed_at).toISOString() : null,
        completedByUserId: activeRow?.completed_by || null,
        completedByUserName: userName,
        comment: activeRow?.comment || null,
        isDaily: Boolean(taskDef?.is_daily),
        shiftTypes: (taskDef?.shift_types as string[]) || [],
        refrigeratorId: taskDef?.refrigerator_id || null,
      };

      return { success: true, data: resultItem };
    } catch (err: any) {
      console.error("ChecklistService.toggleJointTaskItem error:", err);
      return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการบันทึกงานส่วนกลาง" };
    }
  }

  async syncBranchRefrigeratorJointTasks(branchId?: string): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const branchList = branchId
        ? await this.db.select({ id: branches.id }).from(branches).where(eq(branches.id, branchId))
        : await this.db.select({ id: branches.id }).from(branches);

      let totalSynced = 0;
      for (const b of branchList) {
        const branchRefs = await this.db
          .select()
          .from(refrigerators)
          .where(eq(refrigerators.branch_id, b.id));

        for (const ref of branchRefs) {
          // Morning task
          const [existingMorning] = await this.db
            .select({ id: tasks.id })
            .from(tasks)
            .where(
              and(
                eq(tasks.refrigerator_id, ref.id),
                eq(tasks.shift, "morning")
              )
            )
            .limit(1);

          if (!existingMorning) {
            const [created] = await this.db
              .insert(tasks)
              .values({
                branch_id: b.id,
                shift: "morning",
                name: `ตรวจเช็คอุณหภูมิตู้แช่: ${ref.name} (รอบเช้า)`,
                task_role: "stock",
                start: "06:00:00",
                end: "14:00:00",
                disabled: Boolean(ref.disable_check),
                for_managers: false,
                is_joint: true,
                is_daily: true,
                shift_types: ["morning"],
                selectable_roles: ["stock", "manager_assistant"],
                category: "ตู้แช่",
                refrigerator_id: ref.id,
              })
              .returning({ id: tasks.id });

            if (created) {
              await this.db
                .insert(branchTasks)
                .values({ branch_id: b.id, task_id: created.id })
                .onConflictDoNothing();
              totalSynced++;
            }
          } else {
            await this.db
              .update(tasks)
              .set({
                name: `ตรวจเช็คอุณหภูมิตู้แช่: ${ref.name} (รอบเช้า)`,
                disabled: Boolean(ref.disable_check),
                is_joint: true,
                is_daily: true,
                shift_types: ["morning"],
                category: "ตู้แช่",
              })
              .where(eq(tasks.id, existingMorning.id));
          }

          // Afternoon task
          const [existingAfternoon] = await this.db
            .select({ id: tasks.id })
            .from(tasks)
            .where(
              and(
                eq(tasks.refrigerator_id, ref.id),
                eq(tasks.shift, "afternoon")
              )
            )
            .limit(1);

          if (!existingAfternoon) {
            const [created] = await this.db
              .insert(tasks)
              .values({
                branch_id: b.id,
                shift: "afternoon",
                name: `ตรวจเช็คอุณหภูมิตู้แช่: ${ref.name} (รอบบ่าย)`,
                task_role: "stock",
                start: "14:00:00",
                end: "22:00:00",
                disabled: Boolean(ref.disable_check),
                for_managers: false,
                is_joint: true,
                is_daily: true,
                shift_types: ["afternoon"],
                selectable_roles: ["stock", "manager_assistant"],
                category: "ตู้แช่",
                refrigerator_id: ref.id,
              })
              .returning({ id: tasks.id });

            if (created) {
              await this.db
                .insert(branchTasks)
                .values({ branch_id: b.id, task_id: created.id })
                .onConflictDoNothing();
              totalSynced++;
            }
          } else {
            await this.db
              .update(tasks)
              .set({
                name: `ตรวจเช็คอุณหภูมิตู้แช่: ${ref.name} (รอบบ่าย)`,
                disabled: Boolean(ref.disable_check),
                is_joint: true,
                is_daily: true,
                shift_types: ["afternoon"],
                category: "ตู้แช่",
              })
              .where(eq(tasks.id, existingAfternoon.id));
          }
        }
      }

      return { success: true, count: totalSynced };
    } catch (err: any) {
      console.error("ChecklistService.syncBranchRefrigeratorJointTasks error:", err);
      return { success: false, error: err?.message || "ไม่สามารถซิงค์งานตู้แช่ได้" };
    }
  }
}
