import { supabaseServer } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function PlanillasPage({
  searchParams,
}: {
  searchParams: { tipo?: string; fecha?: string }
}) {
  const sb = supabaseServer()

  let query = sb
    .from('planillas')
    .select(`
      id, tipo, fecha, turno, inmutable, enviada_at, created_at,
      users!tecnico_id(nombre, apellido),
      clientes(nombre_empresa)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (searchParams.tipo) query = query.eq('tipo', searchParams.tipo)
  if (searchParams.fecha) query = query.eq('fecha', searchParams.fecha)

  const { data: planillas } = await query

  return (
    <div>
      <h1 className="text-2xl font-condensed font-bold text-brand-ink mb-4">Planillas</h1>

      {/* Filtros */}
      <form className="flex gap-3 mb-6 flex-wrap">
        <select
          name="tipo"
          defaultValue={searchParams.tipo ?? ''}
          className="border border-gray-300 rounded p-2 text-sm min-h-[44px]"
        >
          <option value="">Todos los tipos</option>
          <option value="hidrantes">Hidrantes</option>
          <option value="extintores">Extintores</option>
        </select>
        <input
          type="date"
          name="fecha"
          defaultValue={searchParams.fecha ?? ''}
          className="border border-gray-300 rounded p-2 text-sm min-h-[44px]"
        />
        <button
          type="submit"
          className="bg-brand-blue text-white px-4 py-2 rounded text-sm min-h-[44px]"
        >
          Filtrar
        </button>
      </form>

      {!planillas?.length && (
        <p className="text-gray-500 text-sm">No hay planillas con esos filtros.</p>
      )}

      <div className="flex flex-col gap-2">
        {planillas?.map((p) => (
          <Link
            key={p.id}
            href={`/supervisor/planillas/${p.id}`}
            className="bg-white border border-gray-100 rounded-xl p-4 flex justify-between items-center hover:bg-gray-50"
          >
            <div>
              <p className="font-medium text-brand-ink capitalize">{p.tipo}</p>
              <p className="text-sm text-gray-500">
                {/* @ts-expect-error supabase join */}
                {p.clientes?.nombre_empresa} ·{' '}
                {/* @ts-expect-error supabase join */}
                {p.users?.nombre} {p.users?.apellido}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">{p.fecha}</p>
              <p className="text-xs text-gray-400 capitalize">{p.turno}</p>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  p.inmutable
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {p.inmutable ? 'Enviada' : 'Borrador'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
