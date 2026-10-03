"use server";

import { getServices } from "../services/container";
import { DashboardBranch } from "../services/BranchService";

export type { DashboardBranch };

export async function getBranchesAction(options?: { forceRefresh?: boolean }): Promise<{
  success: boolean;
  branches?: DashboardBranch[];
  lastUpdate?: string;
  error?: string;
}> {
  const services = getServices();
  return await services.branch.getBranches(options);
}

export async function checkBranchesUpdatedAction(
  clientLastUpdate?: string,
  branchId?: string
): Promise<{
  success: boolean;
  updated: boolean;
  lastUpdate?: string;
  branches?: DashboardBranch[];
  error?: string;
}> {
  const services = getServices();
  return await services.branch.checkBranchesUpdated(clientLastUpdate, branchId);
}

export async function createBranchAction(name: string): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.branch.createBranch(name);
}

export async function assignStaffToBranchAction(
  branchId: string,
  userIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.branch.assignStaffToBranch(branchId, userIds);
}

export async function assignTasksToBranchAction(
  branchId: string,
  taskIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.branch.assignTasksToBranch(branchId, taskIds);
}

export async function updateBranchLeaveQuotaAction(
  branchId: string,
  quota: number
): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.branch.updateBranchLeaveQuota(branchId, quota);
}
