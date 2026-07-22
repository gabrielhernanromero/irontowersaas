import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildPlanillaGenericaSchema, itemTieneNovedad } from '@/lib/validations/planillaGenerica'
import { checkDuplicatePlanilla } from '@/lib/utils/checkDuplicatePlanilla'
import { validateItemsMatchCatalog } from '@/lib/utils/validatePlanillaItemsCatalog'
import { alertarSupervisores } from '@/lib/alertas/createAlerta'
import { notificarNovedad } from '@/lib/alertas/notificarNovedad'

export async function POST(
  req: NextRequest,
  { params }: { params: { tipoId: string } }
) {
  // Regla 6: autenticación y captura de user_agent
  const {
    data: { user },
    error: authErr,
  } = await supabaseServer().auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const userAgent = req.headers.get('user-agent') ?? ''
  const admin = supabaseAdmin()

  const { data: tipo } = await admin
    .from('planilla_tipos')
    .select('id, cliente_id, nombre, slug, activo, es_legacy, usa_motor_generico')
    .eq('id', params.tipoId)
    .maybeSingle()

  if (!tipo || !tipo.activo) {
    return NextResponse.json({ error: 'Tipo de planilla no encontrado' }, { status: 404 })
  }
  // Legacy (Hidrantes/Extintores) solo puede pasar por acá si el supervisor
  // activó explícitamente el motor genérico para este cliente+tipo
  if (tipo.es_legacy && !tipo.usa_motor_generico) {
    return NextResponse.json({ error: 'Este tipo se envía por su propia ruta' }, { status: 400 })
  }

  const { data: campos } = await admin
    .from('planilla_tipo_campos')
    .select('clave, etiqueta, tipo_campo, opciones, valor_min, valor_max')
    .eq('planilla_tipo_id', tipo.id)
    .order('orden', { ascending: true })

  if (!campos || campos.length === 0) {
    return NextResponse.json(
      { error: 'Este tipo de planilla no tiene campos de chequeo configurados' },
      { status: 409 }
    )
  }

  // Validación Zod (incluye Regla 3 via superRefine, campos dinámicos)
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const schema = buildPlanillaGenericaSchema(campos)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { cliente_id, fecha, turno, items, firma_dataurl, firma_aclaracion } = parsed.data

  // Turno propio abierto
  let turnoActivo = (await admin
    .from('libro_turno')
    .select('id, tecnico_id, tecnico_nombre, tecnico_dni, cliente_id')
    .eq('tecnico_id', user.id)
    .eq('estado', 'abierto')
    .maybeSingle()).data

  // Si el apoyo no tiene turno propio, busca el turno del encargado en el mismo cliente
  if (!turnoActivo) {
    const { data: perfil } = await admin.from('users').select('cliente_id').eq('id', user.id).single()
    if (perfil?.cliente_id) {
      turnoActivo = (await admin
        .from('libro_turno')
        .select('id, tecnico_id, tecnico_nombre, tecnico_dni, cliente_id')
        .eq('cliente_id', perfil.cliente_id)
        .eq('estado', 'abierto')
        .neq('tecnico_id', user.id)
        .maybeSingle()).data
    }
  }

  if (!turnoActivo) {
    return NextResponse.json(
      { error: 'Debés abrir tu turno en el Libro de Guardia antes de enviar una planilla' },
      { status: 409 }
    )
  }

  // Regla 1: duplicado por técnico + tipo + turno
  const isDuplicate = await checkDuplicatePlanilla(user.id, tipo.slug, turnoActivo.id)
  if (isDuplicate) {
    return NextResponse.json(
      { error: `Ya enviaste una planilla de ${tipo.nombre} para este turno` },
      { status: 409 }
    )
  }

  // Los ítems enviados deben coincidir con el catálogo activo del cliente
  const catalogCheck = await validateItemsMatchCatalog(
    cliente_id,
    tipo.slug,
    items.map((i) => i.numero)
  )
  if (!catalogCheck.ok) {
    return NextResponse.json({ error: catalogCheck.error }, { status: 409 })
  }

  // Subir firma a Storage: firmas/{userId}/{timestamp}.png
  const firmaPath = `${user.id}/${Date.now()}.png`
  const firmaBuffer = Buffer.from(firma_dataurl.replace(/^data:image\/png;base64,/, ''), 'base64')
  const { error: uploadErr } = await admin.storage
    .from('firmas')
    .upload(firmaPath, firmaBuffer, { contentType: 'image/png' })

  if (uploadErr) {
    return NextResponse.json({ error: 'Error al subir la firma' }, { status: 500 })
  }

  // Regla 6: INSERT planilla con inmutable=false inicialmente, vinculada al turno activo
  const { data: planilla, error: planillaErr } = await admin
    .from('planillas')
    .insert({
      tipo: tipo.slug,
      tecnico_id: user.id,
      cliente_id,
      turno_id: turnoActivo.id,
      fecha,
      turno,
      firma_url: firmaPath,
      firma_aclaracion,
      inmutable: false,
      user_agent: userAgent,
      snapshot_config: { tipo_nombre: tipo.nombre, campos },
    })
    .select('id')
    .single()

  if (planillaErr || !planilla) {
    return NextResponse.json({ error: 'Error al crear la planilla' }, { status: 500 })
  }

  // Batch INSERT de los ítems (respuestas/observaciones son jsonb, keyed por campo.clave)
  const respuestas = items.map((item) => ({
    planilla_id: planilla.id,
    numero: item.numero,
    respuestas: item.respuestas,
    observaciones: item.observaciones,
    foto_url: item.foto_url ?? null,
  }))

  const { error: itemsErr } = await admin.from('planilla_item_respuestas').insert(respuestas)
  if (itemsErr) {
    return NextResponse.json({ error: 'Error al guardar los ítems' }, { status: 500 })
  }

  // Regla 2: marcar inmutable DESPUÉS de insertar todos los ítems
  const { error: immutableErr } = await admin
    .from('planillas')
    .update({ inmutable: true, enviada_at: new Date().toISOString() })
    .eq('id', planilla.id)

  if (immutableErr) {
    return NextResponse.json({ error: 'Error al cerrar la planilla' }, { status: 500 })
  }

  // Regla 4: alertar supervisores si algún campo de algún ítem tiene un NO
  // (check en false, o numérico fuera del rango configurado)
  const hayNo = items.some((item) => itemTieneNovedad(item, campos))

  // Primera observación cargada — se muestra en la alerta y en el libro de
  // guardia para que el detalle del problema se vea sin entrar a la planilla
  let primeraObs: string | null = null
  if (hayNo) {
    for (const item of items) {
      for (const campo of campos) {
        const obs = item.observaciones[campo.clave]
        if (obs?.trim()) { primeraObs = `${campo.etiqueta}: ${obs.trim()}`; break }
      }
      if (primeraObs) break
    }
  }

  if (hayNo) {
    await alertarSupervisores(
      'novedad_planilla',
      `Planilla de ${tipo.nombre} con novedades — técnico ${user.id} — ${fecha} turno ${turno}` +
        (primeraObs ? `. ${primeraObs}` : ''),
      planilla.id
    )
  }

  // Crear novedad automática en el libro de guardia — el prefijo [FALLA]
  // hace que el timeline del dashboard la resalte en naranja (parsearCategoria
  // ya sabe leer ese tag) y que quede incluida en el filtro de "Alertas".
  const noItems = hayNo ? ' (con observaciones)' : ''
  const tagFalla = hayNo ? '[FALLA] ' : ''
  const descripcionNovedad = `${tagFalla}Planilla de ${tipo.nombre} enviada${noItems} — ${turnoActivo.tecnico_nombre}, DNI ${turnoActivo.tecnico_dni}` +
    (primeraObs ? `. ${primeraObs}` : '')
  // Primera foto cargada en algún ítem — así el ícono de cámara del timeline
  // y el detalle de la novedad ya la muestran, sin tener que entrar a la planilla.
  const primeraFoto = items.find((item) => item.foto_url)?.foto_url ?? null
  const { data: novedad } = await admin.from('libro_novedad').insert({
    turno_id:   turnoActivo.id,
    tecnico_id: user.id,
    planilla_id: planilla.id,
    tipo:        'novedad',
    hora:        new Date().toTimeString().slice(0, 5),
    descripcion: descripcionNovedad,
    foto_url:    primeraFoto,
  }).select('id').single()

  // Notificar al otro rol (apoyo → encargado o encargado → apoyo)
  if (novedad) {
    const { data: autorUser } = await admin.from('users').select('nombre, apellido').eq('id', user.id).single()
    const autorNombre = autorUser ? `${autorUser.nombre} ${autorUser.apellido}` : 'Técnico'
    await notificarNovedad({
      autorId:     user.id,
      encargadoId: turnoActivo.tecnico_id,
      turnoId:     turnoActivo.id,
      novedadId:   novedad.id,
      mensaje:     `${autorNombre} envió planilla de ${tipo.nombre}${noItems}`,
      pushTitle:   `📋 Planilla de ${tipo.nombre} enviada`,
    })
  }

  return NextResponse.json({ id: planilla.id }, { status: 201 })
}
