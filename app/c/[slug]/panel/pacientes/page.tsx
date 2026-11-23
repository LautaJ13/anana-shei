import { EmptyState } from "@/components/empty-state";
import { getDatabase } from "@/lib/db";
import { requirePanel, staffScope } from "@/lib/panel";

export const metadata = { title: "Pacientes" };

export default async function PatientsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, membership } = await requirePanel(slug);
  const database = await getDatabase();
  const rows = await database.withUser(user.id, (db) =>
    db.query<{ id: string; full_name: string; email: string; phone: string | null }>(
      `select distinct p.id, p.full_name, p.email, p.phone
       from appointments a join profiles p on p.id = a.patient_id
       where a.organization_id = $1 and ($2::uuid is null or a.professional_id = $2::uuid)
       order by p.full_name`,
      [membership.organizationId, staffScope(membership)],
    ),
  );
  return (
    <div>
      <h1 className="text-3xl font-semibold text-navy">Pacientes</h1>
      <p className="mt-2 text-sm text-muted">Solo datos de contacto de quienes tienen un turno en este consultorio.</p>
      {rows.rows.length === 0 ? <div className="mt-4"><EmptyState title="Todavía no hay pacientes" body="Aparecen cuando existe una reserva, incluso si después se cancela." /></div> : (
        <ul className="mt-4 divide-y divide-line rounded-2xl bg-white">
          {rows.rows.map((row) => (
            <li key={row.id} className="px-4 py-3 text-sm">
              <p className="font-semibold text-navy">{row.full_name}</p>
              <p>{row.email}{row.phone ? ` · ${row.phone}` : ""}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
