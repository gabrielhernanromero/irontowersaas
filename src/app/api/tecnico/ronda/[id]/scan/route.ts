import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { alertarSupervisores } from '@/lib/alertas/createAlerta'
import { getArgTime } from '@/lib/cobertura/timeUtils'
import { z } from 'zod'

const IncidenciaAccionSchema = z.object({
  incidencia_id: z.string().uuid(),
  accion:        z.enum(['sigue', 'cambio', 'resuelto']),
  comentario:    z.string().max(500).optional(),
})

const ScanSchema = z.object({
  codigo_qr:            z.string().min(1),
  foto_url:             z.string().url().optional(),
  latitud:              z.number().optional(),
  longitud:             z.number().optional(),
  observacion:          z.string().max(500).optional(),
  incidencias_acciones: z.array(IncidenciaAccionSchema).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body   = await req.json()
  const parsed = ScanSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })

  // Verificar que la ronda pertenece al técnico y está activa
  const { data: ronda } = await supabaseAdmin()
    .from('rondas')
    .select('id, tecnico_id, cliente_id, total_puntos, puntos_escaneados, completa, hora_fin, hora_inicio, turno_id, numero_ronda, libro_turno!turno_id(estado)')
    .eq('id', params.id)
    .single()

  if (!ronda)                  return NextResponse.json({ error: 'Ronda no encontrada' }, { status: 404 })
  if (ronda.tecnico_id !== user.id) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  if (ronda.completa || ronda.hora_fin) return NextResponse.json({ error: 'La ronda ya está cerrada' }, { status: 409 })

  const turnoEstado = (ronda as any).libro_turno?.estado
  if (turnoEstado !== 'abierto') {
    return NextResponse.json({ error: 'No podés escanear: el turno ya no está abierto' }, { status: 409 })
  }

  // Buscar el punto de control por codigo_qr
  const { data: punto } = await supabaseAdmin()
    .from('puntos_control')
    .select('id, nombre, ubicacion, cliente_id')
    .eq('codigo_qr', parsed.data.codigo_qr)
    .eq('activo', true)
    .single()

  if (!punto) return NextResponse.json({ error: 'Punto de control no encontrado' }, { status: 404 })
  if (punto.cliente_id !== ronda.cliente_id) {
    return NextResponse.json({ error: 'Este punto no pertenece al cliente de la ronda' }, { status: 409 })
  }

  // Verificar que no esté ya escaneado en esta ronda
  const { data: existing } = await supabaseAdmin()
    .from('ronda_scans')
    .select('id')
    .eq('ronda_id', params.id)
    .eq('punto_control_id', punto.id)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Este punto ya fue escaneado en esta ronda', yaEscaneado: true }, { status: 409 })

  // Registrar el scan
  const nuevosEscaneados = ronda.puntos_escaneados + 1
  const esCompleta       = nuevosEscaneados >= ronda.total_puntos

  const { data: scan, error: scanErr } = await supabaseAdmin()
    .from('ronda_scans')
    .insert({
      ronda_id:         params.id,
      punto_control_id: punto.id,
      foto_url:         parsed.data.foto_url    ?? null,
      latitud:          parsed.data.latitud     ?? null,
      longitud:         parsed.data.longitud    ?? null,
      observacion:      parsed.data.observacion ?? null,
      orden_real:       nuevosEscaneados,
    })
    .select('id, punto_control_id, escaneado_at')
    .single()

  if (scanErr) return NextResponse.json({ error: scanErr.message }, { status: 500 })

  // Actualizar contadores de la ronda
  await supabaseAdmin()
    .from('rondas')
    .update({
      puntos_escaneados: nuevosEscaneados,
      completa:          esCompleta,
      hora_fin:          esCompleta ? new Date().toISOString() : null,
    })
    .eq('id', params.id)

  // Procesar acciones sobre incidencias existentes del punto
  const incidenciasAcciones = parsed.data.incidencias_acciones ?? []
  if (incidenciasAcciones.length > 0 && ronda.turno_id) {
    const { hours, minutes } = getArgTime()
    const horaAR = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

    for (const ia of incidenciasAcciones) {
      if (ia.accion === 'sigue') continue

      if (ia.accion === 'resuelto') {
        await supabaseAdmin()
          .from('incidencias')
          .update({ estado: 'cerrado' })
          .eq('id', ia.incidencia_id)
      } else if (ia.accion === 'cambio') {
        await supabaseAdmin()
          .from('incidencias')
          .update({ estado: 'en_seguimiento' })
          .eq('id', ia.incidencia_id)
      }

      if (ia.comentario?.trim()) {
        await supabaseAdmin()
          .from('libro_novedad')
          .insert({
            turno_id:      ronda.turno_id,
            tecnico_id:    user.id,
            tipo:          'novedad',
            hora:          horaAR,
            incidencia_id: ia.incidencia_id,
            descripcion:   ia.accion === 'resuelto'
              ? `Ronda #${ronda.numero_ronda} · ${punto.nombre}: incidencia resuelta — ${ia.comentario}`
              : `Ronda #${ronda.numero_ronda} · ${punto.nombre}: ${ia.comentario}`,
          })
      }
    }
  }

  // Si hay observación nueva → crear incidencia + novedad en libro de guardia + alertar
  const observacion = parsed.data.observacion?.trim()
  if (observacion && ronda.turno_id) {
    const { hours, minutes } = getArgTime()
    const horaAR = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

    await supabaseAdmin()
      .from('libro_novedad')
      .insert({
        turno_id:    ronda.turno_id,
        tecnico_id:  user.id,
        tipo:        'novedad',
        hora:        horaAR,
        descripcion: `Ronda #${ronda.numero_ronda} · ${punto.nombre}: ${observacion}`,
      })

    await supabaseAdmin()
      .from('incidencias')
      .insert({
        cliente_id:          ronda.cliente_id,
        turno_creacion_id:   ronda.turno_id,
        punto_control_id:    punto.id,
        tecnico_detector_id: user.id,
        titulo:              `Ronda #${ronda.numero_ronda} · ${punto.nombre}`,
        descripcion:         observacion,
        severidad:           'medio',
        estado:              'abierto',
      })

    await alertarSupervisores(
      'novedad_scan',
      `Novedad en Ronda #${ronda.numero_ronda} · ${punto.nombre}: ${observacion}`,
      { turnoId: ronda.turno_id },
    ).catch(() => {})
  }

  // La novedad de ronda completada se crea automáticamente via trigger fn_novedad_ronda_completada

  return NextResponse.json({
    ok:            true,
    scan,
    punto:         { id: punto.id, nombre: punto.nombre, ubicacion: punto.ubicacion },
    escaneados:    nuevosEscaneados,
    total:         ronda.total_puntos,
    rondaCompleta: esCompleta,
  })
}
