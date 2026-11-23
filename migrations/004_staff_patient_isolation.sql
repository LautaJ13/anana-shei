-- Un consultorio no puede adjuntar la cuenta de alguien que no es su paciente.
alter table profiles add column if not exists contact_email text;

create or replace function find_or_create_patient(
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
  if not exists (
    select 1 from organizations o
    where o.id = p_organization_id and o.status = 'active'
  ) then
    raise exception 'forbidden';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email';
  end if;
  if char_length(trim(p_full_name)) < 2 then
    raise exception 'invalid_name';
  end if;
  perform consume_rate_limit('patient-lookup:' || current_app_user()::text, 30, interval '1 hour');
  select p.id into v_id
  from profiles p
  where p.deleted_at is null
    and (
      lower(p.email) = v_email
      or lower(coalesce(p.contact_email, '')) = v_email
    )
    and exists (
      select 1 from appointments a
      where a.patient_id = p.id and a.organization_id = p_organization_id
    )
  limit 1;
  if found then
    return v_id;
  end if;
  insert into profiles (email, password_hash, full_name, phone, contact_email, platform_role, status)
  values (
    'staff-' || replace(gen_random_uuid()::text, '-', '') || '@patients.alba.invalid',
    '!',
    trim(p_full_name),
    nullif(trim(coalesce(p_phone, '')), ''),
    v_email,
    'user',
    'active'
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function appointments_guard_staff_patient() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.internal', 'on', true);
  if current_setting('app.seed', true) = 'on' or new.source <> 'staff' then
    return new;
  end if;
  if exists (
    select 1 from appointments a
    where a.patient_id = new.patient_id
      and a.organization_id = new.organization_id
  ) then
    return new;
  end if;
  if exists (
    select 1 from profiles p
    where p.id = new.patient_id
      and p.password_hash = '!'
      and p.deleted_at is null
      and p.email ~ '^staff-[0-9a-f]+@patients\.alba\.invalid$'
      and not exists (select 1 from appointments other where other.patient_id = p.id)
  ) then
    return new;
  end if;
  raise exception 'patient_outside_clinic';
end;
$$;

drop trigger if exists appointments_guard_staff_patient on appointments;
create trigger appointments_guard_staff_patient
before insert or update on appointments
for each row execute function appointments_guard_staff_patient();

revoke all on function find_or_create_patient(uuid, text, text, text) from public;
revoke all on function appointments_guard_staff_patient() from public;
