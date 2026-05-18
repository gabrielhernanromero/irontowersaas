import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { InformeHidrantes } from '@/components/pdf/InformeHidrantes'
import { InformeExtintores } from '@/components/pdf/InformeExtintores'
import { sendInforme } from '@/lib/email/sendInforme'
import type { User, Cliente, PlanillaHidrante, PlanillaExtintor } from '@/types/database'

export async function POST(
  _req: NextRequest,
  { params }: { params: { planillaId: string } }
) {
  const {
    data: { user: authUser },
    error: authErr,
  } = await supabaseServer().auth.getUser()

  if (authErr || !authUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const admin = supabaseAdmin()

  const { data: planilla } = await admin
    .from('planillas')
    .select('*')
    .eq('id', params.planillaId)
    .single()

  if (!planilla) {
    return NextResponse.json({ error: 'Planilla no encontrada' }, { status: 404 })
  }

  const [
    { data: tecnico },
    { data: cliente },
    { data: hidrantes },
    { data: extintores },
  ] = await Promise.all([
    admin.from('users').select('*').eq('id', planilla.tecnico_id).single(),
    admin.from('clientes').select('*').eq('id', planilla.cliente_id).single(),
    planilla.tipo === 'hidrantes'
      ? admin.from('planilla_hidrantes').select('*').eq('planilla_id', planilla.id).order('numero')
      : Promise.resolve({ data: [] }),
    planilla.tipo === 'extintores'
      ? admin.from('planilla_extintores').select('*').eq('planilla_id', planilla.id).order('numero')
      : Promise.resolve({ data: [] }),
  ])

  if (!cliente) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  // Obtener firma como base64
  let firmaBase64: string | null = null
  if (planilla.firma_url) {
    const { data: firmaData } = await admin.storage
      .from('firmas')
      .download(planilla.firma_url)
    if (firmaData) {
      const buf = Buffer.from(await firmaData.arrayBuffer())
      firmaBase64 = `data:image/png;base64,${buf.toString('base64')}`
    }
  }

  const generadoEn = new Date().toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
  })

  const props = {
    planilla,
    tecnico: tecnico as User,
    cliente: cliente as Cliente,
    firmaBase64,
    generadoEn,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element: any = planilla.tipo === 'hidrantes'
    ? createElement(InformeHidrantes, { ...props, items: (hidrantes ?? []) as PlanillaHidrante[] })
    : createElement(InformeExtintores, { ...props, items: (extintores ?? []) as PlanillaExtintor[] })

  const pdfBuffer = await renderToBuffer(element)

  const filename = `informe-${planilla.tipo}-${planilla.fecha}-turno-${planilla.turno}.pdf`

  await sendInforme({
    planilla,
    cliente: cliente as Cliente,
    pdfBuffer,
    filename,
  })

  // Subir copia al bucket informes
  await admin.storage
    .from('informes')
    .upload(`${params.planillaId}.pdf`, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  return NextResponse.json({ ok: true })
}
