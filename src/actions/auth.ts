"use server";

import { getServices } from "../services/container";
import { User, Role } from "../types";

export interface AuthResponse {
  success: boolean;
  error?: string;
  user?: User;
}

export async function seedUsersIfEmpty(): Promise<void> {
  const services = getServices();
  await services.auth.seedUsersIfEmpty();
}

export async function loginAction(username: string, password: string): Promise<AuthResponse> {
  const services = getServices();
  return await services.auth.login(username, password);
}

export async function registerAction(data: {
  name: string;
  username: string;
  password?: string;
  role?: Role;
  position?: string;
  branchId?: string;
  leaveQuota?: number | null;
}): Promise<AuthResponse> {
  const services = getServices();
  return await services.auth.register(data);
}

export async function getAllUsersAction(): Promise<{ success: boolean; users?: User[]; error?: string }> {
  const services = getServices();
  return await services.auth.getAllUsers();
}

export async function getUserByIdAction(id: string): Promise<AuthResponse> {
  const services = getServices();
  return await services.auth.getUserById(id);
}

export async function syncOAuthUserAction(userData: {
  id: string;
  username?: string;
  name?: string;
  role?: Role;
}): Promise<AuthResponse> {
  const services = getServices();
  return await services.auth.syncOAuthUser(userData);
}

export async function updateUserRoleAction(
  userId: string,
  role: Role
): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.auth.updateUserRole(userId, role);
}
