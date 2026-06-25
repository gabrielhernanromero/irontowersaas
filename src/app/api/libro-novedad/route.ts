import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NuevaNovedadSchema } from '@/lib/validations/libroTurno'
import { checkRateLimit, LIMITS } from '@/lib/rateLimit'
import { notificarNovedad } from '@/lib/alertas/notificarNovedad'
import { sendPushToUser } from '@/lib/push/sendPush'

export async function POST(req: NextRequest) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const rl = checkRateLimit(`novedad:${user.id}`, LIMITS.novedad)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Esperá un momento.' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
    })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = NuevaNovedadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 422 })
  }

  const {
    turno_id, hora, descripcion, riesgo_detectado, medidas_adoptadas,
    observaciones_generales, foto_url,
    es_alerta,
    es_incidencia, incidencia_titulo, incidencia_severidad,
  } = parsed.data

  const { data: turno } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, estado, tecnico_id, cliente_id')
    .eq('id', turno_id)
    .single()

  if (!turno) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  if (turno.estado !== 'abierto') return NextResponse.json({ error: 'El turno está cerrado' }, { status: 409 })

  let rolDelUser: 'encargado' | 'apoyo' = 'encargado'

  if (turno.tecnico_id !== user.id) {
    // Verificar si el usuario participa como apoyo en este turno
    const { data: participacion } = await supabaseAdmin()
      .from('participaciones_turno')
      .select('id, rol_turno')
      .eq('turno_id', turno_id)
      .eq('usuario_id', user.id)
      .maybeSingle()

    if (!participacion) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    rolDelUser = (participacion.rol_turno as 'encargado' | 'apoyo') ?? 'apoyo'
  }

  // Si es incidencia: crear primero para obtener el ID y enlazarlo a la novedad
  let incidenciaId: string | null = null
  if (es_incidencia && incidencia_titulo?.trim()) {
    const { data: inc, error: incErr } = await supabaseAdmin()
      .from('incidencias')
      .insert({
        cliente_id:           turno.cliente_id ?? null,
        turno_creacion_id:    turno_id,
        titulo:               incidencia_titulo.trim(),
        descripcion,
        severidad:            incidencia_severidad ?? 'medio',
        estado:               'abierto',
        foto_url:             foto_url || null,
        tecnico_detector_id:  user.id,
      })
      .select('id')
      .single()

    if (!incErr && inc) incidenciaId = inc.id

    // Cuando el apoyo registra una incidencia, push de alerta al encargado del turno
    if (rolDelUser === 'apoyo' && incidenciaId) {
      sendPushToUser(turno.tecnico_id, {
        title: '📋 Nueva incidencia del apoyo',
        body:  `${incidencia_titulo.trim()} — ${descripcion.slice(0, 80)}`,
        url:   '/tecnico/libro-guardia',
      }).catch(() => {})
    }
  }

  const tipoNovedad = es_alerta ? 'alerta' : 'novedad'

  const { data: novedad, error } = await supabaseAdmin()
    .from('libro_novedad')
    .insert({
      turno_id,
      tecnico_id: user.id,
      tipo:                    tipoNovedad,
      hora,
      descripcion,
      riesgo_detectado:        riesgo_detectado || null,
      medidas_adoptadas:       medidas_adoptadas || null,
      observaciones_generales: observaciones_generales || null,
      foto_url:                foto_url || null,
      incidencia_id:           incidenciaId,
    })
    .select('*, incidencias(id, titulo, severidad, estado)')
    .single()

  if (error) return NextResponse.json({ error: 'Error al registrar la novedad' }, { status: 500 })

  const { data: autorUser } = await supabaseAdmin()
    .from('users').select('nombre, apellido').eq('id', user.id).single()
  const autorNombre = autorUser ? `${autorUser.nombre} ${autorUser.apellido}` : 'Técnico'
  const pushTitle = tipoNovedad === 'alerta'
    ? (rolDelUser === 'apoyo' ? '⚠ Alerta del apoyo' : '⚠ Alerta del encargado')
    : (rolDelUser === 'apoyo' ? '📝 Nueva novedad del apoyo' : '📝 Nueva novedad del encargado')

  await notificarNovedad({
    autorId:     user.id,
    encargadoId: turno.tecnico_id,
    turnoId:     turno_id,
    novedadId:   novedad!.id,
    mensaje:     `${autorNombre}: ${descripcion.slice(0, 100)}`,
    pushTitle,
  })

  return NextResponse.json(novedad, { status: 201 })
}
