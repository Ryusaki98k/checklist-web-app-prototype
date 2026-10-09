"use server";

import { getServices } from "../services/container";
import { Role, SpecialTaskItem } from "../types";

export async function getSpecialTasksAction(params: {
  branchId?: string;
  userId?: string;
  role?: string;
}): Promise<{ success: boolean; tasks?: SpecialTaskItem[]; error?: string }> {
  const services = getServices();
  return await services.manager.getSpecialTasks(params);
}

export async function createSpecialTaskAction(params: {
  branchId: string;
  title: string;
  description?: string;
  issuedByUserId: string;
  targetType: "user" | "role" | "group";
  assignedUserId?: string;
  assignedRole?: string;
  assignedUserIds?: string[];
  startDate: string;
  endDate: string;
  pointsReward: number;
  penaltyStreak: boolean;
}): Promise<{ success: boolean; task?: SpecialTaskItem; error?: string }> {
  const services = getServices();
  return await services.manager.createSpecialTask(params);
}

export async function updateSpecialTaskAction(params: {
  specialTaskId: string;
  title?: string;
  description?: string;
  assignedUserId?: string;
  assignedRole?: string;
  assignedUserIds?: string[];
  startDate?: string;
  endDate?: string;
  pointsReward?: number;
  penaltyStreak?: boolean;
}): Promise<{ success: boolean; task?: SpecialTaskItem; error?: string }> {
  const services = getServices();
  return await services.manager.updateSpecialTask(params);
}

export async function duplicateSpecialTaskAction(params: {
  specialTaskId: string;
  issuedByUserId: string;
  branchId?: string;
  newStartDate?: string;
  newEndDate?: string;
}): Promise<{ success: boolean; task?: SpecialTaskItem; error?: string }> {
  const services = getServices();
  return await services.manager.duplicateSpecialTask(params);
}

export async function deleteSpecialTaskAction(
  specialTaskId: string
): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.manager.deleteSpecialTask(specialTaskId);
}

export async function submitSpecialTaskAction(params: {
  specialTaskId: string;
  userId: string;
  comment?: string;
  participatedUserIds?: string[];
}): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.manager.submitSpecialTask(params);
}

export async function approveSpecialTaskAction(params: {
  specialTaskId: string;
  reviewerUserId: string;
  reviewerRole: Role;
  isApproved: boolean;
  declineReason?: string;
}): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.manager.approveSpecialTask(params);
}
