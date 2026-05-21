import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  await requireRole('tecnico', 'admin', 'supervisor')

  const { searchParams } = new URL(request.url)
  const clienteId = searchParams.get('cliente_id')

  if (!clienteId) {
    return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })
  }

  const { data: elementos, error } = await supabaseAdmin()
    .from('elementos_puesto')
    .select('id, nombre, codigo_patrimonial, categoria, estado_admin, motivo_mantenimiento, incidencias!elemento_afectado_id(id, estado)')
    .eq('cliente_id', clienteId)
    .neq('estado_admin', 'inactivo')
    .order('nombre')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ elementos: elementos ?? [] })
}
