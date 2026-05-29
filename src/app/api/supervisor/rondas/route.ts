import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  try { await requireRole('supervisor', 'admin') } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const params    = req.nextUrl.searchParams
  const clienteId = params.get('cliente_id')
  const desde     = params.get('desde')
  const hasta     = params.get('hasta')

  let query = supabaseAdmin()
    .from('rondas')
    .select(`
      id, turno_id, tecnico_id, cliente_id, numero_ronda,
      hora_inicio, hora_fin, total_puntos, puntos_escaneados, completa, created_at,
      clientes(id, nombre_empresa),
      ronda_scans(id, punto_control_id, escaneado_at, foto_url,
        puntos_control(id, nombre, ubicacion)
      )
    `)
    .order('hora_inicio', { ascending: false })

  if (clienteId) query = query.eq('cliente_id', clienteId)
  if (desde)     query = query.gte('hora_inicio', desde)
  if (hasta)     query = query.lte('hora_inicio', hasta)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rondas: data })
}
