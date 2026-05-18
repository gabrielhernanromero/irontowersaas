import { supabaseServer } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/getSession'
import Link from 'next/link'
import { CheckCircle2, Clock, ChevronRight } from 'lucide-react'

interface Props {
  searchParams: { enviada?: string }
}

export default async function HistorialPage({ searchParams }: Props) {
  const { user } = await getSession()

  const { data: planillas } = await supabaseServer()
    .from('planillas')
    .select('id, tipo, fecha, turno, enviada_at, inmutable, clientes(nombre_empresa)')
    .eq('tecnico_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div>
      <h1 className="text-xl font-condensed font-bold text-brand-ink mb-4">Mis planillas</h1>

      {/* Banner de envío exitoso */}
      {searchParams.enviada === '1' && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-300 rounded-xl p-4 mb-4">
          <CheckCircle2 className="text-green-600 shrink-0" size={24} />
          <div>
            <p className="font-semibold text-green-800 text-sm">Planilla enviada correctamente</p>
            <p className="text-green-700 text-xs mt-0.5">Quedó registrada y ya no puede modificarse.</p>
          </div>
        </div>
      )}

      {!planillas?.length && (
        <p className="text-gray-500 text-center py-12">No hay planillas enviadas aún.</p>
      )}

      <div className="flex flex-col gap-3">
        {planillas?.map((p) => (
          <Link
            key={p.id}
            href={`/tecnico/historial/${p.id}`}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 active:bg-gray-50 flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold capitalize text-brand-ink">{p.tipo}</p>
                {p.inmutable ? (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                    <CheckCircle2 size={11} />
                    Enviada
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700">
                    <Clock size={11} />
                    No enviada
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 truncate">
                {/* @ts-expect-error supabase join */}
                {p.clientes?.nombre_empresa}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {p.fecha} — turno {p.turno}
              </p>
            </div>
            <ChevronRight size={18} className="text-gray-300 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
