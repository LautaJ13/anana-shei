import Link from "next/link";
import { confirmEmailVerification } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { one } from "@/lib/http";

export const metadata = { title: "Confirmar correo" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const token = one((await searchParams).token);
  const database = await getDatabase();
  const ok = token.length >= 20 ? await confirmEmailVerification(database, token) : false;
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-navy">{ok ? "Correo confirmado" : "El enlace no sirve"}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          {ok
            ? "Ya podés recibir los avisos de tus turnos."
            : "Pedí otro enlace desde tu cuenta. Este venció o ya se usó."}
        </p>
        <p className="mt-4 text-sm">
          <Link className="font-semibold text-navy underline" href="/cuenta">Volver a mis consultas</Link>
        </p>
      </section>
    </div>
  );
}
