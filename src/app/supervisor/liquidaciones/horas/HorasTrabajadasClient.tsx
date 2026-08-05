'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import {
  ChevronDown, ChevronUp, Download,
  Sun, Moon,
} from 'lucide-react'
import { SkeletonListItem } from '@/components/ui/Skeleton'
import { downloadCsv } from '@/lib/exportCsv'
import { rangoSemanaActual, rangoQuincenaActual, rangoMesActual } from '@/lib/liquidaciones/periodosPreset'
import type { ResumenTecnico, TurnoTrabajado } from '@/lib/liquidaciones/calcularHorasTrabajadas'

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

function mesLabel(mesKey: string): string {
  const [y, m] = mesKey.split('-').map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function agruparPorMes(detalle: TurnoTrabajado[]): { mesKey: string; turnos: TurnoTrabajado[] }[] {
  const ordenado = detalle.slice().sort((a, b) => b.fecha.localeCompare(a.fecha))
  const grupos = new Map<string, TurnoTrabajado[]>()
  for (const t of ordenado) {
    const key = t.fecha.slice(0, 7) // YYYY-MM
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(t)
  }
  return Array.from(grupos.entries()).map(([mesKey, turnos]) => ({ mesKey, turnos }))
}

function GrillaTurnos({ turnos, hayTarifas }: { turnos: TurnoTrabajado[]; hayTarifas: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {turnos.map((turno) => (
        <div key={turno.turnoId} className="border border-gray-200 rounded-lg p-3 text-sm flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="font-medium">{fechaCorta(turno.fecha)}</span>
            <span className="flex items-center gap-1 text-gray-500">
              {turno.turno === 'diurno' ? <Sun size={14} className="text-amber-500" /> : <Moon size={14} className="text-indigo-500" />}
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
  )
}

function DetalleTecnico({ detalle, hayTarifas }: { detalle: TurnoTrabajado[]; hayTarifas: boolean }) {
  const grupos = agruparPorMes(detalle)

  // Un solo click (la fila del técnico) muestra todo. Con un solo mes no
  // hace falta ninguna etiqueta de por medio.
  if (grupos.length <= 1) {
    return <GrillaTurnos turnos={detalle} hayTarifas={hayTarifas} />
  }

  // Con varios meses, agrupar es solo una etiqueta visual (no un botón) —
  // organiza sin agregar otro nivel de click.
  return (
    <div className="flex flex-col gap-4">
      {grupos.map((grupo) => (
        <div key={grupo.mesKey}>
          <p className="text-sm font-medium text-gray-500 mb-2">
            {mesLabel(grupo.mesKey)} · {grupo.turnos.length} turno{grupo.turnos.length !== 1 ? 's' : ''}
          </p>
          <GrillaTurnos turnos={grupo.turnos} hayTarifas={hayTarifas} />
        </div>
      ))}
    </div>
  )
}

export default function HorasTrabajadasClient({ tecnicos }: { tecnicos: Tecnico[] }) {
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
      const res = await fetch(`/api/supervisor/liquidaciones/horas?${qs.toString()}`)
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

      {error && <p className="text-red-600 text-base">{error}</p>}
      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonListItem key={i} />)}
        </div>
      )}

      {!loading && resumen && (
        <>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportarResumen} className="flex items-center gap-2 px-3 py-2 text-base rounded-lg border border-gray-300 hover:bg-gray-50 min-h-[44px]">
              <Download size={16} /> Exportar resumen
            </button>
            <button onClick={exportarDetalle} className="flex items-center gap-2 px-3 py-2 text-base rounded-lg border border-gray-300 hover:bg-gray-50 min-h-[44px]">
              <Download size={16} /> Exportar detalle
            </button>
          </div>

          {/* Por técnico */}
          {resumen.length === 0 && (
            <p className="text-sm text-gray-500">No hay turnos cerrados en el rango elegido.</p>
          )}

          {resumen.length > 0 && (
            <>
              {/* Mobile: tarjetas */}
              <div className="sm:hidden flex flex-col gap-3">
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
                      <div className="border-t border-gray-100 p-4">
                        <DetalleTecnico detalle={t.detalle} hayTarifas={hayTarifas} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop: tabla */}
              <div className="hidden sm:block bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="p-3 font-medium">Técnico</th>
                      <th className="p-3 font-medium text-right">Turnos</th>
                      <th className="p-3 font-medium text-right">Diurnos</th>
                      <th className="p-3 font-medium text-right">Nocturnos</th>
                      <th className="p-3 font-medium text-right">Feriados</th>
                      <th className="p-3 font-medium text-right">Horas</th>
                      <th className="p-3 font-medium text-right">Excepciones</th>
                      <th className="p-3 font-medium text-right">$ estimado</th>
                      <th className="p-3 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.map((t) => {
                      const feriados = t.turnosFeriadoNacional + t.turnosFeriadoPuente
                      return (
                        <Fragment key={t.tecnicoId}>
                          <tr
                            onClick={() => setExpandido(expandido === t.tecnicoId ? null : t.tecnicoId)}
                            className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                          >
                            <td className="p-3 font-medium text-gray-900">{t.nombre} {t.apellido}</td>
                            <td className="p-3 text-right">{t.totalTurnos}</td>
                            <td className="p-3 text-right text-gray-500">{t.turnosDiurnos}</td>
                            <td className="p-3 text-right text-gray-500">{t.turnosNocturnos}</td>
                            <td className="p-3 text-right text-gray-500">{feriados > 0 ? feriados : '—'}</td>
                            <td className="p-3 text-right">{t.horasTotales}</td>
                            <td className="p-3 text-right">
                              {t.excepciones > 0 ? <span className="text-amber-600">{t.excepciones}</span> : '—'}
                            </td>
                            <td className="p-3 text-right font-medium">
                              {hayTarifas && t.montoTotalEstimado !== null ? `${fmtMoneda(t.montoTotalEstimado)}${t.tarifaIncompleta ? ' *' : ''}` : '—'}
                            </td>
                            <td className="p-3 text-gray-400">{expandido === t.tecnicoId ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                          </tr>
                          {expandido === t.tecnicoId && (
                            <tr>
                              <td colSpan={9} className="p-4 bg-gray-50 border-b border-gray-100">
                                <DetalleTecnico detalle={t.detalle} hayTarifas={hayTarifas} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
                </div>
                {resumen.some((t) => t.tarifaIncompleta) && (
                  <p className="text-xs text-gray-400 p-3 border-t border-gray-100">* Tarifa parcial: falta cargar el precio de algún tipo de turno para este técnico.</p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
