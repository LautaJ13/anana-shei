export const metadata = { title: "Privacidad" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-10 text-sm leading-7">
      <h1 className="text-3xl font-semibold text-navy">Privacidad</h1>
      <p>Alba está pensada para consultorios en Uruguay. Recolecta solo lo necesario para reservar una consulta: nombre, correo, teléfono opcional, fecha de nacimiento opcional y los datos del turno.</p>
      <p>En esta versión no se guardan historias clínicas, diagnósticos, recetas ni documentos médicos. No escribas esa información en las notas.</p>
      <p>Cada consultorio ve los datos de contacto de las personas que se atienden ahí. No puede ver las reservas de otro consultorio. Un paciente no puede ver las reservas de otra persona. El equipo de la plataforma ve métricas agregadas y el estado de los consultorios, no el detalle clínico.</p>
      <p>Podés editar tus datos desde el menú del perfil y descargarlos o eliminar la cuenta desde Configuración. La eliminación anonimiza tu perfil, borra tu correo y tu nombre de los avisos guardados, y cancela las consultas futuras. Los consultorios pueden necesitar conservar el registro operativo del turno ya ocurrido, sin tu nombre.</p>
      <p>El diseño toma en cuenta la Ley 18.331 de protección de datos personales de Uruguay. Eso no significa que la plataforma haya pasado una evaluación jurídica o de seguridad independiente.</p>
      <p>Los horarios se guardan en UTC y se muestran en la zona del consultorio, inicialmente America/Montevideo.</p>
    </article>
  );
}
