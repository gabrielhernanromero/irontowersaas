import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const incidenciaId = req.nextUrl.searchParams.get('id')
  if (!incidenciaId) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const { data, error } = await supabaseAdmin()
    .from('libro_novedad')
    .select('id, hora, descripcion, created_at, libro_turno(users(nombre, apellido))')
    .eq('incidencia_id', incidenciaId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
