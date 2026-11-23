import { notFound } from "next/navigation";
import { AvailabilityForm, ExceptionForm } from "@/components/resource-forms";
import { deleteAvailabilityAction, deleteExceptionAction } from "@/lib/actions/clinic";
import { getDatabase } from "@/lib/db";
import { WEEKDAYS } from "@/lib/labels";
import { requirePanel } from "@/lib/panel";
import { formatDateTime } from "@/lib/time";
import { timeFromMinutes } from "@/lib/utils";

export const metadata = { title: "Horarios" };

export default async function HoursPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, membership } = await requirePanel(slug);
  if (membership.role !== "org_admin" && !membership.canManageAvailability) notFound();
  const database = await getDatabase();
  const only = membership.role === "professional" ? membership.professionalId : null;
  const professionals = await database.withUser(user.id, (db) =>
    db.query<{ id: string; full_name: string }>(
      `select id, full_name from professionals where organization_id = $1 and active and ($2::uuid is null or id = $2::uuid) order by full_name`,
      [membership.organizationId, only],
    ),
  );
  const locations = await database.withUser(user.id, (db) =>
    db.query<{ id: string; name: string; timezone: string }>(`select id, name, timezone from clinic_locations where organization_id = $1 and active order by name`, [membership.organizationId]),
  );
  const hours = await database.withUser(user.id, (db) =>
    db.query<{ id: string; professional: string; location: string; weekday: number; start_minute: number; end_minute: number }>(
      `select r.id, p.full_name as professional, l.name as location, r.weekday, r.start_minute, r.end_minute
       from recurring_availability r
       join professionals p on p.id = r.professional_id
       join clinic_locations l on l.id = r.location_id
       where p.organization_id = $1 and ($2::uuid is null or p.id = $2::uuid)
       order by p.full_name, r.weekday, r.start_minute`,
      [membership.organizationId, only],
    ),
  );
  const exceptions = await database.withUser(user.id, (db) =>
    db.query<{ id: string; professional: string; kind: string; starts_at: Date | string; ends_at: Date | string; note: string; timezone: string }>(
      `select e.id, p.full_name as professional, e.kind, e.starts_at, e.ends_at, e.note,
              (select timezone from clinic_locations l where l.organization_id = p.organization_id and l.active order by l.created_at limit 1) as timezone
       from availability_exceptions e
       join professionals p on p.id = e.professional_id
       where p.organization_id = $1 and ($2::uuid is null or p.id = $2::uuid)
       order by e.starts_at`,
      [membership.organizationId, only],
    ),
  );
  const people = professionals.rows.map((item) => ({ id: item.id, fullName: item.full_name }));
  const places = locations.rows.map((item) => ({ id: item.id, name: item.name }));
  const labels = { block: "Bloqueo", vacation: "Licencia", extra: "Extra" };
  return (
    <div>
      <h1 className="text-3xl font-semibold text-navy">Horarios</h1>
      <p className="mt-2 text-sm text-muted">Un tramo es un día y una franja. El almuerzo se modela dejando dos tramos. Las excepciones bloquean, marcan licencia o agregan un horario extra.</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <AvailabilityForm slug={slug} professionals={people} locations={places} />
        <ExceptionForm slug={slug} professionals={people} locations={places} />
      </div>
      <ul className="mt-6 space-y-2">
        {hours.rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 text-sm">
            <span>{row.professional} · {WEEKDAYS[row.weekday]} · {timeFromMinutes(Number(row.start_minute))} a {timeFromMinutes(Number(row.end_minute))} · {row.location}</span>
            <form action={deleteAvailabilityAction}>
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="returnTo" value={`/c/${slug}/panel/horarios`} />
              <button className="text-sm font-semibold text-danger" type="submit">Quitar</button>
            </form>
          </li>
        ))}
      </ul>
      <ul className="mt-4 space-y-2">
        {exceptions.rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 text-sm">
            <span>{row.professional} · {labels[row.kind as keyof typeof labels] ?? row.kind} · {formatDateTime(row.starts_at, row.timezone)} a {formatDateTime(row.ends_at, row.timezone)} {row.note ? `· ${row.note}` : ""}</span>
            <form action={deleteExceptionAction}>
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="returnTo" value={`/c/${slug}/panel/horarios`} />
              <button className="text-sm font-semibold text-danger" type="submit">Quitar</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
