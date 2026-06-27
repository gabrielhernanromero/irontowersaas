export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Link from 'next/link'
import {
  Plus, BookOpen, CheckCircle2, Clock,
  Lock, ChevronRight, UserCheck, CircleDot, AlertTriangle,
  ShieldAlert, Users, ShieldCheck,
} from 'lucide-react'
import { getArgTime, deriveTurno } from '@/lib/cobertura/timeUtils'
import { findEsquemaActivo } from '@/lib/esquemas/validarVentana'
import type { Incidencia, LibroTurno, LibroNovedad } from '@/types/database'
import NovedadesTimeline from './NovedadesTimeline'
import IncidenciasActivas from '@/components/libro/IncidenciasActivas'
import JoinTurnoButton from './JoinTurnoButton'
import IncidenciasPendientesAprobacion from '@/components/libro/IncidenciasPendientesAprobacion'
import AlertasPendientesAcuse from '@/components/libro/AlertasPendientesAcuse'
import GuardiaAlertsReader from './GuardiaAlertsReader'

function formatHora(h: string | null) {
  return h ? h.slice(0, 5) : '—'
}
function formatFecha(f: string | null) {
  if (!f) return '—'
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

interface Props {
  searchParams: { ok?: string }
}

export default async function LibroGuardiaHubPage({ searchParams }: Props) {
  const user = await requireRole('tecnico', 'admin')

  const { hoy, ayer } = getArgTime()

  // ── 0. Perfil del usuario (para obtener cliente_id) ──────────────────────────
  const { data: userProfile } = await supabaseAdmin()
    .from('users')
    .select('cliente_id')
    .eq('id', user.id)
    .single()
  const clienteId = userProfile?.cliente_id ?? null

  // ── 1. ¿Tiene turno propio abierto (encargado)? ───────────────────────────────
  const { data: turnoEncargado } = await supabaseAdmin()
    .from('libro_turno')
    .select('*')
    .eq('tecnico_id', user.id)
    .eq('estado', 'abierto')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── 2. ¿Está participando como apoyo en un turno activo o cerrado de hoy? ─────
  // Traemos todas las participaciones y elegimos la más relevante en código
  // para evitar que registros viejos de pruebas pasadas envenenan el estado.
  const { data: participacionesRaw } = await supabaseAdmin()
    .from('participaciones_turno')
    .select(`
      id,
      libro_turno!turno_id (
        id, folio_numero, fecha, turno, estado,
        horario_inicio, tecnico_nombre, tecnico_dni, cliente_id, esquema_id
      )
    `)
    .eq('usuario_id', user.id)

  type ParticipacionRaw = {
    id: string
    libro_turno: { id: string; folio_numero: number; fecha: string; turno: string; estado: string; horario_inicio: string | null; tecnico_nombre: string; tecnico_dni: string; cliente_id: string | null; esquema_id: string | null } | null
  }
  const participaciones = (participacionesRaw ?? []) as unknown as ParticipacionRaw[]

  // Prioridad: turno abierto > turno cerrado hoy
  const participacion =
    participaciones.find(p => p.libro_turno?.estado === 'abierto') ??
    participaciones.find(p =>
      ['cerrado', 'pendiente_relevo'].includes(p.libro_turno?.estado ?? '') &&
      p.libro_turno?.fecha === hoy
    ) ??
    null

  const turnoApoyo = participacion?.libro_turno?.estado === 'abierto'
    ? (participacion.libro_turno as unknown as LibroTurno)
    : null

  const turnoApoyoCerradoHoy: { id: string; estado: string } | null =
    participacion?.libro_turno &&
    ['cerrado', 'pendiente_relevo'].includes(participacion.libro_turno.estado) &&
    participacion.libro_turno.fecha === hoy
      ? { id: participacion.libro_turno.id, estado: participacion.libro_turno.estado }
      : null

  // ── 3. ¿Tiene asignación para hoy? Fallback: excepción → persistente ──────────
  let asignacionHoy: { rol_turno: 'encargado' | 'apoyo'; cliente_id: string | null; esquema_id: string | null; esquema_nombre: string | null } | null = null

  if (clienteId) {
    // Buscar esquemas activos con ventana abierta ahora
    const { data: esquemas } = await supabaseAdmin()
      .from('esquemas_cobertura')
      .select('id, nombre, hora_inicio, hora_fin, cliente_id, dias_semana, fecha_desde, fecha_hasta')
      .eq('cliente_id', clienteId)
      .eq('activo', true)

    // Iterar todos los esquemas en ventana hasta encontrar uno asignado al usuario.
    // Evita el problema de tomar el primer match sin verificar asignación primero.
    for (const esq of (esquemas ?? [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!findEsquemaActivo([esq as any])) continue

      const { data: excepcion } = await supabaseAdmin()
        .from('asignaciones_turno')
        .select('rol_turno')
        .eq('esquema_id', esq.id)
        .eq('usuario_id', user.id)
        .in('fecha', [hoy, ayer])
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (excepcion) {
        asignacionHoy = { rol_turno: excepcion.rol_turno as 'encargado' | 'apoyo', cliente_id: clienteId, esquema_id: esq.id, esquema_nombre: esq.nombre }
        break
      }

      const { data: persistente } = await supabaseAdmin()
        .from('asignaciones_persistentes')
        .select('rol_turno')
        .eq('esquema_id', esq.id)
        .eq('usuario_id', user.id)
        .maybeSingle()

      if (persistente) {
        asignacionHoy = { rol_turno: persistente.rol_turno as 'encargado' | 'apoyo', cliente_id: clienteId, esquema_id: esq.id, esquema_nombre: esq.nombre }
        break
      }
    }
  }

  // ── 4. Para encargado asignado: ¿hay un turno previo sin cerrar que bloquee? ─
  let turnoBlockeante: { tecnico_nombre: string; folio_numero: number; interino: boolean } | null = null
  if (asignacionHoy?.rol_turno === 'encargado' && !turnoEncargado && asignacionHoy.cliente_id) {
    const esquemaId      = asignacionHoy.esquema_id
    const derivedTurno_  = deriveTurno('08:00') // fallback
    const { data: bloq } = await supabaseAdmin()
      .from('libro_turno')
      .select('tecnico_nombre, folio_numero, estado, interino')
      .eq('cliente_id', asignacionHoy.cliente_id)
      .neq('tecnico_id', user.id)
      .in('estado', ['abierto', 'pendiente_relevo'])
      .or(esquemaId
        ? `esquema_id.eq.${esquemaId},esquema_id.is.null`
        : `turno.eq.${derivedTurno_}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    turnoBlockeante = bloq ? { ...bloq, interino: bloq.interino ?? false } : null
  }

  // Distinguir: interino activo (apoyo cubriendo) vs turno previo sin cerrar
  const interinoActivo  = turnoBlockeante?.interino === true  ? turnoBlockeante : null
  const turnoPrevNoCerrado = turnoBlockeante?.interino !== true && turnoBlockeante ? turnoBlockeante : null

  // ── 5. Datos del turno activo (encargado o apoyo) ─────────────────────────────
  const turnoActivo: LibroTurno | null = (turnoEncargado as LibroTurno | null) ?? turnoApoyo
  const rolActivo: 'encargado' | 'apoyo' | null = turnoEncargado ? 'encargado' : turnoApoyo ? 'apoyo' : null

  // ── 5b. Apoyo en el turno activo (participantes activos + asignados en esquema) ─
  let apoyoList: Array<{ id: string; nombre: string; apellido: string; dni: string | null }> = []
  if (turnoActivo) {
    // Participantes que ya se unieron
    const { data: parts } = await supabaseAdmin()
      .from('participaciones_turno')
      .select('usuario_id, users!usuario_id(nombre, apellido, dni)')
      .eq('turno_id', turnoActivo.id)

    const joinedMap: Record<string, { id: string; nombre: string; apellido: string; dni: string | null }> = {}
    for (const p of (parts ?? []) as any[]) {
      joinedMap[p.usuario_id] = {
        id: p.usuario_id,
        nombre: p.users?.nombre ?? '',
        apellido: p.users?.apellido ?? '',
        dni: p.users?.dni ?? null,
      }
    }

    // Asignados en el esquema (incluye los que aún no se unieron)
    if (turnoActivo.esquema_id) {
      const { data: excepciones } = await supabaseAdmin()
        .from('asignaciones_turno')
        .select('usuario_id, users!usuario_id(nombre, apellido, dni)')
        .eq('esquema_id', turnoActivo.esquema_id)
        .eq('rol_turno', 'apoyo')
        .in('fecha', [hoy, ayer])

      let asignadosBase: typeof apoyoList = []
      if (excepciones && excepciones.length > 0) {
        asignadosBase = (excepciones as any[]).map(e => ({
          id: e.usuario_id,
          nombre: e.users?.nombre ?? '',
          apellido: e.users?.apellido ?? '',
          dni: e.users?.dni ?? null,
        }))
      } else {
        const { data: persistentes } = await supabaseAdmin()
          .from('asignaciones_persistentes')
          .select('usuario_id, users!usuario_id(nombre, apellido, dni)')
          .eq('esquema_id', turnoActivo.esquema_id)
          .eq('rol_turno', 'apoyo')
        asignadosBase = ((persistentes ?? []) as any[]).map(p => ({
          id: p.usuario_id,
          nombre: p.users?.nombre ?? '',
          apellido: p.users?.apellido ?? '',
          dni: p.users?.dni ?? null,
        }))
      }

      // Merge: los que ya se unieron tienen prioridad (mismo ID reemplaza el asignado)
      const mergeRecord: Record<string, typeof apoyoList[0]> = {}
      for (const a of asignadosBase) mergeRecord[a.id] = a
      for (const j of Object.values(joinedMap)) mergeRecord[j.id] = j
      apoyoList = Object.values(mergeRecord)
    } else {
      apoyoList = Object.values(joinedMap)
    }

    // Excluir al encargado del turno de la lista de apoyo
    apoyoList = apoyoList.filter(a => a.id !== turnoActivo.tecnico_id)
  }

  let novedades: LibroNovedad[] = []
  let incidenciasActivas: Incidencia[] = []
  let incidenciasPendientes: Incidencia[] = []
  let alertasPendientes: LibroNovedad[] = []

  if (turnoActivo) {
    // El apoyo no crea su propio libro_turno; sus novedades van al turno del encargado.
    // Por eso basta con el ID del turno activo para obtener todas las novedades.
    const turnoIds = [turnoActivo.id]

    const [{ data: nov }, { data: inc }, { data: pend }, { data: alertas }] = await Promise.all([
      supabaseAdmin()
        .from('libro_novedad')
        .select('*, incidencias(id, titulo, descripcion, severidad, estado, foto_url, created_at, libro_turno!turno_creacion_id(tecnico_nombre, tecnico_dni)), users!tecnico_id(nombre, apellido)')
        .in('turno_id', turnoIds)
        .order('created_at', { ascending: true }),
      turnoActivo.cliente_id
        ? supabaseAdmin()
            .from('incidencias')
            .select('*, libro_turno!turno_creacion_id(tecnico_nombre, tecnico_dni), detector:users!tecnico_detector_id(nombre, apellido)')
            .eq('cliente_id', turnoActivo.cliente_id)
            .eq('estado', 'abierto')
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [] }),
      rolActivo === 'encargado'
        ? supabaseAdmin()
            .from('incidencias')
            .select('*, libro_turno!turno_creacion_id(tecnico_nombre), detector:users!tecnico_detector_id(nombre, apellido)')
            .eq('turno_creacion_id', turnoActivo.id)
            .eq('estado_aprobacion', 'pendiente_revision')
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [] }),
      // Alertas del apoyo sin acusar — solo visibles para el encargado
      rolActivo === 'encargado'
        ? supabaseAdmin()
            .from('libro_novedad')
            .select('*, users!tecnico_id(nombre, apellido)')
            .eq('turno_id', turnoActivo.id)
            .eq('tipo', 'alerta')
            .neq('tecnico_id', turnoActivo.tecnico_id)
            .is('acusado_en', null)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [] }),
    ])
    novedades = (nov ?? []) as LibroNovedad[]
    incidenciasActivas = (inc ?? []) as Incidencia[]
    incidenciasPendientes = (pend ?? []) as Incidencia[]
    alertasPendientes = (alertas ?? []) as LibroNovedad[]
  }

  // ── 6. ¿El técnico ya cerró un turno hoy como encargado? ────────────────────
  // Se busca independientemente de la ventana horaria activa para que siga
  // mostrándose "cerrado" aunque el técnico recargue fuera de su horario.
  let turnoEncargadoCerradoHoy: { id: string; estado: string; folio_numero: number } | null = null
  if (!turnoEncargado && !turnoActivo) {
    const { data: cerrado } = await supabaseAdmin()
      .from('libro_turno')
      .select('id, estado, folio_numero')
      .eq('tecnico_id', user.id)
      .in('estado', ['cerrado', 'pendiente_relevo'])
      .in('fecha', [hoy, ayer])
      .maybeSingle()
    turnoEncargadoCerradoHoy = cerrado ?? null
  }

  // ── 6b. Sin asignación activa: ¿el técnico TIENE esquema pero está fuera de horario? ──
  let proximoEsquema: { nombre: string; hora_inicio: string; hora_fin: string } | null = null
  if (!asignacionHoy && !turnoActivo && !turnoEncargadoCerradoHoy && !turnoApoyoCerradoHoy && clienteId) {
    const { data: todosEsquemas } = await supabaseAdmin()
      .from('esquemas_cobertura')
      .select('id, nombre, hora_inicio, hora_fin')
      .eq('cliente_id', clienteId)
      .eq('activo', true)

    for (const esq of (todosEsquemas ?? [])) {
      const { data: exc } = await supabaseAdmin()
        .from('asignaciones_turno')
        .select('rol_turno')
        .eq('esquema_id', esq.id)
        .eq('usuario_id', user.id)
        .in('fecha', [hoy, ayer])
        .maybeSingle()
      if (exc) { proximoEsquema = esq; break }

      const { data: pers } = await supabaseAdmin()
        .from('asignaciones_persistentes')
        .select('rol_turno')
        .eq('esquema_id', esq.id)
        .eq('usuario_id', user.id)
        .maybeSingle()
      if (pers) { proximoEsquema = esq; break }
    }
  }

  // ── 7. Turno abierto del esquema — para que el apoyo vea quién lo abrió ─────
  let turnoAbiertoDeEsquema: {
    id: string; tecnico_nombre: string; horario_inicio: string | null; horario_fin: string | null
  } | null = null
  if (asignacionHoy?.rol_turno === 'apoyo' && !turnoApoyo && !turnoApoyoCerradoHoy && asignacionHoy.esquema_id) {
    const { data: turnoRaw } = await supabaseAdmin()
      .from('libro_turno')
      .select('id, tecnico_nombre, horario_inicio, horario_fin')
      .eq('estado', 'abierto')
      .eq('esquema_id', asignacionHoy.esquema_id)
      .maybeSingle()
    turnoAbiertoDeEsquema = turnoRaw ?? null
  }

  // ── 8. Relevo pendiente — solo si el usuario no cerró ni participó en turno de hoy ──
  let pendingReleovRaw: { id: string; tecnico_nombre: string; tecnico_dni: string; horario_fin: string | null; fecha: string; turno: string } | null = null
  if (!turnoActivo && !turnoEncargadoCerradoHoy && !turnoApoyoCerradoHoy && !turnoAbiertoDeEsquema) {
    const q = supabaseAdmin()
      .from('libro_turno')
      .select('id, tecnico_nombre, tecnico_dni, horario_fin, fecha, turno')
      .eq('estado', 'pendiente_relevo')
      .neq('tecnico_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    if (clienteId) q.eq('cliente_id', clienteId)
    const { data } = await q.maybeSingle()
    pendingReleovRaw = data ?? null
  }

  // El relevo solo aplica al encargado entrante, nunca al apoyo del turno que cerró
  const pendingRelevo = (
    pendingReleovRaw &&
    asignacionHoy?.rol_turno === 'encargado' &&
    turnoApoyoCerradoHoy?.id !== pendingReleovRaw.id
  ) ? pendingReleovRaw : null

  return (
    <div className="flex flex-col gap-4 pb-28">
      <h1 className="text-xl font-condensed font-bold text-brand-ink">Libro de Guardia</h1>

      {/* Banner éxito */}
      {searchParams.ok === '1' && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
          <CheckCircle2 className="text-green-600 shrink-0" size={20} />
          <p className="text-green-800 text-sm font-medium">Entrada registrada correctamente.</p>
        </div>
      )}

      {/* ── ESTADO A: Turno activo (encargado o apoyo) ─────────────────────────── */}
      {turnoActivo ? (
        <>
          {/* Marca alertas novedad_apoyo como leídas al abrir el libro — encargado y apoyo */}
          <GuardiaAlertsReader turnoId={turnoActivo.id} />
          {/* Header del turno con badge de rol */}
          <div className={`bg-white rounded-xl border shadow-sm p-4 ${rolActivo === 'apoyo' ? 'border-blue-200' : 'border-green-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <CircleDot size={16} className={`animate-pulse ${rolActivo === 'apoyo' ? 'text-blue-500' : 'text-green-500'}`} />
              <span className={`text-sm font-semibold ${rolActivo === 'apoyo' ? 'text-blue-700' : 'text-green-700'}`}>
                Guardia activa
              </span>
              {/* Badge de rol */}
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                rolActivo === 'apoyo'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-brand-orange/10 text-brand-orange'
              }`}>
                {rolActivo === 'apoyo' ? (
                  <span className="flex items-center gap-1"><Users size={11} /> Apoyo</span>
                ) : (
                  <span className="flex items-center gap-1"><ShieldCheck size={11} /> Encargado</span>
                )}
              </span>
              <span className="ml-auto text-xs text-gray-400">Folio #{turnoActivo.folio_numero}</span>
            </div>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-gray-400">Encargado</p>
                <p className="font-medium text-brand-ink">{turnoActivo.tecnico_nombre}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">DNI</p>
                <p className="font-medium text-brand-ink">{turnoActivo.tecnico_dni}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Fecha / Turno</p>
                <p className="font-medium text-brand-ink capitalize">
                  {formatFecha(turnoActivo.fecha)} — {turnoActivo.turno}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Inicio</p>
                <p className="font-medium text-brand-ink flex items-center gap-1">
                  <Clock size={13} />
                  {formatHora(turnoActivo.horario_inicio)}
                </p>
              </div>
            </div>
            {apoyoList.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2">
                {apoyoList.map((a, i) => (
                  <div key={a.id} className="grid grid-cols-2 gap-y-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Apoyo{apoyoList.length > 1 ? ` ${i + 1}` : ''}</p>
                      <p className="font-medium text-brand-ink">{a.nombre} {a.apellido}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">DNI</p>
                      <p className="font-medium text-brand-ink">{a.dni ?? '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alertas del apoyo sin acusar — solo encargado */}
          {rolActivo === 'encargado' && (
            <AlertasPendientesAcuse alertas={alertasPendientes} />
          )}

          {/* Incidencias pendientes de aprobación — solo encargado */}
          {rolActivo === 'encargado' && incidenciasPendientes.length > 0 && (
            <IncidenciasPendientesAprobacion
              incidencias={incidenciasPendientes}
              turnoId={turnoActivo.id}
            />
          )}

          {/* Incidencias activas del puesto */}
          <IncidenciasActivas incidencias={incidenciasActivas} turnoId={turnoActivo.id} />

          {/* Timeline de novedades */}
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Registro del turno
            </h2>
            <NovedadesTimeline novedades={novedades} incidencias={incidenciasActivas} turnoId={turnoActivo.id} rolActivo={rolActivo} encargadoTecnicoId={turnoActivo.tecnico_id ?? null} />
          </div>

          {/* Botones de acción fijos */}
          <div className="fixed bottom-16 left-0 right-0 z-50 bg-white border-t border-gray-200 p-3">
            <div className="max-w-[430px] mx-auto flex gap-3">
              <Link
                href={`/tecnico/libro-guardia/novedad?turno_id=${turnoActivo.id}&rol=${rolActivo}`}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-orange text-white font-bold py-3 rounded-lg text-sm min-h-[48px]"
              >
                <Plus size={18} />
                Nueva novedad
              </Link>
              {/* Solo el encargado puede cerrar */}
              {rolActivo === 'encargado' && (
                <Link
                  href={`/tecnico/libro-guardia/cerrar?turno_id=${turnoActivo.id}`}
                  className="flex-1 flex items-center justify-center gap-2 border-2 border-brand-ink text-brand-ink font-bold py-3 rounded-lg text-sm min-h-[48px]"
                >
                  <Lock size={16} />
                  Cerrar guardia
                </Link>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ── ESTADO G: Guardia del día ya cerrada — encargado ──────────── */}
          {turnoEncargadoCerradoHoy && (
            <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <CheckCircle2 size={20} className="text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-700 text-sm">Guardia del día registrada</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Ya cerraste tu guardia de hoy. No podés abrir un nuevo turno hasta el próximo día.
                  </p>
                </div>
              </div>
              <Link
                href={`/tecnico/libro-guardia/${turnoEncargadoCerradoHoy.id}`}
                className="flex items-center justify-center gap-2 w-full bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl text-sm min-h-[44px]"
              >
                <BookOpen size={16} />
                Ver registro del turno
              </Link>
            </div>
          )}

          {/* ── ESTADO G2: Guardia del día ya cerrada — apoyo ─────────────── */}
          {turnoApoyoCerradoHoy && (
            <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <CheckCircle2 size={20} className="text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-700 text-sm">Guardia del día registrada</p>
                  <p className="text-xs text-gray-500 mt-1">
                    El turno al que pertenecías ya fue cerrado. Podés revisar el registro en el historial.
                  </p>
                </div>
              </div>
              <Link
                href={`/tecnico/libro-guardia/${turnoApoyoCerradoHoy.id}`}
                className="flex items-center justify-center gap-2 w-full bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl text-sm min-h-[44px]"
              >
                <BookOpen size={16} />
                Ver registro del turno
              </Link>
            </div>
          )}

          {/* ── ESTADO B: Relevo pendiente ─────────────────────────────────── */}
          {pendingRelevo && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800 text-sm">Relevo pendiente</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    El turno de <strong>{pendingRelevo.tecnico_nombre}</strong> (DNI {pendingRelevo.tecnico_dni})
                    finalizó el {formatFecha(pendingRelevo.fecha)} a las {formatHora(pendingRelevo.horario_fin)}.
                    Firmá el relevo antes de iniciar tu guardia.
                  </p>
                </div>
              </div>
              <Link
                href={`/tecnico/libro-guardia/relevo?turno_id=${pendingRelevo.id}`}
                className="flex items-center justify-center gap-2 w-full bg-amber-500 text-white font-bold py-3 rounded-lg text-sm min-h-[48px]"
              >
                <UserCheck size={18} />
                Firmar relevo
              </Link>
            </div>
          )}

          {/* ── ESTADO C: Turno previo sin cerrar (encargado bloqueado) ───── */}
          {turnoPrevNoCerrado && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert size={20} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800 text-sm">Turno anterior no cerrado</p>
                  <p className="text-xs text-red-700 mt-1">
                    El turno de <strong>{turnoPrevNoCerrado.tecnico_nombre}</strong> (folio #{turnoPrevNoCerrado.folio_numero})
                    aún no fue cerrado. No podés abrir un nuevo turno hasta que el encargado saliente cierre el suyo.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── ESTADO C2: Interino activo — encargado original llegó tarde ── */}
          {interinoActivo && asignacionHoy?.esquema_id && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-4">
                <ShieldAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800 text-sm">Tu turno fue abierto por el encargado interino</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Como llegaste tarde, <strong>{interinoActivo.tecnico_nombre}</strong> abrió el turno como interino
                    y es responsable hasta el cierre. Podés incorporarte como apoyo para colaborar en el turno.
                  </p>
                </div>
              </div>
              <JoinTurnoButton
                esquemaId={asignacionHoy.esquema_id}
                tarde
              />
            </div>
          )}

          {/* ── ESTADO D: Apoyo — confirmar presencia ──────────────────── */}
          {asignacionHoy?.rol_turno === 'apoyo' && !turnoApoyo && !turnoApoyoCerradoHoy && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-4">
                <Users size={20} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  {turnoAbiertoDeEsquema ? (
                    <>
                      <p className="font-semibold text-blue-800 text-sm">Turno en curso</p>
                      <p className="text-xs text-blue-700 mt-1">
                        <strong>{turnoAbiertoDeEsquema.tecnico_nombre}</strong> abrió el turno{' '}
                        {formatHora(turnoAbiertoDeEsquema.horario_inicio)}–{formatHora(turnoAbiertoDeEsquema.horario_fin)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-blue-800 text-sm">Asignado como apoyo</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Turno <strong>{asignacionHoy.esquema_nombre ?? 'de hoy'}</strong> — el encargado todavía no abrió la guardia
                      </p>
                    </>
                  )}
                </div>
              </div>
              {turnoAbiertoDeEsquema ? (
                <JoinTurnoButton
                  esquemaId={asignacionHoy.esquema_id!}
                  label="Confirmar que estoy en puesto"
                />
              ) : (
                <div className="flex items-center justify-center gap-2 text-sm text-blue-600 bg-blue-100 rounded-xl py-3 min-h-[48px]">
                  <Clock size={16} />
                  Esperando que el encargado abra la guardia
                </div>
              )}
            </div>
          )}

          {/* ── ESTADO E: Encargado asignado sin turno, puede abrir ─────── */}
          {asignacionHoy?.rol_turno === 'encargado' && !turnoBlockeante && !turnoEncargadoCerradoHoy && (
            <div className="bg-brand-orange/5 border-2 border-brand-orange/30 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-4">
                <ShieldCheck size={20} className="text-brand-orange shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-brand-ink text-sm">Asignado como encargado</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Sos el encargado del turno <strong>{asignacionHoy.esquema_nombre ?? 'de hoy'}</strong>.
                    Iniciá el turno para comenzar el registro.
                  </p>
                </div>
              </div>
              <Link
                href="/tecnico/libro-guardia/abrir"
                className="flex items-center justify-center gap-2 w-full bg-brand-orange text-white font-bold py-3 rounded-xl text-sm min-h-[48px]"
              >
                <Plus size={18} />
                Iniciar guardia
              </Link>
            </div>
          )}

          {/* ── ESTADO F: Sin asignación ──────────────────────────────────── */}
          {!asignacionHoy && !pendingRelevo && (
            proximoEsquema ? (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">🕐</span>
                  <div>
                    <p className="font-semibold text-amber-800 text-sm">Fuera de horario</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Tu turno <strong>{proximoEsquema.nombre}</strong> es de{' '}
                      {formatHora(proximoEsquema.hora_inicio)} a {formatHora(proximoEsquema.hora_fin)}.
                      Podés iniciar hasta 30 minutos antes del comienzo.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 py-12 text-gray-400">
                <BookOpen size={56} className="opacity-30" />
                <div className="text-center">
                  <p className="font-semibold text-brand-ink text-base">Sin guardia activa</p>
                  <p className="text-sm text-gray-400 mt-1">No tenés turno asignado para hoy. Contactá al supervisor.</p>
                </div>
              </div>
            )
          )}

          {/* Historial de turnos anteriores */}
          <TurnosAnteriores userId={user.id} />
        </>
      )}
    </div>
  )
}

async function TurnosAnteriores({ userId }: { userId: string }) {
  const { data } = await supabaseServer()
    .from('libro_turno')
    .select('id, folio_numero, fecha, turno, horario_inicio, horario_fin, estado, firma_relevo_url')
    .eq('tecnico_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (!data || data.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Turnos anteriores</h2>
      {data.map((t) => (
        <Link
          key={t.id}
          href={`/tecnico/libro-guardia/${t.id}`}
          className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-4 shadow-sm active:bg-gray-50"
        >
          <div className={`w-2 h-2 rounded-full shrink-0 ${t.firma_relevo_url ? 'bg-green-400' : 'bg-amber-400'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-brand-ink">
              {formatFecha(t.fecha)}{' '}
              <span className="capitalize text-gray-500">{t.turno}</span>
            </p>
            <p className="text-xs text-gray-400">
              {formatHora(t.horario_inicio)} – {formatHora(t.horario_fin)}
              {!t.firma_relevo_url && (
                <span className="ml-2 text-amber-500 font-medium">Sin relevo firmado</span>
              )}
            </p>
          </div>
          <ChevronRight size={16} className="text-gray-300 shrink-0" />
        </Link>
      ))}
    </div>
  )
}
