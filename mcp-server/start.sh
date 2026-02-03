#!/bin/bash
cd /Users/jeremy/Projects/WorkOS-v3
# Load env vars from .env.local (Vercel pulled)
set -a
source .env.local 2>/dev/null || source .env.vercel 2>/dev/null || true
set +a
exec bun run mcp:start
