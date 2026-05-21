import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const planillaId = req.nextUrl.searchParams.get('id')
  if (!planillaId) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const { data: planilla } = await supabaseAdmin()
    .from('planillas')
    .select('id, tipo, fecha, turno, enviada_at, users!tecnico_id(nombre, apellido, dni)')
    .eq('id', planillaId)
    .single()

  if (!planilla) return NextResponse.json({ error: 'Planilla no encontrada' }, { status: 404 })

  const tecnicoUser = (planilla.users as unknown) as { nombre: string; apellido: string; dni: string | null } | null
  const tecnico_nombre = tecnicoUser ? `${tecnicoUser.nombre} ${tecnicoUser.apellido}` : '—'
  const tecnico_dni = tecnicoUser?.dni ?? ''

  // Fetch items según tipo
  let itemsConObservacion: unknown[] = []
  let total = 0
  let ok = 0

  let allItems: unknown[] = []

  if (planilla.tipo === 'hidrantes') {
    const { data: items } = await supabaseAdmin()
      .from('planilla_hidrantes')
      .select('numero, gabinete, manga, lanza, valvula, obs_gabinete, obs_manga, obs_lanza, obs_valvula')
      .eq('planilla_id', planillaId)
      .order('numero')

    allItems = items ?? []
    total = allItems.length
    ok = (items ?? []).filter(
      (i) => i.gabinete && i.manga && i.lanza && i.valvula
    ).length
    itemsConObservacion = (items ?? []).filter(
      (i) => !i.gabinete || !i.manga || !i.lanza || !i.valvula
    )
  } else if (planilla.tipo === 'extintores') {
    const { data: items } = await supabaseAdmin()
      .from('planilla_extintores')
      .select('numero, senalizacion, acceso, presion_peso, obs_senalizacion, obs_acceso, obs_presion_peso')
      .eq('planilla_id', planillaId)
      .order('numero')

    allItems = items ?? []
    total = allItems.length
    ok = (items ?? []).filter(
      (i) => i.senalizacion && i.acceso && i.presion_peso
    ).length
    itemsConObservacion = (items ?? []).filter(
      (i) => !i.senalizacion || !i.acceso || !i.presion_peso
    )
  }

  return NextResponse.json({
    planilla: { ...planilla, tecnico_nombre, tecnico_dni },
    stats: { total, ok, conObservaciones: total - ok },
    itemsConObservacion,
    allItems,
  })
}
