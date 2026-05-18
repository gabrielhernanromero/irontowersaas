import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { RelevoPSchema, RelevoEspecSchema } from '@/lib/validations/libroTurno'
import type { LibroNovedad } from '@/types/database'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function uploadFirmaToFirmas(dataUrl: string, userId: string): Promise<string> {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
  if (!base64) throw new Error('dataUrl inválido')
  const buffer = Buffer.from(base64, 'base64')
  const path = `${userId}/relevo-${Date.now()}.png`
  const { error } = await supabaseAdmin()
    .storage.from('firmas')
    .upload(path, buffer, { contentType: 'image/png' })
  if (error) throw new Error('Error al subir firma')
  return path
}

async function uploadFirmaRelevo(base64raw: string, turnoAnteriorId: string): Promise<string> {
  const clean = base64raw.includes(',') ? base64raw.split(',')[1] : base64raw
  if (!clean) throw new Error('firmaRelevoBase64 inválida')
  const buffer = Buffer.from(clean, 'base64')
  const path = `relevo-${turnoAnteriorId}.png`
  const { error } = await supabaseAdmin()
    .storage.from('firmas-relevos')
    .upload(path, buffer, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(`Error al subir firma al bucket firmas-relevos: ${error.message}`)
  return path
}

function computeHashNovedades(novedades: LibroNovedad[]): string {
  const sorted = [...novedades].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const payload = sorted
    .map(n =>
      [n.id, n.hora, n.descripcion, n.riesgo_detectado ?? '', n.medidas_adoptadas ?? '', n.observaciones_generales ?? '']
        .join('|')
    )
    .join('\n')
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex')
}

function calcularTurnoSegunHora(): 'diurno' | 'nocturno' {
  return new Date().getHours() < 18 ? 'diurno' : 'nocturno'
}

function horaActual(): string {
  const now = new Date()
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
}

// ─── PATCH /api/libro-turno/relevo ───────────────────────────────────────────
// Flujo UI existente: técnico entrante ya autenticado firma en la misma sesión
export async function PATCH(req: NextRequest) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = RelevoPSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 422 })
  }

  const { turno_saliente_id, relevo_nombre, relevo_dni, firma_relevo_dataurl, horario_inicio, fecha, turno } = parsed.data

  const { data: turnoSaliente } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, estado, firma_relevo_url')
    .eq('id', turno_saliente_id)
    .single()

  if (!turnoSaliente) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  if (turnoSaliente.estado !== 'pendiente_relevo') {
    return NextResponse.json({ error: 'El turno no está pendiente de relevo' }, { status: 409 })
  }
  if (turnoSaliente.firma_relevo_url) {
    return NextResponse.json({ error: 'El relevo ya fue firmado' }, { status: 409 })
  }

  const { data: turnoAbierto } = await supabaseAdmin()
    .from('libro_turno')
    .select('id')
    .eq('tecnico_id', user.id)
    .eq('estado', 'abierto')
    .maybeSingle()

  if (turnoAbierto) {
    return NextResponse.json({ error: 'Ya tenés un turno abierto. Cerralo antes de tomar el relevo.' }, { status: 409 })
  }

  let firmaPath: string
  try {
    firmaPath = await uploadFirmaToFirmas(firma_relevo_dataurl, user.id)
  } catch {
    return NextResponse.json({ error: 'Error al subir la firma' }, { status: 500 })
  }

  const { error: closeErr } = await supabaseAdmin()
    .from('libro_turno')
    .update({ estado: 'cerrado', firma_relevo_url: firmaPath, relevo_nombre, relevo_dni })
    .eq('id', turno_saliente_id)

  if (closeErr) return NextResponse.json({ error: 'Error al cerrar el turno saliente' }, { status: 500 })

  const { data: nuevoTurno, error: insertErr } = await supabaseAdmin()
    .from('libro_turno')
    .insert({ fecha, turno, tecnico_id: user.id, tecnico_nombre: relevo_nombre, tecnico_dni: relevo_dni, horario_inicio, estado: 'abierto' })
    .select()
    .single()

  if (insertErr || !nuevoTurno) {
    return NextResponse.json({ error: 'Error al crear el nuevo turno' }, { status: 500 })
  }

  await supabaseAdmin()
    .from('libro_novedad')
    .insert({
      turno_id: nuevoTurno.id,
      tipo: 'apertura',
      hora: horario_inicio,
      descripcion: `Apertura de guardia por relevo — ${relevo_nombre}, DNI ${relevo_dni}`,
    })

  return NextResponse.json(nuevoTurno, { status: 201 })
}

