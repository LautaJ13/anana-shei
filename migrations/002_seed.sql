-- Datos ficticios. Estas cuentas no tienen contraseña usable.
select set_config('app.seed', 'on', true);

insert into specialties (id, name, slug, description) values
  ('00000000-0000-4000-8000-000000000001', 'Medicina general', 'medicina-general', 'Atención clínica de adultos'),
  ('00000000-0000-4000-8000-000000000002', 'Psicología', 'psicologia', 'Acompañamiento psicológico'),
  ('00000000-0000-4000-8000-000000000003', 'Odontología', 'odontologia', 'Salud bucal'),
  ('00000000-0000-4000-8000-000000000004', 'Fisioterapia', 'fisioterapia', 'Rehabilitación y movimiento'),
  ('00000000-0000-4000-8000-000000000005', 'Nutrición', 'nutricion', 'Alimentación y hábitos'),
  ('00000000-0000-4000-8000-000000000006', 'Dermatología', 'dermatologia', 'Salud de la piel'),
  ('00000000-0000-4000-8000-000000000007', 'Cardiología', 'cardiologia', 'Salud cardiovascular'),
  ('00000000-0000-4000-8000-000000000008', 'Pediatría', 'pediatria', 'Salud de niñas y niños'),
  ('00000000-0000-4000-8000-000000000009', 'Ginecología', 'ginecologia', 'Salud ginecológica'),
  ('00000000-0000-4000-8000-00000000000a', 'Traumatología', 'traumatologia', 'Lesiones y aparato locomotor'),
  ('00000000-0000-4000-8000-00000000000b', 'Oftalmología', 'oftalmologia', 'Salud visual'),
  ('00000000-0000-4000-8000-00000000000c', 'Otorrinolaringología', 'otorrinolaringologia', 'Oído, nariz y garganta'),
  ('00000000-0000-4000-8000-00000000000d', 'Psiquiatría', 'psiquiatria', 'Salud mental médica'),
  ('00000000-0000-4000-8000-00000000000e', 'Fonoaudiología', 'fonoaudiologia', 'Comunicación y lenguaje'),
  ('00000000-0000-4000-8000-00000000000f', 'Ortodoncia', 'ortodoncia', 'Alineación dental');

insert into organizations (
  id, name, slug, description, phone, email, status, cancellation_hours, require_confirmation, is_demo
) values
  (
    '10000000-0000-4000-8000-000000000001',
    'Clínica del Prado',
    'clinica-del-prado',
    'Consultorios de medicina general, pediatría y cardiología en el Prado. Cada reserva corresponde a un horario real de la agenda del profesional.',
    '+598 2400 1001',
    'hola@clinicadelprado.demo',
    'active',
    24,
    false,
    true
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Mente Clara',
    'mente-clara',
    'Espacio de psicología clínica en Pocitos y Parque Rodó. Las sesiones duran 50 minutos, con una pausa de 10 minutos entre consultas.',
    '+598 2400 1002',
    'hola@menteclara.demo',
    'active',
    48,
    false,
    true
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'Sonrisa Viva',
    'sonrisa-viva',
    'Odontología general y ortodoncia en Ciudad de la Costa. Podés ver la duración y el precio de cada consulta antes de reservar.',
    '+598 2400 1003',
    'hola@sonrisaviva.demo',
    'active',
    12,
    false,
    true
  );

insert into clinic_locations (
  id, organization_id, name, address, city, department, timezone, phone
) values
  (
    '11000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Sede Prado',
    'Av. Agraciada 3450 local 2',
    'Montevideo',
    'Montevideo',
    'America/Montevideo',
    '+598 2400 1001'
  ),
  (
    '11000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'Pocitos',
    'Av. Brasil 2694 apto 102',
    'Montevideo',
    'Montevideo',
    'America/Montevideo',
    '+598 2400 1002'
  ),
  (
    '11000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    'Anexo Parque Rodó',
    'Bulevar España 2104',
    'Montevideo',
    'Montevideo',
    'America/Montevideo',
    '+598 2400 1002'
  ),
  (
    '11000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000003',
    'Solymar',
    'Av. Giannattasio km 21.500 local 4',
    'Ciudad de la Costa',
    'Canelones',
    'America/Montevideo',
    '+598 2400 1003'
  );

