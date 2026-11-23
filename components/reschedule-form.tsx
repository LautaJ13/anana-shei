import { rescheduleAction } from "@/lib/actions/booking";
import { formatDay, formatTime } from "@/lib/time";

export function RescheduleForm({
  appointmentId,
  returnTo,
  timeZone,
  slots,
}: {
  appointmentId: string;
  returnTo: string;
  timeZone: string;
  slots: { start: string; state: string }[];
}) {
  const free = slots.filter((slot) => slot.state === "free");
  if (free.length === 0) return <p className="text-sm text-muted">No hay horarios libres en los próximos días.</p>;
  return (
    <form action={rescheduleAction} className="space-y-3">
      <input type="hidden" name="id" value={appointmentId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-navy">Elegí el nuevo horario</legend>
        {free.map((slot) => (
          <label key={slot.start} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 text-sm">
            <input type="radio" name="startsAt" value={slot.start} required />
            {formatDay(slot.start, timeZone)} · {formatTime(slot.start, timeZone)}
          </label>
        ))}
      </fieldset>
      <button className="h-11 rounded-xl bg-navy px-4 text-sm font-semibold text-white" type="submit">Reprogramar</button>
    </form>
  );
}
