import { redirect } from "next/navigation";
import { deleteAccountAction } from "@/lib/actions/clinic";
import { ProfileForm } from "@/components/resource-forms";
import { one } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Mis datos" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar?next=/cuenta/perfil");
  const aviso = one((await searchParams).aviso);
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-3xl font-semibold text-navy">Tus datos</h1>
      <p className="mt-2 text-sm text-muted">{user.email}. El correo no se cambia desde acá.</p>
      {aviso ? <p className="mt-4 text-sm text-danger" role="alert">{aviso}</p> : null}
      <div className="mt-6 rounded-2xl bg-white p-5">
        <ProfileForm defaults={{ fullName: user.fullName, phone: user.phone ?? "", birthDate: user.birthDate?.slice(0, 10) ?? "" }} />
      </div>
      <section className="mt-6 rounded-2xl bg-white p-5">
        <h2 className="font-semibold text-navy">Descargar o eliminar</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Podés bajar una copia de tus datos de contacto y turnos. Eliminar la cuenta anonimiza tu perfil y cancela las consultas futuras.</p>
        <a className="mt-3 inline-flex text-sm font-semibold text-navy underline" href="/api/cuenta/datos">Descargar mis datos</a>
        <form action={deleteAccountAction} className="mt-4 space-y-2">
          <label className="block text-sm" htmlFor="confirm">Escribí ELIMINAR para confirmar</label>
          <input id="confirm" name="confirm" className="h-11 w-full rounded-xl border border-line px-3" />
          <button className="h-11 rounded-xl bg-danger px-4 text-sm font-semibold text-white" type="submit">Eliminar mi cuenta</button>
        </form>
      </section>
    </div>
  );
}
