"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  addAvailabilityAction,
  addExceptionAction,
  createOrganizationAction,
  inviteAction,
  saveProfessionalAction,
  saveServiceAction,
  staffBookAction,
  updateOrganizationAction,
  updateProfileAction,
  type FormState,
} from "@/lib/actions/clinic";
import { addSpecialtyAction } from "@/lib/actions/platform";
import { DEPARTMENTS, WEEKDAYS } from "@/lib/labels";
import {
  availabilitySchema,
  exceptionSchema,
  inviteSchema,
  organizationSchema,
  professionalSchema,
  profileSchema,
  serviceSchema,
  specialtySchema,
  staffBookingSchema,
  type ProfessionalInput,
  type ProfileInput,
  type ServiceInput,
} from "@/lib/validators";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

function Message({ state }: { state: FormState | null }) {
  if (!state) return null;
  if (!state.ok) return <p className="text-sm text-danger" role="alert">{state.error}</p>;
  return (
    <div className="space-y-2 text-sm text-navy" role="status">
      {state.message ? <p>{state.message}</p> : null}
      {state.link ? <p className="break-all rounded-xl bg-background p-3"><a className="font-semibold underline" href={state.link}>{state.link}</a></p> : null}
    </div>
  );
}

export function OrganizationForm({
  mode,
  slug,
  defaults,
}: {
  mode: "create" | "edit";
  slug?: string;
  defaults: {
    name: string;
    slug: string;
    description: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    department: string;
    cancellationHours: number;
    requireConfirmation: boolean;
  };
}) {
  const form = useForm({ resolver: zodResolver(organizationSchema), defaultValues: defaults });
  const [state, setState] = useState<FormState | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        setPending(true);
        const result = mode === "create" ? await createOrganizationAction(values) : await updateOrganizationAction(slug ?? "", values);
        setState(result);
        setPending(false);
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="org-name">Nombre</Label>
          <Input id="org-name" {...form.register("name")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-slug">Identificador público</Label>
          <Input id="org-slug" {...form.register("slug")} />
          <p className="text-xs text-muted">Quedará en la dirección del consultorio. Solo minúsculas y guiones.</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="org-description">Descripción</Label>
        <Textarea id="org-description" {...form.register("description")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="org-phone">Teléfono</Label><Input id="org-phone" {...form.register("phone")} /></div>
        <div className="space-y-1.5"><Label htmlFor="org-email">Correo</Label><Input id="org-email" {...form.register("email")} /></div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="org-address">Dirección</Label><Input id="org-address" {...form.register("address")} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="org-city">Ciudad o barrio</Label><Input id="org-city" {...form.register("city")} /></div>
        <div className="space-y-1.5">
          <Label htmlFor="org-department">Departamento</Label>
          <select id="org-department" className="h-11 w-full rounded-xl border border-line bg-white px-3" {...form.register("department")}>
            {DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="org-cancel">Horas mínimas para cancelar</Label>
          <Input id="org-cancel" type="number" min={0} max={168} {...form.register("cancellationHours")} />
        </div>
        <label className="mt-7 flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register("requireConfirmation")} />
          Pedir confirmación del consultorio antes de confirmar el turno
        </label>
      </div>
      {form.formState.errors.root?.message || Object.values(form.formState.errors)[0]?.message ? (
        <p className="text-sm text-danger">{String(Object.values(form.formState.errors)[0]?.message ?? "")}</p>
      ) : null}
      <Message state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Guardando…" : mode === "create" ? "Enviar solicitud" : "Guardar consultorio"}</Button>
    </form>
  );
}

export function ProfileForm({ defaults }: { defaults: ProfileInput }) {
  const router = useRouter();
  const form = useForm<ProfileInput>({ resolver: zodResolver(profileSchema), defaultValues: defaults });
  const [state, setState] = useState<FormState | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form className="grid gap-4" noValidate onSubmit={form.handleSubmit(async (values) => {
      setPending(true);
      const result = await updateProfileAction(values);
      setState(result);
      setPending(false);
      if (result.ok) {
        form.reset({ ...values, currentPassword: "", newPassword: "" });
        router.refresh();
      }
    })}>
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">Nombre y apellido</Label>
        <Input id="profile-name" autoComplete="name" {...form.register("fullName")} />
        {form.formState.errors.fullName ? <p className="text-sm text-danger">{form.formState.errors.fullName.message}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-email">Correo</Label>
        <Input id="profile-email" type="email" autoComplete="email" {...form.register("email")} />
        {form.formState.errors.email ? <p className="text-sm text-danger">{form.formState.errors.email.message}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-phone">Teléfono</Label>
        <Input id="profile-phone" autoComplete="tel" {...form.register("phone")} />
        {form.formState.errors.phone ? <p className="text-sm text-danger">{form.formState.errors.phone.message}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-birth">Fecha de nacimiento</Label>
        <Input id="profile-birth" type="date" autoComplete="bday" {...form.register("birthDate")} />
        {form.formState.errors.birthDate ? <p className="text-sm text-danger">{form.formState.errors.birthDate.message}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-current">Contraseña actual</Label>
        <Input id="profile-current" type="password" autoComplete="current-password" {...form.register("currentPassword")} />
        <p className="text-sm text-muted">Hace falta solo si cambiás el correo o la contraseña.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-next">Nueva contraseña</Label>
        <Input id="profile-next" type="password" autoComplete="new-password" {...form.register("newPassword")} />
        {form.formState.errors.newPassword ? <p className="text-sm text-danger">{form.formState.errors.newPassword.message}</p> : null}
      </div>
      <Message state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar datos"}</Button>
    </form>
  );
}

export function ServiceForm({ slug, defaults }: { slug: string; defaults: ServiceInput }) {
  const form = useForm({ resolver: zodResolver(serviceSchema), defaultValues: defaults });
  const [state, setState] = useState<FormState | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form className="grid gap-3 rounded-2xl border border-line bg-white p-4" noValidate onSubmit={form.handleSubmit(async (values) => {
      setPending(true);
      setState(await saveServiceAction(slug, values));
      setPending(false);
    })}>
      <input type="hidden" {...form.register("id")} />
      <div className="space-y-1.5"><Label>Nombre</Label><Input {...form.register("name")} /></div>
      <div className="space-y-1.5"><Label>Descripción</Label><Textarea {...form.register("description")} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Duración (min)</Label><Input type="number" {...form.register("durationMinutes")} /></div>
        <div className="space-y-1.5"><Label>Pausa (min)</Label><Input type="number" {...form.register("bufferMinutes")} /></div>
      </div>
      <div className="space-y-1.5"><Label>Precio en pesos, si corresponde</Label><Input {...form.register("pricePesos")} /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("active")} /> Activo</label>
      <Message state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar servicio"}</Button>
    </form>
  );
}

export function ProfessionalForm({
  slug,
  defaults,
  specialties,
  services,
}: {
  slug: string;
  defaults: ProfessionalInput;
  specialties: { id: string; name: string }[];
  services: { id: string; name: string }[];
}) {
  const form = useForm<ProfessionalInput>({ resolver: zodResolver(professionalSchema), defaultValues: defaults });
  const [state, setState] = useState<FormState | null>(null);
  const [pending, setPending] = useState(false);
  const specialtyIds = form.watch("specialtyIds");
  const serviceIds = form.watch("serviceIds");
  return (
    <form className="grid gap-3 rounded-2xl border border-line bg-white p-4" noValidate onSubmit={form.handleSubmit(async (values) => {
      setPending(true);
      setState(await saveProfessionalAction(slug, values));
      setPending(false);
    })}>
      <input type="hidden" {...form.register("id")} />
      <div className="space-y-1.5"><Label>Nombre</Label><Input {...form.register("fullName")} /></div>
      <div className="space-y-1.5"><Label>Matrícula (opcional)</Label><Input {...form.register("licenseNumber")} /></div>
      <div className="space-y-1.5"><Label>Presentación</Label><Textarea {...form.register("bio")} /></div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Especialidades</legend>
        {specialties.map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={specialtyIds.includes(item.id)}
              onChange={(event) => {
                const next = event.target.checked ? [...specialtyIds, item.id] : specialtyIds.filter((id) => id !== item.id);
                form.setValue("specialtyIds", next, { shouldValidate: true });
              }}
            />
            {item.name}
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Servicios</legend>
        {services.map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={serviceIds.includes(item.id)}
              onChange={(event) => {
                const next = event.target.checked ? [...serviceIds, item.id] : serviceIds.filter((id) => id !== item.id);
                form.setValue("serviceIds", next, { shouldValidate: true });
              }}
            />
            {item.name}
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("active")} /> Activo</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("canManageAvailability")} /> Puede gestionar su disponibilidad</label>
      {form.formState.errors.specialtyIds ? <p className="text-sm text-danger">{form.formState.errors.specialtyIds.message}</p> : null}
      {form.formState.errors.serviceIds ? <p className="text-sm text-danger">{form.formState.errors.serviceIds.message}</p> : null}
      <Message state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar profesional"}</Button>
    </form>
  );
}

export function AvailabilityForm({ slug, professionals, locations }: { slug: string; professionals: { id: string; fullName: string }[]; locations: { id: string; name: string }[] }) {
  const form = useForm({ resolver: zodResolver(availabilitySchema), defaultValues: { professionalId: professionals[0]?.id ?? "", locationId: locations[0]?.id ?? "", weekday: 1, start: "09:00", end: "17:00" } });
  const [state, setState] = useState<FormState | null>(null);
  return (
    <form className="grid gap-3 rounded-2xl bg-white p-4" onSubmit={form.handleSubmit(async (values) => setState(await addAvailabilityAction(slug, values)))}>
      <select className="h-11 rounded-xl border border-line px-3" {...form.register("professionalId")}>
        {professionals.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
      </select>
      <select className="h-11 rounded-xl border border-line px-3" {...form.register("locationId")}>
        {locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <select className="h-11 rounded-xl border border-line px-3" {...form.register("weekday")}>
        {WEEKDAYS.map((item, index) => <option key={item} value={index}>{item}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-3">
        <Input type="time" {...form.register("start")} />
        <Input type="time" {...form.register("end")} />
      </div>
      <Message state={state} />
      <Button type="submit">Agregar horario</Button>
    </form>
  );
}

export function ExceptionForm({ slug, professionals, locations }: { slug: string; professionals: { id: string; fullName: string }[]; locations: { id: string; name: string }[] }) {
  const form = useForm({
    resolver: zodResolver(exceptionSchema),
    defaultValues: { professionalId: professionals[0]?.id ?? "", locationId: "", kind: "block" as const, startsAt: "", endsAt: "", note: "" },
  });
  const [state, setState] = useState<FormState | null>(null);
  return (
    <form className="grid gap-3 rounded-2xl bg-white p-4" onSubmit={form.handleSubmit(async (values) => setState(await addExceptionAction(slug, values)))}>
      <select className="h-11 rounded-xl border border-line px-3" {...form.register("professionalId")}>
        {professionals.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
      </select>
      <select className="h-11 rounded-xl border border-line px-3" {...form.register("kind")}>
        <option value="block">Bloqueo</option>
        <option value="vacation">Licencia o vacaciones</option>
        <option value="extra">Horario extra</option>
      </select>
      <select className="h-11 rounded-xl border border-line px-3" {...form.register("locationId")}>
        <option value="">Sin sede específica</option>
        {locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <Input type="datetime-local" {...form.register("startsAt")} />
      <Input type="datetime-local" {...form.register("endsAt")} />
      <Input placeholder="Nota interna" {...form.register("note")} />
      <Message state={state} />
      <Button type="submit">Guardar excepción</Button>
    </form>
  );
}

export function InviteForm({ slug, professionals }: { slug: string; professionals: { id: string; fullName: string }[] }) {
  const form = useForm({ resolver: zodResolver(inviteSchema), defaultValues: { email: "", role: "receptionist" as const, professionalId: "" } });
  const [state, setState] = useState<FormState | null>(null);
  return (
    <form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => setState(await inviteAction(slug, values)))}>
      <Input type="email" placeholder="Correo" {...form.register("email")} />
      <select className="h-11 rounded-xl border border-line px-3" {...form.register("role")}>
        <option value="receptionist">Recepción</option>
        <option value="professional">Profesional</option>
        <option value="org_admin">Administración</option>
      </select>
      <select className="h-11 rounded-xl border border-line px-3" {...form.register("professionalId")}>
        <option value="">Sin ficha profesional</option>
        {professionals.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
      </select>
      <p className="text-xs text-muted">Si el rol es profesional, elegí la ficha que va a usar esa persona.</p>
      <Message state={state} />
      <Button type="submit">Crear invitación</Button>
    </form>
  );
}

export function StaffBookForm({
  slug,
  professionals,
  services,
  locations,
  slots,
  defaults,
}: {
  slug: string;
  professionals: { id: string; fullName: string }[];
  services: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  slots: { start: string; label: string }[];
  defaults: { professionalId: string; serviceId: string; locationId: string };
}) {
  const form = useForm({
    resolver: zodResolver(staffBookingSchema),
    defaultValues: { ...defaults, fullName: "", email: "", phone: "", startsAt: slots[0]?.start ?? "", note: "", companyFax: "" },
  });
  const [state, setState] = useState<FormState | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form className="grid gap-3" noValidate onSubmit={form.handleSubmit(async (values) => {
      setPending(true);
      setState(await staffBookAction(slug, values));
      setPending(false);
    })}>
      <Input placeholder="Nombre del paciente" {...form.register("fullName")} />
      <Input type="email" placeholder="Correo" {...form.register("email")} />
      <Input placeholder="Teléfono" {...form.register("phone")} />
      <input type="hidden" {...form.register("professionalId")} />
      <input type="hidden" {...form.register("serviceId")} />
      <input type="hidden" {...form.register("locationId")} />
      <div className="hidden" aria-hidden="true"><input tabIndex={-1} autoComplete="off" {...form.register("companyFax")} /></div>
      <select className="h-11 rounded-xl border border-line px-3" {...form.register("startsAt")}>
        {slots.map((slot) => <option key={slot.start} value={slot.start}>{slot.label}</option>)}
      </select>
      <Textarea placeholder="Nota de contacto, sin datos clínicos" {...form.register("note")} />
      <p className="text-xs text-muted">Profesional, servicio y sede se eligen arriba. El horario sale de la agenda real.</p>
      <p className="sr-only">{professionals.length}{services.length}{locations.length}</p>
      <Message state={state} />
      <Button type="submit" disabled={pending || slots.length === 0}>{pending ? "Reservando…" : "Crear reserva"}</Button>
    </form>
  );
}

export function SpecialtyForm() {
  const form = useForm({ resolver: zodResolver(specialtySchema), defaultValues: { name: "", slug: "" } });
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => {
      const result = await addSpecialtyAction(values);
      setMessage(result.ok ? "Especialidad agregada." : result.error);
      if (result.ok) form.reset();
    })}>
      <Input placeholder="Nombre" {...form.register("name")} />
      <Input placeholder="identificador" {...form.register("slug")} />
      {message ? <p className="text-sm text-navy">{message}</p> : null}
      <Button type="submit">Agregar especialidad</Button>
    </form>
  );
}
