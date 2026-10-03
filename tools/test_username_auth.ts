import { getServices } from "../src/services/container";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function run() {
  console.log("=== Testing Username & Password Authentication (Email Removed) ===");
  const services = getServices();

  // Test 1: Register a new user with username (no email)
  const testUsername = `user_${Date.now()}`;
  console.log(`Test 1: Register new employee with username '${testUsername}'...`);
  const regRes = await services.auth.register({
    name: "พนักงานทดสอบ ระบบใหม่",
    username: testUsername,
    password: "password123",
    role: "employee",
  });
  console.log("Register result:", {
    success: regRes.success,
    username: regRes.user?.username,
    id: regRes.user?.id,
    hasEmail: "email" in (regRes.user || {}),
  });
  if (!regRes.success || regRes.user?.username !== testUsername) {
    throw new Error("Failed to register employee with username");
  }
  if ("email" in (regRes.user || {})) {
    throw new Error("User object unexpectedly contains 'email' field!");
  }

  // Test 2: Login with newly created username
  console.log("Test 2: Login with newly created username...");
  const loginRes = await services.auth.login(testUsername, "password123");
  console.log("Login result:", {
    success: loginRes.success,
    username: loginRes.user?.username,
    hasEmail: "email" in (loginRes.user || {}),
  });
  if (!loginRes.success) {
    throw new Error("Failed to login with newly registered username");
  }
  if ("email" in (loginRes.user || {})) {
    throw new Error("Login user object unexpectedly contains 'email' field!");
  }

  // Test 3: Duplicate username prevention
  console.log("Test 3: Attempt duplicate registration with same username...");
  const dupRes = await services.auth.register({
    name: "คนชื่อซ้ำ",
    username: testUsername.toUpperCase(), // Case insensitive check
    password: "password123",
    role: "employee",
  });
  console.log("Duplicate register result:", {
    success: dupRes.success,
    error: dupRes.error,
  });
  if (dupRes.success) {
    throw new Error("Duplicate username was allowed, expected failure!");
  }

  // Test 4: Verify getAllUsers has no email
  console.log("Test 4: Verify getAllUsers contains no email field...");
  const allUsers = await services.auth.getAllUsers();
  if (!allUsers.success || !allUsers.users) {
    throw new Error("Failed to get all users");
  }
  const anyHasEmail = allUsers.users.some((u) => "email" in u);
  if (anyHasEmail) {
    throw new Error("Some users in getAllUsers still have 'email' property!");
  }
  console.log(`✓ Verified ${allUsers.users.length} users in DB, none contain 'email'.`);

  // Cleanup test user
  console.log("Cleaning up test users...");
  await db.execute(sql`
    DELETE FROM checklist_web_app.users WHERE username LIKE 'user_%' OR username LIKE 'testuser_%';
  `);
  console.log("✓ Cleanup finished.");

  console.log("=== All Tests Passed Successfully! ===");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
