import Link from "next/link";
import { AcceptInvite } from "@/components/accept-invite";
import { getDatabase } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/labels";
import { sha256 } from "@/lib/password";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Invitación" };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getCurrentUser();
  const database = await getDatabase();
  const rows = await database.withUser(user?.id ?? null, (query) =>
    query.query<{ email: string; organization_name: string; role: keyof typeof ROLE_LABEL; expires_at: Date | string; accepted: boolean }>(
      `select email, organization_name, role, expires_at, accepted from invitation_preview($1)`,
      [sha256(token)],
    ),
  );
  const invite = rows.rows[0];
  if (!invite) {
    return <p className="mx-auto max-w-lg px-4 py-10">Esta invitación no existe o ya venció.</p>;
  }
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <section className="rounded-3xl bg-white p-6">
        <h1 className="text-3xl font-semibold text-navy">Invitación a {invite.organization_name}</h1>
        <p className="mt-3 text-sm leading-6">Rol: {ROLE_LABEL[invite.role] ?? invite.role}. El enlace está dirigido a {invite.email}.</p>
        {invite.accepted ? <p className="mt-4 text-sm">Esta invitación ya fue aceptada.</p> : null}
        {!user ? <Link className="mt-5 inline-flex h-11 items-center rounded-xl bg-navy px-4 font-semibold text-white" href={`/ingresar?next=${encodeURIComponent(`/invitacion/${token}`)}`}>Ingresar para aceptarla</Link> : null}
        {user && !invite.accepted ? <div className="mt-5"><AcceptInvite token={token} /></div> : null}
      </section>
    </div>
  );
}
