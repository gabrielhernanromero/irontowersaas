'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Clock, AlertTriangle, ChevronDown, ChevronUp, Download,
  Sun, Moon, Loader2, Settings,
} from 'lucide-react'
import { downloadCsv } from '@/lib/exportCsv'
import { rangoSemanaActual, rangoQuincenaActual, rangoMesActual } from '@/lib/personal/periodosPreset'
import type { ResumenTecnico, TurnoTrabajado } from '@/lib/personal/calcularHorasTrabajadas'

interface Tecnico { id: string; nombre: string; apellido: string }

function horaArg(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function fechaCorta(fecha: string): string {
  const [, m, d] = fecha.split('-')
  return `${d}/${m}`
}

function motivosExcepcion(t: TurnoTrabajado): string[] {
  const motivos: string[] = []
  if (t.cierreForzado) motivos.push('Cierre forzado por supervisión')
  if (t.cierreAnticipado) motivos.push(`Cierre anticipado: ${t.motivoCierreAnticipado ?? 'sin motivo registrado'}`)
  if (t.aperturaTardia) motivos.push('Apertura tardía')
  if (t.rondas && t.rondas.completas < t.rondas.total) motivos.push(`Ronda incompleta (${t.rondas.completas}/${t.rondas.total})`)
  return motivos
}

function fmtMoneda(v: number): string {
  return v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

export default function HorasTrabajadasClient({ tecnicos, esAdmin }: { tecnicos: Tecnico[]; esAdmin: boolean }) {
  const hoy = new Date()
  const defaultDesde = new Date(hoy.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const defaultHasta = hoy.toISOString().slice(0, 10)

  const [desde, setDesde] = useState(defaultDesde)
  const [hasta, setHasta] = useState(defaultHasta)
  const [tecnicoId, setTecnicoId] = useState('')
  const [resumen, setResumen] = useState<ResumenTecnico[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)

  const buscar = useCallback(async (rangoDesde: string, rangoHasta: string, tecnico: string) => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ desde: rangoDesde, hasta: rangoHasta })
      if (tecnico) qs.set('tecnicoId', tecnico)
      const res = await fetch(`/api/supervisor/personal/horas?${qs.toString()}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al cargar el reporte'); return }
      setResumen(json.tecnicos)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { buscar(defaultDesde, defaultHasta, '') }, [buscar, defaultDesde, defaultHasta])

  function aplicarPreset(rango: { desde: string; hasta: string }) {
    setDesde(rango.desde)
    setHasta(rango.hasta)
    buscar(rango.desde, rango.hasta, tecnicoId)
  }

  const todosLosTurnos = (resumen ?? []).flatMap((t) => t.detalle.map((d) => ({ ...d, tecnico: t })))
  const paraRevisar = todosLosTurnos.filter((d) => d.excepcion).sort((a, b) => b.fecha.localeCompare(a.fecha))
  const hayTarifas = (resumen ?? []).some((t) => t.montoTotalEstimado !== null)

  function exportarResumen() {
    if (!resumen) return
    downloadCsv(
      resumen.map((t) => ({
        Técnico: `${t.nombre} ${t.apellido}`,
        'Total turnos': t.totalTurnos,
        Diurnos: t.turnosDiurnos,
        Nocturnos: t.turnosNocturnos,
        'Feriado nacional': t.turnosFeriadoNacional,
        'Feriado puente': t.turnosFeriadoPuente,
        'Horas totales': t.horasTotales,
        Excepciones: t.excepciones,
        '$ estimado': t.montoTotalEstimado ?? '',
      })),
      `horas-trabajadas-resumen_${desde}_${hasta}`,
    )
  }

  function exportarDetalle() {
    if (!resumen) return
    downloadCsv(
      todosLosTurnos.map((t) => ({
        Técnico: `${t.tecnico.nombre} ${t.tecnico.apellido}`,
        Fecha: t.fecha,
        Turno: t.turno,
        Rol: t.rol,
        Sede: t.clienteNombre,
        Apertura: t.aperturaReal ? horaArg(t.aperturaReal) : '',
        Cierre: t.cierreReal ? horaArg(t.cierreReal) : '',
        Horas: t.horasTrabajadas ?? '',
        Feriado: t.feriado ? `${t.feriado.nombre} (${t.feriado.tipo})` : '',
        Excepciones: motivosExcepcion(t).join(' | '),
        Rondas: t.rondas ? `${t.rondas.completas}/${t.rondas.total}` : '',
        '$ estimado': t.montoEstimado ?? '',
      })),
      `horas-trabajadas-detalle_${desde}_${hasta}`,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
            <Clock size={22} className="text-brand-orange" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Personal · Horas trabajadas</h1>
            <p className="text-sm text-gray-500">Turnos cubiertos por técnico, para liquidar sueldos</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-sm">
          <Link href="/supervisor/personal/feriados" className="text-brand-orange hover:underline">
            Gestionar feriados →
          </Link>
          {esAdmin && (
            <Link href="/supervisor/personal/tarifas" className="flex items-center gap-1 text-brand-orange hover:underline">
              <Settings size={14} /> Configurar tarifas →
            </Link>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => aplicarPreset(rangoSemanaActual())} className="px-3 py-3 min-h-[44px] text-base rounded-lg border border-gray-300 hover:bg-gray-50">Semana actual</button>
          <button onClick={() => aplicarPreset(rangoQuincenaActual())} className="px-3 py-3 min-h-[44px] text-base rounded-lg border border-gray-300 hover:bg-gray-50">Quincena actual</button>
          <button onClick={() => aplicarPreset(rangoMesActual())} className="px-3 py-3 min-h-[44px] text-base rounded-lg border border-gray-300 hover:bg-gray-50">Mes actual</button>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-full sm:w-auto border border-gray-300 rounded-lg p-2 text-base min-h-[44px]" />
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-full sm:w-auto border border-gray-300 rounded-lg p-2 text-base min-h-[44px]" />
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-gray-600 mb-1">Técnico</label>
            <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)} className="w-full sm:w-auto sm:min-w-[10rem] border border-gray-300 rounded-lg p-2 text-base min-h-[44px]">
              <option value="">Todos</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre} {t.apellido}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => buscar(desde, hasta, tecnicoId)}
            className="w-full sm:w-auto bg-brand-orange text-white font-semibold px-4 py-2 rounded-lg text-base min-h-[44px]"
          >
            Buscar
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading && <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 size={16} className="animate-spin" /> Cargando…</div>}

      {!loading && resumen && (
        <>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportarResumen} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 min-h-[44px]">
              <Download size={16} /> Exportar resumen
            </button>
            <button onClick={exportarDetalle} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 min-h-[44px]">
              <Download size={16} /> Exportar detalle
            </button>
          </div>

          {/* Para revisar */}
          {paraRevisar.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-amber-600" />
                <h2 className="font-semibold text-amber-900">Para revisar ({paraRevisar.length})</h2>
              </div>
              <ul className="flex flex-col gap-2">
                {paraRevisar.map((t) => (
                  <li key={`${t.turnoId}-${t.tecnico.tecnicoId}`} className="text-sm text-amber-900">
                    <span className="font-medium">{t.tecnico.nombre} {t.tecnico.apellido}</span> — {fechaCorta(t.fecha)} {t.turno === 'diurno' ? 'diurno' : 'nocturno'}: {motivosExcepcion(t).join(' · ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Por técnico */}
          <div className="flex flex-col gap-3">
            {resumen.length === 0 && (
              <p className="text-sm text-gray-500">No hay turnos cerrados en el rango elegido.</p>
            )}
            {resumen.map((t) => (
              <div key={t.tecnicoId} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <button
                  onClick={() => setExpandido(expandido === t.tecnicoId ? null : t.tecnicoId)}
                  className="w-full flex items-center justify-between p-4 min-h-[44px]"
                >
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">{t.nombre} {t.apellido}</p>
                    <p className="text-sm text-gray-500">
                      {t.totalTurnos} turnos · {t.turnosDiurnos} diurnos · {t.turnosNocturnos} nocturnos
                      {(t.turnosFeriadoNacional + t.turnosFeriadoPuente) > 0 && (
                        <> · {t.turnosFeriadoNacional + t.turnosFeriadoPuente} en feriado</>
                      )}
                      {' · '}{t.horasTotales} hs
                      {t.excepciones > 0 && <span className="text-amber-600"> · {t.excepciones} excepciones</span>}
                      {hayTarifas && t.montoTotalEstimado !== null && (
                        <> · <span className="font-medium">{fmtMoneda(t.montoTotalEstimado)}{t.tarifaIncompleta ? ' (parcial)' : ''}</span></>
                      )}
                    </p>
                  </div>
                  {expandido === t.tecnicoId ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {expandido === t.tecnicoId && (
                  <div className="border-t border-gray-100 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {t.detalle
                      .slice()
                      .sort((a, b) => b.fecha.localeCompare(a.fecha))
                      .map((turno) => (
                        <div key={turno.turnoId} className="border border-gray-200 rounded-lg p-3 text-sm flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{fechaCorta(turno.fecha)}</span>
                            <span className="flex items-center gap-1 text-gray-500">
                              {turno.turno === 'diurno' ? <Sun size={14} /> : <Moon size={14} />}
                              {turno.turno === 'diurno' ? 'Diurno' : 'Nocturno'}
                            </span>
                          </div>
                          <p className="text-gray-500">{turno.rol === 'encargado' ? 'Encargado' : 'Apoyo'} · {turno.clienteNombre}</p>
                          <p className="text-gray-700">
                            {turno.aperturaReal ? horaArg(turno.aperturaReal) : '—'} → {turno.cierreForzado ? 'sin cierre propio' : (turno.cierreReal ? horaArg(turno.cierreReal) : '—')}
                            {turno.rol === 'apoyo' && !turno.cierreForzado && ' (aprox.)'}
                            {turno.horasTrabajadas !== null && <> · {turno.horasTrabajadas} hs</>}
                          </p>
                          {turno.feriado && (
                            <span className="inline-block w-fit px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs">
                              Feriado {turno.feriado.tipo === 'nacional' ? 'nacional' : 'puente'}
                            </span>
                          )}
                          {turno.rondas && (
                            <p className={turno.rondas.completas < turno.rondas.total ? 'text-amber-600' : 'text-gray-500'}>
                              Rondas: {turno.rondas.completas}/{turno.rondas.total}
                            </p>
                          )}
                          {turno.excepcion && (
                            <p className="text-amber-600 text-xs">{motivosExcepcion(turno).join(' · ')}</p>
                          )}
                          {hayTarifas && turno.montoEstimado !== null && (
                            <p className="font-medium">{fmtMoneda(turno.montoEstimado)}</p>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
