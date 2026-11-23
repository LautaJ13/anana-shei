import { PanelNav } from "@/components/panel-nav";
import { panelLinks } from "@/lib/panel-links";
import { requirePanel } from "@/lib/panel";

export default async function PanelLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { membership } = await requirePanel(slug);
  const links = panelLinks(slug, membership.role, membership.canManageAvailability, Boolean(membership.professionalId));
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
      <div>
        <p className="mb-3 px-1 text-sm font-semibold text-navy">{membership.organizationName}</p>
        {membership.organizationStatus === "pending" ? <p className="mb-3 rounded-xl bg-amber-100 px-3 py-2 text-xs text-amber-950">Este consultorio está pendiente de activación y todavía no aparece en la búsqueda.</p> : null}
        <PanelNav items={links} />
      </div>
      <div>{children}</div>
    </div>
  );
}
