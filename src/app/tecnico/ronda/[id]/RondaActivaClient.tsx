'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Circle, MapPin, Loader2, Trophy, Flag, QrCode, AlertCircle } from 'lucide-react'

interface Scan  { id: string; punto_control_id: string }
interface Punto { id: string; nombre: string; ubicacion: string | null; orden: number }

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

interface Props {
  ronda:  Ronda
  puntos: Punto[]
}

// BarcodeDetector no está en los tipos TS estándar
declare const BarcodeDetector: {
  new(options?: { formats: string[] }): {
    detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string }>>
  }
  getSupportedFormats?(): Promise<string[]>
}

export default function RondaActivaClient({ ronda, puntos }: Props) {
  const router = useRouter()
  const [scans,        setScans]        = useState<Scan[]>(ronda.ronda_scans)
  const [escaneados,   setEscaneados]   = useState(ronda.puntos_escaneados)
  const [completa,     setCompleta]     = useState(ronda.completa)
  const [completing,   setCompleting]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [scanningId,   setScanningId]   = useState<string | null>(null)  // punto.id siendo procesado
  const [iosWarning,   setIosWarning]   = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingPuntoId = useRef<string | null>(null)

  const escaneadosIds = new Set(scans.map(s => s.punto_control_id))
  const pct = ronda.total_puntos > 0 ? Math.round((escaneados / ronda.total_puntos) * 100) : 0

  function handlePuntoClick(puntoId: string) {
    if (escaneadosIds.has(puntoId)) return
    setError(null)

    const tieneDetector = typeof BarcodeDetector !== 'undefined'
    if (!tieneDetector) {
      // iOS Safari no soporta BarcodeDetector — avisamos
      setIosWarning(true)
      return
    }

    pendingPuntoId.current = puntoId
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Limpiar el input para permitir capturar de nuevo si falla
    e.target.value = ''
    if (!file || !pendingPuntoId.current) return

    const puntoId = pendingPuntoId.current
    pendingPuntoId.current = null
    setScanningId(puntoId)
    setError(null)

    try {
      const bitmap = await createImageBitmap(file)
      const detector = new BarcodeDetector({ formats: ['qr_code'] })
      const results  = await detector.detect(bitmap)

      if (!results.length) {
        setError('No se detectó un código QR. Intentá de nuevo apuntando bien.')
        setScanningId(null)
        return
      }

      const rawValue = results[0].rawValue
      // El rawValue puede ser una URL (ej: https://app.com/ronda/scan?c=CODIGO) o el código directo
      let codigoQr = rawValue
      try {
        const url = new URL(rawValue)
        const c = url.searchParams.get('c') ?? url.searchParams.get('codigo')
        if (c) codigoQr = c
      } catch {
        // rawValue no es URL — lo usamos tal cual
      }

      await registrarScan(puntoId, codigoQr)
    } catch (err) {
      console.error('Error BarcodeDetector:', err)
      setError('Error al leer la imagen. Intentá de nuevo.')
      setScanningId(null)
    }
  }

  async function registrarScan(puntoId: string, codigoQr: string) {
    try {
      const res  = await fetch(`/api/tecnico/ronda/${ronda.id}/scan`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ codigo_qr: codigoQr }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'No se pudo registrar el scan')
        setScanningId(null)
        return
      }

      // Actualizar estado local
      setScans(prev => [...prev, { id: json.scan.id, punto_control_id: puntoId }])
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
      {/* Input oculto para la cámara */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

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
              {/* Icono estado */}
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
                  <p className="text-xs text-brand-blue mt-1">Leyendo código...</p>
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

      {/* Aviso iOS — BarcodeDetector no disponible */}
      {iosWarning && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setIosWarning(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-2xl shadow-xl p-5 max-w-[430px] mx-auto">
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="flex flex-col items-center text-center gap-3 pb-4">
              <QrCode size={36} className="text-brand-blue" />
              <p className="font-bold text-brand-ink">Escanear QR</p>
              <p className="text-sm text-gray-600">
                En iOS, usá la cámara nativa del dispositivo para escanear el código QR del checkpoint. El link te llevará de vuelta a esta pantalla automáticamente.
              </p>
              <button
                type="button"
                onClick={() => setIosWarning(false)}
                className="w-full bg-brand-ink text-white font-bold py-3 rounded-xl text-sm min-h-[48px]"
              >
                Entendido
              </button>
            </div>
          </div>
        </>
      )}

      {/* Instrucción o botón finalizar */}
      {escaneados < ronda.total_puntos ? (
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
    </div>
  )
}
