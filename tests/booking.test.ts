import assert from "node:assert/strict";
import test from "node:test";
import { authenticate, registerAccount } from "../lib/auth.ts";
import { bookAppointment, cancelAppointment, rescheduleAppointment } from "../lib/booking.ts";
import { createMemoryDatabase, type AppDatabase } from "../lib/db.ts";
import { errorText } from "../lib/errors.ts";
import { verifyPassword } from "../lib/password.ts";
import { scheduleForDates } from "../lib/schedule.ts";
import { formatTime } from "../lib/time.ts";

const DEMO_PASSWORD = "Alba-Demo-2026";
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

    const stored = await db.withService((query) =>
      query.query<{ password_hash: string }>("select password_hash from profiles where id = $1", [camila]),
    );
    assert.equal(await verifyPassword(DEMO_PASSWORD, stored.rows[0].password_hash), true);
    const session = await authenticate(db, {
      email: "camila.rodriguez@demo.alba.uy",
      password: DEMO_PASSWORD,
      ip: "test",
    });
    assert.equal(session.fullName, "Camila Rodríguez");

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
    const loggedIn = await authenticate(db, { email: "nueva.paciente@example.com", password: "clave-segura-1", ip: "test-2" });
    assert.equal(loggedIn.id, created);
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
