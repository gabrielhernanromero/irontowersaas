import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data: { user } } = await supabaseServer().auth.getUser()
  if (!user) {
    return NextResponse.json(
      { guardia: 0, rondas: 0, elementos: 0 },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const [alertasData, perfilData] = await Promise.all([
    supabaseAdmin()
      .from('alertas')
      .select('tipo')
      .eq('destinatario_id', user.id)
      .eq('leida', false),
    supabaseAdmin()
      .from('users')
      .select('cliente_id')
      .eq('id', user.id)
      .single(),
  ])

  const alertas = alertasData.data ?? []
  const rondasTipos = new Set(['ronda_proxima', 'ronda_vencida'])
  const guardia = alertas.filter(a => !rondasTipos.has(a.tipo)).length
  const rondas  = alertas.filter(a =>  rondasTipos.has(a.tipo)).length

  let elementos = 0
  const clienteId = perfilData.data?.cliente_id
  if (clienteId) {
    const { count } = await supabaseAdmin()
      .from('elementos_puesto')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', clienteId)
      .eq('estado_admin', 'en_mantenimiento')
    elementos = count ?? 0
  }

  return NextResponse.json(
    { guardia, rondas, elementos },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
