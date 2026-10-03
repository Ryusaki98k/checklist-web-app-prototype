import { Role, ShiftType, User, ShiftSession, Notification, PointTransaction, LeaderboardEntry, LeaveType, EmployeeLeave, LeaveQuotaInfo } from "../types";

export interface IAuthService {
  login(username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }>;
  register(data: {
    name: string;
    username: string;
    password?: string;
    role?: Role;
    position?: string;
    branchId?: string;
    leaveQuota?: number | null;
  }): Promise<{ success: boolean; user?: User; error?: string }>;
  getUserById(id: string): Promise<{ success: boolean; user?: User; error?: string }>;
  getAllUsers(): Promise<{ success: boolean; users?: User[]; error?: string }>;
  syncOAuthUser(userData: {
    id: string;
    username?: string;
    name?: string;
    role?: Role;
  }): Promise<{ success: boolean; user?: User; error?: string }>;
  updateUserRole(userId: string, role: Role): Promise<{ success: boolean; error?: string }>;
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

  evaluateShiftSession(shiftSessionId: string, isException?: boolean): Promise<{
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

  resetEmployeeScores(params?: {
    resetRoles?: string[];
    recordTransaction?: boolean;
    notifyEmployees?: boolean;
    resetStreaks?: boolean;
  }): Promise<{
    success: boolean;
    affectedUsersCount: number;
    totalPointsReset: number;
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
  }): Promise<{ success: boolean; completedAt?: string | null; taskWorkId?: string; error?: string }>;

  validateShiftCompletion(shiftSessionId: string): Promise<{
    success: boolean;
    isComplete: boolean;
    totalTasks: number;
    doneTasks: number;
    pendingTasks: Array<{ id: string; name: string }>;
    error?: string;
  }>;

  endShiftSession(params: string | { shiftSessionId: string; reason?: string }): Promise<{ success: boolean; error?: string }>;

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

  cleanupOldData(
    retentionDays?: number,
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
  }>;
}

