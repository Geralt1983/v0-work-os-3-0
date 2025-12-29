-- Migration: Add debt tracking and urgency fields to daily_goals table
-- This enables the points-based urgency escalation system with weekly consequences

-- Add new columns to daily_goals table
ALTER TABLE "daily_goals" ADD COLUMN "daily_debt" integer DEFAULT 0;
ALTER TABLE "daily_goals" ADD COLUMN "weekly_debt" integer DEFAULT 0;
ALTER TABLE "daily_goals" ADD COLUMN "pressure_level" integer DEFAULT 0;
ALTER TABLE "daily_goals" ADD COLUMN "last_urgency_notification_hour" integer;

-- Update existing rows to have default values
UPDATE "daily_goals" SET "daily_debt" = 0 WHERE "daily_debt" IS NULL;
UPDATE "daily_goals" SET "weekly_debt" = 0 WHERE "weekly_debt" IS NULL;
UPDATE "daily_goals" SET "pressure_level" = 0 WHERE "pressure_level" IS NULL;
