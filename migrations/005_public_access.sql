-- La base ya publicada no vuelve a correr 001 ni 004. Estas reglas cubren ese caso.
alter table profiles add column if not exists contact_email text;
alter table profiles drop constraint if exists profiles_contact_email_len;
alter table profiles add constraint profiles_contact_email_len check (contact_email is null or char_length(contact_email) <= 160);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_rls') then
    execute 'grant select (contact_email) on profiles to app_rls';
    execute 'revoke update (professional_id) on organization_members from app_rls';
  end if;
end $$;

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

create or replace function members_same_clinic() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.internal', 'on', true);
  if tg_op = 'UPDATE' and (new.organization_id <> old.organization_id or new.user_id <> old.user_id) then
    raise exception 'forbidden';
  end if;
  if new.role not in ('org_admin', 'professional', 'receptionist') then
    raise exception 'forbidden';
  end if;
  if new.professional_id is not null and not exists (
    select 1 from professionals p
    where p.id = new.professional_id and p.organization_id = new.organization_id
  ) then
    raise exception 'cross_organization';
  end if;
  return new;
end;
$$;

drop trigger if exists organization_members_same_clinic on organization_members;
create trigger organization_members_same_clinic before insert or update on organization_members
for each row execute function members_same_clinic();

drop policy if exists members_update on organization_members;
create policy members_update on organization_members for update
using (member_role(organization_id) = 'org_admin')
with check (
  member_role(organization_id) = 'org_admin'
  and role in ('org_admin', 'professional', 'receptionist')
  and (
    professional_id is null
    or exists (
      select 1 from professionals p
      where p.id = professional_id and p.organization_id = organization_members.organization_id
    )
  )
);

revoke all on function find_or_create_patient(uuid, text, text, text) from public;
revoke all on function appointments_guard_staff_patient() from public;
revoke all on function members_same_clinic() from public;
