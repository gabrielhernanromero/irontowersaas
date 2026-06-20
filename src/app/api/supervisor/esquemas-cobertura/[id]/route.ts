import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const HoraRx = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/

const UpdateSchema = z.object({
  nombre:      z.string().min(1).max(100).optional(),
  hora_inicio: z.string().regex(HoraRx).optional(),
  hora_fin:    z.string().regex(HoraRx).optional(),
  activo:      z.boolean().optional(),
  dias_semana: z.array(z.number().int().min(0).max(6)).min(1).optional(),
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

  const { data, error } = await supabaseAdmin()
    .from('esquemas_cobertura')
    .update(parsed.data)
    .eq('id', params.id)
    .select('id, nombre, hora_inicio, hora_fin, activo')
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
