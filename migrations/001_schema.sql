-- Alba: esquema multi-consultorio.
-- Las políticas RLS se aplican a app_rls. El superusuario las saltea;
-- la aplicación hace SET LOCAL ROLE app_rls en cada transacción de usuario.
-- El rol se crea fuera de esta transacción: CREATE ROLE no puede depender
-- de que el archivo entero corra dentro de BEGIN/COMMIT.
-- Los turnos simultáneos se serializan con un advisory lock por profesional
-- y un disparador SECURITY DEFINER. btree_gist no se usa para que el mismo
-- SQL corra en Postgres y en PGlite.

grant usage on schema public to app_rls;

create function current_app_user() returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

create table profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  full_name text not null,
  phone text,
  birth_date date,
  platform_role text not null default 'user' check (platform_role in ('user', 'superadmin')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint profiles_name_len check (char_length(full_name) between 2 and 120),
  constraint profiles_phone_len check (phone is null or char_length(phone) <= 30)
);

create unique index profiles_email_unique on profiles (lower(email));

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text not null default '',
  phone text,
  email text,
  logo_bytes bytea,
  logo_mime text,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  cancellation_hours integer not null default 24 check (cancellation_hours between 0 and 168),
  require_confirmation boolean not null default false,
  is_demo boolean not null default false,
  country text not null default 'UY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint organizations_logo_size check (logo_bytes is null or octet_length(logo_bytes) <= 200000),
  constraint organizations_logo_mime check (logo_mime is null or logo_mime in ('image/png', 'image/jpeg', 'image/webp'))
);

create unique index organizations_slug_unique on organizations (slug);

create table clinic_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  name text not null,
  address text not null,
  city text not null,
  department text not null,
  country text not null default 'UY',
  timezone text not null default 'America/Montevideo',
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clinic_locations_org_idx on clinic_locations (organization_id);

create table specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  constraint specialties_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index specialties_slug_unique on specialties (slug);
create unique index specialties_name_unique on specialties (lower(name));

create table professionals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  user_id uuid references profiles (id),
  full_name text not null,
  license_number text,
  bio text not null default '',
  can_manage_availability boolean not null default false,
  active boolean not null default true,
  color text not null default '#17324D',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professionals_name_len check (char_length(full_name) between 2 and 120),
  unique (organization_id, user_id)
);

create index professionals_org_idx on professionals (organization_id);
create index professionals_user_idx on professionals (user_id);

create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  user_id uuid not null references profiles (id),
  role text not null check (role in ('org_admin', 'professional', 'receptionist')),
  professional_id uuid references professionals (id),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_members_user_idx on organization_members (user_id);

create table services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  name text not null,
  description text not null default '',
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 120),
  price_cents integer check (price_cents is null or price_cents >= 0),
  currency text not null default 'UYU' check (currency = 'UYU'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_org_idx on services (organization_id);

create table professional_specialties (
  professional_id uuid not null references professionals (id) on delete cascade,
  specialty_id uuid not null references specialties (id),
  primary key (professional_id, specialty_id)
);

create table professional_services (
  professional_id uuid not null references professionals (id) on delete cascade,
  service_id uuid not null references services (id) on delete cascade,
  primary key (professional_id, service_id)
);

create table recurring_availability (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals (id) on delete cascade,
  location_id uuid not null references clinic_locations (id),
  weekday integer not null check (weekday between 0 and 6),
  start_minute integer not null check (start_minute between 0 and 1439),
  end_minute integer not null check (end_minute between 1 and 1440),
  effective_from date,
  effective_until date,
  created_at timestamptz not null default now(),
  constraint recurring_availability_range check (end_minute > start_minute),
  constraint recurring_availability_effective check (
    effective_from is null or effective_until is null or effective_until >= effective_from
  )
);

create index recurring_availability_prof_idx on recurring_availability (professional_id, weekday);

create table availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals (id) on delete cascade,
  location_id uuid references clinic_locations (id),
  kind text not null check (kind in ('block', 'vacation', 'extra')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint availability_exceptions_range check (ends_at > starts_at),
  constraint availability_exceptions_note_len check (char_length(note) <= 160)
);

create index availability_exceptions_prof_idx on availability_exceptions (professional_id, starts_at);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  location_id uuid not null references clinic_locations (id),
  professional_id uuid not null references professionals (id),
  patient_id uuid not null references profiles (id),
  service_id uuid not null references services (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  buffer_minutes integer not null check (buffer_minutes between 0 and 120),
  status text not null check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  source text not null check (source in ('online', 'staff')),
  patient_note text,
  cancellation_reason text,
  created_by uuid references profiles (id),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_range check (ends_at > starts_at),
  constraint appointments_note_len check (patient_note is null or char_length(patient_note) <= 280),
  constraint appointments_reason_len check (cancellation_reason is null or char_length(cancellation_reason) <= 280)
);

create index appointments_professional_start_idx on appointments (professional_id, starts_at);
create index appointments_patient_start_idx on appointments (patient_id, starts_at desc);
create index appointments_org_start_idx on appointments (organization_id, starts_at);
create index appointments_active_idx on appointments (professional_id, starts_at) where status <> 'cancelled';

create table appointment_status_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id),
  from_status text,
  to_status text not null,
  actor_id uuid references profiles (id),
  note text,
  created_at timestamptz not null default now()
);

create index appointment_status_history_appt_idx on appointment_status_history (appointment_id, created_at);

create table notification_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references appointments (id),
  user_id uuid references profiles (id),
  organization_id uuid references organizations (id),
  kind text not null check (kind in (
    'booking_confirmed',
    'booking_pending',
    'booking_cancelled',
    'booking_rescheduled',
    'password_reset',
    'invitation',
    'reminder_24h'
  )),
  channel text not null default 'email' check (channel = 'email'),
  status text not null check (status in ('pending', 'sent', 'failed', 'skipped_unconfigured')),
  to_email text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index notification_events_status_idx on notification_events (status, created_at);
create index notification_events_user_idx on notification_events (user_id, created_at desc);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations (id),
  actor_id uuid references profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_org_idx on audit_logs (organization_id, created_at desc);

create table organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  email text not null,
  role text not null check (role in ('org_admin', 'professional', 'receptionist')),
  professional_id uuid references professionals (id),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index organization_invitations_org_idx on organization_invitations (organization_id, created_at desc);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index sessions_user_idx on sessions (user_id);

