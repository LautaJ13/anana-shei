import { notFound } from "next/navigation";
import { RescheduleForm } from "@/components/reschedule-form";
import { getDatabase } from "@/lib/db";
import { one } from "@/lib/http";
import { requirePanel } from "@/lib/panel";
import { upcomingSchedule } from "@/lib/schedule";
import { dayKey, formatDateTime } from "@/lib/time";

export const metadata = { title: "Reprogramar reserva" };

export default async function StaffReschedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, id } = await params;
  const { user, membership } = await requirePanel(slug);
  const database = await getDatabase();
  const rows = await database.withUser(user.id, (query) =>
    query.query<{
      professional_id: string;
      service_id: string;
      location_id: string;
      starts_at: Date | string;
      status: string;
      timezone: string;
      patient: string;
    }>(
      `select a.professional_id, a.service_id, a.location_id, a.starts_at, a.status, l.timezone, p.full_name as patient
       from appointments a
       join clinic_locations l on l.id = a.location_id
       join profiles p on p.id = a.patient_id
       where a.id = $1 and a.organization_id = $2`,
      [id, membership.organizationId],
    ),
  );
  const row = rows.rows[0];
  if (!row || (membership.role === "professional" && membership.professionalId !== row.professional_id)) notFound();
  const schedule = await upcomingSchedule(database, user.id, {
    professionalId: row.professional_id,
    serviceId: row.service_id,
    locationId: row.location_id,
    from: dayKey(new Date(), row.timezone),
    days: 21,
  });
  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-semibold text-navy">Reprogramar</h1>
      <p className="mt-2 text-sm text-muted">{row.patient} · {formatDateTime(row.starts_at, row.timezone)}</p>
      {one((await searchParams).aviso) ? <p className="mt-3 text-sm text-danger" role="alert">{one((await searchParams).aviso)}</p> : null}
      <div className="mt-4">
        <RescheduleForm
          appointmentId={id}
          returnTo={`/c/${slug}/panel/reservas`}
          timeZone={row.timezone}
          slots={schedule?.days.flatMap((day) => day.slots) ?? []}
        />
      </div>
    </div>
  );
}
