"use server";

import { getServices } from "../services/container";
import { User, Role, ManagerType, ExecutiveType } from "../types";

export interface AuthResponse {
  success: boolean;
  error?: string;
  user?: User;
}

export async function seedUsersIfEmpty(): Promise<void> {
  const services = getServices();
  await services.auth.seedUsersIfEmpty();
}

export async function loginAction(
  username: string,
  password: string,
  requestedRole?: Role
): Promise<AuthResponse> {
  const services = getServices();
  return await services.auth.login(username, password, requestedRole);
}

export async function registerAction(data: {
  name: string;
  username: string;
  password?: string;
  role?: Role;
  managerType?: ManagerType;
  executiveType?: ExecutiveType;
  isAdmin?: boolean;
  position?: string;
  branchId?: string;
  leaveQuota?: number | null;
  profile_id?: string | null;
  profileId?: string | null;
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
  managerType?: ManagerType;
  executiveType?: ExecutiveType;
  isAdmin?: boolean;
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

export async function updateUserPermissionsAction(
  userId: string,
  permissions: {
    managerType?: ManagerType;
    executiveType?: ExecutiveType;
    isAdmin?: boolean;
    role?: Role;
  }
): Promise<{ success: boolean; error?: string }> {
  const services = getServices();
  return await services.auth.updateUserPermissions(userId, permissions);
}

export async function updateUserProfileAction(params: {
  userId: string;
  name?: string;
  profile_id?: string | null;
}): Promise<AuthResponse> {
  const services = getServices();
  return await services.auth.updateUserProfile(params);
}

export async function uploadProfileImageAction(formData: FormData): Promise<{
  success: boolean;
  profileId?: string;
  publicUrl?: string;
  error?: string;
}> {
  try {
    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, error: "ไม่พบไฟล์รูปภาพที่อัปโหลด" };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return { success: false, error: "ระบบจัดเก็บข้อมูลคลาวด์ยังไม่ได้ตั้งค่าคีย์เชื่อมต่อ" };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const ext = file.name?.split(".").pop()?.toLowerCase() || "webp";
    const cleanExt = ["png", "jpg", "jpeg", "webp"].includes(ext) ? ext : "webp";
    const filename = `avatar_${crypto.randomUUID()}_${Date.now()}.${cleanExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("profiles")
      .upload(filename, buffer, {
        contentType: file.type || "image/webp",
        upsert: true,
      });

    if (uploadError) {
      console.error("uploadProfileImageAction storage error:", uploadError);
      return { success: false, error: uploadError.message || "อัปโหลดไฟล์รูปภาพไม่สำเร็จ" };
    }

    const { data: urlData } = supabase.storage.from("profiles").getPublicUrl(filename);

    return {
      success: true,
      profileId: filename,
      publicUrl: urlData.publicUrl,
    };
  } catch (err: any) {
    console.error("uploadProfileImageAction error:", err);
    return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ" };
  }
}

export async function deleteProfileImageAction(profileId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!profileId || profileId.trim() === "") {
      return { success: true };
    }

    const filename = profileId.includes("/") ? profileId.split("/").pop()! : profileId;
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return { success: false, error: "ระบบจัดเก็บข้อมูลไม่พร้อมใช้งาน" };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.storage.from("profiles").remove([filename]);
    if (error) {
      console.warn("deleteProfileImageAction warning:", error);
    }

    return { success: true };
  } catch (err: any) {
    console.error("deleteProfileImageAction error:", err);
    return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการลบรูปภาพ" };
  }
}

export async function changeUserProfileImageAction(params: {
  userId: string;
  oldProfileId?: string | null;
  newProfileId?: string | null;
  name?: string;
}): Promise<AuthResponse> {
  try {
    const { userId, oldProfileId, newProfileId, name } = params;
    if (!userId) {
      return { success: false, error: "ไม่พบรหัสผู้ใช้" };
    }

    // If there is an old profile picture and it is different from the new one, delete old one from storage
    if (oldProfileId && oldProfileId !== newProfileId) {
      await deleteProfileImageAction(oldProfileId);
    }

    const services = getServices();
    return await services.auth.updateUserProfile({
      userId,
      name,
      profile_id: newProfileId || null,
    });
  } catch (err: any) {
    console.error("changeUserProfileImageAction error:", err);
    return { success: false, error: err?.message || "เกิดข้อผิดพลาดในการปรับเปลี่ยนรูปภาพโปรไฟล์" };
  }
}
