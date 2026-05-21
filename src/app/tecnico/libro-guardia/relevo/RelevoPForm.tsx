'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import {
  Lock, UserCheck, XCircle, CheckCircle2, ChevronDown,
  X, Clock, AlertTriangle, TriangleAlert, ClipboardList, Eye,
  CheckCircle,
} from 'lucide-react'
import FirmaCanvas from '@/components/signature/FirmaCanvas'
import IncidenciasActivas from '@/components/libro/IncidenciasActivas'
import { RelevoPSchema, type RelevoPInput } from '@/lib/validations/libroTurno'
import type { Incidencia, LibroNovedad } from '@/types/database'

interface PlanillaItem {
  numero: number
  // hidrantes
  gabinete?: boolean; manga?: boolean; lanza?: boolean; valvula?: boolean
  obs_gabinete?: string; obs_manga?: string; obs_lanza?: string; obs_valvula?: string
  // extintores
  senalizacion?: boolean; acceso?: boolean; presion_peso?: boolean
  obs_senalizacion?: string; obs_acceso?: string; obs_presion_peso?: string
  [k: string]: unknown
}

interface PlanillaResumen {
  planilla: { tipo: string; fecha: string; turno: string; tecnico_nombre: string; tecnico_dni: string }
  stats: { total: number; ok: number; conObservaciones: number }
  itemsConObservacion: PlanillaItem[]
  allItems: PlanillaItem[]
}

function nowTime() { return new Date().toTimeString().slice(0, 5) }
function todayDate() { return new Date().toISOString().split('T')[0] }
function currentTurno(): 'diurno' | 'nocturno' { return new Date().getHours() < 18 ? 'diurno' : 'nocturno' }

const TIPO_CONFIG = {
  apertura: { label: 'Apertura', color: 'text-green-600', dot: 'bg-green-500' },
  novedad:  { label: 'Novedad',  color: 'text-amber-600', dot: 'bg-amber-500' },
  cierre:   { label: 'Cierre',   color: 'text-gray-600',  dot: 'bg-gray-500'  },
}

