'use client'

import { useSearchParams } from 'next/navigation'
import QRCode from 'react-qr-code'
import { useEffect } from 'react'

export default function PrintQrPage() {
  const params    = useSearchParams()
  const codigo    = params.get('codigo')    ?? ''
  const nombre    = params.get('nombre')    ?? 'Punto de control'
  const ubicacion = params.get('ubicacion') ?? ''

  // Usar el origin real de la página para que el QR apunte al entorno correcto
  const qrUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/ronda/scan/${codigo}`
    : `/ronda/scan/${codigo}`

  useEffect(() => {
    setTimeout(() => window.print(), 600)
  }, [])

  return (
    <>
      {/* CSS que al imprimir oculta TODO excepto este contenido */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #qr-print-root, #qr-print-root * { visibility: visible; }
          #qr-print-root {
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: white;
          }
          @page { margin: 0; size: A4 portrait; }
        }
      `}</style>

      <div id="qr-print-root" className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-5">
          {/* Logo */}
          <div className="text-center">
            <p className="font-condensed font-black text-2xl text-brand-ink tracking-tight">IRON TOWER</p>
            <p className="text-xs text-gray-400 uppercase tracking-widest">Sistema de Control de Rondas</p>
          </div>

          {/* QR */}
          <div className="border-4 border-brand-ink rounded-2xl p-5 bg-white shadow-lg">
            <QRCode value={qrUrl} size={240} />
          </div>

          {/* Nombre y ubicación */}
          <div className="text-center">
            <p className="font-black text-2xl text-brand-ink uppercase tracking-wide">{nombre}</p>
            {ubicacion && <p className="text-sm text-gray-500 mt-1">{ubicacion}</p>}
          </div>

          {/* Instrucción */}
          <p className="text-sm text-gray-400">Escaneá este código durante tu ronda</p>

          {/* Botón — solo visible en pantalla */}
          <button
            onClick={() => window.print()}
            className="mt-2 px-6 py-2 bg-brand-ink text-white text-sm font-semibold rounded-xl print:hidden"
          >
            Imprimir
          </button>
        </div>
      </div>
    </>
  )
}
