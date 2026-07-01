export const dynamic = 'force-dynamic'

import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import ScanResultClient from './ScanResultClient'
import { ShieldCheck, Lock } from 'lucide-react'

function PantallaAccesoRestringido({ motivo }: { motivo: 'sin_sesion' | 'sin_rol' }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-5">
        <div className="w-20 h-20 rounded-full bg-brand-ink flex items-center justify-center mx-auto">
          <ShieldCheck size={36} className="text-white" />
        </div>

        <div>
          <p className="text-xl font-black text-brand-ink">Punto de control de seguridad</p>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Este código QR pertenece al sistema de rondas de Iron Tower.
            Es de uso exclusivo del personal técnico autorizado.
          </p>
        </div>

        {motivo === 'sin_sesion' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2 text-gray-500">
              <Lock size={16} />
              <span className="text-sm font-semibold">Acceso restringido</span>
            </div>
            <p className="text-xs text-gray-400 text-left leading-relaxed">
              Si sos técnico de Iron Tower, iniciá sesión desde la aplicación para registrar este punto.
            </p>
            <a
              href="/login"
              className="block w-full text-center bg-brand-orange text-white font-bold py-3.5 rounded-2xl text-sm"
            >
              Iniciar sesión
            </a>
          </div>
        )}

        {motivo === 'sin_rol' && (
          <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
            <p className="text-sm text-amber-700 font-semibold">Tu cuenta no tiene permisos para escanear puntos de control.</p>
            <p className="text-xs text-amber-600 mt-1">Contactá al supervisor si creés que es un error.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default async function ScanPage({ params }: { params: { codigo: string } }) {
  // Verificar autenticación — sin redirect, mostramos pantalla informativa
  const { data: { user } } = await supabaseServer().auth.getUser()
  if (!user) return <PantallaAccesoRestringido motivo="sin_sesion" />

  // Verificar que sea técnico o admin
  const { data: perfil } = await supabaseAdmin()
    .from('users')
    .select('id, nombre, rol')
    .eq('id', user.id)
    .single()

  if (!perfil || !['tecnico', 'admin'].includes(perfil.rol)) {
    return <PantallaAccesoRestringido motivo="sin_rol" />
  }

  // Verificar que el punto de control existe
  const { data: punto } = await supabaseAdmin()
    .from('puntos_control')
    .select('id, nombre, ubicacion, cliente_id, activo, clientes(id, nombre_empresa)')
    .eq('codigo_qr', params.codigo)
    .single()

  if (!punto || !punto.activo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-lg font-bold text-gray-600">Punto no encontrado</p>
          <p className="text-sm text-gray-400 mt-2">Este código QR no corresponde a un punto de control activo.</p>
        </div>
      </div>
    )
  }

  // Buscar ronda activa del técnico para este cliente
  const { data: rondaActiva } = await supabaseAdmin()
    .from('rondas')
    .select('id, numero_ronda, puntos_escaneados, total_puntos, cliente_id')
    .eq('tecnico_id', user.id)
    .eq('cliente_id', punto.cliente_id)
    .is('hora_fin', null)
    .eq('completa', false)
    .order('hora_inicio', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <ScanResultClient
      codigoQr={params.codigo}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      punto={punto as any}
      rondaActiva={rondaActiva}
    />
  )
}
