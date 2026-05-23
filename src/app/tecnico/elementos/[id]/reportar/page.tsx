export const dynamic = 'force-dynamic'

import { requireRole } from '@/lib/auth/requireRole'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { notFound } from 'next/navigation'
import ReportarNovedadForm from '@/components/inventario/ReportarNovedadForm'

interface Props {
  params: { id: string }
  searchParams: { tipo?: string }
}

export default async function ReportarNovedadPage({ params, searchParams }: Props) {
  const defaultTipo = searchParams.tipo === 'extraviado' ? 'extraviado' : 'dañado'
  const user = await requireRole('tecnico', 'admin')

  // Buscar el elemento
  const { data: elemento } = await supabaseAdmin()
    .from('elementos_puesto')
    .select('id, nombre, codigo_patrimonial, categoria, estado_admin, cliente_id')
    .eq('id', params.id)
    .single()

  if (!elemento || elemento.estado_admin === 'inactivo') notFound()

  if (elemento.estado_admin === 'en_mantenimiento') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link href="/tecnico/elementos" className="p-2 -ml-2 text-gray-500 min-h-[44px] flex items-center">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-condensed font-bold text-brand-ink">Reportar novedad</h1>
        </div>
        <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <AlertTriangle size={20} className="text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-slate-700">Elemento en mantenimiento</p>
            <p className="text-sm text-slate-500 mt-1">
              Este elemento fue retirado por la supervisión y no puede recibir novedades hasta que vuelva al puesto.
            </p>
          </div>
        </div>
        <Link href="/tecnico/elementos" className="text-center text-brand-orange text-sm font-semibold">
          Volver al inventario
        </Link>
      </div>
    )
  }

  // Buscar turno activo del técnico
  const { data: turnoActivo } = await supabaseAdmin()
    .from('libro_turno')
    .select('id, folio_numero')
    .eq('tecnico_id', user.id)
    .eq('estado', 'abierto')
    .maybeSingle()

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/tecnico/elementos" className="p-2 -ml-2 text-gray-500 min-h-[44px] flex items-center">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-condensed font-bold text-brand-ink">Reportar novedad</h1>
          <p className="text-xs text-gray-400">{elemento.nombre}</p>
        </div>
      </div>

      {/* Sin turno abierto */}
      {!turnoActivo ? (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <AlertTriangle size={40} className="text-amber-400" />
          <div>
            <p className="font-semibold text-brand-ink">Necesitás un turno abierto</p>
            <p className="text-sm text-gray-500 mt-1">
              Solo podés reportar novedades durante una guardia activa.
            </p>
          </div>
          <Link
            href="/tecnico/libro-guardia"
            className="text-sm font-semibold text-brand-orange underline"
          >
            Ir al Libro de Guardia
          </Link>
        </div>
      ) : (
        <ReportarNovedadForm
          elementoId={elemento.id}
          elementoNombre={elemento.nombre}
          codigoPatrimonial={elemento.codigo_patrimonial}
          turnoId={turnoActivo.id}
          folioNumero={turnoActivo.folio_numero}
          defaultTipo={defaultTipo}
        />
      )}
    </div>
  )
}
