import { getDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { asDate, formatTime, zonedDateTime } from "./time";

export type Slot = {
  start: string;
  end: string;
  label: string;
  state: "free" | "busy";
};

type Interval = { startMinute: number; endMinute: number };
type Range = { startsAt: Date; endsAt: Date };
type Busy = { startsAt: Date; endsAt: Date; bufferMinutes: number };

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function weekdayOf(dateISO: string, timeZone: string): number {
  return getDay(toZonedTime(fromZonedTime(`${dateISO}T12:00:00`, timeZone), timeZone));
}

export function generateSlots(input: {
  date: string;
  timeZone: string;
  durationMinutes: number;
  bufferMinutes: number;
  intervals: Interval[];
  blocks: Range[];
  busy: Busy[];
  now?: Date;
}): Slot[] {
  const now = input.now ?? new Date();
  const horizonEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const step = input.durationMinutes + input.bufferMinutes;
  const slots = new Map<number, Slot>();

  const push = (start: Date) => {
    const end = new Date(start.getTime() + input.durationMinutes * 60_000);
    if (start <= now || start > horizonEnd) return;
    const blocked = input.blocks.some((block) => overlaps(start, end, block.startsAt, block.endsAt));
    if (blocked) return;
    const slotUntil = new Date(end.getTime() + input.bufferMinutes * 60_000);
    const busy = input.busy.some((item) =>
      overlaps(start, slotUntil, item.startsAt, new Date(item.endsAt.getTime() + item.bufferMinutes * 60_000)),
    );
    slots.set(start.getTime(), {
      start: start.toISOString(),
      end: end.toISOString(),
      label: formatTime(start, input.timeZone),
      state: busy ? "busy" : "free",
    });
  };

  for (const interval of input.intervals) {
    for (let minute = interval.startMinute; minute + input.durationMinutes <= interval.endMinute; minute += step) {
      push(zonedDateTime(input.date, minute, input.timeZone));
    }
  }

  return [...slots.values()].sort((a, b) => a.start.localeCompare(b.start));
}

export function slotsFromExtra(input: {
  date: string;
  timeZone: string;
  durationMinutes: number;
  bufferMinutes: number;
  extras: Range[];
  blocks: Range[];
  busy: Busy[];
  now?: Date;
}): Slot[] {
  const intervals: Interval[] = [];
  const stepMs = (input.durationMinutes + input.bufferMinutes) * 60_000;
  for (const extra of input.extras) {
    for (let cursor = extra.startsAt.getTime(); cursor + input.durationMinutes * 60_000 <= extra.endsAt.getTime(); cursor += stepMs) {
      const start = new Date(cursor);
      if (formatTime(start, input.timeZone).length === 5 && start.toISOString()) {
        const localDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: input.timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(start);
        if (localDate !== input.date) continue;
        const parts = new Intl.DateTimeFormat("en-GB", {
          timeZone: input.timeZone,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).formatToParts(start);
        const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
        const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
        intervals.push({ startMinute: hour * 60 + minute, endMinute: hour * 60 + minute + input.durationMinutes });
      }
    }
  }
  return generateSlots({ ...input, intervals });
}

export function mergeSlots(groups: Slot[][]): Slot[] {
  const merged = new Map<string, Slot>();
  for (const slot of groups.flat()) {
    const current = merged.get(slot.start);
    if (!current || (current.state === "free" && slot.state === "busy")) merged.set(slot.start, slot);
  }
  return [...merged.values()].sort((a, b) => a.start.localeCompare(b.start));
}

export { asDate };
