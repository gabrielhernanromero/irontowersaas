import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const CreateSchema = z.object({
  esquema_id: z.string().uuid(),
  usuario_id: z.string().uuid(),
  rol_turno:  z.enum(['encargado', 'apoyo']),
})

export async function GET(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const esquemaId = req.nextUrl.searchParams.get('esquema_id')
  if (!esquemaId) return NextResponse.json({ error: 'esquema_id requerido' }, { status: 400 })

  const { data, error } = await supabaseAdmin()
    .from('asignaciones_persistentes')
    .select('id, rol_turno, usuario:usuario_id( id, nombre, apellido, dni )')
    .eq('esquema_id', esquemaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ asignaciones: data })
}

export async function POST(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body   = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })

  const { esquema_id, usuario_id, rol_turno } = parsed.data

  // Solo un encargado permanente por esquema
  if (rol_turno === 'encargado') {
    const { data: existing } = await supabaseAdmin()
      .from('asignaciones_persistentes')
      .select('id')
      .eq('esquema_id', esquema_id)
      .eq('rol_turno', 'encargado')
      .maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un encargado permanente. Eliminalo primero.' },
        { status: 409 }
      )
    }
  }

  const { data, error } = await supabaseAdmin()
    .from('asignaciones_persistentes')
    .insert({ esquema_id, usuario_id, rol_turno })
    .select('id, rol_turno, usuario:usuario_id( id, nombre, apellido, dni )')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Este técnico ya está asignado a este esquema' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, asignacion: data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabaseAdmin()
    .from('asignaciones_persistentes')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
