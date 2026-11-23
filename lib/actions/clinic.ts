"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import { bookAppointment } from "@/lib/booking";
import { getDatabase } from "@/lib/db";
import { deliverNotification, isEmailConfigured } from "@/lib/email";
import { mapDbError } from "@/lib/errors";
import { appOrigin, safeNext } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { newToken, sha256 } from "@/lib/password";
import { minutesFromTime } from "@/lib/utils";
import {
  availabilitySchema,
  exceptionSchema,
  inviteSchema,
  organizationSchema,
  professionalSchema,
  serviceSchema,
  staffBookingSchema,
} from "@/lib/validators";

export type FormState = { ok: true; message?: string; link?: string | null } | { ok: false; error: string };

async function adminOrg(slug: string) {
  const user = await getCurrentUser();
  const membership = user?.memberships.find((item) => item.slug === slug && item.role === "org_admin");
  if (!user || !membership) return null;
  return { user, membership };
}

function pesosToCents(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const amount = Number(value.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

export async function createOrganizationAction(input: unknown): Promise<FormState> {
  const parsed = organizationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Necesitás iniciar sesión para continuar." };
  const database = await getDatabase();
  try {
    await database.withUser(user.id, async (query) => {
      await query.query(`select create_organization($1, $2, $3, $4, $5, $6, $7, $8)`, [
        parsed.data.name,
        parsed.data.slug,
        parsed.data.description ?? "",
        parsed.data.phone ?? "",
        parsed.data.email ?? "",
        parsed.data.address,
        parsed.data.city,
        parsed.data.department,
      ]);
      await query.query(
        `update organizations set cancellation_hours = $2, require_confirmation = $3 where slug = $1`,
        [parsed.data.slug, parsed.data.cancellationHours, Boolean(parsed.data.requireConfirmation)],
      );
    });
  } catch (error) {
    return { ok: false, error: mapDbError(error) };
  }
  redirect(`/c/${parsed.data.slug}/panel`);
}

export async function updateOrganizationAction(slug: string, input: unknown): Promise<FormState> {
  const parsed = organizationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  const access = await adminOrg(slug);
  if (!access) return { ok: false, error: "No tenés permiso para hacer eso." };
  const database = await getDatabase();
  try {
    await database.withUser(access.user.id, async (query) => {
      await query.query(
        `update organizations
         set name = $2, slug = $3, description = $4, phone = $5, email = $6,
             cancellation_hours = $7, require_confirmation = $8
         where id = $1::uuid`,
        [
          access.membership.organizationId,
          parsed.data.name,
          parsed.data.slug,
          parsed.data.description ?? "",
          parsed.data.phone || null,
          parsed.data.email || null,
          parsed.data.cancellationHours,
          Boolean(parsed.data.requireConfirmation),
        ],
      );
      await query.query(
        `update clinic_locations
         set address = $2, city = $3, department = $4
         where id = (
           select id from clinic_locations where organization_id = $1::uuid and active order by created_at limit 1
         )`,
        [access.membership.organizationId, parsed.data.address, parsed.data.city, parsed.data.department],
      );
    });
  } catch (error) {
    return { ok: false, error: mapDbError(error) };
  }
  revalidatePath(`/consultorios/${parsed.data.slug}`);
  redirect(`/c/${parsed.data.slug}/panel/configuracion`);
}

export async function uploadLogoAction(slug: string, formData: FormData): Promise<void> {
  const access = await adminOrg(slug);
  const returnTo = `/c/${slug}/panel/configuracion`;
  if (!access) redirect(`/ingresar?next=${encodeURIComponent(returnTo)}`);
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) redirect(`${returnTo}?aviso=${encodeURIComponent("Elegí una imagen.")}`);
  if (file.size > 200_000) redirect(`${returnTo}?aviso=${encodeURIComponent("La imagen debe pesar menos de 200 KB.")}`);
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    redirect(`${returnTo}?aviso=${encodeURIComponent("Usá una imagen PNG, JPG o WebP.")}`);
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const database = await getDatabase();
  try {
    await database.withUser(access.user.id, (query) =>
      query.query(`update organizations set logo_bytes = $2, logo_mime = $3 where id = $1::uuid`, [
        access.membership.organizationId,
        bytes,
        file.type,
      ]),
    );
  } catch (error) {
    redirect(`${returnTo}?aviso=${encodeURIComponent(mapDbError(error))}`);
  }
  redirect(returnTo);
}

export async function saveServiceAction(slug: string, input: unknown): Promise<FormState> {
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá el servicio." };
  const access = await adminOrg(slug);
  if (!access) return { ok: false, error: "No tenés permiso para hacer eso." };
  const price = pesosToCents(parsed.data.pricePesos);
  if (parsed.data.pricePesos?.trim() && price == null) return { ok: false, error: "Revisá el precio." };
  const database = await getDatabase();
  try {
    await database.withUser(access.user.id, (query) => {
      if (parsed.data.id) {
        return query.query(
          `update services
           set name = $3, description = $4, duration_minutes = $5, buffer_minutes = $6, price_cents = $7, active = $8
           where id = $2::uuid and organization_id = $1::uuid`,
          [
            access.membership.organizationId,
            parsed.data.id,
            parsed.data.name,
            parsed.data.description ?? "",
            parsed.data.durationMinutes,
            parsed.data.bufferMinutes,
            price,
            parsed.data.active !== false,
          ],
        );
      }
      return query.query(
        `insert into services (organization_id, name, description, duration_minutes, buffer_minutes, price_cents, active)
         values ($1::uuid, $2, $3, $4, $5, $6, $7)`,
        [
          access.membership.organizationId,
          parsed.data.name,
          parsed.data.description ?? "",
          parsed.data.durationMinutes,
          parsed.data.bufferMinutes,
          price,
          parsed.data.active !== false,
        ],
      );
    });
  } catch (error) {
    return { ok: false, error: mapDbError(error) };
  }
  revalidatePath(`/consultorios/${slug}`);
  return { ok: true, message: "Servicio guardado." };
}

export async function saveProfessionalAction(slug: string, input: unknown): Promise<FormState> {
  const parsed = professionalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá el profesional." };
  const access = await adminOrg(slug);
  if (!access) return { ok: false, error: "No tenés permiso para hacer eso." };
  const database = await getDatabase();
  try {
    await database.withUser(access.user.id, async (query) => {
      let id = parsed.data.id || "";
      if (id) {
        await query.query(
          `update professionals
           set full_name = $3, license_number = $4, bio = $5, active = $6, can_manage_availability = $7
           where id = $2::uuid and organization_id = $1::uuid`,
          [
            access.membership.organizationId,
            id,
            parsed.data.fullName,
            parsed.data.licenseNumber || null,
            parsed.data.bio ?? "",
            parsed.data.active !== false,
            Boolean(parsed.data.canManageAvailability),
          ],
        );
        await query.query(`delete from professional_specialties where professional_id = $1::uuid`, [id]);
        await query.query(`delete from professional_services where professional_id = $1::uuid`, [id]);
      } else {
        const inserted = await query.query<{ id: string }>(
          `insert into professionals (organization_id, full_name, license_number, bio, active, can_manage_availability)
           values ($1::uuid, $2, $3, $4, $5, $6) returning id`,
          [
            access.membership.organizationId,
            parsed.data.fullName,
            parsed.data.licenseNumber || null,
            parsed.data.bio ?? "",
            parsed.data.active !== false,
            Boolean(parsed.data.canManageAvailability),
          ],
        );
        id = inserted.rows[0]?.id ?? "";
      }
      for (const specialtyId of parsed.data.specialtyIds) {
        await query.query(
          `insert into professional_specialties (professional_id, specialty_id) values ($1::uuid, $2::uuid)`,
          [id, specialtyId],
        );
      }
      for (const serviceId of parsed.data.serviceIds) {
        await query.query(
          `insert into professional_services (professional_id, service_id) values ($1::uuid, $2::uuid)`,
          [id, serviceId],
        );
      }
    });
  } catch (error) {
    return { ok: false, error: mapDbError(error) };
  }
  revalidatePath(`/consultorios/${slug}`);
  return { ok: true, message: "Profesional guardado." };
}

export async function addAvailabilityAction(slug: string, input: unknown): Promise<FormState> {
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá el horario." };
  const start = minutesFromTime(parsed.data.start);
  const end = minutesFromTime(parsed.data.end);
  if (start == null || end == null || end <= start) return { ok: false, error: "La hora de fin tiene que ser posterior al inicio." };
  const user = await getCurrentUser();
  if (!user?.memberships.some((item) => item.slug === slug)) return { ok: false, error: "No tenés permiso para hacer eso." };
  const database = await getDatabase();
  try {
    await database.withUser(user.id, (query) =>
      query.query(
        `insert into recurring_availability (professional_id, location_id, weekday, start_minute, end_minute)
         values ($1::uuid, $2::uuid, $3, $4, $5)`,
        [parsed.data.professionalId, parsed.data.locationId, parsed.data.weekday, start, end],
      ),
    );
  } catch (error) {
    return { ok: false, error: mapDbError(error) };
  }
  revalidatePath(`/consultorios/${slug}`);
  return { ok: true, message: "Horario agregado." };
}

export async function deleteAvailabilityAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect(`/ingresar?next=/c/${slug}/panel/horarios`);
  const database = await getDatabase();
  await database.withUser(user.id, (query) =>
    query.query(`delete from recurring_availability where id = $1::uuid`, [String(formData.get("id") ?? "")]),
  );
  revalidatePath(`/consultorios/${slug}`);
  redirect(safeNext(String(formData.get("returnTo") ?? ""), `/c/${slug}/panel/horarios`));
}

