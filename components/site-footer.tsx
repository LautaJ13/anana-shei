import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-muted md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="font-semibold text-navy">Alba</p>
          <p className="mt-2 max-w-xl leading-6">
            Reservá consultas en consultorios de Uruguay. Alba guarda solo los datos necesarios para el turno: no almacena historias clínicas, diagnósticos ni recetas. Los horarios se muestran en la zona del consultorio, inicialmente America/Montevideo.
          </p>
        </div>
        <nav className="flex flex-col gap-2 md:items-end" aria-label="Información">
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/terminos">Condiciones de uso</Link>
          <Link href="/alta">Registrar un consultorio</Link>
        </nav>
      </div>
    </footer>
  );
}
