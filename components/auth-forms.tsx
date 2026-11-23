"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginAction, registerAction, requestResetAction, resetPasswordAction } from "@/lib/actions/auth";
import { loginSchema, registerSchema, resetPasswordSchema, resetRequestSchema, type LoginInput, type RegisterInput } from "@/lib/validators";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", companyFax: "" },
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        setPending(true);
        setError(null);
        const result = await loginAction(values, nextPath);
        if (result && !result.ok) setError(result.error);
        setPending(false);
      })}
      noValidate
    >
      <Field label="Correo" error={form.formState.errors.email?.message} id="login-email">
        <Input id="login-email" type="email" autoComplete="email" {...form.register("email")} />
      </Field>
      <Field label="Contraseña" error={form.formState.errors.password?.message} id="login-password">
        <Input id="login-password" type="password" autoComplete="current-password" {...form.register("password")} />
      </Field>
      <Honeypot register={form.register("companyFax")} />
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", phone: "", password: "", companyFax: "" },
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        setPending(true);
        setError(null);
        const result = await registerAction(values, nextPath);
        if (result && !result.ok) setError(result.error);
        setPending(false);
      })}
      noValidate
    >
      <Field label="Nombre y apellido" error={form.formState.errors.fullName?.message} id="reg-name">
        <Input id="reg-name" autoComplete="name" {...form.register("fullName")} />
      </Field>
      <Field label="Correo" error={form.formState.errors.email?.message} id="reg-email">
        <Input id="reg-email" type="email" autoComplete="email" {...form.register("email")} />
      </Field>
      <Field label="Teléfono (opcional)" error={form.formState.errors.phone?.message} id="reg-phone">
        <Input id="reg-phone" autoComplete="tel" {...form.register("phone")} />
      </Field>
      <Field label="Contraseña" error={form.formState.errors.password?.message} id="reg-password">
        <Input id="reg-password" type="password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Honeypot register={form.register("companyFax")} />
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}

export function ResetRequestForm() {
  const form = useForm({ resolver: zodResolver(resetRequestSchema), defaultValues: { email: "", companyFax: "" } });
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        setPending(true);
        setError(null);
        const result = await requestResetAction(values);
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setMessage(result.notice ?? "Listo.");
        setLink(result.devLink ?? null);
      })}
      noValidate
    >
      <Field label="Correo" error={form.formState.errors.email?.message} id="reset-email">
        <Input id="reset-email" type="email" autoComplete="email" {...form.register("email")} />
      </Field>
      <Honeypot register={form.register("companyFax")} />
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      {message ? <p className="text-sm text-navy" role="status">{message}</p> : null}
      {link ? (
        <p className="rounded-xl bg-background p-3 text-sm break-all">
          <a className="font-semibold text-navy underline" href={link}>
            Abrir enlace de recuperación
          </a>
        </p>
      ) : null}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Preparando…" : "Recuperar acceso"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const form = useForm({ resolver: zodResolver(resetPasswordSchema), defaultValues: { token, password: "" } });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(async (values) => {
        setPending(true);
        const result = await resetPasswordAction(values);
        setPending(false);
        if (result && !result.ok) setError(result.error);
      })}
      noValidate
    >
      <input type="hidden" {...form.register("token")} />
      <Field label="Nueva contraseña" error={form.formState.errors.password?.message} id="new-password">
        <Input id="new-password" type="password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-danger" id={`${id}-error`}>{error}</p> : null}
    </div>
  );
}

function Honeypot({ register }: { register: ReturnType<ReturnType<typeof useForm>["register"]> }) {
  return (
    <div className="hidden" aria-hidden="true">
      <label>
        Fax
        <input tabIndex={-1} autoComplete="off" {...register} />
      </label>
    </div>
  );
}
