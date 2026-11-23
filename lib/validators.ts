import { z } from "zod";

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(160)
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Ingresá un correo válido.");

const passwordField = z.string().min(8, "Usá al menos 8 caracteres.").max(72, "La contraseña es demasiado larga.");

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Ingresá tu contraseña.").max(72),
  companyFax: z.string().optional(),
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresá tu nombre.").max(120),
  email: emailField,
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  password: passwordField,
  companyFax: z.string().optional(),
});

export const resetRequestSchema = z.object({
  email: emailField,
  companyFax: z.string().optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordField,
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresá tu nombre.").max(120),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Revisá la fecha.").optional().or(z.literal("")),
});

export const organizationSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre.").max(120),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usá minúsculas, números y guiones."),
  description: z.string().trim().max(800).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: emailField.optional().or(z.literal("")),
  address: z.string().trim().min(4, "Ingresá la dirección.").max(160),
  city: z.string().trim().min(2, "Ingresá la ciudad.").max(80),
  department: z.string().trim().min(2).max(80),
  cancellationHours: z.coerce.number().int().min(0).max(168),
  requireConfirmation: z.boolean().optional(),
});

export const serviceSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  bufferMinutes: z.coerce.number().int().min(0).max(120),
  pricePesos: z.string().trim().optional().or(z.literal("")),
  active: z.boolean().optional(),
});

export const professionalSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  fullName: z.string().trim().min(2).max(120),
  licenseNumber: z.string().trim().max(40).optional().or(z.literal("")),
  bio: z.string().trim().max(400).optional().or(z.literal("")),
  active: z.boolean().optional(),
  canManageAvailability: z.boolean().optional(),
  specialtyIds: z.array(z.string().uuid()).min(1, "Elegí al menos una especialidad."),
  serviceIds: z.array(z.string().uuid()).min(1, "Elegí al menos un servicio."),
});

export const availabilitySchema = z.object({
  professionalId: z.string().uuid(),
  locationId: z.string().uuid(),
  weekday: z.coerce.number().int().min(0).max(6),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

export const exceptionSchema = z.object({
  professionalId: z.string().uuid(),
  kind: z.enum(["block", "vacation", "extra"]),
  locationId: z.string().uuid().optional().or(z.literal("")),
  startsAt: z.string().min(10),
  endsAt: z.string().min(10),
  note: z.string().trim().max(160).optional().or(z.literal("")),
});

export const inviteSchema = z.object({
  email: emailField,
  role: z.enum(["org_admin", "professional", "receptionist"]),
  professionalId: z.string().uuid().optional().or(z.literal("")),
});

export const staffBookingSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: emailField,
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  locationId: z.string().uuid(),
  startsAt: z.string().min(10),
  note: z.string().trim().max(280).optional().or(z.literal("")),
  companyFax: z.string().optional(),
});

export const specialtySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type ProfessionalInput = z.infer<typeof professionalSchema>;
