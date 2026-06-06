-- ═══════════════════════════════════════════════════════════════════════════
-- SEED — Iron Tower OS  (datos de prueba)
-- Contraseña de todos los usuarios: Test1234!
-- Ejecutar en: Supabase Studio → SQL Editor, o `supabase db reset`
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── UUIDs fijos (determinísticos para facilitar testing) ───────────────────
-- Empresa:     a0000001-...
-- Técnicos:    b000000{1-4}-...
-- Supervisor:  c0000001-...

-- ─── 0. Limpiar datos de prueba previos (idempotente) ───────────────────────
DELETE FROM auth.users WHERE email LIKE '%@irontest.com';

-- ─── 1. EMPRESA (Cliente) ────────────────────────────────────────────────────
INSERT INTO public.clientes (
  id, nombre_empresa, cuit, direccion,
  contacto_nombre, contacto_email, contacto_telefono,
  activo, frecuencia_ronda_minutos, aviso_ronda_minutos
) VALUES (
  'a0000001-0000-0000-0000-000000000001',
  'Edificio Del Plata S.A.',
  '30-71234567-8',
  'Av. Corrientes 1234, CABA',
  'Jorge Mendoza',
  'jmendoza@delplata.com.ar',
  '011-4312-5678',
  true,
  60,
  10
) ON CONFLICT (id) DO UPDATE SET
  nombre_empresa = EXCLUDED.nombre_empresa;

