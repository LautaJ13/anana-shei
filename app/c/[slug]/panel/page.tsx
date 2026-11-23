import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { one } from "@/lib/http";
import { listPanelAppointments, panelCounts, requirePanel, staffScope } from "@/lib/panel";
import { orgTimezone, periodBounds } from "@/lib/queries";
import { formatTime } from "@/lib/time";

export const metadata = { title: "Panel" };

export default async function PanelHome({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const { user, membership } = await requirePanel(slug);
  const aviso = one((await searchParams).aviso);
  const timeZone = await orgTimezone(membership.organizationId, user.id);
  const bounds = periodBounds(timeZone);
  const scope = staffScope(membership);
  const [counts, today] = await Promise.all([
    panelCounts(user.id, membership.organizationId, scope, bounds),
    listPanelAppointments(user.id, membership.organizationId, { from: bounds.dayStartAt, to: bounds.dayEndAt, professionalId: scope }),
  ]);
  const cards = [
    ["Reservas de hoy", counts.day],
    ["Reservas de la semana", counts.week],
    ["Pendientes", counts.pending],
    ["Cancelaciones de la semana", counts.cancelled],
    ["Profesionales activos", counts.professionals],
  ];
  return (
    <div>
      <h1 className="text-3xl font-semibold text-navy">Hoy en {membership.organizationName}</h1>
      {aviso ? <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm" role="status">{aviso}</p> : null}
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value]) => (
          <li key={String(label)} className="rounded-2xl bg-white p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-3xl font-semibold text-navy">{value}</p>
          </li>
        ))}
      </ul>
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-navy">Agenda de hoy</h2>
          <Link className="text-sm font-semibold underline" href={`/c/${slug}/panel/calendario`}>Ver calendario</Link>
        </div>
        {today.length === 0 ? <p className="mt-3 text-sm text-muted">No hay reservas para hoy.</p> : (
          <ul className="mt-3 space-y-2">
            {today.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3">
                <p className="text-sm"><span className="font-semibold text-navy">{formatTime(item.starts_at, item.timezone)}</span> {item.patient_name} · {item.service_name} · {item.professional_name}</p>
                <StatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
