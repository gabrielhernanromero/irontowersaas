import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin()
    .from('incidencias')
    .update({ estado: 'resuelto' })
    .eq('id', params.id)
    .eq('estado', 'abierto')
    .select('id, estado')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'No se pudo resolver la incidencia' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, incidencia: data })
}
