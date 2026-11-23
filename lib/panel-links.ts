export function panelLinks(slug: string, role: string, canManage: boolean, hasProfessional: boolean) {
  const base = `/c/${slug}/panel`;
  const links = [
    { href: base, label: "Inicio" },
    { href: `${base}/calendario`, label: "Calendario" },
    { href: `${base}/reservas`, label: "Reservas" },
  ];
  if (hasProfessional) links.push({ href: `${base}/agenda`, label: "Mi agenda" });
  if (role === "org_admin" || role === "receptionist") links.push({ href: `${base}/reservas/nueva`, label: "Nueva reserva" });
  if (role === "org_admin") {
    links.push(
      { href: `${base}/profesionales`, label: "Profesionales" },
      { href: `${base}/servicios`, label: "Servicios" },
      { href: `${base}/horarios`, label: "Horarios" },
      { href: `${base}/equipo`, label: "Equipo" },
      { href: `${base}/pacientes`, label: "Pacientes" },
      { href: `${base}/auditoria`, label: "Actividad" },
      { href: `${base}/configuracion`, label: "Configuración" },
    );
  } else {
    if (canManage) links.push({ href: `${base}/horarios`, label: "Horarios" });
    links.push({ href: `${base}/pacientes`, label: "Pacientes" });
  }
  return links;
}
