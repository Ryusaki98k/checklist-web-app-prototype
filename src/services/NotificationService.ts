import { eq, or, and, isNull, inArray, desc } from "drizzle-orm";
import { notifications, branches, notificationReads } from "../db/schema";
import { INotificationService } from "./types";
import { Notification, Role } from "../types";

export class NotificationService implements INotificationService {
  constructor(private db: any) { }

  async createNotification(params: {
    recipientId?: string;
    recipientRole?: Role;
    branchId?: string;
    title: string;
    message: string;
    type?: string;
    shiftSessionId?: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const [newNotif] = await this.db
        .insert(notifications)
        .values({
          recipient_id: params.recipientId || null,
          recipient_role: (params.recipientRole as any) || null,
          branch_id: params.branchId || null,
          title: params.title,
          message: params.message,
          type: params.type || "info",
          shift_session_id: params.shiftSessionId || null,
          is_read: false,
          created_at: new Date(),
        })
        .returning();

      return { success: true, id: newNotif.id };
    } catch (err: any) {
      console.error("createNotification error:", err);
      return { success: false, error: err?.message || "Failed to create notification" };
    }
  }

  async getNotificationsForUser(params: {
    userId: string;
    role?: Role;
    branchId?: string;
  }): Promise<{ success: boolean; notifications: Notification[]; unreadCount: number; error?: string }> {
    try {
      const { userId, role, branchId } = params;

      // Filter: either sent specifically to this user, or sent to their role/branch broadcast
      const conditions = [];

      // Direct notification
      conditions.push(eq(notifications.recipient_id, userId));

      // Broadcast notifications
      const broadcastConditions = [isNull(notifications.recipient_id)];
      if (role) {
        broadcastConditions.push(
          or(isNull(notifications.recipient_role), eq(notifications.recipient_role, role as any))!
        );
      }
      if (branchId) {
        broadcastConditions.push(
          or(isNull(notifications.branch_id), eq(notifications.branch_id, branchId))!
        );
      }

      conditions.push(and(...broadcastConditions)!);

      const rows = await this.db
        .select()
        .from(notifications)
        .where(or(...conditions))
        .orderBy(desc(notifications.created_at))
        .limit(50);

      // Fetch branch names
      const branchIds = Array.from(new Set(rows.map((r: any) => r.branch_id).filter(Boolean)));
      const branchRows =
        branchIds.length > 0
          ? await this.db.select({ id: branches.id, name: branches.name }).from(branches)
          : [];

      const branchMap = new Map<string, string>(branchRows.map((b: any) => [b.id, b.name]));

      // Fetch read receipts for broadcast notifications for this user (eliminates array scanning and race conditions)
      const notifIds = rows.map((r: any) => r.id);
      let userReadNotifIds = new Set<string>();
      if (notifIds.length > 0) {
        const readRows = await this.db
          .select({ notificationId: notificationReads.notification_id })
          .from(notificationReads)
          .where(
            and(
              eq(notificationReads.user_id, userId),
              inArray(notificationReads.notification_id, notifIds)
            )
          );
        userReadNotifIds = new Set(readRows.map((r: any) => r.notificationId));
      }

      const mapped: Notification[] = rows.map((r: any) => {
        const isRead = r.recipient_id === userId ? Boolean(r.is_read) : userReadNotifIds.has(r.id);
        return {
          id: r.id,
          title: r.title,
          message: r.message,
          type: r.type,
          shiftSessionId: r.shift_session_id || undefined,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          read: Boolean(isRead),
          branchName: r.branch_id ? branchMap.get(r.branch_id) : undefined,
        };
      });

      const unreadCount = mapped.filter((n) => !n.read).length;

      return { success: true, notifications: mapped, unreadCount };
    } catch (err: any) {
      console.error("getNotificationsForUser error:", err);
      return { success: false, notifications: [], unreadCount: 0, error: err?.message };
    }
  }

  async markAsRead(notificationId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const [existing] = await this.db
        .select()
        .from(notifications)
        .where(eq(notifications.id, notificationId))
        .limit(1);

      if (!existing) {
        return { success: false, error: "Notification not found" };
      }

      if (existing.recipient_id === userId) {
        // Direct notification targeted specifically to this user
        await this.db
          .update(notifications)
          .set({ is_read: true })
          .where(eq(notifications.id, notificationId));
      } else {
        // Broadcast notification: atomic insert with ON CONFLICT DO NOTHING (zero race conditions)
        await this.db
          .insert(notificationReads)
          .values({
            notification_id: notificationId,
            user_id: userId,
            read_at: new Date(),
          })
          .onConflictDoNothing();
      }

      return { success: true };
    } catch (err: any) {
      console.error("markAsRead error:", err);
      return { success: false, error: err?.message };
    }
  }

  async markAllAsRead(userId: string, role?: Role, branchId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { notifications: userNotifs } = await this.getNotificationsForUser({ userId, role, branchId });
      const unreadNotifs = userNotifs.filter((n) => !n.read);

      for (const n of unreadNotifs) {
        await this.markAsRead(n.id, userId);
      }
      return { success: true };
    } catch (err: any) {
      console.error("markAllAsRead error:", err);
      return { success: false, error: err?.message };
    }
  }
}

