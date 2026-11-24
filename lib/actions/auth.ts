"use server";

import { redirect } from "next/navigation";
import { authenticate, consumePasswordReset, issuePasswordReset, registerAccount } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { deliverPasswordReset, isEmailConfigured } from "@/lib/email";
import { mapDbError } from "@/lib/errors";
import { appOrigin, safeNext } from "@/lib/http";
import { endSession, startSession } from "@/lib/session";
import { loginSchema, registerSchema, resetPasswordSchema, resetRequestSchema } from "@/lib/validators";

export type AuthState = { ok: true; notice?: string; next?: string } | { ok: false; error: string };

export async function loginAction(input: unknown, nextPath: string): Promise<AuthState> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  try {
    const database = await getDatabase();
    const user = await authenticate(database, { email: parsed.data.email, password: parsed.data.password });
    await startSession(user.id);
  } catch (error) {
    return { ok: false, error: mapDbError(error) };
  }
  return { ok: true, next: safeNext(nextPath) };
}

export async function registerAction(input: unknown, nextPath: string): Promise<AuthState> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
  try {
    const database = await getDatabase();
    const email = parsed.data.email.trim().toLowerCase();
    await database.withService((query) =>
      query.query(`select consume_rate_limit($1, 20, interval '1 hour')`, [`register-email:${email}`]),
    );
    await database.withService((query) =>
      query.query(`select consume_rate_limit('register-global', 200, interval '1 hour')`),
    );
    const id = await registerAccount(database, parsed.data);
    if (!id) {
      return { ok: false, error: "No pudimos crear la cuenta. Si ya te registraste, ingresá con tu clave." };
    }
    await startSession(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("email_taken")) {
      return { ok: false, error: "No pudimos crear la cuenta. Si ya te registraste, ingresá con tu clave." };
    }
    return { ok: false, error: mapDbError(error) };
  }
  return { ok: true, next: safeNext(nextPath) };
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/");
}

export async function requestResetAction(input: unknown): Promise<AuthState> {
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá el correo." };
  const database = await getDatabase();
  try {
    const email = parsed.data.email.trim().toLowerCase();
    await database.withService((query) =>
      query.query(`select consume_rate_limit($1, 5, interval '1 hour')`, [`reset-email:${email}`]),
    );
    await database.withService((query) =>
      query.query(`select consume_rate_limit('reset-global', 40, interval '1 hour')`),
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
  const origin = await appOrigin();
  if (!origin) {
    return { ok: true, notice: "No se generó un enlace de recuperación." };
  }
  const token = await issuePasswordReset(database, parsed.data.email);
  if (!token) {
    return { ok: true, notice: "Si existe una cuenta con ese correo, enviamos las instrucciones." };
  }
  const link = `${origin}/restablecer?token=${encodeURIComponent(token)}`;
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
  return { ok: true, next: "/ingresar?aviso=clave" };
}
