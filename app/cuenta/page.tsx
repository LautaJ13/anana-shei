import Link from "next/link";
import { redirect } from "next/navigation";
import { cancelAction } from "@/lib/actions/booking";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { getDatabase } from "@/lib/db";
import { one } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Mis consultas" };

type Row = {
  id: string;
  starts_at: Date | string;
  status: string;
  organization: string;
  slug: string;
  professional: string;
  service: string;
  address: string;
  city: string;
  timezone: string;
  cancellation_hours: number;
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar?next=/cuenta");
  const aviso = one((await searchParams).aviso);
  const database = await getDatabase();
  const rows = await database.withUser(user.id, (query) =>
    query.query<Row>(
      `select a.id, a.starts_at, a.status, o.name as organization, o.slug, o.cancellation_hours,
              pr.full_name as professional, s.name as service, l.address, l.city, l.timezone
       from appointments a
       join organizations o on o.id = a.organization_id
       join professionals pr on pr.id = a.professional_id
       join services s on s.id = a.service_id
       join clinic_locations l on l.id = a.location_id
       where a.patient_id = $1
       order by a.starts_at desc`,
      [user.id],
    ),
  );
  const now = Date.now();
  const upcoming = rows.rows.filter((row) => new Date(row.starts_at).getTime() >= now && row.status !== "cancelled");
  const history = rows.rows.filter((row) => !upcoming.includes(row));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-navy">Hola, {user.fullName.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted">Estas son tus consultas. Nadie más puede verlas desde tu cuenta.</p>
        </div>
        <Link className="text-sm font-semibold text-navy underline" href="/cuenta/perfil">Mis datos</Link>
      </div>
      {aviso ? <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-navy" role="status">{aviso}</p> : null}
      <section className="mt-6">
        <h2 className="text-xl font-semibold text-navy">Próximas</h2>
        {upcoming.length === 0 ? (
          <div className="mt-3"><EmptyState title="No tenés consultas próximas" body="Cuando reserves, el turno aparece acá con la dirección y el profesional." action={<Link className="font-semibold text-navy underline" href="/">Buscar un consultorio</Link>} /></div>
        ) : (
          <ul className="mt-3 space-y-3">{upcoming.map((row) => <AppointmentCard key={row.id} row={row} />)}</ul>
        )}
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-navy">Historial</h2>
        {history.length === 0 ? <p className="mt-3 text-sm text-muted">Todavía no hay consultas anteriores.</p> : <ul className="mt-3 space-y-3">{history.map((row) => <AppointmentCard key={row.id} row={row} />)}</ul>}
      </section>
    </div>
  );
}

function AppointmentCard({ row }: { row: Row }) {
  const starts = new Date(row.starts_at).getTime();
  const canChange = ["pending", "confirmed"].includes(row.status) && starts - Date.now() > row.cancellation_hours * 60 * 60 * 1000;
  return (
    <li className="rounded-2xl bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-navy">{formatDateTime(row.starts_at, row.timezone)}</p>
          <p className="mt-1 text-sm">{row.service} con {row.professional}</p>
          <p className="text-sm text-muted">{row.organization} · {row.address}, {row.city}</p>
        </div>
        <StatusBadge status={row.status} />
      </div>
      {canChange ? (
        <div className="mt-4 space-y-3 border-t border-line pt-3">
          <Link className="text-sm font-semibold text-navy underline" href={`/cuenta/reprogramar/${row.id}`}>Reprogramar</Link>
          <form action={cancelAction} className="space-y-2">
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="returnTo" value="/cuenta" />
            <label className="flex items-start gap-2 text-sm">
              <input className="mt-1" type="checkbox" name="confirm" required />
              Confirmo que quiero cancelar esta consulta. Se puede hasta {row.cancellation_hours} horas antes.
            </label>
            <label className="block text-sm" htmlFor={`motivo-${row.id}`}>Motivo, si querés contarlo</label>
            <input id={`motivo-${row.id}`} name="reason" maxLength={160} className="h-11 w-full rounded-xl border border-line px-3" />
            <button className="h-10 rounded-xl bg-danger px-3 text-sm font-semibold text-white" type="submit">Cancelar consulta</button>
          </form>
        </div>
      ) : null}
    </li>
  );
}
