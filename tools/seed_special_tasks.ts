import { db } from "../src/db";
import { tasks, branches } from "../src/db/schema";
import { sql } from "drizzle-orm";

const SPECIAL_TASKS = [
  {
    name: "ปิดไฟส่องสว่างในร้าน (Turn off light)",
    task_role: "manager_assistant" as const,
    shift: "night" as const,
    start: "19:30:00",
    end: "21:30:00",
  },
  {
    name: "ปิดไฟตู้แช่สินค้า (Turn off refriderator's light)",
    task_role: "manager_assistant" as const,
    shift: "night" as const,
    start: "19:30:00",
    end: "21:30:00",
  },
  {
    name: "ปิดเครื่องปรับอากาศ (Turn off air conditioning)",
    task_role: "manager_assistant" as const,
    shift: "night" as const,
    start: "19:30:00",
    end: "21:30:00",
  },
  {
    name: "ล็อคประตูร้านและตรวจสอบความปลอดภัย (Lock the store)",
    task_role: "manager_assistant" as const,
    shift: "night" as const,
    start: "19:30:00",
    end: "21:30:00",
  },
];

async function seedSpecialTasks() {
  console.log("Checking manager night closing tasks...");
  const allExistingTasks = await db.select().from(tasks);
  const createdOrFoundTaskIds: string[] = [];

  for (const st of SPECIAL_TASKS) {
    const found = allExistingTasks.find((t: any) =>
      t.name.toLowerCase().includes(st.name.toLowerCase()) ||
      (st.name.includes("Turn off light") && t.name.toLowerCase().includes("turn off light")) ||
      (st.name.includes("refriderator") && (t.name.toLowerCase().includes("refriderator") || t.name.toLowerCase().includes("refrigerator"))) ||
      (st.name.includes("air conditioning") && t.name.toLowerCase().includes("air conditioning")) ||
      (st.name.includes("Lock the store") && t.name.toLowerCase().includes("lock the store"))
    );

    if (found) {
      console.log(`Found existing task: ${found.id} - ${found.name}`);
      createdOrFoundTaskIds.push(found.id);
    } else {
      const [inserted] = await db.insert(tasks).values({
        name: st.name,
        task_role: st.task_role,
        shift: st.shift,
        start: st.start,
        end: st.end,
        disabled: false,
        for_managers: true,
      }).returning({ id: tasks.id });
      console.log(`Created new task: ${inserted.id} - ${st.name}`);
      createdOrFoundTaskIds.push(inserted.id);
    }
  }

  // Update all manager night tasks in DB to ensure shift = 'night', for_managers = true, category = 'ความปลอดภัยตอนปิดร้าน'
  for (const id of createdOrFoundTaskIds) {
    await db.update(tasks).set({
      shift: "night",
      for_managers: true,
      category: "ความปลอดภัยตอนปิดร้าน",
      disabled: false,
    }).where(sql`${tasks.id} = ${id}`);
  }

  // Link to all branches via branch_tasks
  const allBranches = await db.select({ id: branches.id }).from(branches);
  for (const b of allBranches) {
    for (const taskId of createdOrFoundTaskIds) {
      await db.execute(sql`
        INSERT INTO checklist_web_app.branch_tasks (branch_id, task_id)
        VALUES (${b.id}, ${taskId})
        ON CONFLICT (branch_id, task_id) DO NOTHING;
      `);
    }
  }

  // Touch branches last_update
  await db.update(branches).set({ last_update: new Date() });
  console.log("Updated branches last_update and linked branch_tasks.");

  console.log("Seeding complete! Special Task IDs:", createdOrFoundTaskIds);
}

seedSpecialTasks()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
