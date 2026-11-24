"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestResetAction, resetPasswordAction } from "@/lib/actions/auth";
import { resetPasswordSchema, resetRequestSchema } from "@/lib/validators";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function LoginForm({ nextPath, error, email = "" }: { nextPath: string; error?: string; email?: string }) {
  return (
    <form className="space-y-4" method="post" action="/api/ingresar" acceptCharset="utf-8">
      <input type="hidden" name="next" value={nextPath} />
      {error ? <p className="rounded-xl border border-danger/30 bg-[#fff6f6] px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
      <Field label="Correo" id="login-email">
        <Input id="login-email" name="email" type="email" autoComplete="email" required maxLength={160} defaultValue={email} />
      </Field>
      <Field label="Contraseña" id="login-password">
        <Input id="login-password" name="password" type="password" autoComplete="current-password" required maxLength={72} />
      </Field>
      <Button className="w-full" type="submit">Ingresar</Button>
    </form>
  );
}

export function RegisterForm({
  nextPath,
  error,
  defaults,
}: {
  nextPath: string;
  error?: string;
  defaults: { fullName: string; email: string; phone: string };
}) {
  return (
    <form className="space-y-4" method="post" action="/api/registro" acceptCharset="utf-8">
      <input type="hidden" name="next" value={nextPath} />
      {error ? <p className="rounded-xl border border-danger/30 bg-[#fff6f6] px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
      <Field label="Nombre y apellido" id="reg-name">
        <Input id="reg-name" name="fullName" autoComplete="name" required minLength={2} maxLength={120} defaultValue={defaults.fullName} />
      </Field>
      <Field label="Correo" id="reg-email">
        <Input id="reg-email" name="email" type="email" autoComplete="email" required maxLength={160} defaultValue={defaults.email} />
      </Field>
      <Field label="Teléfono (opcional)" id="reg-phone">
        <Input id="reg-phone" name="phone" autoComplete="tel" maxLength={30} defaultValue={defaults.phone} />
      </Field>
      <Field label="Contraseña" id="reg-password">
        <Input id="reg-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </Field>
      <p className="text-sm text-muted">Mínimo 8 caracteres. Al crear la cuenta entrás directo.</p>
      <Button className="w-full" type="submit">Crear cuenta</Button>
    </form>
  );
}

export function ResetRequestForm() {
  const form = useForm({ resolver: zodResolver(resetRequestSchema), defaultValues: { email: "", companyFax: "" } });
  const [message, setMessage] = useState<string | null>(null);
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
      })}
      noValidate
    >
      <Field label="Correo" error={form.formState.errors.email?.message} id="reset-email">
        <Input id="reset-email" type="email" autoComplete="email" {...form.register("email")} />
      </Field>
      <Honeypot register={form.register("companyFax")} />
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      {message ? <p className="text-sm text-navy" role="status">{message}</p> : null}
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
        try {
          const result = await resetPasswordAction(values);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          enter(result.next ?? "/ingresar");
        } catch {
          setError("No pudimos guardar la contraseña. Probá de nuevo.");
        } finally {
          setPending(false);
        }
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

function enter(path: string) {
  const next = path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : "/cuenta";
  window.location.assign(next);
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
