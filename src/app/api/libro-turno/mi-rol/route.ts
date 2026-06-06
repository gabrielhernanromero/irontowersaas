import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getArgTime, isWithinWindow, deriveTurno } from '@/lib/cobertura/timeUtils'

/**
 * GET /api/libro-turno/mi-rol?cliente_id=X
 *
 * Determina el estado del técnico autenticado para el turno activo del cliente.
 * Lógica de fallback:
 *   1. Busca esquemas activos donde el tiempo actual esté dentro de la ventana
 *   2. Para cada esquema: excepción diaria (asignaciones_turno) → permanente (asignaciones_persistentes)
 *   3. Según el rol encontrado, verifica estado del libro_turno activo
 *
 * Respuestas posibles:
 *   { rol: 'encargado', turno, esquema }
 *   { rol: 'apoyo', turno, esquema }
 *   { rol: 'apoyo_pendiente', esquema }
 *   { rol: 'encargado_sin_turno', esquema }
 *   { rol: 'encargado_bloqueado', motivo, turno_activo_id }
 *   { rol: null }
 */
export async function GET(req: NextRequest) {
  const { data: { user }, error: authErr } = await supabaseServer().auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const clienteId = req.nextUrl.searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

  const { hours, minutes, hoy, ayer } = getArgTime()

  // ── 1. Esquemas activos para este cliente ─────────────────────────────────
  const { data: esquemas } = await supabaseAdmin()
    .from('esquemas_cobertura')
    .select('id, nombre, hora_inicio, hora_fin')
    .eq('cliente_id', clienteId)
    .eq('activo', true)

  if (!esquemas || esquemas.length === 0) return NextResponse.json({ rol: null })

  // Filtrar los que tienen ventana abierta ahora
  const esquemaActivo = esquemas.find(e =>
    isWithinWindow(e.hora_inicio, e.hora_fin, hours, minutes)
  )

  if (!esquemaActivo) return NextResponse.json({ rol: null, motivo: 'Fuera del horario de apertura' })

  const esquema = esquemaActivo

  // ── 2. ¿Encargado con turno propio abierto? ───────────────────────────────
  const { data: turnoEncargado } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, estado, folio_numero, fecha, horario_inicio, tecnico_nombre, esquema_id')
    .eq('cliente_id', clienteId)
    .eq('tecnico_id', user.id)
    .eq('estado', 'abierto')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (turnoEncargado) {
    return NextResponse.json({ rol: 'encargado', turno: turnoEncargado, esquema })
  }

  // ── 3. ¿Ya unido como apoyo? ───────────────────────────────────────────────
  const { data: participacion } = await supabaseAdmin()
    .from('participaciones_turno')
    .select(`
      id,
      turno:turno_id (
        id, estado, folio_numero, fecha, horario_inicio, tecnico_nombre, esquema_id
      )
    `)
    .eq('usuario_id', user.id)
    .maybeSingle()

  // Supabase devuelve el join como objeto, el tipo inferido puede ser array — cast explícito
  type TurnoRow = { id: string; estado: string; folio_numero: number; fecha: string; horario_inicio: string; tecnico_nombre: string; esquema_id: string | null }
  const rawTurno = participacion?.turno as unknown as TurnoRow | null
  const turnoApoyo = rawTurno?.estado === 'abierto' ? rawTurno : null

  if (turnoApoyo) {
    return NextResponse.json({ rol: 'apoyo', turno: turnoApoyo, esquema })
  }

  // ── 4. Fallback: excepción del día → asignación persistente ───────────────
  let rolTurno: 'encargado' | 'apoyo' | null = null

  // 4a. Excepción diaria (check hoy y ayer para turnos nocturnos)
  const { data: excepcion } = await supabaseAdmin()
    .from('asignaciones_turno')
    .select('id, rol_turno, fecha')
    .eq('esquema_id', esquema.id)
    .eq('usuario_id', user.id)
    .in('fecha', [hoy, ayer])
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (excepcion) {
    rolTurno = excepcion.rol_turno as 'encargado' | 'apoyo'
  } else {
    // 4b. Asignación persistente
    const { data: persistente } = await supabaseAdmin()
      .from('asignaciones_persistentes')
      .select('id, rol_turno')
      .eq('esquema_id', esquema.id)
      .eq('usuario_id', user.id)
      .maybeSingle()
    if (persistente) rolTurno = persistente.rol_turno as 'encargado' | 'apoyo'
  }

  if (!rolTurno) return NextResponse.json({ rol: null })

  // ── 5. Evaluar estado según rol ───────────────────────────────────────────
  if (rolTurno === 'apoyo') {
    // ¿El encargado ya abrió el turno?
    const derivedTurno = deriveTurno(esquema.hora_inicio)
    const { data: turnoActivo } = await supabaseAdmin()
      .from('libro_turno')
      .select('id, estado, folio_numero, tecnico_nombre, esquema_id')
      .eq('cliente_id', clienteId)
      .eq('estado', 'abierto')
      .or(`esquema_id.eq.${esquema.id},and(esquema_id.is.null,turno.eq.${derivedTurno})`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (turnoActivo) {
      return NextResponse.json({ rol: 'apoyo_pendiente', esquema, turno_id: turnoActivo.id })
    }
    return NextResponse.json({ rol: 'apoyo_pendiente', esquema })
  }

  // rolTurno === 'encargado'
  // ¿Hay otro turno activo que bloquee la apertura?
  const derivedTurno = deriveTurno(esquema.hora_inicio)
  const { data: turnoBlockeante } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, estado, tecnico_nombre, folio_numero, esquema_id')
    .eq('cliente_id', clienteId)
    .in('estado', ['abierto', 'pendiente_relevo'])
    .or(`esquema_id.eq.${esquema.id},and(esquema_id.is.null,turno.eq.${derivedTurno})`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (turnoBlockeante) {
    return NextResponse.json({
      rol:    'encargado_bloqueado',
      motivo: `El turno de ${turnoBlockeante.tecnico_nombre} (folio ${turnoBlockeante.folio_numero}) aún no fue cerrado.`,
      turno_activo_id: turnoBlockeante.id,
      esquema,
    })
  }

  return NextResponse.json({ rol: 'encargado_sin_turno', esquema })
}
