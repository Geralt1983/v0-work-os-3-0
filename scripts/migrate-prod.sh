#!/bin/bash
# Production Database Migration Script
# Usage: ./scripts/migrate-prod.sh <PRODUCTION_DATABASE_URL>
#
# This script applies the schema to a production Neon database.
# Make sure to backup your production database before running!

set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/migrate-prod.sh <PRODUCTION_DATABASE_URL>"
  echo ""
  echo "Example:"
  echo "  ./scripts/migrate-prod.sh 'postgresql://user:pass@host/dbname?sslmode=require'"
  echo ""
  echo "Or set DATABASE_URL environment variable:"
  echo "  DATABASE_URL='postgresql://...' pnpm db:push"
  exit 1
fi

PROD_DATABASE_URL="$1"

echo "=== Production Database Migration ==="
echo ""
echo "WARNING: This will modify your production database!"
echo "Make sure you have a backup before proceeding."
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo "Pushing schema to production..."
DATABASE_URL="$PROD_DATABASE_URL" pnpm drizzle-kit push

echo ""
echo "=== Migration Complete ==="
echo ""
echo "Your production database now has the latest schema."
echo "Tables created/updated:"
echo "  - clients"
echo "  - tasks (with points_ai_guess, points_final columns)"
echo "  - sessions"
echo "  - messages"
echo "  - client_memory"
echo "  - daily_log"
echo "  - daily_snapshots"
echo "  - task_graveyard"
echo "  - task_events"
echo "  - daily_goals"
echo "  - behavioral_patterns"
