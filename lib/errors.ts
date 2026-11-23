const MESSAGES: Record<string, string> = {
  auth_required: "Necesitás iniciar sesión para continuar.",
  forbidden: "No tenés permiso para hacer eso.",
  slot_unavailable: "Ese horario ya no está disponible. Elegí otro.",
  appointment_overlap: "Ese horario se superpone con otra reserva.",
  cancellation_window: "Esa consulta ya no se puede cambiar según la política del consultorio.",
  rate_limited: "Hiciste demasiados intentos. Esperá un momento y probá de nuevo.",
  not_available: "No encontramos ese dato o ya no está disponible.",
  email_taken: "No pudimos crear la cuenta con esos datos.",
  invalid_credentials: "El correo o la contraseña no son correctos.",
  invalid_name: "Revisá el nombre.",
  invalid_email: "Revisá el correo electrónico.",
  invalid_note: "El texto es demasiado largo.",
  invalid_slug: "El identificador solo puede tener minúsculas, números y guiones.",
  slug_taken: "Ese identificador ya está en uso.",
  invalid_transition: "Esa acción no corresponde al estado actual de la consulta.",
  last_admin: "Tiene que quedar al menos una administración activa.",
  cross_organization: "Esa combinación no pertenece al mismo consultorio.",
  patient_outside_clinic: "Esa persona tiene que pedir el turno por su cuenta. Desde el consultorio no podemos usar su cuenta.",
  demo_disabled: "Las cuentas de demostración están desactivadas.",
};

export function mapDbError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  for (const [code, text] of Object.entries(MESSAGES)) {
    if (message.includes(code)) return text;
  }
  console.error(error);
  return "No pudimos completar la operación. Probá de nuevo.";
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
