import "server-only";
import { notFound } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import type { SessionUser } from "./auth";
import { getDatabase } from "./db";
import { getCurrentUser } from "./session";
import { weekdayOf } from "./slots";
import { dayKey, shiftDate } from "./time";
import { cleanLike } from "./utils";

async function dbUser() {
  const database = await getDatabase();
  const user = await getCurrentUser();
  return { database, user };
}

export async function listSpecialties() {
  const { database, user } = await dbUser();
  return database.withUser(user?.id ?? null, (query) =>
    query.query<{ id: string; name: string; slug: string }>(
      `select id, name, slug from specialties order by name`,
    ),
  );
}

export async function searchClinics(filters: { q: string; specialty: string; city: string }) {
  const q = cleanLike(filters.q);
  const specialty = cleanLike(filters.specialty);
  const city = cleanLike(filters.city);
  const { database, user } = await dbUser();
  const rows = await database.withUser(user?.id ?? null, (query) =>
    query.query<{
      id: string;
      name: string;
      slug: string;
      description: string;
      place: string | null;
      specialties: string | null;
    }>(
      `select o.id, o.name, o.slug, o.description,
         (select string_agg(distinct s.name, ', ' order by s.name)
          from professionals p
          join professional_specialties ps on ps.professional_id = p.id
          join specialties s on s.id = ps.specialty_id
          where p.organization_id = o.id and p.active) as specialties,
         (select l.city || ', ' || l.department from clinic_locations l
          where l.organization_id = o.id and l.active
          order by l.created_at limit 1) as place
       from organizations o
       where o.status = 'active'
         and ($1 = '' or o.name ilike '%' || $1 || '%' or exists (
           select 1 from professionals p
           left join professional_specialties ps on ps.professional_id = p.id
           left join specialties s on s.id = ps.specialty_id
           where p.organization_id = o.id and p.active
             and (p.full_name ilike '%' || $1 || '%' or s.name ilike '%' || $1 || '%')
         ))
         and ($2 = '' or exists (
           select 1 from professionals p
           join professional_specialties ps on ps.professional_id = p.id
           join specialties s on s.id = ps.specialty_id
           where p.organization_id = o.id and p.active and s.slug = $2
         ))
         and ($3 = '' or exists (
           select 1 from clinic_locations l
           where l.organization_id = o.id and l.active
             and (l.city ilike '%' || $3 || '%' or l.department ilike '%' || $3 || '%')
         ))
       order by o.name
       limit 24`,
      [q, specialty, city],
    ),
  );
  return rows.rows;
}

export async function listCities() {
  const { database, user } = await dbUser();
  const rows = await database.withUser(user?.id ?? null, (query) =>
    query.query<{ city: string }>(
      `select distinct l.city from clinic_locations l
       join organizations o on o.id = l.organization_id
       where l.active and o.status = 'active'
       order by l.city`,
    ),
  );
  return rows.rows.map((row) => row.city);
}

export type ClinicProfile = {
  id: string;
  name: string;
  slug: string;
  description: string;
  phone: string | null;
  email: string | null;
  cancellationHours: number;
  status: string;
  logoMime: string | null;
  locations: {
    id: string;
    name: string;
    address: string;
    city: string;
    department: string;
    timezone: string;
    phone: string | null;
  }[];
  professionals: {
    id: string;
    fullName: string;
    bio: string;
    licenseNumber: string | null;
    specialties: string[];
    services: { id: string; name: string; durationMinutes: number; bufferMinutes: number; priceCents: number | null }[];
    locationIds: string[];
  }[];
};

