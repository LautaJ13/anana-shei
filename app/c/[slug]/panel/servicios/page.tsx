import { notFound } from "next/navigation";
import { ServiceForm } from "@/components/resource-forms";
import { getDatabase } from "@/lib/db";
import { requirePanel } from "@/lib/panel";

export const metadata = { title: "Servicios" };

export default async function ServicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, membership } = await requirePanel(slug);
  if (membership.role !== "org_admin") notFound();
  const database = await getDatabase();
  const services = await database.withUser(user.id, (db) =>
    db.query<{ id: string; name: string; description: string; duration_minutes: number; buffer_minutes: number; price_cents: number | null; active: boolean }>(
      `select id, name, description, duration_minutes, buffer_minutes, price_cents, active from services where organization_id = $1 order by name`,
      [membership.organizationId],
    ),
  );
  return (
    <div>
      <h1 className="text-3xl font-semibold text-navy">Servicios</h1>
      <p className="mt-2 text-sm text-muted">La duración y la pausa definen los horarios que se ofrecen. Un precio vacío no se publica.</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ServiceForm slug={slug} defaults={{ id: "", name: "", description: "", durationMinutes: 30, bufferMinutes: 10, pricePesos: "", active: true }} />
        {services.rows.map((item) => (
          <ServiceForm
            key={item.id}
            slug={slug}
            defaults={{
              id: item.id,
              name: item.name,
              description: item.description,
              durationMinutes: Number(item.duration_minutes),
              bufferMinutes: Number(item.buffer_minutes),
              pricePesos: item.price_cents == null ? "" : String(Number(item.price_cents) / 100),
              active: item.active,
            }}
          />
        ))}
      </div>
    </div>
  );
}
