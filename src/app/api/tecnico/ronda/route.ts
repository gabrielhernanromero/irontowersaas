import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const IniciarSchema = z.object({
  turno_id:   z.string().uuid(),
  cliente_id: z.string().uuid(),
})

// GET — ronda activa del técnico (sin hora_fin)
export async function GET() {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data } = await supabaseAdmin()
    .from('rondas')
    .select(`
      id, turno_id, cliente_id, numero_ronda, hora_inicio,
      total_puntos, puntos_escaneados, completa,
      clientes(id, nombre_empresa),
      ronda_scans(id, punto_control_id, escaneado_at)
    `)
    .eq('tecnico_id', user.id)
    .is('hora_fin', null)
    .eq('completa', false)
    .order('hora_inicio', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ ronda: data })
}

// POST — iniciar nueva ronda
export async function POST(req: NextRequest) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body   = await req.json()
  const parsed = IniciarSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })

  const { turno_id, cliente_id } = parsed.data

  // Verificar turno activo
  const { data: turno } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, estado, tecnico_id')
    .eq('id', turno_id)
    .single()

  if (!turno) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  if (turno.tecnico_id !== user.id) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  if (!['abierto', 'pendiente_relevo'].includes(turno.estado)) {
    return NextResponse.json({ error: 'El turno no está activo' }, { status: 409 })
  }

  // Contar número de ronda del turno
  const { count } = await supabaseAdmin()
    .from('rondas')
    .select('id', { count: 'exact', head: true })
    .eq('turno_id', turno_id)

  // Contar puntos activos del cliente
  const { count: totalPuntos } = await supabaseAdmin()
    .from('puntos_control')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', cliente_id)
    .eq('activo', true)

  const { data: ronda, error } = await supabaseAdmin()
    .from('rondas')
    .insert({
      turno_id,
      tecnico_id:   user.id,
      cliente_id,
      numero_ronda: (count ?? 0) + 1,
      total_puntos: totalPuntos ?? 0,
    })
    .select(`
      id, turno_id, cliente_id, numero_ronda, hora_inicio,
      total_puntos, puntos_escaneados, completa,
      clientes(id, nombre_empresa)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, ronda }, { status: 201 })
}
