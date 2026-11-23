import { notFound } from "next/navigation";
import { InviteForm } from "@/components/resource-forms";
import { memberStatusAction } from "@/lib/actions/clinic";
import { getDatabase } from "@/lib/db";
import { one } from "@/lib/http";
import { ROLE_LABEL } from "@/lib/labels";
import { requirePanel } from "@/lib/panel";

export const metadata = { title: "Equipo" };

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const { user, membership } = await requirePanel(slug);
  if (membership.role !== "org_admin") notFound();
  const database = await getDatabase();
  const members = await database.withUser(user.id, (db) =>
    db.query<{ id: string; full_name: string; email: string; role: keyof typeof ROLE_LABEL; status: string }>(
      `select m.id, p.full_name, p.email, m.role, m.status
       from organization_members m join profiles p on p.id = m.user_id
       where m.organization_id = $1 order by p.full_name`,
      [membership.organizationId],
    ),
  );
  const professionals = await database.withUser(user.id, (db) =>
    db.query<{ id: string; full_name: string }>(`select id, full_name from professionals where organization_id = $1 and active order by full_name`, [membership.organizationId]),
  );
  const aviso = one((await searchParams).aviso);
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold text-navy">Equipo</h1>
      <p className="mt-2 text-sm text-muted">Un profesional no puede cambiar permisos de administración. No se puede dejar el consultorio sin una administración activa.</p>
      {aviso ? <p className="mt-3 text-sm text-danger" role="alert">{aviso}</p> : null}
      <ul className="mt-4 space-y-2">
        {members.rows.map((member) => (
          <li key={member.id} className="rounded-2xl bg-white p-4 text-sm">
            <p className="font-semibold text-navy">{member.full_name}</p>
            <p>{member.email} · {ROLE_LABEL[member.role]} · {member.status === "active" ? "Activo" : "Desactivado"}</p>
            {member.status === "active" ? (
              <form action={memberStatusAction} className="mt-2">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={member.id} />
                <input type="hidden" name="status" value="disabled" />
                <button className="text-sm font-semibold text-danger" type="submit">Desactivar</button>
              </form>
            ) : (
              <form action={memberStatusAction} className="mt-2">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={member.id} />
                <input type="hidden" name="status" value="active" />
                <button className="text-sm font-semibold text-navy" type="submit">Reactivar</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-6 rounded-2xl bg-white p-4">
        <h2 className="font-semibold text-navy">Invitar</h2>
        <div className="mt-3">
          <InviteForm slug={slug} professionals={professionals.rows.map((item) => ({ id: item.id, fullName: item.full_name }))} />
        </div>
      </div>
    </div>
  );
}
