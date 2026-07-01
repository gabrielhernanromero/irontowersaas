import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const HoraRx = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/

const UpdateSchema = z.object({
  nombre:          z.string().min(1).max(100).optional(),
  hora_inicio:     z.string().regex(HoraRx).optional(),
  hora_fin:        z.string().regex(HoraRx).optional(),
  activo:          z.boolean().optional(),
  dias_semana:     z.array(z.number().int().min(0).max(6)).min(1).optional(),
  fecha_desde:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha_hasta:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  requiere_relevo: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body   = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })

  // Obtener el esquema actual para tener cliente_id y valores vigentes
  const { data: actual } = await supabaseAdmin()
    .from('esquemas_cobertura')
    .select('cliente_id, nombre, hora_inicio, hora_fin')
    .eq('id', params.id)
    .single()

  if (!actual) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })

  const nombreNuevo     = parsed.data.nombre     ?? actual.nombre
  const horaInicioNueva = parsed.data.hora_inicio ?? actual.hora_inicio
  const horaFinNueva    = parsed.data.hora_fin    ?? actual.hora_fin

  if (horaInicioNueva === horaFinNueva) {
    return NextResponse.json({ error: 'La hora de inicio y fin no pueden ser iguales.' }, { status: 400 })
  }

  // Validar nombre duplicado (case-insensitive, excluyendo el propio registro)
  if (parsed.data.nombre !== undefined) {
    const { data: existeNombre } = await supabaseAdmin()
      .from('esquemas_cobertura')
      .select('id')
      .eq('cliente_id', actual.cliente_id)
      .ilike('nombre', nombreNuevo.trim())
      .neq('id', params.id)
      .maybeSingle()
    if (existeNombre) {
      return NextResponse.json(
        { error: `Ya existe un turno llamado "${nombreNuevo}" en este puesto. Usá un nombre diferente.` },
        { status: 409 }
      )
    }
  }

  // Validar horario duplicado (excluyendo el propio registro)
  if (parsed.data.hora_inicio !== undefined || parsed.data.hora_fin !== undefined) {
    const { data: existeHorario } = await supabaseAdmin()
      .from('esquemas_cobertura')
      .select('id, nombre')
      .eq('cliente_id', actual.cliente_id)
      .eq('hora_inicio', horaInicioNueva)
      .eq('hora_fin', horaFinNueva)
      .neq('id', params.id)
      .maybeSingle()
    if (existeHorario) {
      return NextResponse.json(
        { error: `Ya existe el turno "${existeHorario.nombre}" con la misma franja horaria (${horaInicioNueva.slice(0,5)} – ${horaFinNueva.slice(0,5)}).` },
        { status: 409 }
      )
    }
  }

  const { data, error } = await supabaseAdmin()
    .from('esquemas_cobertura')
    .update(parsed.data)
    .eq('id', params.id)
    .select('id, nombre, hora_inicio, hora_fin, activo, dias_semana, requiere_relevo, fecha_desde, fecha_hasta')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, esquema: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { error } = await supabaseAdmin()
    .from('esquemas_cobertura')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
