# WorkOS - Task & Client Management System

A productivity-focused task management system for consultants and freelancers, with AI-powered task estimation, client tracking, and progress analytics.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/jkimble1983-3883s-projects/v0-work-os-main)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/jk6OtSNk4ZV)

## Features

### Task Management
- **Kanban-style board** with Today, Up Next, and Backlog columns
- **Drag & drop** task organization with persistent sort order
- **AI-powered task estimation** using Groq/LLaMA for complexity scoring
- **Subtask breakdown** with AI assistance
- **Complexity badges** (Quick, Standard, Chunky, Deep)

### Points-Based Tracking System

Tasks are scored on a **1-10 point scale** based on time, cognitive load, and stakes:

| Complexity | Points | Description |
|------------|--------|-------------|
| **Quick** | 1-2 | <5 min - Forward email, quick check, acknowledgment |
| **Standard** | 3-4 | 15-30 min - Draft response, review document, scheduling |
| **Chunky** | 5-7 | 1-2 hours - Analysis, detailed report, complex coordination |
| **Deep** | 8-10 | 2+ hours - Strategic planning, system redesign, major deliverable |

**Daily Targets:**
- Minimum: 12 points
- Target: 18 points

### Client Management
- Multi-client support with color coding
- Per-client task filtering
- Client activity tracking and analytics
- Memory notes per client

### Analytics & Metrics
- **Daily progress tracking** with pacing indicators
- **Weekly goal tracking** (90 pts/week target)
- **Activity heatmap** (GitHub-style contribution graph)
- **Completion history** with timeline view
- **Streak tracking** for consistent performance

### Energy Management
- **Drain types**: Deep (cognitive), Shallow (routine), Admin (overhead)
- Time-of-day recommendations based on energy patterns

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Neon PostgreSQL with Drizzle ORM
- **UI**: Tailwind CSS 4, Radix UI, shadcn/ui
- **AI**: Groq API (LLaMA 3) for task analysis
- **State**: SWR for data fetching
- **Animation**: Framer Motion
- **Drag & Drop**: @dnd-kit

## Project Structure

```
app/
├── api/
│   ├── ai/              # AI endpoints (estimate-points, rewrite, breakdown)
│   ├── clients/         # Client CRUD
│   ├── metrics/         # Today, week, completion history, heatmap
│   └── tasks/           # Task CRUD, complete, sort
├── clients/             # Client management page
├── metrics/             # Analytics dashboard
└── tasks/               # Main task board

components/
├── completion-heatmap.tsx    # Activity visualization
├── completion-timeline.tsx   # History view
├── done-today.tsx            # Daily progress
├── edit-task-dialog.tsx      # Task editor with AI features
├── quick-capture.tsx         # Fast task entry
└── weekly-goals.tsx          # Weekly tracking

hooks/
├── use-tasks.ts         # Task state management
├── use-metrics.ts       # Metrics fetching
└── use-task-history.ts  # Historical data

lib/
├── domain/
│   └── task-types.ts    # Points system, complexity mappings
├── schema.ts            # Drizzle database schema
├── constants.ts         # App-wide constants
└── ai/                  # AI prompts and tool execution
```

## Key Constants

```typescript
// Daily goals (points-based)
DAILY_MINIMUM_POINTS = 12
DAILY_TARGET_POINTS = 18

// Weekly goals
WEEKLY_MINIMUM_POINTS = 60  // 5 days × 12
WEEKLY_TARGET_POINTS = 90   // 5 days × 18

// Work hours (for pacing calculations)
WORK_START_HOUR = 9   // 9 AM EST
WORK_END_HOUR = 18    // 6 PM EST

// Points to complexity mapping
POINTS_TO_SIZE = {
  1-2: "Quick",
  3-4: "Standard",
  5-7: "Chunky",
  8-10: "Deep"
}
```

## Database Schema

Key tables:
- `tasks` - Core task data with points tracking
- `clients` - Client profiles with color coding
- `daily_goals` - Daily aggregated metrics
- `client_memories` - AI-powered client notes

Points columns in tasks:
- `points_ai_guess` - AI-estimated complexity (1-10)
- `points_final` - User-adjusted final score
- `effort_estimate` - Legacy field (deprecated)

## Environment Variables

```env
DATABASE_URL=postgresql://...
GROQ_API_KEY=gsk_...
```

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Push schema changes
pnpm db:push

# Run type checking
pnpm exec tsc --noEmit
```

## Recent Changes

### v1.0 - Points-Based System Migration
- Migrated from minutes-based (240 min target) to points-based (18 pts target)
- Added AI point estimation for new tasks
- Updated task cards with complexity badges
- Edit dialog now shows points (2, 3, 5, 8) instead of minutes
- Activity heatmap and metrics use points for calculations
- Streak tracking based on hitting 18pt daily target

## License

Private project - All rights reserved.
