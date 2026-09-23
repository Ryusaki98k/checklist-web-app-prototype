import { Role, ShiftType, User, ShiftSession, Notification, PointTransaction, LeaderboardEntry } from "../types";

export interface IAuthService {
  login(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }>;
  register(data: {
    name: string;
    email: string;
    password?: string;
    role?: Role;
    position?: string;
    branchId?: string;
  }): Promise<{ success: boolean; user?: User; error?: string }>;
  getUserById(id: string): Promise<{ success: boolean; user?: User; error?: string }>;
  getAllUsers(): Promise<{ success: boolean; users?: User[]; error?: string }>;
  syncOAuthUser(userData: {
    id: string;
    email: string;
    name?: string;
    role?: Role;
  }): Promise<{ success: boolean; user?: User; error?: string }>;
  seedUsersIfEmpty(): Promise<void>;
}

export interface INotificationService {
  createNotification(params: {
    recipientId?: string;
    recipientRole?: Role;
    branchId?: string;
    title: string;
    message: string;
    type?: "shift_submitted" | "shift_approved" | "point_awarded" | "refrigerator_alert" | "system" | string;
    shiftSessionId?: string;
  }): Promise<{ success: boolean; id?: string; error?: string }>;

  getNotificationsForUser(params: {
    userId: string;
    role?: Role;
    branchId?: string;
  }): Promise<{ success: boolean; notifications: Notification[]; unreadCount: number; error?: string }>;

  markAsRead(notificationId: string, userId: string): Promise<{ success: boolean; error?: string }>;
  markAllAsRead(userId: string, role?: Role, branchId?: string): Promise<{ success: boolean; error?: string }>;
}

export interface IPointService {
  awardPoints(params: {
    userId: string;
    points: number;
    type: "shift_completion" | "on_time_bonus" | "perfect_shift" | "streak_bonus" | "manager_award" | string;
    shiftSessionId?: string;
    description: string;
  }): Promise<{ success: boolean; newTotal?: number; error?: string }>;

  evaluateShiftSession(shiftSessionId: string): Promise<{
    success: boolean;
    awardedPoints?: number;
    streakType?: "perfect" | "flawed";
    streakCount?: number;
    error?: string;
  }>;

  getUserPointDetails(userId: string): Promise<{
    success: boolean;
    points: number;
    streak: number;
    streakType: "none" | "flawed" | "perfect";
    longestStreak: number;
    transactions: PointTransaction[];
    error?: string;
  }>;

  getLeaderboard(branchId?: string): Promise<{
    success: boolean;
    leaderboard: LeaderboardEntry[];
    error?: string;
  }>;
}

export interface IChecklistService {
  getOrCreateShiftSession(params: {
    userId: string;
    userName: string;
    position: string;
    shift: ShiftType;
  }): Promise<{ success: boolean; session?: ShiftSession; error?: string }>;

  toggleTaskWork(params: {
    taskWorkId?: string;
    shiftSessionId?: string;
    taskId?: string;
    completed: boolean;
    comment?: string;
  }): Promise<{ success: boolean; completedAt?: string | null; error?: string }>;

  endShiftSession(shiftSessionId: string): Promise<{ success: boolean; error?: string }>;

  getPositionShiftsStatus(position: string, userId?: string): Promise<{
    success: boolean;
    statuses?: Record<ShiftType, { status: "completed" | "incomplete" | "none"; total: number; done: number }>;
    error?: string;
  }>;

  resetTodayChecklistData(position?: string): Promise<{ success: boolean; error?: string }>;

  autoEndUnfinishedShifts(): Promise<{
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
  }>;

  cleanupOldData(retentionDays?: number): Promise<{
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
  }>;
}

export interface IManagerService {
  getManagerShiftSessions(filterDate?: string): Promise<{
    success: boolean;
    sessions?: any[];
    hasAssistantLoggedInToday?: boolean;
    error?: string;
  }>;

  getHistoryShiftSessions(daysOffset?: number, specificDate?: string): Promise<{
    success: boolean;
    sessions?: any[];
    error?: string;
  }>;

  approveShiftSession(params: {
    shiftSessionId: string;
    role: "manager" | "manager_assistant" | "committee" | "general_manager" | Role;
  }): Promise<{ success: boolean; error?: string }>;
}

export interface IBranchService {
  getBranches(options?: { forceRefresh?: boolean }): Promise<{
    success: boolean;
    branches?: any[];
    lastUpdate?: string;
    error?: string;
  }>;
  checkBranchesUpdated(clientLastUpdate?: string, branchId?: string): Promise<{
    success: boolean;
    updated: boolean;
    lastUpdate?: string;
    branches?: any[];
    error?: string;
  }>;
  createBranch(name: string): Promise<{ success: boolean; error?: string }>;
  assignStaffToBranch(branchId: string, userIds: string[]): Promise<{ success: boolean; error?: string }>;
  assignTasksToBranch(branchId: string, taskIds: string[]): Promise<{ success: boolean; error?: string }>;
  invalidateCache(): void;
}

export interface RefrigeratorTaskItem {
  taskId: string;
  refrigeratorId: string;
  name: string;
  minTemperature: number;
  maxTemperature: number;
  targetTemperature?: number;
  disableCheck?: boolean;
  taskDate: string;
  completed: boolean;
  completedAt?: string | null;
  completedByUserId?: string | null;
  completedByUserName?: string | null;
  temperature?: number | null;
  isOkay?: boolean;
  comment?: string | null;
}

export interface IRefrigeratorService {
  getRefrigerators(userId: string): Promise<{ success: boolean; data?: any[]; error?: string }>;
  createRefrigerator(params: {
    userId: string;
    name: string;
    minTemperature: number;
    maxTemperature: number;
    disableCheck: boolean;
  }): Promise<{ success: boolean; data?: any; error?: string }>;
  updateRefrigerator(params: {
    id: string;
    name: string;
    minTemperature: number;
    maxTemperature: number;
    disableCheck: boolean;
  }): Promise<{ success: boolean; error?: string }>;
  ensureDailyRefrigeratorTasks(branchId: string, dateStr?: string): Promise<{ success: boolean; error?: string }>;
  getBranchRefrigeratorTasks(params: {
    userId?: string;
    branchId?: string;
    dateStr?: string;
  }): Promise<{
    success: boolean;
    data?: RefrigeratorTaskItem[];
    disabledRefrigerators?: Array<{ id: string; name: string; minTemperature: number; maxTemperature: number }>;
    branchName?: string;
    error?: string;
  }>;
  updateRefrigeratorTask(params: {
    taskId: string;
    userId: string;
    completed: boolean;
    temperature?: number;
    isOkay?: boolean;
    comment?: string;
    shiftSessionId?: string;
    shift?: ShiftType;
  }): Promise<{ success: boolean; data?: RefrigeratorTaskItem; error?: string }>;
}

export interface IServiceContainer {
  auth: IAuthService;
  notifications: INotificationService;
  points: IPointService;
  checklist: IChecklistService;
  manager: IManagerService;
  branch: IBranchService;
  refrigerator: IRefrigeratorService;
}
