import type { AppDatabase } from "./db";
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
    payload.patientName ? `Hola ${payload.patientName}.` : "Hola.",
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
      `select id, kind, status, to_email, subject, payload from notification_events where id = $1::uuid`,
      [id],
    ),
  );
  const event = rows.rows[0];
  if (!event) return "failed";
  if (event.status !== "pending") return event.status;
  const result = await sendEmail({ to: event.to_email, subject: event.subject, html: bookingHtml(event) });
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
