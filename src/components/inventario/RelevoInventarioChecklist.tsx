'use client'

import { useState, useEffect } from 'react'
import { Package, CheckCircle2, AlertTriangle, Wrench, HelpCircle, User, Clock } from 'lucide-react'
import type { EstadoOperativo } from '@/types/database'

interface IncidenciaElemento {
  id: string
  estado: string
  titulo: string
  descripcion: string
  severidad: 'bajo' | 'medio' | 'alto' | null
  created_at: string
  libro_turno: { tecnico_nombre: string; tecnico_dni: string } | null
}

interface Elemento {
  id: string
  nombre: string
  codigo_patrimonial: string
  estado_admin: 'activo' | 'en_mantenimiento' | 'inactivo'
  motivo_mantenimiento: string | null
  incidencias?: IncidenciaElemento[]
}

export interface ControlItem {
  elementoId: string
  estadoOperativo: EstadoOperativo
  observacion?: string
  incidenciaResuelta?: boolean
}

type EstadoLocal = EstadoOperativo | null

interface ItemState {
  estado: EstadoLocal
  observacion: string
  obsError: string | null
  incidenciaResuelta: boolean
}

const OBS_DEFAULT_PERSISTE = 'Persiste la falla reportada anteriormente.'

function formatFechaHora(iso: string) {
  // Argentina no tiene horario de verano: UTC-3 fijo. Se evita Intl/toLocaleString
  // porque produce mismatches de hidratación entre el ICU del servidor y el del navegador.
  const ar = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000)
  const dia = String(ar.getUTCDate()).padStart(2, '0')
  const mes = String(ar.getUTCMonth() + 1).padStart(2, '0')
  const anio = ar.getUTCFullYear()
  const horas = String(ar.getUTCHours()).padStart(2, '0')
  const minutos = String(ar.getUTCMinutes()).padStart(2, '0')
  return `${dia}/${mes}/${anio} ${horas}:${minutos}`
}

interface Props {
  elementos: Elemento[]
  onChange: (controles: ControlItem[]) => void
}

