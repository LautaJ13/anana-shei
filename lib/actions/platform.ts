"use server";

import { redirect } from "next/navigation";
import { getDatabase } from "@/lib/db";
import { mapDbError } from "@/lib/errors";
import { getCurrentUser } from "@/lib/session";
import { specialtySchema } from "@/lib/validators";

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user || user.platformRole !== "superadmin") return null;
  return user;
}

export async function setOrgStatusAction(formData: FormData): Promise<void> {
  const user = await requireSuperadmin();
  if (!user) redirect("/ingresar?next=/plataforma");
  const database = await getDatabase();
  try {
    await database.withUser(user.id, (query) =>
      query.query(`select set_organization_status($1::uuid, $2)`, [
        String(formData.get("id") ?? ""),
        String(formData.get("status") ?? ""),
      ]),
    );
  } catch (error) {
    redirect(`/plataforma?aviso=${encodeURIComponent(mapDbError(error))}`);
  }
  redirect("/plataforma");
}

export async function addSpecialtyAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = specialtySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá la especialidad." };
  const user = await requireSuperadmin();
  if (!user) return { ok: false, error: "No tenés permiso para hacer eso." };
  const database = await getDatabase();
  try {
    await database.withUser(user.id, (query) =>
      query.query(`select add_specialty($1, $2)`, [parsed.data.name, parsed.data.slug]),
    );
  } catch (error) {
    return { ok: false, error: mapDbError(error) };
  }
  return { ok: true };
}