export async function addExceptionAction(slug: string, input: unknown): Promise<FormState> {
  const parsed = exceptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá el bloqueo." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Necesitás iniciar sesión para continuar." };
  const database = await getDatabase();
  const zone = await database.withUser(user.id, (query) =>
    query.query<{ timezone: string }>(
      `select timezone from clinic_locations where organization_id = (
         select organization_id from professionals where id = $1::uuid
       ) and active order by created_at limit 1`,
      [parsed.data.professionalId],
    ),
  );
  const timeZone = zone.rows[0]?.timezone ?? "America/Montevideo";
  const asLocal = (value: string) => (value.length === 16 ? `${value}:00` : value);
  const starts = fromZonedTime(asLocal(parsed.data.startsAt), timeZone);
  const ends = fromZonedTime(asLocal(parsed.data.endsAt), timeZone);
  if (!(starts < ends)) return { ok: false, error: "La hora de fin tiene que ser posterior al inicio." };
  try {
    await database.withUser(user.id, (query) =>
      query.query(
        `insert into availability_exceptions (professional_id, location_id, kind, starts_at, ends_at, note)
         values ($1::uuid, $2::uuid, $3, $4, $5, $6)`,
        [
          parsed.data.professionalId,
          parsed.data.locationId || null,
          parsed.data.kind,
          starts.toISOString(),
          ends.toISOString(),
          parsed.data.note ?? "",
        ],
      ),
    );
  } catch (error) {
    return { ok: false, error: mapDbError(error) };
  }
  return { ok: true, message: "Excepción guardada." };
}

