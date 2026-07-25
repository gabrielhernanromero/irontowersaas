import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { calcularMetricasConfiabilidad } from '@/lib/informes/calcularMetricasConfiabilidad'
import { InformeConfiabilidad } from '@/components/pdf/InformeConfiabilidad'
import { sendInformeConfiabilidad } from '@/lib/email/sendInformeConfiabilidad'
import type { Cliente } from '@/types/database'

function calcularPeriodoMesAnterior(): { fechaDesde: string; fechaHasta: string } {
  const ahora = new Date()
  const primerDiaMesActual = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const ultimoDiaMesAnterior = new Date(primerDiaMesActual.getTime() - 86400000)
  const primerDiaMesAnterior = new Date(ultimoDiaMesAnterior.getFullYear(), ultimoDiaMesAnterior.getMonth(), 1)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { fechaDesde: fmt(primerDiaMesAnterior), fechaHasta: fmt(ultimoDiaMesAnterior) }
}

export async function GET(req: NextRequest) {
  // Regla 5 (mismo patrón que check-pending): verificar CRON_SECRET
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const { fechaDesde, fechaHasta } = calcularPeriodoMesAnterior()

  // Soporte para invocación manual acotada a un cliente — para probar sin
  // mandarle el mail a toda la cartera (ver plan de verificación).
  const clienteIdParam = req.nextUrl.searchParams.get('cliente_id')

  let query = admin.from('clientes').select('*').eq('activo', true)
  if (clienteIdParam) query = query.eq('id', clienteIdParam)
  const { data: clientes } = await query

  let enviados = 0
  let errores = 0
  let omitidos = 0

  for (const cliente of (clientes ?? []) as Cliente[]) {
    try {
      // Evita reenviar si el cron se reintenta para el mismo período/cliente.
      const { data: yaEnviado } = await admin
        .from('informes')
        .select('id')
        .eq('tipo', 'confiabilidad')
        .eq('cliente_id', cliente.id)
        .eq('fecha_desde', fechaDesde)
        .eq('fecha_hasta', fechaHasta)
        .eq('estado', 'enviado')
        .maybeSingle()

      if (yaEnviado) {
        omitidos++
        continue
      }

      const metricas = await calcularMetricasConfiabilidad(admin, cliente.id, fechaDesde, fechaHasta)

      const numero = `CONF-${cliente.id.slice(0, 8)}-${fechaDesde}`
      const { data: informe, error: insertErr } = await admin
        .from('informes')
        .insert({
          numero,
          tipo: 'confiabilidad',
          cliente_id: cliente.id,
          supervisor_id: null,
          estado: 'generando',
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta,
        })
        .select()
        .single()

      if (insertErr || !informe) throw insertErr ?? new Error('No se pudo crear el registro de informe')

      const generadoEn = new Date().toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const element: any = createElement(InformeConfiabilidad, {
        cliente,
        fechaDesde,
        fechaHasta,
        metricas,
        generadoEn,
        incluirDatosInternos: false,
      })
      const pdfBuffer = await renderToBuffer(element)

      const pdfPath = `confiabilidad/${informe.id}.pdf`
      await admin.storage
        .from('informes')
        .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

      await sendInformeConfiabilidad({
        cliente,
        fechaDesde,
        fechaHasta,
        pdfBuffer,
        filename: `confiabilidad-${cliente.nombre_empresa}-${fechaDesde}.pdf`,
      })

      await admin
        .from('informes')
        .update({
          estado: 'enviado',
          pdf_url: pdfPath,
          enviado_at: new Date().toISOString(),
          enviado_a: cliente.contacto_email,
        })
        .eq('id', informe.id)

      enviados++
    } catch (e) {
      errores++
      await admin.from('informes').insert({
        numero: `CONF-${cliente.id.slice(0, 8)}-${fechaDesde}-ERR-${Date.now()}`,
        tipo: 'confiabilidad',
        cliente_id: cliente.id,
        supervisor_id: null,
        estado: 'error',
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        error_mensaje: e instanceof Error ? e.message : 'Error desconocido',
      })
    }
  }

  return NextResponse.json({ ok: true, enviados, errores, omitidos, periodo: { fechaDesde, fechaHasta } })
}
