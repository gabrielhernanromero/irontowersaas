export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Link from 'next/link'
import {
  Plus, BookOpen, CheckCircle2, Clock,
  Lock, ChevronRight, UserCheck, CircleDot, AlertTriangle,
} from 'lucide-react'
import type { Incidencia, LibroTurno, LibroNovedad } from '@/types/database'
import NovedadesTimeline from './NovedadesTimeline'
import IncidenciasActivas from '@/components/libro/IncidenciasActivas'

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

  // Turno propio abierto
  const { data: turnoAbierto } = await supabaseServer()
    .from('libro_turno')
    .select('*')
    .eq('tecnico_id', user.id)
    .eq('estado', 'abierto')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Novedades del turno abierto con join a incidencias
  let novedades: LibroNovedad[] = []
  let incidenciasActivas: Incidencia[] = []
  if (turnoAbierto) {
    const [{ data: nov }, { data: inc }] = await Promise.all([
      supabaseServer()
        .from('libro_novedad')
        .select('*, incidencias(id, titulo, descripcion, severidad, estado, foto_url, created_at, libro_turno!turno_creacion_id(tecnico_nombre, tecnico_dni))')
        .eq('turno_id', turnoAbierto.id)
        .order('created_at', { ascending: true }),
      // Incidencias abiertas en el puesto (cliente) del turno actual
      turnoAbierto.cliente_id
        ? supabaseAdmin()
            .from('incidencias')
            .select('*, libro_turno!turno_creacion_id(tecnico_nombre, tecnico_dni)')
            .eq('cliente_id', turnoAbierto.cliente_id)
            .eq('estado', 'abierto')
            .order('created_at', { ascending: true })
        : supabaseAdmin()
            .from('incidencias')
            .select('*, libro_turno!turno_creacion_id(tecnico_nombre, tecnico_dni)')
            .is('cliente_id', null)
            .eq('estado', 'abierto')
            .order('created_at', { ascending: true }),
    ])
    novedades = (nov ?? []) as LibroNovedad[]
    incidenciasActivas = (inc ?? []) as Incidencia[]
  }

  // Turno ajeno pendiente de relevo (usa admin para evitar limitación de RLS)
  const { data: pendingRelevo } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, tecnico_nombre, tecnico_dni, horario_fin, fecha, turno')
    .eq('estado', 'pendiente_relevo')
    .neq('tecnico_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const turno = turnoAbierto as LibroTurno | null

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

      {/* ── ESTADO A: Turno abierto propio ─────────────────────────── */}
      {turno ? (
        <>
          {/* Header del turno */}
          <div className="bg-white rounded-xl border border-green-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <CircleDot size={16} className="text-green-500 animate-pulse" />
              <span className="text-sm font-semibold text-green-700">Guardia activa</span>
              <span className="ml-auto text-xs text-gray-400">Folio #{turno.folio_numero}</span>
            </div>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-gray-400">Técnico</p>
                <p className="font-medium text-brand-ink">{turno.tecnico_nombre}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">DNI</p>
                <p className="font-medium text-brand-ink">{turno.tecnico_dni}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Fecha / Turno</p>
                <p className="font-medium text-brand-ink capitalize">
                  {formatFecha(turno.fecha)} — {turno.turno}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Inicio</p>
                <p className="font-medium text-brand-ink flex items-center gap-1">
                  <Clock size={13} />
                  {formatHora(turno.horario_inicio)}
                </p>
              </div>
            </div>
          </div>

          {/* Incidencias activas del puesto */}
          <IncidenciasActivas incidencias={incidenciasActivas} turnoId={turno.id} />

          {/* Timeline de novedades (tappable → bottom sheet) */}
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Registro del turno
            </h2>
            <NovedadesTimeline novedades={novedades} incidencias={incidenciasActivas} turnoId={turno.id} />
          </div>

          {/* Botones de acción */}
          <div className="fixed bottom-16 left-0 right-0 z-50 bg-white border-t border-gray-200 p-3">
            <div className="max-w-[430px] mx-auto flex gap-3">
              <Link
                href={`/tecnico/libro-guardia/novedad?turno_id=${turno.id}`}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-orange text-white font-bold py-3 rounded-lg text-sm min-h-[48px]"
              >
                <Plus size={18} />
                Nueva novedad
              </Link>
              <Link
                href={`/tecnico/libro-guardia/cerrar?turno_id=${turno.id}`}
                className="flex-1 flex items-center justify-center gap-2 border-2 border-brand-ink text-brand-ink font-bold py-3 rounded-lg text-sm min-h-[48px]"
              >
                <Lock size={16} />
                Cerrar guardia
              </Link>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ── ESTADO B: Relevo pendiente ────────────────────────────── */}
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

          {/* ── ESTADO C: Sin turno ──────────────────────────────────── */}
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-gray-400">
            <BookOpen size={56} className="opacity-30" />
            <div className="text-center">
              <p className="font-semibold text-brand-ink text-base">Sin guardia activa</p>
              <p className="text-sm text-gray-400 mt-1">Iniciá tu turno para empezar a registrar</p>
            </div>
            <Link
              href="/tecnico/libro-guardia/abrir"
              className="flex items-center gap-2 bg-brand-orange text-white font-bold px-8 py-4 rounded-xl text-base min-h-[56px]"
            >
              <Plus size={20} />
              Iniciar guardia
            </Link>
          </div>

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
