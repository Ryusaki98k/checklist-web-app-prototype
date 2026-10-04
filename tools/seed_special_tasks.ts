import { db } from "../src/db";
import { tasks, branches } from "../src/db/schema";
import { sql } from "drizzle-orm";

const SPECIAL_TASKS = [
  {
    name: "ปิดไฟส่องสว่างในร้าน (Turn off light)",
    task_role: "manager_assistant" as const,
    shift: "afternoon" as const,
    start: "19:30:00",
    end: "21:30:00",
  },
  {
    name: "ปิดไฟตู้แช่สินค้า (Turn off refriderator's light)",
    task_role: "manager_assistant" as const,
    shift: "afternoon" as const,
    start: "19:30:00",
    end: "21:30:00",
  },
  {
    name: "ปิดเครื่องปรับอากาศ (Turn off air conditioning)",
    task_role: "manager_assistant" as const,
    shift: "afternoon" as const,
    start: "19:30:00",
    end: "21:30:00",
  },
  {
    name: "ล็อคประตูร้านและตรวจสอบความปลอดภัย (Lock the store)",
    task_role: "manager_assistant" as const,
    shift: "afternoon" as const,
    start: "19:30:00",
    end: "21:30:00",
  },
];

async function seedSpecialTasks() {
  console.log("Checking special closing tasks...");
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
        is_special: true,
      }).returning({ id: tasks.id });
      console.log(`Created new task: ${inserted.id} - ${st.name}`);
      createdOrFoundTaskIds.push(inserted.id);
    }
  }

  // Update all special tasks in DB to ensure is_special = true
  for (const id of createdOrFoundTaskIds) {
    await db.update(tasks).set({ is_special: true }).where(sql`${tasks.id} = ${id}`);
  }

  // Touch branches last_update
  await db.update(branches).set({ last_update: new Date() });
  console.log("Updated branches last_update.");

  console.log("Seeding complete! Special Task IDs:", createdOrFoundTaskIds);
}

seedSpecialTasks()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
