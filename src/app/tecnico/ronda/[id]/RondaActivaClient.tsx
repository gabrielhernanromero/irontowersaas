'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Circle, MapPin, Loader2, Trophy, Flag, QrCode, AlertCircle, Camera, X, AlertTriangle } from 'lucide-react'
import jsQR from 'jsqr'

interface Scan  { id: string; punto_control_id: string }
interface Punto { id: string; nombre: string; ubicacion: string | null; orden: number; codigo_qr: string }

interface Ronda {
  id: string
  numero_ronda: number
  hora_inicio: string
  hora_fin: string | null
  total_puntos: number
  puntos_escaneados: number
  completa: boolean
  clientes: { id: string; nombre_empresa: string } | null
  ronda_scans: Scan[]
}

interface IncidenciaPunto {
  id: string
  titulo: string
  descripcion: string
  severidad: string | null
}

interface AccionIncidencia {
  accion: 'sigue' | 'cambio' | 'resuelto'
  comentario: string
}

interface Props {
  ronda:               Ronda
  puntos:              Punto[]
  incidenciasPorPunto: Record<string, IncidenciaPunto[]>
}

interface PendingConfirm {
  puntoId:     string
  puntoNombre: string
  codigoQr:    string
  fotoFile:    File | null
  fotoPreview: string | null
  observacion: string
}