create table password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table rate_limits (
  bucket_key text not null,
  window_start timestamptz not null,
  hits integer not null,
  primary key (bucket_key, window_start)
);

-- Copias sin RLS para que las políticas puedan mirar rol y membresía
-- sin consultarse a sí mismas. El dueño publicado no puede saltear RLS.
create table profile_access_cache (
  user_id uuid primary key references profiles (id) on delete cascade,
  platform_role text not null,
  status text not null,
  deleted_at timestamptz
);

create table member_access_cache (
  organization_id uuid not null,
  user_id uuid not null references profiles (id) on delete cascade,
  role text not null,
  professional_id uuid,
  status text not null,
  primary key (organization_id, user_id)
);

create function sync_profile_access_cache() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from profile_access_cache where user_id = old.id;
    return old;
  end if;
  insert into profile_access_cache (user_id, platform_role, status, deleted_at)
  values (new.id, new.platform_role, new.status, new.deleted_at)
  on conflict (user_id) do update
    set platform_role = excluded.platform_role,
        status = excluded.status,
        deleted_at = excluded.deleted_at;
  return new;
end;
$$;

create trigger profiles_access_cache
after insert or update or delete on profiles
for each row execute function sync_profile_access_cache();

create function sync_member_access_cache() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from member_access_cache
    where organization_id = old.organization_id and user_id = old.user_id;
    return old;
  end if;
  if tg_op = 'UPDATE' and (new.organization_id <> old.organization_id or new.user_id <> old.user_id) then
    delete from member_access_cache
    where organization_id = old.organization_id and user_id = old.user_id;
  end if;
  insert into member_access_cache (organization_id, user_id, role, professional_id, status)
  values (new.organization_id, new.user_id, new.role, new.professional_id, new.status)
  on conflict (organization_id, user_id) do update
    set role = excluded.role,
        professional_id = excluded.professional_id,
        status = excluded.status;
  return new;
end;
$$;

create trigger members_access_cache
after insert or update or delete on organization_members
for each row execute function sync_member_access_cache();

create function current_platform_role() returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select c.platform_role
      from profile_access_cache c
      where c.user_id = current_app_user()
        and c.status = 'active'
        and c.deleted_at is null
    ),
    ''
  )
$$;

create function member_role(p_org uuid) returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from member_access_cache m
  where m.organization_id = p_org
    and m.user_id = current_app_user()
    and m.status = 'active'
$$;

create function set_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated before update on profiles
for each row execute function set_updated_at();
create trigger organizations_updated before update on organizations
for each row execute function set_updated_at();
create trigger clinic_locations_updated before update on clinic_locations
for each row execute function set_updated_at();
create trigger professionals_updated before update on professionals
for each row execute function set_updated_at();
create trigger organization_members_updated before update on organization_members
for each row execute function set_updated_at();
create trigger services_updated before update on services
for each row execute function set_updated_at();
create trigger appointments_updated before update on appointments
for each row execute function set_updated_at();

create function protect_profile() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.service', true) = 'on'
    or current_setting('app.seed', true) = 'on'
    or current_setting('app.allow_account_erasure', true) = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' and new.platform_role <> 'user' then
    raise exception 'forbidden';
  end if;
  if tg_op = 'UPDATE' and (
    new.platform_role is distinct from old.platform_role
    or new.status is distinct from old.status
    or new.password_hash is distinct from old.password_hash
    or new.is_demo is distinct from old.is_demo
    or lower(new.email) is distinct from lower(old.email)
    or new.deleted_at is distinct from old.deleted_at
  ) then
    raise exception 'forbidden';
  end if;
  return new;
end;
$$;

create trigger profiles_protect before insert or update on profiles
for each row execute function protect_profile();

create function protect_professional() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
    raise exception 'forbidden';
  end if;
  if new.user_id is not null and (tg_op = 'INSERT' or new.user_id is distinct from old.user_id) then
    if current_setting('app.service', true) <> 'on'
      and current_setting('app.seed', true) <> 'on'
      and current_setting('app.allow_professional_link', true) <> 'on' then
      raise exception 'forbidden';
    end if;
  end if;
  return new;
end;
$$;

create trigger professionals_protect before insert or update on professionals
for each row execute function protect_professional();

create function protect_last_admin() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'org_admin' and old.status = 'active'
    and (new.role <> 'org_admin' or new.status <> 'active') then
    if (
      select count(*)
      from organization_members m
      where m.organization_id = old.organization_id
        and m.role = 'org_admin'
        and m.status = 'active'
        and m.id <> old.id
    ) = 0 then
      raise exception 'last_admin';
    end if;
  end if;
  return new;
end;
$$;

create trigger organization_members_last_admin before update on organization_members
for each row execute function protect_last_admin();

create function same_organization_service() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
    raise exception 'forbidden';
  end if;
  return new;
end;
$$;

create trigger services_same_org before update on services
for each row execute function same_organization_service();

create trigger locations_same_org before update on clinic_locations
for each row execute function same_organization_service();

create function professional_link_same_org() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'professional_services' then
    if not exists (
      select 1
      from professionals p
      join services s on s.id = new.service_id
      where p.id = new.professional_id
        and p.organization_id = s.organization_id
    ) then
      raise exception 'cross_organization';
    end if;
  elsif tg_table_name = 'professional_specialties' then
    if not exists (select 1 from professionals p where p.id = new.professional_id) then
      raise exception 'cross_organization';
    end if;
  end if;
  return new;
end;
$$;

create trigger professional_services_same_org before insert or update on professional_services
for each row execute function professional_link_same_org();
create trigger professional_specialties_exist before insert or update on professional_specialties
for each row execute function professional_link_same_org();

create function availability_same_org() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.location_id is not null and not exists (
    select 1
    from professionals p
    join clinic_locations l on l.id = new.location_id
    where p.id = new.professional_id
      and p.organization_id = l.organization_id
  ) then
    raise exception 'cross_organization';
  end if;
  return new;
end;
$$;

create trigger recurring_same_org before insert or update on recurring_availability
for each row execute function availability_same_org();
create trigger exceptions_same_org before insert or update on availability_exceptions
for each row execute function availability_same_org();

create function invitation_same_org() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.professional_id is not null and not exists (
    select 1 from professionals p
    where p.id = new.professional_id and p.organization_id = new.organization_id
  ) then
    raise exception 'cross_organization';
  end if;
  return new;
end;
$$;

