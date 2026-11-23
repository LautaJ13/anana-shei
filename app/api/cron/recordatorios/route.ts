import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { deliverNotification } from "@/lib/email";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no está configurado. No se encolaron recordatorios." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const database = await getDatabase();
  const queued = await database.withService((query) =>
    query.query<{ enqueue_reminders: number }>(`select enqueue_reminders()`),
  );
  const pending = await database.withService((query) =>
    query.query<{ id: string }>(
      `select id from notification_events where kind = 'reminder_24h' and status = 'pending' order by created_at limit 50`,
    ),
  );
  const results = [];
  for (const row of pending.rows) {
    results.push(await deliverNotification(database, row.id));
  }
  return NextResponse.json({ queued: Number(queued.rows[0]?.enqueue_reminders ?? 0), delivered: results });
}
