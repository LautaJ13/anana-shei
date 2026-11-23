import Link from "next/link";
import { LoginForm } from "@/components/auth-forms";
import { one, safeNext } from "@/lib/http";

export const metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const nextPath = safeNext(one((await searchParams).next));
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-[1.1fr_.9fr]">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-navy">Ingresá a Alba</h1>
        <p className="mt-2 text-sm text-muted">Usá el correo con el que reservás o con el que te invitaron al consultorio.</p>
        <div className="mt-6"><LoginForm nextPath={nextPath} /></div>
        <p className="mt-4 text-sm"><Link className="font-semibold text-navy underline" href="/recuperar">Olvidé mi contraseña</Link></p>
        <p className="mt-2 text-sm">¿Todavía no tenés cuenta? <Link className="font-semibold text-navy underline" href={`/registro?next=${encodeURIComponent(nextPath)}`}>Crear cuenta</Link></p>
      </section>
      <aside className="rounded-3xl bg-navy p-6 text-white">
        <h2 className="text-lg font-semibold">Consultorios de ejemplo</h2>
        <p className="mt-2 text-sm leading-6 text-slate-200">Podés mirar Clínica del Prado, Mente Clara y Sonrisa Viva sin cuenta. Para reservar, creá la tuya. Las fichas de ejemplo no tienen una contraseña compartida.</p>
      </aside>
    </div>
  );
}
