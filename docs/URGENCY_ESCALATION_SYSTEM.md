# Points-Based Urgency Escalation System

## Overview

The Work-OS notification system has been enhanced with an **escalating urgency system** that increases pressure throughout the day as work is underperformed, along with **weekly consequence tracking** that carries forward deficits.

This system is **100% points-based** (not minutes-based), using a 1-10 complexity scale for all calculations.

---

## Core Concepts

### Daily Points System

- **Target**: 18 points/day (ideal goal)
- **Minimum**: 12 points/day (baseline requirement)
- **Weekly Target**: 90 points (5 days × 18)
- **Weekly Minimum**: 60 points (5 days × 12)

### Points Scale (Complexity Units)

| Points | Label | Typical Duration |
|--------|-------|------------------|
| 1-2 | Quick | < 5 minutes |
| 3-4 | Routine | 15-30 minutes |
| 5-6 | Meaningful | 30-60 minutes |
| 7-8 | Heavy | 1-2 hours |
| 9-10 | Major | 2+ hours |

---

## Escalating Urgency Throughout the Day

### Expected Pace (Hourly Targets)

The system calculates expected points by hour based on a linear progression:

| Time | Expected Points | % of Daily Target |
|------|-----------------|-------------------|
| 9 AM | 0 pts | 0% (work starts) |
| 10 AM | 4.5 pts | 25% |
| 11 AM | 6 pts | 33% |
| 12 PM | 9 pts | 50% (halfway) |
| 1 PM | 10.5 pts | 58% |
| 2 PM | 12 pts | 67% (minimum) |
| 3 PM | 13.5 pts | 75% |
| 4 PM | 15 pts | 83% |
| 5 PM | 16.5 pts | 92% |
| 6 PM | 18 pts | 100% (target) |

### Notification Schedule

| Time | Type | Trigger Condition | Priority |
|------|------|-------------------|----------|
| 8 AM | Morning Summary | Always | default |
| 10 AM | Started Check | No tasks completed yet | default |
| 11 AM | **Urgency Check** | < 6 pts (33%) | high |
| 12 PM | **Urgency Check** | < 9 pts (50%) | high |
| 1 PM | **Urgency Check** | < 10.5 pts (58%) | high |
| 2 PM | **Urgency Check** | < 12 pts (67% - MINIMUM) | urgent |
| 3 PM | **Urgency Check** | < 13.5 pts (75%) | urgent |
| 4 PM | Afternoon Summary | Always (enhanced with pace) | varies |
| 5 PM | **Urgency Check** | < 16.5 pts (92%) | urgent |
| 6 PM | End of Day | Always (with consequences) | varies |

### Pace Analysis Categories

1. **Critical Behind**: > 3 points behind expected pace
   - Priority: `urgent`
   - Emoji: 🔴
   - Message: "CRITICAL: X pts behind pace! You need to ACCELERATE NOW"

2. **Urgent Behind**: > 1.5 points behind expected pace
   - Priority: `high`
   - Emoji: ⚠️
   - Message: "URGENT: X pts behind! Time to buckle down"

3. **Warning**: > 0.5 points behind expected pace
   - Priority: `high`
   - Emoji: ⏰
   - Message: "Slipping: X pts behind pace. Pick it up"

4. **On Track**: Within ±0.5 points of expected
   - Priority: `default`
   - Emoji: ✅
   - Message: "On pace - keep this momentum going!"

5. **Ahead**: > 0.5 points ahead of expected
   - Priority: `low`
   - Emoji: 🚀
   - Message: "Ahead by X pts! Keep crushing it!"

---

## Weekly Debt System & Consequences

### Debt Calculation

**Daily Debt**:
```
dailyDebt = max(0, DAILY_TARGET_POINTS - earnedPoints)
```

**Weekly Debt**:
```
weeklyDebt = sum of all daily debts this week (Monday-Friday)
```

### Debt Severity Levels

