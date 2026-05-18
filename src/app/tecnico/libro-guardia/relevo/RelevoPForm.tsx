'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import {
  Lock, UserCheck, XCircle, CheckCircle2, ChevronDown,
  X, Clock, AlertTriangle, TriangleAlert,
} from 'lucide-react'
import FirmaCanvas from '@/components/signature/FirmaCanvas'
import { RelevoPSchema, type RelevoPInput } from '@/lib/validations/libroTurno'
import type { Incidencia, LibroNovedad } from '@/types/database'

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
}

export default function RelevoPForm({
  turnoSalienteId, salienteNombre, salienteDNI, novedades, incidenciasActivas,
}: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | null>(null)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [selectedNovedad, setSelectedNovedad] = useState<LibroNovedad | null>(null)
  const novedadesRef = useRef<HTMLDivElement>(null)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<RelevoPInput>({
    resolver: zodResolver(RelevoPSchema),
    defaultValues: {
      turno_saliente_id:  turnoSalienteId,
      relevo_nombre:      '',
      relevo_dni:         '',
      firma_relevo_dataurl: '',
      horario_inicio:     nowTime(),
      fecha:              todayDate(),
      turno:              currentTurno(),
    },
  })

  const handleFirma = useCallback((dataUrl: string | null) => {
    setFirmaDataUrl(dataUrl)
    setValue('firma_relevo_dataurl', dataUrl ?? '', { shouldValidate: true })
  }, [setValue])

  useEffect(() => {
    const el = novedadesRef.current
    if (!el) return
    if (el.scrollHeight <= el.clientHeight) { setScrolledToBottom(true); return }
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setScrolledToBottom(true)
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

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
        {incidenciasActivas.length > 0 && (
          <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-500 shrink-0" />
              <p className="text-sm font-bold text-red-700">
                {incidenciasActivas.length === 1
                  ? '1 incidencia activa en este puesto'
                  : `${incidenciasActivas.length} incidencias activas en este puesto`}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {incidenciasActivas.map((inc) => (
                <div key={inc.id} className="bg-white rounded-lg border border-red-200 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-red-800">{inc.titulo}</span>
                    {inc.severidad && (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${
                        SEVERIDAD_CONFIG[inc.severidad].color
                      }`}>
                        {SEVERIDAD_CONFIG[inc.severidad].label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-red-700 line-clamp-2">{inc.descripcion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

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

          <div ref={novedadesRef} className="max-h-[40vh] overflow-y-auto pr-1 relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200 pointer-events-none" />
            <div className="flex flex-col gap-3">
              {novedades.map((n) => {
                const cfg = TIPO_CONFIG[n.tipo]
                const esInc = !!n.incidencias
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
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
