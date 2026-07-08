import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let observacion: string | null = null
  try {
    const body = await req.json()
    if (typeof body?.observacion === 'string' && body.observacion.trim()) {
      observacion = body.observacion.trim()
    }
  } catch { /* body vacío — ok */ }

  const { data, error } = await supabaseAdmin()
    .from('incidencias')
    .update({
      estado: 'resuelto',
      ...(observacion ? { descripcion_resolucion: observacion } : {}),
    })
    .eq('id', params.id)
    .eq('estado', 'abierto')
    .select('id, estado')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'No se pudo resolver la incidencia' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, incidencia: data })
}
