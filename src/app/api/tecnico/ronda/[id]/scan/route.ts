import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const ScanSchema = z.object({
  codigo_qr: z.string().min(1),
  foto_url:  z.string().url().optional(),
  latitud:   z.number().optional(),
  longitud:  z.number().optional(),
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
      foto_url:         parsed.data.foto_url ?? null,
      latitud:          parsed.data.latitud  ?? null,
      longitud:         parsed.data.longitud ?? null,
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

  // Novedad tipo 'ronda' cuando se auto-completa al escanear el último punto
  if (esCompleta && ronda.turno_id) {
    const ahora = new Date()
    const hora = ahora.toLocaleTimeString('es-AR', {
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    })
    const horaInicioStr = new Date(ronda.hora_inicio).toLocaleTimeString('es-AR', {
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    })
    const duracionMin = Math.round((ahora.getTime() - new Date(ronda.hora_inicio).getTime()) / 60_000)
    const duracionStr = duracionMin >= 60
      ? `${Math.floor(duracionMin / 60)}h ${duracionMin % 60} min`
      : `${duracionMin} min`

    await supabaseAdmin()
      .from('libro_novedad')
      .insert({
        turno_id:    ronda.turno_id,
        tecnico_id:  user.id,
        tipo:        'ronda',
        hora,
        descripcion: `Ronda #${ronda.numero_ronda} completada — ${nuevosEscaneados}/${ronda.total_puntos} puntos · ${horaInicioStr} → ${hora} (${duracionStr})`,
      })
  }

  return NextResponse.json({
    ok:            true,
    scan,
    punto:         { id: punto.id, nombre: punto.nombre, ubicacion: punto.ubicacion },
    escaneados:    nuevosEscaneados,
    total:         ronda.total_puntos,
    rondaCompleta: esCompleta,
  })
}