export async function getClinic(slug: string): Promise<ClinicProfile | null> {
  const { database, user } = await dbUser();
  return database.withUser(user?.id ?? null, async (query) => {
    const orgs = await query.query<{
      id: string;
      name: string;
      slug: string;
      description: string;
      phone: string | null;
      email: string | null;
      cancellation_hours: number;
      status: string;
      logo_mime: string | null;
    }>(
      `select id, name, slug, description, phone, email, cancellation_hours, status, logo_mime
       from organizations where slug = $1`,
      [slug],
    );
    const org = orgs.rows[0];
    if (!org) return null;
    const locations = await query.query<ClinicProfile["locations"][number] & { timezone: string }>(
      `select id, name, address, city, department, timezone, phone
       from clinic_locations where organization_id = $1 and active order by name`,
      [org.id],
    );
    const professionals = await query.query<{
      id: string;
      full_name: string;
      bio: string;
      license_number: string | null;
    }>(
      `select id, full_name, bio, license_number from professionals
       where organization_id = $1 and active order by full_name`,
      [org.id],
    );
    const result: ClinicProfile = {
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      phone: org.phone,
      email: org.email,
      cancellationHours: org.cancellation_hours,
      status: org.status,
      logoMime: org.logo_mime,
      locations: locations.rows,
      professionals: [],
    };
    for (const professional of professionals.rows) {
      const specialties = await query.query<{ name: string }>(
        `select s.name from professional_specialties ps join specialties s on s.id = ps.specialty_id
         where ps.professional_id = $1 order by s.name`,
        [professional.id],
      );
      const services = await query.query<{
        id: string;
        name: string;
        duration_minutes: number;
        buffer_minutes: number;
        price_cents: number | null;
      }>(
        `select s.id, s.name, s.duration_minutes, s.buffer_minutes, s.price_cents
         from professional_services ps join services s on s.id = ps.service_id
         where ps.professional_id = $1 and s.active order by s.name`,
        [professional.id],
      );
      const places = await query.query<{ location_id: string }>(
        `select distinct location_id from recurring_availability where professional_id = $1 order by location_id`,
        [professional.id],
      );
      result.professionals.push({
        id: professional.id,
        fullName: professional.full_name,
        bio: professional.bio,
        licenseNumber: professional.license_number,
        specialties: specialties.rows.map((row) => row.name),
        services: services.rows.map((row) => ({
          id: row.id,
          name: row.name,
          durationMinutes: Number(row.duration_minutes),
          bufferMinutes: Number(row.buffer_minutes),
          priceCents: row.price_cents == null ? null : Number(row.price_cents),
        })),
        locationIds: places.rows.map((row) => row.location_id),
      });
    }
    return result;
  });
}

export async function requireClinic(slug: string): Promise<ClinicProfile> {
  const clinic = await getClinic(slug);
  if (!clinic || clinic.status !== "active") notFound();
  return clinic;
}

export function requireMembership(user: SessionUser | null, slug: string) {
  if (!user) return null;
  return user.memberships.find((membership) => membership.slug === slug) ?? null;
}

export async function orgTimezone(organizationId: string, userId: string): Promise<string> {
  const database = await getDatabase();
  const rows = await database.withUser(userId, (query) =>
    query.query<{ timezone: string }>(
      `select timezone from clinic_locations where organization_id = $1 and active order by created_at limit 1`,
      [organizationId],
    ),
  );
  return rows.rows[0]?.timezone ?? "America/Montevideo";
}

export function periodBounds(timeZone: string, now = new Date()) {
  const today = dayKey(now, timeZone);
  const weekday = weekdayOf(today, timeZone);
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const weekStart = shiftDate(today, mondayOffset, timeZone);
  const weekEnd = shiftDate(weekStart, 7, timeZone);
  const dayEnd = shiftDate(today, 1, timeZone);
  return {
    today,
    weekStart,
    dayStartAt: fromZonedTime(`${today}T00:00:00`, timeZone).toISOString(),
    dayEndAt: fromZonedTime(`${dayEnd}T00:00:00`, timeZone).toISOString(),
    weekStartAt: fromZonedTime(`${weekStart}T00:00:00`, timeZone).toISOString(),
    weekEndAt: fromZonedTime(`${weekEnd}T00:00:00`, timeZone).toISOString(),
  };
}
