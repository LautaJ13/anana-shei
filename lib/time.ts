import { addDays } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const DEFAULT_TIME_ZONE = "America/Montevideo";

export function asDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

export function zonedDateTime(dateISO: string, minute: number, timeZone: string): Date {
  const hours = Math.floor(minute / 60);
  const mins = minute % 60;
  const stamp = `${dateISO}T${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
  return fromZonedTime(stamp, timeZone);
}

export function formatTime(value: Date | string, timeZone: string): string {
  return formatInTimeZone(asDate(value), timeZone, "HH:mm");
}

export function formatDay(value: Date | string, timeZone: string): string {
  const label = formatInTimeZone(asDate(value), timeZone, "EEEE d 'de' MMMM", { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatDateTime(value: Date | string, timeZone: string): string {
  const label = formatInTimeZone(asDate(value), timeZone, "EEEE d 'de' MMMM 'de' yyyy '·' HH:mm", { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function dayKey(value: Date | string, timeZone: string): string {
  return formatInTimeZone(asDate(value), timeZone, "yyyy-MM-dd");
}

export function shiftDate(dateISO: string, days: number, timeZone: string): string {
  return formatInTimeZone(addDays(fromZonedTime(`${dateISO}T12:00:00`, timeZone), days), timeZone, "yyyy-MM-dd");
}

export function dateRange(startISO: string, days: number, timeZone: string): string[] {
  return Array.from({ length: days }, (_, index) => shiftDate(startISO, index, timeZone));
}

export function formatPrice(cents: number | null, currency = "UYU"): string | null {
  if (cents == null) return null;
  return new Intl.NumberFormat("es-UY", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
}
