import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { emailStatusMessage } from "@/lib/email";
import { getDatabase } from "@/lib/db";
import { STATUS_LABEL, type AppointmentStatus } from "@/lib/labels";
import { getCurrentUser } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Comprobante" };

export default async function ReceiptPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(`/consultorios/${slug}/reservar/comprobante/${id}`)}`);
  const database = await getDatabase();
  const rows = await database.withUser(user.id, (query) =>
    query.query<{
      starts_at: Date | string;
      status: string;
      professional: string;
      service: string;
      address: string;
      city: string;
      timezone: string;
      organization: string;
      email_status: string | null;
    }>(
      `select a.starts_at, a.status, pr.full_name as professional, s.name as service,
              l.address, l.city, l.timezone, o.name as organization,
              (select n.status from notification_events n where n.appointment_id = a.id order by n.created_at desc limit 1) as email_status
       from appointments a
       join professionals pr on pr.id = a.professional_id
       join services s on s.id = a.service_id
       join clinic_locations l on l.id = a.location_id
       join organizations o on o.id = a.organization_id
       where a.id = $1 and o.slug = $2`,
      [id, slug],
    ),
  );
  const row = rows.rows[0];
  if (!row) notFound();
  const status = (row.status in STATUS_LABEL ? row.status : "confirmed") as AppointmentStatus;
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-ok">Paso 4</p>
        <h1 className="mt-2 text-3xl font-semibold text-navy">Tu consulta fue reservada correctamente</h1>
        <p className="mt-2 text-sm text-muted">{STATUS_LABEL[status]}. {emailStatusMessage(row.email_status)}</p>
        <dl className="mt-6 space-y-3 text-sm">
          <div><dt className="text-muted">Fecha y hora</dt><dd className="text-lg font-semibold text-navy">{formatDateTime(row.starts_at, row.timezone)}</dd></div>
          <div><dt className="text-muted">Profesional</dt><dd>{row.professional}</dd></div>
          <div><dt className="text-muted">Servicio</dt><dd>{row.service}</dd></div>
          <div><dt className="text-muted">Dirección</dt><dd>{row.address}, {row.city}</dd></div>
          <div><dt className="text-muted">Consultorio</dt><dd>{row.organization}</dd></div>
        </dl>
        <Link className="mt-6 inline-flex h-11 items-center rounded-xl bg-navy px-4 font-semibold text-white" href="/cuenta">Ver mis consultas</Link>
      </section>
    </div>
  );
}
