import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Lock, Clock, CheckCircle2, AlertTriangle, CircleDot } from 'lucide-react'
import type { LibroTurno, LibroNovedad } from '@/types/database'

interface Props { params: { id: string } }

function fmt(h: string | null) { return h ? h.slice(0, 5) : '—' }
function fmtFecha(f: string | null) {
  if (!f) return '—'
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

const TIPO_CONFIG = {
  apertura: { label: 'Apertura de guardia',  colorDot: 'bg-green-500', colorText: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  novedad:  { label: 'Novedad',              colorDot: 'bg-amber-500', colorText: 'text-amber-700', bg: 'bg-amber-50 border-amber-200'  },
  cierre:   { label: 'Cierre de guardia',    colorDot: 'bg-gray-500',  colorText: 'text-gray-700',  bg: 'bg-gray-50 border-gray-200'   },
  alerta:   { label: 'Alerta de inventario', colorDot: 'bg-red-500',   colorText: 'text-red-700',   bg: 'bg-red-50 border-red-200'     },
}

export default async function LibroTurnoDetallePage({ params }: Props) {
  await requireRole('tecnico', 'admin')

  const { data: turnoRaw } = await supabaseServer()
    .from('libro_turno')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!turnoRaw) notFound()
  const turno = turnoRaw as LibroTurno

  const { data: novedadesRaw } = await supabaseServer()
    .from('libro_novedad')
    .select('*')
    .eq('turno_id', params.id)
    .order('created_at', { ascending: true })

  const novedades = (novedadesRaw ?? []) as LibroNovedad[]

  return (
    <div className="flex flex-col gap-4 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/tecnico/libro-guardia" className="p-2 -ml-2 text-gray-500 min-h-[44px] flex items-center">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-condensed font-bold text-brand-ink">
            Folio #{turno.folio_numero}
          </h1>
          <p className="text-xs text-gray-400">Libro de Guardia</p>
        </div>
      </div>

      {/* Banner inmutable */}
      <div className="flex items-center gap-3 bg-gray-100 border border-gray-200 rounded-xl p-3">
        <Lock size={16} className="text-gray-500 shrink-0" />
        <p className="text-xs text-gray-600">Registro de solo lectura — no se puede modificar</p>
      </div>

      {/* Datos del turno */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          {turno.estado === 'abierto'
            ? <CircleDot size={16} className="text-green-500 animate-pulse" />
            : <Lock size={16} className="text-gray-400" />}
          <span className={`text-sm font-semibold capitalize ${turno.estado === 'abierto' ? 'text-green-700' : 'text-gray-600'}`}>
            {turno.estado === 'abierto' ? 'Guardia activa' : 'Guardia cerrada'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-y-3 text-sm">
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
              {fmtFecha(turno.fecha)} — {turno.turno}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Horario</p>
            <p className="font-medium text-brand-ink flex items-center gap-1">
              <Clock size={13} className="text-gray-400" />
              {fmt(turno.horario_inicio)} – {fmt(turno.horario_fin)}
            </p>
          </div>
        </div>
      </div>

      {/* Timeline de novedades */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Registro cronológico
        </h2>
        <div className="relative">
          <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
          <div className="flex flex-col gap-4">
            {novedades.map((n) => {
              const cfg = TIPO_CONFIG[n.tipo]
              return (
                <div key={n.id} className="flex gap-4 items-start pl-1">
                  <div className={`w-3.5 h-3.5 rounded-full shrink-0 mt-1.5 ${cfg.colorDot} ring-2 ring-white`} />
                  <div className={`flex-1 rounded-xl border p-3 ${cfg.bg}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.colorText}`}>
                        {cfg.label}
                      </span>
                      <span className="text-xs text-gray-400">{fmt(n.hora)}</span>
                    </div>
                    <p className="text-sm text-brand-ink">{n.descripcion}</p>
                    {n.riesgo_detectado && (
                      <p className="text-xs text-gray-600 mt-1">
                        <span className="font-medium">Riesgo:</span> {n.riesgo_detectado}
                      </p>
                    )}
                    {n.medidas_adoptadas && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        <span className="font-medium">Medidas:</span> {n.medidas_adoptadas}
                      </p>
                    )}
                    {n.observaciones_generales && (
                      <p className="text-xs text-gray-500 mt-0.5 italic">{n.observaciones_generales}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Firmas */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Firmas</h2>
        <div className="flex items-center gap-3">
          {turno.firma_cierre_url
            ? <CheckCircle2 size={18} className="text-green-600 shrink-0" />
            : <AlertTriangle size={18} className="text-amber-500 shrink-0" />}
          <div>
            <p className="text-sm font-medium text-brand-ink">Firma de cierre (saliente)</p>
            <p className={`text-xs ${turno.firma_cierre_url ? 'text-green-600' : 'text-amber-500'}`}>
              {turno.firma_cierre_url ? 'Firmado' : 'Pendiente'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {turno.firma_relevo_url
            ? <CheckCircle2 size={18} className="text-green-600 shrink-0" />
            : <AlertTriangle size={18} className="text-amber-500 shrink-0" />}
          <div>
            <p className="text-sm font-medium text-brand-ink">Firma de relevo (entrante)</p>
            {turno.firma_relevo_url ? (
              <p className="text-xs text-green-600">
                {turno.relevo_nombre} — DNI {turno.relevo_dni}
              </p>
            ) : (
              <p className="text-xs text-amber-500">Pendiente</p>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-gray-300">
        Creado el {new Date(turno.created_at).toLocaleString('es-AR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}
      </p>
    </div>
  )
}