create trigger invitations_same_org before insert or update on organization_invitations
for each row execute function invitation_same_org();

create function appointments_same_org() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select p.organization_id into v_org from professionals p where p.id = new.professional_id;
  if v_org is null or new.organization_id <> v_org then
    raise exception 'cross_organization';
  end if;
  if not exists (
    select 1 from clinic_locations l
    where l.id = new.location_id and l.organization_id = v_org
  ) then
    raise exception 'cross_organization';
  end if;
  if not exists (
    select 1 from services s
    where s.id = new.service_id and s.organization_id = v_org
  ) then
    raise exception 'cross_organization';
  end if;
  if not exists (
    select 1 from professional_services ps
    where ps.professional_id = new.professional_id and ps.service_id = new.service_id
  ) then
    raise exception 'not_available';
  end if;
  return new;
end;
$$;

create trigger appointments_same_org before insert or update of organization_id, location_id, professional_id, service_id
on appointments
for each row execute function appointments_same_org();

create function appointments_prevent_overlap() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' then
    return new;
  end if;
  if tg_op = 'UPDATE'
    and new.starts_at = old.starts_at
    and new.ends_at = old.ends_at
    and new.professional_id = old.professional_id
    and new.buffer_minutes = old.buffer_minutes then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.professional_id::text, 0));
  if exists (
    select 1
    from appointments a
    where a.professional_id = new.professional_id
      and a.id <> new.id
      and a.status <> 'cancelled'
      and tstzrange(a.starts_at, a.ends_at + make_interval(mins => a.buffer_minutes))
        && tstzrange(new.starts_at, new.ends_at + make_interval(mins => new.buffer_minutes))
  ) then
    raise exception 'appointment_overlap';
  end if;
  return new;
end;
$$;

create trigger appointments_no_overlap before insert or update on appointments
for each row execute function appointments_prevent_overlap();

