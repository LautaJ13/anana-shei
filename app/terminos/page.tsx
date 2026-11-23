export const metadata = { title: "Condiciones" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-10 text-sm leading-7">
      <h1 className="text-3xl font-semibold text-navy">Condiciones de uso</h1>
      <p>Alba conecta pacientes con consultorios independientes. Cada consultorio define sus servicios, precios, horarios y la política de cancelación. La reserva queda sujeta a esa política y a la disponibilidad real del profesional.</p>
      <p>Un consultorio nuevo queda pendiente hasta que la plataforma lo active. Mientras tanto no aparece en la búsqueda pública.</p>
      <p>Esta versión no cobra turnos ni suscripciones. Los precios que ves, cuando el consultorio los publica, son informativos.</p>
      <p>Las cuentas de demostración usan datos ficticios. No las uses para información real de pacientes.</p>
    </article>
  );
}
