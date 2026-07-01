import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const CreateSchema = z.object({
  esquema_id: z.string().uuid(),
  usuario_id: z.string().uuid(),
  rol_turno:  z.enum(['encargado', 'apoyo']),
  fecha:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/**
 * GET /api/supervisor/asignaciones?cliente_id=X&fecha=Y
 *   → devuelve todas las excepciones del día para todos los esquemas del cliente
 *
 * GET /api/supervisor/asignaciones?esquema_id=X&fecha=Y
 *   → devuelve excepciones para un esquema específico
 */
export async function GET(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const clienteId = searchParams.get('cliente_id')
  const esquemaId = searchParams.get('esquema_id')
  const fecha     = searchParams.get('fecha')

  if (!fecha) return NextResponse.json({ error: 'fecha requerida' }, { status: 400 })
  if (!clienteId && !esquemaId) {
    return NextResponse.json({ error: 'Se requiere cliente_id o esquema_id' }, { status: 400 })
  }

  let query = supabaseAdmin()
    .from('asignaciones_turno')
    .select(`
      id, esquema_id, rol_turno, fecha,
      usuario:usuario_id ( id, nombre, apellido, dni )
    `)
    .eq('fecha', fecha)

  if (esquemaId) {
    query = query.eq('esquema_id', esquemaId)
  } else if (clienteId) {
    // Obtener los esquemas del cliente para filtrar
    const { data: esquemas } = await supabaseAdmin()
      .from('esquemas_cobertura')
      .select('id')
      .eq('cliente_id', clienteId)
    const ids = (esquemas ?? []).map(e => e.id)
    if (ids.length === 0) return NextResponse.json([])
    query = query.in('esquema_id', ids)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const authUser = await supabaseAdmin().auth.getUser()
  const actorId  = authUser.data.user?.id
  if (!actorId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 })
  }

  const { esquema_id, usuario_id, rol_turno, fecha } = parsed.data

  // Solo un encargado de excepción por esquema/fecha
  if (rol_turno === 'encargado') {
    const { data: existing } = await supabaseAdmin()
      .from('asignaciones_turno')
      .select('id')
      .eq('esquema_id', esquema_id)
      .eq('fecha', fecha)
      .eq('rol_turno', 'encargado')
      .maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: 'Ya hay un encargado asignado para este esquema/día. Eliminalo primero.' },
        { status: 409 }
      )
    }
  }

  const { data, error } = await supabaseAdmin()
    .from('asignaciones_turno')
    .insert({ esquema_id, usuario_id, rol_turno, fecha, created_by: actorId })
    .select(`
      id, esquema_id, rol_turno, fecha,
      usuario:usuario_id ( id, nombre, apellido, dni )
    `)
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Este técnico ya tiene excepción para este día' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
