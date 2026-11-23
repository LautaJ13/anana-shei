import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { createSession, destroySession, readSession, type SessionUser } from "./auth";
import { getDatabase } from "./db";

const COOKIE = "alba_session";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  };
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const database = await getDatabase();
  return readSession(database, jar.get(COOKIE)?.value);
});

export async function startSession(userId: string): Promise<void> {
  const database = await getDatabase();
  const token = await createSession(database, userId);
  const jar = await cookies();
  jar.set(COOKIE, token, cookieOptions());
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const database = await getDatabase();
    await destroySession(database, token);
  }
  jar.delete(COOKIE);
}
