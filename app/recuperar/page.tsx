import { ResetRequestForm } from "@/components/auth-forms";

export const metadata = { title: "Recuperar acceso" };

export default function RecoverPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-navy">Recuperar acceso</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Si el correo está configurado, no vamos a decir si la cuenta existe. Si no hay un proveedor de correo, no se genera un enlace.</p>
        <div className="mt-6"><ResetRequestForm /></div>
      </section>
    </div>
  );
}
