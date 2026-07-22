import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ResolucionSchema } from '@/lib/validations/libroTurno'

function horaActual() {
  const now = new Date()
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
}

export async function POST(req: NextRequest) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = ResolucionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 422 })
  }

  const { incidencia_id, turno_id, descripcion_resolucion, foto_url } = parsed.data

  const { data: turno } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, estado, tecnico_id')
    .eq('id', turno_id)
    .single()

  if (!turno) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  if (turno.tecnico_id !== user.id) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  if (turno.estado !== 'abierto') return NextResponse.json({ error: 'El turno no está abierto' }, { status: 409 })

  const { data: incidencia } = await supabaseAdmin()
    .from('incidencias')
    .select('id, estado, titulo')
    .eq('id', incidencia_id)
    .single()

  if (!incidencia) return NextResponse.json({ error: 'Incidencia no encontrada' }, { status: 404 })
  if (incidencia.estado !== 'abierto') return NextResponse.json({ error: 'La incidencia ya fue resuelta' }, { status: 409 })

  // 1. Marcar incidencia como resuelta
  const { error: updateErr } = await supabaseAdmin()
    .from('incidencias')
    .update({ estado: 'resuelto', turno_cierre_id: turno_id })
    .eq('id', incidencia_id)

  if (updateErr) return NextResponse.json({ error: 'Error al resolver la incidencia' }, { status: 500 })

  // 2. Registrar novedad de clausura en el libro
  const { data: novedad, error: insertErr } = await supabaseAdmin()
    .from('libro_novedad')
    .insert({
      turno_id,
      tecnico_id: user.id,
      incidencia_id,
      tipo: 'novedad',
      hora: horaActual(),
      descripcion: `[INCIDENCIA] Resuelta — "${incidencia.titulo}": ${descripcion_resolucion}`,
      foto_url: foto_url ?? null,
    })
    .select()
    .single()

  if (insertErr) return NextResponse.json({ error: 'Error al registrar el cierre' }, { status: 500 })

  return NextResponse.json({ novedad }, { status: 200 })
}
