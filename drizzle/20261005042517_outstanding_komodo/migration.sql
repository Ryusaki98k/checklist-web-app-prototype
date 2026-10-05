CREATE SCHEMA "checklist_web_app";
--> statement-breakpoint
CREATE TYPE "checklist_web_app"."leave_type" AS ENUM('paid', 'unpaid');--> statement-breakpoint
CREATE TYPE "checklist_web_app"."point_streak" AS ENUM('none', 'flawed', 'perfect');--> statement-breakpoint
CREATE TYPE "checklist_web_app"."role" AS ENUM('admin', 'committee', 'general_manager', 'manager', 'manager_assistant', 'employee');--> statement-breakpoint
CREATE TYPE "checklist_web_app"."shift" AS ENUM('morning', 'afternoon', 'night', 'morning_afternoon');--> statement-breakpoint
CREATE TYPE "checklist_web_app"."task_role" AS ENUM('manager_assistant', 'cashier', 'stock');--> statement-breakpoint
CREATE TABLE "checklist_web_app"."branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"leave_quota" integer DEFAULT 3 NOT NULL,
	"last_update" timestamp with time zone DEFAULT now(),
	"members" jsonb DEFAULT '[]' NOT NULL,
	"tasks" jsonb DEFAULT '[]' NOT NULL,
	"refrigerators" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_web_app"."branches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "checklist_web_app"."cron_settings" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"schedule_cron" text NOT NULL,
	"schedule_description" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}' NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_run_status" text,
	"last_run_message" text,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "checklist_web_app"."cron_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "checklist_web_app"."employee_leaves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"leave_type" "checklist_web_app"."leave_type" NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"reason" text NOT NULL,
	"preserve_streak" boolean DEFAULT true NOT NULL,
	"previous_streak" integer,
	"recorded_by" uuid NOT NULL,
	"status" text DEFAULT 'approved' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "checklist_web_app"."employee_leaves" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "checklist_web_app"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"recipient_id" uuid,
	"recipient_role" "checklist_web_app"."role",
	"branch_id" uuid,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"shift_session_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_web_app"."notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "checklist_web_app"."point_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"type" text NOT NULL,
	"shift_session_id" uuid,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_web_app"."point_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "checklist_web_app"."refrigerator_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"branch_id" uuid NOT NULL,
	"refrigerator_id" uuid NOT NULL,
	"task_date" text NOT NULL,
	"completed_by" uuid,
	"completed_at" timestamp with time zone,
	"shift_session_id" uuid,
	"shift" "checklist_web_app"."shift",
	"temperature" integer,
	"is_okay" boolean DEFAULT true,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_web_app"."refrigerator_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "checklist_web_app"."refrigerators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"branch_id" uuid,
	"name" text DEFAULT '' NOT NULL,
	"min_temperature" integer DEFAULT 0 NOT NULL,
	"max_temperature" integer DEFAULT 4 NOT NULL,
	"disable_check" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_web_app"."refrigerators" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "checklist_web_app"."shift_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"task_role" "checklist_web_app"."task_role" NOT NULL,
	"shift" "checklist_web_app"."shift" NOT NULL,
	"start_timestamp" timestamp with time zone NOT NULL,
	"end_timestamp" timestamp with time zone,
	"manager_assistance_approve_timestamp" timestamp with time zone,
	"manager_approve_timestamp" timestamp with time zone,
	"incomplete_reason" text,
	"incomplete_status" text DEFAULT 'none',
	"incomplete_action" text,
	"incomplete_action_points" integer DEFAULT 0,
	"incomplete_action_note" text,
	"incomplete_reviewed_by" uuid,
	"incomplete_reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "checklist_web_app"."shift_session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "checklist_web_app"."store_closing_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"branch_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"task_date" text NOT NULL,
	"completed_by" uuid,
	"completed_at" timestamp with time zone,
	"shift_session_id" uuid,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_web_app"."store_closing_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "checklist_web_app"."task_work" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"task_id" uuid NOT NULL,
	"shift_session_id" uuid NOT NULL,
	"branch_id" uuid,
	"task_date" text,
	"completed_by" uuid,
	"comment" text,
	"timestamp" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "checklist_web_app"."task_work" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "checklist_web_app"."tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"shift" "checklist_web_app"."shift" NOT NULL,
	"name" text NOT NULL,
	"task_role" "checklist_web_app"."task_role" NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"for_managers" boolean DEFAULT false NOT NULL,
	"category" text
);
--> statement-breakpoint
ALTER TABLE "checklist_web_app"."tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "checklist_web_app"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"username" text DEFAULT '' NOT NULL,
	"password" text,
	"password_hash" text,
	"role" "checklist_web_app"."role" NOT NULL,
	"branch_id" uuid,
	"point_streak_type" "checklist_web_app"."point_streak" DEFAULT 'none'::"checklist_web_app"."point_streak" NOT NULL,
	"point_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"point" integer DEFAULT 0 NOT NULL,
	"last_login" timestamp with time zone,
	"leave_quota" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "checklist_web_app"."users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "idx_leaves_user_date" ON "checklist_web_app"."employee_leaves" ("user_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_leaves_branch" ON "checklist_web_app"."employee_leaves" ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient_read" ON "checklist_web_app"."notifications" ("recipient_id","is_read");--> statement-breakpoint
