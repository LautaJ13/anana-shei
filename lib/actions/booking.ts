"use server";

import { redirect } from "next/navigation";
import { bookAppointment, cancelAppointment, rescheduleAppointment, transitionAppointment } from "@/lib/booking";
import { getDatabase } from "@/lib/db";
import { deliverNotification } from "@/lib/email";
import { mapDbError } from "@/lib/errors";
import { safeNext } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";

function back(path: string, message: string): never {
  const join = path.includes("?") ? "&" : "?";
  redirect(`${path}${join}aviso=${encodeURIComponent(message)}`);
}

export async function bookAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const returnTo = safeNext(String(formData.get("returnTo") ?? ""), `/consultorios/${slug}/reservar`);
  const user = await getCurrentUser();
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(returnTo)}`);
  if (String(formData.get("companyFax") ?? "")) back(returnTo, "No pudimos procesar el formulario.");
  const note = String(formData.get("note") ?? "").trim();
  let appointmentId = "";
  try {
    const database = await getDatabase();
    const result = await bookAppointment(database, user.id, {
      professionalId: String(formData.get("professionalId") ?? ""),
      serviceId: String(formData.get("serviceId") ?? ""),
      locationId: String(formData.get("locationId") ?? ""),
      startsAt: String(formData.get("startsAt") ?? ""),
      source: "online",
      note,
    });
    await deliverNotification(database, result.notificationId);
    appointmentId = result.appointmentId;
  } catch (error) {
    back(returnTo, mapDbError(error));
  }
  redirect(`/consultorios/${slug}/reservar/comprobante/${appointmentId}`);
}

export async function cancelAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const returnTo = safeNext(String(formData.get("returnTo") ?? ""), "/cuenta");
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(returnTo)}`);
  if (formData.get("confirm") !== "on") back(returnTo, "Confirmá la cancelación para continuar.");
  try {
    const database = await getDatabase();
    const notificationId = await cancelAppointment(
      database,
      user.id,
      String(formData.get("id") ?? ""),
      String(formData.get("reason") ?? ""),
    );
    if (notificationId) await deliverNotification(database, notificationId);
  } catch (error) {
    back(returnTo, mapDbError(error));
  }
  redirect(returnTo);
}

export async function rescheduleAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const returnTo = safeNext(String(formData.get("returnTo") ?? ""), "/cuenta");
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(returnTo)}`);
  try {
    const database = await getDatabase();
    const notificationId = await rescheduleAppointment(
      database,
      user.id,
      String(formData.get("id") ?? ""),
      String(formData.get("startsAt") ?? ""),
    );
    if (notificationId) await deliverNotification(database, notificationId);
  } catch (error) {
    back(returnTo, mapDbError(error));
  }
  redirect(returnTo);
}

export async function transitionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const returnTo = safeNext(String(formData.get("returnTo") ?? ""), "/");
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(returnTo)}`);
  const status = String(formData.get("status") ?? "");
  if (status !== "confirmed" && status !== "completed" && status !== "no_show") {
    back(returnTo, "Esa acción no está disponible.");
  }
  try {
    const database = await getDatabase();
    await transitionAppointment(database, user.id, String(formData.get("id") ?? ""), status);
    if (status === "confirmed") {
      const rows = await database.withUser(user.id, (query) =>
        query.query<{ id: string }>(
          `select id from notification_events where appointment_id = $1::uuid and kind = 'booking_confirmed' and status = 'pending' order by created_at desc limit 1`,
          [String(formData.get("id") ?? "")],
        ),
      );
      if (rows.rows[0]) await deliverNotification(database, rows.rows[0].id);
    }
  } catch (error) {
    back(returnTo, mapDbError(error));
  }
  redirect(returnTo);
}
