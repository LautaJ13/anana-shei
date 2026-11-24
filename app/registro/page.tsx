import Link from "next/link";
import { RegisterForm } from "@/components/auth-forms";
import { one, safeNext } from "@/lib/http";

export const metadata = { title: "Crear cuenta" };

const ERROR_TEXT: Record<string, string> = {
  nombre: "Ingresá tu nombre y apellido.",
  correo: "Ingresá un correo válido, con @ y un dominio.",
  clave: "La contraseña tiene que tener al menos 8 caracteres.",
  telefono: "El teléfono es demasiado largo.",
  datos: "Revisá los datos e intentá de nuevo.",
  limite: "Hubo demasiados intentos. Esperá un rato y probá de nuevo.",
  otra: "No pudimos crear la cuenta. Si ya te registraste, ingresá con tu clave.",
};

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const nextPath = safeNext(one(params.next));
  const error = ERROR_TEXT[one(params.error)] ?? "";
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-navy">Creá tu cuenta</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Pedimos nombre, correo y, si querés, un teléfono. No hace falta historia clínica para reservar.</p>
        <div className="mt-6">
          <RegisterForm
            nextPath={nextPath}
            error={error || undefined}
            defaults={{
              fullName: one(params.nombre).slice(0, 120),
              email: one(params.correo).slice(0, 160),
              phone: one(params.telefono).slice(0, 30),
            }}
          />
        </div>
        <p className="mt-4 text-sm">¿Ya tenés cuenta? <Link className="font-semibold text-navy underline" href={`/ingresar?next=${encodeURIComponent(nextPath)}`}>Ingresar</Link></p>
      </section>
    </div>
  );
}
