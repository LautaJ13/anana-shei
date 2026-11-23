import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  const database = await getDatabase();
  const appointments = await database.withUser(user.id, (query) =>
    query.query(
      `select a.id, a.starts_at, a.ends_at, a.status, a.created_at, o.name as organization,
              pr.full_name as professional, s.name as service, l.address, l.city, l.timezone
       from appointments a
       join organizations o on o.id = a.organization_id
       join professionals pr on pr.id = a.professional_id
       join services s on s.id = a.service_id
       join clinic_locations l on l.id = a.location_id
       where a.patient_id = $1
       order by a.starts_at`,
      [user.id],
    ),
  );
  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    profile: { fullName: user.fullName, email: user.email, phone: user.phone, birthDate: user.birthDate },
    appointments: appointments.rows,
  });
}