create function consume_rate_limit(p_key text, p_limit integer, p_window interval) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  perform set_config('app.internal', 'on', true);
  v_window := to_timestamp(
    floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window)
  );
  insert into rate_limits (bucket_key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (bucket_key, window_start)
  do update set hits = rate_limits.hits + 1
  returning hits into v_hits;
  if v_hits > p_limit then
    raise exception 'rate_limited';
  end if;
end;
$$;

create function assert_slot_available(
  p_professional_id uuid,
  p_service_id uuid,
  p_location_id uuid,
  p_starts_at timestamptz,
  p_ignore_appointment uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duration integer;
  v_buffer integer;
  v_tz text;
  v_local timestamp;
  v_date date;
  v_dow integer;
  v_minute integer;
  v_aligned boolean;
begin
  perform set_config('app.internal', 'on', true);
  if p_starts_at <= now() or p_starts_at > now() + interval '60 days' then
    raise exception 'slot_unavailable';
  end if;

  select s.duration_minutes, s.buffer_minutes
    into v_duration, v_buffer
  from services s
  join professionals p on p.organization_id = s.organization_id
  where s.id = p_service_id
    and p.id = p_professional_id
    and s.active
    and p.active
    and exists (
      select 1 from professional_services ps
      where ps.professional_id = p.id and ps.service_id = s.id
    );

  if v_duration is null then
    raise exception 'not_available';
  end if;

  select l.timezone into v_tz
  from clinic_locations l
  join professionals p on p.organization_id = l.organization_id
  where l.id = p_location_id
    and p.id = p_professional_id
    and l.active;

  if v_tz is null then
    raise exception 'not_available';
  end if;

  v_local := p_starts_at at time zone v_tz;
  if extract(second from v_local) <> 0 then
    raise exception 'slot_unavailable';
  end if;
  v_date := v_local::date;
  v_dow := extract(dow from v_local)::integer;
  v_minute := extract(hour from v_local)::integer * 60 + extract(minute from v_local)::integer;

  select exists (
    select 1
    from recurring_availability r
    where r.professional_id = p_professional_id
      and r.location_id = p_location_id
      and r.weekday = v_dow
      and (r.effective_from is null or r.effective_from <= v_date)
      and (r.effective_until is null or r.effective_until >= v_date)
      and v_minute >= r.start_minute
      and v_minute + v_duration <= r.end_minute
      and mod(v_minute - r.start_minute, v_duration + v_buffer) = 0
  ) or exists (
    select 1
    from availability_exceptions e
    where e.professional_id = p_professional_id
      and e.kind = 'extra'
      and (e.location_id is null or e.location_id = p_location_id)
      and p_starts_at >= e.starts_at
      and p_starts_at + make_interval(mins => v_duration) <= e.ends_at
      and mod((extract(epoch from (p_starts_at - e.starts_at)) / 60)::integer, v_duration + v_buffer) = 0
  ) into v_aligned;

  if not v_aligned then
    raise exception 'slot_unavailable';
  end if;

  if exists (
    select 1
    from availability_exceptions e
    where e.professional_id = p_professional_id
      and e.kind in ('block', 'vacation')
      and tstzrange(e.starts_at, e.ends_at)
        && tstzrange(p_starts_at, p_starts_at + make_interval(mins => v_duration))
  ) then
    raise exception 'slot_unavailable';
  end if;

  if exists (
    select 1
    from appointments a
    where a.professional_id = p_professional_id
      and a.status <> 'cancelled'
      and (p_ignore_appointment is null or a.id <> p_ignore_appointment)
      and tstzrange(a.starts_at, a.ends_at + make_interval(mins => a.buffer_minutes))
        && tstzrange(p_starts_at, p_starts_at + make_interval(mins => v_duration + v_buffer))
  ) then
    raise exception 'slot_unavailable';
  end if;
end;
$$;

create function write_booking_notification(
  p_appointment uuid,
  p_kind text,
  p_subject text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform set_config('app.internal', 'on', true);
  insert into notification_events (
    appointment_id, user_id, organization_id, kind, status, to_email, subject, payload
  )
  select
    a.id,
    a.patient_id,
    a.organization_id,
    p_kind,
    'pending',
    p.email,
    p_subject,
    jsonb_build_object(
      'startsAt', a.starts_at,
      'endsAt', a.ends_at,
      'timezone', l.timezone,
      'professionalName', pr.full_name,
      'serviceName', s.name,
      'organizationName', o.name,
      'locationName', l.name,
      'address', l.address,
      'city', l.city,
      'department', l.department,
      'status', a.status,
      'patientName', p.full_name
    )
  from appointments a
  join profiles p on p.id = a.patient_id
  join professionals pr on pr.id = a.professional_id
  join services s on s.id = a.service_id
  join organizations o on o.id = a.organization_id
  join clinic_locations l on l.id = a.location_id
  where a.id = p_appointment
  returning id into v_id;
  return v_id;
end;
$$;

create function book_appointment(
  p_professional_id uuid,
  p_service_id uuid,
  p_location_id uuid,
  p_starts_at timestamptz,
  p_patient_id uuid,
  p_source text,
  p_note text
) returns table (appointment_id uuid, notification_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := current_app_user();
  v_prof professionals%rowtype;
  v_service services%rowtype;
  v_org organizations%rowtype;
  v_patient uuid;
  v_role text;
  v_status text;
  v_id uuid;
  v_note text;
  v_notification uuid;
begin
  perform set_config('app.internal', 'on', true);
  if v_user is null then
    raise exception 'auth_required';
  end if;
  if p_source not in ('online', 'staff') then
    raise exception 'forbidden';
  end if;

  select * into v_prof from professionals where id = p_professional_id;
  if not found or not v_prof.active then
    raise exception 'not_available';
  end if;
  select * into v_org from organizations where id = v_prof.organization_id;
  if v_org.status = 'suspended' or (v_org.status <> 'active' and p_source = 'online') then
    raise exception 'not_available';
  end if;
  select * into v_service
  from services
  where id = p_service_id and organization_id = v_prof.organization_id and active;
  if not found then
    raise exception 'not_available';
  end if;

  v_patient := coalesce(p_patient_id, v_user);
  v_role := member_role(v_prof.organization_id);

  if p_source = 'online' and v_patient <> v_user then
    raise exception 'forbidden';
  end if;
  if p_source = 'staff' and (v_role is null or v_role not in ('org_admin', 'receptionist')) then
    raise exception 'forbidden';
  end if;
  if not exists (
    select 1 from profiles p
    where p.id = v_patient and p.status = 'active' and p.deleted_at is null
  ) then
    raise exception 'not_available';
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 280 then
    raise exception 'invalid_note';
  end if;

  if p_source = 'online' then
    perform consume_rate_limit('book:' || v_user::text, 8, interval '1 hour');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_professional_id::text, 0));
  perform assert_slot_available(p_professional_id, p_service_id, p_location_id, p_starts_at, null);

  v_status := case when v_org.require_confirmation then 'pending' else 'confirmed' end;

  insert into appointments (
    organization_id, location_id, professional_id, patient_id, service_id,
    starts_at, ends_at, buffer_minutes, status, source, patient_note, created_by
  ) values (
    v_prof.organization_id,
    p_location_id,
    p_professional_id,
    v_patient,
    p_service_id,
    p_starts_at,
    p_starts_at + make_interval(mins => v_service.duration_minutes),
    v_service.buffer_minutes,
    v_status,
    p_source,
    v_note,
    v_user
  ) returning id into v_id;

  insert into appointment_status_history (appointment_id, from_status, to_status, actor_id, note)
  values (v_id, null, v_status, v_user, p_source);

  insert into audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_prof.organization_id,
    v_user,
    'appointment.book',
    'appointment',
    v_id,
    jsonb_build_object('status', v_status, 'source', p_source)
  );

  v_notification := write_booking_notification(
    v_id,
    case when v_status = 'pending' then 'booking_pending' else 'booking_confirmed' end,
    case when v_status = 'pending' then 'Recibimos tu solicitud de consulta' else 'Tu consulta quedó reservada' end
  );

  return query select v_id, v_notification;
end;
$$;

create function cancel_appointment(p_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := current_app_user();
  v_appt appointments%rowtype;
  v_role text;
  v_staff boolean;
  v_hours integer;
  v_reason text;
begin
  perform set_config('app.internal', 'on', true);
  if v_user is null then
    raise exception 'auth_required';
  end if;
  select * into v_appt from appointments where id = p_id;
  if not found then
    raise exception 'not_available';
  end if;
  v_role := member_role(v_appt.organization_id);
  v_staff := v_role in ('org_admin', 'receptionist')
    or (
      v_role = 'professional'
      and v_appt.professional_id = (
        select m.professional_id
        from organization_members m
        where m.organization_id = v_appt.organization_id
          and m.user_id = v_user
          and m.status = 'active'
      )
    );
  if v_appt.patient_id <> v_user and not v_staff then
    raise exception 'forbidden';
  end if;
  if v_appt.status not in ('pending', 'confirmed') then
    raise exception 'invalid_transition';
  end if;
  if v_appt.patient_id = v_user and not v_staff then
    select cancellation_hours into v_hours from organizations where id = v_appt.organization_id;
    if now() > v_appt.starts_at - make_interval(hours => v_hours) then
      raise exception 'cancellation_window';
    end if;
  end if;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is not null and char_length(v_reason) > 280 then
    raise exception 'invalid_note';
  end if;

  update appointments
  set status = 'cancelled',
      cancellation_reason = v_reason,
      cancelled_at = now()
  where id = p_id;

  insert into appointment_status_history (appointment_id, from_status, to_status, actor_id, note)
  values (p_id, v_appt.status, 'cancelled', v_user, v_reason);

  insert into audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_appt.organization_id, v_user, 'appointment.cancel', 'appointment', p_id, '{}'::jsonb);

  return write_booking_notification(p_id, 'booking_cancelled', 'Tu consulta fue cancelada');
end;
$$;

create function reschedule_appointment(p_id uuid, p_starts_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := current_app_user();
  v_appt appointments%rowtype;
  v_role text;
  v_staff boolean;
  v_hours integer;
  v_service services%rowtype;
begin
  perform set_config('app.internal', 'on', true);
  if v_user is null then
    raise exception 'auth_required';
  end if;
  select * into v_appt from appointments where id = p_id for update;
  if not found then
    raise exception 'not_available';
  end if;
  v_role := member_role(v_appt.organization_id);
  v_staff := v_role in ('org_admin', 'receptionist')
    or (
      v_role = 'professional'
      and v_appt.professional_id = (
        select m.professional_id
        from organization_members m
        where m.organization_id = v_appt.organization_id
          and m.user_id = v_user
          and m.status = 'active'
      )
    );
  if v_appt.patient_id <> v_user and not v_staff then
    raise exception 'forbidden';
  end if;
  if v_appt.status not in ('pending', 'confirmed') then
    raise exception 'invalid_transition';
  end if;
  if v_appt.patient_id = v_user and not v_staff then
    select cancellation_hours into v_hours from organizations where id = v_appt.organization_id;
    if now() > v_appt.starts_at - make_interval(hours => v_hours) then
      raise exception 'cancellation_window';
    end if;
  end if;

  select * into v_service from services where id = v_appt.service_id and active;
  if not found then
    raise exception 'not_available';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_appt.professional_id::text, 0));
  perform assert_slot_available(
    v_appt.professional_id,
    v_appt.service_id,
    v_appt.location_id,
    p_starts_at,
    v_appt.id
  );

  update appointments
  set starts_at = p_starts_at,
      ends_at = p_starts_at + make_interval(mins => v_service.duration_minutes),
      buffer_minutes = v_service.buffer_minutes
  where id = p_id;

  insert into appointment_status_history (appointment_id, from_status, to_status, actor_id, note)
  values (p_id, v_appt.status, v_appt.status, v_user, 'reprogramada');

  insert into audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_appt.organization_id,
    v_user,
    'appointment.reschedule',
    'appointment',
    p_id,
    jsonb_build_object('from', v_appt.starts_at, 'to', p_starts_at)
  );

  return write_booking_notification(p_id, 'booking_rescheduled', 'Tu consulta fue reprogramada');
