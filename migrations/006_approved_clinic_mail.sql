-- La base ya publicada no vuelve a ejecutar 001.

create or replace function write_booking_notification(
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
  if exists (
    select 1
    from appointments a
    join organizations o on o.id = a.organization_id
    where a.id = p_appointment
      and o.status <> 'active'
  ) then
    return null;
  end if;
  insert into notification_events (
    appointment_id, user_id, organization_id, kind, status, to_email, subject, payload
  )
  select
    a.id,
    a.patient_id,
    a.organization_id,
    p_kind,
    'pending',
    case
      when p.email ~ '^staff-[0-9a-f]+@patients\.alba\.invalid$' and nullif(trim(p.contact_email), '') is not null
        then lower(trim(p.contact_email))
      else p.email
    end,
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


create or replace function book_appointment(
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
  if v_org.status <> 'active' then
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
  else
    perform consume_rate_limit('staff-book:' || v_org.id::text, 40, interval '1 hour');
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

create or replace function register_user(
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
    return null;
end;
$$;