export default function RondaActivaClient({ ronda, puntos, incidenciasPorPunto }: Props) {
  const router = useRouter()
  const [scans,          setScans]          = useState<Scan[]>(ronda.ronda_scans)
  const [escaneados,     setEscaneados]     = useState(ronda.puntos_escaneados)
  const [completa,       setCompleta]       = useState(ronda.completa)
  const [completing,     setCompleting]     = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [scanningId,     setScanningId]     = useState<string | null>(null)
  const [uploadingFoto,  setUploadingFoto]  = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)
  const [liveScanning,   setLiveScanning]   = useState(false)
  const [camError,       setCamError]       = useState<string | null>(null)
  const [wrongQr,        setWrongQr]        = useState(false)
  const [incAcciones,    setIncAcciones]    = useState<Record<string, AccionIncidencia>>({})
  const wrongQrTimer                        = useRef<ReturnType<typeof setTimeout> | null>(null)

  const videoRef       = useRef<HTMLVideoElement>(null)
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const streamRef      = useRef<MediaStream | null>(null)
  const scanLoopRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const fotoInputRef   = useRef<HTMLInputElement>(null)
  const pendingPuntoId = useRef<string | null>(null)

  const escaneadosIds = new Set(scans.map(s => s.punto_control_id))
  const pct = ronda.total_puntos > 0 ? Math.round((escaneados / ronda.total_puntos) * 100) : 0

  // ── Ciclo de vida del escáner en vivo ────────────────────────────────────────
  useEffect(() => {
    if (!liveScanning) return

    let cancelled = false
    setCamError(null)

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    }).then(stream => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
    }).catch(() => {
      if (!cancelled) setCamError('No se pudo acceder a la cámara. Verificá los permisos.')
    })

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [liveScanning]) // eslint-disable-line react-hooks/exhaustive-deps

  function startScanLoop() {
    if (scanLoopRef.current) return
    scanLoopRef.current = setInterval(() => {
      const video  = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2 || !pendingPuntoId.current) return

      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const result    = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      })

      if (!result) return

      const puntoId = pendingPuntoId.current
      if (!puntoId) return

      let codigoQr = result.data
      try {
        const url = new URL(result.data)
        const c = url.searchParams.get('c') ?? url.searchParams.get('codigo')
        if (c) {
          codigoQr = c
        } else {
          const parts   = url.pathname.split('/')
          const scanIdx = parts.indexOf('scan')
          if (scanIdx !== -1 && parts[scanIdx + 1]) codigoQr = parts[scanIdx + 1]
        }
      } catch { /* no es URL — usar raw */ }

      // Validar que el QR corresponde al punto tapeado
      const puntoEsperado = puntos.find(p => p.id === puntoId)
      if (puntoEsperado && puntoEsperado.codigo_qr !== codigoQr) {
        // QR incorrecto — mostrar aviso y seguir escaneando
        if (!wrongQrTimer.current) {
          setWrongQr(true)
          wrongQrTimer.current = setTimeout(() => {
            setWrongQr(false)
            wrongQrTimer.current = null
          }, 2000)
        }
        return
      }

      pendingPuntoId.current = null
      stopCamera()
      setLiveScanning(false)
      setWrongQr(false)
      if (wrongQrTimer.current) { clearTimeout(wrongQrTimer.current); wrongQrTimer.current = null }

      const puntoNombre = puntoEsperado?.nombre ?? 'Punto de control'
      setPendingConfirm({ puntoId, puntoNombre, codigoQr, fotoFile: null, fotoPreview: null, observacion: '' })
    }, 300)
  }

  function stopCamera() {
    if (scanLoopRef.current) { clearInterval(scanLoopRef.current); scanLoopRef.current = null }
    if (streamRef.current)   { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
  }

  function closeLiveScanner() {
    pendingPuntoId.current = null
    stopCamera()
    setLiveScanning(false)
    setCamError(null)
    setWrongQr(false)
    if (wrongQrTimer.current) { clearTimeout(wrongQrTimer.current); wrongQrTimer.current = null }
  }

  function handlePuntoClick(puntoId: string) {
    if (escaneadosIds.has(puntoId)) return
    setError(null)
    pendingPuntoId.current = puntoId
    setLiveScanning(true)
  }

  // ── Foto opcional post-scan ───────────────────────────────────────────────────
  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !pendingConfirm) return
    if (pendingConfirm.fotoPreview) URL.revokeObjectURL(pendingConfirm.fotoPreview)
    setPendingConfirm(prev => prev
      ? { ...prev, fotoFile: file, fotoPreview: URL.createObjectURL(file) }
      : null
    )
  }

  function cancelarConfirm() {
    if (pendingConfirm?.fotoPreview) URL.revokeObjectURL(pendingConfirm.fotoPreview)
    setPendingConfirm(null)
    setIncAcciones({})
  }

  async function confirmarScan() {
    if (!pendingConfirm) return
    const { puntoId, codigoQr, fotoFile, observacion } = pendingConfirm

    let foto_url: string | undefined
    if (fotoFile) {
      setUploadingFoto(true)
      try {
        const fd = new FormData()
        fd.append('file', fotoFile)
        const res = await fetch('/api/upload/foto', { method: 'POST', body: fd })
        if (res.ok) { const { path } = await res.json(); foto_url = path }
      } catch { /* foto falla — continuamos sin ella */ }
      setUploadingFoto(false)
    }

    const accionesArray = Object.entries(incAcciones).map(([incidencia_id, { accion, comentario }]) => ({
      incidencia_id, accion, comentario: comentario.trim() || undefined,
    }))

    if (pendingConfirm.fotoPreview) URL.revokeObjectURL(pendingConfirm.fotoPreview)
    setPendingConfirm(null)
    setIncAcciones({})
    setScanningId(puntoId)
    await registrarScan(puntoId, codigoQr, foto_url, observacion || undefined, accionesArray)
  }

  async function registrarScan(
    puntoId: string,
    codigoQr: string,
    fotoUrl?: string,
    observacion?: string,
    accionesIncidencias?: { incidencia_id: string; accion: 'sigue' | 'cambio' | 'resuelto'; comentario?: string }[],
  ) {
    try {
      const res  = await fetch(`/api/tecnico/ronda/${ronda.id}/scan`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          codigo_qr: codigoQr,
          foto_url:  fotoUrl,
          observacion,
          incidencias_acciones: accionesIncidencias?.length ? accionesIncidencias : undefined,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'No se pudo registrar el scan')
        setScanningId(null)
        return
      }

      setScans(prev => [...prev, { id: json.scan.id, punto_control_id: json.scan.punto_control_id ?? puntoId }])
      setEscaneados(json.escaneados)
      if (json.rondaCompleta) setCompleta(true)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setScanningId(null)
    }
  }

  async function completarRonda() {
    setCompleting(true)
    try {
      const res = await fetch(`/api/tecnico/ronda/${ronda.id}/completar`, { method: 'POST' })
      if (res.ok) {
        setCompleta(true)
        setTimeout(() => router.push('/tecnico/ronda'), 2000)
      }
    } finally { setCompleting(false) }
  }

  if (completa) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
          <Trophy size={36} className="text-emerald-600" />
        </div>
        <p className="text-2xl font-black text-brand-ink">¡Ronda completada!</p>
        <p className="text-sm text-gray-500 mt-2">{escaneados}/{ronda.total_puntos} puntos verificados</p>
        <p className="text-xs text-gray-400 mt-4">Volviendo al inicio...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Input foto del punto (post-scan) */}
      <input
        ref={fotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFotoChange}
      />

      {/* Canvas oculto para análisis de frames */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ── Modal escáner QR en vivo ─────────────────────────────────────── */}
      {liveScanning && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col">
          {/* Video fullscreen */}
          <video
            ref={videoRef}
            playsInline
            muted
            onCanPlay={startScanLoop}
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Overlay oscuro con ventana central */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Sombra alrededor del recuadro */}
            <div className="relative">
              <div
                className="w-64 h-64 relative"
                style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
              >
                {/* Esquinas del recuadro */}
                <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-orange rounded-tl-md" />
                <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-orange rounded-tr-md" />
                <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-orange rounded-bl-md" />
                <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-orange rounded-br-md" />

                {/* Línea de escaneo animada */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-brand-orange opacity-80 animate-[scan_2s_linear_infinite]" />
              </div>
            </div>
          </div>

          {/* Error de cámara */}
          {camError && (
            <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 bg-red-900/90 text-white rounded-xl p-4 text-sm text-center z-10">
              {camError}
            </div>
          )}

          {/* QR incorrecto — aviso temporal */}
          {wrongQr && (
            <div className="absolute top-24 left-4 right-4 bg-red-600/90 text-white rounded-xl p-3 text-sm text-center font-semibold z-10 animate-pulse">
              ✗ QR incorrecto — escaneá el código de este punto
            </div>
          )}

          {/* Texto inferior */}
          <div className="absolute bottom-0 left-0 right-0 pb-12 flex flex-col items-center gap-3">
            <p className="text-white text-sm font-semibold drop-shadow">
              Apuntá la cámara al código QR
            </p>
            <button
              onClick={closeLiveScanner}
              className="flex items-center gap-2 bg-white/20 backdrop-blur text-white font-semibold px-6 py-3 rounded-full min-h-[48px]"
            >
              <X size={16} />
              Cancelar
            </button>
          </div>

          {/* Botón X arriba */}
          <button
            onClick={closeLiveScanner}
            className="absolute top-4 right-4 bg-black/40 text-white rounded-full p-2 min-w-[44px] min-h-[44px] flex items-center justify-center z-10"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-brand-ink">Ronda #{ronda.numero_ronda}</h1>
          <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded-full">
            En curso
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">{ronda.clientes?.nombre_empresa}</p>
      </div>

      {/* Progreso */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="font-bold text-brand-ink">{pct}% completado</span>
          <span className="text-gray-400">{escaneados} de {ronda.total_puntos} puntos</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="h-3 rounded-full bg-brand-orange transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Lista de puntos */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Puntos de control
        </p>

        {puntos.map((punto, i) => {
          const escaneado  = escaneadosIds.has(punto.id)
          const procesando = scanningId === punto.id

          return (
            <button
              key={punto.id}
              type="button"
              disabled={escaneado || !!scanningId}
              onClick={() => handlePuntoClick(punto.id)}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                escaneado
                  ? 'bg-emerald-50 border-emerald-100 cursor-default'
                  : procesando
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-gray-100 active:bg-gray-50'
              }`}
            >
              {escaneado ? (
                <CheckCircle size={24} className="text-emerald-500 shrink-0" />
              ) : procesando ? (
                <Loader2 size={24} className="text-brand-blue shrink-0 animate-spin" />
              ) : (
                <Circle size={24} className="text-gray-200 shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-300">#{i + 1}</span>
                  <p className={`text-sm font-semibold ${escaneado ? 'text-emerald-700' : procesando ? 'text-brand-blue' : 'text-brand-ink'}`}>
                    {punto.nombre}
                  </p>
                </div>
                {punto.ubicacion && (
                  <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <MapPin size={10} /> {punto.ubicacion}
                  </p>
                )}
                {!escaneado && !procesando && (
                  <p className="text-xs text-brand-blue mt-1 flex items-center gap-1">
                    <QrCode size={11} /> Tocá para escanear QR
                  </p>
                )}
                {procesando && (
                  <p className="text-xs text-brand-blue mt-1">Registrando...</p>
                )}
              </div>

              {escaneado && (
                <span className="text-xs font-semibold text-emerald-600 shrink-0">✓</span>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Instrucción o botón finalizar — usa scans.length (real) no el contador del DB */}
      {scans.length < ronda.total_puntos ? (
        <div className="bg-brand-ink rounded-2xl p-4 text-white text-center">
          <p className="text-sm font-semibold">Tocá un punto de control para escanear su QR</p>
          <p className="text-xs text-white/60 mt-1">La cámara se abrirá automáticamente</p>
        </div>
      ) : (
        <button
          onClick={completarRonda}
          disabled={completing}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-black py-5 rounded-2xl text-lg active:scale-95 transition-transform disabled:opacity-60"
        >
          {completing
            ? <><Loader2 size={22} className="animate-spin" /> Finalizando...</>
            : <><Flag size={22} /> Finalizar ronda</>
          }
        </button>
      )}

      {/* Sheet confirmación de scan con foto opcional */}
      {pendingConfirm && (() => {
        const incidenciasEnPunto = incidenciasPorPunto[pendingConfirm.puntoId] ?? []
        const puedeConfirmar = !uploadingFoto && incidenciasEnPunto.every(inc => {
          const a = incAcciones[inc.id]
          if (!a) return false
          if (a.accion === 'sigue') return true
          return a.comentario.trim().length > 0
        })
        return (
          <>
            <div className="fixed inset-0 bg-black/40 z-[60]" onClick={cancelarConfirm} />
            <div className="fixed bottom-0 left-0 right-0 md:left-56 z-[70] bg-white rounded-t-2xl shadow-xl p-5 pb-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>

              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                <p className="font-bold text-brand-ink">QR detectado</p>
              </div>
              <p className="text-sm text-gray-500 mb-3 pl-6">{pendingConfirm.puntoNombre}</p>

              {/* Incidencias abiertas — acción obligatoria */}
              {incidenciasEnPunto.map(inc => {
                const acc = incAcciones[inc.id]
                return (
                  <div key={inc.id} className={`rounded-xl border p-4 mb-3 transition-colors ${
                    acc?.accion === 'resuelto' ? 'bg-emerald-50 border-emerald-200'
                    : acc?.accion === 'cambio' ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-start gap-2 mb-3">
                      <AlertTriangle size={16} className={`shrink-0 mt-0.5 ${
                        acc?.accion === 'resuelto' ? 'text-emerald-500'
                        : acc?.accion === 'cambio' ? 'text-amber-500'
                        : 'text-red-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-red-700 mb-0.5">Incidencia abierta</p>
                        <p className="text-sm font-semibold text-brand-ink">{inc.titulo}</p>
                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{inc.descripcion}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {(['sigue', 'cambio', 'resuelto'] as const).map(op => (
                        <button
                          key={op}
                          type="button"
                          onClick={() => setIncAcciones(prev => ({
                            ...prev,
                            [inc.id]: { accion: op, comentario: prev[inc.id]?.comentario ?? '' },
                          }))}
                          className={`py-2.5 rounded-lg text-xs font-bold border transition-colors min-h-[44px] ${
                            acc?.accion === op
                              ? op === 'sigue'   ? 'bg-gray-700 text-white border-gray-700'
                              : op === 'cambio'  ? 'bg-amber-500 text-white border-amber-500'
                              :                    'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-gray-600 border-gray-200 active:bg-gray-50'
                          }`}
                        >
                          {op === 'sigue' ? 'Sigue igual' : op === 'cambio' ? 'Cambió algo' : 'Resuelta'}
                        </button>
                      ))}
                    </div>

                    {(acc?.accion === 'cambio' || acc?.accion === 'resuelto') && (
                      <textarea
                        value={acc.comentario}
                        onChange={e => setIncAcciones(prev => ({
                          ...prev,
                          [inc.id]: { ...prev[inc.id], comentario: e.target.value },
                        }))}
                        placeholder={acc.accion === 'cambio' ? 'Describí qué cambió...' : '¿Cómo se resolvió?'}
                        maxLength={500}
                        rows={2}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-brand-ink placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand-orange/40 mt-2"
                      />
                    )}
                  </div>
                )
              })}

              {/* Foto opcional */}
              {pendingConfirm.fotoPreview ? (
                <div className="relative mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pendingConfirm.fotoPreview}
                    alt="Foto del punto"
                    className="w-full h-44 object-cover rounded-xl border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => setPendingConfirm(prev => prev
                      ? { ...prev, fotoFile: null, fotoPreview: null }
                      : null
                    )}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fotoInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-gray-500 text-sm mb-4 min-h-[52px] active:bg-gray-50"
                >
                  <Camera size={18} />
                  Foto del estado del punto (opcional)
                </button>
              )}

              {/* Novedad adicional (para reportar algo nuevo, sin incidencia previa) */}
              <textarea
                value={pendingConfirm.observacion}
                onChange={e => setPendingConfirm(prev => prev ? { ...prev, observacion: e.target.value } : null)}
                placeholder={incidenciasEnPunto.length ? 'Nueva novedad sobre este punto (opcional)' : 'Novedad o observación (opcional)'}
                maxLength={500}
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-brand-ink placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand-orange/40 mb-4"
              />

              <button
                type="button"
                onClick={confirmarScan}
                disabled={!puedeConfirmar}
                className="w-full flex items-center justify-center gap-2 bg-brand-orange text-white font-bold py-4 rounded-xl min-h-[52px] disabled:opacity-60"
              >
                {uploadingFoto
                  ? <><Loader2 size={18} className="animate-spin" /> Subiendo foto...</>
                  : incidenciasEnPunto.length > 0 && !incidenciasEnPunto.every(i => incAcciones[i.id])
                    ? 'Indicá el estado de cada incidencia'
                    : 'Confirmar scan'
                }
              </button>

              <button
                type="button"
                onClick={cancelarConfirm}
                className="w-full text-gray-400 text-sm py-3 mt-1 min-h-[44px]"
              >
                Cancelar
              </button>
            </div>
          </>
        )
      })()}
    </div>
  )
}
