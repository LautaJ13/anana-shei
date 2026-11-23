import { notFound } from "next/navigation";
import { StaffBookForm } from "@/components/resource-forms";
import { getDatabase } from "@/lib/db";
import { one } from "@/lib/http";
import { requirePanel } from "@/lib/panel";
import { upcomingSchedule } from "@/lib/schedule";
import { dayKey, formatDay, formatTime } from "@/lib/time";
import { fromZonedTime } from "date-fns-tz";

export const metadata = { title: "Nueva reserva" };

export default async function NewReservationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const { user, membership } = await requirePanel(slug);
  if (membership.role === "professional") notFound();
  const database = await getDatabase();
  const professionals = await database.withUser(user.id, (db) =>
    db.query<{ id: string; full_name: string }>(`select id, full_name from professionals where organization_id = $1 and active order by full_name`, [membership.organizationId]),
  );
  const services = await database.withUser(user.id, (db) =>
    db.query<{ id: string; name: string; professional_id: string }>(
      `select s.id, s.name, ps.professional_id from services s join professional_services ps on ps.service_id = s.id
       where s.organization_id = $1 and s.active`,
      [membership.organizationId],
    ),
  );
  const locations = await database.withUser(user.id, (db) =>
    db.query<{ id: string; name: string; timezone: string }>(`select id, name, timezone from clinic_locations where organization_id = $1 and active order by name`, [membership.organizationId]),
  );
  const profesional = one(query.profesional) || professionals.rows[0]?.id || "";
  const matching = services.rows.filter((item) => item.professional_id === profesional);
  const servicio = one(query.servicio) || matching[0]?.id || "";
  const sede = one(query.sede) || locations.rows[0]?.id || "";
  const place = locations.rows.find((item) => item.id === sede);
  const schedule = profesional && servicio && place
    ? await upcomingSchedule(database, user.id, {
        professionalId: profesional,
        serviceId: servicio,
        locationId: sede,
        from: dayKey(new Date(), place.timezone),
        days: 14,
      })
    : null;
  const slots = (schedule?.days ?? []).flatMap((day) =>
    day.slots.filter((slot) => slot.state === "free").map((slot) => ({
      start: slot.start,
      label: `${formatDay(fromZonedTime(`${day.date}T12:00:00`, schedule!.timeZone), schedule!.timeZone)} · ${formatTime(slot.start, schedule!.timeZone)}`,
    })),
  );
  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-semibold text-navy">Reserva por teléfono</h1>
      <form className="mt-4 grid gap-3" method="get">
        <select name="profesional" defaultValue={profesional} className="h-11 rounded-xl border border-line px-3" aria-label="Profesional">
          {professionals.rows.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
        </select>
        <select name="servicio" defaultValue={servicio} className="h-11 rounded-xl border border-line px-3" aria-label="Servicio">
          {matching.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select name="sede" defaultValue={sede} className="h-11 rounded-xl border border-line px-3" aria-label="Sede">
          {locations.rows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button className="h-11 rounded-xl bg-white px-3 text-sm font-semibold" type="submit">Ver horarios libres</button>
      </form>
      <div className="mt-6">
        <StaffBookForm
          slug={slug}
          professionals={professionals.rows.map((item) => ({ id: item.id, fullName: item.full_name }))}
          services={matching.map((item) => ({ id: item.id, name: item.name }))}
          locations={locations.rows.map((item) => ({ id: item.id, name: item.name }))}
          slots={slots}
          defaults={{ professionalId: profesional, serviceId: servicio, locationId: sede }}
        />
      </div>
    </div>
  );
}
