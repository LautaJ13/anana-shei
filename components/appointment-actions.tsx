import Link from "next/link";
import { cancelAction, transitionAction } from "@/lib/actions/booking";

export function AppointmentActions({
  id,
  status,
  startsAt,
  returnTo,
  rescheduleHref,
}: {
  id: string;
  status: string;
  startsAt: Date | string;
  returnTo: string;
  rescheduleHref?: string;
}) {
  const started = new Date(startsAt).getTime() <= Date.now();
  const open = status === "pending" || status === "confirmed";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {status === "pending" ? (
        <form action={transitionAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="confirmed" />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button className="h-9 rounded-xl bg-teal px-3 text-sm font-semibold text-navy" type="submit">Confirmar</button>
        </form>
      ) : null}
      {status === "confirmed" && started ? (
        <>
          <form action={transitionAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="completed" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button className="h-9 rounded-xl bg-navy px-3 text-sm font-semibold text-white" type="submit">Completada</button>
          </form>
          <form action={transitionAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="no_show" />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button className="h-9 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-navy" type="submit">Ausente</button>
          </form>
        </>
      ) : null}
      {rescheduleHref && open ? <Link className="text-sm font-semibold text-navy underline" href={rescheduleHref}>Reprogramar</Link> : null}
      {open ? (
        <form action={cancelAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="confirm" required /> Confirmo la cancelación</label>
          <button className="h-9 rounded-xl bg-danger px-3 text-sm font-semibold text-white" type="submit">Cancelar</button>
        </form>
      ) : null}
    </div>
  );
}