end;
$$;

create function transition_appointment(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := current_app_user();
  v_appt appointments%rowtype;
  v_role text;
  v_allowed boolean;
begin
  perform set_config('app.internal', 'on', true);
  if v_user is null then
    raise exception 'auth_required';
  end if;
  if p_status not in ('confirmed', 'completed', 'no_show') then
    raise exception 'invalid_transition';
  end if;
  select * into v_appt from appointments where id = p_id for update;
  if not found then
    raise exception 'not_available';
  end if;
  v_role := member_role(v_appt.organization_id);
  v_allowed := v_role in ('org_admin', 'receptionist')
    or (
      v_role = 'professional'
      and v_appt.professional_id = (
        select m.professional_id
        from organization_members m
        where m.organization_id = v_appt.organization_id
          and m.user_id = v_user
          and m.status = 'active'
      )
    );
  if not v_allowed then
    raise exception 'forbidden';
  end if;
  if p_status = 'confirmed' and v_appt.status <> 'pending' then
    raise exception 'invalid_transition';
  end if;
  if p_status in ('completed', 'no_show') then
    if v_appt.status <> 'confirmed' then
      raise exception 'invalid_transition';
    end if;
    if v_appt.starts_at > now() then
      raise exception 'invalid_transition';
    end if;
  end if;

  update appointments set status = p_status where id = p_id;
  insert into appointment_status_history (appointment_id, from_status, to_status, actor_id)
  values (p_id, v_appt.status, p_status, v_user);
  insert into audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_appt.organization_id,
    v_user,
    'appointment.transition',
    'appointment',
    p_id,
    jsonb_build_object('from', v_appt.status, 'to', p_status)
  );

  if p_status = 'confirmed' then
    perform write_booking_notification(p_id, 'booking_confirmed', 'Tu consulta quedó confirmada');
  end if;
end;
$$;

create function professional_busy_ranges(
  p_professional uuid,
  p_from timestamptz,
  p_to timestamptz
) returns table (starts_at timestamptz, ends_at timestamptz, buffer_minutes integer)
language sql
stable
security definer
set search_path = public
as $$
  select a.starts_at, a.ends_at, a.buffer_minutes
  from appointments a
  join professionals p on p.id = a.professional_id
  join organizations o on o.id = p.organization_id
  where a.professional_id = p_professional
    and a.status <> 'cancelled'
    and a.starts_at < p_to
    and a.ends_at > p_from
    and p.active
    and o.status = 'active'
$$;

