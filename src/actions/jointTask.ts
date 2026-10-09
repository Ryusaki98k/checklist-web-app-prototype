"use server";

import { getServices } from "../services/container";
import { ShiftType, Role, JointTaskItem } from "../types";
import { RefrigeratorTaskItem } from "../services/types";

export async function getBranchJointTasksAction(params: {
  branchId: string;
  dateStr?: string;
  shift?: ShiftType;
}): Promise<{ success: boolean; data?: JointTaskItem[]; error?: string }> {
  const services = getServices();
  return await services.checklist.getBranchJointTasks(params);
}

export async function toggleJointTaskItemAction(params: {
  jointWorkId?: string;
  taskId: string;
  branchId: string;
  dateStr: string;
  shift?: ShiftType;
  userId: string;
  completed: boolean;
  comment?: string;
  custom?: Record<string, any>;
}): Promise<{
  success: boolean;
  data?: JointTaskItem;
  conflict?: boolean;
  message?: string;
  error?: string;
}> {
  const services = getServices();
  return await services.checklist.toggleJointTaskItem(params);
}

export async function getJointTaskDaySummaryAction(params: {
  branchId: string;
  dateStr: string;
  shift?: ShiftType;
}): Promise<{
  success: boolean;
  summary?: {
    date: string;
    shift?: ShiftType;
    branchName?: string;
    onDutyStaff: Array<{ id: string; name: string; position?: string; role: Role }>;
    participants: Array<{ id: string; name: string; completedCount: number }>;
    items: JointTaskItem[];
    refrigerators: RefrigeratorTaskItem[];
    assistantApproved: boolean;
    managerApproved: boolean;
  };
  error?: string;
}> {
  const services = getServices();
  return await services.manager.getJointTaskDaySummary(params);
}

export async function approveJointTaskDayAction(params: {
  branchId: string;
  dateStr: string;
  shift?: ShiftType;
  role: Role;
}): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.manager.approveJointTaskDay(params);
}
