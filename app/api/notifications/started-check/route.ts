import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { moves, dailyLog } from '@/lib/schema';
import { eq, and, sql, gte } from 'drizzle-orm';
import { sendNotification } from '@/lib/notifications';

// Verify cron secret
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;
  
  if (!expectedToken) return true; // No secret configured, allow
  if (!authHeader) return false;
  
  const token = authHeader.replace('Bearer ', '');
  return token === expectedToken;
}

export async function GET(request: Request) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get today's date in EST
    const now = new Date();
    const estOffset = -5 * 60; // EST is UTC-5
    const estNow = new Date(now.getTime() + (estOffset - now.getTimezoneOffset()) * 60000);
    const todayStr = estNow.toISOString().split('T')[0];
    
    // Check if we already sent a "started" notification today
    const todayLog = await db.query.dailyLog.findFirst({
      where: eq(dailyLog.date, todayStr),
    });
    
    if (todayLog?.workStartedNotified) {
      return NextResponse.json({ 
        sent: false, 
        reason: 'Already notified today' 
      });
    }
    
    // Check for any completed moves today
    const todayStart = new Date(todayStr + 'T00:00:00-05:00'); // EST
    
    const completedToday = await db.query.moves.findMany({
      where: and(
        eq(moves.status, 'done'),
        gte(moves.completedAt, todayStart)
      ),
      with: { client: true },
      orderBy: (moves, { asc }) => [asc(moves.completedAt)],
      limit: 1,
    });
    
    if (completedToday.length === 0) {
      // No work done yet - send a nudge!
      const hour = estNow.getHours();
      
      let message = '';
      if (hour >= 10 && hour < 11) {
        message = `⏰ It's ${hour}am and no moves completed yet.\nTime to get rolling!`;
      } else if (hour >= 11) {
        message = `🚨 It's ${hour}am - still no moves today!\nEven one quick win counts.`;
      }
      
      if (message) {
        await sendNotification(message, 'Work Check');
        
        // Don't mark as "started" - we're nudging because NOT started
        return NextResponse.json({ 
          sent: true, 
          type: 'nudge',
          message 
        });
      }
      
      return NextResponse.json({ 
        sent: false, 
        reason: 'Too early to nudge' 
      });
    }
    
    // Work has started! This shouldn't happen via cron (we send on first completion)
    // But handle it gracefully
    return NextResponse.json({ 
      sent: false, 
      reason: 'Work already started - notification sent on completion' 
    });
    
  } catch (error) {
    console.error('Started check failed:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
