import type { AppDatabase } from "./db";

export type BookingResult = { appointmentId: string; notificationId: string };

type BookingRow = { appointment_id: string; notification_id: string };

export async function bookAppointment(
  database: AppDatabase,
  userId: string,
  input: {
    professionalId: string;
    serviceId: string;
    locationId: string;
    startsAt: string;
    patientId?: string | null;
    source: "online" | "staff";
    note?: string | null;
  },
): Promise<BookingResult> {
  return database.withUser(userId, async (db) => {
    const rows = await db.query<BookingRow>(
      `select appointment_id, notification_id
       from book_appointment($1, $2, $3, $4::timestamptz, $5, $6, $7)`,
      [
        input.professionalId,
        input.serviceId,
        input.locationId,
        input.startsAt,
        input.patientId ?? null,
        input.source,
        input.note ?? null,
      ],
    );
    const row = rows.rows[0];
    if (!row) throw new Error("not_available");
    return { appointmentId: row.appointment_id, notificationId: row.notification_id };
  });
}

export async function cancelAppointment(
  database: AppDatabase,
  userId: string,
  appointmentId: string,
  reason?: string | null,
): Promise<string> {
  return database.withUser(userId, async (db) => {
    const rows = await db.query<{ cancel_appointment: string }>(
      `select cancel_appointment($1, $2) as cancel_appointment`,
      [appointmentId, reason ?? null],
    );
    return rows.rows[0]?.cancel_appointment ?? "";
  });
}

export async function rescheduleAppointment(
  database: AppDatabase,
  userId: string,
  appointmentId: string,
  startsAt: string,
): Promise<string> {
  return database.withUser(userId, async (db) => {
    const rows = await db.query<{ reschedule_appointment: string }>(
      `select reschedule_appointment($1, $2::timestamptz) as reschedule_appointment`,
      [appointmentId, startsAt],
    );
    return rows.rows[0]?.reschedule_appointment ?? "";
  });
}

export async function transitionAppointment(
  database: AppDatabase,
  userId: string,
  appointmentId: string,
  status: "confirmed" | "completed" | "no_show",
): Promise<void> {
  await database.withUser(userId, (db) => db.query(`select transition_appointment($1, $2)`, [appointmentId, status]));
}
