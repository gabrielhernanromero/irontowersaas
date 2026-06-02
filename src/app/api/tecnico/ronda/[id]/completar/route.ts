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
    .select('id, tecnico_id, completa, turno_id, numero_ronda, puntos_escaneados, total_puntos')
    .eq('id', params.id)
    .single()

  if (!ronda)                  return NextResponse.json({ error: 'Ronda no encontrada' }, { status: 404 })
  if (ronda.tecnico_id !== user.id) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  if (ronda.completa)          return NextResponse.json({ error: 'La ronda ya está completa' }, { status: 409 })

  const { data, error } = await supabaseAdmin()
    .from('rondas')
    .update({ completa: true, hora_fin: new Date().toISOString() })
    .eq('id', params.id)
    .select('id, completa, hora_fin, puntos_escaneados, total_puntos')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Novedad de cierre en el libro de guardia (completado manual)
  if (ronda.turno_id) {
    const hora = new Date().toLocaleTimeString('es-AR', {
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    })
    await supabaseAdmin()
      .from('libro_novedad')
      .insert({
        turno_id:    ronda.turno_id,
        tecnico_id:  user.id,
        tipo:        'novedad',
        hora,
        descripcion: `Ronda #${ronda.numero_ronda} finalizada — ${ronda.puntos_escaneados}/${ronda.total_puntos} puntos verificados`,
      })
  }

  return NextResponse.json({ ok: true, ronda: data })
}
