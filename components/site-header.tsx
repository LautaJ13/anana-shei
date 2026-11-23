import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";
import type { SessionUser } from "@/lib/auth";
import { Logo } from "./logo";

export function SiteHeader({ user }: { user: SessionUser | null }) {
  const panels = user?.memberships ?? [];
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="rounded-lg">
          <Logo />
          <span className="sr-only">Inicio de Alba</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-2 text-sm font-medium" aria-label="Principal">
          {user ? (
            <>
              <Link className="rounded-lg px-3 py-2 text-navy hover:bg-background" href="/cuenta">
                Mis consultas
              </Link>
              {panels[0] ? (
                <Link className="rounded-lg px-3 py-2 text-navy hover:bg-background" href={`/c/${panels[0].slug}/panel`}>
                  Panel
                </Link>
              ) : null}
              {user.platformRole === "superadmin" ? (
                <Link className="rounded-lg px-3 py-2 text-navy hover:bg-background" href="/plataforma">
                  Plataforma
                </Link>
              ) : null}
              <form action={logoutAction}>
                <button className="rounded-lg px-3 py-2 text-navy hover:bg-background" type="submit">
                  Salir
                </button>
              </form>
            </>
          ) : (
            <>
              <Link className="rounded-lg px-3 py-2 text-navy hover:bg-background" href="/ingresar">
                Ingresar
              </Link>
              <Link className="rounded-xl bg-navy px-3 py-2 text-white hover:bg-[#10283d]" href="/registro">
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
