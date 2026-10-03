import { eq, desc, sql, inArray } from "drizzle-orm";
import { users, pointTransactions, shiftSession, taskWork, tasks, branches } from "../db/schema";
import { IPointService, INotificationService } from "./types";
import { PointTransaction, LeaderboardEntry, Role } from "../types";
import { isSpecialZeroPointTask } from "./ChecklistService";
import { isValidUuid } from "../utils/validation";

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

      // Check if session tasks exclusively consist of special closing checklist tasks (Zero Points Rule)
      const nonSpecialTasks = sessionTasks.filter((t: any) => !isSpecialZeroPointTask(t.name));
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
        // Special zero-point closing tasks do not penalize streaks or evaluate late infractions
        if (t && isSpecialZeroPointTask(t.name)) {
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

        totalPoints = 2;
        pointReasons.push("เช็คลิสต์สมบูรณ์ตรงเวลา (+2 แต้ม)");

        // Bonus: every 5 perfect in a row == 3 bonus points
        if (newStreakCount > 0 && newStreakCount % 5 === 0) {
          totalPoints += 3;
          pointReasons.push(`โบนัสสตรีคสมบูรณ์ทุกๆ 5 ครั้งติดต่อกัน (สตรีคที่ ${newStreakCount}) (+3 แต้ม)`);
        }
      } else if (isException) {
        // Exception approval (อนุโลม): Do NOT break the streak!
        // Sets streak type to 'flawed' while keeping and incrementing the streak count
        newStreakType = "flawed";
        newStreakCount = (targetUser?.point_streak || 0) + 1;
        totalPoints = 1;
        pointReasons.push("ผู้บริหารอนุมัติแบบอนุโลม: รักษาสตรีคต่อเนื่องเป็นสถานะมีข้อบกพร่อง (+1 แต้ม)");
      } else {
        // Standard imperfect shift: breaks the streak
        newStreakType = "flawed";
        newStreakCount = 0;
        totalPoints = 1;
        pointReasons.push("เช็คลิสต์มีรายการล่าช้าหรือไม่สมบูรณ์ (+1 แต้ม)");
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
          ? "🛡️ อนุมัติแบบอนุโลม (รักษาสตรีค Flawed)"
          : "✅ อนุมัติการส่งงานสำเร็จ";
        const notifMsg = isPerfect
          ? `ยินดีด้วย! คุณปฏิบัติงานตรงเวลาครบถ้วน (+${totalPoints} แต้ม) สตรีคสมบูรณ์ ${newStreakCount} วันติด`
          : isException
          ? `ผู้จัดการได้อนุมัติแบบอนุโลมให้กะของคุณ (+${totalPoints} แต้ม) รักษาสตรีคต่อเนื่องที่ ${newStreakCount} วัน (สถานะ Flawed)`
          : `คุณได้รับคะแนนจากการปฏิบัติงาน (+${totalPoints} แต้ม)`;

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
      if (!isValidUuid(userId)) {
        return {
          success: false,
          points: 0,
          streak: 0,
          streakType: "none",
          longestStreak: 0,
          transactions: [],
          error: "ไมพบผู้ใช้งาน",
        };
      }

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

  async getLeaderboard(branchId?: string): Promise<{
    success: boolean;
    leaderboard: LeaderboardEntry[];
    error?: string;
  }> {
    try {
      const allBranches = await this.db.select().from(branches);
      let allUsers: any[] = [];

      if (branchId) {
        const targetBranch = allBranches.find((b: any) => b.id === branchId);
        const memberIds: string[] = Array.isArray(targetBranch?.members) ? targetBranch.members : [];
        if (memberIds.length > 0) {
          allUsers = await this.db
            .select()
            .from(users)
            .where(inArray(users.id, memberIds))
            .orderBy(desc(users.point))
            .limit(30);
        } else {
          allUsers = [];
        }
      } else {
        allUsers = await this.db
          .select()
          .from(users)
          .orderBy(desc(users.point))
          .limit(30);
      }

      const mapped: LeaderboardEntry[] = allUsers.map((u: any) => {
        const userBranch = allBranches.find(
          (b: any) => Array.isArray(b.members) && b.members.includes(u.id)
        );

        let defaultPosition: string | undefined = undefined;
        if (u.role === "manager") defaultPosition = "ผู้จัดการร้าน";
        else if (u.role === "committee") defaultPosition = "กรรมการ";
        else if (u.role === "manager_assistant") defaultPosition = "ผู้ช่วยผู้จัดการร้าน";
        else if (u.role === "admin") defaultPosition = "ผู้ดูแลระบบส่วนกลาง";
        else defaultPosition = "พนักงานสาขา";

        return {
          userId: u.id,
          name: u.name,
          role: u.role as Role,
          position: defaultPosition,
          branchName: userBranch ? userBranch.name : undefined,
          point: u.point || 0,
          pointStreak: u.point_streak || 0,
          pointStreakType: (u.point_streak_type as any) || "none",
        };
      });

      return { success: true, leaderboard: mapped };
    } catch (err: any) {
      console.error("getLeaderboard error:", err);
      return { success: false, leaderboard: [], error: err?.message };
    }
  }

  async resetEmployeeScores(params?: {
    resetRoles?: string[];
    recordTransaction?: boolean;
    notifyEmployees?: boolean;
    resetStreaks?: boolean;
  }): Promise<{
    success: boolean;
    affectedUsersCount: number;
    totalPointsReset: number;
    error?: string;
  }> {
    try {
      const targetRoles =
        params?.resetRoles && params.resetRoles.length > 0
          ? params.resetRoles
          : ["employee"];
      const shouldRecordTx = params?.recordTransaction !== false;
      const shouldNotify = params?.notifyEmployees !== false;
      const shouldResetStreaks = Boolean(params?.resetStreaks);

      // Find all target users with points > 0 or streaks > 0 if resetting streaks
      const targetUsers = await this.db
        .select()
        .from(users)
        .where(inArray(users.role, targetRoles as ("admin" | "committee" | "general_manager" | "manager" | "manager_assistant" | "employee")[]));

      const usersToReset = targetUsers.filter(
        (u: typeof users.$inferSelect) =>
          (u.point || 0) > 0 || (shouldResetStreaks && (u.point_streak || 0) > 0)
      );

      let totalPointsReset = 0;

      if (usersToReset.length > 0) {
        // 1. Audit trail: Record reset transaction for users who had points
        if (shouldRecordTx) {
          const now = new Date();
          const txValues = usersToReset
            .filter((u: typeof users.$inferSelect) => (u.point || 0) > 0)
            .map((u: typeof users.$inferSelect) => {
              totalPointsReset += u.point;
              return {
                user_id: u.id,
                points: -u.point,
                type: "monthly_reset",
                description: `รีเซ็ตคะแนนรอบเดือนใหม่ (ล้างคะแนนเดิม ${u.point} แต้ม)`,
                created_at: now,
              };
            });

          if (txValues.length > 0) {
            await this.db.insert(pointTransactions).values(txValues);
          }
        } else {
          for (const u of usersToReset) {
            totalPointsReset += u.point || 0;
          }
        }

        // 2. Reset points in database for all users with target roles
        const updatePayload: {
          point: number;
          point_streak?: number;
          point_streak_type?: "none" | "flawed" | "perfect";
        } = { point: 0 };

        if (shouldResetStreaks) {
          updatePayload.point_streak = 0;
          updatePayload.point_streak_type = "none";
        }

        await this.db
          .update(users)
          .set(updatePayload)
          .where(inArray(users.role, targetRoles as ("admin" | "committee" | "general_manager" | "manager" | "manager_assistant" | "employee")[]));
      }

      // 3. Send broadcast notification if enabled
      if (shouldNotify && this.notificationService) {
        await this.notificationService.createNotification({
          recipientRole: "employee",
          title: "🎉 เริ่มต้นรอบคะแนนประจำเดือนใหม่",
          message: "ระบบได้ทำการรีเซ็ตคะแนนสะสมประจำเดือนของพนักงานเรียบร้อยแล้ว ขอให้ทุกคนร่วมสนุกกับการสะสมแต้มรอบใหม่ในเดือนนี้!",
          type: "system",
        });
      }

      return {
        success: true,
        affectedUsersCount: usersToReset.length,
        totalPointsReset,
      };
    } catch (err: unknown) {
      console.error("resetEmployeeScores error:", err);
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการรีเซ็ตคะแนนพนักงานประจำเดือน";
      return {
        success: false,
        affectedUsersCount: 0,
        totalPointsReset: 0,
        error: message,
      };
    }
  }
}

