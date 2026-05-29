export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import ScanResultClient from './ScanResultClient'

export default async function ScanPage({ params }: { params: { codigo: string } }) {
  // Verificar autenticación
  const { data: { user } } = await supabaseServer().auth.getUser()
  if (!user) redirect(`/login?redirect=/ronda/scan/${params.codigo}`)

  // Verificar que sea técnico
  const { data: perfil } = await supabaseAdmin()
    .from('users')
    .select('id, nombre, rol')
    .eq('id', user.id)
    .single()

  if (!perfil || !['tecnico', 'admin'].includes(perfil.rol)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-lg font-bold text-gray-600">Sin permisos</p>
          <p className="text-sm text-gray-400 mt-2">Solo los técnicos pueden escanear puntos de control.</p>
        </div>
      </div>
    )
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
