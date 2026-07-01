import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const PatchSchema = z.object({
  nombre:   z.string().min(1).optional(),
  apellido: z.string().min(1).optional(),
  dni:      z.string().regex(/^\d{7,8}$/).optional(),
  activo:   z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try { await requireRole('admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .from('users')
    .update(parsed.data)
    .eq('id', params.id)
    .eq('rol', 'supervisor')
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Supervisor no encontrado' }, { status: 404 })

  return NextResponse.json({ usuario: data })
}
