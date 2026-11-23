import Link from "next/link";
import { CalendarClock, MapPin, Search, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { one } from "@/lib/http";
import { listCities, listSpecialties, searchClinics } from "@/lib/queries";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = one(params.q);
  const specialty = one(params.especialidad);
  const city = one(params.ciudad);
  const [specialties, cities, clinics] = await Promise.all([
    listSpecialties(),
    listCities(),
    searchClinics({ q, specialty, city }),
  ]);
  const filtering = Boolean(q || specialty || city);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <section className="rounded-3xl bg-navy px-5 py-8 text-white sm:px-8 sm:py-12">
        <p className="text-sm font-semibold text-teal">Consultorios en Uruguay</p>
        <h1 className="mt-2 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Encontrá un turno con claridad.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
          Buscá un consultorio o una especialidad, mirá solo los horarios que están libres y reservá en cuatro pasos.
        </p>
        <form className="mt-8 grid gap-3 rounded-2xl bg-white p-3 text-navy sm:grid-cols-[1.4fr_1fr_1fr_auto]" action="/" method="get">
          <label className="sr-only" htmlFor="q">Qué estás buscando</label>
          <Input id="q" name="q" defaultValue={q} placeholder="Especialidad, profesional o consultorio" />
          <label className="sr-only" htmlFor="especialidad">Especialidad</label>
          <select id="especialidad" name="especialidad" defaultValue={specialty} className="h-11 rounded-xl border border-line bg-white px-3">
            <option value="">Todas las especialidades</option>
            {specialties.rows.map((item) => (
              <option key={item.id} value={item.slug}>{item.name}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="ciudad">Ubicación</label>
          <Input id="ciudad" name="ciudad" defaultValue={city} placeholder="Barrio o departamento" list="ciudades" />
          <datalist id="ciudades">
            {cities.map((item) => <option key={item} value={item} />)}
          </datalist>
          <Button type="submit">Buscar</Button>
        </form>
      </section>

      <section className="mt-8" aria-label="Especialidades disponibles">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {specialties.rows.map((item) => (
            <Link
              key={item.id}
              href={`/?especialidad=${item.slug}`}
              className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${specialty === item.slug ? "bg-teal text-navy" : "bg-white text-navy"}`}
            >
              {item.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8" aria-live="polite">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold text-navy">{filtering ? "Resultados" : "Consultorios"}</h2>
          {filtering ? <Link className="text-sm font-semibold text-navy underline" href="/">Limpiar búsqueda</Link> : null}
        </div>
        {clinics.length === 0 ? (
          <EmptyState
            title="No encontramos consultorios para esa búsqueda"
            body="Probá con otra especialidad o sacá el filtro de ubicación. Las especialidades salen del catálogo, así que una disciplina nueva puede existir aunque todavía no tenga consultorios."
            action={<Button asChild variant="outline"><Link href="/">Ver todos</Link></Button>}
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-3">
            {clinics.map((clinic) => (
              <li key={clinic.id}>
                <article className="flex h-full flex-col rounded-2xl border border-line bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-navy">{clinic.name}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{clinic.description}</p>
                  <p className="mt-4 text-sm font-medium text-navy">{clinic.specialties || "Especialidades a confirmar"}</p>
                  <p className="mt-1 text-sm text-muted">{clinic.place}</p>
                  <Link className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-navy px-4 text-sm font-semibold text-white" href={`/consultorios/${clinic.slug}`}>
                    Ver consultorio
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        {[
          { icon: Search, title: "Buscá", body: "Por especialidad, nombre o barrio." },
          { icon: CalendarClock, title: "Elegí un horario libre", body: "El sistema no ofrece turnos ocupados, en descanso o fuera de la jornada." },
          { icon: ShieldCheck, title: "Confirmá", body: "Recibís un comprobante con fecha, profesional, servicio y dirección." },
        ].map((item) => (
          <article key={item.title} className="rounded-2xl bg-white p-5">
            <item.icon className="text-ok" aria-hidden="true" />
            <h2 className="mt-3 font-semibold text-navy">{item.title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{item.body}</p>
          </article>
        ))}
      </section>
      <p className="mt-6 flex items-center gap-2 text-sm text-muted"><MapPin className="h-4 w-4" aria-hidden="true" /> Pensado primero para Uruguay.</p>
    </div>
  );
}
