import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { configuredOrigin, safeNext } from "./http-policy";

export { safeNext };

const RATE_COOKIE = "alba_rl";

export async function clientIp(): Promise<string> {
  // No usamos X-Forwarded-For ni X-Real-IP: quien llama puede inventarlos
  // y gastar el cupo de otra persona. La clave la emite el servidor.
  const jar = await cookies();
  const existing = jar.get(RATE_COOKIE)?.value ?? "";
  if (/^[a-f0-9]{32}$/.test(existing)) return existing;
  const created = randomBytes(16).toString("hex");
  jar.set(RATE_COOKIE, created, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return created;
}

export async function appOrigin(): Promise<string | null> {
  return configuredOrigin();
}

export function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
