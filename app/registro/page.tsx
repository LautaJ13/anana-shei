import Link from "next/link";
import { RegisterForm } from "@/components/auth-forms";
import { one, safeNext } from "@/lib/http";

export const metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const nextPath = safeNext(one((await searchParams).next));
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-navy">Creá tu cuenta</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Pedimos nombre, correo y, si querés, un teléfono. No hace falta historia clínica para reservar.</p>
        <div className="mt-6"><RegisterForm nextPath={nextPath} /></div>
        <p className="mt-4 text-sm">¿Ya tenés cuenta? <Link className="font-semibold text-navy underline" href={`/ingresar?next=${encodeURIComponent(nextPath)}`}>Ingresar</Link></p>
      </section>
    </div>
  );
}
