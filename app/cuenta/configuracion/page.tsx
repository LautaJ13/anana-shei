import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteAccountAction } from "@/lib/actions/clinic";
import { one } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Configuración" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar?next=/cuenta/configuracion");
  const aviso = one((await searchParams).aviso);
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-3xl font-semibold text-navy">Configuración</h1>
      <p className="mt-2 text-sm leading-6 text-muted">Tu cuenta es {user.email}. Desde acá bajás una copia de tus datos o eliminás la cuenta.</p>
      {aviso ? <p className="mt-4 text-sm text-danger" role="alert">{aviso}</p> : null}
      <section className="mt-6 rounded-2xl bg-white p-5">
        <h2 className="font-semibold text-navy">Tus datos</h2>
        <p className="mt-2 text-sm leading-6 text-muted">La copia incluye nombre, correo, teléfono, fecha de nacimiento y tus turnos.</p>
        <a className="mt-3 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-navy" href="/api/cuenta/datos">Descargar mis datos</a>
        <p className="mt-4 text-sm">
          <Link className="font-semibold text-navy underline" href="/cuenta/perfil">Editar datos personales</Link>
        </p>
      </section>
      <section className="mt-6 rounded-2xl bg-white p-5">
        <h2 className="font-semibold text-navy">Eliminar la cuenta</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Se anonimiza tu perfil y se cancelan las consultas futuras. Esta acción no se puede deshacer.</p>
        <form action={deleteAccountAction} className="mt-4 space-y-2">
          <label className="block text-sm" htmlFor="confirm">Escribí ELIMINAR para confirmar</label>
          <input id="confirm" name="confirm" className="h-11 w-full rounded-xl border border-line px-3" />
          <button className="h-11 rounded-xl bg-danger px-4 text-sm font-semibold text-white" type="submit">Eliminar mi cuenta</button>
        </form>
      </section>
    </div>
  );
}
