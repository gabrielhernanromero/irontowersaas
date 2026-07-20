import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { InformeHidrantes } from '@/components/pdf/InformeHidrantes'
import { InformeExtintores } from '@/components/pdf/InformeExtintores'
import { InformeGenerico } from '@/components/pdf/InformeGenerico'
import type { User, Cliente, PlanillaHidrante, PlanillaExtintor, PlanillaItemRespuesta, TipoCampo } from '@/types/database'

interface CampoDef {
  clave: string
  etiqueta: string
  tipo_campo?: TipoCampo
  opciones?: string[]
  valor_min?: number | null
  valor_max?: number | null
}

export async function GET(
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

  const { data: perfil } = await admin
    .from('users')
    .select('rol, cliente_id, activo')
    .eq('id', authUser.id)
    .single()

  if (!perfil || !perfil.activo) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: planilla } = await admin
    .from('planillas')
    .select('*')
    .eq('id', params.planillaId)
    .single()

  if (!planilla) {
    return NextResponse.json({ error: 'Planilla no encontrada' }, { status: 404 })
  }

  // Regla 6 (trazabilidad): supervisor/admin ven cualquier planilla; técnico/cliente
  // solo las de su propio cliente_id — evita que cualquier logueado pueda pedir el
  // PDF de cualquier planilla por ID si lo conoce.
  const tieneAcceso = perfil.rol === 'supervisor' || perfil.rol === 'admin' || perfil.cliente_id === planilla.cliente_id
  if (!tieneAcceso) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // El template se decide por DÓNDE ESTÁN LOS DATOS de esta planilla puntual,
  // no por el string `tipo` — Hidrantes/Extintores pueden tener planillas viejas
  // en planilla_hidrantes/planilla_extintores y planillas nuevas (post-activación
  // del motor genérico) en planilla_item_respuestas, ambas con tipo='hidrantes'.
  const { count: countGenerico } = await admin
    .from('planilla_item_respuestas')
    .select('id', { count: 'exact', head: true })
    .eq('planilla_id', planilla.id)
  const usaGenerico = (countGenerico ?? 0) > 0
  const esLegacyStorage = !usaGenerico && (planilla.tipo === 'hidrantes' || planilla.tipo === 'extintores')

  const [
    { data: tecnico },
    { data: cliente },
    { data: hidrantes },
    { data: extintores },
  ] = await Promise.all([
    admin.from('users').select('*').eq('id', planilla.tecnico_id).single(),
    admin.from('clientes').select('*').eq('id', planilla.cliente_id).single(),
    esLegacyStorage && planilla.tipo === 'hidrantes'
      ? admin.from('planilla_hidrantes').select('*').eq('planilla_id', planilla.id).order('numero')
      : Promise.resolve({ data: [] }),
    esLegacyStorage && planilla.tipo === 'extintores'
      ? admin.from('planilla_extintores').select('*').eq('planilla_id', planilla.id).order('numero')
      : Promise.resolve({ data: [] }),
  ])

  let genericoItems: PlanillaItemRespuesta[] = []
  let genericoCampos: CampoDef[] = []
  let tipoNombreGenerico = planilla.tipo
  if (!esLegacyStorage) {
    const { data: itemsData } = await admin
      .from('planilla_item_respuestas')
      .select('*')
      .eq('planilla_id', planilla.id)
      .order('numero')
    genericoItems = (itemsData ?? []) as PlanillaItemRespuesta[]

    if (planilla.snapshot_config) {
      // Planilla enviada después de esta migración: el informe usa la config
      // vigente al momento del envío, no la actual — así renombrar/eliminar
      // una columna después no altera el PDF de una planilla ya inmutable.
      genericoCampos = planilla.snapshot_config.campos
      tipoNombreGenerico = planilla.snapshot_config.tipo_nombre
    } else {
      // Planilla previa a esta migración: no tiene snapshot guardado — mejor
      // esfuerzo con la config actual (comportamiento previo).
      const { data: tipoGenerico } = await admin
        .from('planilla_tipos')
        .select('id, nombre')
        .eq('cliente_id', planilla.cliente_id)
        .eq('slug', planilla.tipo)
        .single()
      if (tipoGenerico) {
        const { data: camposData } = await admin
          .from('planilla_tipo_campos')
          .select('clave, etiqueta, tipo_campo, opciones, valor_min, valor_max')
          .eq('planilla_tipo_id', tipoGenerico.id)
          .order('orden')
        genericoCampos = (camposData ?? []) as CampoDef[]
        tipoNombreGenerico = tipoGenerico.nombre
      }
    }
  }

  // Obtener firma como base64
  let firmaBase64: string | null = null
  if (planilla.firma_url) {
    const { data: firmaData } = await admin.storage
      .from('firmas')
      .download(planilla.firma_url)
    if (firmaData) {
      const buffer = Buffer.from(await firmaData.arrayBuffer())
      firmaBase64 = `data:image/png;base64,${buffer.toString('base64')}`
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
  const element: any = esLegacyStorage && planilla.tipo === 'hidrantes'
    ? createElement(InformeHidrantes, { ...props, items: (hidrantes ?? []) as PlanillaHidrante[] })
    : esLegacyStorage && planilla.tipo === 'extintores'
    ? createElement(InformeExtintores, { ...props, items: (extintores ?? []) as PlanillaExtintor[] })
    : createElement(InformeGenerico, {
        ...props,
        tipoNombre: tipoNombreGenerico,
        campos: genericoCampos,
        items: genericoItems,
      })

  const pdfBuffer = await renderToBuffer(element)

  // Subir copia al bucket informes
  const pdfPath = `${params.planillaId}.pdf`
  await admin.storage
    .from('informes')
    .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="informe-${planilla.tipo}-${planilla.fecha}.pdf"`,
    },
  })
}
