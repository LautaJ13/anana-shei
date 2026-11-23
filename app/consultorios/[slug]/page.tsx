import Link from "next/link";
import { requireClinic } from "@/lib/queries";
import { formatPrice } from "@/lib/time";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const clinic = await requireClinic((await params).slug);
  return { title: clinic.name, description: clinic.description };
}

export default async function ClinicPage({ params }: { params: Promise<{ slug: string }> }) {
  const clinic = await requireClinic((await params).slug);
  const specialties = [...new Set(clinic.professionals.flatMap((item) => item.specialties))];
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {clinic.logoMime ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/consultorios/${clinic.slug}/logo`} alt="" className="h-20 w-20 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-navy text-2xl font-semibold text-white" aria-hidden="true">
              {clinic.name.slice(0, 1)}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-semibold text-navy">{clinic.name}</h1>
            <p className="mt-3 max-w-3xl leading-7 text-muted">{clinic.description}</p>
            <p className="mt-3 text-sm font-medium text-navy">{specialties.join(" · ") || "Especialidades a confirmar"}</p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {clinic.locations.map((location) => (
          <article key={location.id} className="rounded-2xl bg-white p-5">
            <h2 className="font-semibold text-navy">{location.name}</h2>
            <p className="mt-2 text-sm leading-6">{location.address}</p>
            <p className="text-sm leading-6">{location.city}, {location.department}</p>
            {location.phone || clinic.phone ? <p className="mt-2 text-sm">Teléfono: {location.phone || clinic.phone}</p> : null}
          </article>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-semibold text-navy">Profesionales y servicios</h2>
        <ul className="mt-4 grid gap-4">
          {clinic.professionals.map((professional) => (
            <li key={professional.id} className="rounded-2xl border border-line bg-white p-5">
              <h3 className="text-lg font-semibold text-navy">{professional.fullName}</h3>
              <p className="mt-1 text-sm text-ok">{professional.specialties.join(" · ")}</p>
              {professional.bio ? <p className="mt-2 text-sm leading-6 text-muted">{professional.bio}</p> : null}
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {professional.services.map((service) => {
                  const placeIds = professional.locationIds.length ? professional.locationIds : clinic.locations.map((place) => place.id);
                  const price = formatPrice(service.priceCents);
                  return (
                    <li key={service.id} className="rounded-xl bg-background p-4">
                      <p className="font-semibold text-navy">{service.name}</p>
                      <p className="mt-1 text-sm text-muted">{service.durationMinutes} min{service.bufferMinutes ? ` y ${service.bufferMinutes} min de pausa` : ""}{price ? ` · ${price}` : ""}</p>
                      {placeIds.length ? (
                        <div className="mt-3 flex flex-col gap-2">
                          {placeIds.map((locationId) => {
                            const place = clinic.locations.find((entry) => entry.id === locationId);
                            return (
                              <Link key={locationId} className="inline-flex h-11 items-center justify-center rounded-xl bg-teal px-4 text-sm font-semibold text-navy" href={`/consultorios/${clinic.slug}/reservar?profesional=${professional.id}&servicio=${service.id}&sede=${locationId}`}>
                                Ver horarios{place ? ` en ${place.name}` : ""}
                              </Link>
                            );
                          })}
                        </div>
                      ) : <p className="mt-3 text-sm">Todavía no hay agenda publicada.</p>}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-6 text-sm text-muted">Podés cancelar hasta {clinic.cancellationHours} horas antes. Los horarios se muestran en la zona del consultorio.</p>
    </div>
  );
}
