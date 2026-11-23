import Link from "next/link";
import { fromZonedTime } from "date-fns-tz";
import { AppointmentActions } from "@/components/appointment-actions";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { one } from "@/lib/http";
import { listPanelAppointments, requirePanel, staffScope } from "@/lib/panel";
import { orgTimezone } from "@/lib/queries";
import { dayKey, formatDateTime, shiftDate } from "@/lib/time";

export const metadata = { title: "Reservas" };

export default async function ReservationsPage({
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
  const estado = one(query.estado);
  const profesional = staffScope(membership) ?? (one(query.profesional) || null);
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(one(query.fecha)) ? one(query.fecha) : "";
  const from = fecha || dayKey(new Date(), timeZone);
  const to = fecha ? shiftDate(fecha, 1, timeZone) : shiftDate(from, 21, timeZone);
  const rows = await listPanelAppointments(user.id, membership.organizationId, {
    from: fromZonedTime(`${from}T00:00:00`, timeZone).toISOString(),
    to: fromZonedTime(`${to}T00:00:00`, timeZone).toISOString(),
    professionalId: profesional,
  });
  const visible = rows.filter((row) => !estado || row.status === estado);
  const returnTo = `/c/${slug}/panel/reservas`;
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold text-navy">Reservas</h1>
        {membership.role === "professional" ? null : <Link className="rounded-xl bg-navy px-3 py-2 text-sm font-semibold text-white" href={`/c/${slug}/panel/reservas/nueva`}>Nueva</Link>}
      </div>
      <form className="mt-4 flex flex-wrap gap-2" method="get">
        <input type="date" name="fecha" defaultValue={fecha} className="h-11 rounded-xl border border-line px-3" aria-label="Fecha" />
        <select name="estado" defaultValue={estado} className="h-11 rounded-xl border border-line px-3" aria-label="Estado">
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="confirmed">Confirmada</option>
          <option value="completed">Completada</option>
          <option value="cancelled">Cancelada</option>
          <option value="no_show">Ausente</option>
        </select>
        <button className="h-11 rounded-xl bg-white px-3 text-sm font-semibold" type="submit">Filtrar</button>
      </form>
      {one((await searchParams).aviso) ? <p className="mt-4 text-sm" role="status">{one(query.aviso)}</p> : null}
      {visible.length === 0 ? <div className="mt-4"><EmptyState title="No hay reservas con ese filtro" body="Probá otra fecha o estado. Las reservas canceladas liberan el horario." /></div> : (
        <ul className="mt-4 space-y-3">
          {visible.map((row) => (
            <li key={row.id} className="rounded-2xl bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-navy">{formatDateTime(row.starts_at, row.timezone)}</p>
                  <p className="text-sm">{row.patient_name} · {row.patient_email}{row.patient_phone ? ` · ${row.patient_phone}` : ""}</p>
                  <p className="text-sm text-muted">{row.service_name} con {row.professional_name} · {row.location_name} · {row.source === "staff" ? "Teléfono" : "Web"}</p>
                </div>
                <StatusBadge status={row.status} />
              </div>
              <AppointmentActions id={row.id} status={row.status} startsAt={row.starts_at} returnTo={returnTo} rescheduleHref={`/c/${slug}/panel/reservas/${row.id}/reprogramar`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
