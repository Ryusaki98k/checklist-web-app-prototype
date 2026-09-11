"use server";

import { db } from "../db";
import { users } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { User } from "../types";

export interface AuthResponse {
  success: boolean;
  error?: string;
  user?: User;
}

const INITIAL_USERS: Array<{
  name: string;
  email: string;
  password: string;
  role: 'committee' | 'general_manager' | 'manager' | 'manager_assistant' | 'employee';
  position?: string;
}> = [
  { name: "คุณวิภาดา สุขเจริญ", email: "manager@factory.com", password: "manager123", role: "manager", position: "ผู้จัดการร้าน" },
  { name: "คุณกิตติศักดิ์ พัฒนกิจ", email: "director@factory.com", password: "director123", role: "committee", position: "กรรมการ" },
  { name: "คุณธนากร เกียรติไพบูลย์", email: "assistant@factory.com", password: "123", role: "manager_assistant", position: "ผู้ช่วยผู้จัดการร้าน" },
  { name: "คุณอนุรักษ์ วงศ์สวัสดิ์", email: "manager2@factory.com", password: "manager123", role: "manager", position: "ผู้จัดการร้าน" },
  { name: "คุณพรทิพย์ สุขเจริญ", email: "asst@factory.com", password: "123", role: "manager_assistant", position: "ผู้ช่วยผู้จัดการร้าน" },
  { name: "สมศรี ใจดี", email: "cashier@factory.com", password: "123", role: "employee", position: "แคชเชียร์" },
  { name: "สมชาย มั่นคง", email: "stock@factory.com", password: "123", role: "employee", position: "พนักงานสต็อก/จัดเรียง" },
  { name: "กัญญาภัทร พิมพา", email: "kanya@factory.com", password: "123", role: "employee", position: "แคชเชียร์" },
  { name: "ศุภชัย มีสุข", email: "suphachai@factory.com", password: "123", role: "employee", position: "พนักงานทั่วไป" },
];

/**
 * Seed initial sample users if table is empty
 */
export async function seedUsersIfEmpty(): Promise<void> {
  try {
    const existing = await db.select({ id: users.id }).from(users).limit(1);
    if (existing.length === 0) {
      await db.insert(users).values(
        INITIAL_USERS.map((u) => ({
          name: u.name,
          email: u.email.toLowerCase(),
          password: u.password,
          role: u.role,
        }))
      );
      console.log("Seeded initial users to database.");
    }
  } catch (err) {
    console.error("seedUsersIfEmpty error:", err);
  }
}

/**
 * Login user from database using email and plaintext password
 */
export async function loginAction(email: string, password: string): Promise<AuthResponse> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

  if (!cleanEmail || !cleanPassword) {
    return { success: false, error: "กรุณากรอกอีเมลและรหัสผ่าน" };
  }

  try {
    // Automatically seed if empty so mock accounts work out of the box
    await seedUsersIfEmpty();

    const result = await db
      .select()
      .from(users)
      .where(eq(sql`lower(${users.email})`, cleanEmail))
      .limit(1);

    if (result.length === 0) {
      return { success: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
    }

    const foundUser = result[0];

    if (foundUser.password !== cleanPassword) {
      return { success: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
    }

    // Update last_login timestamp
    await db
      .update(users)
      .set({ last_login: new Date() })
      .where(eq(users.id, foundUser.id));

    const isManagement = ['committee', 'general_manager', 'manager', 'manager_assistant'].includes(foundUser.role);

    // Map DB role to UI position
    let defaultPosition = "พนักงานทั่วไป";
    if (foundUser.role === "manager") defaultPosition = "ผู้จัดการร้าน";
    else if (foundUser.role === "committee") defaultPosition = "กรรมการ";
    else if (foundUser.role === "manager_assistant") defaultPosition = "ผู้ช่วยผู้จัดการร้าน";
    else if (cleanEmail.includes("cashier")) defaultPosition = "แคชเชียร์";
    else if (cleanEmail.includes("stock")) defaultPosition = "พนักงานสต็อก/จัดเรียง";

    const userObj: User = {
      id: foundUser.id,
      name: foundUser.name,
      email: foundUser.email,
      role: isManagement ? "manager" : "employee",
      position: defaultPosition,
    };

    return {
      success: true,
      user: userObj,
    };
  } catch (err) {
    console.error("loginAction error:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง" };
  }
}

/**
 * Register a new user in database
 */
export async function registerAction(data: {
  name: string;
  email: string;
  password: string;
  role?: 'employee' | 'manager' | 'committee' | 'general_manager' | 'manager_assistant';
  position?: string;
}): Promise<AuthResponse> {
  const cleanName = data.name.trim();
  const cleanEmail = data.email.trim().toLowerCase();
  const cleanPassword = data.password.trim();

  let dbRole: 'committee' | 'general_manager' | 'manager' | 'manager_assistant' | 'employee' = 'employee';
  if (data.role === 'manager') {
    if (data.position?.includes("กรรมการ")) dbRole = 'committee';
    else if (data.position?.includes("ผู้ช่วย")) dbRole = 'manager_assistant';
    else dbRole = 'manager';
  } else if (data.role) {
    dbRole = data.role;
  }

  if (!cleanName || !cleanEmail || !cleanPassword) {
    return { success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" };
  }

  try {
    // Check if email already exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`lower(${users.email})`, cleanEmail))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: "อีเมลนี้มีผู้ใช้งานแล้วในระบบ" };
    }

    const [created] = await db
      .insert(users)
      .values({
        name: cleanName,
        email: cleanEmail,
        password: cleanPassword,
        role: dbRole,
        last_login: new Date(),
      })
      .returning();

    const isManagement = ['committee', 'general_manager', 'manager', 'manager_assistant'].includes(created.role);

    const userObj: User = {
      id: created.id,
      name: created.name,
      email: created.email,
      role: isManagement ? "manager" : "employee",
      position: data.position ?? (isManagement ? 'ผู้จัดการร้าน' : 'แคชเชียร์'),
    };

    return {
      success: true,
      user: userObj,
    };
  } catch (err) {
    console.error("registerAction error:", err);
    return { success: false, error: "เกิดข้อผิดพลาดในการบันทึกข้อมูลลงฐานข้อมูล" };
  }
}
