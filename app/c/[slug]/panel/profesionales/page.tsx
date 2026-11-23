import { notFound } from "next/navigation";
import { ProfessionalForm } from "@/components/resource-forms";
import { getDatabase } from "@/lib/db";
import { requirePanel } from "@/lib/panel";

export const metadata = { title: "Profesionales" };

export default async function ProfessionalsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, membership } = await requirePanel(slug);
  if (membership.role !== "org_admin") notFound();
  const database = await getDatabase();
  const [professionals, specialties, services, links] = await Promise.all([
    database.withUser(user.id, (db) => db.query<{ id: string; full_name: string; license_number: string | null; bio: string; active: boolean; can_manage_availability: boolean }>(
      `select id, full_name, license_number, bio, active, can_manage_availability from professionals where organization_id = $1 order by full_name`,
      [membership.organizationId],
    )),
    database.withUser(user.id, (db) => db.query<{ id: string; name: string }>(`select id, name from specialties order by name`)),
    database.withUser(user.id, (db) => db.query<{ id: string; name: string }>(`select id, name from services where organization_id = $1 order by name`, [membership.organizationId])),
    database.withUser(user.id, (db) => db.query<{ professional_id: string; specialty_id: string; service_id: string | null }>(
      `select p.id as professional_id, ps.specialty_id, psv.service_id
       from professionals p
       left join professional_specialties ps on ps.professional_id = p.id
       left join professional_services psv on psv.professional_id = p.id
       where p.organization_id = $1`,
      [membership.organizationId],
    )),
  ]);
  return (
    <div>
      <h1 className="text-3xl font-semibold text-navy">Profesionales</h1>
      <p className="mt-2 text-sm text-muted">La ficha no da acceso al panel. Invitá a la persona desde Equipo y vinculala a esta ficha.</p>
      <div className="mt-5 grid gap-4">
        <ProfessionalForm
          slug={slug}
          specialties={specialties.rows}
          services={services.rows}
          defaults={{ id: "", fullName: "", licenseNumber: "", bio: "", active: true, canManageAvailability: false, specialtyIds: [], serviceIds: [] }}
        />
        {professionals.rows.map((item) => (
          <ProfessionalForm
            key={item.id}
            slug={slug}
            specialties={specialties.rows}
            services={services.rows}
            defaults={{
              id: item.id,
              fullName: item.full_name,
              licenseNumber: item.license_number ?? "",
              bio: item.bio,
              active: item.active,
              canManageAvailability: item.can_manage_availability,
              specialtyIds: [...new Set(links.rows.flatMap((link) => link.professional_id === item.id && link.specialty_id ? [link.specialty_id] : []))],
              serviceIds: [...new Set(links.rows.flatMap((link) => link.professional_id === item.id && link.service_id ? [link.service_id] : []))],
            }}
          />
        ))}
      </div>
    </div>
  );
}
