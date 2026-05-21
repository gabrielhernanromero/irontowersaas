import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NuevaNovedadSchema } from '@/lib/validations/libroTurno'

export async function POST(req: NextRequest) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = NuevaNovedadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 422 })
  }

  const {
    turno_id, hora, descripcion, riesgo_detectado, medidas_adoptadas,
    observaciones_generales, foto_url,
    es_incidencia, incidencia_titulo, incidencia_severidad,
  } = parsed.data

  const { data: turno } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, estado, tecnico_id, cliente_id')
    .eq('id', turno_id)
    .single()

  if (!turno) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  if (turno.tecnico_id !== user.id) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  if (turno.estado !== 'abierto') return NextResponse.json({ error: 'El turno está cerrado' }, { status: 409 })

  // Si es incidencia: crear primero para obtener el ID y enlazarlo a la novedad
  let incidenciaId: string | null = null
  if (es_incidencia && incidencia_titulo?.trim()) {
    const { data: inc, error: incErr } = await supabaseAdmin()
      .from('incidencias')
      .insert({
        cliente_id:        turno.cliente_id ?? null,
        turno_creacion_id: turno_id,
        titulo:            incidencia_titulo.trim(),
        descripcion,
        severidad:         incidencia_severidad ?? 'medio',
        estado:            'abierto',
        foto_url:          foto_url || null,
      })
      .select('id')
      .single()

    if (!incErr && inc) incidenciaId = inc.id
  }

  const { data: novedad, error } = await supabaseAdmin()
    .from('libro_novedad')
    .insert({
      turno_id,
      tipo:                    'novedad',
      hora,
      descripcion,
      riesgo_detectado:        riesgo_detectado || null,
      medidas_adoptadas:       medidas_adoptadas || null,
      observaciones_generales: observaciones_generales || null,
      foto_url:                foto_url || null,
      incidencia_id:           incidenciaId,
    })
    .select('*, incidencias(id, titulo, severidad, estado)')
    .single()

  if (error) return NextResponse.json({ error: 'Error al registrar la novedad' }, { status: 500 })

  return NextResponse.json(novedad, { status: 201 })
}
