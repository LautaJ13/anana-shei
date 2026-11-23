import Link from "next/link";
import { AppointmentActions } from "@/components/appointment-actions";
import { StatusBadge } from "@/components/status-badge";
import { getDatabase } from "@/lib/db";
import { one } from "@/lib/http";
import { listPanelAppointments, requirePanel, staffScope } from "@/lib/panel";
import { orgTimezone } from "@/lib/queries";
import { weekdayOf } from "@/lib/slots";
import { dayKey, formatDay, formatTime, shiftDate } from "@/lib/time";
import { fromZonedTime } from "date-fns-tz";

export const metadata = { title: "Calendario" };

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const { user, membership } = await requirePanel(slug);
  const timeZone = await orgTimezone(membership.organizationId, user.id);
  const vista = one(query.vista) || "semana";
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(one(query.fecha)) ? one(query.fecha) : dayKey(new Date(), timeZone);
  const requested = one(query.profesional);
  const scope = staffScope(membership);
  const professionalId = scope ?? (requested || null);
  const span = vista === "dia" ? 1 : vista === "mes" ? 35 : 7;
  const start = vista === "mes" ? shiftDate(anchor, -weekdayOf(anchor, timeZone), timeZone) : anchor;
  const end = shiftDate(start, span, timeZone);
  const appointments = await listPanelAppointments(user.id, membership.organizationId, {
    from: fromZonedTime(`${start}T00:00:00`, timeZone).toISOString(),
    to: fromZonedTime(`${end}T00:00:00`, timeZone).toISOString(),
    professionalId,
  });
  const database = await getDatabase();
  const professionals = await database.withUser(user.id, (db) =>
    db.query<{ id: string; full_name: string }>(
      `select id, full_name from professionals where organization_id = $1 and ($2::uuid is null or id = $2::uuid) order by full_name`,
      [membership.organizationId, scope],
    ),
  );
  const days = Array.from({ length: span }, (_, index) => shiftDate(start, index, timeZone));
  const returnTo = `/c/${slug}/panel/calendario?vista=${vista}&fecha=${anchor}${professionalId ? `&profesional=${professionalId}` : ""}`;
  const href = (next: { vista?: string; fecha?: string; profesional?: string }) => {
    const params = new URLSearchParams({ vista: next.vista ?? vista, fecha: next.fecha ?? anchor });
    const id = next.profesional ?? requested;
    if (id) params.set("profesional", id);
    return `/c/${slug}/panel/calendario?${params}`;
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold text-navy">Calendario</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {(["dia", "semana", "mes"] as const).map((item) => (
          <Link key={item} className={`rounded-xl px-3 py-2 text-sm font-semibold ${vista === item ? "bg-navy text-white" : "bg-white text-navy"}`} href={href({ vista: item })}>
            {item === "dia" ? "Día" : item === "semana" ? "Semana" : "Mes"}
          </Link>
        ))}
        <Link className="rounded-xl bg-white px-3 py-2 text-sm font-semibold" href={href({ fecha: shiftDate(anchor, vista === "mes" ? -28 : vista === "semana" ? -7 : -1, timeZone) })}>Anterior</Link>
        <Link className="rounded-xl bg-white px-3 py-2 text-sm font-semibold" href={href({ fecha: shiftDate(anchor, vista === "mes" ? 28 : vista === "semana" ? 7 : 1, timeZone) })}>Siguiente</Link>
      </div>
      {scope ? null : (
        <form className="mt-4" action={`/c/${slug}/panel/calendario`} method="get">
          <input type="hidden" name="vista" value={vista} />
          <input type="hidden" name="fecha" value={anchor} />
          <label className="text-sm font-medium" htmlFor="profesional">Profesional</label>
          <select id="profesional" name="profesional" defaultValue={requested} className="ml-2 h-11 rounded-xl border border-line bg-white px-3">
            <option value="">Todos</option>
            {professionals.rows.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
          </select>
          <button className="ml-2 h-11 rounded-xl bg-navy px-3 text-sm font-semibold text-white" type="submit">Filtrar</button>
        </form>
      )}
      <div className={`mt-5 grid gap-3 ${vista === "semana" ? "lg:grid-cols-7" : vista === "mes" ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7" : ""}`}>
        {days.map((day) => {
          const items = appointments.filter((item) => dayKey(item.starts_at, item.timezone || timeZone) === day);
          return (
            <section key={day} className="rounded-2xl bg-white p-3">
              <h2 className="text-sm font-semibold text-navy">{formatDay(fromZonedTime(`${day}T12:00:00`, timeZone), timeZone)}</h2>
              {items.length === 0 ? <p className="mt-2 text-xs text-muted">Libre</p> : (
                <ul className="mt-2 space-y-2">
                  {items.map((item) => (
                    <li key={item.id} className="rounded-xl bg-background p-2 text-xs">
                      <p className="font-semibold">{formatTime(item.starts_at, item.timezone)} {item.patient_name}</p>
                      <p>{item.service_name}</p>
                      <StatusBadge status={item.status} />
                      {vista === "mes" ? null : (
                        <AppointmentActions id={item.id} status={item.status} startsAt={item.starts_at} returnTo={returnTo} rescheduleHref={`/c/${slug}/panel/reservas/${item.id}/reprogramar`} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted">Los horarios se muestran en {timeZone}. Un casillero sin reservas no garantiza un turno publicable: la duración y las pausas se calculan al reservar.</p>
    </div>
  );
}
