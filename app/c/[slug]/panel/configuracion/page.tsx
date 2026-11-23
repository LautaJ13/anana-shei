import { notFound } from "next/navigation";
import { OrganizationForm } from "@/components/resource-forms";
import { uploadLogoAction } from "@/lib/actions/clinic";
import { getDatabase } from "@/lib/db";
import { one } from "@/lib/http";
import { requirePanel } from "@/lib/panel";

export const metadata = { title: "Configuración" };

export default async function SettingsPage({
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
  const org = await database.withUser(user.id, (db) =>
    db.query<{ name: string; slug: string; description: string; phone: string | null; email: string | null; cancellation_hours: number; require_confirmation: boolean; logo_mime: string | null }>(
      `select name, slug, description, phone, email, cancellation_hours, require_confirmation, logo_mime from organizations where id = $1`,
      [membership.organizationId],
    ),
  );
  const location = await database.withUser(user.id, (db) =>
    db.query<{ address: string; city: string; department: string }>(
      `select address, city, department from clinic_locations where organization_id = $1 and active order by created_at limit 1`,
      [membership.organizationId],
    ),
  );
  const row = org.rows[0];
  const place = location.rows[0];
  if (!row || !place) notFound();
  const aviso = one((await searchParams).aviso);
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold text-navy">Configuración</h1>
      {aviso ? <p className="mt-3 text-sm text-danger" role="alert">{aviso}</p> : null}
      <div className="mt-5 rounded-2xl bg-white p-5">
        <OrganizationForm
          mode="edit"
          slug={slug}
          defaults={{
            name: row.name,
            slug: row.slug,
            description: row.description,
            phone: row.phone ?? "",
            email: row.email ?? "",
            address: place.address,
            city: place.city,
            department: place.department,
            cancellationHours: Number(row.cancellation_hours),
            requireConfirmation: row.require_confirmation,
          }}
        />
      </div>
      <form className="mt-4 rounded-2xl bg-white p-5" action={uploadLogoAction.bind(null, slug)}>
        <h2 className="font-semibold text-navy">Logo</h2>
        <p className="mt-1 text-sm text-muted">{row.logo_mime ? "Hay un logo cargado." : "Todavía no hay logo."} PNG, JPG o WebP, hasta 200 KB.</p>
        <input className="mt-3 block text-sm" type="file" name="logo" accept="image/png,image/jpeg,image/webp" required />
        <button className="mt-3 h-11 rounded-xl bg-navy px-4 text-sm font-semibold text-white" type="submit">Subir logo</button>
      </form>
    </div>
  );
}
