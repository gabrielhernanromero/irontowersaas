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
  if (!['abierto', 'pendiente_relevo'].includes(turno.estado)) {
    return NextResponse.json({ error: 'El turno no está activo' }, { status: 409 })
  }

  // El usuario debe ser el tecnico_id del turno (encargado/interino) o un participante (apoyo)
  if (turno.tecnico_id !== user.id) {
    const { data: participacion } = await supabaseAdmin()
      .from('participaciones_turno')
      .select('id')
      .eq('turno_id', turno_id)
      .eq('usuario_id', user.id)
      .maybeSingle()
    if (!participacion) return NextResponse.json({ error: 'Sin permisos para este turno' }, { status: 403 })
  }

  // Prevenir dos rondas simultáneas en el mismo turno
  const { data: rondaEnCurso } = await supabaseAdmin()
    .from('rondas')
    .select('id')
    .eq('turno_id', turno_id)
    .is('hora_fin', null)
    .eq('completa', false)
    .maybeSingle()
  if (rondaEnCurso) {
    return NextResponse.json({ error: 'Ya hay una ronda en curso para este turno. Esperá a que termine.' }, { status: 409 })
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

  if (!totalPuntos || totalPuntos === 0) {
    return NextResponse.json(
      { error: 'No hay puntos de control configurados para este puesto' },
      { status: 409 }
    )
  }

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

  // Novedad de apertura en el libro de guardia
  const hora = new Date().toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  await supabaseAdmin()
    .from('libro_novedad')
    .insert({
      turno_id,
      tecnico_id:  user.id,
      tipo:        'novedad',
      hora,
      descripcion: `Inicio de ronda #${ronda.numero_ronda}`,
    })

  return NextResponse.json({ ok: true, ronda }, { status: 201 })
}
