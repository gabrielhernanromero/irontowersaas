import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { getArgTime, deriveTurno } from '@/lib/cobertura/timeUtils'

const JoinSchema = z.object({
  esquema_id: z.string().uuid(),
  tarde: z.boolean().optional(), // true = encargado que llega tarde y se une como apoyo
})

export async function POST(req: NextRequest) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = JoinSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'esquema_id requerido (UUID)' }, { status: 422 })
  }

  const { esquema_id, tarde } = parsed.data
  const { hoy, ayer } = getArgTime()

  // 1. Obtener el esquema
  const { data: esquema } = await supabaseAdmin()
    .from('esquemas_cobertura')
    .select('id, cliente_id, hora_inicio')
    .eq('id', esquema_id)
    .single()

  if (!esquema) return NextResponse.json({ error: 'Esquema no encontrado' }, { status: 404 })

  const derivedTurno = deriveTurno(esquema.hora_inicio)

  // 2. Verificar asignación del usuario según el modo (apoyo normal vs encargado tardío)
  const rolEsperado = tarde ? 'encargado' : 'apoyo'

  let tieneAsignacion = false
  const { data: excepcion } = await supabaseAdmin()
    .from('asignaciones_turno')
    .select('id')
    .eq('esquema_id', esquema_id)
    .eq('usuario_id', user.id)
    .eq('rol_turno', rolEsperado)
    .in('fecha', [hoy, ayer])
    .limit(1)
    .maybeSingle()

  if (excepcion) {
    tieneAsignacion = true
  } else {
    const { data: persistente } = await supabaseAdmin()
      .from('asignaciones_persistentes')
      .select('id')
      .eq('esquema_id', esquema_id)
      .eq('usuario_id', user.id)
      .eq('rol_turno', rolEsperado)
      .maybeSingle()
    if (persistente) tieneAsignacion = true
  }

  if (!tieneAsignacion) {
    const msg = tarde
      ? 'No tenés asignación como encargado para este esquema.'
      : 'No tenés asignación como apoyo para este esquema.'
    return NextResponse.json({ error: msg }, { status: 403 })
  }

  // 3. Buscar el turno activo
  //    - Si es encargado tardío: buscar el turno del interino (interino=true)
  //    - Si es apoyo normal: cualquier turno abierto del esquema
  const turnoQuery = supabaseAdmin()
    .from('libro_turno')
    .select('id, estado, tecnico_id, tecnico_nombre, interino')
    .eq('cliente_id', esquema.cliente_id)
    .eq('estado', 'abierto')
    .or(`esquema_id.eq.${esquema_id},and(esquema_id.is.null,turno.eq.${derivedTurno})`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: turnoActivo } = await turnoQuery

  if (!turnoActivo) {
    const msg = tarde
      ? 'No hay un turno interino activo para unirte. Si el encargado aún no abrió, podés iniciar vos como encargado normal.'
      : 'El encargado aún no abrió el turno. Esperá a que inicie la guardia.'
    return NextResponse.json({ error: msg }, { status: 404 })
  }

  if (tarde && !turnoActivo.interino) {
    return NextResponse.json(
      { error: 'El turno activo no fue abierto por un interino. Contactá a supervisión.' },
      { status: 409 }
    )
  }

  // 4. Verificar que no esté ya participando
  const { data: yaParticipa } = await supabaseAdmin()
    .from('participaciones_turno')
    .select('id')
    .eq('turno_id', turnoActivo.id)
    .eq('usuario_id', user.id)
    .maybeSingle()

  if (yaParticipa) {
    return NextResponse.json({ turno: turnoActivo, ya_unido: true })
  }

  // 5. Unirse al turno como apoyo (en ambos casos el rol efectivo es apoyo)
  const { data: participacion, error: joinErr } = await supabaseAdmin()
    .from('participaciones_turno')
    .insert({ turno_id: turnoActivo.id, usuario_id: user.id, rol_turno: 'apoyo' })
    .select()
    .single()

  if (joinErr) return NextResponse.json({ error: 'Error al unirse al turno' }, { status: 500 })

  // 6. Registrar novedad
  const { data: userProfile } = await supabaseAdmin()
    .from('users')
    .select('nombre, apellido, dni')
    .eq('id', user.id)
    .single()

  const nombre = userProfile ? `${userProfile.nombre} ${userProfile.apellido}` : 'Técnico'
  const hora   = new Date().toTimeString().slice(0, 5)

  const descripcionNovedad = tarde
    ? `Llegada tardía del encargado: ${nombre} (DNI ${userProfile?.dni ?? '-'}) llegó a las ${hora}. Se incorpora como apoyo al turno ya iniciado por el interino.`
    : `Incorporación de apoyo: ${nombre} (DNI ${userProfile?.dni ?? '-'})`

  await supabaseAdmin()
    .from('libro_novedad')
    .insert({
      turno_id:    turnoActivo.id,
      tecnico_id:  user.id,
      tipo:        'novedad',
      hora,
      descripcion: descripcionNovedad,
    })

  return NextResponse.json({ turno: turnoActivo, participacion }, { status: 201 })
}
