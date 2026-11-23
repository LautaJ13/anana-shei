import "server-only";
import { notFound, redirect } from "next/navigation";
import type { Membership, SessionUser } from "./auth";
import { getDatabase } from "./db";
import { getCurrentUser } from "./session";

export async function requirePanel(slug: string): Promise<{ user: SessionUser; membership: Membership }> {
  const user = await getCurrentUser();
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(`/c/${slug}/panel`)}`);
  const membership = user.memberships.find((item) => item.slug === slug);
  if (!membership || membership.organizationStatus === "suspended") notFound();
  return { user, membership };
}

export function staffScope(membership: Membership): string | null {
  return membership.role === "professional" ? membership.professionalId : null;
}

export type PanelAppointment = {
  id: string;
  starts_at: Date | string;
  ends_at: Date | string;
  status: string;
  source: string;
  patient_name: string;
  patient_email: string;
  patient_phone: string | null;
  professional_id: string;
  professional_name: string;
  service_name: string;
  location_name: string;
  timezone: string;
};

export async function listPanelAppointments(
  userId: string,
  organizationId: string,
  range: { from: string; to: string; professionalId?: string | null },
): Promise<PanelAppointment[]> {
  const database = await getDatabase();
  const rows = await database.withUser(userId, (query) =>
    query.query<PanelAppointment>(
      `select a.id, a.starts_at, a.ends_at, a.status, a.source,
              p.full_name as patient_name, p.email as patient_email, p.phone as patient_phone,
              pr.id as professional_id, pr.full_name as professional_name,
              s.name as service_name, l.name as location_name, l.timezone
       from appointments a
       join profiles p on p.id = a.patient_id
       join professionals pr on pr.id = a.professional_id
       join services s on s.id = a.service_id
       join clinic_locations l on l.id = a.location_id
       where a.organization_id = $1
         and a.starts_at < $3::timestamptz
         and a.ends_at > $2::timestamptz
         and ($4::uuid is null or a.professional_id = $4::uuid)
       order by a.starts_at`,
      [organizationId, range.from, range.to, range.professionalId || null],
    ),
  );
  return rows.rows;
}

export async function panelCounts(userId: string, organizationId: string, professionalId: string | null, bounds: {
  dayStartAt: string;
  dayEndAt: string;
  weekStartAt: string;
  weekEndAt: string;
}) {
  const database = await getDatabase();
  const rows = await database.withUser(userId, (query) =>
    query.query<{
      day_count: string;
      week_count: string;
      pending_count: string;
      cancelled_count: string;
      professionals: string;
    }>(
      `select
         count(*) filter (
           where a.starts_at >= $2::timestamptz and a.starts_at < $3::timestamptz
             and a.status in ('pending', 'confirmed')
         ) as day_count,
         count(*) filter (
           where a.starts_at >= $4::timestamptz and a.starts_at < $5::timestamptz
             and a.status in ('pending', 'confirmed', 'completed')
         ) as week_count,
         count(*) filter (where a.status = 'pending') as pending_count,
         count(*) filter (
           where a.status = 'cancelled' and a.updated_at >= $4::timestamptz and a.updated_at < $5::timestamptz
         ) as cancelled_count,
         (select count(*) from professionals pr where pr.organization_id = $1 and pr.active) as professionals
       from appointments a
       where a.organization_id = $1
         and ($6::uuid is null or a.professional_id = $6::uuid)`,
      [organizationId, bounds.dayStartAt, bounds.dayEndAt, bounds.weekStartAt, bounds.weekEndAt, professionalId],
    ),
  );
  const row = rows.rows[0];
  return {
    day: Number(row?.day_count ?? 0),
    week: Number(row?.week_count ?? 0),
    pending: Number(row?.pending_count ?? 0),
    cancelled: Number(row?.cancelled_count ?? 0),
    professionals: Number(row?.professionals ?? 0),
  };
}
