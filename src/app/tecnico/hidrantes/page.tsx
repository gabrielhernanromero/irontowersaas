import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import HidrantesForm from '@/components/forms/HidrantesForm'
import Link from 'next/link'
import { CheckCircle2, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function HidrantesPage() {
  const user = await requireRole('tecnico', 'admin')

  let turnoActivo = (await supabaseAdmin()
    .from('libro_turno')
    .select('id, turno, fecha, cliente_id, clientes(nombre_empresa)')
    .eq('tecnico_id', user.id)
    .eq('estado', 'abierto')
    .maybeSingle()).data

  // Apoyo: si no tiene turno propio, usar el del encargado en el mismo cliente
  if (!turnoActivo) {
    const { data: perfil } = await supabaseAdmin()
      .from('users').select('cliente_id').eq('id', user.id).single()
    if (perfil?.cliente_id) {
      turnoActivo = (await supabaseAdmin()
        .from('libro_turno')
        .select('id, turno, fecha, cliente_id, clientes(nombre_empresa)')
        .eq('cliente_id', perfil.cliente_id)
        .eq('estado', 'abierto')
        .neq('tecnico_id', user.id)
        .maybeSingle()).data
    }
  }

  // Busca por turno_id — más robusto que cliente+fecha+turno
  const planillaEnviada = turnoActivo
    ? (await supabaseAdmin()
        .from('planillas')
        .select('id, tipo')
        .eq('turno_id', turnoActivo.id)
        .eq('tipo', 'hidrantes')
        .eq('inmutable', true)
        .maybeSingle()
      ).data
    : null

  if (planillaEnviada) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-16 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="text-green-600" size={36} />
        </div>
        <div>
          <h1 className="text-xl font-condensed font-bold text-brand-ink">Planilla ya enviada</h1>
          <p className="text-gray-500 text-sm mt-1">
            Ya registraste la planilla de hidrantes para este turno.
          </p>
        </div>
        <Link
          href={`/tecnico/historial/${planillaEnviada.id}`}
          className="flex items-center gap-2 bg-brand-ink text-white font-bold px-6 py-3 rounded-xl text-sm min-h-[48px]"
        >
          <Eye size={18} />
          Ver planilla enviada
        </Link>
        <Link href="/tecnico/home" className="text-sm text-brand-blue underline min-h-[44px] flex items-center">
          Volver al inicio
        </Link>
      </div>
    )
  }

  const { data: perfil } = await supabaseAdmin()
    .from('users').select('nombre, apellido, dni').eq('id', user.id).single()

  const aclaracion = perfil
    ? `${perfil.nombre} ${perfil.apellido} — DNI ${perfil.dni}`
    : undefined

  const clienteData = turnoActivo?.clientes as unknown as { nombre_empresa: string } | null

  return (
    <div>
      <h1 className="text-xl font-condensed font-bold text-brand-ink mb-4">
        Planilla de Hidrantes
      </h1>
      <HidrantesForm
        clienteId={turnoActivo?.cliente_id ?? null}
        clienteNombre={clienteData?.nombre_empresa ?? null}
        turnoDefault={(turnoActivo?.turno as 'diurno' | 'nocturno') ?? (new Date().getHours() < 18 ? 'diurno' : 'nocturno')}
        aclaracion={aclaracion}
      />
    </div>
  )
}
