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
      id, folio_numero, fecha, turno, tecnico_id, tecnico_nombre, tecnico_dni,
      horario_inicio, horario_fin, estado, cliente_id, created_at,
      apertura_latitud, apertura_longitud, apertura_precision_m, apertura_gps_capturado_at,
      cierre_latitud, cierre_longitud, cierre_precision_m, cierre_gps_capturado_at,
      relevo_latitud, relevo_longitud, relevo_precision_m, relevo_gps_capturado_at,
      relevo_nombre, relevo_dni,
      clientes(id, nombre_empresa, latitud, longitud),
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

  // Orden cronológico real (created_at), más nuevo primero — ordenar por el
  // string "hora" rompía en turnos nocturnos que cruzan medianoche.
  if (data.novedades) {
    (data.novedades as { created_at: string }[]).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }

  const [
    { data: incidencias },
    { data: controlTurno },
    { data: catalogoElementos },
    { data: participantes },
    { data: encargadoUser },
    { data: clienteData },
    { data: tiposGenericos },
    { data: planillasEnviadas },
  ] = await Promise.all([
    // Incidencias detectadas en este turno, más las que siguen abiertas de
    // turnos anteriores del mismo cliente (persisten hasta resolverse).
    data.cliente_id
      ? supabaseAdmin()
          .from('incidencias')
          .select('id, titulo, descripcion, severidad, estado, foto_url, turno_creacion_id, created_at')
          .eq('cliente_id', data.cliente_id)
          .or(`turno_creacion_id.eq.${params.id},estado.in.(abierto,en_seguimiento)`)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),

    // Auditoría de inventario hecha específicamente en este turno
    supabaseAdmin()
      .from('control_inventario_turno')
      .select('id, elemento_id, estado_operativo, observacion')
      .eq('turno_id', params.id),

    // Catálogo completo de elementos asignados al puesto (no solo lo auditado en este turno)
    data.cliente_id
      ? supabaseAdmin()
          .from('elementos_puesto')
          .select('id, nombre, codigo_patrimonial, categoria, estado_admin')
          .eq('cliente_id', data.cliente_id)
          .neq('estado_admin', 'inactivo')
          .order('nombre')
      : Promise.resolve({ data: [] }),

    // Personal de apoyo cubriendo el puesto en este turno (unido vía /api/libro-turno/join)
    supabaseAdmin()
      .from('participaciones_turno')
      .select('id, usuario_id, joined_at, users(nombre, apellido, dni, telefono)')
      .eq('turno_id', params.id),

    // Teléfono del encargado (dueño del turno, no viene en participaciones_turno)
    supabaseAdmin()
      .from('users')
      .select('telefono')
      .eq('id', data.tecnico_id)
      .maybeSingle(),

    // Planillas habilitadas para el cliente (para armar el checklist del turno)
    data.cliente_id
      ? supabaseAdmin()
          .from('clientes')
          .select('planillas_habilitadas')
          .eq('id', data.cliente_id)
          .single()
      : Promise.resolve({ data: null }),

    // Tipos de planilla genéricos configurados para el cliente
    data.cliente_id
      ? supabaseAdmin()
          .from('planilla_tipos')
          .select('id, nombre, slug')
          .eq('cliente_id', data.cliente_id)
          .eq('es_legacy', false)
          .eq('activo', true)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),

    // Planillas ya enviadas (inmutables) en este turno puntual
    supabaseAdmin()
      .from('planillas')
      .select('id, tipo')
      .eq('turno_id', params.id)
      .eq('inmutable', true),
  ])

  // Merge: catálogo completo del puesto + estado de auditoría de este turno
  const controlPorElemento = new Map(
    (controlTurno ?? []).map(c => [c.elemento_id, c])
  )
  const elementos = (catalogoElementos ?? []).map(el => {
    const control = controlPorElemento.get(el.id)
    return {
      id: el.id,
      nombre: el.nombre,
      codigo_patrimonial: el.codigo_patrimonial,
      categoria: el.categoria,
      estado_admin: el.estado_admin,
      auditado: !!control,
      estado_operativo: control?.estado_operativo ?? null,
      observacion: control?.observacion ?? null,
    }
  })

  // Checklist de planillas correspondientes al puesto en este turno
  const planillasHabilitadas: string[] = clienteData?.planillas_habilitadas ?? ['hidrantes', 'extintores']
  const enviadaPorTipo = new Map((planillasEnviadas ?? []).map(p => [p.tipo, p.id]))

  const planillasChecklist = [
    ...(planillasHabilitadas.includes('hidrantes')
      ? [{ nombre: 'Hidrantes', slug: 'hidrantes' }] : []),
    ...(planillasHabilitadas.includes('extintores')
      ? [{ nombre: 'Extintores', slug: 'extintores' }] : []),
    ...(tiposGenericos ?? []).map(t => ({ nombre: t.nombre, slug: t.slug })),
  ].map(t => ({
    nombre: t.nombre,
    slug: t.slug,
    enviada: enviadaPorTipo.has(t.slug),
    planillaId: enviadaPorTipo.get(t.slug) ?? null,
  }))

  return NextResponse.json({
    turno: {
      ...data,
      incidencias: incidencias ?? [],
      elementos,
      participantes: participantes ?? [],
      encargado_telefono: encargadoUser?.telefono ?? null,
      planillasChecklist,
    },
  })
}
