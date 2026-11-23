"use server";

import { redirect } from "next/navigation";
import { authenticate, consumePasswordReset, issuePasswordReset, registerAccount } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { deliverPasswordReset, isEmailConfigured } from "@/lib/email";
import { mapDbError } from "@/lib/errors";
import { appOrigin, clientIp, safeNext } from "@/lib/http";
import { endSession, startSession } from "@/lib/session";
import { loginSchema, registerSchema, resetPasswordSchema, resetRequestSchema } from "@/lib/validators";

export type AuthState = { ok: true; notice?: string } | { ok: false; error: string };

export async function loginAction(input: unknown, nextPath: string): Promise<AuthState> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  if (parsed.data.companyFax) return { ok: false, error: "No pudimos procesar el formulario." };
  try {
    const database = await getDatabase();
    const user = await authenticate(database, { ...parsed.data, ip: await clientIp() });
    await startSession(user.id);
  } catch (error) {
    return { ok: false, error: mapDbError(error) };
  }
  redirect(safeNext(nextPath));
}

export async function registerAction(input: unknown, nextPath: string): Promise<AuthState> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  if (parsed.data.companyFax) return { ok: false, error: "No pudimos procesar el formulario." };
  try {
    const database = await getDatabase();
    const ip = await clientIp();
    await database.withService((query) =>
      query.query(`select consume_rate_limit($1, 5, interval '1 hour')`, [`register:${ip}`]),
    );
    const id = await registerAccount(database, parsed.data);
    await startSession(id);
  } catch (error) {
    return { ok: false, error: mapDbError(error) };
  }
  redirect(safeNext(nextPath));
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/");
}

export async function requestResetAction(input: unknown): Promise<AuthState> {
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá el correo." };
  if (parsed.data.companyFax) return { ok: false, error: "No pudimos procesar el formulario." };
  const database = await getDatabase();
  try {
    const ip = await clientIp();
    await database.withService((query) =>
      query.query(`select consume_rate_limit($1, 5, interval '1 hour')`, [`reset:${ip}`]),
    );
  } catch (error) {
    return { ok: false, error: mapDbError(error) };
  }
  if (!isEmailConfigured()) {
    return {
      ok: true,
      notice: "El correo no está configurado. No se envió un email y no se generó un enlace de recuperación.",
    };
  }
  const token = await issuePasswordReset(database, parsed.data.email);
  if (!token) {
    return { ok: true, notice: "Si existe una cuenta con ese correo, enviamos las instrucciones." };
  }
  const link = `${await appOrigin()}/restablecer?token=${encodeURIComponent(token)}`;
  const status = await deliverPasswordReset(database, parsed.data.email, link);
  if (status === "sent") {
    return { ok: true, notice: "Si existe una cuenta con ese correo, enviamos las instrucciones." };
  }
  return { ok: true, notice: "No pudimos enviar el correo. La recuperación no se completó." };
}

export async function resetPasswordAction(input: unknown): Promise<AuthState> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá la contraseña." };
  const database = await getDatabase();
  const ok = await consumePasswordReset(database, parsed.data.token, parsed.data.password);
  if (!ok) return { ok: false, error: "El enlace no es válido o ya venció. Pedí uno nuevo." };
  redirect("/ingresar?aviso=clave");
}