CREATE INDEX "idx_notifications_branch" ON "checklist_web_app"."notifications" ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_point_transactions_user" ON "checklist_web_app"."point_transactions" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ref_tasks_branch_date" ON "checklist_web_app"."refrigerator_tasks" ("branch_id","task_date");--> statement-breakpoint
CREATE INDEX "idx_ref_tasks_refrigerator" ON "checklist_web_app"."refrigerator_tasks" ("refrigerator_id");--> statement-breakpoint
CREATE INDEX "idx_refrigerators_branch_id" ON "checklist_web_app"."refrigerators" ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_shift_session_user_start" ON "checklist_web_app"."shift_session" ("user_id","start_timestamp");--> statement-breakpoint
CREATE INDEX "idx_shift_session_branch_start" ON "checklist_web_app"."shift_session" ("branch_id","start_timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_store_closing_tasks_branch_task_date_unique" ON "checklist_web_app"."store_closing_tasks" ("branch_id","task_date","task_id");--> statement-breakpoint
CREATE INDEX "idx_store_closing_tasks_lookup" ON "checklist_web_app"."store_closing_tasks" ("branch_id","task_date");--> statement-breakpoint
CREATE INDEX "idx_task_work_session" ON "checklist_web_app"."task_work" ("shift_session_id");--> statement-breakpoint
CREATE INDEX "idx_task_work_task" ON "checklist_web_app"."task_work" ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_work_branch_date" ON "checklist_web_app"."task_work" ("branch_id","task_date");--> statement-breakpoint
CREATE INDEX "idx_tasks_role_shift" ON "checklist_web_app"."tasks" ("task_role","shift");--> statement-breakpoint
CREATE INDEX "idx_tasks_for_managers" ON "checklist_web_app"."tasks" ("for_managers");--> statement-breakpoint
CREATE INDEX "idx_users_branch_id" ON "checklist_web_app"."users" ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_users_username" ON "checklist_web_app"."users" ("username");--> statement-breakpoint
ALTER TABLE "checklist_web_app"."employee_leaves" ADD CONSTRAINT "employee_leaves_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "checklist_web_app"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."employee_leaves" ADD CONSTRAINT "employee_leaves_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "checklist_web_app"."branches"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."employee_leaves" ADD CONSTRAINT "employee_leaves_recorded_by_users_id_fkey" FOREIGN KEY ("recorded_by") REFERENCES "checklist_web_app"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."employee_leaves" ADD CONSTRAINT "employee_leaves_approved_by_users_id_fkey" FOREIGN KEY ("approved_by") REFERENCES "checklist_web_app"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "checklist_web_app"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."notifications" ADD CONSTRAINT "notifications_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "checklist_web_app"."branches"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."notifications" ADD CONSTRAINT "notifications_shift_session_id_shift_session_id_fkey" FOREIGN KEY ("shift_session_id") REFERENCES "checklist_web_app"."shift_session"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."point_transactions" ADD CONSTRAINT "point_transactions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "checklist_web_app"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."point_transactions" ADD CONSTRAINT "point_transactions_shift_session_id_shift_session_id_fkey" FOREIGN KEY ("shift_session_id") REFERENCES "checklist_web_app"."shift_session"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."refrigerator_tasks" ADD CONSTRAINT "refrigerator_tasks_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "checklist_web_app"."branches"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."refrigerator_tasks" ADD CONSTRAINT "refrigerator_tasks_refrigerator_id_refrigerators_id_fkey" FOREIGN KEY ("refrigerator_id") REFERENCES "checklist_web_app"."refrigerators"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."refrigerator_tasks" ADD CONSTRAINT "refrigerator_tasks_completed_by_users_id_fkey" FOREIGN KEY ("completed_by") REFERENCES "checklist_web_app"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."refrigerator_tasks" ADD CONSTRAINT "refrigerator_tasks_shift_session_id_shift_session_id_fkey" FOREIGN KEY ("shift_session_id") REFERENCES "checklist_web_app"."shift_session"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."refrigerators" ADD CONSTRAINT "refrigerators_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "checklist_web_app"."branches"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."shift_session" ADD CONSTRAINT "shift_session_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "checklist_web_app"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."shift_session" ADD CONSTRAINT "shift_session_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "checklist_web_app"."branches"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."shift_session" ADD CONSTRAINT "shift_session_incomplete_reviewed_by_users_id_fkey" FOREIGN KEY ("incomplete_reviewed_by") REFERENCES "checklist_web_app"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."store_closing_tasks" ADD CONSTRAINT "store_closing_tasks_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "checklist_web_app"."branches"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."store_closing_tasks" ADD CONSTRAINT "store_closing_tasks_task_id_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "checklist_web_app"."tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."store_closing_tasks" ADD CONSTRAINT "store_closing_tasks_completed_by_users_id_fkey" FOREIGN KEY ("completed_by") REFERENCES "checklist_web_app"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."store_closing_tasks" ADD CONSTRAINT "store_closing_tasks_shift_session_id_shift_session_id_fkey" FOREIGN KEY ("shift_session_id") REFERENCES "checklist_web_app"."shift_session"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."task_work" ADD CONSTRAINT "task_work_task_id_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "checklist_web_app"."tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."task_work" ADD CONSTRAINT "task_work_shift_session_id_shift_session_id_fkey" FOREIGN KEY ("shift_session_id") REFERENCES "checklist_web_app"."shift_session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."task_work" ADD CONSTRAINT "task_work_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "checklist_web_app"."branches"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."task_work" ADD CONSTRAINT "task_work_completed_by_users_id_fkey" FOREIGN KEY ("completed_by") REFERENCES "checklist_web_app"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "checklist_web_app"."users" ADD CONSTRAINT "users_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "checklist_web_app"."branches"("id") ON DELETE SET NULL;