import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { moves, clients } from '@/lib/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { sendNotification } from '@/lib/notifications';

// Verify cron secret
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;
  
  if (!expectedToken) return true;
  if (!authHeader) return false;
  
  const token = authHeader.replace('Bearer ', '');
  return token === expectedToken;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get today's stats
    const now = new Date();
    const estOffset = -5 * 60;
    const estNow = new Date(now.getTime() + (estOffset - now.getTimezoneOffset()) * 60000);
    const todayStr = estNow.toISOString().split('T')[0];
    const todayStart = new Date(todayStr + 'T00:00:00-05:00');
    
    // Get completed moves today
    const completedToday = await db.query.moves.findMany({
      where: and(
        eq(moves.status, 'done'),
        gte(moves.completedAt, todayStart)
      ),
      with: { client: true },
    });
    
    const moveCount = completedToday.length;
    const minutesEarned = completedToday.reduce((sum, m) => sum + (m.effortEstimate || 1) * 20, 0);
    const clientsTouched = new Set(completedToday.map(m => m.client?.name)).size;
    const goalMinutes = 180;
    const percentage = Math.round((minutesEarned / goalMinutes) * 100);
    
    // Build message
    let emoji = '🎉';
    let verdict = 'Crushed it!';
    
    if (percentage < 50) {
      emoji = '😬';
      verdict = 'Rough day - tomorrow is fresh.';
    } else if (percentage < 75) {
      emoji = '📈';
      verdict = 'Solid progress!';
    } else if (percentage < 100) {
      emoji = '💪';
      verdict = 'Almost there!';
    }
    
    // Get clients NOT touched today (stale warning)
    const allClients = await db.query.clients.findMany({
      where: eq(clients.isActive, true),
    });
    const touchedNames = new Set(completedToday.map(m => m.client?.name));
    const untouched = allClients
      .filter(c => !touchedNames.has(c.name))
      .map(c => c.name);
    
    let message = `${emoji} End of Day Report\n\n`;
    message += `📊 ${moveCount} moves | ${minutesEarned}/${goalMinutes} min (${percentage}%)\n`;
    message += `👥 ${clientsTouched} clients touched\n\n`;
    message += `${verdict}`;
    
    if (untouched.length > 0 && untouched.length <= 3) {
      message += `\n\n⚠️ Didn't touch: ${untouched.join(', ')}`;
    }
    
    await sendNotification(message, 'End of Day');
    
    return NextResponse.json({ 
      sent: true,
      stats: { moveCount, minutesEarned, percentage, clientsTouched }
    });
    
  } catch (error) {
    console.error('End of day notification failed:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