| Weekly Debt | Severity | Impact |
|-------------|----------|--------|
| 0 pts | Perfect | ✅ No consequences, celebrate! |
| 1-10 pts | Minor | ⏰ Small deficit, still recoverable |
| 11-20 pts | Moderate | ⚠️ Significant deficit building |
| 21+ pts | Critical | 🚨 CRISIS MODE - severe consequences |

### Consequence System

#### 1. **Increased Urgency Multiplier**

Weekly debt increases the urgency of all notifications:

- **10+ points debt**: +1 pressure level
- **20+ points debt**: +2 pressure levels
- All notifications include debt context
- Priority levels escalate faster

#### 2. **End-of-Day Consequences**

The 6 PM end-of-day notification includes:

- Daily grade (F, D, C, B, A, S)
- Daily debt added to weekly total
- **Adjusted target for next day**:
  ```
  tomorrowTarget = normalTarget + ceil(todayDebt / 2)
  ```

Example: If you miss 6 points today, tomorrow's target increases by 3 points.

#### 3. **Persistent Pressure**

- All notifications show current weekly debt
- Morning summary highlights debt from prior days
- Afternoon check-ins warn of building deficits
- Urgency checks are more aggressive when debt exists

---

## Database Schema Changes

### New Fields in `daily_goals` Table

```sql
ALTER TABLE "daily_goals" ADD COLUMN "daily_debt" integer DEFAULT 0;
ALTER TABLE "daily_goals" ADD COLUMN "weekly_debt" integer DEFAULT 0;
ALTER TABLE "daily_goals" ADD COLUMN "pressure_level" integer DEFAULT 0;
ALTER TABLE "daily_goals" ADD COLUMN "last_urgency_notification_hour" integer;
```

**Field Descriptions**:

- `daily_debt`: Points below target for this day (0 if met/exceeded)
- `weekly_debt`: Cumulative debt for the current week
- `pressure_level`: Calculated urgency level (0-5 scale)
- `last_urgency_notification_hour`: Prevents duplicate hourly alerts

---

## Implementation Files

### New Files

1. **`lib/urgency-system.ts`**
   - Core urgency calculation engine
   - `analyzePace()`: Compare current vs expected points
   - `calculatePressureLevel()`: Determine urgency level
   - `generateUrgencyMessage()`: Create escalating messages
   - `generateEndOfDaySummary()`: Enhanced daily wrap-up with consequences
   - `shouldSendUrgencyNotification()`: Smart notification logic

2. **`app/api/notifications/urgency-check/route.ts`**
   - Hourly urgency check endpoint
   - Analyzes current pace vs expected
   - Sends notifications only when behind pace
   - Tracks last notification hour to prevent spam
   - Updates daily debt and weekly debt in real-time

3. **`drizzle/0001_add_daily_goals_debt_tracking.sql`**
   - Database migration for new fields

### Enhanced Files

1. **`lib/schema.ts`**
   - Added debt tracking fields to `dailyGoals` table

2. **`app/api/notifications/afternoon-summary/route.ts`**
   - Now includes pace analysis
   - Shows weekly debt context
   - Dynamic priority based on performance

3. **`app/api/notifications/end-of-day/route.ts`**
   - **Converted from minutes to points**
   - Uses `generateEndOfDaySummary()` with consequences
   - Calculates and stores daily/weekly debt
   - Shows adjusted target for next day

4. **`.github/workflows/work-os-crons.yml`**
   - Added hourly cron jobs (11 AM - 5 PM EST)
   - New `urgency-check` workflow step
   - Total of 7 new hourly checkpoints

---

## Notification Behavior

### Smart Notification Logic

**Urgency checks will NOT send if**:
- You're on pace or ahead
- Same hour already sent notification
- Outside work hours (10 AM - 6 PM)

**Urgency checks WILL send if**:
- Behind expected pace at designated hours (11, 12, 1, 2, 3, 5)
- Critically behind (>3 pts) at ANY hour
- Weekly debt creates additional pressure

### Message Content

Each urgency notification includes:

