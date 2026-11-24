import type { AppDatabase } from "./db";
import { appOrigin } from "./http";
import { newToken, sha256 } from "./password";
import { formatDateTime } from "./time";

export type EmailStatus = "sent" | "failed" | "skipped_unconfigured" | "pending";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char] ?? char;
  });
}

type NotificationRow = {
  id: string;
  kind: string;
  status: EmailStatus;
  to_email: string;
  organization_id: string | null;
  user_id: string | null;
  subject: string;
  payload: {
    startsAt?: string;
    timezone?: string;
    professionalName?: string;
    serviceName?: string;
    organizationName?: string;
    locationName?: string;
    address?: string;
    city?: string;
    patientName?: string;
    status?: string;
  };
};

export function emailStatusMessage(status: string | null | undefined): string {
  if (status === "sent") return "Te enviamos la confirmación por correo.";
  if (status === "failed") return "La reserva quedó registrada, pero el correo no pudo enviarse.";
  if (status === "skipped_unconfigured") {
    return "La reserva quedó registrada. El correo no se envió porque el proveedor de email no está configurado.";
  }
  return "La reserva quedó registrada. El aviso por correo sigue pendiente.";
}

function bookingHtml(event: NotificationRow): string {
  const payload = event.payload ?? {};
  const when = payload.startsAt
    ? formatDateTime(payload.startsAt, payload.timezone || "America/Montevideo")
    : "Horario a confirmar";
  const lines = [
    "Hola.",
    event.kind === "booking_cancelled"
      ? "Tu consulta fue cancelada."
      : event.kind === "booking_rescheduled"
        ? "Tu consulta fue reprogramada."
        : event.kind === "reminder_24h"
          ? "Te recordamos la consulta de mañana."
          : payload.status === "pending"
            ? "Recibimos tu solicitud. El consultorio todavía debe confirmarla."
            : "Tu consulta quedó reservada.",
    `${payload.serviceName ?? "Consulta"} con ${payload.professionalName ?? "el profesional"}.`,
    when,
    [payload.organizationName, payload.locationName, payload.address, payload.city].filter(Boolean).join(" · "),
  ];
  return `<div style="font-family:Inter,Arial,sans-serif;color:#334155;line-height:1.5">${lines
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("")}<p style="color:#64748b;font-size:14px">Alba no incluye información clínica en este mensaje.</p></div>`;
}

async function sendEmail(input: { to: string; subject: string; html: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isEmailConfigured()) return { ok: false, error: "unconfigured" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: text.slice(0, 400) };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 400) : "fetch_failed" };
  }
}

async function mark(database: AppDatabase, id: string, status: EmailStatus, error: string | null) {
  await database.withService((query) =>
    query.query(`update notification_events set status = $2, processed_at = now(), error = $3 where id = $1::uuid`, [
      id,
      status,
      error,
    ]),
  );
}

export async function deliverNotification(database: AppDatabase, id: string): Promise<EmailStatus> {
  const rows = await database.withService((query) =>
    query.query<NotificationRow>(
      `select id, kind, status, to_email, organization_id, user_id, subject, payload from notification_events where id = $1::uuid`,
      [id],
    ),
  );
  const event = rows.rows[0];
  if (!event) return "failed";
  if (event.status !== "pending") return event.status;
  const recipient = event.to_email.trim().toLowerCase();
  if (
    !recipient.includes("@") ||
    recipient.endsWith("@patients.alba.invalid") ||
    recipient.endsWith("@invalid.alba")
  ) {
    await mark(database, event.id, "failed", "not_deliverable");
    return "failed";
  }
  if (isEmailConfigured() && event.kind !== "password_reset" && event.user_id) {
    const owner = await database.withService((query) =>
      query.query<{ verified: boolean }>(
        `select email_verified_at is not null as verified from profiles where id = $1::uuid`,
        [event.user_id],
      ),
    );
    if (!owner.rows[0]?.verified) {
      await mark(database, event.id, "failed", "email_unverified");
      return "failed";
    }
  }
  if (event.organization_id) {
    const org = await database.withService((query) =>
      query.query<{ status: string }>(`select status from organizations where id = $1::uuid`, [event.organization_id]),
    );
    if (org.rows[0]?.status !== "active") {
      await mark(database, event.id, "failed", "organization_not_active");
      return "failed";
    }
  }
  try {
    await database.withService((query) =>
      query.query(`select consume_rate_limit('outbound-mail', 40, interval '1 hour')`),
    );
  } catch {
    await mark(database, event.id, "failed", "rate_limited");
    return "failed";
  }
  const result = await sendEmail({ to: recipient, subject: event.subject, html: bookingHtml(event) });
  if (result.ok) {
    await mark(database, id, "sent", null);
    return "sent";
  }
  if (result.error === "unconfigured") {
    await mark(database, id, "skipped_unconfigured", "Proveedor de correo no configurado");
    return "skipped_unconfigured";
  }
  await mark(database, id, "failed", result.error);
  return "failed";
}

export async function deliverPasswordReset(
  database: AppDatabase,
  email: string,
  link: string | null,
): Promise<EmailStatus> {
  const pending = await database.withService((query) =>
    query.query<{ id: string }>(
      `select id from notification_events
       where kind = 'password_reset' and lower(to_email) = lower($1) and status = 'pending'
       order by created_at desc limit 1`,
      [email],
    ),
  );
  const id = pending.rows[0]?.id;
  if (!id) return "failed";
  if (!link || !isEmailConfigured()) {
    await mark(database, id, "skipped_unconfigured", "Proveedor de correo no configurado");
    return "skipped_unconfigured";
  }
  try {
    await database.withService((query) =>
      query.query(`select consume_rate_limit('outbound-mail', 40, interval '1 hour')`),
    );
  } catch {
    await mark(database, id, "failed", "rate_limited");
    return "failed";
  }
  const result = await sendEmail({
    to: email,
    subject: "Recuperar acceso a Alba",
    html: `<div style="font-family:Inter,Arial,sans-serif;color:#334155"><p>Para elegir una nueva contraseña, abrí este enlace. Vence en 30 minutos.</p><p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p><p>Si no pediste este cambio, podés ignorar el mensaje.</p></div>`,
  });
  if (result.ok) {
    await mark(database, id, "sent", null);
    return "sent";
  }
  await mark(database, id, "failed", result.error);
  return "failed";
}

export async function requestEmailVerification(database: AppDatabase, userId: string, email: string): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  const origin = await appOrigin();
  if (!origin) return false;
  await database.withService((query) =>
    query.query(`select consume_rate_limit($1, 3, interval '1 hour')`, [`verify-email:${userId}`]),
  );
  await database.withService((query) =>
    query.query(`select consume_rate_limit('verify-email-global', 30, interval '1 hour')`),
  );
  await database.withService((query) =>
    query.query(`select consume_rate_limit('outbound-mail', 40, interval '1 hour')`),
  );
  const token = newToken();
  await database.withService((query) =>
    query.query(`select issue_email_verification($1::uuid, $2)`, [userId, sha256(token)]),
  );
  const link = `${origin}/verificar?token=${encodeURIComponent(token)}`;
  const result = await sendEmail({
    to: email,
    subject: "Confirmá tu correo en Alba",
    html: `<div style="font-family:Inter,Arial,sans-serif;color:#334155"><p>Para recibir los avisos de tus turnos, confirmá este correo.</p><p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p><p>Si no creaste una cuenta en Alba, podés ignorar el mensaje.</p></div>`,
  });
  return result.ok;
}
