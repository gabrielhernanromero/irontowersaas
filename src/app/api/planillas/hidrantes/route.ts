import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PlanillaHidrantesSubmitSchema } from '@/lib/validations/planilla'
import { checkDuplicatePlanilla } from '@/lib/utils/checkDuplicatePlanilla'
import { alertarSupervisores } from '@/lib/alertas/createAlerta'

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

  // Validación Zod (incluye Regla 3 via superRefine)
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = PlanillaHidrantesSubmitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { cliente_id, fecha, turno, items, firma_dataurl, firma_aclaracion } = parsed.data
  const admin = supabaseAdmin()

  // Opción A: requiere turno activo para enviar planillas
  const { data: turnoActivo } = await admin
    .from('libro_turno')
    .select('id, tecnico_nombre, tecnico_dni')
    .eq('tecnico_id', user.id)
    .eq('estado', 'abierto')
    .maybeSingle()

  if (!turnoActivo) {
    return NextResponse.json(
      { error: 'Debés abrir tu turno en el Libro de Guardia antes de enviar una planilla' },
      { status: 409 }
    )
  }

  // Regla 1: duplicado por técnico + tipo + turno
  const isDuplicate = await checkDuplicatePlanilla(user.id, 'hidrantes', turnoActivo.id)
  if (isDuplicate) {
    return NextResponse.json(
      { error: 'Ya enviaste una planilla de hidrantes para este turno' },
      { status: 409 }
    )
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
      tipo: 'hidrantes',
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

  // Batch INSERT de los 48 ítems
  const hidrantes = items.map((item) => ({
    planilla_id: planilla.id,
    numero: item.numero,
    gabinete: item.gabinete,
    manga: item.manga,
    lanza: item.lanza,
    valvula: item.valvula,
    obs_gabinete: item.obs_gabinete ?? null,
    obs_manga: item.obs_manga ?? null,
    obs_lanza: item.obs_lanza ?? null,
    obs_valvula: item.obs_valvula ?? null,
    foto_url: item.foto_url ?? null,
  }))

  const { error: itemsErr } = await admin.from('planilla_hidrantes').insert(hidrantes)
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
    (item) => !item.gabinete || !item.manga || !item.lanza || !item.valvula
  )
  if (hayNo) {
    await alertarSupervisores(
      'novedad_planilla',
      `Planilla de hidrantes con novedades — técnico ${user.id} — ${fecha} turno ${turno}`,
      planilla.id
    )
  }

  // Crear novedad automática en el libro de guardia
  const noItems = hayNo ? ' (con observaciones)' : ''
  await admin.from('libro_novedad').insert({
    turno_id: turnoActivo.id,
    planilla_id: planilla.id,
    tipo: 'novedad',
    hora: new Date().toTimeString().slice(0, 5),
    descripcion: `Planilla de hidrantes enviada${noItems} — ${turnoActivo.tecnico_nombre}, DNI ${turnoActivo.tecnico_dni}`,
  })

  return NextResponse.json({ id: planilla.id }, { status: 201 })
}
