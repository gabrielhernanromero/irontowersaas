import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const Schema = z.object({
  titulo:    z.string().min(3, 'El título es obligatorio'),
  severidad: z.enum(['bajo', 'medio', 'alto']),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 422 })

  const { titulo, severidad } = parsed.data

  // Obtener la alerta
  const { data: novedad } = await supabaseAdmin()
    .from('libro_novedad')
    .select('id, tipo, turno_id, descripcion, foto_url, acusado_en, incidencia_id')
    .eq('id', params.id)
    .single()

  if (!novedad) return NextResponse.json({ error: 'Novedad no encontrada' }, { status: 404 })
  if (novedad.tipo !== 'alerta') return NextResponse.json({ error: 'Solo se pueden convertir alertas' }, { status: 400 })
  if (novedad.incidencia_id) return NextResponse.json({ error: 'Ya fue convertida en incidencia' }, { status: 409 })

  // Solo el encargado del turno puede convertir
  const { data: turno } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, tecnico_id, cliente_id, estado')
    .eq('id', novedad.turno_id)
    .single()

  if (!turno) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  if (turno.tecnico_id !== user.id) return NextResponse.json({ error: 'Solo el encargado puede convertir alertas' }, { status: 403 })
  if (turno.estado !== 'abierto') return NextResponse.json({ error: 'El turno está cerrado' }, { status: 409 })

  // Crear la incidencia formal
  const { data: inc, error: incErr } = await supabaseAdmin()
    .from('incidencias')
    .insert({
      cliente_id:        turno.cliente_id ?? null,
      turno_creacion_id: novedad.turno_id,
      titulo:            titulo.trim(),
      descripcion:       novedad.descripcion,
      severidad,
      estado:            'abierto',
      foto_url:          novedad.foto_url || null,
    })
    .select('id')
    .single()

  if (incErr || !inc) return NextResponse.json({ error: 'Error al crear la incidencia' }, { status: 500 })

  // Actualizar la novedad: vincular incidencia + marcar acusada
  const now = new Date().toISOString()
  const { error: updErr } = await supabaseAdmin()
    .from('libro_novedad')
    .update({
      incidencia_id: inc.id,
      acusado_en:    novedad.acusado_en ?? now,
      acusado_por:   novedad.acusado_en ? undefined : user.id,
    })
    .eq('id', params.id)

  if (updErr) return NextResponse.json({ error: 'Error al actualizar la alerta' }, { status: 500 })

  return NextResponse.json({ incidencia_id: inc.id }, { status: 201 })
}
