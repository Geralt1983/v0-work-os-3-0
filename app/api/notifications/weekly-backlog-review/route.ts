import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { moves, clients, clientMemory } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { sendNotification } from '@/lib/notifications';

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
    const db = getDb();
    
    // Get all backlog moves with age
    const backlogMoves = await db.query.moves.findMany({
      where: eq(moves.status, 'backlog'),
      with: { client: true },
    });
    
    // Calculate age for each
    const now = Date.now();
    const aged = backlogMoves.map(m => {
      const created = new Date(m.backlogEnteredAt || m.createdAt).getTime();
      const daysOld = Math.floor((now - created) / (1000 * 60 * 60 * 24));
      return { ...m, daysOld };
    });
    
    const critical = aged.filter(m => m.daysOld >= 21);
    const stale = aged.filter(m => m.daysOld >= 14 && m.daysOld < 21);
    const aging = aged.filter(m => m.daysOld >= 7 && m.daysOld < 14);
    
    // Get stale clients
    const memories = await db.select().from(clientMemory);
    const staleClients = memories.filter(m => (m.staleDays || 0) >= 3);
    
    let message = `📋 Weekly Backlog Review\n\n`;
    message += `📦 Total backlog: ${backlogMoves.length} tasks\n\n`;
    
    if (critical.length > 0) {
      message += `🔴 CRITICAL (21+ days): ${critical.length}\n`;
      critical.slice(0, 3).forEach(t => {
        message += `  • ${t.title.substring(0, 30)}... (${t.daysOld}d)\n`;
      });
      message += '\n';
    }
    
    if (stale.length > 0) {
      message += `🟠 Stale (14-20 days): ${stale.length}\n`;
    }
    
    if (aging.length > 0) {
      message += `🟡 Aging (7-13 days): ${aging.length}\n`;
    }
    
    if (staleClients.length > 0) {
      message += `\n👥 Stale clients: ${staleClients.map(c => `${c.clientName} (${c.staleDays}d)`).join(', ')}`;
    }
    
    message += `\n\n🗡️ Time to keep or kill!`;
    
    await sendNotification(message, 'Weekly Review');
    
    return NextResponse.json({ 
      sent: true,
      stats: {
        total: backlogMoves.length,
        critical: critical.length,
        stale: stale.length,
        aging: aging.length,
        staleClients: staleClients.length,
      }
    });
    
  } catch (error) {
    console.error('Weekly review failed:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