insert into profiles (
  id, email, password_hash, full_name, phone, platform_role, is_demo
) values
  (
    '20000000-0000-4000-8000-000000000001',
    'camila.rodriguez@demo.alba.uy',
    'disabled',
    'Camila Rodríguez',
    '+598 99 000 101',
    'user',
    true
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'martin.pereyra@demo.alba.uy',
    'disabled',
    'Martín Pereyra',
    '+598 99 000 102',
    'user',
    true
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'ana.ferreira@demo.alba.uy',
    'disabled',
    'Ana Ferreira',
    '+598 99 000 103',
    'user',
    true
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    'julia.nunez@demo.alba.uy',
    'disabled',
    'Julia Núñez',
    '+598 99 000 104',
    'user',
    true
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    'elena.rios@demo.alba.uy',
    'disabled',
    'Elena Ríos',
    '+598 99 000 105',
    'user',
    true
  ),
  (
    '20000000-0000-4000-8000-000000000006',
    'sofia.pereira@demo.alba.uy',
    'disabled',
    'Sofía Pereira',
    '+598 99 000 106',
    'user',
    true
  ),
  (
    '20000000-0000-4000-8000-000000000007',
    'diego.alvarez@demo.alba.uy',
    'disabled',
    'Diego Álvarez',
    '+598 99 000 107',
    'user',
    true
  ),
  (
    '20000000-0000-4000-8000-000000000008',
    'andres.vidal@demo.alba.uy',
    'disabled',
    'Andrés Vidal',
    '+598 99 000 108',
    'user',
    true
  ),
  (
    '20000000-0000-4000-8000-000000000009',
    'valentina.sosa@demo.alba.uy',
    'disabled',
    'Valentina Sosa',
    '+598 99 000 109',
    'user',
    true
  ),
  (
    '20000000-0000-4000-8000-00000000000a',
    'lucas.silva@demo.alba.uy',
    'disabled',
    'Lucas Silva',
    '+598 99 000 110',
    'user',
    true
  ),
  (
    '20000000-0000-4000-8000-00000000000b',
    'plataforma@demo.alba.uy',
    'disabled',
    'Equipo Alba',
    null,
    'superadmin',
    true
  );

insert into professionals (
  id, organization_id, user_id, full_name, license_number, bio, can_manage_availability, color
) values
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    'Dra. Ana Ferreira',
    'MP 12001',
    'Médica de familia. Atiende de lunes a viernes, mañana y tarde.',
    false,
    '#17324D'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    null,
    'Dr. Mateo Costa',
    'MP 12088',
    'Pediatra. Consultas de control y enfermedad aguda.',
    false,
    '#0F6E66'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    null,
    'Dra. Lucía Bentancur',
    'MP 12140',
    'Cardióloga. Atiende martes y jueves por la tarde.',
    false,
    '#1F6F78'
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000006',
    'Lic. Sofía Pereira',
    'LP 4502',
    'Psicóloga clínica. Sesiones de 50 minutos de lunes a viernes.',
    true,
    '#17324D'
  ),
  (
    '30000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000007',
    'Lic. Diego Álvarez',
    'LP 4519',
    'Psicólogo infantojuvenil. Atiende lunes, miércoles y viernes.',
    false,
    '#334155'
  ),
  (
    '30000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000009',
    'Dra. Valentina Sosa',
    'MO 3302',
    'Odontóloga general. Consultas y limpiezas.',
    true,
    '#0F6E66'
  ),
  (
    '30000000-0000-4000-8000-000000000007',
    '10000000-0000-4000-8000-000000000003',
    null,
    'Dr. Joaquín Techera',
    'MO 3348',
    'Ortodoncista. Atiende lunes, miércoles y viernes por la tarde.',
    false,
    '#17324D'
  );

