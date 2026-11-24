import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/resource-forms";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Editar perfil" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar?next=/cuenta/perfil");
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-3xl font-semibold text-navy">Editar perfil</h1>
      <p className="mt-2 text-sm leading-6 text-muted">Cambiá tu nombre, correo, teléfono, fecha de nacimiento y, si querés, la contraseña.</p>
      <div className="mt-6 rounded-2xl bg-white p-5">
        <ProfileForm
          defaults={{
            fullName: user.fullName,
            email: user.email,
            phone: user.phone ?? "",
            birthDate: user.birthDate?.slice(0, 10) ?? "",
            currentPassword: "",
            newPassword: "",
          }}
        />
      </div>
      <p className="mt-4 text-sm">
        <Link className="font-semibold text-navy underline" href="/cuenta/configuracion">Ir a configuración</Link>
      </p>
    </div>
  );
}
