import Link from "next/link";
import { fromZonedTime } from "date-fns-tz";
import { bookAction } from "@/lib/actions/booking";
import { getDatabase } from "@/lib/db";
import { one } from "@/lib/http";
import { requireClinic } from "@/lib/queries";
import { upcomingSchedule } from "@/lib/schedule";
import { getCurrentUser } from "@/lib/session";
import { formatDay, formatTime } from "@/lib/time";
import { dayKey } from "@/lib/time";

export const metadata = { title: "Reservar" };

const steps = ["Profesional y servicio", "Día y horario", "Tus datos", "Comprobante"];

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const clinic = await requireClinic(slug);
  const profesional = one(query.profesional);
  const servicio = one(query.servicio);
  const sede = one(query.sede);
  const fecha = one(query.fecha);
  const hora = one(query.hora);
  const aviso = one(query.aviso);
  const professional = clinic.professionals.find((item) => item.id === profesional);
  const service = professional?.services.find((item) => item.id === servicio);
  const location = clinic.locations.find((item) => item.id === sede);
  const user = await getCurrentUser();
  const ready = Boolean(professional && service && location);
  const step = !ready ? 1 : !fecha || !hora ? 2 : 3;

  const database = await getDatabase();
  const schedule = ready
    ? await upcomingSchedule(database, user?.id ?? null, {
        professionalId: professional!.id,
        serviceId: service!.id,
        locationId: location!.id,
        from: dayKey(new Date(), location!.timezone),
        days: 21,
      })
    : null;
  const selected = schedule?.days.find((day) => day.date === fecha)?.slots.find((slot) => slot.start === hora && slot.state === "free");
  const returnTo = `/consultorios/${slug}/reservar?profesional=${profesional}&servicio=${servicio}&sede=${sede}&fecha=${fecha}&hora=${encodeURIComponent(hora)}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm font-semibold text-ok">{clinic.name}</p>
      <h1 className="mt-1 text-3xl font-semibold text-navy">Reservar una consulta</h1>
      <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Pasos">
        {steps.map((label, index) => (
          <li key={label} className={`rounded-xl px-3 py-2 text-sm font-semibold ${index + 1 === step ? "bg-teal text-navy" : "bg-white text-muted"}`} aria-current={index + 1 === step ? "step" : undefined}>
            {index + 1}. {label}
          </li>
        ))}
      </ol>
      {aviso ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-danger" role="alert">{aviso}</p> : null}

      {step === 1 ? (
        <section className="mt-6 space-y-4">
          {clinic.professionals.map((item) => (
            <article key={item.id} className="rounded-2xl bg-white p-5">
              <h2 className="font-semibold text-navy">{item.fullName}</h2>
              <p className="text-sm text-muted">{item.specialties.join(" · ")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.services.map((option) =>
                  (item.locationIds.length ? item.locationIds : clinic.locations.map((place) => place.id)).map((locationId) => {
                    const place = clinic.locations.find((entry) => entry.id === locationId);
                    return (
                      <Link key={`${option.id}-${locationId}`} className="rounded-xl bg-navy px-3 py-2 text-sm font-semibold text-white" href={`/consultorios/${slug}/reservar?profesional=${item.id}&servicio=${option.id}&sede=${locationId}`}>
                        {option.name}{place ? ` · ${place.name}` : ""}
                      </Link>
                    );
                  }),
                )}
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {step === 2 && schedule ? (
        <section className="mt-6">
          <h2 className="text-xl font-semibold text-navy">{professional?.fullName} · {service?.name} · {location?.name}</h2>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {schedule.days.map((day) => {
              const free = day.slots.some((slot) => slot.state === "free");
              return (
                <Link
                  key={day.date}
                  href={`/consultorios/${slug}/reservar?profesional=${profesional}&servicio=${servicio}&sede=${sede}&fecha=${day.date}`}
                  className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold ${fecha === day.date ? "bg-navy text-white" : "bg-white text-navy"} ${free ? "" : "opacity-50"}`}
                  aria-disabled={!free}
                >
                  {formatDay(fromZonedTime(`${day.date}T12:00:00`, schedule.timeZone), schedule.timeZone)}
                </Link>
              );
            })}
          </div>
          {fecha ? (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(schedule.days.find((day) => day.date === fecha)?.slots ?? []).map((slot) =>
                slot.state === "free" ? (
                  <Link key={slot.start} className="rounded-xl bg-teal px-3 py-3 text-center text-sm font-semibold text-navy" href={`/consultorios/${slug}/reservar?profesional=${profesional}&servicio=${servicio}&sede=${sede}&fecha=${fecha}&hora=${encodeURIComponent(slot.start)}`}>
                    {formatTime(slot.start, schedule.timeZone)}
                  </Link>
                ) : (
                  <span key={slot.start} className="rounded-xl bg-slate-200 px-3 py-3 text-center text-sm text-slate-500" aria-disabled="true">
                    {formatTime(slot.start, schedule.timeZone)} ocupado
                  </span>
                ),
              )}
            </div>
          ) : <p className="mt-4 text-sm text-muted">Elegí un día para ver los horarios libres.</p>}
        </section>
      ) : null}

      {step === 3 && selected && schedule && professional && service && location ? (
        <section className="mt-6 rounded-2xl bg-white p-5">
          <h2 className="text-xl font-semibold text-navy">Confirmá tus datos</h2>
          <dl className="mt-4 grid gap-2 text-sm">
            <div><dt className="text-muted">Cuándo</dt><dd className="font-semibold text-navy">{formatDay(selected.start, schedule.timeZone)} · {formatTime(selected.start, schedule.timeZone)}</dd></div>
            <div><dt className="text-muted">Profesional</dt><dd>{professional.fullName}</dd></div>
            <div><dt className="text-muted">Servicio</dt><dd>{service.name}</dd></div>
            <div><dt className="text-muted">Dónde</dt><dd>{location.address}, {location.city}</dd></div>
          </dl>
          {user ? (
            <form className="mt-5 space-y-3" action={bookAction}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="professionalId" value={professional.id} />
              <input type="hidden" name="serviceId" value={service.id} />
              <input type="hidden" name="locationId" value={location.id} />
              <input type="hidden" name="startsAt" value={selected.start} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <div className="hidden" aria-hidden="true"><label>Fax<input name="companyFax" tabIndex={-1} autoComplete="off" /></label></div>
              <label className="block text-sm font-medium" htmlFor="note">Nota para la recepción, si hace falta</label>
              <textarea id="note" name="note" maxLength={280} className="min-h-24 w-full rounded-xl border border-line p-3" placeholder="Por ejemplo, un teléfono alternativo. No escribas diagnósticos." />
              <p className="text-sm text-muted">Reservás como {user.fullName}. Podés cancelar hasta {clinic.cancellationHours} horas antes.</p>
              <button className="h-12 w-full rounded-xl bg-navy font-semibold text-white" type="submit">Confirmar reserva</button>
            </form>
          ) : (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link className="inline-flex h-12 items-center justify-center rounded-xl bg-navy px-4 font-semibold text-white" href={`/ingresar?next=${encodeURIComponent(returnTo)}`}>Ingresar</Link>
              <Link className="inline-flex h-12 items-center justify-center rounded-xl bg-teal px-4 font-semibold text-navy" href={`/registro?next=${encodeURIComponent(returnTo)}`}>Crear cuenta</Link>
            </div>
          )}
        </section>
      ) : null}
      {step === 3 && !selected ? <p className="mt-6 text-sm text-danger" role="alert">Ese horario ya no está libre. Elegí otro.</p> : null}
    </div>
  );
}
