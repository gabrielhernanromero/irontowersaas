'use client'

import { useSearchParams } from 'next/navigation'
import QRCode from 'react-qr-code'
import { useEffect } from 'react'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export default function PrintQrPage() {
  const params   = useSearchParams()
  const codigo   = params.get('codigo')   ?? ''
  const nombre   = params.get('nombre')   ?? 'Punto de control'
  const ubicacion = params.get('ubicacion') ?? ''

  const qrUrl = `${APP_URL}/ronda/scan/${codigo}`

  useEffect(() => {
    // Auto-print al abrir la página
    setTimeout(() => window.print(), 600)
  }, [])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8 print:p-0 print:min-h-0 print:h-screen print:overflow-hidden">
      <div className="flex flex-col items-center gap-4 print:gap-2">
        {/* Logo + header */}
        <div className="text-center mb-2">
          <p className="font-condensed font-black text-2xl text-brand-ink tracking-tight">IRON TOWER</p>
          <p className="text-xs text-gray-400 uppercase tracking-widest">Sistema de Control de Rondas</p>
        </div>

        {/* QR code */}
        <div className="border-4 border-brand-ink rounded-2xl p-5 bg-white shadow-lg print:shadow-none print:border-2">
          <QRCode value={qrUrl} size={220} />
        </div>

        {/* Nombre y ubicación */}
        <div className="text-center mt-2">
          <p className="font-black text-xl text-brand-ink uppercase tracking-wide">{nombre}</p>
          {ubicacion && (
            <p className="text-sm text-gray-500 mt-1">{ubicacion}</p>
          )}
        </div>

        {/* Instrucción */}
        <div className="mt-2 bg-gray-50 rounded-xl px-6 py-3 text-center print:bg-transparent">
          <p className="text-xs text-gray-400">Escaneá este código durante tu ronda</p>
        </div>

        {/* Print button (hidden when printing) */}
        <button
          onClick={() => window.print()}
          className="mt-4 px-6 py-2 bg-brand-ink text-white text-sm font-semibold rounded-xl print:hidden"
        >
          Imprimir
        </button>
      </div>
    </div>
  )
}