const SEVERIDAD_CONFIG = {
  bajo:  { label: 'Baja',  color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  medio: { label: 'Media', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  alto:  { label: 'Alta',  color: 'bg-red-100 text-red-800 border-red-300'          },
}

function formatHora(h: string | null) { return h ? h.slice(0, 5) : '—' }

interface Props {
  turnoSalienteId: string
  salienteNombre: string
  salienteDNI: string
  novedades: LibroNovedad[]
  incidenciasActivas: Incidencia[]
  entranteNombre?: string
  entranteDni?: string
}

export default function RelevoPForm({
  turnoSalienteId, salienteNombre, salienteDNI, novedades, incidenciasActivas,
  entranteNombre = '', entranteDni = '',
}: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | null>(null)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [selectedNovedad, setSelectedNovedad] = useState<LibroNovedad | null>(null)
  const [planillaFullView, setPlanillaFullView] = useState(false)
  const [planillaResumen, setPlanillaResumen] = useState<PlanillaResumen | null>(null)
  const [planillaLoading, setPlanillaLoading] = useState(false)
  const [planillaError, setPlanillaError] = useState(false)
  const novedadesRef = useRef<HTMLDivElement>(null)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<RelevoPInput>({
    resolver: zodResolver(RelevoPSchema),
    defaultValues: {
      turno_saliente_id:  turnoSalienteId,
      relevo_nombre:      entranteNombre,
      relevo_dni:         entranteDni,
      firma_relevo_dataurl: '',
      horario_inicio:     nowTime(),
      fecha:              todayDate(),
      turno:              currentTurno(),
    },
  })

  useEffect(() => {
    setPlanillaFullView(false)
    setPlanillaResumen(null)
    setPlanillaError(false)
  }, [selectedNovedad])

  function abrirPlanilla(planillaId: string) {
    setPlanillaFullView(true)
    setPlanillaResumen(null)
    setPlanillaError(false)
    setPlanillaLoading(true)
    fetch(`/api/planillas/resumen?id=${planillaId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.stats) { setPlanillaResumen(data) } else { setPlanillaError(true) }
        setPlanillaLoading(false)
      })
      .catch(() => { setPlanillaError(true); setPlanillaLoading(false) })
  }

  const handleFirma = useCallback((dataUrl: string | null) => {
    setFirmaDataUrl(dataUrl)
    setValue('firma_relevo_dataurl', dataUrl ?? '', { shouldValidate: true })
  }, [setValue])

  useEffect(() => {
    const el = novedadesRef.current
    if (!el) return
    if (el.scrollHeight <= el.clientHeight + 40) setScrolledToBottom(true)
  }, [])

  function handleNovedadesScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight - 40) setScrolledToBottom(true)
  }

  async function onSubmit(data: RelevoPInput) {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/libro-turno/relevo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al registrar el relevo'); return }
      router.push('/tecnico/libro-guardia?ok=1')
      router.refresh()
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 pb-28">
        <input type="hidden" {...register('turno_saliente_id')} />
        <input type="hidden" {...register('horario_inicio')} />
        <input type="hidden" {...register('fecha')} />
        <input type="hidden" {...register('turno')} />

        {/* Header */}
        <div className="flex items-start gap-3 bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
          <UserCheck size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">Lectura obligatoria antes de tomar guardia</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Revisá las novedades de <strong>{salienteNombre}</strong> (DNI {salienteDNI}).
              Tocá cualquiera para ver el detalle completo. La firma se habilita al llegar al final.
            </p>
          </div>
        </div>

        {/* Incidencias activas del puesto */}
        <IncidenciasActivas incidencias={incidenciasActivas} />

        {/* Lista de novedades — scrollable */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Novedades del turno ({novedades.length})
            </h2>
            {!scrolledToBottom ? (
              <div className="flex items-center gap-1 text-xs text-amber-600 animate-bounce">
                <ChevronDown size={14} />
                <span>Scrolleá</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 size={14} />
                <span>Leído</span>
              </div>
            )}
          </div>

          <div className="relative">
            <div ref={novedadesRef} onScroll={handleNovedadesScroll} className="max-h-[60vh] overflow-y-auto pr-1">
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200 pointer-events-none z-0" />
            <div className="flex flex-col gap-3">
              {novedades.map((n) => {
                const cfg           = TIPO_CONFIG[n.tipo]
                const esInc         = !!n.incidencias
                const esSeguimiento = !!n.incidencia_id && n.descripcion.startsWith('Seguimiento:')

                if (esSeguimiento) {
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => setSelectedNovedad(n)}
                      className="flex gap-4 items-start pl-1 text-left w-full active:opacity-70 ml-4"
                    >
                      <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 bg-gray-400 ring-2 ring-white" />
                      <div className="flex-1 rounded-xl border border-gray-200 p-2.5 shadow-sm bg-slate-50">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {n.incidencias?.titulo
                              ? `${n.incidencias.titulo} — Seguimiento`
                              : 'Seguimiento'}
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">{formatHora(n.hora)}</span>
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {n.descripcion.replace(/^Seguimiento:\s*/i, '')}
                        </p>
                      </div>
                    </button>
                  )
                }

                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelectedNovedad(n)}
                    className="flex gap-4 items-start pl-1 text-left w-full active:opacity-70"
                  >
                    <div className={`w-3.5 h-3.5 rounded-full shrink-0 mt-1 ring-2 ring-white ${esInc ? 'bg-red-500' : cfg.dot}`} />
                    <div className={`flex-1 rounded-xl border p-3 shadow-sm text-left ${esInc ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold uppercase tracking-wide ${esInc ? 'text-red-600' : cfg.color}`}>
                            {esInc ? 'Incidencia' : cfg.label}
                          </span>
                          {esInc && n.incidencias?.severidad && (
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${SEVERIDAD_CONFIG[n.incidencias.severidad].color}`}>
                              {SEVERIDAD_CONFIG[n.incidencias.severidad].label}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">{formatHora(n.hora)}</span>
                      </div>
                      {esInc && n.incidencias?.titulo && (
                        <p className="text-xs font-bold text-red-800 mb-1">{n.incidencias.titulo}</p>
                      )}
                      <p className="text-sm text-brand-ink line-clamp-2">{n.descripcion}</p>
                      {esInc && (
                        <div className="flex items-center gap-1 mt-1">
                          <AlertTriangle size={10} className="text-red-400" />
                          <span className="text-xs text-red-500">Persiste en el puesto · Tocá para ver detalle</span>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
              {novedades.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Sin novedades registradas</p>
              )}
            </div>
            </div>
            {/* Gradient fade que desaparece cuando ya se llegó al final */}
            {!scrolledToBottom && (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent" />
            )}
          </div>
        </div>

        {/* Mis datos + firma — bloqueados hasta leer todo */}
        <div className={`transition-opacity duration-300 flex flex-col gap-4 ${
          scrolledToBottom ? 'opacity-100' : 'opacity-30 pointer-events-none'
        }`}>
          <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mis datos (entrante)</p>
              {!scrolledToBottom && <Lock size={12} className="text-gray-400" />}
            </div>

            <div>
              <label htmlFor="relevo_nombre" className="block text-sm font-medium mb-1">
                Nombre completo <span className="text-red-500">*</span>
              </label>
              <input
                id="relevo_nombre"
                type="text"
                placeholder="Juan García"
                {...register('relevo_nombre')}
                className="w-full border border-gray-300 rounded p-3 text-base min-h-[44px]"
              />
              {errors.relevo_nombre && (
                <p className="text-red-600 text-sm mt-1">{errors.relevo_nombre.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="relevo_dni" className="block text-sm font-medium mb-1">
                DNI <span className="text-red-500">*</span>
              </label>
              <input
                id="relevo_dni"
                type="number"
                inputMode="numeric"
                placeholder="12345678"
                {...register('relevo_dni')}
                className="w-full border border-gray-300 rounded p-3 text-base min-h-[44px]"
              />
              {errors.relevo_dni && (
                <p className="text-red-600 text-sm mt-1">{errors.relevo_dni.message}</p>
              )}
            </div>
          </div>

          <FirmaCanvas onChange={handleFirma} label="Tu firma (personal entrante)" />
          {errors.firma_relevo_dataurl && !firmaDataUrl && (
            <p className="text-red-600 text-sm -mt-3">{errors.firma_relevo_dataurl.message}</p>
          )}
        </div>

        {!scrolledToBottom && (
          <p className="text-xs text-center text-gray-400">
            Scrolleá la lista hasta el final para habilitar la firma
          </p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-red-700 text-sm flex gap-2">
            <XCircle size={16} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <div className="fixed bottom-16 left-0 right-0 z-50 bg-white border-t border-gray-200 p-3">
          <div className="max-w-[430px] mx-auto">
            <button
              type="submit"
              disabled={submitting || !scrolledToBottom || !firmaDataUrl}
              className="w-full bg-brand-orange text-white font-bold py-4 rounded-lg text-base min-h-[56px] disabled:opacity-40"
            >
              {submitting ? 'Confirmando...' : 'Confirmar y Tomar Guardia'}
            </button>
          </div>
        </div>
      </form>

      {/* Bottom sheet detalle de novedad — z-[70] para estar sobre todo */}
      {selectedNovedad && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setSelectedNovedad(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="max-w-[430px] mx-auto">
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
              <div className="px-4 pb-8">
                {/* Header */}
                <div className="flex items-center justify-between py-3 mb-4 border-b border-gray-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedNovedad.incidencias ? (
                      <>
                        <AlertTriangle size={16} className="text-red-500 shrink-0" />
                        <span className="text-sm font-semibold text-red-700">Incidencia persistente</span>
                        {selectedNovedad.incidencias.severidad && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                            SEVERIDAD_CONFIG[selectedNovedad.incidencias.severidad].color
                          }`}>
                            {SEVERIDAD_CONFIG[selectedNovedad.incidencias.severidad].label}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <div className={`w-2.5 h-2.5 rounded-full ${TIPO_CONFIG[selectedNovedad.tipo].dot}`} />
                        <span className={`text-sm font-semibold ${TIPO_CONFIG[selectedNovedad.tipo].color}`}>
                          {TIPO_CONFIG[selectedNovedad.tipo].label}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={12} />{formatHora(selectedNovedad.hora)}
                    </div>
                    <button
                      onClick={() => setSelectedNovedad(null)}
                      className="p-1 text-gray-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Incidencia banner */}
                {selectedNovedad.incidencias?.titulo && (
                  <div className="mb-4 p-3 bg-red-50 rounded-xl border border-red-200">
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Título</p>
                    <p className="text-base font-bold text-red-800">{selectedNovedad.incidencias.titulo}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <TriangleAlert size={12} className="text-red-400" />
                      <p className="text-xs text-red-600">Persiste en el puesto hasta que el supervisor la resuelva.</p>
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Descripción</p>
                  <p className="text-sm text-brand-ink">{selectedNovedad.descripcion}</p>
                </div>
                {selectedNovedad.riesgo_detectado && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Riesgo detectado</p>
                    <p className="text-sm text-brand-ink">{selectedNovedad.riesgo_detectado}</p>
                  </div>
                )}
                {selectedNovedad.medidas_adoptadas && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Medidas adoptadas</p>
                    <p className="text-sm text-brand-ink">{selectedNovedad.medidas_adoptadas}</p>
                  </div>
                )}
                {selectedNovedad.observaciones_generales && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Observaciones</p>
                    <p className="text-sm text-brand-ink">{selectedNovedad.observaciones_generales}</p>
                  </div>
                )}
                {selectedNovedad.foto_url && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Foto</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedNovedad.foto_url}
                      alt="Foto"
                      className="w-full rounded-xl object-cover max-h-72"
                    />
                  </div>
                )}

                {/* Planilla vinculada — botón directo */}
                {selectedNovedad.planilla_id && (
                  <div className="mt-2 border-t border-gray-100 pt-4">
                    <button
                      type="button"
                      onClick={() => abrirPlanilla(selectedNovedad.planilla_id!)}
                      className="w-full flex items-center gap-3 bg-blue-50 border border-brand-blue rounded-xl p-3.5 active:bg-blue-100"
                    >
                      <ClipboardList size={20} className="text-brand-blue shrink-0" />
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold text-brand-blue">Ver planilla enviada</p>
                        <p className="text-xs text-blue-500">Solo lectura — no se puede modificar</p>
                      </div>
                      <Eye size={18} className="text-brand-blue shrink-0" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Sheet planilla completa — read-only, z-[80] sobre el sheet de novedad */}
      {planillaFullView && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[75]" onClick={() => setPlanillaFullView(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[80] bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <ClipboardList size={18} className="text-brand-blue" />
                <div>
                  <p className="text-sm font-bold text-brand-ink capitalize">
                    {planillaResumen ? `Planilla de ${planillaResumen.planilla.tipo}` : 'Planilla enviada'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {planillaResumen
                      ? `${planillaResumen.planilla.fecha} · Turno ${planillaResumen.planilla.turno} · Solo lectura`
                      : 'Solo lectura'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPlanillaFullView(false)}
                className="p-2 rounded-full active:bg-gray-100"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Info técnico */}
            {planillaResumen && (
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
                <p className="text-xs text-gray-500">
                  Técnico: <span className="font-semibold text-brand-ink">{planillaResumen.planilla.tecnico_nombre}</span>
                  {planillaResumen.planilla.tecnico_dni && ` — DNI ${planillaResumen.planilla.tecnico_dni}`}
                </p>
              </div>
            )}

            {/* Lista completa de ítems */}
            <div className="overflow-y-auto flex-1 px-4 py-3">
              {planillaLoading ? (
                <p className="text-sm text-gray-400 text-center py-12">Cargando planilla...</p>
              ) : planillaError ? (
                <p className="text-sm text-red-500 text-center py-12">No se pudo cargar la planilla.</p>
              ) : planillaResumen?.allItems.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sin ítems registrados</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {(planillaResumen?.allItems ?? []).map((item) => {
                    const esHidrante = planillaResumen!.planilla.tipo === 'hidrantes'
                    const todoOk = esHidrante
                      ? item.gabinete && item.manga && item.lanza && item.valvula
                      : item.senalizacion && item.acceso && item.presion_peso

                    const campos = esHidrante
                      ? [
                          { label: 'Gabinete', ok: !!item.gabinete, obs: item.obs_gabinete as string | undefined },
                          { label: 'Manga',    ok: !!item.manga,    obs: item.obs_manga    as string | undefined },
                          { label: 'Lanza',    ok: !!item.lanza,    obs: item.obs_lanza    as string | undefined },
                          { label: 'Válvula',  ok: !!item.valvula,  obs: item.obs_valvula  as string | undefined },
                        ]
                      : [
                          { label: 'Señalización', ok: !!item.senalizacion, obs: item.obs_senalizacion as string | undefined },
                          { label: 'Acceso',       ok: !!item.acceso,       obs: item.obs_acceso       as string | undefined },
                          { label: 'Presión/Peso', ok: !!item.presion_peso, obs: item.obs_presion_peso as string | undefined },
                        ]

                    return (
                      <div
                        key={item.numero}
                        className={`rounded-xl border p-3 ${todoOk ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
                      >
                        <p className={`text-xs font-bold mb-2 ${todoOk ? 'text-green-800' : 'text-red-800'}`}>
                          Ítem #{item.numero}
                        </p>
                        <div className="flex flex-col gap-1">
                          {campos.map((c) => (
                            <div key={c.label} className="flex items-start gap-1.5">
                              {c.ok
                                ? <CheckCircle size={12} className="text-green-600 shrink-0 mt-0.5" />
                                : <XCircle size={12} className="text-red-500 shrink-0 mt-0.5" />
                              }
                              <span className={`text-xs ${c.ok ? 'text-green-700' : 'text-red-700'}`}>
                                {c.label}
                                {!c.ok && c.obs ? `: ${c.obs}` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
