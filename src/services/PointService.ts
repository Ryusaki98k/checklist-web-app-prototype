import { eq, desc, sql, inArray, and, lte, gte } from "drizzle-orm";
import { users, pointTransactions, shiftSession, taskWork, tasks, branches, employeeLeaves } from "../db/schema";
import { IPointService, INotificationService } from "./types";
import { PointTransaction, LeaderboardEntry, BranchLeaderboardEntry, ActiveRole } from "../types";
import { getUserAvailableRoles, isScoreboardEligible } from "../utils/roles";
import { getThaiStartAndEndOfDay, getThaiWeekRange } from "../utils/date";
import { saveWeeklyLeaderboardToStorage, getWeeklyLeaderboardFromStorage } from "../utils/leaderboardStorage";

export class PointService implements IPointService {
  constructor(private db: any, private notificationService?: INotificationService) {}

  async awardPoints(params: {
    userId: string;
    points: number;
    type: string;
    shiftSessionId?: string;
    description: string;
  }): Promise<{ success: boolean; newTotal?: number; error?: string }> {
    try {
      const { userId, points, type, shiftSessionId, description } = params;

      // 1. Insert transaction record
      await this.db.insert(pointTransactions).values({
        user_id: userId,
        points,
        type,
        shift_session_id: shiftSessionId || null,
        description,
        created_at: new Date(),
      });

      // 2. Update user points
      const [updatedUser] = await this.db
        .update(users)
        .set({
          point: sql`${users.point} + ${points}`,
        })
        .where(eq(users.id, userId))
        .returning({ point: users.point });

      return { success: true, newTotal: updatedUser?.point ?? 0 };
    } catch (err: any) {
      console.error("awardPoints error:", err);
      return { success: false, error: err?.message || "Failed to award points" };
    }
  }

  async evaluateShiftSession(shiftSessionId: string, isException = false): Promise<{
    success: boolean;
    awardedPoints?: number;
    streakType?: "perfect" | "flawed";
    streakCount?: number;
    error?: string;
  }> {
    try {
      const [session] = await this.db
        .select()
        .from(shiftSession)
        .where(eq(shiftSession.id, shiftSessionId))
        .limit(1);

      if (!session) {
        return { success: false, error: "Shift session not found" };
      }

      const sessionWorks = await this.db
        .select()
        .from(taskWork)
        .where(eq(taskWork.shift_session, shiftSessionId));

      if (sessionWorks.length === 0) {
        return { success: true, awardedPoints: 0 };
      }

      const taskIds = Array.from(new Set(sessionWorks.map((w: any) => w.task))) as string[];
      const sessionTasks =
        taskIds.length > 0
          ? await this.db.select().from(tasks).where(inArray(tasks.id, taskIds))
          : [];

      // Fetch user to manage streaks
      const [targetUser] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, session.user))
        .limit(1);

      // Check if session tasks exclusively consist of manager / night closing checklist tasks (Zero Points Rule)
      const nonSpecialTasks = sessionTasks.filter((t: any) => !t.for_managers && t.shift !== "night");
      const isOnlySpecialTasks = sessionTasks.length > 0 && nonSpecialTasks.length === 0;

      if (isOnlySpecialTasks) {
        const userStreakType = targetUser?.point_streak_type;
        return {
          success: true,
          awardedPoints: 0,
          streakType: userStreakType === "perfect" || userStreakType === "flawed" ? userStreakType : undefined,
          streakCount: targetUser?.point_streak || 0,
        };
      }

      let hasIssueOrLate = false;
      for (const work of sessionWorks) {
        const t = sessionTasks.find((item: any) => item.id === work.task);
        // Special / manager zero-point closing tasks do not penalize streaks or evaluate late infractions
        if (t && (t.for_managers || t.shift === "night")) {
          continue;
        }
        if (!work.timestamp) {
          hasIssueOrLate = true;
          break;
        }
        if (t?.end) {
          const completedDate = new Date(work.timestamp);
          const [endHour, endMinute] = t.end.split(":").map(Number);
          const deadlineDate = new Date(session.start);
          deadlineDate.setHours(endHour, endMinute, 0, 0);

          if (completedDate > deadlineDate) {
            hasIssueOrLate = true;
            break;
          }
        }
      }

      const isPerfect = !hasIssueOrLate;

