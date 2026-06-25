import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PlanillaExtintoresSubmitSchema } from '@/lib/validations/extintor'
import { checkDuplicatePlanilla } from '@/lib/utils/checkDuplicatePlanilla'
import { alertarSupervisores } from '@/lib/alertas/createAlerta'
import { notificarNovedad } from '@/lib/alertas/notificarNovedad'

export async function POST(req: NextRequest) {
  // Regla 6: autenticación y captura de user_agent
  const {
    data: { user },
    error: authErr,
  } = await supabaseServer().auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const userAgent = req.headers.get('user-agent') ?? ''

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // Validación Zod (incluye Regla 3 via superRefine)
  const parsed = PlanillaExtintoresSubmitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { cliente_id, fecha, turno, items, firma_dataurl, firma_aclaracion } = parsed.data
  const admin = supabaseAdmin()

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
  const isDuplicate = await checkDuplicatePlanilla(user.id, 'extintores', turnoActivo.id)
  if (isDuplicate) {
    return NextResponse.json(
      { error: 'Ya enviaste una planilla de extintores para este turno' },
      { status: 409 }
    )
  }

  // Subir firma a Storage
  const firmaPath = `${user.id}/${Date.now()}.png`
  const firmaBuffer = Buffer.from(firma_dataurl.replace(/^data:image\/png;base64,/, ''), 'base64')
  const { error: uploadErr } = await admin.storage
    .from('firmas')
    .upload(firmaPath, firmaBuffer, { contentType: 'image/png' })

  if (uploadErr) {
    return NextResponse.json({ error: 'Error al subir la firma' }, { status: 500 })
  }

  // Regla 6: INSERT planilla con inmutable=false, vinculada al turno activo
  const { data: planilla, error: planillaErr } = await admin
    .from('planillas')
    .insert({
      tipo: 'extintores',
      tecnico_id: user.id,
      cliente_id,
      turno_id: turnoActivo.id,
      fecha,
      turno,
      firma_url: firmaPath,
      firma_aclaracion,
      inmutable: false,
      user_agent: userAgent,
    })
    .select('id')
    .single()

  if (planillaErr || !planilla) {
    return NextResponse.json({ error: 'Error al crear la planilla' }, { status: 500 })
  }

  // Batch INSERT de los 113 ítems
  const extintores = items.map((item) => ({
    planilla_id: planilla.id,
    numero: item.numero,
    tipo: item.tipo,
    senalizacion: item.senalizacion,
    acceso: item.acceso,
    presion_peso: item.presion_peso,
    obs_senalizacion: item.obs_senalizacion ?? null,
    obs_acceso: item.obs_acceso ?? null,
    obs_presion_peso: item.obs_presion_peso ?? null,
    foto_url: item.foto_url ?? null,
  }))

  const { error: itemsErr } = await admin.from('planilla_extintores').insert(extintores)
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

  // Regla 4: alertar supervisores si algún ítem tiene un NO
  const hayNo = items.some(
    (item) => !item.senalizacion || !item.acceso || !item.presion_peso
  )
  if (hayNo) {
    await alertarSupervisores(
      'novedad_planilla',
      `Planilla de extintores con novedades — técnico ${user.id} — ${fecha} turno ${turno}`,
      planilla.id
    )
  }

  // Crear novedad automática en el libro de guardia
  const noItemsExt = hayNo ? ' (con observaciones)' : ''
  const descripcionNovedad = `Planilla de extintores enviada${noItemsExt} — ${turnoActivo.tecnico_nombre}, DNI ${turnoActivo.tecnico_dni}`
  const { data: novedad } = await admin.from('libro_novedad').insert({
    turno_id:    turnoActivo.id,
    tecnico_id:  user.id,
    planilla_id: planilla.id,
    tipo:        'novedad',
    hora:        new Date().toTimeString().slice(0, 5),
    descripcion: descripcionNovedad,
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
      mensaje:     `${autorNombre} envió planilla de extintores${noItemsExt}`,
      pushTitle:   '📋 Planilla de extintores enviada',
    })
  }

  return NextResponse.json({ id: planilla.id }, { status: 201 })
}
