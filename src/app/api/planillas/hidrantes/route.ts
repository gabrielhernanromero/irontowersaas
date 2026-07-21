import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PlanillaHidrantesSubmitSchema } from '@/lib/validations/planilla'
import { checkDuplicatePlanilla } from '@/lib/utils/checkDuplicatePlanilla'
import { validateItemsMatchCatalog } from '@/lib/utils/validatePlanillaItemsCatalog'
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

  // Si el supervisor activó el motor genérico para Hidrantes de este cliente
  // (después de que el técnico haya cargado este form), esta ruta ya no es
  // el camino correcto — evita crear una planilla "legacy" fuera de la
  // estructura configurable que el supervisor espera de acá en adelante.
  const { data: tipoConfig } = await admin
    .from('planilla_tipos')
    .select('usa_motor_generico')
    .eq('cliente_id', cliente_id)
    .eq('slug', 'hidrantes')
    .maybeSingle()
  if (tipoConfig?.usa_motor_generico) {
    return NextResponse.json(
      { error: 'La configuración de esta planilla cambió. Recargá la página e intentá de nuevo.' },
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

  // Los ítems enviados deben coincidir con el catálogo activo del cliente
  // (evita inconsistencias si el supervisor edita el catálogo a mitad de turno)
  const catalogCheck = await validateItemsMatchCatalog(
    cliente_id,
    'hidrantes',
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

  // Primera observación cargada — se muestra en la alerta y en el libro de
  // guardia para no tener que entrar a la planilla a ver el detalle.
  let primeraObs: string | null = null
  if (hayNo) {
    const CAMPOS = [
      { obs: 'obs_gabinete', label: 'Gabinete' },
      { obs: 'obs_manga',    label: 'Manga'    },
      { obs: 'obs_lanza',    label: 'Lanza'    },
      { obs: 'obs_valvula',  label: 'Válvula'  },
    ] as const
    for (const item of items) {
      for (const { obs, label } of CAMPOS) {
        const val = (item as Record<string, unknown>)[obs]
        if (typeof val === 'string' && val.trim()) { primeraObs = `${label}: ${val.trim()}`; break }
      }
      if (primeraObs) break
    }
  }

  if (hayNo) {
    await alertarSupervisores(
      'novedad_planilla',
      `Planilla de hidrantes con novedades — técnico ${user.id} — ${fecha} turno ${turno}` +
        (primeraObs ? `. ${primeraObs}` : ''),
      planilla.id
    )
  }

  // Crear novedad automática en el libro de guardia — el prefijo [FALLA]
  // hace que el timeline del dashboard la resalte en naranja (parsearCategoria
  // ya sabe leer ese tag) y que quede incluida en el filtro de "Alertas".
  const noItems = hayNo ? ' (con observaciones)' : ''
  const tagFalla = hayNo ? '[FALLA] ' : ''
  const descripcionNovedad = `${tagFalla}Planilla de hidrantes enviada${noItems} — ${turnoActivo.tecnico_nombre}, DNI ${turnoActivo.tecnico_dni}` +
    (primeraObs ? `. ${primeraObs}` : '')
  const { data: novedad } = await admin.from('libro_novedad').insert({
    turno_id:   turnoActivo.id,
    tecnico_id: user.id,
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
      mensaje:     `${autorNombre} envió planilla de hidrantes${noItems}`,
      pushTitle:   '📋 Planilla de hidrantes enviada',
    })
  }

  return NextResponse.json({ id: planilla.id }, { status: 201 })
}
