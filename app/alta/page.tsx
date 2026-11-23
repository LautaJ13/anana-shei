import Link from "next/link";
import { OrganizationForm } from "@/components/resource-forms";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Registrar consultorio" };

export default async function NewClinicPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-3xl font-semibold text-navy">Registrá tu consultorio</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Primero creá una cuenta. Después cargás los datos del consultorio. Queda pendiente de activación y no se publica solo.</p>
        <Link className="mt-5 inline-flex h-11 items-center rounded-xl bg-navy px-4 font-semibold text-white" href="/registro?next=/alta">Crear cuenta y continuar</Link>
      </div>
    );
  }
  if (user.platformRole === "superadmin") {
    return <p className="mx-auto max-w-lg px-4 py-10 text-sm">La cuenta de plataforma no crea consultorios. Aprobá los que envían los equipos.</p>;
  }
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-semibold text-navy">Datos del consultorio</h1>
      <p className="mt-2 text-sm leading-6 text-muted">La sede inicial usa America/Montevideo. Podés sumar profesionales y horarios cuando el panel esté activo. Hasta la aprobación, la ficha no aparece en la búsqueda.</p>
      <div className="mt-6 rounded-2xl bg-white p-5">
        <OrganizationForm
          mode="create"
          defaults={{
            name: "",
            slug: "",
            description: "",
            phone: "",
            email: user.email,
            address: "",
            city: "Montevideo",
            department: "Montevideo",
            cancellationHours: 24,
            requireConfirmation: false,
          }}
        />
      </div>
    </div>
  );
}
