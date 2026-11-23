import assert from "node:assert/strict";
import test from "node:test";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { generateSlots } from "../lib/slots.ts";

test("un psicólogo de 09:00 a 17:00 genera turnos de 50 minutos con pausa de 10", () => {
  const slots = generateSlots({
    date: "2026-11-23",
    timeZone: "America/Montevideo",
    durationMinutes: 50,
    bufferMinutes: 10,
    intervals: [{ startMinute: 9 * 60, endMinute: 17 * 60 }],
    blocks: [],
    busy: [],
    now: new Date("2026-11-23T00:00:00.000Z"),
  });

  assert.deepEqual(
    slots.map((slot) => slot.label),
    ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"],
  );
  assert.equal(slots[0]?.start, "2026-11-23T12:00:00.000Z");
  assert.equal(formatInTimeZone(fromZonedTime("2026-11-23T09:00:00", "America/Montevideo"), "America/Montevideo", "HH:mm"), "09:00");
});

test("un horario mal alineado no sale de la grilla y un bloqueo lo saca", () => {
  const slots = generateSlots({
    date: "2026-11-24",
    timeZone: "America/Montevideo",
    durationMinutes: 50,
    bufferMinutes: 10,
    intervals: [{ startMinute: 9 * 60, endMinute: 13 * 60 }],
    blocks: [
      {
        startsAt: fromZonedTime("2026-11-24T11:00:00", "America/Montevideo"),
        endsAt: fromZonedTime("2026-11-24T13:00:00", "America/Montevideo"),
      },
    ],
    busy: [],
    now: new Date("2026-11-24T00:00:00.000Z"),
  });
  assert.deepEqual(
    slots.map((slot) => slot.label),
    ["09:00", "10:00"],
  );
});