export interface BranchEmployeeStatus {
  id: string;
  name: string;
  username?: string;
  role: Role;
  position?: string;
  branchId?: string;
  branchName?: string;
  isOnDuty: boolean;
  activeShift?: {
    sessionId: string;
    shift: ShiftType;
    taskRole?: "cashier" | "stock" | "manager_assistant";
    taskRoleTitle?: string;
    startedAt: string;
    durationMinutes: number;
    totalTasks: number;
    completedTasks: number;
    completionPercentage: number;
  };
  todayShiftsCount: number;
  totalShiftsWorked: number;
  lastShiftAt?: string | null;
  point: number;
  pointStreak: number;
  pointStreakType: "none" | "flawed" | "perfect";
  isOnLeave?: boolean;
  activeLeave?: {
    id: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
    preserveStreak?: boolean;
    recordedByName?: string;
  };
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
    isException?: boolean;
  }): Promise<{ success: boolean; error?: string }>;

  reviewIncompleteShift(params: {
    shiftSessionId: string;
    reviewerId: string;
    action: "no_penalty" | "deduct_points" | "break_streak" | "deduct_leave_quota";
    pointsToDeduct?: number;
    note?: string;
  }): Promise<{ success: boolean; error?: string }>;

  getBranchStaffStatus(branchId?: string): Promise<{
    success: boolean;
    employees?: BranchEmployeeStatus[];
    branches?: Array<{ id: string; name: string }>;
    selectedBranchId?: string;
    error?: string;
  }>;

  processShiftAttendanceAlerts(params?: {
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
  }>;

  markEmployeeLeave(params: {
    userId: string;
    branchId: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
    preserveStreak?: boolean;
    recordedBy: string;
  }): Promise<{ success: boolean; leave?: EmployeeLeave; error?: string }>;

  getBranchLeaves(params: {
    branchId: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ success: boolean; leaves?: EmployeeLeave[]; error?: string }>;

  cancelEmployeeLeave(params: {
    leaveId: string;
    cancelledBy: string;
  }): Promise<{ success: boolean; error?: string }>;

  cleanupOldLeaves(retentionDays?: number): Promise<{
    success: boolean;
    cutoffDate?: string;
    deletedCount?: number;
    error?: string;
  }>;

  getEmployeeLeaveQuota(params: {
    userId: string;
    branchId?: string;
  }): Promise<{ success: boolean; quota?: LeaveQuotaInfo; error?: string }>;

  requestEmployeeLeave(params: {
    userId: string;
    branchId: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
    requestedBy: string;
    preserveStreak?: boolean;
    isManagerRole?: boolean;
  }): Promise<{ success: boolean; leave?: EmployeeLeave; autoApproved?: boolean; error?: string }>;

  approveEmployeeLeave(params: {
    leaveId: string;
    approvedBy: string;
    leaveType?: LeaveType;
    preserveStreak?: boolean;
  }): Promise<{ success: boolean; leave?: EmployeeLeave; error?: string }>;

  rejectEmployeeLeave(params: {
    leaveId: string;
    rejectedBy: string;
    reason?: string;
  }): Promise<{ success: boolean; error?: string }>;

  updateEmployeeLeaveQuota(params: {
    userId: string;
    quota: number | null;
  }): Promise<{ success: boolean; error?: string }>;

  updateBranchLeaveQuota(params: {
    branchId: string;
    quota: number;
  }): Promise<{ success: boolean; error?: string }>;

  getAllUsersLeaveQuotas(): Promise<{
    success: boolean;
    quotas?: Record<string, LeaveQuotaInfo>;
    error?: string;
  }>;
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
  updateBranchLeaveQuota(branchId: string, quota: number): Promise<{ success: boolean; error?: string }>;
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
  processDailyRefrigeratorTasks(params?: {
    targetDate?: string;
    yesterdayDate?: string;
    createDailyTasks?: boolean;
    markMissedYesterdayTasks?: boolean;
  }): Promise<{
    success: boolean;
    processedBranches: number;
    totalNewTasksCreated: number;
    totalMissedTasksMarked: number;
    missedBranchesCount: number;
    details?: Array<{
      branchId: string;
      branchName: string;
      missedCount: number;
      missedRefrigerators: string[];
      newTasksCount: number;
    }>;
    error?: string;
  }>;
}

export type CronJobId = "cleanup-data" | "end-shifts" | "daily-refrigerators" | "reset-scores";

export interface CleanupDataConfig {
  retentionDays: number;
  cleanShiftSessions: boolean;
  cleanRefrigeratorTasks: boolean;
  cleanNotifications: boolean;
  cleanPointTransactions: boolean;
  cleanEmployeeLeaves: boolean;
}

export interface EndShiftsConfig {
  sendAttendanceAlerts: boolean;
  autoEndUnclosedShifts: boolean;
}

export interface DailyRefrigeratorsConfig {
  createDailyTasks: boolean;
  markMissedYesterdayTasks: boolean;
}

export interface ResetScoresConfig {
  resetRoles: string[];
  recordTransaction: boolean;
  notifyEmployees: boolean;
  resetStreaks: boolean;
}

export interface CronSetting {
  id: string;
  name: string;
  description: string;
  schedule_cron: string;
  schedule_description: string;
  enabled: boolean;
  config: Record<string, unknown>;
  last_run_at: Date | string | null;
  last_run_status: "success" | "failed" | "skipped" | null;
  last_run_message: string | null;
  updated_at?: Date | string | null;
}

export interface ICronService {
  getAllSettings(): Promise<CronSetting[]>;
  getSetting(id: string): Promise<CronSetting | null>;
  updateSetting(
    id: string,
    updates: { enabled?: boolean; config?: Record<string, unknown> }
  ): Promise<{ success: boolean; error?: string; setting?: CronSetting }>;
  recordExecution(
    id: string,
    result: { status: "success" | "failed" | "skipped"; message?: string }
  ): Promise<void>;
  runCronJob(
    id: string,
    overrides?: Record<string, unknown>
  ): Promise<{ success: boolean; skipped?: boolean; message?: string; result?: unknown; error?: string }>;
}

export interface IServiceContainer {
  auth: IAuthService;
  notifications: INotificationService;
  points: IPointService;
  checklist: IChecklistService;
  manager: IManagerService;
  branch: IBranchService;
  refrigerator: IRefrigeratorService;
  cron: ICronService;
}
