import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { calcularHorasTrabajadas } from '@/lib/personal/calcularHorasTrabajadas'
import { z } from 'zod'

const QuerySchema = z.object({
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha "desde" inválida'),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha "hasta" inválida'),
  tecnicoId: z.string().uuid().optional(),
}).refine((v) => v.desde <= v.hasta, { message: 'El rango de fechas es inválido (desde > hasta)' })

export async function GET(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const parsed = QuerySchema.safeParse({
    desde: searchParams.get('desde') ?? undefined,
    hasta: searchParams.get('hasta') ?? undefined,
    tecnicoId: searchParams.get('tecnicoId') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const resumen = await calcularHorasTrabajadas(supabaseAdmin(), parsed.data)
  return NextResponse.json({ tecnicos: resumen })
}
