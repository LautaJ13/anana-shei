import { ResetPasswordForm } from "@/components/auth-forms";
import { one } from "@/lib/http";

export const metadata = { title: "Nueva contraseña" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const token = one((await searchParams).token);
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-navy">Elegí una contraseña nueva</h1>
        {token ? <div className="mt-6"><ResetPasswordForm token={token} /></div> : <p className="mt-4 text-sm text-danger">Falta el enlace de recuperación.</p>}
      </section>
    </div>
  );
}
