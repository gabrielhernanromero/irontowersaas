'use client'

import { useState, useEffect, useRef } from 'react'
import {
  AlertTriangle, X, Clock, ChevronLeft, CheckCircle2,
  MessageSquarePlus, ShieldCheck, History, Camera, User,
} from 'lucide-react'
import type { Incidencia } from '@/types/database'

const SEV_BADGE: Record<string, { label: string; cls: string }> = {
  alto:  { label: 'Alta',  cls: 'bg-red-100 text-red-800 border-red-300' },
  medio: { label: 'Media', cls: 'bg-orange-100 text-orange-800 border-orange-300' },
  bajo:  { label: 'Baja',  cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
}

interface HistorialEntry {
  id: string
  hora: string
  descripcion: string
  created_at: string
  libro_turno?: { users?: { nombre: string; apellido: string } | null } | null
}

type SheetMode = 'detail' | 'seguimiento' | 'resolucion'

interface Props {
  incidencia: Incidencia
  turnoId?: string
  onClose: () => void
  onResolved?: (id: string) => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function IncidenciaDetailSheet({ incidencia, turnoId, onClose, onResolved }: Props) {
  const [mode, setMode] = useState<SheetMode>('detail')
  const [historial, setHistorial] = useState<HistorialEntry[]>([])
  const [historialLoading, setHistorialLoading] = useState(false)

  const [seguimientoText, setSeguimientoText] = useState('')
  const [resolucionText, setResolucionText] = useState('')
  const [resolucionFoto, setResolucionFoto] = useState<File | null>(null)
  const [resolucionFotoPreview, setResolucionFotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fotoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setHistorialLoading(true)
    fetch(`/api/incidencias/historial?id=${incidencia.id}`)
      .then((r) => r.json())
      .then((data) => {
        setHistorial(Array.isArray(data) ? data : [])
        setHistorialLoading(false)
      })
      .catch(() => setHistorialLoading(false))
  }, [incidencia.id])

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResolucionFoto(file)
    setResolucionFotoPreview(URL.createObjectURL(file))
  }

  async function uploadFoto(file: File): Promise<string | undefined> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload/foto', { method: 'POST', body: fd })
    if (!res.ok) return undefined
    return (await res.json()).path as string
  }

  async function submitSeguimiento() {
    if (!turnoId) return
    if (seguimientoText.trim().length < 5) { setSubmitError('Mínimo 5 caracteres'); return }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/incidencias/seguimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidencia_id: incidencia.id, turno_id: turnoId, descripcion: seguimientoText.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setSubmitError(json.error ?? 'Error al guardar'); return }
      setHistorial((prev) => [...prev, { id: json.id, hora: json.hora, descripcion: json.descripcion, created_at: json.created_at, libro_turno: null }])
      setMode('detail')
      setSeguimientoText('')
    } catch {
      setSubmitError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitResolucion() {
    if (!turnoId) return
    if (resolucionText.trim().length < 15) { setSubmitError('Describí en detalle cómo se resolvió (mínimo 15 caracteres)'); return }
    setSubmitting(true)
    setSubmitError(null)
    try {
      let fotoUrl: string | undefined
      if (resolucionFoto) fotoUrl = await uploadFoto(resolucionFoto)
      const res = await fetch('/api/incidencias/resolver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidencia_id: incidencia.id, turno_id: turnoId, descripcion_resolucion: resolucionText.trim(), foto_url: fotoUrl }),
      })
      const json = await res.json()
      if (!res.ok) { setSubmitError(json.error ?? 'Error al resolver'); return }
      onResolved?.(incidencia.id)
      onClose()
    } catch {
      setSubmitError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-2xl shadow-xl max-h-[88vh] flex flex-col">
        <div className="max-w-[430px] mx-auto w-full flex flex-col flex-1 min-h-0">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
            {mode !== 'detail' && (
              <button
                onClick={() => { setMode('detail'); setSubmitError(null) }}
                className="p-1 text-gray-400 min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              {mode === 'detail'      && <AlertTriangle size={16} className="text-red-500 shrink-0" />}
              {mode === 'seguimiento' && <MessageSquarePlus size={16} className="text-brand-blue shrink-0" />}
              {mode === 'resolucion'  && <ShieldCheck size={16} className="text-green-600 shrink-0" />}
              <span className="text-sm font-semibold text-brand-ink">
                {mode === 'detail'      && 'Incidencia activa'}
                {mode === 'seguimiento' && 'Agregar seguimiento'}
                {mode === 'resolucion'  && 'Resolver incidencia'}
              </span>
              {mode === 'detail' && incidencia.severidad && SEV_BADGE[incidencia.severidad] && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${SEV_BADGE[incidencia.severidad].cls}`}>
                  {SEV_BADGE[incidencia.severidad].label}
                </span>
              )}
            </div>
            <button onClick={onClose} className="p-1 text-gray-400 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0">
              <X size={18} />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 pb-6">

            {/* ── DETAIL ── */}
            {mode === 'detail' && (
              <div className="flex flex-col gap-4 pt-4">
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Título</p>
                  <p className="text-base font-bold text-red-800">{incidencia.titulo}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Descripción</p>
                  <p className="text-sm text-brand-ink">{incidencia.descripcion}</p>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Clock size={13} />
                  <span>Reportada el {formatDate(incidencia.created_at)}</span>
                </div>

                {incidencia.foto_url && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Foto</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={incidencia.foto_url} alt="Foto incidencia" className="w-full rounded-xl object-cover max-h-56" />
                  </div>
                )}

                {/* Historial */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <History size={14} className="text-gray-400" />
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Historial de seguimiento</p>
                  </div>
                  {historialLoading ? (
                    <p className="text-xs text-gray-400 py-2">Cargando...</p>
                  ) : historial.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">Sin seguimientos registrados aún.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {historial.map((h) => {
                        const esResolucion = h.descripcion.startsWith('INCIDENCIA RESUELTA')
                        const nombre = h.libro_turno?.users
                          ? `${h.libro_turno.users.nombre} ${h.libro_turno.users.apellido}`
                          : null
                        return (
                          <div key={h.id} className={`rounded-lg border p-2.5 ${esResolucion ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <User size={11} className={esResolucion ? 'text-green-500' : 'text-gray-400'} />
                              <span className={`text-xs font-semibold ${esResolucion ? 'text-green-700' : 'text-gray-600'}`}>
                                {nombre ?? 'Sistema'}
                              </span>
                              <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
                                <Clock size={10} />
                                {h.hora?.slice(0, 5)}
                              </span>
                            </div>
                            <p className={`text-xs ${esResolucion ? 'text-green-700 font-medium' : 'text-brand-ink'}`}>
                              {h.descripcion}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Actions — solo si hay turnoId (modo activo) */}
                {turnoId && (
                  <div className="flex flex-col gap-3 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => { setMode('seguimiento'); setSubmitError(null) }}
                      className="w-full flex items-center justify-center gap-2 border-2 border-brand-blue text-brand-blue font-bold py-3 rounded-xl text-sm min-h-[48px] active:bg-blue-50"
                    >
                      <MessageSquarePlus size={18} />
                      Agregar seguimiento
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMode('resolucion'); setSubmitError(null) }}
                      className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 rounded-xl text-sm min-h-[48px] active:bg-green-700"
                    >
                      <CheckCircle2 size={18} />
                      Resolver incidencia
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── SEGUIMIENTO ── */}
            {mode === 'seguimiento' && (
              <div className="flex flex-col gap-4 pt-4">
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-xs text-blue-700">Registrá el avance sobre <strong>{incidencia.titulo}</strong>. No modifica el estado de la incidencia.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Descripción del avance <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={seguimientoText}
                    onChange={(e) => setSeguimientoText(e.target.value)}
                    placeholder="Ej: Se revisó el sistema, falta repuesto, se notificó a mantenimiento..."
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg p-3 text-base resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">{seguimientoText.length} / mín. 5 caracteres</p>
                </div>
                {submitError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{submitError}</p>}
                <button
                  type="button"
                  onClick={submitSeguimiento}
                  disabled={submitting || seguimientoText.trim().length < 5}
                  className="w-full bg-brand-blue text-white font-bold py-3 rounded-xl text-sm min-h-[48px] disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : 'Guardar seguimiento'}
                </button>
              </div>
            )}

            {/* ── RESOLUCIÓN ── */}
            {mode === 'resolucion' && (
              <div className="flex flex-col gap-4 pt-4">
                <div className="flex items-start gap-3 bg-amber-50 border-2 border-amber-400 rounded-xl p-4">
                  <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-800 text-sm">Estás por dar por solucionada esta incidencia</p>
                    <p className="text-xs text-amber-700 mt-1">Esta acción es irreversible. La incidencia quedará registrada como resuelta en el historial del puesto.</p>
                  </div>
                </div>
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-0.5">Incidencia</p>
                  <p className="text-sm font-bold text-red-800">{incidencia.titulo}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    ¿Cómo se resolvió? <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={resolucionText}
                    onChange={(e) => setResolucionText(e.target.value)}
                    placeholder="Describí en detalle la solución aplicada, quién intervino y qué fue reemplazado o reparado..."
                    rows={5}
                    className="w-full border border-gray-300 rounded-lg p-3 text-base resize-none"
                  />
                  <p className={`text-xs mt-1 ${resolucionText.length < 15 ? 'text-gray-400' : 'text-green-600'}`}>
                    {resolucionText.length} / mín. 15 caracteres
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Foto de evidencia <span className="text-gray-400 text-xs">(opcional)</span></p>
                  {resolucionFotoPreview ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolucionFotoPreview} alt="Preview" className="w-full rounded-xl object-cover max-h-48" />
                      <button type="button" onClick={() => { setResolucionFoto(null); setResolucionFotoPreview(null) }} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fotoInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-4 text-sm text-gray-500 min-h-[56px] active:bg-gray-50">
                      <Camera size={18} />
                      Adjuntar foto
                    </button>
                  )}
                  <input ref={fotoInputRef} type="file" accept="image/*" capture="environment" onChange={handleFotoChange} className="hidden" />
                </div>
                {submitError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{submitError}</p>}
                <button
                  type="button"
                  onClick={submitResolucion}
                  disabled={submitting || resolucionText.trim().length < 15}
                  className="w-full bg-green-600 text-white font-bold py-3 rounded-xl text-sm min-h-[48px] disabled:opacity-50"
                >
                  {submitting ? 'Procesando...' : 'Confirmar resolución'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