// ─── POST /api/libro-turno/relevo ────────────────────────────────────────────
// Flujo Especificación Técnica:
//   1. Verificación de identidad por PIN (SHA-256 contra users.pin_hash)
//   2. Hash SHA-256 de todas las novedades del turno saliente (auditoría)
//   3. Subida de firma al bucket `firmas-relevos`
//   4. Transacción atómica: cerrar Turno A + abrir Turno B
export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = RelevoEspecSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 422 })
  }

  const { turnoAnteriorId, tecnicoEntranteId, pinEntrante, clienteId, firmaRelevoBase64, relevoNombre, relevoDni } = parsed.data

  // ── Paso 1: Verificación de Identidad ─────────────────────────────────────
  // Calcula SHA-256 del PIN y lo compara contra users.pin_hash
  const pinHash = crypto.createHash('sha256').update(pinEntrante, 'utf8').digest('hex')

  const { data: tecnicoB, error: techErr } = await supabaseAdmin()
    .from('users')
    .select('id, nombre, apellido, dni, pin_hash, rol, activo')
    .eq('id', tecnicoEntranteId)
    .single()

  if (techErr || !tecnicoB) {
    return NextResponse.json({ error: 'Técnico entrante no encontrado' }, { status: 404 })
  }
  if (!tecnicoB.activo) {
    return NextResponse.json({ error: 'El técnico entrante no está activo en el sistema' }, { status: 403 })
  }
  if (!tecnicoB.pin_hash) {
    return NextResponse.json({ error: 'El técnico no tiene PIN configurado. Contactá al administrador.' }, { status: 403 })
  }
  if (tecnicoB.pin_hash !== pinHash) {
    return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
  }

  // ── Verificar estado del turno saliente ────────────────────────────────────
  const { data: turnoSaliente, error: turnoErr } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, estado, firma_relevo_url, tecnico_nombre, tecnico_dni')
    .eq('id', turnoAnteriorId)
    .single()

  if (turnoErr || !turnoSaliente) {
    return NextResponse.json({ error: 'Turno saliente no encontrado' }, { status: 404 })
  }
  if (turnoSaliente.estado !== 'pendiente_relevo') {
    return NextResponse.json(
      { error: `El turno debe estar en estado 'pendiente_relevo' (actual: '${turnoSaliente.estado}')` },
      { status: 409 }
    )
  }
  if (turnoSaliente.firma_relevo_url) {
    return NextResponse.json({ error: 'El relevo de este turno ya fue completado' }, { status: 409 })
  }

  // Verificar que el técnico entrante no tiene turno abierto
  const { data: turnoEntranteAbierto } = await supabaseAdmin()
    .from('libro_turno')
    .select('id')
    .eq('tecnico_id', tecnicoEntranteId)
    .eq('estado', 'abierto')
    .maybeSingle()

  if (turnoEntranteAbierto) {
    return NextResponse.json({ error: 'El técnico entrante ya tiene un turno abierto' }, { status: 409 })
  }

  // ── Paso 2: Cálculo del Hash SHA-256 de Novedades ─────────────────────────
  // Recupera todas las novedades del turno que cierra y genera hash de auditoría
  const { data: novedadesRaw } = await supabaseAdmin()
    .from('libro_novedad')
    .select('*')
    .eq('turno_id', turnoAnteriorId)
    .order('created_at', { ascending: true })

  const hashNovedades = computeHashNovedades((novedadesRaw ?? []) as LibroNovedad[])

  // ── Paso 3: Subida de Firma al Bucket firmas-relevos ──────────────────────
  // Nomenclatura: relevo-[turnoAnteriorId].png
  let firmaRelevoPath: string
  try {
    firmaRelevoPath = await uploadFirmaRelevo(firmaRelevoBase64, turnoAnteriorId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido al subir firma'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // ── Paso 4: Transacción Cierre/Apertura ───────────────────────────────────
  const ahora = horaActual()
  const fecha = new Date().toISOString().split('T')[0]
  const turnoCalculado = calcularTurnoSegunHora()

  // 4a — Cerrar Turno A con hash de auditoría
  const { error: closeErr } = await supabaseAdmin()
    .from('libro_turno')
    .update({
      estado:           'cerrado',
      firma_relevo_url: firmaRelevoPath,
      relevo_nombre:    relevoNombre,
      relevo_dni:       relevoDni,
      hash_novedades:   hashNovedades,
    })
    .eq('id', turnoAnteriorId)

  if (closeErr) {
    return NextResponse.json(
      { error: 'Error al cerrar el turno saliente', detail: closeErr.message },
      { status: 500 }
    )
  }

  // 4b — Abrir Turno B automáticamente
  const { data: nuevoTurno, error: insertErr } = await supabaseAdmin()
    .from('libro_turno')
    .insert({
      fecha,
      turno:          turnoCalculado,
      tecnico_id:     tecnicoEntranteId,
      tecnico_nombre: `${tecnicoB.nombre} ${tecnicoB.apellido}`,
      tecnico_dni:    tecnicoB.dni ?? relevoDni,
      horario_inicio: ahora,
      estado:         'abierto',
      cliente_id:     clienteId,
    })
    .select()
    .single()

  if (insertErr || !nuevoTurno) {
    // Rollback manual: volver A a pendiente_relevo para permitir reintento
    await supabaseAdmin()
      .from('libro_turno')
      .update({
        estado:           'pendiente_relevo',
        firma_relevo_url: null,
        relevo_nombre:    null,
        relevo_dni:       null,
        hash_novedades:   null,
      })
      .eq('id', turnoAnteriorId)

    return NextResponse.json(
      { error: 'Error al crear el nuevo turno. Se revirtió el cierre del turno anterior.' },
      { status: 500 }
    )
  }

  // 4c — Novedad de apertura automática en Turno B con resumen del relevo
  await supabaseAdmin()
    .from('libro_novedad')
    .insert({
      turno_id:    nuevoTurno.id,
      tipo:        'apertura',
      hora:        ahora,
      descripcion: `Apertura de guardia por relevo. Recibe: ${tecnicoB.nombre} ${tecnicoB.apellido} (DNI ${tecnicoB.dni ?? relevoDni}). Transfiere: ${turnoSaliente.tecnico_nombre} (DNI ${turnoSaliente.tecnico_dni}). Hash auditoría: ${hashNovedades.slice(0, 16)}…`,
    })

  return NextResponse.json(
    {
      turno:      nuevoTurno,
      auditHash:  hashNovedades,
      firmaPath:  firmaRelevoPath,
    },
    { status: 201 }
  )
}
