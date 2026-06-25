import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { AbrirTurnoSchema } from '@/lib/validations/libroTurno'
import { findEsquemaActivo } from '@/lib/esquemas/validarVentana'

async function uploadFirma(dataUrl: string, userId: string, prefix: string): Promise<string> {
  const base64 = dataUrl.split(',')[1]
  if (!base64) throw new Error('dataUrl inválido')
  const buffer = Buffer.from(base64, 'base64')
  const path = `${userId}/${prefix}-${Date.now()}.png`
  const { error } = await supabaseAdmin()
    .storage.from('firmas')
    .upload(path, buffer, { contentType: 'image/png' })
  if (error) throw new Error('Error al subir firma')
  return path
}

export async function POST(req: NextRequest) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = AbrirTurnoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 422 })
  }

  const { fecha, turno, tecnico_nombre, tecnico_dni, horario_inicio, cliente_id, esquema_id, interino, personal_apoyo, turno_saliente_id, relevo_firma_dataurl, verificacion_elementos } = parsed.data

  // Verificar que no hay turno abierto propio
  const { data: turnoAbierto } = await supabaseAdmin()
    .from('libro_turno')
    .select('id')
    .eq('tecnico_id', user.id)
    .eq('estado', 'abierto')
    .maybeSingle()

  if (turnoAbierto) {
    return NextResponse.json({ error: 'Ya tenés un turno abierto. Cerralo antes de iniciar uno nuevo.' }, { status: 409 })
  }

  // Validar ventana horaria contra los esquemas configurados para el cliente
  // En modo interino se omite la validación (apoyo en emergencia)
  if (!interino) {
    const { data: perfil } = await supabaseAdmin()
      .from('users')
      .select('cliente_id')
      .eq('id', user.id)
      .single()

    if (perfil?.cliente_id) {
      const { data: esquemas } = await supabaseAdmin()
        .from('esquemas_cobertura')
        .select('nombre, hora_inicio, hora_fin, dias_semana, fecha_desde, fecha_hasta')
        .eq('cliente_id', perfil.cliente_id)
        .eq('activo', true)

      if (esquemas && esquemas.length > 0) {
        const match = findEsquemaActivo(esquemas)
        if (!match) {
          return NextResponse.json(
            { error: 'No estás dentro del horario programado. Podés iniciar hasta 30 minutos antes del comienzo de tu turno.' },
            { status: 403 }
          )
        }
      }
    }
  }

  // Firmar relevo del turno saliente si corresponde
  if (turno_saliente_id && relevo_firma_dataurl) {
    try {
      const firmaPath = await uploadFirma(relevo_firma_dataurl, user.id, 'relevo')
      await supabaseAdmin()
        .from('libro_turno')
        .update({
          estado: 'cerrado',
          firma_relevo_url: firmaPath,
          relevo_nombre: tecnico_nombre,
          relevo_dni: tecnico_dni,
        })
        .eq('id', turno_saliente_id)
        .in('estado', ['cerrado', 'pendiente_relevo'])
    } catch {
      return NextResponse.json({ error: 'Error al registrar la firma del relevo' }, { status: 500 })
    }
  }

  // Crear el nuevo turno
  const { data: nuevoTurno, error: insertErr } = await supabaseAdmin()
    .from('libro_turno')
    .insert({
      fecha,
      turno,
      tecnico_id: user.id,
      tecnico_nombre,
      tecnico_dni,
      horario_inicio,
      cliente_id:  cliente_id  ?? null,
      esquema_id:  esquema_id  ?? null,
      interino:    interino    ?? false,
      estado: 'abierto',
    })
    .select()
    .single()

  if (insertErr || !nuevoTurno) {
    return NextResponse.json({ error: 'Error al crear el turno' }, { status: 500 })
  }

  // Insertar verificación de elementos si se proporcionó
  if (verificacion_elementos?.length) {
    await supabaseAdmin()
      .from('control_inventario_turno')
      .insert(verificacion_elementos.map(v => ({
        turno_id:         nuevoTurno.id,
        elemento_id:      v.elemento_id,
        estado_operativo: v.estado_operativo,
        observacion:      v.observacion ?? null,
      })))

    // Crear incidencia automática por cada elemento con problema
    const conProblemas = verificacion_elementos.filter(v => v.estado_operativo !== 'ok')
    for (const v of conProblemas) {
      const esFaltante = v.estado_operativo === 'faltante'
      await supabaseAdmin()
        .from('incidencias')
        .insert({
          cliente_id:           nuevoTurno.cliente_id ?? null,
          turno_creacion_id:    nuevoTurno.id,
          titulo:               esFaltante
            ? `${v.nombre} — faltante al abrir guardia`
            : `${v.nombre} — falla al abrir guardia`,
          descripcion:          v.observacion
            || `${v.nombre} reportado como ${esFaltante ? 'faltante' : 'dañado/en falla'} al inicio del turno.`,
          severidad:            esFaltante ? 'alto' : 'medio',
          estado:               'abierto',
          elemento_afectado_id: v.elemento_id,
          tecnico_detector_id:  user.id,
        })
    }
  }

  // Novedad de apertura — descripción enriquecida con resultado de verificación y personal
  let descripcionApertura = interino
    ? 'Apertura de guardia como encargado interino (encargado principal no se presentó)'
    : 'Apertura de guardia'

  // Personal de apoyo
  if (personal_apoyo?.length) {
    const presentes = personal_apoyo.filter(p => p.presente).map(p => p.nombre)
    const ausentes  = personal_apoyo.filter(p => !p.presente).map(p => p.nombre)
    if (presentes.length) descripcionApertura += `. Personal de apoyo presente: ${presentes.join(', ')}.`
    if (ausentes.length)  descripcionApertura += ` Ausente: ${ausentes.join(', ')}.`
  }

  // Verificación de elementos
  if (verificacion_elementos?.length) {
    const conProblemas = verificacion_elementos.filter(v => v.estado_operativo !== 'ok')
    if (conProblemas.length === 0) {
      descripcionApertura += ` Elementos verificados en correctas condiciones (${verificacion_elementos.length} elementos).`
    } else {
      const lista = conProblemas
        .map(v => `${v.nombre}: ${v.estado_operativo === 'faltante' ? 'faltante' : 'falla'}${v.observacion ? ` — ${v.observacion}` : ''}`)
        .join('; ')
      descripcionApertura += ` Observaciones en elementos: ${lista}`
    }
  }

  await supabaseAdmin()
    .from('libro_novedad')
    .insert({
      turno_id:   nuevoTurno.id,
      tecnico_id: user.id,
      tipo:       'apertura',
      hora:       horario_inicio,
      descripcion: descripcionApertura,
    })

  return NextResponse.json(nuevoTurno, { status: 201 })
}
