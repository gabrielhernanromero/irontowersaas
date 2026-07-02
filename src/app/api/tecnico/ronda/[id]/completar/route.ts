import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: ronda } = await supabaseAdmin()
    .from('rondas')
    .select('id, tecnico_id, completa, turno_id, numero_ronda, puntos_escaneados, total_puntos, hora_inicio, libro_turno!turno_id(estado)')
    .eq('id', params.id)
    .single()

  if (!ronda)                  return NextResponse.json({ error: 'Ronda no encontrada' }, { status: 404 })
  if (ronda.tecnico_id !== user.id) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  if (ronda.completa)          return NextResponse.json({ error: 'La ronda ya está completa' }, { status: 409 })

  const turnoEstado = (ronda as any).libro_turno?.estado
  if (turnoEstado !== 'abierto') {
    return NextResponse.json({ error: 'No podés completar la ronda: el turno ya no está abierto' }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin()
    .from('rondas')
    .update({ completa: true, hora_fin: new Date().toISOString() })
    .eq('id', params.id)
    .select('id, completa, hora_fin, puntos_escaneados, total_puntos')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Novedad tipo 'ronda' al completar manualmente
  if (ronda.turno_id) {
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
    const completitudStr = ronda.puntos_escaneados < ronda.total_puntos ? 'incompleta' : 'completada'

    await supabaseAdmin()
      .from('libro_novedad')
      .insert({
        turno_id:    ronda.turno_id,
        tecnico_id:  user.id,
        tipo:        'ronda',
        hora,
        descripcion: `Ronda #${ronda.numero_ronda} ${completitudStr} — ${ronda.puntos_escaneados}/${ronda.total_puntos} puntos · ${horaInicioStr} → ${hora} (${duracionStr})`,
      })
  }

  return NextResponse.json({ ok: true, ronda: data })
}
