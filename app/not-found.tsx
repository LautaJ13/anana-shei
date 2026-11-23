import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold text-navy">No encontramos esta página</h1>
      <p className="mt-3 text-muted">El consultorio puede no estar publicado o el enlace ya no existe.</p>
      <Link className="mt-6 inline-flex h-11 items-center rounded-xl bg-navy px-4 font-semibold text-white" href="/">Volver al inicio</Link>
    </div>
  );
}
