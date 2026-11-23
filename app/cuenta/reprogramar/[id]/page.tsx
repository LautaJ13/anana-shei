import { notFound, redirect } from "next/navigation";
import { RescheduleForm } from "@/components/reschedule-form";
import { getDatabase } from "@/lib/db";
import { one } from "@/lib/http";
import { upcomingSchedule } from "@/lib/schedule";
import { getCurrentUser } from "@/lib/session";
import { dayKey, formatDateTime } from "@/lib/time";

export const metadata = { title: "Reprogramar" };

export default async function PatientReschedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user) redirect(`/ingresar?next=/cuenta/reprogramar/${id}`);
  const aviso = one((await searchParams).aviso);
  const database = await getDatabase();
  const rows = await database.withUser(user.id, (query) =>
    query.query<{
      professional_id: string;
      service_id: string;
      location_id: string;
      starts_at: Date | string;
      status: string;
      timezone: string;
      professional: string;
      service: string;
    }>(
      `select a.professional_id, a.service_id, a.location_id, a.starts_at, a.status, l.timezone,
              pr.full_name as professional, s.name as service
       from appointments a
       join clinic_locations l on l.id = a.location_id
       join professionals pr on pr.id = a.professional_id
       join services s on s.id = a.service_id
       where a.id = $1 and a.patient_id = $2`,
      [id, user.id],
    ),
  );
  const row = rows.rows[0];
  if (!row || !["pending", "confirmed"].includes(row.status)) notFound();
  const schedule = await upcomingSchedule(database, user.id, {
    professionalId: row.professional_id,
    serviceId: row.service_id,
    locationId: row.location_id,
    from: dayKey(new Date(), row.timezone),
    days: 21,
  });
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-3xl font-semibold text-navy">Reprogramar</h1>
      <p className="mt-2 text-sm text-muted">Consulta actual: {formatDateTime(row.starts_at, row.timezone)} · {row.service} con {row.professional}.</p>
      {aviso ? <p className="mt-4 text-sm text-danger" role="alert">{aviso}</p> : null}
      <div className="mt-5">
        <RescheduleForm appointmentId={id} returnTo="/cuenta" timeZone={row.timezone} slots={schedule?.days.flatMap((day) => day.slots) ?? []} />
      </div>
    </div>
  );
}
