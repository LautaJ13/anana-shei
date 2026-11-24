import assert from "node:assert/strict";
import test from "node:test";
import { authenticate, registerAccount, registerOrResume } from "../lib/auth.ts";
import { hashPassword } from "../lib/password.ts";
import { bookAppointment, cancelAppointment, rescheduleAppointment } from "../lib/booking.ts";
import { createMemoryDatabase, type AppDatabase } from "../lib/db.ts";
import { errorText } from "../lib/errors.ts";
import { scheduleForDates } from "../lib/schedule.ts";
import { formatTime } from "../lib/time.ts";

const SOFIA = "30000000-0000-4000-8000-000000000004";
const SERVICE = "40000000-0000-4000-8000-000000000004";
const POCITOS = "11000000-0000-4000-8000-000000000002";
const MENTE = "10000000-0000-4000-8000-000000000002";
const PRADO = "10000000-0000-4000-8000-000000000001";

async function userId(db: AppDatabase, email: string): Promise<string> {
  const rows = await db.withService((query) =>
    query.query<{ id: string }>("select id from profiles where email = $1", [email]),
  );
  const id = rows.rows[0]?.id;
  if (!id) throw new Error(`missing ${email}`);
  return id;
}

test("reservas, concurrencia, aislamiento y zona horaria", async () => {
  const db = await createMemoryDatabase();
  try {
    const camila = await userId(db, "camila.rodriguez@demo.alba.uy");
    const lucas = await userId(db, "lucas.silva@demo.alba.uy");
    const martin = await userId(db, "martin.pereyra@demo.alba.uy");
    const ana = await userId(db, "ana.ferreira@demo.alba.uy");
    const sofia = await userId(db, "sofia.pereira@demo.alba.uy");
    const platform = await userId(db, "plataforma@demo.alba.uy");

    await assert.rejects(
      () => authenticate(db, { email: "camila.rodriguez@demo.alba.uy", password: "clave-que-no-existe" }),
      /invalid_credentials|demo_disabled/,
    );

    const seeded = await db.withService((query) =>
      query.query<{ starts_at: Date | string }>(
        `select starts_at from appointments
         where professional_id = $1 and patient_id = $2 and status = 'confirmed'`,
        [SOFIA, camila],
      ),
    );
    const occupied = new Date(seeded.rows[0].starts_at);
    assert.equal(formatTime(occupied, "America/Montevideo"), "09:00");
    assert.equal(occupied.toISOString().slice(11, 16), "12:00");

    const date = formatTime(occupied, "America/Montevideo") && occupied.toISOString();
    const localDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Montevideo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(occupied);

    const schedule = await scheduleForDates(db, null, {
      professionalId: SOFIA,
      serviceId: SERVICE,
      locationId: POCITOS,
      dates: [localDate],
    });
    assert.ok(schedule);
    const slots = schedule.days[0]?.slots ?? [];
    assert.deepEqual(
      slots.map((slot) => slot.label),
      ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"],
    );
    assert.equal(slots.find((slot) => slot.label === "09:00")?.state, "busy");
    assert.equal(slots.find((slot) => slot.label === "10:00")?.state, "free");
    assert.equal(slots.find((slot) => slot.label === "12:00")?.state, "busy");
    void date;

    const at = (label: string) => {
      const slot = slots.find((item) => item.label === label);
      if (!slot) throw new Error(`missing ${label}`);
      return slot.start;
    };

    await assert.rejects(() => bookOnline(db, camila, at("09:00")), /slot_unavailable/);
    const first = await bookOnline(db, camila, at("11:00"));
    await assert.rejects(() => bookOnline(db, lucas, at("11:00")), /slot_unavailable/);

    const parallel = await Promise.allSettled([
      bookOnline(db, camila, at("15:00")),
      bookOnline(db, lucas, at("15:00")),
    ]);
    assert.equal(parallel.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(parallel.filter((item) => item.status === "rejected").length, 1);

    await cancelAppointment(db, camila, first.appointmentId, "Cambio de planes");
    const reopened = await bookOnline(db, lucas, at("11:00"));

    await assert.rejects(() => rescheduleAppointment(db, lucas, reopened.appointmentId, at("09:00")), /slot_unavailable/);
    const still = await db.withService((query) =>
      query.query<{ starts_at: Date | string }>("select starts_at from appointments where id = $1", [reopened.appointmentId]),
    );
    assert.equal(formatTime(still.rows[0].starts_at, "America/Montevideo"), "11:00");
    await rescheduleAppointment(db, lucas, reopened.appointmentId, at("16:00"));
    const moved = await db.withService((query) =>
      query.query<{ starts_at: Date | string }>("select starts_at from appointments where id = $1", [reopened.appointmentId]),
    );
    assert.equal(formatTime(moved.rows[0].starts_at, "America/Montevideo"), "16:00");

    await assert.rejects(() => bookOnline(db, camila, at("11:00").replace(/:00\.000Z$/, ":30.000Z").replace("T14:", "T14:")), /slot_unavailable|not_available/);
    const misaligned = new Date(new Date(at("13:00")).getTime() + 30 * 60 * 1000).toISOString();
    await assert.rejects(() => bookOnline(db, camila, misaligned), /slot_unavailable/);

    const martinSeesMente = await db.withUser(martin, (query) =>
      query.query("select id from appointments where organization_id = $1", [MENTE]),
    );
    assert.equal(martinSeesMente.rows.length, 0);
    const camilaSeesLucas = await db.withUser(camila, (query) =>
      query.query("select id from appointments where patient_id = $1", [lucas]),
    );
    assert.equal(camilaSeesLucas.rows.length, 0);
    const platformSeesAppointments = await db.withUser(platform, (query) =>
      query.query("select id from appointments"),
    );
    assert.equal(platformSeesAppointments.rows.length, 0);
    const overview = await db.withUser(platform, (query) =>
      query.query<{ appointment_count: number }>("select appointment_count from platform_overview()"),
    );
    assert.ok(Number(overview.rows[0]?.appointment_count) > 0);
    await assert.rejects(
      () => db.withUser(camila, (query) => query.query("select appointment_count from platform_overview()")),
      /forbidden/,
    );

    await db.withUser(ana, (query) =>
      query.query(`update organization_members set role = 'org_admin' where user_id = $1::uuid`, [ana]),
    );
    const anaRole = await db.withService((query) =>
      query.query<{ role: string }>(
        "select role from organization_members where user_id = $1 and organization_id = $2",
        [ana, PRADO],
      ),
    );
    assert.equal(anaRole.rows[0]?.role, "professional");

    await assert.rejects(
      () =>
        db.withUser(ana, (query) =>
          query.query(
            `insert into availability_exceptions (professional_id, kind, starts_at, ends_at, note)
             values ($1::uuid, 'block', now() + interval '20 days', now() + interval '20 days 1 hour', 'Congreso')`,
            [SOFIA],
          ),
        ),
      /row-level security|forbidden|permission/,
    );
    await db.withUser(sofia, (query) =>
      query.query(
        `insert into availability_exceptions (professional_id, kind, starts_at, ends_at, note)
         values ('30000000-0000-4000-8000-000000000004'::uuid, 'block', now() + interval '21 days', now() + interval '21 days 1 hour', 'Congreso')`,
      ),
    );

    const created = await registerAccount(db, {
      email: "nueva.paciente@example.com",
      password: "clave-segura-1",
      fullName: "Nueva Paciente",
    });
    await assert.rejects(
      () => db.withUser(created, (query) => query.query(`update profiles set platform_role = 'superadmin' where id = $1::uuid`, [created])),
      /permission|forbidden/,
    );
    const role = await db.withService((query) =>
      query.query<{ platform_role: string }>("select platform_role from profiles where id = $1", [created]),
    );
    assert.equal(role.rows[0]?.platform_role, "user");
    const loggedIn = await authenticate(db, { email: "nueva.paciente@example.com", password: "clave-segura-1" });
    assert.equal(loggedIn.id, created);

    const outside = await db.withUser(martin, (query) =>
      query.query<{ find_or_create_patient: string }>(
        `select find_or_create_patient($1::uuid, $2, $3, $4) as find_or_create_patient`,
        [PRADO, "nueva.paciente@example.com", "Nombre Inventado", "099000000"],
      ),
    );
    const outsideId = outside.rows[0]?.find_or_create_patient;
    assert.ok(outsideId);
    assert.notEqual(outsideId, created);
    const untouched = await db.withService((query) =>
      query.query<{ full_name: string; email: string }>("select full_name, email from profiles where id = $1", [created]),
    );
    assert.equal(untouched.rows[0]?.full_name, "Nueva Paciente");
    assert.equal(untouched.rows[0]?.email, "nueva.paciente@example.com");
    const shell = await db.withService((query) =>
      query.query<{ email: string; contact_email: string }>(
        "select email, contact_email from profiles where id = $1",
        [outsideId],
      ),
    );
    assert.match(shell.rows[0]?.email ?? "", /@patients\.alba\.invalid$/);
    assert.equal(shell.rows[0]?.contact_email, "nueva.paciente@example.com");
    const duplicate = await registerAccount(db, {
      email: "nueva.paciente@example.com",
      password: "otra-clave-22",
      fullName: "Otra Persona",
    });
    assert.equal(duplicate, null);
    const stillOwner = await authenticate(db, {
      email: "nueva.paciente@example.com",
      password: "clave-segura-1",
    });
    assert.equal(stillOwner.id, created);
    const resumed = await registerOrResume(db, {
      email: "nueva.paciente@example.com",
      password: "clave-segura-1",
      fullName: "Nueva Paciente",
    });
    assert.equal(resumed, created);
    const rejected = await registerOrResume(db, {
      email: "nueva.paciente@example.com",
      password: "otra-clave-22",
      fullName: "Nueva Paciente",
    });
    assert.equal(rejected, null);
    await db.withUser(created, (query) =>
      query.query(`select update_own_profile($1, $2, $3, $4::date, $5)`, [
        "Nombre Editado",
        "editada@example.com",
        "099111222",
        "1990-05-02",
        null,
      ]),
    );
    const edited = await db.withService((query) =>
      query.query<{ full_name: string; email: string; phone: string; birth_date: string }>(
        `select full_name, email, phone, birth_date::text as birth_date from profiles where id = $1`,
        [created],
      ),
    );
    assert.equal(edited.rows[0]?.full_name, "Nombre Editado");
    assert.equal(edited.rows[0]?.email, "editada@example.com");
    assert.equal(edited.rows[0]?.phone, "099111222");
    assert.equal(edited.rows[0]?.birth_date, "1990-05-02");
    await assert.rejects(
      () =>
        db.withUser(created, (query) =>
          query.query(`select update_own_profile($1, $2, $3, $4::date, $5)`, [
            "Nombre Editado",
            "camila.rodriguez@demo.alba.uy",
            "099111222",
            "1990-05-02",
            null,
          ]),
        ),
      /email_taken/,
    );
    const nextHash = await hashPassword("clave-nueva-22");
    await db.withUser(created, (query) =>
      query.query(`select update_own_profile($1, $2, $3, $4::date, $5)`, [
        "Nombre Editado",
        "editada@example.com",
        "099111222",
        "1990-05-02",
        nextHash,
      ]),
    );
    const renamed = await authenticate(db, { email: "editada@example.com", password: "clave-nueva-22" });
    assert.equal(renamed.id, created);
    assert.equal(renamed.fullName, "Nombre Editado");
    const claimed = await registerAccount(db, {
      email: "telefono.nuevo@example.com",
      password: "clave-segura-1",
      fullName: "Teléfono Real",
    });
    assert.ok(claimed);
    const pending = await db.withUser(created, (query) =>
      query.query<{ create_organization: string }>(
        `select create_organization($1, $2, $3, $4, $5, $6, $7, $8) as create_organization`,
        ["Clínica Nueva", "clinica-nueva-test", "", "", "", "Una calle 1", "Montevideo", "Montevideo"],
      ),
    );
    await assert.rejects(
      () =>
        db.withUser(created, (query) =>
          query.query(`select find_or_create_patient($1::uuid, $2, $3, $4)`, [
            pending.rows[0]?.create_organization,
            "otra.persona@example.com",
            "Otra Persona",
            "099",
          ]),
        ),
      /forbidden/,
    );
    await assert.rejects(
      () =>
        db.withService((query) =>
          query.query(
            `update organization_members set professional_id = $1::uuid
             where user_id = $2::uuid and organization_id = $3::uuid`,
            [SOFIA, martin, PRADO],
          ),
        ),
      /cross_organization/,
    );
    const fresh = await db.withUser(martin, (query) =>
      query.query<{ find_or_create_patient: string }>(
        `select find_or_create_patient($1::uuid, $2, $3, $4) as find_or_create_patient`,
        [PRADO, "telefono.nuevo@example.com", "Teléfono Nuevo", "099111222"],
      ),
    );
    const newPatient = fresh.rows[0]?.find_or_create_patient;
    assert.ok(newPatient);
    assert.notEqual(newPatient, claimed);
    const orgId = pending.rows[0]?.create_organization;
    const location = await db.withUser(created, (query) =>
      query.query<{ id: string }>(`select id from clinic_locations where organization_id = $1::uuid limit 1`, [orgId]),
    );
    const professional = await db.withUser(created, (query) =>
      query.query<{ id: string }>(
        `insert into professionals (organization_id, full_name) values ($1::uuid, 'Dra Nueva') returning id`,
        [orgId],
      ),
    );
    const service = await db.withUser(created, (query) =>
      query.query<{ id: string }>(
        `insert into services (organization_id, name, duration_minutes, buffer_minutes)
         values ($1::uuid, 'Consulta', 30, 0) returning id`,
        [orgId],
      ),
    );
    await db.withUser(created, (query) =>
      query.query(`insert into professional_services (professional_id, service_id) values ($1::uuid, $2::uuid)`, [
        professional.rows[0]?.id,
        service.rows[0]?.id,
      ]),
    );
    await assert.rejects(
      () =>
        db.withUser(created, (query) =>
          query.query(
            `select appointment_id from book_appointment($1::uuid, $2::uuid, $3::uuid, now() + interval '10 days', $4::uuid, 'staff', null)`,
            [professional.rows[0]?.id, service.rows[0]?.id, location.rows[0]?.id, created],
          ),
        ),
      /not_available/,
    );
    const place = await db.withService((query) =>
      query.query<{ professional_id: string; location_id: string; service_id: string }>(
        `select p.id as professional_id, l.id as location_id, s.id as service_id
         from professionals p
         join clinic_locations l on l.organization_id = p.organization_id
         join services s on s.organization_id = p.organization_id
         where p.organization_id = $1::uuid
         limit 1`,
        [PRADO],
      ),
    );
    const spot = place.rows[0];
    assert.ok(spot);
    await assert.rejects(
      () =>
        db.withService((query) =>
          query.query(
            `insert into appointments (
               organization_id, location_id, professional_id, patient_id, service_id,
               starts_at, ends_at, buffer_minutes, status, source
             ) values (
               $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
               now() + interval '500 days', now() + interval '500 days 30 minutes', 0, 'confirmed', 'staff'
             )`,
            [PRADO, spot.location_id, spot.professional_id, created, spot.service_id],
          ),
        ),
      /patient_outside_clinic/,
    );
    await db.withService((query) =>
      query.query(
        `insert into appointments (
           organization_id, location_id, professional_id, patient_id, service_id,
           starts_at, ends_at, buffer_minutes, status, source
         ) values (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
           now() + interval '501 days', now() + interval '501 days 30 minutes', 0, 'confirmed', 'staff'
         )`,
        [PRADO, spot.location_id, spot.professional_id, newPatient, spot.service_id],
      ),
    );
  } finally {
    await db.close();
  }
});

function bookOnline(db: AppDatabase, userId: string, startsAt: string) {
  return bookAppointment(db, userId, {
    professionalId: SOFIA,
    serviceId: SERVICE,
    locationId: POCITOS,
    startsAt,
    source: "online",
  });
}

test("el mensaje de error no filtra SQL cuando el código es conocido", () => {
  assert.match(errorText(new Error("slot_unavailable")), /slot_unavailable/);
});
