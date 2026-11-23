import Link from "next/link";
import { LoginForm } from "@/components/auth-forms";
import { one, safeNext } from "@/lib/http";

export const metadata = { title: "Ingresar" };

const demos = [
  ["Paciente", "camila.rodriguez@demo.alba.uy"],
  ["Administración, Clínica del Prado", "martin.pereyra@demo.alba.uy"],
  ["Profesional sin editar agenda", "ana.ferreira@demo.alba.uy"],
  ["Recepción", "julia.nunez@demo.alba.uy"],
  ["Administración, Mente Clara", "elena.rios@demo.alba.uy"],
  ["Profesional con dos sedes", "sofia.pereira@demo.alba.uy"],
  ["Administración, Sonrisa Viva", "andres.vidal@demo.alba.uy"],
  ["Plataforma", "plataforma@demo.alba.uy"],
];

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
        <h2 className="text-lg font-semibold">Cuentas de demostración</h2>
        <p className="mt-2 text-sm leading-6 text-slate-200">La contraseña de todas es Alba-Demo-2026. Son datos ficticios y se pueden desactivar.</p>
        <ul className="mt-4 space-y-2 text-sm">
          {demos.map(([label, email]) => (
            <li key={email}><span className="text-teal">{label}</span><br />{email}</li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