export default function RelevoInventarioChecklist({ elementos, onChange }: Props) {
  const activos = elementos.filter((e) => e.estado_admin === 'activo')

  const [items, setItems] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(activos.map((e) => [
      e.id,
      {
        // Pre-seleccionar "falla" si hay incidencia abierta conocida
        estado: e.incidencias?.some((i) => i.estado === 'abierto') ? 'falla' : null,
        observacion: '',
        obsError: null,
        incidenciaResuelta: false,
      },
    ]))
  )

  // Notificar al padre cada vez que cambia el estado
  useEffect(() => {
    const controles: ControlItem[] = activos
      .filter((e) => items[e.id]?.estado !== null)
      .map((e) => ({
        elementoId: e.id,
        estadoOperativo: items[e.id].estado as EstadoOperativo,
        observacion: items[e.id].observacion || undefined,
        incidenciaResuelta: items[e.id].incidenciaResuelta || undefined,
      }))
    onChange(controles)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  function setEstado(id: string, estado: EstadoLocal, opts?: { incidenciaResuelta?: boolean; obsDefault?: string }) {
    setItems((prev) => {
      const prevItem = prev[id]
      const switching = prevItem.estado !== estado
      const observacion = opts?.obsDefault !== undefined
        ? opts.obsDefault          // default explícito (ej. "Sigue igual")
        : switching
          ? ''                     // cambio de botón → limpiar observación
          : prevItem.observacion   // mismo botón → conservar lo escrito
      return {
        ...prev,
        [id]: {
          ...prevItem,
          estado,
          obsError: null,
          observacion,
          incidenciaResuelta: opts?.incidenciaResuelta ?? false,
        },
      }
    })
  }

  function setObs(id: string, observacion: string) {
    setItems((prev) => ({
      ...prev,
      [id]: { ...prev[id], observacion, obsError: null },
    }))
  }

  function validarObs(id: string): boolean {
    const it = items[id]
    if (it.estado !== 'ok' && it.estado !== null && it.observacion.trim().length < 10) {
      setItems((prev) => ({
        ...prev,
        [id]: { ...prev[id], obsError: 'Descripción mínima de 10 caracteres.' },
      }))
      return false
    }
    return true
  }

  if (elementos.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Package size={16} className="text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Control de inventario del puesto
        </h2>
      </div>
      <p className="text-xs text-gray-500">
        Verificá el estado de cada activo. Los elementos con reparación pendiente no requieren auditoría.
      </p>

      <div className="flex flex-col gap-3">
        {elementos.filter((e) => e.estado_admin !== 'inactivo').map((el) => {
          const enMantenimiento = el.estado_admin === 'en_mantenimiento'
          const incAbierta = el.incidencias?.find((i) => i.estado === 'abierto') ?? null
          const it = items[el.id]

          return (
            <div
              key={el.id}
              className={`rounded-xl border p-3 ${
                enMantenimiento
                  ? 'bg-slate-100 border-slate-200 opacity-60'
                  : it?.estado === 'ok'
                  ? 'bg-green-50 border-green-200'
                  : it?.estado === 'falla' || it?.estado === 'faltante'
                  ? 'bg-red-50 border-red-200'
                  : incAbierta
                  ? 'bg-orange-50 border-orange-200'
                  : 'bg-white border-gray-200'
              }`}
            >
              {/* Info del elemento */}
              <div className="flex items-start gap-2 mb-2">
                <div className="mt-0.5 shrink-0">
                  {enMantenimiento ? (
                    <Wrench size={15} className="text-slate-400" />
                  ) : incAbierta ? (
                    <AlertTriangle size={15} className="text-orange-400" />
                  ) : it?.estado === 'ok' ? (
                    <CheckCircle2 size={15} className="text-green-500" />
                  ) : (
                    <HelpCircle size={15} className="text-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-brand-ink">{el.nombre}</p>
                  <p className="text-xs text-gray-400">{el.codigo_patrimonial}</p>
                </div>
              </div>

              {/* Estado del elemento (bloqueado o controles) */}
              {enMantenimiento ? (
                <p className="text-xs text-slate-500 ml-5">
                  En mantenimiento — {el.motivo_mantenimiento ?? 'sin detalle'}
                </p>
              ) : (
                <>
                {incAbierta && (
                  <div className="ml-5 mb-2 rounded-lg bg-orange-100 border border-orange-300 p-2.5">
                    <p className="text-xs font-bold text-orange-800">{incAbierta.titulo}</p>
                    {incAbierta.descripcion && (
                      <p className="text-xs text-orange-700 mt-1">{incAbierta.descripcion}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-orange-600">
                      {incAbierta.libro_turno?.tecnico_nombre && (
                        <span className="flex items-center gap-1">
                          <User size={11} /> {incAbierta.libro_turno.tecnico_nombre}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {formatFechaHora(incAbierta.created_at)}
                      </span>
                    </div>
                  </div>
                )}
                <div className="ml-5 flex flex-col gap-2">
                  {/* Botones de control */}
                  <div className="flex gap-2">
                    {incAbierta ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEstado(el.id, 'falla', { obsDefault: OBS_DEFAULT_PERSISTE })}
                          className={`flex-1 text-sm font-semibold py-2.5 rounded-lg border min-h-[44px] transition-colors ${
                            it?.estado === 'falla' ? 'bg-amber-500 text-white' : 'bg-white border-amber-300 text-amber-700'
                          }`}
                        >
                          Sigue igual
                        </button>
                        <button
                          type="button"
                          onClick={() => setEstado(el.id, 'ok', { incidenciaResuelta: true })}
                          className={`flex-1 text-sm font-semibold py-2.5 rounded-lg border min-h-[44px] transition-colors ${
                            it?.estado === 'ok' ? 'bg-green-500 text-white' : 'bg-white border-green-300 text-green-700'
                          }`}
                        >
                          Se resolvió
                        </button>
                        <button
                          type="button"
                          onClick={() => setEstado(el.id, 'faltante')}
                          className={`flex-1 text-sm font-semibold py-2.5 rounded-lg border min-h-[44px] transition-colors ${
                            it?.estado === 'faltante' ? 'bg-red-600 text-white' : 'bg-white border-red-300 text-red-700'
                          }`}
                        >
                          Faltante
                        </button>
                      </>
                    ) : (
                      (['ok', 'falla', 'faltante'] as EstadoOperativo[]).map((est) => {
                        const labels: Record<EstadoOperativo, string> = { ok: 'OK', falla: 'Falla', faltante: 'Faltante' }
                        const colors: Record<EstadoOperativo, string> = {
                          ok:       'bg-green-500 text-white',
                          falla:    'bg-amber-500 text-white',
                          faltante: 'bg-red-600 text-white',
                        }
                        const idle: Record<EstadoOperativo, string> = {
                          ok:       'border-green-300 text-green-700',
                          falla:    'border-amber-300 text-amber-700',
                          faltante: 'border-red-300 text-red-700',
                        }
                        const selected = it?.estado === est

                        return (
                          <button
                            key={est}
                            type="button"
                            onClick={() => setEstado(el.id, est)}
                            className={`flex-1 text-sm font-semibold py-2.5 rounded-lg border min-h-[44px] transition-colors ${
                              selected ? colors[est] : `bg-white ${idle[est]}`
                            }`}
                          >
                            {labels[est]}
                          </button>
                        )
                      })
                    )}
                  </div>

                  {/* Observación obligatoria cuando no es OK */}
                  {it?.estado && it.estado !== 'ok' && (
                    <div>
                      <textarea
                        value={it.observacion}
                        onChange={(e) => setObs(el.id, e.target.value)}
                        onBlur={() => validarObs(el.id)}
                        placeholder="Describí el problema con al menos 10 caracteres..."
                        rows={2}
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        className={`w-full border rounded-lg p-2.5 text-sm resize-none ${
                          it.obsError ? 'border-red-400' : 'border-gray-300'
                        }`}
                      />
                      {it.obsError && (
                        <p className="text-xs text-red-600 mt-0.5">{it.obsError}</p>
                      )}
                    </div>
                  )}
                </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