insert into organization_members (organization_id, user_id, role, professional_id, status) values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'org_admin', null, 'active'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'professional', '30000000-0000-4000-8000-000000000001', 'active'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', 'receptionist', null, 'active'),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000005', 'org_admin', null, 'active'),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000006', 'professional', '30000000-0000-4000-8000-000000000004', 'active'),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000007', 'professional', '30000000-0000-4000-8000-000000000005', 'active'),
  ('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000008', 'org_admin', null, 'active'),
  ('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000009', 'professional', '30000000-0000-4000-8000-000000000006', 'active');

insert into professional_specialties (professional_id, specialty_id) values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000008'),
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000007'),
  ('30000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002'),
  ('30000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002'),
  ('30000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000003'),
  ('30000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-00000000000f');

insert into services (
  id, organization_id, name, description, duration_minutes, buffer_minutes, price_cents
) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Consulta de medicina general', 'Consulta clínica de adultos.', 30, 10, 180000),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Consulta pediátrica', 'Control o consulta por enfermedad.', 30, 10, 160000),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Consulta cardiológica', 'Valoración cardiológica ambulatoria.', 40, 10, 240000),
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Psicoterapia individual', 'Sesión individual de 50 minutos.', 50, 10, 220000),
  ('40000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'Orientación a familias', 'Sesión familiar de 50 minutos.', 50, 10, 240000),
  ('40000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000003', 'Consulta odontológica', 'Evaluación y consulta general.', 40, 10, 150000),
  ('40000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000003', 'Limpieza dental', 'Higiene bucal profesional.', 45, 15, 190000),
  ('40000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000003', 'Consulta de ortodoncia', 'Valoración de ortodoncia.', 30, 10, 200000);

insert into professional_services (professional_id, service_id) values
  ('30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002'),
  ('30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003'),
  ('30000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000004'),
  ('30000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000005'),
  ('30000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000004'),
  ('30000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000006'),
  ('30000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000007'),
  ('30000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000008');

-- Lun a vie, minutos desde la medianoche local.
insert into recurring_availability (professional_id, location_id, weekday, start_minute, end_minute)
select '30000000-0000-4000-8000-000000000001'::uuid, '11000000-0000-4000-8000-000000000001'::uuid, day, 510, 750
from generate_series(1, 5) as day
union all
select '30000000-0000-4000-8000-000000000001'::uuid, '11000000-0000-4000-8000-000000000001'::uuid, day, 840, 1080
from generate_series(1, 5) as day
union all
select '30000000-0000-4000-8000-000000000002'::uuid, '11000000-0000-4000-8000-000000000001'::uuid, day, 540, 900
from generate_series(1, 5) as day
union all
select '30000000-0000-4000-8000-000000000003'::uuid, '11000000-0000-4000-8000-000000000001'::uuid, day, 780, 1080
from generate_series(2, 4, 2) as day
union all
select '30000000-0000-4000-8000-000000000004'::uuid, '11000000-0000-4000-8000-000000000002'::uuid, day, 540, 1020
from generate_series(1, 4) as day
union all
select '30000000-0000-4000-8000-000000000005'::uuid, '11000000-0000-4000-8000-000000000002'::uuid, day, 600, 780
from generate_series(1, 5, 2) as day
union all
select '30000000-0000-4000-8000-000000000005'::uuid, '11000000-0000-4000-8000-000000000002'::uuid, day, 840, 1080
from generate_series(1, 5, 2) as day
union all
select '30000000-0000-4000-8000-000000000006'::uuid, '11000000-0000-4000-8000-000000000004'::uuid, day, 540, 1020
from generate_series(1, 5) as day
union all
select '30000000-0000-4000-8000-000000000007'::uuid, '11000000-0000-4000-8000-000000000004'::uuid, day, 840, 1140
from generate_series(1, 5, 2) as day;

insert into recurring_availability (professional_id, location_id, weekday, start_minute, end_minute)
values (
  '30000000-0000-4000-8000-000000000004',
  '11000000-0000-4000-8000-000000000003',
  5,
  540,
  780
);

insert into availability_exceptions (professional_id, location_id, kind, starts_at, ends_at, note)
values (
  '30000000-0000-4000-8000-000000000004',
  null,
  'vacation',
  (date_trunc('week', (now() at time zone 'America/Montevideo')::timestamp) + interval '8 days' + time '09:00') at time zone 'America/Montevideo',
  (date_trunc('week', (now() at time zone 'America/Montevideo')::timestamp) + interval '8 days' + time '13:00') at time zone 'America/Montevideo',
  'Vacaciones'
);

insert into appointments (
  organization_id, location_id, professional_id, patient_id, service_id,
  starts_at, ends_at, buffer_minutes, status, source, created_by
) values
  (
    '10000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    (date_trunc('week', (now() at time zone 'America/Montevideo')::timestamp) - interval '7 days' + time '08:30') at time zone 'America/Montevideo',
    (date_trunc('week', (now() at time zone 'America/Montevideo')::timestamp) - interval '7 days' + time '09:00') at time zone 'America/Montevideo',
    10,
    'completed',
    'online',
    '20000000-0000-4000-8000-000000000001'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '11000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000004',
    (date_trunc('week', (now() at time zone 'America/Montevideo')::timestamp) + interval '7 days' + time '09:00') at time zone 'America/Montevideo',
    (date_trunc('week', (now() at time zone 'America/Montevideo')::timestamp) + interval '7 days' + time '09:50') at time zone 'America/Montevideo',
    10,
    'confirmed',
    'online',
    '20000000-0000-4000-8000-000000000001'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '11000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000004',
    (date_trunc('week', (now() at time zone 'America/Montevideo')::timestamp) + interval '7 days' + time '10:00') at time zone 'America/Montevideo',
    (date_trunc('week', (now() at time zone 'America/Montevideo')::timestamp) + interval '7 days' + time '10:50') at time zone 'America/Montevideo',
    10,
    'cancelled',
    'online',
    '20000000-0000-4000-8000-000000000001'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '11000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-00000000000a',
    '40000000-0000-4000-8000-000000000004',
    (date_trunc('week', (now() at time zone 'America/Montevideo')::timestamp) + interval '7 days' + time '12:00') at time zone 'America/Montevideo',
    (date_trunc('week', (now() at time zone 'America/Montevideo')::timestamp) + interval '7 days' + time '12:50') at time zone 'America/Montevideo',
    10,
    'confirmed',
    'online',
    '20000000-0000-4000-8000-00000000000a'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    (((now() at time zone 'America/Montevideo')::date - 1) + time '16:00') at time zone 'America/Montevideo',
    (((now() at time zone 'America/Montevideo')::date - 1) + time '16:30') at time zone 'America/Montevideo',
    10,
    'cancelled',
    'staff',
    '20000000-0000-4000-8000-000000000004'
  );

insert into appointments (
  organization_id, location_id, professional_id, patient_id, service_id,
  starts_at, ends_at, buffer_minutes, status, source, created_by
)
select
  '10000000-0000-4000-8000-000000000001'::uuid,
  '11000000-0000-4000-8000-000000000001'::uuid,
  '30000000-0000-4000-8000-000000000002'::uuid,
  '20000000-0000-4000-8000-00000000000a'::uuid,
  '40000000-0000-4000-8000-000000000002'::uuid,
  slot.starts_at,
  slot.starts_at + interval '30 minutes',
  10,
  'pending',
  'staff',
  '20000000-0000-4000-8000-000000000004'::uuid
from (
  select (
    ((now() at time zone 'America/Montevideo')::date + day) + time '09:00'
  ) at time zone 'America/Montevideo' as starts_at
  from generate_series(1, 6) as day
) as slot
where extract(dow from (slot.starts_at at time zone 'America/Montevideo')) between 1 and 5
order by slot.starts_at
limit 1;
