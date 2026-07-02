export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lock, AlertTriangle, Droplets, FlameKindling } from 'lucide-react'
import CerrarGuardiaForm from './CerrarGuardiaForm'

interface Props {
  searchParams: { turno_id?: string }
}

export default async function CerrarGuardiaPage({ searchParams }: Props) {
  const user = await requireRole('tecnico', 'admin')
  const turnoId = searchParams.turno_id ?? ''

  if (!turnoId) redirect('/tecnico/libro-guardia')

  // Verificar que el turno existe y pertenece al usuario
  const { data: turno } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, estado, tecnico_id, esquema_id')
    .eq('id', turnoId)
    .single()

  if (!turno || turno.tecnico_id !== user.id || turno.estado !== 'abierto') {
    redirect('/tecnico/libro-guardia')
  }

  // Hora fin programada del esquema (para detectar cierre anticipado en el form)
  let horaFinEsquema: string | null = null
  if (turno.esquema_id) {
    const { data: esquema } = await supabaseAdmin()
      .from('esquemas_cobertura')
      .select('hora_fin')
      .eq('id', turno.esquema_id)
      .single()
    horaFinEsquema = esquema?.hora_fin?.slice(0, 5) ?? null
  }

  // Planillas habilitadas para este cliente
  const { data: perfilTecnico } = await supabaseAdmin()
    .from('users')
    .select('cliente_id')
    .eq('id', user.id)
    .single()

  let planillasHabilitadas: string[] = ['hidrantes', 'extintores']
  if (perfilTecnico?.cliente_id) {
    const { data: cliente } = await supabaseAdmin()
      .from('clientes')
      .select('planillas_habilitadas')
      .eq('id', perfilTecnico.cliente_id)
      .single()
    if (cliente?.planillas_habilitadas?.length) {
      planillasHabilitadas = cliente.planillas_habilitadas
    }
  }

  // Verificar planillas enviadas para este turno
  const { data: planillas } = await supabaseAdmin()
    .from('planillas')
    .select('tipo')
    .eq('turno_id', turnoId)
    .eq('inmutable', true)

  const tiposEnviados = (planillas ?? []).map((p) => p.tipo)
  const faltaHidrantes = planillasHabilitadas.includes('hidrantes') && !tiposEnviados.includes('hidrantes')
  const faltaExtintores = planillasHabilitadas.includes('extintores') && !tiposEnviados.includes('extintores')
  const planillasPendientes = faltaHidrantes || faltaExtintores

  return (
    <div className="pb-28">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/tecnico/libro-guardia" className="p-2 -ml-2 text-gray-500 min-h-[44px] flex items-center">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-condensed font-bold text-brand-ink">Cerrar guardia</h1>
      </div>

      {/* Bloqueo — planillas pendientes */}
      {planillasPendientes ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 bg-red-50 border-2 border-red-300 rounded-xl p-4">
            <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800 text-sm">No podés cerrar el turno aún</p>
              <p className="text-xs text-red-700 mt-1">
                Para cerrar la guardia tenés que enviar todas las planillas primero.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {faltaHidrantes && (
              <Link
                href="/tecnico/hidrantes"
                className="flex items-center gap-4 bg-white rounded-xl border-2 border-brand-blue p-4 min-h-[72px] active:bg-blue-50"
              >
                <div className="w-10 h-10 rounded-full bg-brand-blue flex items-center justify-center shrink-0">
                  <Droplets size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-brand-ink">Planilla Hidrantes</p>
                  <p className="text-sm text-red-600 font-medium">Pendiente de envío</p>
                </div>
              </Link>
            )}
            {faltaExtintores && (
              <Link
                href="/tecnico/extintores"
                className="flex items-center gap-4 bg-white rounded-xl border-2 border-brand-orange p-4 min-h-[72px] active:bg-orange-50"
              >
                <div className="w-10 h-10 rounded-full bg-brand-orange flex items-center justify-center shrink-0">
                  <FlameKindling size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-brand-ink">Planilla Extintores</p>
                  <p className="text-sm text-red-600 font-medium">Pendiente de envío</p>
                </div>
              </Link>
            )}
          </div>

          <Link
            href="/tecnico/libro-guardia"
            className="text-center text-sm text-gray-500 underline py-2"
          >
            Volver al libro de guardia
          </Link>
        </div>
      ) : (
        <>
          {/* Aviso — planillas OK */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
            <Lock size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Una vez cerrado el turno <strong>no podrás agregar más novedades</strong>.
              El técnico entrante deberá firmar el relevo.
            </p>
          </div>

          <CerrarGuardiaForm turnoId={turnoId} horaFinEsquema={horaFinEsquema} />
        </>
      )}
    </div>
  )
}
