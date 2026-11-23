import { fromZonedTime } from "date-fns-tz";
import type { AppDatabase } from "./db";
import { asDate, dateRange } from "./time";
import { generateSlots, mergeSlots, slotsFromExtra, weekdayOf, type Slot } from "./slots";

type ServiceRow = {
  duration_minutes: number;
  buffer_minutes: number;
  organization_id: string;
};

type IntervalRow = {
  weekday: number;
  start_minute: number;
  end_minute: number;
  effective_from: string | null;
  effective_until: string | null;
};

type ExceptionRow = {
  kind: "block" | "vacation" | "extra";
  starts_at: Date | string;
  ends_at: Date | string;
  location_id: string | null;
};

type BusyRow = { starts_at: Date | string; ends_at: Date | string; buffer_minutes: number };

export type DaySchedule = { date: string; slots: Slot[] };

export type Schedule = {
  timeZone: string;
  durationMinutes: number;
  bufferMinutes: number;
  days: DaySchedule[];
};

function bound(dateISO: string, timeZone: string): string {
  return fromZonedTime(`${dateISO}T00:00:00`, timeZone).toISOString();
}

export async function scheduleForDates(
  database: AppDatabase,
  userId: string | null,
  input: {
    professionalId: string;
    serviceId: string;
    locationId: string;
    dates: string[];
    now?: Date;
  },
): Promise<Schedule | null> {
  if (input.dates.length === 0) return null;
  return database.withUser(userId, async (db) => {
    const services = await db.query<ServiceRow>(
      `select s.duration_minutes, s.buffer_minutes, s.organization_id
       from services s
       join professional_services ps on ps.service_id = s.id and ps.professional_id = $2
       where s.id = $1 and s.active`,
      [input.serviceId, input.professionalId],
    );
    const service = services.rows[0];
    if (!service) return null;

    const locations = await db.query<{ timezone: string }>(
      `select timezone from clinic_locations where id = $1 and organization_id = $2 and active`,
      [input.locationId, service.organization_id],
    );
    const timeZone = locations.rows[0]?.timezone;
    if (!timeZone) return null;

    const start = bound(input.dates[0], timeZone);
    const end = bound(dateRange(input.dates[input.dates.length - 1], 2, timeZone)[1], timeZone);
    const intervals = await db.query<IntervalRow>(
      `select weekday, start_minute, end_minute, effective_from::text as effective_from, effective_until::text as effective_until
       from recurring_availability
       where professional_id = $1 and location_id = $2`,
      [input.professionalId, input.locationId],
    );
    const exceptions = await db.query<ExceptionRow>(
      `select kind, starts_at, ends_at, location_id
       from availability_exceptions
       where professional_id = $1 and starts_at < $3 and ends_at > $2`,
      [input.professionalId, start, end],
    );
    const busyRows = await db.query<BusyRow>(
      `select starts_at, ends_at, buffer_minutes from professional_busy_ranges($1, $2::timestamptz, $3::timestamptz)`,
      [input.professionalId, start, end],
    );
    const blocks = exceptions.rows
      .filter((item) => item.kind === "block" || item.kind === "vacation")
      .map((item) => ({ startsAt: asDate(item.starts_at), endsAt: asDate(item.ends_at) }));
    const extras = exceptions.rows
      .filter((item) => item.kind === "extra" && (item.location_id == null || item.location_id === input.locationId))
      .map((item) => ({ startsAt: asDate(item.starts_at), endsAt: asDate(item.ends_at) }));
    const busy = busyRows.rows.map((item) => ({
      startsAt: asDate(item.starts_at),
      endsAt: asDate(item.ends_at),
      bufferMinutes: Number(item.buffer_minutes),
    }));

    const days = input.dates.map((date) => {
      const weekday = weekdayOf(date, timeZone);
      const dayIntervals = intervals.rows.filter((interval) => {
        const fromOk = !interval.effective_from || interval.effective_from <= date;
        const untilOk = !interval.effective_until || interval.effective_until >= date;
        return Number(interval.weekday) === weekday && fromOk && untilOk;
      });
      const shared = {
        date,
        timeZone,
        durationMinutes: Number(service.duration_minutes),
        bufferMinutes: Number(service.buffer_minutes),
        blocks,
        busy,
        now: input.now,
      };
      return {
        date,
        slots: mergeSlots([
          generateSlots({
            ...shared,
            intervals: dayIntervals.map((interval) => ({
              startMinute: Number(interval.start_minute),
              endMinute: Number(interval.end_minute),
            })),
          }),
          slotsFromExtra({ ...shared, extras }),
        ]),
      };
    });

    return {
      timeZone,
      durationMinutes: Number(service.duration_minutes),
      bufferMinutes: Number(service.buffer_minutes),
      days,
    };
  });
}

export async function upcomingSchedule(
  database: AppDatabase,
  userId: string | null,
  input: { professionalId: string; serviceId: string; locationId: string; from: string; days?: number; now?: Date },
): Promise<Schedule | null> {
  const location = await database.withUser(userId, (db) =>
    db.query<{ timezone: string }>("select timezone from clinic_locations where id = $1", [input.locationId]),
  );
  const timeZone = location.rows[0]?.timezone ?? "America/Montevideo";
  const dates = dateRange(input.from, input.days ?? 21, timeZone);
  return scheduleForDates(database, userId, { ...input, dates });
}
