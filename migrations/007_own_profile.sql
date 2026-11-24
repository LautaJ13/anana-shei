-- La base ya publicada no vuelve a ejecutar 001.
-- Cada persona puede editar su nombre, correo, teléfono, nacimiento y contraseña.

create or replace function protect_profile() returns trigger
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
  if current_setting('app.allow_own_profile', true) = 'on'
    and new.id = current_app_user()
    and new.platform_role is not distinct from old.platform_role
    and new.status is not distinct from old.status
    and new.is_demo is not distinct from old.is_demo
    and new.deleted_at is not distinct from old.deleted_at then
    return new;
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

create or replace function update_own_profile(
  p_full_name text,
  p_email text,
  p_phone text,
  p_birth_date date,
  p_password_hash text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := current_app_user();
  v_email text := lower(trim(p_email));
begin
  perform set_config('app.internal', 'on', true);
  if v_user is null then
    raise exception 'auth_required';
  end if;
  if exists (
    select 1 from profiles
    where id = v_user and (is_demo or status <> 'active' or deleted_at is not null)
  ) then
    raise exception 'forbidden';
  end if;
  if char_length(trim(p_full_name)) < 2 or char_length(trim(p_full_name)) > 120 then
    raise exception 'invalid_name';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or char_length(v_email) > 160
    or v_email like '%@patients.alba.invalid'
    or v_email like '%@invalid.alba' then
    raise exception 'invalid_email';
  end if;
  if p_phone is not null and char_length(trim(p_phone)) > 30 then
    raise exception 'invalid_note';
  end if;
  if exists (
    select 1 from profiles
    where lower(email) = v_email and id <> v_user and deleted_at is null
  ) then
    raise exception 'email_taken';
  end if;
  perform set_config('app.allow_own_profile', 'on', true);
  update profiles
  set full_name = trim(p_full_name),
      email = v_email,
      phone = nullif(trim(coalesce(p_phone, '')), ''),
      birth_date = p_birth_date,
      password_hash = coalesce(p_password_hash, password_hash)
  where id = v_user;
  if not found then
    raise exception 'forbidden';
  end if;
exception
  when unique_violation then
    raise exception 'email_taken';
end;
$$;

revoke all on function update_own_profile(text, text, text, date, text) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_rls') then
    grant execute on function update_own_profile(text, text, text, date, text) to app_rls;
  end if;
end $$;
