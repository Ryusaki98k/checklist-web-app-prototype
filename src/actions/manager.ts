"use server";

import { getServices } from "../services/container";
import { Role, LeaveType, EmployeeLeave, LeaveQuotaInfo } from "../types";
import { ManagerShiftSummary } from "../services/ManagerService";
import { BranchEmployeeStatus } from "../services/types";

export type { ManagerShiftSummary, BranchEmployeeStatus, EmployeeLeave, LeaveType, LeaveQuotaInfo };

export async function getManagerShiftSessionsAction(filterDate?: string): Promise<{
  success: boolean;
  sessions?: ManagerShiftSummary[];
  hasAssistantLoggedInToday?: boolean;
  error?: string;
}> {
  const services = getServices();
  return await services.manager.getManagerShiftSessions(filterDate);
}

export async function getHistoryShiftSessionsAction(
  daysOffset: number = 14,
  specificDate?: string
): Promise<{
  success: boolean;
  sessions?: ManagerShiftSummary[];
  error?: string;
}> {
  const services = getServices();
  return await services.manager.getHistoryShiftSessions(daysOffset, specificDate);
}

export async function approveShiftSessionAction(params: {
  shiftSessionId: string;
  role: "manager" | "manager_assistant" | "committee" | "general_manager" | Role;
  isException?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.manager.approveShiftSession(params);
}

export async function reviewIncompleteShiftAction(params: {
  shiftSessionId: string;
  reviewerId: string;
  action: "no_penalty" | "deduct_points" | "break_streak" | "deduct_leave_quota";
  pointsToDeduct?: number;
  note?: string;
}): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.manager.reviewIncompleteShift(params);
}

export async function getBranchStaffStatusAction(branchId?: string): Promise<{
  success: boolean;
  employees?: BranchEmployeeStatus[];
  branches?: Array<{ id: string; name: string }>;
  selectedBranchId?: string;
  error?: string;
}> {
  const services = getServices();
  return await services.manager.getBranchStaffStatus(branchId);
}

export async function processShiftAttendanceAlertsAction(params?: {
  dateStr?: string;
}) {
  const services = getServices();
  return await services.manager.processShiftAttendanceAlerts(params);
}

export async function markEmployeeLeaveAction(params: {
  userId: string;
  branchId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  preserveStreak?: boolean;
  recordedBy: string;
}): Promise<{ success: boolean; leave?: EmployeeLeave; error?: string }> {
  const services = getServices();
  return await services.manager.markEmployeeLeave(params);
}

export async function getBranchLeavesAction(params: {
  branchId: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ success: boolean; leaves?: EmployeeLeave[]; error?: string }> {
  const services = getServices();
  return await services.manager.getBranchLeaves(params);
}

export async function cancelEmployeeLeaveAction(params: {
  leaveId: string;
  cancelledBy: string;
}): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.manager.cancelEmployeeLeave(params);
}

export async function getEmployeeLeaveQuotaAction(params: {
  userId: string;
  branchId?: string;
}): Promise<{ success: boolean; quota?: LeaveQuotaInfo; error?: string }> {
  const services = getServices();
  return await services.manager.getEmployeeLeaveQuota(params);
}

export async function requestEmployeeLeaveAction(params: {
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
  const services = getServices();
  return await services.manager.requestEmployeeLeave(params);
}

export async function approveEmployeeLeaveAction(params: {
  leaveId: string;
  approvedBy: string;
  leaveType?: LeaveType;
  preserveStreak?: boolean;
}): Promise<{ success: boolean; leave?: EmployeeLeave; error?: string }> {
  const services = getServices();
  return await services.manager.approveEmployeeLeave(params);
}

export async function rejectEmployeeLeaveAction(params: {
  leaveId: string;
  rejectedBy: string;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.manager.rejectEmployeeLeave(params);
}

export async function updateEmployeeLeaveQuotaAction(params: {
  userId: string;
  quota: number | null;
}): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.manager.updateEmployeeLeaveQuota(params);
}

export async function updateBranchLeaveQuotaAction(params: {
  branchId: string;
  quota: number;
}): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.manager.updateBranchLeaveQuota(params);
}

export async function getAllUsersLeaveQuotasAction(): Promise<{
  success: boolean;
  quotas?: Record<string, LeaveQuotaInfo>;
  error?: string;
}> {
  const services = getServices();
  return await services.manager.getAllUsersLeaveQuotas();
}


