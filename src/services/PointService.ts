import { eq, desc, sql, inArray } from "drizzle-orm";
import { users, pointTransactions, shiftSession, taskWork, tasks, branches } from "../db/schema";
import { IPointService, INotificationService } from "./types";
import { PointTransaction, LeaderboardEntry, Role } from "../types";

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

  async evaluateShiftSession(shiftSessionId: string): Promise<{
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

      let hasIssueOrLate = false;
      for (const work of sessionWorks) {
        if (!work.timestamp) {
          hasIssueOrLate = true;
          break;
        }
        const t = sessionTasks.find((item: any) => item.id === work.task);
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

      // Fetch user to manage streaks
      const [targetUser] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, session.user))
        .limit(1);

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
      } else {
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
        type: isPerfect ? "perfect_shift" : "shift_completion",
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
        await this.notificationService.createNotification({
          recipientId: session.user,
          title: isPerfect ? "🌟 ผลงานยอดเยี่ยมตรงเวลา!" : "✅ อนุมัติการส่งงานสำเร็จ",
          message: `ผู้จัดการได้ตรวจสอบงานกะของคุณเรียบร้อยแล้ว คุณได้รับ ${totalPoints} แต้ม (${pointReasons.join(
            " • "
          )})`,
          type: "point_awarded",
          shiftSessionId: session.id,
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

  async getLeaderboard(branchId?: string): Promise<{
    success: boolean;
    leaderboard: LeaderboardEntry[];
    error?: string;
  }> {
    try {
      const allUsers = await this.db
        .select()
        .from(users)
        .orderBy(desc(users.point))
        .limit(30);

      const allBranches = await this.db.select().from(branches);

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
}
