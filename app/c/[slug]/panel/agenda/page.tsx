import { redirect } from "next/navigation";
import { requirePanel } from "@/lib/panel";

export default async function MyAgendaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { membership } = await requirePanel(slug);
  if (!membership.professionalId) redirect(`/c/${slug}/panel/calendario`);
  redirect(`/c/${slug}/panel/calendario?profesional=${membership.professionalId}&vista=semana`);
}
