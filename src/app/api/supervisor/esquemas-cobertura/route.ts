import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

// Acepta HH:MM de 00:00 a 24:00
const HoraRx = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/

const CreateSchema = z.object({
  cliente_id:  z.string().uuid(),
  nombre:      z.string().min(1, 'Nombre requerido').max(100),
  hora_inicio: z.string().regex(HoraRx, 'Formato HH:MM'),
  hora_fin:    z.string().regex(HoraRx, 'Formato HH:MM'),
  fecha_desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD').optional(),
  dias_semana: z.array(z.number().int().min(0).max(6)).min(1, 'Seleccioná al menos un día').default([0,1,2,3,4,5,6]),
})

export async function GET(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const clienteId = req.nextUrl.searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

  const { data, error } = await supabaseAdmin()
    .from('esquemas_cobertura')
    .select(`
      id, nombre, hora_inicio, hora_fin, fecha_desde, activo, dias_semana, created_at,
      asignaciones:asignaciones_persistentes (
        id, rol_turno,
        usuario:usuario_id ( id, nombre, apellido, dni )
      )
    `)
    .eq('cliente_id', clienteId)
    .order('hora_inicio', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ esquemas: data })
}

export async function POST(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body   = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })

  const { cliente_id, nombre, hora_inicio, hora_fin } = parsed.data

  if (hora_inicio === hora_fin) {
    return NextResponse.json({ error: 'La hora de inicio y fin no pueden ser iguales.' }, { status: 400 })
  }

  // Verificar duplicado: mismo nombre en el mismo cliente
  const { data: existeNombre } = await supabaseAdmin()
    .from('esquemas_cobertura')
    .select('id')
    .eq('cliente_id', cliente_id)
    .ilike('nombre', nombre.trim())
    .maybeSingle()
  if (existeNombre) {
    return NextResponse.json({ error: `Ya existe un turno llamado "${nombre}" en este puesto. Usá un nombre diferente para distinguirlos.` }, { status: 409 })
  }

  // Verificar duplicado: misma franja horaria en el mismo cliente
  const { data: existeHorario } = await supabaseAdmin()
    .from('esquemas_cobertura')
    .select('id, nombre')
    .eq('cliente_id', cliente_id)
    .eq('hora_inicio', hora_inicio)
    .eq('hora_fin', hora_fin)
    .maybeSingle()
  if (existeHorario) {
    return NextResponse.json({ error: `Ya existe el turno "${existeHorario.nombre}" con la misma franja horaria (${hora_inicio.slice(0,5)} – ${hora_fin.slice(0,5)}). Cada turno debe tener un horario distinto.` }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin()
    .from('esquemas_cobertura')
    .insert(parsed.data)
    .select('id, nombre, hora_inicio, hora_fin, fecha_desde, activo, dias_semana, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, esquema: { ...data, asignaciones: [] } }, { status: 201 })
}
