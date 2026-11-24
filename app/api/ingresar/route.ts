import { NextResponse } from "next/server";
import { authenticate, createSession } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { one, safeNext } from "@/lib/http";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { loginSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function redirectTo(path: string, token?: string, secure = false) {
  const response = new NextResponse(null, { status: 303, headers: { Location: path } });
  if (token) response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(secure));
  return response;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const nextPath = safeNext(one(String(form.get("next") ?? "")));
  const email = String(form.get("email") ?? "").trim();
  const back = (code: string) => {
    const params = new URLSearchParams({ error: code, next: nextPath });
    if (email) params.set("correo", email.slice(0, 160));
    return redirectTo(`/ingresar?${params.toString()}`);
  };
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "same-site" && site !== "none") return back("otra");
  const parsed = loginSchema.safeParse({ email, password: String(form.get("password") ?? "") });
  if (!parsed.success) return back(parsed.error.issues[0]?.path[0] === "email" ? "correo" : "datos");
  try {
    const database = await getDatabase();
    const user = await authenticate(database, parsed.data);
    const token = await createSession(database, user.id);
    const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const secure = forwarded ? forwarded === "https" : new URL(request.url).protocol === "https:" || process.env.NODE_ENV === "production";
    return redirectTo(nextPath, token, secure);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("rate_limited")) return back("limite");
    if (message.includes("demo_disabled")) return back("demo");
    if (message.includes("invalid_credentials")) return back("credenciales");
    console.error(error);
    return back("otra");
  }
}