      let newStreakType = targetUser?.point_streak_type || "none";
      let newStreakCount = targetUser?.point_streak || 0;
      let longestStreak = targetUser?.longest_streak || 0;
      let totalPoints = 0;
      const pointReasons: string[] = [];

      if (isPerfect) {
        if (newStreakType === "perfect") {
          newStreakCount += 1;
        } else {
          newStreakType = "perfect";
          newStreakCount = 1;
        }

        totalPoints = 10;
        pointReasons.push("เช็คลิสต์สมบูรณ์ตรงเวลา (+10 แต้ม)");
      } else if (isException) {
        // Exception approval (อนุโลม): Do NOT break the streak!
        // Sets streak type to 'flawed' while keeping and incrementing the streak count, and gives 10 points!
        newStreakType = "flawed";
        newStreakCount = (targetUser?.point_streak || 0) + 1;
        totalPoints = 10;
        pointReasons.push("ผู้บริหารอนุมัติแบบอนุโลม (Exception): รักษาสตรีคต่อเนื่องและมอบ 10 แต้ม (+10 แต้ม)");
      } else {
        // Standard imperfect shift (one of the jobs was late or missing): breaks streak and gives 8 points
        newStreakType = "flawed";
        newStreakCount = 0;
        totalPoints = 8;
        pointReasons.push("เช็คลิสต์มีรายการส่งล่าช้า (+8 แต้ม)");
      }

      if (newStreakCount > longestStreak) {
        longestStreak = newStreakCount;
      }

      // Insert point transaction
      await this.db.insert(pointTransactions).values({
        user_id: session.user,
        points: totalPoints,
        type: isPerfect ? "perfect_shift" : isException ? "exception_shift" : "shift_completion",
        shift_session_id: session.id,
        description: pointReasons.join(", "),
        created_at: new Date(),
      });

      // Update user aggregate
      await this.db
        .update(users)
        .set({
          point: sql`${users.point} + ${totalPoints}`,
          point_streak_type: newStreakType,
          point_streak: newStreakCount,
          longest_streak: longestStreak,
        })
        .where(eq(users.id, session.user));

      // Notify employee if notification service is available
      if (this.notificationService) {
        const notifTitle = isPerfect
          ? "🌟 ผลงานยอดเยี่ยมตรงเวลา!"
          : isException
          ? "🛡️ อนุมัติแบบอนุโลม (รักษาสตรีค & 10 แต้ม)"
          : "✅ ตรวจรับรองกะงานเรียบร้อยแล้ว";
        const notifMsg = isPerfect
          ? `ยินดีด้วย! คุณปฏิบัติงานตรงเวลาครบถ้วน (+${totalPoints} แต้ม) สตรีคสมบูรณ์ ${newStreakCount} วันติด`
          : isException
          ? `ผู้จัดการได้อนุมัติแบบอนุโลมให้กะของคุณ (+${totalPoints} แต้ม) รักษาสตรีคต่อเนื่องที่ ${newStreakCount} วัน`
          : `ตรวจรับรองกะงานเรียบร้อยแล้ว มีรายการส่งล่าช้า (+${totalPoints} แต้ม)`;

        await this.notificationService.createNotification({
          recipientId: session.user,
          title: notifTitle,
          message: notifMsg,
          type: "point_awarded",
          shiftSessionId: session.id,
          branchId: session.branch,
        });
      }

