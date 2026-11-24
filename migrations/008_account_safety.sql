-- La base ya publicada no vuelve a ejecutar 001.
-- Limita el alta, exige confirmar el correo antes de enviar avisos
-- y borra el correo y el nombre de los avisos al eliminar la cuenta.

select set_config('app.internal', 'on', true);

alter table profiles add column if not exists email_verified_at timestamptz;
alter table profiles add column if not exists email_verify_hash text;
alter table profiles add column if not exists email_verify_expires_at timestamptz;

update profiles
set email_verified_at = coalesce(email_verified_at, created_at)
where email_verified_at is null
  and deleted_at is null
  and status = 'active'
  and password_hash like 'scrypt$%';

create or replace function delete_own_account() returns void
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
  update notification_events
  set to_email = 'deleted+' || v_user::text || '@invalid.alba',
      subject = 'Aviso',
      payload = '{}'::jsonb
  where user_id = v_user
     or lower(to_email) = (select lower(email) from profiles where id = v_user);
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

create or replace function issue_email_verification(p_user uuid, p_token_hash text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.internal', 'on', true);
  if current_setting('app.service', true) <> 'on' then
    raise exception 'forbidden';
  end if;
  update profiles
  set email_verify_hash = p_token_hash,
      email_verify_expires_at = now() + interval '24 hours'
  where id = p_user
    and deleted_at is null
    and status = 'active'
    and email_verified_at is null;
end;
$$;

create or replace function confirm_email_verification(p_token_hash text) returns boolean
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
  update profiles
  set email_verified_at = now(),
      email_verify_hash = null,
      email_verify_expires_at = null
  where email_verify_hash = p_token_hash
    and email_verify_expires_at > now()
    and deleted_at is null
  returning id into v_id;
  return v_id is not null;
end;
$$;

revoke all on function issue_email_verification(uuid, text) from public;
revoke all on function confirm_email_verification(text) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_rls') then
    grant select (email_verified_at) on profiles to app_rls;
  end if;
end $$;
