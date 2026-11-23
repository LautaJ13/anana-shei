# Alba

Plataforma para reservar consultas en consultorios independientes. Está pensada primero para Uruguay, en español, con horarios en `America/Montevideo`.

Un paciente busca por especialidad, nombre o lugar, ve solo horarios libres y reserva en cuatro pasos. Cada consultorio administra profesionales, servicios, agendas y reservas sin ver los datos de otro consultorio.

## Cómo correrla

```bash
npm install
npm run dev
```

La aplicación queda en `http://127.0.0.1:3847`.

Sin `DATABASE_URL`, Alba abre PostgreSQL en memoria con [PGlite](https://pglite.dev/) y aplica `migrations/`. Los datos de prueba se cargan solos y se pierden cuando se reinicia el proceso. Con `DATABASE_URL`, usa ese Postgres y `npm run build` aplica las migraciones pendientes. `DATABASE_URL_UNPOOLED` tiene prioridad para migrar.

Copiá `.env.example` a `.env.local` solo si vas a configurar correo o una base externa. No commitees secretos.

## Datos de ejemplo

Hay tres consultorios activos: Clínica del Prado (medicina), Mente Clara (psicología) y Sonrisa Viva (odontología). Se pueden ver sin cuenta. Las fichas de ejemplo no tienen contraseña: para reservar hay que crear una cuenta. Las cuentas marcadas como demostración quedan bloqueadas salvo que `DISABLE_DEMO_LOGINS` sea `false`.

## Correo y recordatorios

`RESEND_API_KEY` y `EMAIL_FROM` activan el envío con Resend. Si faltan, la reserva se confirma igual, el evento queda como `skipped_unconfigured` y la interfaz dice que el correo no se envió.

Los recordatorios de 24 horas no salen solos. Un cron debe llamar:

```bash
curl -X POST http://127.0.0.1:3847/api/cron/recordatorios \
  -H "Authorization: Bearer $CRON_SECRET"
```

Sin `CRON_SECRET` esa ruta responde 503.

## Decisiones

- Next.js App Router, TypeScript, Tailwind y componentes al estilo shadcn/ui.
- PostgreSQL con RLS forzado y el rol `app_rls`. Cada consulta de usuario hace `SET LOCAL ROLE app_rls`.
- La superposición de turnos se impide en la base, con un bloqueo por profesional y un trigger. No depende solo del navegador.
- Las fechas se guardan en UTC y se muestran en la zona de la sede.
- La autenticación es propia: contraseñas scrypt y sesión en cookie `httpOnly`. Se puede apuntar a Postgres de Supabase con `DATABASE_URL`. Supabase Auth y PostgREST no son el runtime: el aislamiento y las reglas de turnos viven en SQL portable, así el producto corre sin un proyecto de Supabase ni secretos.
- No hay historia clínica, diagnósticos, recetas ni documentos médicos. La adecuación a la Ley 18.331 queda como criterio de diseño, no como una certificación.

## Pruebas

```bash
npm test
npm run test:e2e
```

`npm test` cubre la grilla de horarios, la reserva concurrente, la cancelación, la reprogramación, el aislamiento entre consultorios y la zona horaria. Playwright recorre la búsqueda, la reserva y la cancelación en el navegador. La primera vez hace falta `npx playwright install chromium`.
