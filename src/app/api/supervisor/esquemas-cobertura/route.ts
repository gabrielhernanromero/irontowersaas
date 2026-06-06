import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const HoraRx = /^\d{2}:\d{2}(:\d{2})?$/

const CreateSchema = z.object({
  cliente_id:  z.string().uuid(),
  nombre:      z.string().min(1, 'Nombre requerido').max(100),
  hora_inicio: z.string().regex(HoraRx, 'Formato HH:MM'),
  hora_fin:    z.string().regex(HoraRx, 'Formato HH:MM'),
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
      id, nombre, hora_inicio, hora_fin, activo, created_at,
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

  const { hora_inicio, hora_fin } = parsed.data
  if (hora_inicio === hora_fin) {
    return NextResponse.json({ error: 'hora_inicio y hora_fin no pueden ser iguales' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .from('esquemas_cobertura')
    .insert(parsed.data)
    .select('id, nombre, hora_inicio, hora_fin, activo, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, esquema: { ...data, asignaciones: [] } }, { status: 201 })
}