export async function deleteExceptionAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");
  const database = await getDatabase();
  await database.withUser(user.id, (query) =>
    query.query(`delete from availability_exceptions where id = $1::uuid`, [String(formData.get("id") ?? "")]),
  );
  redirect(safeNext(String(formData.get("returnTo") ?? ""), `/c/${slug}/panel/horarios`));
}

export async function inviteAction(slug: string, input: unknown): Promise<FormState> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá la invitación." };
  const access = await adminOrg(slug);
  if (!access) return { ok: false, error: "No tenés permiso para hacer eso." };
  const token = newToken();
  const database = await getDatabase();
  try {
    await database.withUser(access.user.id, (query) =>
      query.query(
        `insert into organization_invitations (organization_id, email, role, professional_id, token_hash, expires_at, created_by)
         values ($1::uuid, $2, $3, $4::uuid, $5, now() + interval '7 days', $6::uuid)`,
        [
          access.membership.organizationId,
          parsed.data.email,
          parsed.data.role,
          parsed.data.professionalId || null,
          sha256(token),
          access.user.id,
        ],
      ),
    );
  } catch (error) {
    return { ok: false, error: mapDbError(error) };
  }
  const origin = await appOrigin();
  const link = origin ? `${origin}/invitacion/${token}` : `/invitacion/${token}`;
  return {
    ok: true,
    link,
    message: isEmailConfigured()
      ? "Invitación creada. El envío por correo de invitaciones queda pendiente de un proveedor configurado: copiá el enlace."
      : "El correo no está configurado. Copiá este enlace para compartirlo. No se envió un email.",
  };
}

