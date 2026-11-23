import { notFound } from "next/navigation";
import { getDatabase } from "@/lib/db";
import { requirePanel } from "@/lib/panel";
import { formatDateTime } from "@/lib/time";
import { orgTimezone } from "@/lib/queries";

export const metadata = { title: "Actividad" };

export default async function AuditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, membership } = await requirePanel(slug);
  if (membership.role !== "org_admin") notFound();
  const database = await getDatabase();
  const timeZone = await orgTimezone(membership.organizationId, user.id);
  const rows = await database.withUser(user.id, (db) =>
    db.query<{ action: string; entity_type: string; created_at: Date | string; actor: string | null }>(
      `select a.action, a.entity_type, a.created_at, p.full_name as actor
       from audit_logs a left join profiles p on p.id = a.actor_id
       where a.organization_id = $1
       order by a.created_at desc limit 80`,
      [membership.organizationId],
    ),
  );
  return (
    <div>
      <h1 className="text-3xl font-semibold text-navy">Actividad</h1>
      <p className="mt-2 text-sm text-muted">Registro de acciones administrativas. No incluye notas clínicas.</p>
      <ul className="mt-4 space-y-2">
        {rows.rows.map((row, index) => (
          <li key={`${row.created_at}-${index}`} className="rounded-2xl bg-white px-4 py-3 text-sm">
            <p className="font-semibold text-navy">{row.action}</p>
            <p className="text-muted">{formatDateTime(row.created_at, timeZone)} · {row.actor ?? "Sistema"} · {row.entity_type}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
