import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin()
    .from('libro_turno')
    .select(`
      id, folio_numero, fecha, turno, tecnico_nombre, tecnico_dni,
      horario_inicio, horario_fin, estado, cliente_id, created_at,
      clientes(id, nombre_empresa),
      novedades:libro_novedad(
        id, tipo, hora, descripcion, riesgo_detectado,
        medidas_adoptadas, observaciones_generales,
        incidencia_id, foto_url, created_at
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  }

  // Sort novedades by hora ascending
  if (data.novedades) {
    (data.novedades as { hora: string }[]).sort((a, b) => a.hora.localeCompare(b.hora))
  }

  return NextResponse.json({ turno: data })
}
