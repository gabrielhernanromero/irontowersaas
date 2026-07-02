export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/auth/getSession'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Link from 'next/link'
import {
  Droplets, FlameKindling, CheckCircle2, ChevronRight,
  BookOpen, AlertTriangle, CircleDot, Lock, UserCheck, Users,
} from 'lucide-react'
import { findEsquemaActivo, type EsquemaVentana } from '@/lib/esquemas/validarVentana'
import { getArgTime } from '@/lib/cobertura/timeUtils'

function getTurnoActual(): 'diurno' | 'nocturno' {
  return new Date().getHours() < 18 ? 'diurno' : 'nocturno'
}

export default async function TecnicoHome() {
  const { user } = await getSession()
  const turno = getTurnoActual()

  // Turno propio abierto
  const { data: turnoActivo } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, folio_numero, horario_inicio, cliente_id, fecha, turno')
    .eq('tecnico_id', user!.id)
    .eq('estado', 'abierto')
    .maybeSingle()

  // Si no tiene turno propio, buscar turno activo del encargado en el mismo puesto
  let turnoEncargado: { id: string; folio_numero: number; horario_inicio: string; cliente_id: string; fecha: string; turno: string } | null = null
  if (!turnoActivo && user?.cliente_id) {
    const { data } = await supabaseAdmin()
      .from('libro_turno')
      .select('id, folio_numero, horario_inicio, cliente_id, fecha, turno')
      .eq('cliente_id', user.cliente_id)
      .eq('estado', 'abierto')
      .neq('tecnico_id', user!.id)
      .maybeSingle()
    turnoEncargado = data
  }

  // Relevo pendiente (solo si no hay turno propio ni encargado)
  let pendingRelevo: { id: string; tecnico_nombre: string; horario_fin: string | null; fecha: string; turno: string; esquema_id: string | null } | null = null
  if (!turnoActivo && !turnoEncargado) {
    const relevoQuery = supabaseAdmin()
      .from('libro_turno')
      .select('id, tecnico_nombre, horario_fin, fecha, turno, esquema_id')
      .eq('estado', 'pendiente_relevo')
      .neq('tecnico_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(1)
    if (user?.cliente_id) relevoQuery.eq('cliente_id', user.cliente_id)
    const { data: relevoRaw } = await relevoQuery.maybeSingle()

    if (relevoRaw) {
      // Solo mostrar si el usuario es el encargado entrante, no el apoyo del turno saliente
      let esApoyoDelTurno = false
      if (relevoRaw.esquema_id) {
        const { data: exc } = await supabaseAdmin()
          .from('asignaciones_turno')
          .select('rol_turno')
          .eq('esquema_id', relevoRaw.esquema_id)
          .eq('usuario_id', user!.id)
          .eq('rol_turno', 'apoyo')
          .maybeSingle()
        if (exc) {
          esApoyoDelTurno = true
        } else {
          const { data: pers } = await supabaseAdmin()
            .from('asignaciones_persistentes')
            .select('rol_turno')
            .eq('esquema_id', relevoRaw.esquema_id)
            .eq('usuario_id', user!.id)
            .eq('rol_turno', 'apoyo')
            .maybeSingle()
          if (pers) esApoyoDelTurno = true
        }
      }
      // Además verificar que el usuario es encargado dentro de su ventana horaria
      if (!esApoyoDelTurno && user?.cliente_id) {
        const { data: esquemasRaw } = await supabaseAdmin()
          .from('esquemas_cobertura')
          .select('id, nombre, hora_inicio, hora_fin, activo, dias_semana, fecha_desde, fecha_hasta')
          .eq('cliente_id', user.cliente_id)
          .eq('activo', true)

        const esquemaActivo = findEsquemaActivo((esquemasRaw ?? []) as EsquemaVentana[])
        let esEncargadoEnVentana = false

        if (esquemaActivo) {
          const { hoy, ayer } = getArgTime()
          const esquemaId = (esquemaActivo as EsquemaVentana & { id: string }).id

          const { data: exc } = await supabaseAdmin()
            .from('asignaciones_turno').select('rol_turno')
            .eq('esquema_id', esquemaId).eq('usuario_id', user!.id)
            .in('fecha', [hoy, ayer]).maybeSingle()

          if (exc?.rol_turno === 'encargado') {
            esEncargadoEnVentana = true
          } else if (!exc) {
            const { data: pers } = await supabaseAdmin()
              .from('asignaciones_persistentes').select('rol_turno')
              .eq('esquema_id', esquemaId).eq('usuario_id', user!.id).maybeSingle()
            if (pers?.rol_turno === 'encargado') esEncargadoEnVentana = true
          }
        }

        if (esEncargadoEnVentana) pendingRelevo = relevoRaw
      }
    }
  }

  // Verificar si el apoyo ya se unió al turno del encargado
  let apoyoUnido = false
  if (!turnoActivo && turnoEncargado) {
    const { data: participacion } = await supabaseAdmin()
      .from('participaciones_turno')
      .select('id')
      .eq('turno_id', turnoEncargado.id)
      .eq('usuario_id', user!.id)
      .maybeSingle()
    apoyoUnido = !!participacion
  }

  // Referencia para buscar planillas: propio > encargado (siempre, para mostrar planilla ya enviada)
  const turnoRef = turnoActivo ?? turnoEncargado

  // Planillas habilitadas para el cliente
  const clienteId = turnoRef?.cliente_id ?? user?.cliente_id ?? null
  const { data: clienteData } = clienteId
    ? await supabaseAdmin()
        .from('clientes')
        .select('planillas_habilitadas')
        .eq('id', clienteId)
        .single()
    : { data: null }
  const planillasHabilitadas: string[] = clienteData?.planillas_habilitadas ?? ['hidrantes', 'extintores']

  // Planillas: buscar por turno_id del turno de referencia (propio o encargado)
  const { data: planillasHoy } = turnoRef
    ? await supabaseAdmin()
        .from('planillas')
        .select('tipo, inmutable, id')
        .eq('turno_id', turnoRef.id)
        .eq('inmutable', true)
    : { data: [] as { tipo: string; inmutable: boolean; id: string }[] }

  const enviada = (tipo: string) => planillasHoy?.find((p) => p.tipo === tipo)
  const hidrantesEnviada  = enviada('hidrantes')
  const extintoresEnviada = enviada('extintores')
  const turnoPropio       = !!turnoActivo
  // Apoyo solo puede acceder a planillas si ya se unió al turno del encargado
  const hayTurnoActivo    = turnoPropio || apoyoUnido

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <h1 className="text-2xl font-condensed font-bold text-brand-ink">
          Hola, {user?.nombre}
        </h1>
        <span className="inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium bg-brand-blue text-white capitalize">
          Turno {turno}
        </span>
      </div>

      {/* Banner relevo pendiente */}
      {pendingRelevo && (
        <Link
          href={`/tecnico/libro-guardia/relevo?turno_id=${pendingRelevo.id}`}
          className="flex items-center gap-3 bg-amber-500 text-white rounded-xl p-4 shadow-md active:bg-amber-600"
        >
          <UserCheck size={24} className="shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-base">Firmá el relevo</p>
            <p className="text-sm opacity-90">
              El turno de <strong>{pendingRelevo.tecnico_nombre}</strong> está esperando tu firma
            </p>
          </div>
          <ChevronRight size={20} className="shrink-0 opacity-80" />
        </Link>
      )}

      {/* Estado del turno */}
      {turnoPropio ? (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
          <CircleDot size={16} className="text-green-500 animate-pulse shrink-0" />
          <p className="text-sm text-green-800">
            Turno activo — Folio #{turnoActivo.folio_numero} · Inicio {turnoActivo.horario_inicio?.slice(0, 5)}
          </p>
        </div>
      ) : turnoEncargado ? (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
          <Users size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Turno activo — Folio #{turnoEncargado.folio_numero}</p>
            <p className="text-xs text-blue-700 mt-0.5">
              El encargado ya abrió el turno. Ingresá al Libro de Guardia para unirte como apoyo.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Sin turno abierto</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Antes de enviar planillas debés abrir tu turno en el Libro de Guardia.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Hidrantes — solo si está habilitada para el cliente */}
        {planillasHabilitadas.includes('hidrantes') && (
          <PlanillaCard
            label="Planilla Hidrantes"
            sublabel="48 puntos de control"
            icon={<Droplets size={24} className="text-white" />}
            iconBg={hidrantesEnviada ? 'bg-green-500' : 'bg-brand-blue'}
            enviada={!!hidrantesEnviada}
            turnoAbierto={hayTurnoActivo}
            href={hidrantesEnviada ? `/tecnico/historial/${hidrantesEnviada.id}` : '/tecnico/hidrantes'}
          />
        )}

        {/* Extintores — solo si está habilitada para el cliente */}
        {planillasHabilitadas.includes('extintores') && (
          <PlanillaCard
            label="Planilla Extintores"
            sublabel="113 puntos de control"
            icon={<FlameKindling size={24} className="text-white" />}
            iconBg={extintoresEnviada ? 'bg-green-500' : 'bg-brand-orange'}
            enviada={!!extintoresEnviada}
            turnoAbierto={hayTurnoActivo}
            href={extintoresEnviada ? `/tecnico/historial/${extintoresEnviada.id}` : '/tecnico/extintores'}
          />
        )}

        {/* Libro de Guardia */}
        <Link
          href="/tecnico/libro-guardia"
          className="flex items-center gap-4 bg-white rounded-xl p-5 shadow-sm border border-gray-100 min-h-[88px] active:bg-gray-50"
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-brand-ink">
            <BookOpen className="text-white" size={24} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-brand-ink text-lg">Libro de Guardia</p>
            <p className="text-sm text-gray-500">
              {turnoPropio
                ? 'Ver novedades · Agregar · Cerrar turno'
                : turnoEncargado
                  ? 'Unirte como apoyo · Ver novedades'
                  : 'Abrir turno para empezar'}
            </p>
          </div>
          <ChevronRight size={18} className="text-gray-300 shrink-0" />
        </Link>
      </div>

    </div>
  )
}

function PlanillaCard({
  label, sublabel, icon, iconBg, enviada, turnoAbierto, href,
}: {
  label: string
  sublabel: string
  icon: React.ReactNode
  iconBg: string
  enviada: boolean
  turnoAbierto: boolean
  href: string
}) {
  const bloqueada = !turnoAbierto && !enviada

  if (bloqueada) {
    return (
      <div className="flex items-center gap-4 bg-white rounded-xl p-5 shadow-sm border border-gray-100 min-h-[88px] opacity-60">
        <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-gray-300">
          <Lock size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-brand-ink text-lg">{label}</p>
          <p className="text-sm text-gray-400">Abrí tu turno primero</p>
        </div>
      </div>
    )
  }

  return (
    <Link
      href={href}
      className={`flex items-center gap-4 bg-white rounded-xl p-5 shadow-sm border min-h-[88px] active:bg-gray-50 ${
        enviada ? 'border-green-200' : 'border-gray-100'
      }`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
        {enviada ? <CheckCircle2 size={24} className="text-white" /> : icon}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-brand-ink text-lg">{label}</p>
        <p className={`text-sm ${enviada ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
          {enviada ? 'Enviada — Ver detalle' : `${sublabel} · Pendiente`}
        </p>
      </div>
      <ChevronRight size={18} className="text-gray-300 shrink-0" />
    </Link>
  )
}
