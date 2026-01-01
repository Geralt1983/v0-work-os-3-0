ALTER TABLE "client_memory" ADD COLUMN "consecutive_skips" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "client_memory" ADD COLUMN "last_skip_date" date;--> statement-breakpoint
ALTER TABLE "client_memory" ADD COLUMN "blocker_reason" text;--> statement-breakpoint
ALTER TABLE "daily_log" ADD COLUMN "points_earned" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "daily_log" ADD COLUMN "points_target" integer DEFAULT 16;--> statement-breakpoint
ALTER TABLE "daily_log" ADD COLUMN "day_complete" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "daily_log" ADD COLUMN "stale_blocked_clients" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "value_tier" varchar(20) DEFAULT 'progress';