      return {
        success: true,
        awardedPoints: totalPoints,
        streakType: newStreakType,
        streakCount: newStreakCount,
      };
    } catch (err: any) {
      console.error("evaluateShiftSession error:", err);
      return { success: false, error: err?.message || "Failed to evaluate shift session points" };
    }
  }

  async getUserPointDetails(userId: string): Promise<{
    success: boolean;
    points: number;
    streak: number;
    streakType: "none" | "flawed" | "perfect";
    longestStreak: number;
    transactions: PointTransaction[];
    error?: string;
  }> {
    try {
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return {
          success: false,
          points: 0,
          streak: 0,
          streakType: "none",
          longestStreak: 0,
          transactions: [],
          error: "User not found",
        };
      }

      const txs = await this.db
        .select()
        .from(pointTransactions)
        .where(eq(pointTransactions.user_id, userId))
        .orderBy(desc(pointTransactions.created_at))
        .limit(20);

      const mappedTxs: PointTransaction[] = txs.map((t: any) => ({
        id: t.id,
        userId: t.user_id,
        points: t.points,
        type: t.type,
        shiftSessionId: t.shift_session_id || undefined,
        description: t.description,
        createdAt: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
      }));

      return {
        success: true,
        points: user.point || 0,
        streak: user.point_streak || 0,
        streakType: (user.point_streak_type as any) || "none",
        longestStreak: user.longest_streak || 0,
        transactions: mappedTxs,
      };
    } catch (err: any) {
      console.error("getUserPointDetails error:", err);
      return {
        success: false,
        points: 0,
        streak: 0,
        streakType: "none",
        longestStreak: 0,
        transactions: [],
        error: err?.message,
      };
    }
  }

  async getLiveLeaderboard(branchId?: string): Promise<LeaderboardEntry[]> {
    const allBranches = await this.db.select().from(branches);

    const conditions = [
      eq(users.is_admin, false),
      eq(users.executive_type, "none"),
      inArray(users.manager_type, ["none", "assistant"]),
    ];

    if (branchId) {
      conditions.push(eq(users.branch_id, branchId));
    }

    const allUsers = await this.db
      .select()
      .from(users)
      .where(and(...conditions))
      .orderBy(desc(users.point))
      .limit(30);

    return allUsers.map((u: any) => {
      const userBranch = allBranches.find((b: any) => b.id === u.branch_id);
      const role: ActiveRole = u.manager_type === "assistant" ? "manager_assistant" : "employee";
      const defaultPosition = u.manager_type === "assistant" ? "ผู้ช่วยผู้จัดการร้าน" : "พนักงานสาขา";

      return {
        userId: u.id,
        name: u.name,
        role,
        position: defaultPosition,
        branchName: userBranch ? userBranch.name : undefined,
        point: u.point || 0,
        pointStreak: u.point_streak || 0,
        pointStreakType: (u.point_streak_type as any) || "none",
        profile_id: u.profile_id || null,
      };
    });
  }

  async getLeaderboard(
    params?: string | {
      branchId?: string;
      view?: "weekly" | "current";
    }
  ): Promise<{
    success: boolean;
    leaderboard: LeaderboardEntry[];
    isSnapshot?: boolean;
    snapshotInfo?: {
      weekStartDate: string;
      weekEndDate: string;
      processedAt: string;
      totalParticipants?: number;
      topScore?: number;
    };
    error?: string;
  }> {
    try {
      const branchId = typeof params === "string" ? params : params?.branchId;
      const requestedView = typeof params === "object" ? params?.view : undefined;

      // 1. If "weekly" is requested (or view not specified), check if a finalized weekly snapshot exists in Supabase Storage
      if (requestedView !== "current") {
        const stored = await getWeeklyLeaderboardFromStorage();
        if (stored) {
          const rankings = branchId
            ? stored.branches?.[branchId] || []
            : stored.overall || [];

          return {
            success: true,
            leaderboard: rankings,
            isSnapshot: true,
            snapshotInfo: {
              weekStartDate: stored.weekStartDate,
              weekEndDate: stored.weekEndDate,
              processedAt: stored.processedAt,
              totalParticipants: branchId ? rankings.length : stored.totalParticipants,
              topScore: rankings[0]?.point ?? 0,
            },
          };
        }
      }

      // 2. Otherwise return live current week leaderboard
      const live = await this.getLiveLeaderboard(branchId);
      return {
        success: true,
        leaderboard: live,
        isSnapshot: false,
      };
    } catch (err: any) {
      console.error("getLeaderboard error:", err);
      return { success: false, leaderboard: [], error: err?.message };
    }
  }

  async getLiveBranchLeaderboard(): Promise<BranchLeaderboardEntry[]> {
    try {
      const allBranches = await this.db.select().from(branches);
      const allUsers = await this.db
        .select()
        .from(users)
        .where(
          and(
            eq(users.is_admin, false),
            eq(users.executive_type, "none"),
            inArray(users.manager_type, ["none", "assistant"])
          )
        );

      const result: BranchLeaderboardEntry[] = allBranches.map((b: any) => {
        const branchUsers = allUsers.filter((u: any) => u.branch_id === b.id);
        const totalPoints = branchUsers.reduce((sum: number, u: any) => sum + (u.point || 0), 0);
        const memberCount = branchUsers.length;
        const averagePoints = memberCount > 0 ? Math.round(totalPoints / memberCount) : 0;

        const sortedUsers = [...branchUsers].sort((a: any, b: any) => (b.point || 0) - (a.point || 0));
        const topUser = sortedUsers[0];

        return {
          branchId: b.id,
          branchName: b.name,
          totalPoints,
          averagePoints,
          memberCount,
          topPerformerName: topUser ? topUser.name : undefined,
          topPerformerPoints: topUser ? (topUser.point || 0) : 0,
        };
      });

      return result.sort((a, b) => b.totalPoints - a.totalPoints);
    } catch (err) {
      console.error("getLiveBranchLeaderboard error:", err);
      return [];
    }
  }

  async getBranchLeaderboard(view: "weekly" | "current" = "weekly"): Promise<{
    success: boolean;
    branchLeaderboard: BranchLeaderboardEntry[];
    isSnapshot?: boolean;
    snapshotInfo?: {
      weekStartDate: string;
      weekEndDate: string;
      processedAt: string;
    };
    error?: string;
  }> {
    try {
      if (view === "weekly") {
        const stored = await getWeeklyLeaderboardFromStorage();
        if (stored && stored.branchRankings && stored.branchRankings.length > 0) {
          return {
            success: true,
            branchLeaderboard: stored.branchRankings,
            isSnapshot: true,
            snapshotInfo: {
              weekStartDate: stored.weekStartDate,
              weekEndDate: stored.weekEndDate,
              processedAt: stored.processedAt,
            },
          };
        }
      }

      const live = await this.getLiveBranchLeaderboard();
      return {
        success: true,
        branchLeaderboard: live,
        isSnapshot: false,
      };
    } catch (err: any) {
      console.error("getBranchLeaderboard error:", err);
      return { success: false, branchLeaderboard: [], error: err?.message };
    }
  }

  async processWeeklyLeaderboardAndReset(params?: {
    resetRoles?: string[];
    recordTransaction?: boolean;
    clearPointTransactions?: boolean;
    notifyEmployees?: boolean;
    resetStreaks?: boolean;
  }): Promise<{
    success: boolean;
    weekStartDate: string;
    weekEndDate: string;
    processedAt: string;
    snapshotsCreated: number;
    affectedUsersCount: number;
    totalPointsReset: number;
    deletedTransactionsCount?: number;
    error?: string;
  }> {
    try {
      const now = new Date();
      const { weekStartDate, weekEndDate } = getThaiWeekRange(now);
      const targetRoles =
        params?.resetRoles && params.resetRoles.length > 0
          ? params.resetRoles
          : ["employee", "manager_assistant"];
      const shouldClearTx = params?.clearPointTransactions !== false;
      const shouldRecordTx = !shouldClearTx && params?.recordTransaction !== false;
      const shouldNotify = params?.notifyEmployees !== false;
      const shouldResetStreaks = Boolean(params?.resetStreaks); // Defaults to false: keep streaks!

      // 1. Gather live overall rankings across all branches (Global individuals)
      const allBranchesLeaderboard = await this.getLiveLeaderboard();

      // 2. Gather live rankings per branch (Branch individuals)
      const allBranches = await this.db.select().from(branches);
      const branchesMap: Record<string, LeaderboardEntry[]> = {};
      for (const branch of allBranches) {
        branchesMap[branch.id] = await this.getLiveLeaderboard(branch.id);
      }

      // 3. Gather live branch rankings (Branch vs Branch scoreboard)
      const branchRankings = await this.getLiveBranchLeaderboard();

      // 4. Save JSON snapshot to Supabase Storage bucket
      const storageSaved = await saveWeeklyLeaderboardToStorage({
        weekStartDate,
        weekEndDate,
        processedAt: now.toISOString(),
        totalParticipants: allBranchesLeaderboard.length,
        topScore: allBranchesLeaderboard[0]?.point || 0,
        overall: allBranchesLeaderboard,
        branches: branchesMap,
        branchRankings,
      });

      if (!storageSaved) {
        console.warn("processWeeklyLeaderboardAndReset: Failed to save to Supabase Storage");
      }

      // 5. Reset scores and clear transactions in database for the new week
      const resetRes = await this.resetEmployeeScores({
        resetRoles: targetRoles,
        recordTransaction: shouldRecordTx,
        clearPointTransactions: shouldClearTx,
        notifyEmployees: false, // Notification handled below with weekly context
        resetStreaks: shouldResetStreaks,
      });

      // 6. Send weekly summary notification
      if (shouldNotify && this.notificationService) {
        await this.notificationService.createNotification({
          recipientRole: "employee",
          title: "🏆 สรุปผลตารางอันดับสัปดาห์และเริ่มต้นสัปดาห์ใหม่!",
          message: `ระบบได้ประมวลผลตารางอันดับประจำสัปดาห์ (${weekStartDate} ถึง ${weekEndDate}) เรียบร้อยแล้ว พร้อมรีเซ็ตคะแนนสะสมรอบใหม่เพื่อเริ่มสะสมแต้มสัปดาห์นี้! ตรวจสอบผลงานได้ที่ตารางอันดับ`,
          type: "system",
        });
      }

      return {
        success: true,
        weekStartDate,
        weekEndDate,
        processedAt: now.toISOString(),
        snapshotsCreated: storageSaved ? 1 + allBranches.length : 0,
        affectedUsersCount: resetRes.affectedUsersCount,
        totalPointsReset: resetRes.totalPointsReset,
        deletedTransactionsCount: resetRes.deletedTransactionsCount,
      };
    } catch (err: unknown) {
      console.error("processWeeklyLeaderboardAndReset error:", err);
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการประมวลผลตารางคะแนนสัปดาห์";
      return {
        success: false,
        weekStartDate: "",
        weekEndDate: "",
        processedAt: new Date().toISOString(),
        snapshotsCreated: 0,
        affectedUsersCount: 0,
        totalPointsReset: 0,
        deletedTransactionsCount: 0,
        error: message,
      };
    }
  }

  async resetEmployeeScores(params?: {
    resetRoles?: string[];
    recordTransaction?: boolean;
    clearPointTransactions?: boolean;
    notifyEmployees?: boolean;
    resetStreaks?: boolean;
  }): Promise<{
    success: boolean;
    affectedUsersCount: number;
    totalPointsReset: number;
    deletedTransactionsCount?: number;
    error?: string;
  }> {
    try {
      const now = new Date();
      const targetRoles =
        params?.resetRoles && params.resetRoles.length > 0
          ? params.resetRoles
          : ["employee", "manager_assistant"];
      const shouldClearTx = params?.clearPointTransactions !== false;
      const shouldRecordTx = !shouldClearTx && params?.recordTransaction !== false;
      const shouldNotify = params?.notifyEmployees !== false;
      const shouldResetStreaks = Boolean(params?.resetStreaks);

      // Find all target users matching roles
      const allUsers = await this.db.select().from(users);
      const targetUsers = allUsers.filter((u: any) => {
        const availableRoles = getUserAvailableRoles(u);
        return targetRoles.some((r: any) => availableRoles.includes(r as ActiveRole));
      });

      const usersToReset = targetUsers.filter(
        (u: typeof users.$inferSelect) =>
          (u.point || 0) > 0 || (shouldResetStreaks && (u.point_streak || 0) > 0)
      );

      let totalPointsReset = 0;
      for (const u of usersToReset) {
        totalPointsReset += u.point || 0;
      }

      // 1. Audit trail: Record reset transaction for users who had points (only if NOT clearing transactions)
      if (shouldRecordTx && usersToReset.length > 0) {
        const txValues = usersToReset
          .filter((u: typeof users.$inferSelect) => (u.point || 0) > 0)
          .map((u: typeof users.$inferSelect) => {
            return {
              user_id: u.id,
              points: -u.point,
              type: "weekly_reset",
              description: `รีเซ็ตคะแนนรอบสัปดาห์ใหม่หลังสรุปผลวันอาทิตย์ (ล้างคะแนนเดิม ${u.point} แต้ม)`,
              created_at: now,
            };
          });

        if (txValues.length > 0) {
          await this.db.insert(pointTransactions).values(txValues);
        }
      }

      // 2. Clear point transactions for target users if enabled (user request: clears transactions as points reset every week anyway)
      let deletedTransactionsCount = 0;
      const targetUserIds = targetUsers.map((u: any) => u.id);
      if (shouldClearTx && targetUserIds.length > 0) {
        const isAllUsersTargeted = targetUsers.length === allUsers.length;
        if (isAllUsersTargeted) {
          const deletedTxs = await this.db
            .delete(pointTransactions)
            .where(lte(pointTransactions.created_at, now))
            .returning({ id: pointTransactions.id });
          deletedTransactionsCount = deletedTxs.length;
        } else {
          const CHUNK_SIZE = 200;
          for (let i = 0; i < targetUserIds.length; i += CHUNK_SIZE) {
            const chunk = targetUserIds.slice(i, i + CHUNK_SIZE);
            const deletedTxs = await this.db
              .delete(pointTransactions)
              .where(
                and(
                  inArray(pointTransactions.user_id, chunk),
                  lte(pointTransactions.created_at, now)
                )
              )
              .returning({ id: pointTransactions.id });
            deletedTransactionsCount += deletedTxs.length;
          }
        }
      }

      // 3. Reset points in database for affected users
      if (usersToReset.length > 0) {
        const updatePayload: {
          point: number;
          point_streak?: number;
          point_streak_type?: "none" | "flawed" | "perfect";
        } = { point: 0 };

        if (shouldResetStreaks) {
          updatePayload.point_streak = 0;
          updatePayload.point_streak_type = "none";
        }

        const userIdsToUpdate = usersToReset.map((u: any) => u.id);
        const CHUNK_SIZE = 200;
        for (let i = 0; i < userIdsToUpdate.length; i += CHUNK_SIZE) {
          const chunk = userIdsToUpdate.slice(i, i + CHUNK_SIZE);
          await this.db
            .update(users)
            .set(updatePayload)
            .where(inArray(users.id, chunk));
        }
      }

      // 4. Send broadcast notification if enabled
      if (shouldNotify && this.notificationService) {
        await this.notificationService.createNotification({
          recipientRole: "employee",
          title: "🎉 เริ่มต้นรอบคะแนนประจำสัปดาห์ใหม่",
          message: "ระบบได้ทำการรีเซ็ตคะแนนสะสมประจำสัปดาห์ของพนักงานเรียบร้อยแล้ว ขอให้ทุกคนร่วมสนุกกับการสะสมแต้มรอบใหม่ในสัปดาห์นี้!",
          type: "system",
        });
      }

      return {
        success: true,
        affectedUsersCount: usersToReset.length,
        totalPointsReset,
        deletedTransactionsCount,
      };
    } catch (err: unknown) {
      console.error("resetEmployeeScores error:", err);
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการรีเซ็ตคะแนนพนักงานประจำสัปดาห์";
      return {
        success: false,
        affectedUsersCount: 0,
        totalPointsReset: 0,
        deletedTransactionsCount: 0,
        error: message,
      };
    }
  }

  /**
   * Daily Streak Evaluation Cron Routine
   * Evaluates all frontline employees and assistant managers for targetDateStr (default today):
   * 1. If worked:
   *    - Checks all shift tasks and completion status.
   *    - If all completed without issues and on time -> perfect streak.
   *    - If not perfect -> changes streak type to "flawed".
   * 2. If did NOT work:
   *    - Checks employeeLeaves for approved leave notice covering the date:
   *      - If has approved leave AND preserve_streak = true -> streak is preserved.
   *      - If has approved leave BUT preserve_streak = false -> changes streak type to "flawed".
   *      - If NO approved leave notice (absent) -> changes streak type to "flawed".
   */
  async evaluateDailyStreaks(targetDateStr?: string): Promise<{
    success: boolean;
    evaluatedCount: number;
    perfectCount: number;
    flawedCount: number;
    preservedCount: number;
    error?: string;
  }> {
    try {
      const { startOfDay, endOfDay, dateStr } = targetDateStr
        ? getThaiStartAndEndOfDay(new Date(targetDateStr + "T12:00:00+07:00"))
        : getThaiStartAndEndOfDay();

      // 1. Fetch frontline participating staff (only employees & assistant managers)
      const allUsers = await this.db.select().from(users);
      const participatingStaff = allUsers.filter((u: any) => isScoreboardEligible(u));

      if (participatingStaff.length === 0) {
        return {
          success: true,
          evaluatedCount: 0,
          perfectCount: 0,
          flawedCount: 0,
          preservedCount: 0,
        };
      }

      // 2. Fetch all shift sessions for target date
      const dateSessions = await this.db
        .select()
        .from(shiftSession)
        .where(
          and(
            gte(shiftSession.start, startOfDay),
            lte(shiftSession.start, endOfDay)
          )
        );

      const sessionIds = dateSessions.map((s: any) => s.id);
      const dateWorks =
        sessionIds.length > 0
          ? await this.db
              .select()
              .from(taskWork)
              .where(inArray(taskWork.shift_session, sessionIds))
          : [];

      const allTasks = await this.db.select().from(tasks);

      // 3. Fetch approved leaves covering target date
      const dateLeaves = await this.db
        .select()
        .from(employeeLeaves)
        .where(
          and(
            lte(employeeLeaves.start_date, dateStr),
            gte(employeeLeaves.end_date, dateStr),
            eq(employeeLeaves.status, "approved")
          )
        );

      let perfectCount = 0;
      let flawedCount = 0;
      let preservedCount = 0;

      const userUpdates: Array<{
        userId: string;
        streakType: "none" | "flawed" | "perfect";
        resetCount?: boolean;
      }> = [];

      for (const staff of participatingStaff) {
        const staffSessions = dateSessions.filter((s: any) => s.user === staff.id);
        const staffLeave = dateLeaves.find((l: any) => l.user_id === staff.id);

        if (staffSessions.length > 0) {
          // --- Case 1: Staff worked one or more shifts today ---
          let isDayPerfect = true;

          for (const sess of staffSessions) {
            // Incomplete shift under penalty
            if (sess.incomplete_status === "reviewed" && sess.incomplete_action && sess.incomplete_action !== "no_penalty") {
              isDayPerfect = false;
              break;
            }
            if (sess.incomplete_status === "pending" || (!sess.end && sess.incomplete_reason)) {
              isDayPerfect = false;
              break;
            }

            const sessWorks = dateWorks.filter((w: any) => w.shift_session === sess.id);
            for (const work of sessWorks) {
              const t = allTasks.find((task: any) => task.id === work.task);
              // Manager/night closing tasks don't penalize normal checklist streak
              if (t && (t.for_managers || t.shift === "night")) {
                continue;
              }
              if (!work.timestamp) {
                isDayPerfect = false;
                break;
              }
              if (t?.end) {
                const completedDate = new Date(work.timestamp);
                const [endHour, endMinute] = t.end.split(":").map(Number);
                const deadlineDate = new Date(sess.start);
                deadlineDate.setHours(endHour, endMinute, 0, 0);
                if (completedDate > deadlineDate) {
                  isDayPerfect = false;
                  break;
                }
              }
            }

            if (!isDayPerfect) break;
          }

          if (isDayPerfect) {
            perfectCount++;
            if (staff.point_streak_type !== "perfect") {
              userUpdates.push({
                userId: staff.id,
                streakType: "perfect",
              });
            }
          } else {
            flawedCount++;
            if (staff.point_streak_type !== "flawed") {
              userUpdates.push({
                userId: staff.id,
                streakType: "flawed",
              });
            }
          }
        } else {
          // --- Case 2: Staff did NOT work today ---
          if (staffLeave) {
            // Has approved leave notice
            if (staffLeave.preserve_streak) {
              // Manager enabled preserve streak (paid leave) -> streak is preserved
              preservedCount++;
            } else {
              // Unpaid leave / preserve streak not enabled -> cut streak
              flawedCount++;
              userUpdates.push({
                userId: staff.id,
                streakType: "none",
                resetCount: true,
              });
            }
          } else {
            // Absent without leave notice -> change to flawed
            flawedCount++;
            if (staff.point_streak_type !== "flawed") {
              userUpdates.push({
                userId: staff.id,
                streakType: "flawed",
              });
            }
          }
        }
      }

      // Execute updates
      for (const update of userUpdates) {
        await this.db
          .update(users)
          .set({
            point_streak_type: update.streakType,
            ...(update.resetCount ? { point_streak: 0 } : {}),
          })
          .where(eq(users.id, update.userId));
      }

      return {
        success: true,
        evaluatedCount: participatingStaff.length,
        perfectCount,
        flawedCount,
        preservedCount,
      };
    } catch (err: unknown) {
      console.error("evaluateDailyStreaks error:", err);
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการประเมินสตรีคประจำวัน";
      return {
        success: false,
        evaluatedCount: 0,
        perfectCount: 0,
        flawedCount: 0,
        preservedCount: 0,
        error: message,
      };
    }
  }
}