-- ─── 2. SUPERVISOR (panel web) ───────────────────────────────────────────────
INSERT INTO auth.users (
  id, instance_id,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  aud, role, confirmation_token, recovery_token
) VALUES (
  'c0000001-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'supervisor@irontest.com',
  crypt('Test1234!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"rol":"supervisor","nombre":"Laura","apellido":"Vásquez"}',
  now(), now(),
  'authenticated', 'authenticated', '', ''
) ON CONFLICT (id) DO NOTHING;

UPDATE public.users
  SET dni = '25.111.001', turno_habitual = NULL
  WHERE id = 'c0000001-0000-0000-0000-000000000001';

-- ─── 3. TÉCNICOS ────────────────────────────────────────────────────────────

-- Técnico 1 — Encargado habitual, turno diurno
INSERT INTO auth.users (
  id, instance_id,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  aud, role, confirmation_token, recovery_token
) VALUES (
  'b0000001-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'carlos.garcia@irontest.com',
  crypt('Test1234!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"rol":"tecnico","nombre":"Carlos","apellido":"García"}',
  now(), now(),
  'authenticated', 'authenticated', '', ''
) ON CONFLICT (id) DO NOTHING;

UPDATE public.users SET
  dni           = '28.345.110',
  turno_habitual = 'diurno',
  cliente_id    = 'a0000001-0000-0000-0000-000000000001',
  pin_hash      = crypt('1234', gen_salt('bf'))
WHERE id = 'b0000001-0000-0000-0000-000000000001';

-- Técnico 2 — Apoyo habitual, turno diurno
INSERT INTO auth.users (
  id, instance_id,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  aud, role, confirmation_token, recovery_token
) VALUES (
  'b0000002-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'ana.romero@irontest.com',
  crypt('Test1234!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"rol":"tecnico","nombre":"Ana","apellido":"Romero"}',
  now(), now(),
  'authenticated', 'authenticated', '', ''
) ON CONFLICT (id) DO NOTHING;

UPDATE public.users SET
  dni           = '31.789.442',
  turno_habitual = 'diurno',
  cliente_id    = 'a0000001-0000-0000-0000-000000000001',
  pin_hash      = crypt('2345', gen_salt('bf'))
WHERE id = 'b0000002-0000-0000-0000-000000000002';

-- Técnico 3 — Encargado habitual, turno nocturno
INSERT INTO auth.users (
  id, instance_id,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  aud, role, confirmation_token, recovery_token
) VALUES (
  'b0000003-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'martin.lopez@irontest.com',
  crypt('Test1234!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"rol":"tecnico","nombre":"Martín","apellido":"López"}',
  now(), now(),
  'authenticated', 'authenticated', '', ''
) ON CONFLICT (id) DO NOTHING;

UPDATE public.users SET
  dni           = '26.001.887',
  turno_habitual = 'nocturno',
  cliente_id    = 'a0000001-0000-0000-0000-000000000001',
  pin_hash      = crypt('3456', gen_salt('bf'))
WHERE id = 'b0000003-0000-0000-0000-000000000003';

-- Técnico 4 — Apoyo habitual, turno nocturno
INSERT INTO auth.users (
  id, instance_id,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  aud, role, confirmation_token, recovery_token
) VALUES (
  'b0000004-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000000',
  'sofia.diaz@irontest.com',
  crypt('Test1234!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"rol":"tecnico","nombre":"Sofía","apellido":"Díaz"}',
  now(), now(),
  'authenticated', 'authenticated', '', ''
) ON CONFLICT (id) DO NOTHING;

UPDATE public.users SET
  dni           = '34.220.991',
  turno_habitual = 'nocturno',
  cliente_id    = 'a0000001-0000-0000-0000-000000000001',
  pin_hash      = crypt('4567', gen_salt('bf'))
WHERE id = 'b0000004-0000-0000-0000-000000000004';

-- ─── 4. ELEMENTOS DEL PUESTO ────────────────────────────────────────────────
INSERT INTO public.elementos_puesto (
  id, cliente_id, nombre, codigo_patrimonial,
  categoria, descripcion, estado_admin
) VALUES
  (
    'e0000001-0000-0000-0000-000000000001',
    'a0000001-0000-0000-0000-000000000001',
    'Extintor ABC 5kg — Recepción',
    'EXT-001',
    'Prevención incendios',
    'Extintor polvo ABC 5kg. Recarga anual. Próximo vencimiento: 01/2027.',
    'activo'
  ),
  (
    'e0000002-0000-0000-0000-000000000002',
    'a0000001-0000-0000-0000-000000000001',
    'Extintor ABC 10kg — Planta Baja',
    'EXT-002',
    'Prevención incendios',
    'Extintor polvo ABC 10kg. Sector escalera principal.',
    'activo'
  ),
  (
    'e0000003-0000-0000-0000-000000000003',
    'a0000001-0000-0000-0000-000000000001',
    'Hidrante Columna Seca — Entrada',
    'HID-001',
    'Prevención incendios',
    'Hidrante columna seca con manguera 45mm. Inspección mensual.',
    'activo'
  ),
  (
    'e0000004-0000-0000-0000-000000000004',
    'a0000001-0000-0000-0000-000000000001',
    'Desfibrilador AED — Recepción',
    'DEF-001',
    'Primeros auxilios',
    'Zoll AED Plus. Batería reemplazada 03/2026.',
    'activo'
  ),
  (
    'e0000005-0000-0000-0000-000000000005',
    'a0000001-0000-0000-0000-000000000001',
    'Cámara PTZ — Hall Principal',
    'CAM-001',
    'Seguridad electrónica',
    'Hikvision DS-2DE4A425IWG-E. Cobertura 360°.',
    'activo'
  ),
  (
    'e0000006-0000-0000-0000-000000000006',
    'a0000001-0000-0000-0000-000000000001',
    'Control de Acceso RFID — Molinete',
    'ACC-001',
    'Control de acceso',
    'Lector RFID 125kHz. 2 molinetes. Backup batería 4h.',
    'activo'
  ),
  (
    'e0000007-0000-0000-0000-000000000007',
    'a0000001-0000-0000-0000-000000000001',
    'Generador de Emergencia',
    'GEN-001',
    'Infraestructura',
    'Generador Kipor 7kVA. Combustible: gas oil. Mantenimiento trimestral.',
    'activo'
  ),
  (
    'e0000008-0000-0000-0000-000000000008',
    'a0000001-0000-0000-0000-000000000001',
    'Botiquín Primeros Auxilios',
    'BOT-001',
    'Primeros auxilios',
    'Reposición mensual. Verificar fecha de vencimiento insumos.',
    'activo'
  ),
  (
    'e0000009-0000-0000-0000-000000000009',
    'a0000001-0000-0000-0000-000000000001',
    'Linterna Táctica — Puesto',
    'LIN-001',
    'Equipamiento',
    'Maglite LED. Verificar batería diariamente.',
    'activo'
  ),
  (
    'e000000a-0000-0000-0000-000000000010',
    'a0000001-0000-0000-0000-000000000001',
    'Radio Portátil Motorola',
    'RAD-001',
    'Comunicaciones',
    'Motorola XT460. Base cargadora en puesto. Canal 3 operativo.',
    'en_mantenimiento'
  )
ON CONFLICT (id) DO UPDATE SET
  nombre       = EXCLUDED.nombre,
  descripcion  = EXCLUDED.descripcion,
  estado_admin = EXCLUDED.estado_admin;

-- ─── 5. PUNTOS DE CONTROL (QR para rondas) ──────────────────────────────────
INSERT INTO public.puntos_control (
  id, cliente_id, nombre, descripcion, ubicacion, codigo_qr, orden, activo
) VALUES
  (
    'q0000001-0000-0000-0000-000000000001',
    'a0000001-0000-0000-0000-000000000001',
    'Entrada Principal',
    'Control acceso peatonal',
    'Planta Baja — Hall',
    'IT-CTRL-001',
    1, true
  ),
  (
    'q0000002-0000-0000-0000-000000000002',
    'a0000001-0000-0000-0000-000000000001',
    'Estacionamiento Subsuelo',
    'Control vehicular y acceso SS1',
    'Subsuelo 1',
    'IT-CTRL-002',
    2, true
  ),
  (
    'q0000003-0000-0000-0000-000000000003',
    'a0000001-0000-0000-0000-000000000001',
    'Tablero Eléctrico Principal',
    'Verificación diaria de indicadores',
    'Subsuelo 1 — Sala técnica',
    'IT-CTRL-003',
    3, true
  ),
  (
    'q0000004-0000-0000-0000-000000000004',
    'a0000001-0000-0000-0000-000000000001',
    'Terraza — Sala de Máquinas',
    'Control ascensores y equipos HVAC',
    'Piso 12 — Terraza',
    'IT-CTRL-004',
    4, true
  ),
  (
    'q0000005-0000-0000-0000-000000000005',
    'a0000001-0000-0000-0000-000000000001',
    'Salida de Emergencia Este',
    'Verificar libre de obstáculos y señalización',
    'Piso 1 — Lateral Este',
    'IT-CTRL-005',
    5, true
  )
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- RESUMEN DE CREDENCIALES
-- ═══════════════════════════════════════════════════════════════════════════
--
--  ROL         EMAIL                         PASSWORD     PIN
--  ─────────────────────────────────────────────────────────────────────
--  supervisor  supervisor@irontest.com        Test1234!    —
--  tecnico     carlos.garcia@irontest.com     Test1234!    1234  (diurno/encargado)
--  tecnico     ana.romero@irontest.com        Test1234!    2345  (diurno/apoyo)
--  tecnico     martin.lopez@irontest.com      Test1234!    3456  (nocturno/encargado)
--  tecnico     sofia.diaz@irontest.com        Test1234!    4567  (nocturno/apoyo)
--
--  EMPRESA     Edificio Del Plata S.A.
--  ELEMENTOS   10 elementos (9 activos, 1 en mantenimiento)
--  PUNTOS QR   5 puntos de control (códigos IT-CTRL-001 a IT-CTRL-005)
--
-- ═══════════════════════════════════════════════════════════════════════════
