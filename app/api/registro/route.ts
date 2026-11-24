import { NextResponse } from "next/server";
import { createSession, registerOrResume } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { one, safeNext } from "@/lib/http";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { registerSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function redirectTo(path: string, token?: string, secure = false) {
  const response = new NextResponse(null, { status: 303, headers: { Location: path } });
  if (token) response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(secure));
  return response;
}

function failed(nextPath: string, code: string, fields: { nombre: string; correo: string; telefono: string }) {
  const params = new URLSearchParams({ error: code, next: nextPath });
  if (fields.nombre) params.set("nombre", fields.nombre.slice(0, 120));
  if (fields.correo) params.set("correo", fields.correo.slice(0, 160));
  if (fields.telefono) params.set("telefono", fields.telefono.slice(0, 30));
  return redirectTo(`/registro?${params.toString()}`);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const nextPath = safeNext(one(String(form.get("next") ?? "")));
  const fields = {
    nombre: String(form.get("fullName") ?? "").trim(),
    correo: String(form.get("email") ?? "").trim(),
    telefono: String(form.get("phone") ?? "").trim(),
  };
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return failed(nextPath, "otra", fields);
  }
  const parsed = registerSchema.safeParse({
    fullName: fields.nombre,
    email: fields.correo,
    phone: fields.telefono,
    password: String(form.get("password") ?? ""),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const code = field === "email" ? "correo" : field === "password" ? "clave" : field === "fullName" ? "nombre" : field === "phone" ? "telefono" : "datos";
    return failed(nextPath, code, fields);
  }
  try {
    const database = await getDatabase();
    const result = await registerOrResume(database, parsed.data);
    if (!result) return failed(nextPath, "otra", fields);
    const token = await createSession(database, result.id);
    const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const secure = forwarded ? forwarded === "https" : new URL(request.url).protocol === "https:" || process.env.NODE_ENV === "production";
    return redirectTo(nextPath, token, secure);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("rate_limited")) return failed(nextPath, "limite", fields);
    console.error(error);
    return failed(nextPath, "otra", fields);
  }
}
