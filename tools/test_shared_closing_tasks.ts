import { db } from "../src/db";
import { branches, users, tasks, shiftSession, taskWork, notifications } from "../src/db/schema";
import { ChecklistService } from "../src/services/ChecklistService";
import { eq, and, sql } from "drizzle-orm";

async function runTest() {
  console.log("=== Starting Shared Store Closing Checklist Verification (Normalized Schema) ===");
  const checklistService = new ChecklistService(db);

  // 1. Setup / identify test branches and users
  const allBranches = await db.select().from(branches);
  if (allBranches.length < 1) {
    throw new Error("No branches found for testing");
  }

  const branch1 = allBranches[0];
  let branch2 = allBranches.length > 1 ? allBranches[1] : null;

  if (!branch2) {
    // Create temporary second branch for branch isolation test
    const [newBranch] = await db.insert(branches).values({
      name: "สาขา 2 ทดสอบแยกสาขา",
    }).returning();
    branch2 = newBranch;
    console.log("Created branch 2 for isolation test:", branch2.id);
  }

  // Find or create test users
  // User A: Assistant Manager in Branch 1
  let [userA] = await db
    .select()
    .from(users)
    .where(and(eq(users.role, "manager_assistant"), eq(users.branch_id, branch1.id)))
    .limit(1);

  if (!userA) {
    const [newAss] = await db.insert(users).values({
      name: "สมชาย ผู้ช่วยทดสอบ",
      username: `test_asst_${Date.now()}`,
      role: "manager_assistant",
      branch_id: branch1.id,
      point: 100,
      point_streak: 2,
    }).returning();
    userA = newAss;
  }

  // User B: Manager in Branch 1
  let [userB] = await db
    .select()
    .from(users)
    .where(and(eq(users.role, "manager"), eq(users.branch_id, branch1.id), sql`${users.id} != ${userA.id}`))
    .limit(1);

  if (!userB) {
    const [newMgr] = await db.insert(users).values({
      name: "สมศรี ผู้จัดการทดสอบ",
      username: `test_mgr_${Date.now()}`,
      role: "manager",
      branch_id: branch1.id,
      point: 100,
      point_streak: 5,
    }).returning();
    userB = newMgr;
  }

  // User C: Manager in Branch 2
  const [userC] = await db.insert(users).values({
    name: "วิชัย ผู้จัดการสาขา 2",
    username: `test_mgr2_${Date.now()}`,
    role: "manager",
    branch_id: branch2.id,
    point: 100,
    point_streak: 3,
  }).returning();

  console.log(`Branch 1 (${branch1.name}): User A (${userA.name}), User B (${userB.name})`);
  console.log(`Branch 2 (${branch2.name}): User C (${userC.name})`);

  // Ensure special closing tasks exist
  const specialTasksInDb = await db.select().from(tasks).where(eq(tasks.is_special, true));
  console.log(`Found ${specialTasksInDb.length} special closing tasks in DB`);

  // 2. Get or create shift session for User A (Assistant Manager) in Branch 1
  console.log("\n--- Step 2: Initialize sessions for User A, User B, User C ---");
  const sessARes = await checklistService.getOrCreateShiftSession({
    userId: userA.id,
    userName: userA.name,
    position: "ผู้ช่วยผู้จัดการร้าน",
    shift: "afternoon",
  });
  if (!sessARes.success || !sessARes.session) {
    throw new Error(`Failed to get session for User A: ${sessARes.error}`);
  }
  const sessionA = sessARes.session;
  console.log(`User A session created: ${sessionA.id}, total items: ${sessionA.items.length}`);

  // Find a special task item in session A
  const specialItemA = sessionA.items.find((i) => i.isSpecial);
  if (!specialItemA) {
    throw new Error("No special zero-point closing task found in User A's session!");
  }
  console.log(`Selected special closing task: "${specialItemA.label}" (ID: ${specialItemA.id})`);

  // User B (Manager in Branch 1) session
  const sessBRes = await checklistService.getOrCreateShiftSession({
    userId: userB.id,
    userName: userB.name,
    position: "ผู้จัดการร้าน",
    shift: "afternoon",
  });
  if (!sessBRes.success || !sessBRes.session) {
    throw new Error(`Failed to get session for User B: ${sessBRes.error}`);
  }
  const sessionB = sessBRes.session;
  const specialItemB = sessionB.items.find((i) => i.id === specialItemA.id);
  console.log(`User B sees item "${specialItemA.label}" completedAt: ${specialItemB?.completedAt}`);

  // User C (Manager in Branch 2) session
  const sessCRes = await checklistService.getOrCreateShiftSession({
    userId: userC.id,
    userName: userC.name,
    position: "ผู้จัดการร้าน",
    shift: "afternoon",
  });
  if (!sessCRes.success || !sessCRes.session) {
    throw new Error(`Failed to get session for User C: ${sessCRes.error}`);
  }

  // 3. User A completes the special task in Branch 1
  console.log("\n--- Step 3: User A completes the special closing task ---");
  const toggleRes = await checklistService.toggleTaskWork({
    shiftSessionId: sessionA.id,
    taskId: specialItemA.id,
    taskWorkId: specialItemA.taskWorkId,
    completed: true,
    comment: "ผู้ช่วยสมชายปิดไฟเรียบร้อยแล้ว ตรวจเช็คครบ",
  });
  if (!toggleRes.success) {
    throw new Error(`Failed to toggle task work for User A: ${toggleRes.error}`);
  }
  console.log(`User A toggled task completedAt: ${toggleRes.completedAt}`);

  // 4. User B (Manager in Branch 1) reloads checklist - MUST BE COMPLETED!
  console.log("\n--- Step 4: User B (Manager in Branch 1) reloads checklist ---");
  const reloadB = await checklistService.getOrCreateShiftSession({
    userId: userB.id,
    userName: userB.name,
    position: "ผู้จัดการร้าน",
    shift: "afternoon",
  });
  const reloadedItemB = reloadB.session?.items.find((i) => i.id === specialItemA.id);
  console.log(`User B item status:`, {
    completedAt: reloadedItemB?.completedAt,
    completedBy: reloadedItemB?.completedBy,
    completedByName: reloadedItemB?.completedByName,
    comment: reloadedItemB?.comment,
  });

  if (!reloadedItemB?.completedAt) {
    throw new Error("FAILED: User B should see the special task as COMPLETED!");
  }
  console.log("PASS: User B in Branch 1 sees the task marked completed by User A!");

  // 5. User C (Branch 2) checks their session - MUST NOT BE COMPLETED (Branch Isolation)!
  console.log("\n--- Step 5: User C (Branch 2) reloads checklist (Isolation test) ---");
  const reloadC = await checklistService.getOrCreateShiftSession({
    userId: userC.id,
    userName: userC.name,
    position: "ผู้จัดการร้าน",
    shift: "afternoon",
  });
  const reloadedItemC = reloadC.session?.items.find((i) => i.id === specialItemA.id);
  console.log(`User C (Branch 2) item completedAt: ${reloadedItemC?.completedAt}`);

  if (reloadedItemC?.completedAt !== null) {
    throw new Error("FAILED: Branch 2 User C should NOT see task as completed! Branch isolation failed.");
  }
  console.log("PASS: Branch 2 is completely isolated and unaffected!");

  // 6. Cleanup test user C and temporary branch
  const testSessions = await db.select({ id: shiftSession.id }).from(shiftSession).where(eq(shiftSession.user, userC.id));
  const testSessIds = testSessions.map((s: any) => s.id);
  if (testSessIds.length > 0) {
    await db.delete(taskWork).where(sql`shift_session_id IN (${sql.join(testSessIds.map((id: string) => sql`${id}`), sql`, `)})`);
    await db.delete(shiftSession).where(sql`id IN (${sql.join(testSessIds.map((id: string) => sql`${id}`), sql`, `)})`);
  }
  await db.delete(notifications).where(eq(notifications.recipient_id, userC.id));
  await db.delete(users).where(eq(users.id, userC.id));
  if (branch2.id !== branch1.id && branch2.name === "สาขา 2 ทดสอบแยกสาขา") {
    await db.delete(branches).where(eq(branches.id, branch2.id));
  }
  console.log("\nCleaned up test data.");

  console.log("\n=======================================================");
  console.log("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY! 🚀");
  console.log("=======================================================");
}

runTest()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  });