create function register_user(
  p_email text,
  p_password_hash text,
  p_full_name text,
  p_phone text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text := lower(trim(p_email));
begin
  perform set_config('app.internal', 'on', true);
  if current_setting('app.service', true) <> 'on' then
    raise exception 'forbidden';
  end if;
  if char_length(trim(p_full_name)) < 2 then
    raise exception 'invalid_name';
  end if;
  insert into profiles (email, password_hash, full_name, phone, platform_role, status)
  values (v_email, p_password_hash, trim(p_full_name), nullif(trim(coalesce(p_phone, '')), ''), 'user', 'active')
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'email_taken';
end;
$$;

create function find_or_create_patient(
  p_organization_id uuid,
  p_email text,
  p_full_name text,
  p_phone text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_id uuid;
  v_role text;
begin
  perform set_config('app.internal', 'on', true);
  v_role := member_role(p_organization_id);
  if v_role is null or v_role not in ('org_admin', 'receptionist') then
    raise exception 'forbidden';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email';
  end if;
  if char_length(trim(p_full_name)) < 2 then
    raise exception 'invalid_name';
  end if;
  perform consume_rate_limit('patient-lookup:' || current_app_user()::text, 30, interval '1 hour');
  select id into v_id from profiles where lower(email) = v_email and deleted_at is null;
  if found then
    return v_id;
  end if;
  insert into profiles (email, password_hash, full_name, phone, platform_role, status)
  values (v_email, '!', trim(p_full_name), nullif(trim(coalesce(p_phone, '')), ''), 'user', 'active')
  returning id into v_id;
  return v_id;
end;
$$;

create function create_organization(
  p_name text,
  p_slug text,
  p_description text,
  p_phone text,
  p_email text,
  p_address text,
  p_city text,
  p_department text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := current_app_user();
  v_id uuid;
begin
  perform set_config('app.internal', 'on', true);
  if v_user is null then
    raise exception 'auth_required';
  end if;
  if current_platform_role() = 'superadmin' then
    raise exception 'forbidden';
  end if;
  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid_slug';
  end if;
  if char_length(trim(p_name)) < 2 then
    raise exception 'invalid_name';
  end if;
  insert into organizations (name, slug, description, phone, email, status, is_demo)
  values (
    trim(p_name),
    p_slug,
    coalesce(p_description, ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(lower(trim(coalesce(p_email, ''))), ''),
    'pending',
    false
  )
  returning id into v_id;
  insert into organization_members (organization_id, user_id, role, status)
  values (v_id, v_user, 'org_admin', 'active');
  insert into clinic_locations (organization_id, name, address, city, department, timezone)
  values (
    v_id,
    'Sede principal',
    trim(p_address),
    trim(p_city),
    trim(p_department),
    'America/Montevideo'
  );
  insert into audit_logs (organization_id, actor_id, action, entity_type, entity_id)
  values (v_id, v_user, 'organization.create', 'organization', v_id);
  insert into audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    null,
    v_user,
    'platform.organization_pending',
    'organization',
    v_id,
    jsonb_build_object('name', trim(p_name), 'slug', p_slug)
  );
  return v_id;
exception
  when unique_violation then
    raise exception 'slug_taken';
end;
$$;

create function set_organization_status(p_id uuid, p_status text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.internal', 'on', true);
  if current_platform_role() <> 'superadmin' then
    raise exception 'forbidden';
  end if;
  if p_status not in ('pending', 'active', 'suspended') then
    raise exception 'invalid_transition';
  end if;
  update organizations set status = p_status where id = p_id;
  if not found then
    raise exception 'not_available';
  end if;
  insert into audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    null,
    current_app_user(),
    'platform.organization_status',
    'organization',
    p_id,
    jsonb_build_object('status', p_status)
  );
end;
$$;

create function add_specialty(p_name text, p_slug text) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform set_config('app.internal', 'on', true);
  if current_platform_role() <> 'superadmin' then
    raise exception 'forbidden';
  end if;
  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid_slug';
  end if;
  insert into specialties (name, slug)
  values (trim(p_name), p_slug)
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'slug_taken';
end;
$$;

create function platform_overview()
returns table (
  organization_count bigint,
  active_organization_count bigint,
  user_count bigint,
  appointment_count bigint,
  upcoming_appointment_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.internal', 'on', true);
  if current_platform_role() <> 'superadmin' then
    raise exception 'forbidden';
  end if;
  return query
  select
    (select count(*) from organizations),
    (select count(*) from organizations where status = 'active'),
    (select count(*) from profiles where deleted_at is null),
    (select count(*) from appointments),
    (select count(*) from appointments where status in ('pending', 'confirmed') and starts_at >= now());
end;
$$;

create function platform_organizations()
returns table (
  id uuid,
  name text,
  slug text,
  status text,
  city text,
  member_count bigint,
  professional_count bigint,
  appointment_count bigint,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.internal', 'on', true);
  if current_platform_role() <> 'superadmin' then
    raise exception 'forbidden';
  end if;
  return query
  select
    o.id,
    o.name,
    o.slug,
    o.status,
    (select l.city from clinic_locations l where l.organization_id = o.id order by l.created_at limit 1),
    (select count(*) from organization_members m where m.organization_id = o.id and m.status = 'active'),
    (select count(*) from professionals p where p.organization_id = o.id and p.active),
    (select count(*) from appointments a where a.organization_id = o.id),
    o.created_at
  from organizations o
  order by o.created_at desc;
end;
$$;

create function invitation_preview(p_token_hash text)
returns table (
  email text,
  organization_name text,
  organization_slug text,
  role text,
  expires_at timestamptz,
  accepted boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.email,
    o.name,
    o.slug,
    i.role,
    i.expires_at,
    i.accepted_at is not null
  from organization_invitations i
  join organizations o on o.id = i.organization_id
  where i.token_hash = p_token_hash
$$;

create function accept_invitation(p_token_hash text) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := current_app_user();
  v_inv organization_invitations%rowtype;
  v_email text;
begin
  perform set_config('app.internal', 'on', true);
  if v_user is null then
    raise exception 'auth_required';
  end if;
  select * into v_inv from organization_invitations where token_hash = p_token_hash for update;
  if not found then
    raise exception 'not_available';
  end if;
  if v_inv.accepted_at is not null or v_inv.expires_at < now() then
    raise exception 'not_available';
  end if;
  select lower(email) into v_email from profiles where id = v_user and deleted_at is null and status = 'active';
  if v_email is null or v_email <> lower(v_inv.email) then
    raise exception 'forbidden';
  end if;
  insert into organization_members (organization_id, user_id, role, professional_id, status)
  values (v_inv.organization_id, v_user, v_inv.role, v_inv.professional_id, 'active')
  on conflict (organization_id, user_id) do update
    set role = excluded.role,
        professional_id = coalesce(excluded.professional_id, organization_members.professional_id),
        status = 'active';
  if v_inv.professional_id is not null then
    perform set_config('app.allow_professional_link', 'on', true);
    update professionals
    set user_id = v_user
    where id = v_inv.professional_id
      and organization_id = v_inv.organization_id
      and (user_id is null or user_id = v_user);
  end if;
  update organization_invitations set accepted_at = now() where id = v_inv.id;
  insert into audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    v_inv.organization_id,
    v_user,
    'member.accept_invitation',
    'organization_member',
    v_user,
    jsonb_build_object('role', v_inv.role)
  );
  return v_inv.organization_id;
end;
$$;

create function delete_own_account() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := current_app_user();
begin
  perform set_config('app.internal', 'on', true);
  if v_user is null then
    raise exception 'auth_required';
  end if;
  if current_platform_role() = 'superadmin' then
    raise exception 'forbidden';
  end if;
  perform set_config('app.allow_account_erasure', 'on', true);
  update appointments
  set status = 'cancelled',
      cancellation_reason = 'Cuenta eliminada',
      cancelled_at = now()
  where patient_id = v_user
    and status in ('pending', 'confirmed')
    and starts_at > now();
  update profiles
  set full_name = 'Paciente eliminado',
      email = 'deleted+' || id::text || '@invalid.alba',
      phone = null,
      birth_date = null,
      password_hash = '!',
      status = 'disabled',
      deleted_at = now()
  where id = v_user;
  delete from sessions where user_id = v_user;
  delete from password_reset_tokens where user_id = v_user;
end;
$$;

create function issue_password_reset(p_email text, p_token_hash text) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform set_config('app.internal', 'on', true);
  if current_setting('app.service', true) <> 'on' then
    raise exception 'forbidden';
  end if;
  select id into v_id
  from profiles
  where lower(email) = lower(trim(p_email))
    and status = 'active'
    and deleted_at is null
    and password_hash like 'scrypt$%';
  if v_id is null then
    return false;
  end if;
  delete from password_reset_tokens where user_id = v_id and used_at is null;
  insert into password_reset_tokens (user_id, token_hash, expires_at)
  values (v_id, p_token_hash, now() + interval '30 minutes');
  insert into notification_events (user_id, kind, status, to_email, subject, payload)
  values (
    v_id,
    'password_reset',
    'pending',
    lower(trim(p_email)),
    'Recuperar acceso a Alba',
    jsonb_build_object('expiresInMinutes', 30)
  );
  return true;
end;
$$;

create function consume_password_reset(p_token_hash text, p_password_hash text) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  perform set_config('app.internal', 'on', true);
  if current_setting('app.service', true) <> 'on' then
    raise exception 'forbidden';
  end if;
  select user_id into v_user
  from password_reset_tokens
  where token_hash = p_token_hash
    and used_at is null
    and expires_at > now()
  for update;
  if v_user is null then
    return false;
  end if;
  update password_reset_tokens set used_at = now() where token_hash = p_token_hash;
  update profiles set password_hash = p_password_hash where id = v_user and deleted_at is null;
  delete from sessions where user_id = v_user;
  return true;
end;
$$;

create function enqueue_reminders() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row record;
  v_id uuid;
begin
  perform set_config('app.internal', 'on', true);
  if current_setting('app.service', true) <> 'on' then
    raise exception 'forbidden';
  end if;
  for v_row in
    select a.id
    from appointments a
    where a.status = 'confirmed'
      and a.starts_at >= now() + interval '23 hours'
      and a.starts_at < now() + interval '25 hours'
      and not exists (
        select 1 from notification_events n
        where n.appointment_id = a.id and n.kind = 'reminder_24h'
      )
  loop
    v_id := write_booking_notification(v_row.id, 'reminder_24h', 'Recordatorio: tenés una consulta mañana');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Permisos de app_rls. Las columnas sensibles de profiles no se pueden leer ni escribir.
grant select (
  id, email, full_name, phone, birth_date, platform_role, status, is_demo, created_at, updated_at, deleted_at
) on profiles to app_rls;
grant update (full_name, phone, birth_date) on profiles to app_rls;

grant select on organizations to app_rls;
grant update (
  name, slug, description, phone, email, cancellation_hours, require_confirmation, logo_bytes, logo_mime
) on organizations to app_rls;

grant select, insert, update, delete on clinic_locations to app_rls;
grant select on specialties to app_rls;
grant select, insert on professionals to app_rls;
grant update (full_name, license_number, bio, can_manage_availability, active, color) on professionals to app_rls;
grant select (id, organization_id, user_id, role, professional_id, status, created_at, updated_at) on organization_members to app_rls;
grant update (role, status, professional_id) on organization_members to app_rls;
grant select, insert, update, delete on services to app_rls;
grant select, insert, delete on professional_specialties to app_rls;
grant select, insert, delete on professional_services to app_rls;
grant select, insert, update, delete on recurring_availability to app_rls;
grant select, insert, update, delete on availability_exceptions to app_rls;
grant select on appointments to app_rls;
grant select on appointment_status_history to app_rls;
grant select on notification_events to app_rls;
grant select on audit_logs to app_rls;
grant select, insert, delete on organization_invitations to app_rls;

alter table profiles enable row level security;
alter table profiles force row level security;
alter table organizations enable row level security;
alter table organizations force row level security;
alter table clinic_locations enable row level security;
alter table clinic_locations force row level security;
alter table specialties enable row level security;
alter table specialties force row level security;
alter table professionals enable row level security;
alter table professionals force row level security;
alter table organization_members enable row level security;
alter table organization_members force row level security;
alter table services enable row level security;
alter table services force row level security;
alter table professional_specialties enable row level security;
alter table professional_specialties force row level security;
alter table professional_services enable row level security;
alter table professional_services force row level security;
alter table recurring_availability enable row level security;
alter table recurring_availability force row level security;
alter table availability_exceptions enable row level security;
alter table availability_exceptions force row level security;
alter table appointments enable row level security;
alter table appointments force row level security;
alter table appointment_status_history enable row level security;
alter table appointment_status_history force row level security;
alter table notification_events enable row level security;
alter table notification_events force row level security;
alter table audit_logs enable row level security;
alter table audit_logs force row level security;
alter table organization_invitations enable row level security;
alter table organization_invitations force row level security;
alter table sessions enable row level security;
alter table sessions force row level security;
alter table password_reset_tokens enable row level security;
alter table password_reset_tokens force row level security;
alter table rate_limits enable row level security;
alter table rate_limits force row level security;

create policy profiles_select on profiles for select using (
  id = current_app_user()
  or (
    current_platform_role() = 'superadmin'
    and (
      platform_role = 'superadmin'
      or exists (select 1 from organization_members staff where staff.user_id = profiles.id)
    )
  )
  or exists (
    select 1
    from organization_members me
    join organization_members them
      on them.organization_id = me.organization_id
     and them.user_id = profiles.id
    where me.user_id = current_app_user()
      and me.status = 'active'
  )
  or exists (
    select 1
    from appointments a
    join organization_members me on me.organization_id = a.organization_id
    where a.patient_id = profiles.id
      and me.user_id = current_app_user()
      and me.status = 'active'
      and (
        me.role in ('org_admin', 'receptionist')
        or (me.role = 'professional' and me.professional_id = a.professional_id)
      )
  )
);

create policy profiles_update on profiles for update
using (id = current_app_user())
with check (id = current_app_user());

create policy organizations_select on organizations for select using (
  status = 'active'
  or member_role(id) is not null
  or current_platform_role() = 'superadmin'
);

create policy organizations_update on organizations for update
using (member_role(id) = 'org_admin')
with check (member_role(id) = 'org_admin');

create policy locations_select on clinic_locations for select using (
  (active and exists (
    select 1 from organizations o where o.id = organization_id and o.status = 'active'
  ))
  or member_role(organization_id) is not null
);

create policy locations_write on clinic_locations for all
using (member_role(organization_id) = 'org_admin')
with check (member_role(organization_id) = 'org_admin');

create policy specialties_select on specialties for select using (true);

create policy professionals_select on professionals for select using (
  (active and exists (
    select 1 from organizations o where o.id = organization_id and o.status = 'active'
  ))
  or member_role(organization_id) is not null
);

create policy professionals_write on professionals for all
using (member_role(organization_id) = 'org_admin')
with check (member_role(organization_id) = 'org_admin');

create policy members_select on organization_members for select using (
  user_id = current_app_user()
  or member_role(organization_id) is not null
  or current_platform_role() = 'superadmin'
);

create policy members_update on organization_members for update
using (member_role(organization_id) = 'org_admin')
with check (
  member_role(organization_id) = 'org_admin'
  and role in ('org_admin', 'professional', 'receptionist')
);

create policy services_select on services for select using (
  (active and exists (
    select 1 from organizations o where o.id = organization_id and o.status = 'active'
  ))
  or member_role(organization_id) is not null
);

create policy services_write on services for all
using (member_role(organization_id) = 'org_admin')
with check (member_role(organization_id) = 'org_admin');

create policy professional_specialties_select on professional_specialties for select using (
  exists (
    select 1 from professionals p
    join organizations o on o.id = p.organization_id
    where p.id = professional_id
      and ((p.active and o.status = 'active') or member_role(p.organization_id) is not null)
  )
);

create policy professional_specialties_write on professional_specialties for all
using (
  exists (
    select 1 from professionals p
    where p.id = professional_id and member_role(p.organization_id) = 'org_admin'
  )
)
with check (
  exists (
    select 1 from professionals p
    where p.id = professional_id and member_role(p.organization_id) = 'org_admin'
  )
);

create policy professional_services_select on professional_services for select using (
  exists (
    select 1 from professionals p
    join organizations o on o.id = p.organization_id
    where p.id = professional_id
      and ((p.active and o.status = 'active') or member_role(p.organization_id) is not null)
  )
);

create policy professional_services_write on professional_services for all
using (
  exists (
    select 1 from professionals p
    where p.id = professional_id and member_role(p.organization_id) = 'org_admin'
  )
)
with check (
  exists (
    select 1 from professionals p
    where p.id = professional_id and member_role(p.organization_id) = 'org_admin'
  )
);

create policy availability_select on recurring_availability for select using (
  exists (
    select 1
    from professionals p
    join organizations o on o.id = p.organization_id
    where p.id = professional_id
      and ((p.active and o.status = 'active') or member_role(p.organization_id) is not null)
  )
);

create policy availability_write on recurring_availability for all
using (
  exists (
    select 1 from professionals p
    where p.id = professional_id
      and (
        member_role(p.organization_id) = 'org_admin'
        or (
          member_role(p.organization_id) = 'professional'
          and p.user_id = current_app_user()
          and p.can_manage_availability
        )
      )
  )
)
with check (
  exists (
    select 1 from professionals p
    where p.id = professional_id
      and (
        member_role(p.organization_id) = 'org_admin'
        or (
          member_role(p.organization_id) = 'professional'
          and p.user_id = current_app_user()
          and p.can_manage_availability
        )
      )
  )
);

create policy exceptions_select on availability_exceptions for select using (
  exists (
    select 1
    from professionals p
    join organizations o on o.id = p.organization_id
    where p.id = professional_id
      and ((p.active and o.status = 'active') or member_role(p.organization_id) is not null)
  )
);

create policy exceptions_write on availability_exceptions for all
using (
  exists (
    select 1 from professionals p
    where p.id = professional_id
      and (
        member_role(p.organization_id) = 'org_admin'
        or (
          member_role(p.organization_id) = 'professional'
          and p.user_id = current_app_user()
          and p.can_manage_availability
        )
      )
  )
)
with check (
  exists (
    select 1 from professionals p
    where p.id = professional_id
      and (
        member_role(p.organization_id) = 'org_admin'
        or (
          member_role(p.organization_id) = 'professional'
          and p.user_id = current_app_user()
          and p.can_manage_availability
        )
      )
  )
);

create policy appointments_select on appointments for select using (
  patient_id = current_app_user()
  or member_role(organization_id) in ('org_admin', 'receptionist')
  or (
    member_role(organization_id) = 'professional'
    and professional_id = (
      select m.professional_id
      from organization_members m
      where m.user_id = current_app_user()
        and m.organization_id = appointments.organization_id
        and m.status = 'active'
    )
  )
);

create policy history_select on appointment_status_history for select using (
  exists (select 1 from appointments a where a.id = appointment_id)
);

create policy notifications_select on notification_events for select using (
  user_id = current_app_user()
  or (
    organization_id is not null
    and member_role(organization_id) in ('org_admin', 'receptionist')
    and kind <> 'password_reset'
  )
);

create policy audit_select on audit_logs for select using (
  (organization_id is not null and member_role(organization_id) = 'org_admin')
  or (organization_id is null and current_platform_role() = 'superadmin')
);

create policy invitations_admin on organization_invitations for all
using (member_role(organization_id) = 'org_admin')
with check (
  member_role(organization_id) = 'org_admin'
  and role in ('org_admin', 'professional', 'receptionist')
);

grant execute on function current_app_user() to app_rls;
grant execute on function current_platform_role() to app_rls;
grant execute on function member_role(uuid) to app_rls;
grant execute on function book_appointment(uuid, uuid, uuid, timestamptz, uuid, text, text) to app_rls;
grant execute on function cancel_appointment(uuid, text) to app_rls;
grant execute on function reschedule_appointment(uuid, timestamptz) to app_rls;
grant execute on function transition_appointment(uuid, text) to app_rls;
grant execute on function professional_busy_ranges(uuid, timestamptz, timestamptz) to app_rls;
grant execute on function find_or_create_patient(uuid, text, text, text) to app_rls;
grant execute on function create_organization(text, text, text, text, text, text, text, text) to app_rls;
grant execute on function set_organization_status(uuid, text) to app_rls;
grant execute on function add_specialty(text, text) to app_rls;
grant execute on function platform_overview() to app_rls;
grant execute on function platform_organizations() to app_rls;
grant execute on function invitation_preview(text) to app_rls;
grant execute on function accept_invitation(text) to app_rls;
grant execute on function delete_own_account() to app_rls;

revoke all on function consume_rate_limit(text, integer, interval) from public;
revoke all on function assert_slot_available(uuid, uuid, uuid, timestamptz, uuid) from public;
revoke all on function write_booking_notification(uuid, text, text) from public;
revoke all on function register_user(text, text, text, text) from public;
revoke all on function issue_password_reset(text, text) from public;
revoke all on function consume_password_reset(text, text) from public;
revoke all on function enqueue_reminders() from public;
revoke all on function protect_profile() from public;
revoke all on function protect_professional() from public;
revoke all on function protect_last_admin() from public;
revoke all on function appointments_prevent_overlap() from public;
revoke all on function appointments_same_org() from public;
revoke all on function invitation_same_org() from public;