1. **Current Status**: Points earned vs target
2. **Expected Pace**: What you should have by now
3. **Delta**: How far ahead/behind
4. **Weekly Debt**: Cumulative deficit context
5. **Action Plan**: Points needed per hour to recover
6. **Minimum Check**: Distance to 12-point minimum

Example notification:
```
🔴 2pm Check-In

📊 Today: 8/18 pts (44%)
⏱️ Expected by now: 12.0 pts

🔴 CRITICAL: 4.0 pts behind pace!
You need to ACCELERATE NOW to avoid disaster.

💳 Weekly Debt: 15 pts
⚠️ Significant weekly deficit building up.

🎯 Need 10.0 more pts in 4h
   → Avg 2.5 pts/hour needed

⚡ 4.0 pts to hit daily MINIMUM
```

---

## Migration Guide

### Applying Database Changes

```bash
# Run migration
npm run db:migrate

# Or manually apply:
psql $DATABASE_URL < drizzle/0001_add_daily_goals_debt_tracking.sql
```

### Testing Urgency Checks

```bash
# Manual workflow dispatch
gh workflow run work-os-crons.yml -f notification_type=urgency-check

# Or test via API:
curl -X GET https://your-app.vercel.app/api/notifications/urgency-check \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Configuration

### Environment Variables Required

- `CRON_SECRET`: Authorization token for cron endpoints
- `NTFY_ACCESS_TOKEN`: Push notification service token (starts with `tk_`)
- `DATABASE_URL`: PostgreSQL connection string

### Customization Points

**To adjust expected pace** (in `lib/urgency-system.ts`):
```typescript
export const EXPECTED_POINTS_BY_HOUR: Record<number, number> = {
  10: 4.5,  // Customize these values
  12: 9,
  // ...
}
```

**To change urgency thresholds**:
```typescript
// In analyzePace()
isCritical: delta < -3,  // Adjust threshold
isUrgent: delta < -1.5,
isWarning: delta < -0.5,
```

**To modify debt consequences**:
```typescript
// In generateEndOfDaySummary()
const tomorrowTarget = targetPoints + Math.ceil(dailyDebt / 2)
// Change division factor ^^^ for more/less aggressive carryover
```

---

## Monitoring & Debugging

### Check Current Debt Status

```sql
SELECT
  date,
  earned_points,
  target_points,
  daily_debt,
  weekly_debt,
  pressure_level,
  last_urgency_notification_hour
FROM daily_goals
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;
```

### View Notification History

Check GitHub Actions workflow runs:
```
https://github.com/YOUR_ORG/YOUR_REPO/actions/workflows/work-os-crons.yml
```

### Common Issues

**Issue**: Notifications not sending hourly
- Check GitHub Actions cron schedule is active
- Verify `CRON_SECRET` is set correctly
- Check API route logs for errors

**Issue**: Debt not calculating correctly
- Ensure daily_goals table updated at end of day
- Verify task completion updates points in real-time
- Check weekly debt calculation includes all weekdays

**Issue**: Too many notifications
- Adjust `shouldSendUrgencyNotification()` logic
- Modify urgency hour list (currently 11, 12, 1, 2, 3, 5)
- Increase delta thresholds for less sensitivity

---

## Philosophy

This system is designed to:

1. **Apply progressive pressure** throughout the workday
2. **Create accountability** through objective point tracking
3. **Establish consequences** that carry forward (not just daily resets)
4. **Motivate recovery** by showing concrete targets
5. **Prevent gaming** through complexity-based (not time-based) scoring

The goal is to maintain consistent high performance while providing clear feedback and escalating urgency when falling behind.

---

## Future Enhancements

Possible additions:

- [ ] Weekend deficit recovery targets
- [ ] Streak bonuses for consistent performance
- [ ] Smart target adjustment based on historical performance
- [ ] Client-specific debt tracking (which clients being avoided?)
- [ ] Energy level integration (harder targets earlier in day)
- [ ] Weekly summary with trend analysis
- [ ] Slack/Discord integration for team visibility

---

**Last Updated**: 2025-12-29
**Version**: 1.0
**Author**: Work-OS Points-Based Urgency System