export async function memberStatusAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const access = await adminOrg(slug);
  const returnTo = `/c/${slug}/panel/equipo`;
  if (!access) redirect(`/ingresar?next=${encodeURIComponent(returnTo)}`);
  const database = await getDatabase();
  try {
    await database.withUser(access.user.id, (query) =>
      query.query(
        `update organization_members set status = $3 where id = $2::uuid and organization_id = $1::uuid`,
        [access.membership.organizationId, String(formData.get("id") ?? ""), String(formData.get("status") ?? "disabled")],
      ),
    );
  } catch (error) {
    redirect(`${returnTo}?aviso=${encodeURIComponent(mapDbError(error))}`);
  }
  redirect(returnTo);
}

export async function acceptInviteAction(token: string): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Necesitás iniciar sesión con el correo invitado." };
  const database = await getDatabase();
  let slug = "";
  try {
    const rows = await database.withUser(user.id, (query) =>
      query.query<{ accept_invitation: string }>(`select accept_invitation($1) as accept_invitation`, [sha256(token)]),
    );
    const orgId = rows.rows[0]?.accept_invitation;
    const org = await database.withUser(user.id, (query) =>
      query.query<{ slug: string }>(`select slug from organizations where id = $1::uuid`, [orgId]),
    );
    slug = org.rows[0]?.slug ?? "";
  } catch (error) {
    return { ok: false, error: mapDbError(error) };
  }
  redirect(`/c/${slug}/panel`);
}

export async function staffBookAction(slug: string, input: unknown): Promise<FormState> {
  const parsed = staffBookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá la reserva." };
  if (parsed.data.companyFax) return { ok: false, error: "No pudimos procesar el formulario." };
  const user = await getCurrentUser();
  const membership = user?.memberships.find((item) => item.slug === slug);
  if (!user || !membership || !["org_admin", "receptionist"].includes(membership.role)) {
    return { ok: false, error: "No tenés permiso para hacer eso." };
  }
  const database = await getDatabase();
  try {
    const patient = await database.withUser(user.id, (query) =>
      query.query<{ find_or_create_patient: string }>(
        `select find_or_create_patient($1::uuid, $2, $3, $4) as find_or_create_patient`,
        [membership.organizationId, parsed.data.email, parsed.data.fullName, parsed.data.phone ?? ""],
      ),
    );
    const result = await bookAppointment(database, user.id, {
      professionalId: parsed.data.professionalId,
      serviceId: parsed.data.serviceId,
      locationId: parsed.data.locationId,
      startsAt: parsed.data.startsAt,
      patientId: patient.rows[0]?.find_or_create_patient,
      source: "staff",
      note: parsed.data.note,
    });
    await deliverNotification(database, result.notificationId);
  } catch (error) {
    return { ok: false, error: mapDbError(error) };
  }
  redirect(`/c/${slug}/panel/reservas`);
}

export async function updateProfileAction(input: unknown): Promise<FormState> {
  const { profileSchema } = await import("@/lib/validators");
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá tus datos." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Necesitás iniciar sesión para continuar." };
  const database = await getDatabase();
  try {
    await database.withUser(user.id, (query) =>
      query.query(`update profiles set full_name = $2, phone = $3, birth_date = $4 where id = $1::uuid`, [
        user.id,
        parsed.data.fullName,
        parsed.data.phone || null,
        parsed.data.birthDate || null,
      ]),
    );
  } catch (error) {
    return { ok: false, error: mapDbError(error) };
  }
  return { ok: true, message: "Datos actualizados." };
}

export async function deleteAccountAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar");
  if (String(formData.get("confirm") ?? "") !== "ELIMINAR") {
    redirect("/cuenta/perfil?aviso=" + encodeURIComponent("Escribí ELIMINAR para confirmar."));
  }
  const database = await getDatabase();
  try {
    await database.withUser(user.id, (query) => query.query(`select delete_own_account()`));
  } catch (error) {
    redirect("/cuenta/perfil?aviso=" + encodeURIComponent(mapDbError(error)));
  }
  const { endSession } = await import("@/lib/session");
  await endSession();
  redirect("/?aviso=" + encodeURIComponent("Tu cuenta fue eliminada y los datos personales quedaron anonimizados."));
}
