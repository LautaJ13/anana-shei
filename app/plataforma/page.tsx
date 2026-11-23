import { notFound } from "next/navigation";
import { SpecialtyForm } from "@/components/resource-forms";
import { setOrgStatusAction } from "@/lib/actions/platform";
import { getDatabase } from "@/lib/db";
import { one } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Plataforma" };

const statusLabel = { pending: "Pendiente", active: "Activo", suspended: "Suspendido" };

export default async function PlatformPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user || user.platformRole !== "superadmin") notFound();
  const database = await getDatabase();
  const overview = await database.withUser(user.id, (db) =>
    db.query<{ organization_count: string; active_organization_count: string; user_count: string; appointment_count: string; upcoming_appointment_count: string }>(
      `select * from platform_overview()`,
    ),
  );
  const orgs = await database.withUser(user.id, (db) =>
    db.query<{ id: string; name: string; slug: string; status: keyof typeof statusLabel; city: string | null; member_count: string; professional_count: string; appointment_count: string }>(
      `select id, name, slug, status, city, member_count, professional_count, appointment_count from platform_organizations()`,
    ),
  );
  const metrics = overview.rows[0];
  const aviso = one((await searchParams).aviso);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-semibold text-navy">Plataforma</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Ves consultorios, estados y conteos. No ves el detalle de las consultas ni datos clínicos. Las suscripciones quedan preparadas como estado del consultorio, sin cobro.</p>
      {aviso ? <p className="mt-3 text-sm text-danger" role="alert">{aviso}</p> : null}
      <ul className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          ["Consultorios", metrics?.organization_count],
          ["Activos", metrics?.active_organization_count],
          ["Cuentas", metrics?.user_count],
          ["Reservas", metrics?.appointment_count],
          ["Próximas", metrics?.upcoming_appointment_count],
        ].map(([label, value]) => (
          <li key={String(label)} className="rounded-2xl bg-white p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="text-3xl font-semibold text-navy">{value ?? 0}</p>
          </li>
        ))}
      </ul>
      <ul className="mt-6 space-y-3">
        {orgs.rows.map((org) => (
          <li key={org.id} className="rounded-2xl bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-navy">{org.name}</p>
                <p className="text-sm text-muted">{org.city ?? "Sin ciudad"} · {statusLabel[org.status] ?? org.status} · {org.member_count} personas · {org.professional_count} profesionales · {org.appointment_count} reservas</p>
              </div>
              <div className="flex gap-2">
                {org.status !== "active" ? <StatusButton id={org.id} status="active" label="Activar" /> : null}
                {org.status !== "suspended" ? <StatusButton id={org.id} status="suspended" label="Suspender" /> : null}
                {org.status !== "pending" ? <StatusButton id={org.id} status="pending" label="Marcar pendiente" /> : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <section className="mt-8 max-w-md rounded-2xl bg-white p-4">
        <h2 className="font-semibold text-navy">Nueva especialidad</h2>
        <div className="mt-3"><SpecialtyForm /></div>
      </section>
    </div>
  );
}

function StatusButton({ id, status, label }: { id: string; status: string; label: string }) {
  return (
    <form action={setOrgStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className="h-9 rounded-xl bg-navy px-3 text-sm font-semibold text-white" type="submit">{label}</button>
    </form>
  );
}
