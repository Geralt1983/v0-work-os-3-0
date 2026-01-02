CREATE TABLE IF NOT EXISTS "holidays" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "holidays_date_unique" UNIQUE("date")
);
--> statement-breakpoint
ALTER TABLE "daily_goals" ADD COLUMN "daily_debt" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "daily_goals" ADD COLUMN "weekly_debt" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "daily_goals" ADD COLUMN "pressure_level" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "daily_goals" ADD COLUMN "last_urgency_notification_hour" integer;